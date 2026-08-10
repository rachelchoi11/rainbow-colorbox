# -*- coding: utf-8 -*-
"""정산 표준화 웹앱 — FastAPI
업로드 → 표준화 → 작가별·유통사별 정산 + 근거 + 미매칭 보드
"""
import os, io, sys, json, uuid, shutil, tempfile, secrets, warnings
warnings.filterwarnings("ignore")
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import (JSONResponse, StreamingResponse, FileResponse,
                               HTMLResponse, RedirectResponse, PlainTextResponse)
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
import pandas as pd

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
import engine

# ── 인증 (실데이터 보호) ──
APP_PASSWORD = os.environ.get("APP_PASSWORD", "")          # 배포 시 반드시 env로 설정
SESSION_SECRET = os.environ.get("SESSION_SECRET") or secrets.token_hex(16)
OPEN_PATHS = ("/login", "/healthz")                         # 인증 없이 허용

app = FastAPI(title="정산 표준화 솔루션")


@app.middleware("http")
async def auth_gate(request: Request, call_next):
    # 비밀번호 미설정(로컬 개발)이면 통과. 설정 시 전 경로 보호.
    if APP_PASSWORD and not request.session.get("auth") and request.url.path not in OPEN_PATHS:
        if request.url.path.startswith("/api/"):
            return JSONResponse({"detail": "인증이 필요합니다."}, status_code=401)
        return RedirectResponse("/login")
    return await call_next(request)


# SessionMiddleware를 나중에 추가 → 가장 바깥(먼저 실행)에서 세션 복원 후 auth_gate 동작
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, max_age=60 * 60 * 12)


_LOGIN_HTML = """<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>로그인 · 정산 표준화</title>
<style>body{font-family:'Pretendard','Malgun Gothic',sans-serif;background:#f5f6f8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{background:#fff;border:1px solid #e7eaef;border-radius:16px;padding:36px 32px;width:340px;box-shadow:0 4px 20px rgba(20,30,55,.06)}
.logo{width:40px;height:40px;border-radius:10px;background:#2f6bff;display:flex;align-items:center;justify-content:center;margin-bottom:16px}
h1{font-size:18px;font-weight:800;margin:0 0 4px;color:#1a1d24}.s{font-size:12.5px;color:#7a828e;margin-bottom:20px}
input{width:100%;border:1px solid #e7eaef;border-radius:9px;padding:12px 13px;font-size:14px;margin-bottom:10px;font-family:inherit}
input:focus{outline:none;border-color:#2f6bff}button{width:100%;background:#2f6bff;color:#fff;border:none;border-radius:9px;padding:13px;font-size:15px;font-weight:700;cursor:pointer}
.err{color:#e5484d;font-size:12.5px;margin-bottom:10px}</style></head>
<body><form class="box" method="post" action="/login">
<div class="logo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg></div>
<h1>정산 표준화 솔루션</h1><div class="s">유통사 정산서 표준화·작가 정산 산출</div>
{ERR}<input type="password" name="password" placeholder="접속 비밀번호" autofocus>
<button type="submit">로그인</button></form></body></html>"""


@app.get("/login")
async def login_page(request: Request):
    if not APP_PASSWORD or request.session.get("auth"):
        return RedirectResponse("/")
    return HTMLResponse(_LOGIN_HTML.replace("{ERR}", ""))


@app.post("/login")
async def login_submit(request: Request, password: str = Form("")):
    if APP_PASSWORD and secrets.compare_digest(password, APP_PASSWORD):
        request.session["auth"] = True
        return RedirectResponse("/", status_code=303)
    return HTMLResponse(_LOGIN_HTML.replace("{ERR}", '<div class="err">비밀번호가 올바르지 않습니다.</div>'),
                        status_code=401)


@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/login")


@app.get("/healthz")
async def healthz():
    return PlainTextResponse("ok")

# 세션 저장소 (메모리) — {session_id: {"df": DataFrame, "metas": [...], "period_files": {...}}}
SESSIONS = {}
_SAMPLE_CACHE = {"records": None, "metas": None, "matched": None, "mtop": None, "am": None}
BASE = os.path.abspath(os.path.join(HERE, "..", ".."))


def period_from_name(name):
    """파일/폴더명에서 정산월 추정 (없으면 None)"""
    import re
    m = re.search(r"20(\d{2})[-_ .]?(\d{1,2})월?", name)
    if m:
        return f"20{m.group(1)}-{int(m.group(2)):02d}"
    m = re.search(r"(\d{2})년\s*(\d{1,2})월", name)
    if m:
        return f"20{m.group(1)}-{int(m.group(2)):02d}"
    return None


def rebuild(session_id, changed_keys=None):
    """별칭 등록/복원 후 재매칭. changed_keys 지정 시 해당 작품 행만 증분 재계산(성능)."""
    s = SESSIONS[session_id]
    recs = s["records"]
    if not s.get("mtop"):
        s["mtop"] = engine.build_master_top(recs)
    engine.match_records(recs, mtop=s["mtop"], only_keys=changed_keys)
    s["df"] = engine.build_dataframe(recs)


@app.post("/api/upload")
async def upload(files: list[UploadFile] = File(...), period: str = Form(None)):
    tmp = tempfile.mkdtemp(prefix="settle_")
    try:
        parsed_inputs = []
        for f in files:
            safe = os.path.basename(f.filename or "")  # 경로 탐색 차단 (../ 제거)
            if not safe:
                continue
            dst = os.path.join(tmp, safe)
            with open(dst, "wb") as out:
                shutil.copyfileobj(f.file, out)
            per = period or period_from_name(safe) or "미상"
            parsed_inputs.append((dst, per, safe))
        if not parsed_inputs:
            raise HTTPException(400, "업로드된 파일이 없습니다.")
        records, metas = engine.parse_uploads(parsed_inputs)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)  # 임시 파일 정리 (디스크 누수 차단)
    if not records:
        raise HTTPException(400, "표준화 가능한 데이터가 없습니다. 파일을 확인해 주세요.")
    mtop = engine.match_records(records)
    df = engine.build_dataframe(records)
    sid = uuid.uuid4().hex[:12]
    SESSIONS[sid] = {"records": records, "df": df, "metas": metas, "mtop": mtop}
    return {"session": sid, "summary": engine.summary(df, metas)}


SNAP_DIR = os.path.join(HERE, "data", "sample")


def _populate_sample_cache():
    """샘플 캐시 채우기 — 로컬은 원본 파싱, 배포는 번들 스냅샷 사용."""
    if _SAMPLE_CACHE["records"] is not None:
        return
    import unicodedata
    nfd = lambda p: unicodedata.normalize("NFD", p)
    sample = os.path.join(BASE, "정산서 샘플")
    orig = os.path.join(BASE, "02. 정산서 다운로드 원본")
    # 1~4월 다중소스: 1·4월=신규 완전판, 2·3월=원본+교보/모픽 backfill (에이블리는 원본에 있어 중복제외)
    dirs = [("2026-01", os.path.join(sample, "2026년 01월")),
            ("2026-02", os.path.join(orig, "26년 2월")),
            ("2026-03", os.path.join(orig, "26년 3월")),
            ("2026-04", os.path.join(sample, "2026년 04월"))]
    extra = [("2026-02", os.path.join(sample, "모픽_작품별_정산_202602.xlsx")),
             ("2026-02", os.path.join(sample, "교보문고 2월.xlsx")),
             ("2026-03", os.path.join(sample, "모픽_작품별_정산_202603.xlsx")),
             ("2026-03", os.path.join(sample, "교보문고 3월.xlsx"))]
    inputs = []
    for per, folder in dirs:
        d = nfd(folder)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if fn.startswith(".") or fn.startswith("._"):
                continue
            inputs.append((os.path.join(d, fn), per, fn))
    for per, f in extra:
        ff = nfd(f)
        if os.path.exists(ff):
            inputs.append((ff, per, os.path.basename(f)))
    if inputs:                                   # 로컬: 원본에서 파싱
        records, metas = engine.parse_uploads(inputs)
    elif os.path.exists(os.path.join(SNAP_DIR, "records.json.gz")):  # 배포: 번들 스냅샷
        import gzip
        with gzip.open(os.path.join(SNAP_DIR, "records.json.gz"), "rt", encoding="utf-8") as f:
            records = json.load(f)
        with open(os.path.join(SNAP_DIR, "metas.json"), encoding="utf-8") as f:
            metas = json.load(f)
    else:
        return
    _SAMPLE_CACHE["records"], _SAMPLE_CACHE["metas"] = records, metas


def _alias_mtime():
    try:
        return os.path.getmtime(engine.ALIAS_FILE)
    except Exception:
        return 0


@app.post("/api/load_sample")
async def load_sample():
    """데모용: 1~4월 데이터 로드. 매칭 결과를 캐시(별칭 변경 시만 재매칭)하고
    레코드는 평면 dict라 얕은 복사로 세션 격리 — deepcopy/전체 재매칭 비용 제거."""
    _populate_sample_cache()
    if _SAMPLE_CACHE["records"] is None:
        raise HTTPException(404, "샘플 데이터를 찾을 수 없습니다.")
    am = _alias_mtime()
    # 매칭본 캐시: 별칭이 바뀌었을 때만 1회 재매칭
    if _SAMPLE_CACHE.get("matched") is None or _SAMPLE_CACHE.get("am") != am:
        recs = [dict(r) for r in _SAMPLE_CACHE["records"]]
        mtop = engine.match_records(recs)
        _SAMPLE_CACHE["matched"], _SAMPLE_CACHE["mtop"], _SAMPLE_CACHE["am"] = recs, mtop, am
    records = [dict(r) for r in _SAMPLE_CACHE["matched"]]  # 평면 dict → 얕은 복사로 충분
    metas = _SAMPLE_CACHE["metas"]
    df = engine.build_dataframe(records)
    sid = uuid.uuid4().hex[:12]
    SESSIONS[sid] = {"records": records, "df": df, "metas": metas, "mtop": _SAMPLE_CACHE["mtop"]}
    return {"session": sid, "summary": engine.summary(df, metas)}


def get_df(session):
    s = SESSIONS.get(session)
    if not s:
        raise HTTPException(404, "세션이 만료되었습니다. 다시 업로드해 주세요.")
    return s


def scope(df, period=None, platform=None):
    if period:
        df = df[df["period"] == period]
    if platform and platform != "전체":
        df = df[df["platform"] == platform]
    return df


@app.get("/api/summary")
async def api_summary(session: str, period: str = None, platform: str = None, exclude_bundle: int = 1):
    s = get_df(session)
    df = scope(s["df"], period, platform)
    metas = s["metas"]
    if platform and platform != "전체":
        metas = [m for m in metas if m.get("platform") == platform]
    out = engine.summary(df, metas, exclude_bundle=bool(exclude_bundle))
    out["all_platforms"] = sorted(s["df"]["platform"].unique().tolist())  # 필터와 무관한 전체 목록
    return out


@app.get("/api/distributors")
async def api_dist(session: str, period: str = None):
    s = get_df(session)
    df = s["df"]
    if period:
        df = df[df["period"] == period]
    return engine.by_distributor(df)


@app.get("/api/authors")
async def api_authors(session: str, q: str = "", period: str = None, platform: str = None):
    s = get_df(session)
    return engine.by_author(scope(s["df"], period, platform), q)


@app.get("/api/author")
async def api_author(session: str, name: str, period: str = None, platform: str = None):
    s = get_df(session)
    df = scope(s["df"], None, platform)
    return engine.author_detail(df, name, period)


@app.get("/api/works")
async def api_works(session: str, q: str = "", period: str = None, platform: str = None):
    s = get_df(session)
    return engine.by_work(scope(s["df"], period, platform), q)


@app.get("/api/work")
async def api_work(session: str, title_norm: str, period: str = None, platform: str = None):
    s = get_df(session)
    return engine.work_detail(scope(s["df"], None, platform), title_norm, period)


@app.get("/api/verify")
async def api_verify(session: str):
    s = get_df(session)
    out = []
    for m in s["metas"]:
        if "error" in m:
            out.append({"file": m.get("file"), "period": m.get("period"),
                        "status": "오류", "detail": m["error"]})
            continue
        exp = m.get("expected_settle")
        if exp is None:
            st = "합계행 없음"
        else:
            st = "일치" if abs(m["settle_sum"] - exp) <= 1 else "불일치"
        out.append({"file": m["file"], "period": m["period"], "platform": m["platform"],
                    "account": m.get("account", ""), "real_type": m.get("real_type", ""),
                    "rows": m["rows"], "settle_sum": round(m["settle_sum"]),
                    "expected": None if exp is None else round(exp), "status": st})
    return out


@app.get("/api/search")
async def api_search(session: str, q: str = "", period: str = None, platform: str = None):
    s = get_df(session)
    return engine.search(scope(s["df"], period, platform), q)


@app.get("/api/stats")
async def api_stats(session: str, period: str = None, platform: str = None):
    s = get_df(session)
    return engine.stats(scope(s["df"], period, platform))


@app.get("/api/mismatch")
async def api_mismatch(session: str, exclude_bundle: int = 1):
    s = get_df(session)
    return engine.mismatch_queue(s["df"], exclude_bundle=bool(exclude_bundle))


@app.get("/api/suggestions")
async def api_suggestions(session: str, exclude_bundle: int = 1):
    s = get_df(session)
    return engine.suggest_matches(s["df"], exclude_bundle=bool(exclude_bundle))


@app.post("/api/suggestions/decide")
async def api_decide(session: str = Form(...), title_norm: str = Form(...), action: str = Form(...),
                     author: str = Form(""), label: str = Form(""), sample: str = Form(""),
                     confidence: float = Form(0), reason: str = Form(""), exclude_bundle: int = Form(1)):
    from datetime import datetime
    if action == "accept":
        engine.save_alias(title_norm, author, label, sample)
        rebuild(session, changed_keys={title_norm})
    engine.log_decision({
        "ts": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "action": action, "title_norm": title_norm, "sample": sample,
        "author": author, "label": label, "confidence": confidence,
        "reason": reason, "by": "담당자",
    })
    s = get_df(session)
    eb = bool(exclude_bundle)
    return {"ok": True, "remaining_suggestions": len(engine.suggest_matches(s["df"], exclude_bundle=eb)),
            "summary": engine.summary(s["df"], s["metas"], exclude_bundle=eb)}


@app.get("/api/decisions")
async def api_decisions(session: str = None):
    return engine.read_decisions()


@app.get("/api/enrich_aladin")
async def api_enrich_aladin(session: str, limit: int = 40, exclude_bundle: int = 1):
    s = get_df(session)
    return engine.aladin_enrich(s["df"], limit=limit, exclude_bundle=bool(exclude_bundle))


@app.post("/api/mismatch/register")
async def api_register(session: str = Form(...), title_norm: str = Form(...),
                       author: str = Form(""), label: str = Form(""), sample: str = Form(""),
                       exclude_bundle: int = Form(1)):
    from datetime import datetime
    engine.save_alias(title_norm, author, label, sample)
    rebuild(session, changed_keys={title_norm})
    engine.log_decision({"ts": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "action": "manual",
                         "title_norm": title_norm, "sample": sample, "author": author,
                         "label": label, "confidence": None, "reason": "수동 등록", "by": "담당자"})
    s = get_df(session)
    eb = bool(exclude_bundle)
    return {"ok": True, "summary": engine.summary(s["df"], s["metas"], exclude_bundle=eb),
            "remaining": len(engine.mismatch_queue(s["df"], exclude_bundle=eb))}


@app.post("/api/suggestions/decide_bulk")
async def api_decide_bulk(session: str = Form(...), items: str = Form(...),
                          action: str = Form("accept"), exclude_bundle: int = Form(1)):
    """일괄 승인/거절 — items: [{title_norm, author, label, sample, confidence, reason}, ...]"""
    from datetime import datetime
    s = get_df(session)
    lst = json.loads(items)
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cnt = 0
    changed = set()
    for it in lst:
        tn = (it or {}).get("title_norm")
        if not tn:
            continue
        if action == "accept":
            engine.save_alias(tn, it.get("author", ""), it.get("label", ""), it.get("sample", ""))
        changed.add(tn)
        engine.log_decision({"ts": ts, "action": action, "title_norm": tn, "sample": it.get("sample", ""),
                             "author": it.get("author", ""), "label": it.get("label", ""),
                             "confidence": it.get("confidence"), "reason": it.get("reason", ""),
                             "by": "담당자", "bulk": True})
        cnt += 1
    if action == "accept" and cnt:
        rebuild(session, changed_keys=changed)
    eb = bool(exclude_bundle)
    return {"ok": True, "count": cnt,
            "remaining_suggestions": len(engine.suggest_matches(s["df"], exclude_bundle=eb)),
            "remaining": len(engine.mismatch_queue(s["df"], exclude_bundle=eb)),
            "summary": engine.summary(s["df"], s["metas"], exclude_bundle=eb)}


@app.post("/api/decisions/restore")
async def api_restore(session: str = Form(...), title_norm: str = Form(...),
                      reason: str = Form(""), sample: str = Form(""), exclude_bundle: int = Form(1)):
    """결정 복원(되돌리기) — 등록된 별칭 제거 + 거절 취소, 등록 전 매칭 상태로 환원."""
    from datetime import datetime
    engine.remove_alias(title_norm)
    rebuild(session, changed_keys={title_norm})
    engine.log_decision({"ts": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "action": "restore",
                         "title_norm": title_norm, "sample": sample, "author": "", "label": "",
                         "confidence": None, "reason": reason or "복원", "by": "담당자"})
    s = get_df(session)
    eb = bool(exclude_bundle)
    return {"ok": True, "summary": engine.summary(s["df"], s["metas"], exclude_bundle=eb),
            "remaining": len(engine.mismatch_queue(s["df"], exclude_bundle=eb)),
            "remaining_suggestions": len(engine.suggest_matches(s["df"], exclude_bundle=eb))}


@app.post("/api/decisions/restore_bulk")
async def api_restore_bulk(session: str = Form(...), items: str = Form(...),
                           reason: str = Form(""), exclude_bundle: int = Form(1)):
    """일괄 복원 — items: [{title_norm, sample}, ...]"""
    from datetime import datetime
    s = get_df(session)
    lst = json.loads(items)
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cnt = 0
    changed = set()
    for it in lst:
        tn = (it or {}).get("title_norm")
        if not tn:
            continue
        engine.remove_alias(tn)
        changed.add(tn)
        engine.log_decision({"ts": ts, "action": "restore", "title_norm": tn,
                             "sample": it.get("sample", ""), "author": "", "label": "",
                             "confidence": None, "reason": reason or "복원", "by": "담당자"})
        cnt += 1
    if cnt:
        rebuild(session, changed_keys=changed)
    eb = bool(exclude_bundle)
    return {"ok": True, "count": cnt, "summary": engine.summary(s["df"], s["metas"], exclude_bundle=eb),
            "remaining": len(engine.mismatch_queue(s["df"], exclude_bundle=eb))}


@app.post("/api/flag")
async def api_flag(session: str = Form(...), kind: str = Form(...), key: str = Form(""),
                   sample: str = Form(""), category: str = Form("기타"),
                   note: str = Form(""), value: str = Form("")):
    """결과값 신고 — 연구소(Lab)에 적재. kind=작품별/작가별/미매칭/유통사별 등"""
    from datetime import datetime
    e = engine.add_flag({"ts": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "source": "신고",
                         "kind": kind, "key": key, "sample": sample, "category": category,
                         "note": note, "value": value, "by": "담당자"})
    return {"ok": True, "id": e["id"]}


@app.get("/api/flags")
async def api_flags(session: str = None):
    return engine.read_flags()


@app.post("/api/flags/update")
async def api_flags_update(session: str = Form(...), id: str = Form(...),
                           status: str = Form(None), diagnosis: str = Form(None)):
    ok = engine.update_flag(id, status=status, diagnosis=diagnosis)
    return {"ok": ok}


@app.get("/api/lab/suspects")
async def api_lab_suspects(session: str, detector: str = "homonym", limit: int = 200):
    """자동 탐지기 — detector=homonym(동명이작 E1)"""
    s = get_df(session)
    if detector == "homonym":
        return {"detector": "homonym", "items": engine.detect_homonyms(s["df"], limit=limit)}
    return {"detector": detector, "items": []}


@app.get("/api/lab/origin")
async def api_lab_origin(session: str, title_norm: str):
    """표준화 이전 원본 내역 (판단 근거) — 플랫폼·원본제목·원천 작가/레이블·엑셀파일·정산액"""
    s = get_df(session)
    return engine.origin_detail(s["df"], title_norm)


@app.post("/api/flags/update_bulk")
async def api_flags_update_bulk(session: str = Form(...), ids: str = Form(...), status: str = Form(...)):
    """신고함 일괄 상태 변경 (선택/전체 반영)"""
    cnt = 0
    for fid in json.loads(ids):
        if engine.update_flag(fid, status=status):
            cnt += 1
    return {"ok": True, "count": cnt}


@app.get("/api/export")
async def api_export(session: str):
    s = get_df(session)
    df = s["df"]
    buf = io.BytesIO()
    cols = ["period", "platform", "account", "title_raw", "title_resolved", "author_resolved",
            "label_resolved", "book_type", "gross", "settle", "gross_basis", "settle_basis",
            "author_src", "label_src", "match_status", "source_file", "source_row"]
    rename = {"period": "정산월", "platform": "유통사", "account": "계정", "title_raw": "작품명(원문)",
              "title_resolved": "시리즈명", "author_resolved": "작가", "label_resolved": "레이블",
              "book_type": "구분", "gross": "총매출", "settle": "정산액", "gross_basis": "총매출근거",
              "settle_basis": "정산액근거", "author_src": "작가출처", "label_src": "레이블출처",
              "match_status": "매칭상태", "source_file": "원본파일", "source_row": "원본행"}
    detail = df[[c for c in cols if c in df.columns]].rename(columns=rename)
    author_df = pd.DataFrame(engine.by_author(df, limit=100000)).rename(
        columns={"author": "작가", "settle": "정산액", "gross": "총매출", "works": "작품수", "platforms": "유통사수"})
    dist_df = pd.DataFrame(engine.by_distributor(df)).rename(
        columns={"platform": "유통사", "records": "레코드", "gross": "총매출", "settle": "정산액", "authors": "작가수"})
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        author_df.to_excel(w, "작가별 정산", index=False)
        dist_df.to_excel(w, "유통사별 정산", index=False)
        detail.to_excel(w, "통합레코드", index=False)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=settlement_export.xlsx"})


def _author_mask(df, name):
    if "author_norm" in df.columns and (df["author_norm"] == name).any():
        return df["author_norm"] == name
    return df["author_resolved"] == name


@app.get("/api/author_export")
async def api_author_export(session: str, name: str, period: str = None, platform: str = None):
    s = get_df(session)
    df = scope(s["df"], None, platform)
    sub = df[_author_mask(df, name)]
    if period:
        sub = sub[sub["period"] == period]
    if sub.empty:
        raise HTTPException(404, "해당 작가 내역이 없습니다.")
    detail = engine.author_detail(df, name, period)
    name = detail.get("author", name)  # 파일명용 정식 표기
    # 시트1: 작품·유통사·월별 근거 요약
    bd = pd.DataFrame(detail["breakdown"]).rename(columns={
        "period": "정산월", "title": "작품(시리즈)", "platform": "유통사", "label": "레이블",
        "book_type": "구분", "gross": "총매출", "settle": "정산액", "basis": "정산액 근거", "lines": "원본행수"})
    # 시트2: 원본 레코드 전체 (추적용)
    cols = ["period", "platform", "account", "title_raw", "title_resolved", "label_resolved",
            "book_type", "gross", "settle", "gross_basis", "settle_basis", "source_file", "source_row"]
    rename = {"period": "정산월", "platform": "유통사", "account": "계정", "title_raw": "작품명(원문)",
              "title_resolved": "시리즈명", "label_resolved": "레이블", "book_type": "구분",
              "gross": "총매출", "settle": "정산액", "gross_basis": "총매출근거", "settle_basis": "정산액근거",
              "source_file": "원본파일", "source_row": "원본행"}
    raw = sub[[c for c in cols if c in sub.columns]].rename(columns=rename).sort_values(["정산월", "유통사"])
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        bd.to_excel(w, "작품·유통사별 근거", index=False)
        raw.to_excel(w, "원본 레코드", index=False)
    buf.seek(0)
    from urllib.parse import quote
    suffix = f"_{period}" if period else ""
    fn = f"정산_{name}{suffix}.xlsx"
    cd = f"attachment; filename=settlement{suffix}.xlsx; filename*=UTF-8''{quote(fn)}"
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": cd})


@app.get("/api/statement")
async def api_statement(session: str, name: str, period: str = None, platform: str = None, rate: float = 100.0):
    """작가별 정산 명세서 (인쇄/PDF 저장용 HTML). rate=작가 계약 정산요율(%)."""
    import html as H
    from datetime import datetime
    s = get_df(session)
    df = scope(s["df"], None, platform)
    sub = df[_author_mask(df, name)]
    if period:
        sub = sub[sub["period"] == period]
    if sub.empty:
        raise HTTPException(404, "해당 작가 내역이 없습니다.")
    name = engine._canon_author(sub["author_resolved"])  # 정식 표기
    rows = (sub.groupby(["title_resolved", "platform", "book_type"], as_index=False)
            .agg(gross=("gross", "sum"), settle=("settle", "sum"))
            .sort_values("settle", ascending=False))
    periods = sorted(set(sub["period"]))
    label = (lambda lv: lv.mode().iloc[0] if not lv.empty else "")(
        sub[sub["label_resolved"] != ""]["label_resolved"])

    def w(v):
        return f"{round(v or 0):,}"
    settle_total = float(sub["settle"].sum())
    gross_total = float(sub["gross"].sum())
    author_amt = round(settle_total * rate / 100)
    wht = round(author_amt * 0.033)          # 원천징수 3.3% (사업소득)
    payout = author_amt - wht
    today = datetime.now().strftime("%Y년 %m월 %d일")
    prange = (f"{periods[0]} ~ {periods[-1]}" if len(periods) > 1 else (periods[0] if periods else "-"))

    tr = "\n".join(
        f"<tr><td>{H.escape(str(r['title_resolved']))}</td><td>{H.escape(str(r['platform']))}</td>"
        f"<td class='c'>{H.escape(str(r['book_type'] or '-'))}</td>"
        f"<td class='r'>{w(r['gross'])}</td><td class='r'>{w(r['settle'])}</td></tr>"
        for _, r in rows.iterrows())

    html = f"""<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>정산 명세서 · {H.escape(name)}</title>
<style>
@page{{size:A4;margin:18mm}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Pretendard','Malgun Gothic',sans-serif;color:#1a1d24;font-size:12px;line-height:1.6;padding:24px;max-width:780px;margin:0 auto}}
.bar{{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #1a1d24;padding-bottom:12px;margin-bottom:6px}}
h1{{font-size:24px;font-weight:800;letter-spacing:8px}}
.bar .meta{{text-align:right;font-size:11px;color:#555}}
.parties{{display:flex;gap:24px;margin:18px 0}}
.parties .box{{flex:1;border:1px solid #e0e3e9;border-radius:8px;padding:12px 14px}}
.parties .k{{font-size:10px;color:#8a909a;font-weight:700;letter-spacing:1px}}
.parties .v{{font-size:14px;font-weight:700;margin-top:2px}}
.parties .s{{font-size:11px;color:#6b727e;margin-top:3px}}
table{{width:100%;border-collapse:collapse;margin:8px 0 0;font-size:11.5px}}
th{{background:#1a1d24;color:#fff;padding:8px 10px;text-align:left;font-weight:700}}
th.r,td.r{{text-align:right;font-variant-numeric:tabular-nums}} th.c,td.c{{text-align:center}}
td{{padding:7px 10px;border-bottom:1px solid #e8ebf0}}
tbody tr:nth-child(even){{background:#fafbfc}}
tfoot td{{border-top:2px solid #1a1d24;font-weight:800;background:#f2f4f7}}
.calc{{margin-top:18px;margin-left:auto;width:300px;font-size:12px}}
.calc .row{{display:flex;justify-content:space-between;padding:6px 2px;border-bottom:1px solid #eef1f5}}
.calc .row.tot{{border-top:2px solid #1a1d24;border-bottom:none;font-weight:800;font-size:15px;padding-top:10px;margin-top:2px}}
.calc .row.tot .v{{color:#1f4fd0}}
.note{{margin-top:24px;font-size:10.5px;color:#6b727e;border-top:1px solid #e0e3e9;padding-top:12px;line-height:1.8}}
.rate{{color:#1f4fd0;font-weight:700}}
.actions{{text-align:center;margin:0 0 18px}}
.actions button{{background:#2f6bff;color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}}
@media print{{.actions{{display:none}}body{{padding:0}}}}
</style></head><body>
<div class="actions"><button onclick="window.print()">인쇄 / PDF 저장</button></div>
<div class="bar"><h1>정 산 명 세 서</h1>
  <div class="meta">발행일 {today}<br>정산 기간 {prange}{('<br>대상 유통사 ' + H.escape(platform)) if platform else ''}</div></div>
<div class="parties">
  <div class="box"><div class="k">발행처 (공급자)</div><div class="v">주식회사 스토린랩</div>
    <div class="s">{('레이블 '+H.escape(label)) if label else '콘텐츠 공급사'}</div></div>
  <div class="box"><div class="k">수신 (저작권자)</div><div class="v">{H.escape(name)} 귀하</div>
    <div class="s">작품 {sub['title_norm'].nunique()}편 · 유통사 {sub['platform'].nunique()}곳</div></div>
</div>
<table>
  <thead><tr><th>작품명</th><th>판매처(유통사)</th><th class="c">구분</th><th class="r">판매금액(원)</th><th class="r">정산액(원)</th></tr></thead>
  <tbody>{tr}</tbody>
  <tfoot><tr><td colspan="3">합계</td><td class="r">{w(gross_total)}</td><td class="r">{w(settle_total)}</td></tr></tfoot>
</table>
<div class="calc">
  <div class="row"><span>정산 대상액 (유통사 정산액)</span><span class="v">{w(settle_total)}원</span></div>
  <div class="row"><span>작가 정산요율</span><span class="v rate">{rate:g}%</span></div>
  <div class="row"><span>작가 정산액</span><span class="v">{w(author_amt)}원</span></div>
  <div class="row"><span>원천징수 (3.3%)</span><span class="v">− {w(wht)}원</span></div>
  <div class="row tot"><span>실지급액</span><span class="v">{w(payout)}원</span></div>
</div>
<div class="note">
  · 본 명세서는 유통사가 출판사로 지급한 <b>정산액</b>을 기준으로 작성되었으며, 작가 정산액은 계약 정산요율(현재 <span class="rate">{rate:g}%</span>)을 적용한 금액입니다. 실제 지급액은 개별 계약 조건에 따라 조정될 수 있습니다.<br>
  · 원천징수세액은 사업소득 3.3% 기준 추정치이며, 부가세·기타 공제 항목은 반영되지 않았습니다.<br>
  · 금액은 유통사 원본 정산서를 표준화·합산한 값으로, 원본 대사 검증을 거쳤습니다.
</div>
</body></html>"""
    return HTMLResponse(html)


@app.get("/")
async def index():
    return FileResponse(os.path.join(HERE, "static", "index.html"))


app.mount("/", StaticFiles(directory=os.path.join(HERE, "static")), name="static")

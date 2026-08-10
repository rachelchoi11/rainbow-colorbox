# -*- coding: utf-8 -*-
"""정산 표준화 엔진 — 기존 파이프라인을 재사용 가능한 함수로 래핑
업로드 파일 → 표준화 레코드 → 작품마스터 매칭 → 집계
"""
import os, sys, json, re, unicodedata
from collections import Counter, defaultdict

# 번들/구독 상품 = 개별 작품이 아니므로 작품 대조 대상에서 제외 (채널 정기권 등)
# 키워드 남발 금지: '삼국지 싸이코패스', '패스 마스터' 같은 실제 작품 오탐 방지 위해 채널 패스 패턴만 정밀 지정
BUNDLE_RE = re.compile(r"(원스토리\s*패스|북패스|우주패스)")


def is_bundle(title):
    return bool(BUNDLE_RE.search(str(title or "")))

PIPE = os.path.join(os.path.dirname(__file__), "..", "pipeline")
sys.path.insert(0, os.path.abspath(PIPE))
import pandas as pd
from normalize import norm_title, strip_tags_keep_title, norm_author
from run import parse_file, nfc

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SEED_FILE = os.path.join(BASE, "docs", "'22년 12월 매출 정리_jhs_20221227.xlsx")
ALIAS_FILE = os.path.join(os.path.dirname(__file__), "data", "aliases.json")

_seed_cache = None


# ── 사용자 등록 별칭 (미매칭 보드에서 추가) ─────────────────────
def load_aliases():
    if os.path.exists(ALIAS_FILE):
        return json.load(open(ALIAS_FILE, encoding="utf-8"))
    return {}


def save_alias(title_norm, author, label, sample_title=""):
    os.makedirs(os.path.dirname(ALIAS_FILE), exist_ok=True)
    al = load_aliases()
    al[title_norm] = {"author": author or "", "label": label or "", "sample": sample_title}
    json.dump(al, open(ALIAS_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return al


def remove_alias(title_norm):
    """별칭 삭제 — 복원(되돌리기) 시 사용. 등록 전 상태로 매칭 환원."""
    al = load_aliases()
    if title_norm in al:
        del al[title_norm]
        json.dump(al, open(ALIAS_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        return True
    return False


# ── 22년 수작업 시드 (콘텐츠명→작가·브랜드), 1회 로드 캐시 ──────
SEED_SNAPSHOT = os.path.join(os.path.dirname(__file__), "data", "sample", "seed.json")


def load_seed():
    global _seed_cache
    if _seed_cache is not None:
        return _seed_cache
    # 배포 환경: 원본 xlsx가 없으면 번들 시드(seed.json) 사용
    if not (os.path.exists(SEED_FILE) or os.path.exists(unicodedata.normalize("NFD", SEED_FILE))) \
       and os.path.exists(SEED_SNAPSHOT):
        _seed_cache = json.load(open(SEED_SNAPSHOT, encoding="utf-8"))
        return _seed_cache
    seed = {}
    if os.path.exists(unicodedata.normalize("NFD", SEED_FILE)) or os.path.exists(SEED_FILE):
        path = SEED_FILE if os.path.exists(SEED_FILE) else unicodedata.normalize("NFD", SEED_FILE)
        s22 = pd.read_excel(path)
        for _, r in s22.iterrows():
            for src in (r.get("콘텐츠명"), r.get("시리즈명")):
                k = norm_title(src)
                if not k or k in seed:
                    continue
                author = str(r.get("작가명") or "").strip()
                label = str(r.get("브랜드명") or "").strip()
                if label in ("#N/A", "0", "nan", "None"):
                    label = ""
                if author in ("#N/A", "nan", "None"):
                    author = ""
                seed[k] = {"series": str(r.get("시리즈명") or "").strip(),
                           "author": author, "label": label}
    _seed_cache = seed
    return seed


# ── 파싱 ────────────────────────────────────────────────────
def parse_uploads(files):
    """files: [(filepath, period, original_name)] → (records, metas)"""
    all_recs, metas = [], []
    for path, period, name in files:
        try:
            recs, meta = parse_file(path, period, name)
        except Exception as e:
            recs, meta = None, {"file": nfc(name), "period": period, "error": repr(e)[:160]}
        metas.append(meta)
        if recs:
            all_recs.extend(recs)
    for r in all_recs:
        r["title_series"] = strip_tags_keep_title(r["title_raw"])
        r["title_norm"] = norm_title(r["title_raw"])
    return all_recs, metas


# ── 매칭 (자체 마스터 → 22년 시드 → 사용자 별칭) ─────────────
def build_master_top(records):
    """작품(title_norm)당 대표 작가·레이블·제목을 1회 계산해 캐시.
    원천 데이터(정산서에 적힌 값) 기반이라 별칭 등록/복원과 무관 → 세션 캐시 가능(증분 재매칭용)."""
    master = defaultdict(lambda: {"authors": Counter(), "labels": Counter(), "titles": Counter()})
    for r in records:
        k = r["title_norm"]
        if not k:
            continue
        m = master[k]
        m["titles"][r["title_series"]] += 1
        if r["author"]:
            m["authors"][r["author"]] += 1
        if r["label"]:
            m["labels"][r["label"]] += 1
    def top(c):
        return c.most_common(1)[0][0] if c else ""
    return {k: {"a": top(m["authors"]), "l": top(m["labels"]), "t": top(m["titles"]),
                "ha": bool(m["authors"]), "hl": bool(m["labels"])} for k, m in master.items()}


def match_records(records, mtop=None, only_keys=None):
    """매칭 (자체 마스터 → 22년 시드 → 사용자 별칭).
    mtop: build_master_top 캐시(없으면 생성). only_keys: 지정 시 해당 title_norm 행만 재계산(증분)."""
    seed = load_seed()
    aliases = load_aliases()
    if mtop is None:
        mtop = build_master_top(records)

    for r in records:
        k = r["title_norm"]
        if only_keys is not None and k not in only_keys:
            continue
        mt = mtop.get(k)
        al = aliases.get(k, {})
        sd = seed.get(k, {})
        m_a = mt["a"] if mt else ""
        m_l = mt["l"] if mt else ""
        # 작가: 원천 → 당월 자체 → 사용자 별칭 → 22년 시드
        author = r["author"] or m_a or al.get("author", "") or sd.get("author", "")
        label = r["label"] or m_l or al.get("label", "") or sd.get("label", "")
        if r["author"]:
            asrc = "원천제공"
        elif mt and mt["ha"]:
            asrc = "당월대조"
        elif al.get("author"):
            asrc = "사용자등록"
        elif sd.get("author"):
            asrc = "과거자산"
        else:
            asrc = ""
        if r["label"]:
            lsrc = "원천제공"
        elif mt and mt["hl"]:
            lsrc = "당월대조"
        elif al.get("label"):
            lsrc = "사용자등록"
        elif sd.get("label"):
            lsrc = "과거자산"
        else:
            lsrc = ""
        r["title_resolved"] = (mt["t"] if mt else "") or sd.get("series", "") or r["title_series"]
        r["author_resolved"] = author
        r["label_resolved"] = label
        r["author_src"] = asrc
        r["label_src"] = lsrc
        r["match_status"] = ("완전" if author and label else
                             ("작가만" if author else ("레이블만" if label else "미매칭")))
        # 번들/구독 상품 여부는 별도 플래그로만 표시 (제외/비제외 토글에서 사용)
        r["is_bundle"] = is_bundle(r["title_raw"])
        r["author_norm"] = norm_author(author)   # 작가명 정규화 키 ([정천]=정천 등)
    return mtop


def build_dataframe(records):
    df = pd.DataFrame(records)
    if df.empty:
        return df
    for c in ("gross", "settle"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


# ── 집계 (API 응답용) ───────────────────────────────────────
def n(v):
    return 0 if (v is None or pd.isna(v)) else float(v)


def summary(df, metas, exclude_bundle=True):
    periods = sorted(df["period"].unique().tolist())
    total_settle = n(df["settle"].sum())
    total_gross = n(df["gross"].sum())
    by_status = df["match_status"].value_counts().to_dict()
    is_b = df["is_bundle"] if "is_bundle" in df.columns else (df["settle"] != df["settle"])
    mm_mask = (df["match_status"] == "미매칭")
    bundle_mm = mm_mask & is_b                      # 미매칭이면서 번들인 것
    if exclude_bundle:
        mm_mask = mm_mask & (~is_b)                 # 번들 제외
    mismatch_rows = int(mm_mask.sum())
    mismatch_settle = n(df[mm_mask]["settle"].sum())
    bundle_rows = int(bundle_mm.sum())
    bundle_settle = n(df[bundle_mm]["settle"].sum())
    full = int((df["match_status"] == "완전").sum())
    # 월별 추이
    trend = []
    for p in periods:
        sub = df[df["period"] == p]
        trend.append({"period": p, "settle": round(n(sub["settle"].sum())),
                      "gross": round(n(sub["gross"].sum())),
                      "authors": int(sub[sub["author_norm"] != ""]["author_norm"].nunique()),
                      "records": int(len(sub))})
    # 단행본/연재 구성 (정산액 기준)
    bt = df.groupby("book_type")["settle"].sum()
    book_split = []
    for key, lab in [("단행본", "단행본"), ("연재", "연재"), ("구분불가(구독제)", "구독제")]:
        v = n(bt.get(key, 0))
        if v:
            book_split.append({"key": lab, "settle": round(v),
                               "pct": round(v / total_settle * 100, 1) if total_settle else 0})
    etc = n(total_settle) - sum(b["settle"] for b in book_split)
    if etc > 1:
        book_split.append({"key": "기타", "settle": round(etc),
                           "pct": round(etc / total_settle * 100, 1) if total_settle else 0})
    # 검증
    ok = [m for m in metas if "error" not in m]
    verified = sum(1 for m in ok if m.get("expected_settle") is not None
                   and abs(m["settle_sum"] - m["expected_settle"]) <= 1)
    has_expected = sum(1 for m in ok if m.get("expected_settle") is not None)
    return {
        "periods": periods,
        "total_settle": round(total_settle),
        "total_gross": round(total_gross),
        "records": int(len(df)),
        "authors": int(df[df["author_norm"] != ""]["author_norm"].nunique()),
        "series": int(df["title_norm"].nunique()),
        "distributors": int(df["platform"].nunique()),
        "files": len(metas),
        "match_full": full,
        "match_full_pct": round(full / len(df) * 100, 1) if len(df) else 0,
        "mismatch": mismatch_rows,
        "mismatch_pct": round(mismatch_rows / len(df) * 100, 2) if len(df) else 0,
        "mismatch_settle": round(mismatch_settle),
        "mismatch_settle_pct": round(mismatch_settle / total_settle * 100, 2) if total_settle else 0,
        "bundle": bundle_rows,
        "bundle_settle": round(bundle_settle),
        "by_status": by_status,
        "trend": trend,
        "book_split": book_split,
        "all_platforms": sorted(df["platform"].unique().tolist()),
        "verify_pass": verified,
        "verify_total": has_expected,
    }


def by_distributor(df):
    g = (df.groupby("platform", as_index=False)
         .agg(records=("settle", "size"), gross=("gross", "sum"), settle=("settle", "sum"),
              authors=("author_norm", lambda s: s[s != ""].nunique()))
         .sort_values("settle", ascending=False))
    out = []
    for _, r in g.iterrows():
        out.append({"platform": r["platform"], "records": int(r["records"]),
                    "gross": round(n(r["gross"])), "settle": round(n(r["settle"])),
                    "authors": int(r["authors"])})
    return out


def _canon_author(series):
    """그룹 내 대표 표기 선택 — 가장 빈번한 원본, 동률이면 대괄호 없는 깔끔한 표기 우선"""
    vc = series.value_counts()
    if vc.empty:
        return ""
    top = vc[vc == vc.max()].index.tolist()
    top.sort(key=lambda s: ("[" in s or "]" in s, len(s)))  # 대괄호 없는·짧은 것 우선
    return top[0]


def by_author(df, q="", limit=500):
    sub = df[df["author_norm"] != ""]
    if q:
        sub = sub[sub["author_resolved"].str.contains(q, case=False, na=False) |
                  sub["author_norm"].str.contains(norm_author(q), na=False)]
    g = (sub.groupby("author_norm", as_index=False)
         .agg(settle=("settle", "sum"), gross=("gross", "sum"),
              works=("title_norm", "nunique"), platforms=("platform", "nunique"),
              display=("author_resolved", _canon_author),
              variants=("author_resolved", lambda s: sorted(set(s))))
         .sort_values("settle", ascending=False).head(limit))
    out = []
    for _, r in g.iterrows():
        out.append({"author": r["display"], "author_key": r["author_norm"],
                    "settle": round(n(r["settle"])), "gross": round(n(r["gross"])),
                    "works": int(r["works"]), "platforms": int(r["platforms"]),
                    "variants": [v for v in r["variants"] if v != r["display"]]})
    return out


def by_work(df, q="", limit=500):
    sub = df[df["title_norm"] != ""]
    if q:
        sub = sub[sub["title_resolved"].str.contains(q, case=False, na=False) |
                  sub["title_raw"].str.contains(q, case=False, na=False)]
    out = []
    for key, g in sub.groupby("title_norm"):
        authors = sorted(set(a for a in g["author_resolved"] if a))
        labels = sorted(set(l for l in g["label_resolved"] if l))
        bt = g["book_type"].mode()
        out.append({
            "title_norm": key,
            "title": str(g["title_resolved"].mode().iloc[0]) if not g["title_resolved"].mode().empty else key,
            "author": ", ".join(authors) if authors else "",
            "label": ", ".join(labels) if labels else "",
            "book_type": bt.iloc[0] if not bt.empty else "",
            "settle": round(n(g["settle"].sum())), "gross": round(n(g["gross"].sum())),
            "platforms": int(g["platform"].nunique()),
            "matched": bool(authors),
        })
    out.sort(key=lambda x: x["settle"], reverse=True)
    return out[:limit]


def work_detail(df, title_norm, period=None):
    sub = df[df["title_norm"] == title_norm]
    if period:
        sub = sub[sub["period"] == period]
    rows = (sub.groupby(["period", "platform", "settle_basis"], as_index=False)
            .agg(settle=("settle", "sum"), gross=("gross", "sum"),
                 book_type=("book_type", "first"), lines=("settle", "size"))
            .sort_values("settle", ascending=False))
    breakdown = [{"period": r["period"], "platform": r["platform"], "book_type": r["book_type"],
                  "gross": round(n(r["gross"])), "settle": round(n(r["settle"])),
                  "basis": r["settle_basis"], "lines": int(r["lines"])} for _, r in rows.iterrows()]
    authors = sorted(set(a for a in sub["author_resolved"] if a))
    labels = sorted(set(l for l in sub["label_resolved"] if l))
    variants = sorted(set(str(t) for t in sub["title_raw"]))[:10]
    by_plat = (sub.groupby("platform", as_index=False).agg(settle=("settle", "sum"))
               .sort_values("settle", ascending=False))
    plat_sum = [{"platform": r["platform"], "settle": round(n(r["settle"]))} for _, r in by_plat.iterrows()]
    # 세부: 권/회차(원문 표기)별 내역
    vol = (sub.groupby("title_raw", as_index=False)
           .agg(settle=("settle", "sum"), gross=("gross", "sum"), lines=("settle", "size"),
                platforms=("platform", "nunique"))
           .sort_values("settle", ascending=False))
    volumes = [{"title": r["title_raw"], "settle": round(n(r["settle"])), "gross": round(n(r["gross"])),
                "lines": int(r["lines"]), "platforms": int(r["platforms"])} for _, r in vol.iterrows()]
    return {
        "title_norm": title_norm,
        "title": str(sub["title_resolved"].mode().iloc[0]) if not sub["title_resolved"].mode().empty else title_norm,
        "authors": authors, "labels": labels, "variants": variants,
        "volumes": volumes, "volume_count": len(volumes),
        "total_settle": round(n(sub["settle"].sum())), "total_gross": round(n(sub["gross"].sum())),
        "platforms": int(sub["platform"].nunique()),
        "plat_sum": plat_sum, "breakdown": breakdown, "selected_period": period,
    }


def author_detail(df, author, period=None):
    # author는 정규화 키(author_key) 우선, 호환을 위해 원본명도 허용
    if "author_norm" in df.columns and (df["author_norm"] == author).any():
        sub = df[df["author_norm"] == author]
    else:
        sub = df[df["author_resolved"] == author]
    if period:
        sub = sub[sub["period"] == period]
    # 작품 × 유통사 × 정산월 단위 근거 (월 분리)
    rows = (sub.groupby(["period", "title_resolved", "platform", "settle_basis"], as_index=False)
            .agg(settle=("settle", "sum"), gross=("gross", "sum"),
                 label=("label_resolved", "first"), book_type=("book_type", "first"),
                 lines=("settle", "size"))
            .sort_values(["settle"], ascending=False))
    breakdown = []
    for _, r in rows.iterrows():
        breakdown.append({
            "period": r["period"],
            "title": r["title_resolved"], "platform": r["platform"],
            "label": r["label"], "book_type": r["book_type"],
            "gross": round(n(r["gross"])), "settle": round(n(r["settle"])),
            "basis": r["settle_basis"], "lines": int(r["lines"]),
        })
    # 유통사별 소계
    by_plat = (sub.groupby("platform", as_index=False).agg(settle=("settle", "sum"))
               .sort_values("settle", ascending=False))
    plat_sum = [{"platform": r["platform"], "settle": round(n(r["settle"]))}
                for _, r in by_plat.iterrows()]
    display = _canon_author(sub["author_resolved"]) if "author_resolved" in sub.columns else author
    variants = sorted(set(a for a in sub["author_resolved"] if a and a != display))
    return {
        "author": display, "author_key": author,
        "variants": variants,
        "total_settle": round(n(sub["settle"].sum())),
        "total_gross": round(n(sub["gross"].sum())),
        "works": int(sub["title_norm"].nunique()),
        "platforms": int(sub["platform"].nunique()),
        "label": (lambda lv: lv.mode().iloc[0] if not lv.empty else "")(
                 sub[sub["label_resolved"] != ""]["label_resolved"]),
        "plat_sum": plat_sum,
        "breakdown": breakdown,
        "selected_period": period,
    }


def stats(df):
    """통계 대시보드용 집계 — pbix 의도(유통사·레이블·작품·장르) + 확장(폭포·파레토·히트맵)"""
    total = n(df["settle"].sum())

    def topn(col, k=10, label=None):
        g = (df[df[col] != ""].groupby(col, as_index=False)
             .agg(settle=("settle", "sum"), gross=("gross", "sum"))
             .sort_values("settle", ascending=False))
        rows = [{"name": r[col], "settle": round(n(r["settle"])), "gross": round(n(r["gross"])),
                 "pct": round(n(r["settle"]) / total * 100, 1) if total else 0}
                for _, r in g.head(k).iterrows()]
        etc = n(g["settle"].iloc[k:].sum()) if len(g) > k else 0
        return {"rows": rows, "etc": round(etc), "count": int(len(g))}

    # 유통사별 (전체 — 도넛)
    dist = (df.groupby("platform", as_index=False).agg(settle=("settle", "sum"))
            .sort_values("settle", ascending=False))
    dist_rows = [{"name": r["platform"], "settle": round(n(r["settle"])),
                  "pct": round(n(r["settle"]) / total * 100, 1) if total else 0}
                 for _, r in dist.iterrows()]

    # 매출→정산액 폭포 (전체)
    waterfall = {"gross": round(n(df["gross"].sum())), "settle": round(total),
                 "gap": round(n(df["gross"].sum()) - total)}

    # 작가 정산 집중도 (파레토)
    au = (df[df["author_norm"] != ""].groupby("author_norm")["settle"].sum()
          .sort_values(ascending=False))
    au_total = n(au.sum())
    cum, pareto = 0, []
    for i, (name, v) in enumerate(au.items(), 1):
        cum += n(v)
        pareto.append({"rank": i, "cum_pct": round(cum / au_total * 100, 1) if au_total else 0})
        if i >= 50:
            break
    bands = {}
    for thr in (10, 50, 100):
        bands[thr] = round(n(au.head(thr).sum()) / au_total * 100, 1) if au_total else 0

    # 유통사 × 단행본/연재 히트맵
    pivot = (df[df["book_type"].isin(["단행본", "연재"])]
             .pivot_table(index="platform", columns="book_type", values="settle",
                          aggfunc="sum", fill_value=0))
    heat = []
    if not pivot.empty:
        pivot["__t"] = pivot.sum(axis=1)
        pivot = pivot.sort_values("__t", ascending=False).head(12)
        for plat, row in pivot.iterrows():
            heat.append({"platform": plat,
                         "단행본": round(n(row.get("단행본", 0))),
                         "연재": round(n(row.get("연재", 0)))})

    return {
        "total_settle": round(total),
        "distributors": dist_rows,
        "labels": topn("label_resolved", 10),
        "works": topn("title_resolved", 12),
        "genres": topn("content_type", 8),
        "waterfall": waterfall,
        "pareto": pareto, "pareto_bands": bands, "author_total": int(len(au)),
        "heatmap": heat,
    }


def search(df, q, limit=80):
    """작품·작가 통합 검색. 미매칭 해결용 — 같은 작품이 어느 유통사에 어떤 작가로 있는지 한눈에."""
    q = (q or "").strip()
    if not q:
        return {"query": q, "works": [], "authors": []}
    qn = norm_title(q)
    qlow = q.lower()
    # 작품: 원문·정규명·정규키 어디든 매칭
    m = (df["title_raw"].astype(str).str.lower().str.contains(qlow, na=False, regex=False) |
         df["title_resolved"].astype(str).str.lower().str.contains(qlow, na=False, regex=False) |
         (df["title_norm"].astype(str).str.contains(qn, na=False, regex=False) if qn else False) |
         df["author_resolved"].astype(str).str.lower().str.contains(qlow, na=False, regex=False))
    hit = df[m]
    works = []
    for key, g in hit.groupby("title_norm"):
        authors = sorted(set(a for a in g["author_resolved"] if a))
        labels = sorted(set(l for l in g["label_resolved"] if l))
        plats = (g.groupby("platform").agg(settle=("settle", "sum"), lines=("settle", "size"),
                                           has_author=("author", lambda s: any(str(x).strip() for x in s)))
                 .reset_index().sort_values("settle", ascending=False))
        plat_list = [{"platform": r["platform"], "settle": round(n(r["settle"])),
                      "lines": int(r["lines"]), "has_author": bool(r["has_author"])}
                     for _, r in plats.iterrows()]
        variants = sorted(set(str(t) for t in g["title_raw"]))[:6]
        st = g["match_status"]
        status = ("미매칭" if (st == "미매칭").any() and not authors
                  else ("완전" if authors and labels else ("작가만" if authors else "확인필요")))
        works.append({
            "title_norm": key,
            "title": (g["title_resolved"].mode().iloc[0] if not g["title_resolved"].mode().empty else key),
            "authors": authors, "labels": labels,
            "platforms": plat_list, "platform_count": len(plat_list),
            "variants": variants, "variant_count": int(g["title_raw"].nunique()),
            "lines": int(len(g)), "settle": round(n(g["settle"].sum())),
            "periods": sorted(set(g["period"])), "status": status,
            "author_known": bool(authors),
        })
    works.sort(key=lambda w: w["settle"], reverse=True)
    # 작가
    authors = by_author(hit, q=q, limit=30)
    return {"query": q, "norm": qn,
            "works": works[:limit], "work_total": len(works),
            "authors": authors}


DECISION_LOG = os.path.join(os.path.dirname(__file__), "data", "decisions.jsonl")


def _base_title(s):
    """시리즈 베이스 추출 — '월야환담 채월야'/'월야환담 광월야' 묶기용. 정규화 후 앞부분."""
    k = norm_title(s)
    # 한글/숫자 토큰 첫 덩어리(2글자 이상)를 베이스로
    import re as _re
    m = _re.match(r"[가-힣a-z0-9]{2,}", k)
    return m.group(0) if m else k


def _similar(a, b):
    """두 정규화 키의 유사도 (0~1) — 문자 집합 + 접두 일치 기반, 외부 의존 없음"""
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    # 접두 공통 길이
    pre = 0
    for x, y in zip(a, b):
        if x == y:
            pre += 1
        else:
            break
    sa, sb = set(a), set(b)
    jacc = len(sa & sb) / len(sa | sb) if (sa | sb) else 0
    prefix_ratio = pre / max(len(a), len(b))
    return round(0.5 * jacc + 0.5 * prefix_ratio, 3)


def suggest_matches(df, exclude_bundle=True, limit=60):
    """미매칭 작품에 대한 후보 매칭 제안 — 사유·근거·신뢰도 포함.
    유형: ① 교차매칭(유사 작품이 작가 보유) ② 시리즈형제(같은 베이스의 다른 작품이 작가 보유)"""
    mm = df[df["match_status"] == "미매칭"]
    if exclude_bundle and "is_bundle" in mm.columns:
        mm = mm[~mm["is_bundle"]]
    if mm.empty:
        return []
    # 이미 거절한 제안은 다시 띄우지 않음 (히스토리 기반). 단, 이후 '복원'되면 다시 노출.
    acts = latest_actions()
    rejected = {t for t, a in acts.items() if a == "reject"}

    # 매칭된(작가 보유) 작품 후보 풀: title_norm → {author, label, base, settle}
    known = df[df["author_resolved"] != ""]
    # 대표 작가·레이블을 벡터 연산으로 (그룹별 파이썬 루프·value_counts 회피)
    def _top_map(sub, col):
        c = sub.groupby(["title_norm", col]).size().reset_index(name="_n")
        c = c.sort_values("_n").drop_duplicates("title_norm", keep="last")
        return dict(zip(c["title_norm"], c[col]))
    au_map = _top_map(known, "author_resolved")
    lb_map = _top_map(known[known["label_resolved"] != ""], "label_resolved")
    samples = known.groupby("title_norm")["title_resolved"].first().to_dict()
    settles = known.groupby("title_norm")["settle"].sum().to_dict()
    pool = {}
    for key, sample in samples.items():
        sample = str(sample)
        pool[key] = {"author": au_map.get(key, ""), "label": lb_map.get(key, ""),
                     "base": _base_title(sample), "title": sample,
                     "settle": round(n(settles.get(key, 0)))}

    out = []
    seen = set()
    # 후보 색인 — 미매칭마다 전체 풀 순회를 피하기 위해 첫 글자·base로 색인
    # (sim>=0.62는 접두 공통이 있어야 나오는 값이라 첫 글자 색인으로 누락 없이 잡힘)
    from collections import defaultdict as _dd
    by_first, by_base = _dd(list), _dd(list)
    for _k, _info in pool.items():
        if _k:
            by_first[_k[0]].append(_k)
        if len(_info["base"]) >= 2:
            by_base[_info["base"]].append(_k)
    for tnorm, g in mm.groupby("title_norm"):
        if tnorm in seen or tnorm in rejected:
            continue
        seen.add(tnorm)
        sample = str(g["title_raw"].iloc[0])
        title_res = str(g["title_resolved"].iloc[0])
        base = _base_title(title_res)
        settle = round(n(g["settle"].sum()))
        plats = sorted(set(g["platform"]))
        cands = []
        cand_keys = set(by_first.get(tnorm[0], [])) if tnorm else set()
        if len(base) >= 2:
            cand_keys |= set(by_base.get(base, []))
        for key in cand_keys:
            if key == tnorm:
                continue
            info = pool[key]
            sim = _similar(tnorm, key)
            same_base = info["base"] == base and len(base) >= 2
            if sim >= 0.62 or same_base:
                conf = min(0.98, sim + (0.25 if same_base else 0))
                rtype = "시리즈 형제작" if same_base and sim < 0.95 else ("유사 작품" if sim < 0.95 else "동일 작품(표기차)")
                cands.append({"author": info["author"], "label": info["label"],
                              "ref_key": key, "ref_title": info["title"], "similarity": round(sim, 2),
                              "confidence": round(conf, 2), "reason_type": rtype})
        if not cands:
            continue
        # 작가별로 합의: 같은 작가를 가리키는 후보가 많을수록 신뢰
        from collections import Counter as _C
        avote = _C(c["author"] for c in cands if c["author"])
        cands.sort(key=lambda c: (avote[c["author"]], c["confidence"]), reverse=True)
        best = cands[0]
        agree = avote[best["author"]]
        reason = (f"{best['reason_type']} '{best['ref_title']}'(이)가 작가 '{best['author']}'"
                  + (f", 레이블 '{best['label']}'" if best["label"] else "")
                  + f"로 등록되어 있습니다." + (f" 유사 작품 {agree}건이 동일 작가를 가리킵니다." if agree > 1 else ""))
        out.append({
            "title_norm": tnorm, "sample": sample, "title": title_res,
            "platforms": plats, "platform_count": len(plats),
            "settle": settle, "lines": int(len(g)),
            "suggest_author": best["author"], "suggest_label": best["label"],
            "ref_key": best.get("ref_key", ""), "ref_title": best.get("ref_title", ""),
            "confidence": best["confidence"], "reason": reason,
            "candidates": cands[:4],
        })
    out.sort(key=lambda x: (x["confidence"], x["settle"]), reverse=True)
    return out[:limit]


ALADIN_KEY_FILE = os.path.join(os.path.dirname(__file__), "data", "aladin_key.txt")
import subprocess


def _aladin_key():
    # 배포 시 env(ALADIN_KEY) 우선 — 키를 코드/저장소에 두지 않음
    k = os.environ.get("ALADIN_KEY", "").strip()
    if k:
        return k
    try:
        return open(ALADIN_KEY_FILE, encoding="utf-8").read().strip()
    except Exception:
        return ""


def _primary_author(s):
    """'줄리안 맥클린 (지은이), 한지희 (옮긴이)' → '줄리안 맥클린'"""
    s = str(s or "")
    # (지은이)/(글) 역할의 이름 우선
    m = re.search(r"([^,()]+?)\s*\((?:지은이|글|저자|원작)\)", s)
    if m:
        return m.group(1).strip()
    return re.sub(r"\s*\([^)]*\)", "", s).split(",")[0].strip()


def aladin_search(title, key=None, target="eBook", n=5):
    """알라딘 TTB 제목 검색 → [{title,author,publisher,isbn13}]. curl 사용(샌드박스 SSL 우회)."""
    key = key or _aladin_key()
    if not key:
        return []
    try:
        out = subprocess.run(
            ["curl", "-s", "-L", "-G", "https://www.aladin.co.kr/ttb/api/ItemSearch.aspx",
             "--data-urlencode", f"ttbkey={key}", "--data-urlencode", f"Query={title}",
             "--data-urlencode", "QueryType=Title", "--data-urlencode", f"MaxResults={n}",
             "--data-urlencode", f"SearchTarget={target}", "--data-urlencode", "output=js",
             "--data-urlencode", "Version=20131101"],
            capture_output=True, text=True, timeout=5).stdout
        d = json.loads(out)
    except Exception:
        return []
    if not isinstance(d, dict) or "item" not in d:
        return []
    return [{"title": it.get("title", ""), "author": it.get("author", ""),
             "publisher": it.get("publisher", ""), "isbn13": it.get("isbn13", "")}
            for it in d.get("item", [])]


def aladin_enrich(df, limit=40, exclude_bundle=True):
    """단서 없음 미매칭 작품을 알라딘에서 조회해 작가 후보 제안 (승인 필요, 자동 적용 안 함)."""
    key = _aladin_key()
    if not key:
        return {"ok": False, "error": "알라딘 키가 설정되지 않았습니다.", "candidates": []}
    mm = df[df["match_status"] == "미매칭"]
    if exclude_bundle and "is_bundle" in mm.columns:
        mm = mm[~mm["is_bundle"]]
    # 내부 제안이 있는 건 제외 → '단서 없음'만
    internal = {x["title_norm"] for x in suggest_matches(df, exclude_bundle=exclude_bundle, limit=999)}
    works = []
    for key_t, g in mm.groupby("title_norm"):
        if key_t in internal:
            continue
        works.append((key_t, g))
    works.sort(key=lambda kv: kv[1]["settle"].sum(), reverse=True)
    works = works[:limit]

    def _probe(item):
        tnorm, g = item
        sample = str(g["title_raw"].iloc[0])
        title_res = str(g["title_resolved"].iloc[0])
        items = aladin_search(title_res, key, target="eBook", n=5) or aladin_search(title_res, key, target="Book", n=5)
        best, best_score = None, 0
        for it in items:
            sc = _similar(norm_title(it["title"]), tnorm)
            if sc > best_score:
                best, best_score = it, sc
        if not best or best_score < 0.5:
            return None
        author = _primary_author(best["author"])
        if not author:
            return None
        conf = round(min(0.97, 0.45 + best_score * 0.5), 2)
        return {
            "title_norm": tnorm, "sample": sample, "title": title_res,
            "settle": round(n(g["settle"].sum())), "platforms": sorted(set(g["platform"])),
            "suggest_author": author, "suggest_label": best["publisher"],
            "isbn": best["isbn13"], "ref_title": best["title"],
            "match_score": round(best_score, 2), "confidence": conf,
            "source": "알라딘",
            "reason": f"알라딘 조회 — '{best['title']}' 저자 '{author}'"
                      + (f", 출판사 '{best['publisher']}'" if best["publisher"] else "")
                      + (f" (ISBN {best['isbn13']})" if best["isbn13"] else "")
                      + f" · 제목 일치도 {int(best_score*100)}%",
        }

    # 병렬 조회 — 순차 시 수십 초~수 분 걸리던 것을 한 배치로 단축
    from concurrent.futures import ThreadPoolExecutor
    out = []
    if works:
        with ThreadPoolExecutor(max_workers=min(12, len(works))) as ex:
            for r in ex.map(_probe, works):
                if r:
                    out.append(r)
    out.sort(key=lambda x: x["settle"], reverse=True)
    return {"ok": True, "candidates": out, "checked": len(works)}


def log_decision(entry):
    os.makedirs(os.path.dirname(DECISION_LOG), exist_ok=True)
    with open(DECISION_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def read_decisions(limit=200):
    if not os.path.exists(DECISION_LOG):
        return []
    rows = [json.loads(l) for l in open(DECISION_LOG, encoding="utf-8") if l.strip()]
    return rows[-limit:][::-1]


def latest_actions():
    """title_norm별 '가장 최근' 결정 action (시간순 마지막 우선). 복원 반영 판정용."""
    out = {}
    if not os.path.exists(DECISION_LOG):
        return out
    for l in open(DECISION_LOG, encoding="utf-8"):
        if l.strip():
            e = json.loads(l)
            tn = e.get("title_norm")
            if tn:
                out[tn] = e.get("action")
    return out


# ── 연구소(Lab): 신고 기록 + 자동 탐지기 ─────────────────────────
FLAG_FILE = os.path.join(os.path.dirname(__file__), "data", "flags.json")


def read_flags():
    if os.path.exists(FLAG_FILE):
        return json.load(open(FLAG_FILE, encoding="utf-8"))
    return []


def _save_flags(flags):
    os.makedirs(os.path.dirname(FLAG_FILE), exist_ok=True)
    json.dump(flags, open(FLAG_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def add_flag(entry):
    flags = read_flags()
    entry["id"] = entry.get("ts", "").replace("-", "").replace(":", "").replace(" ", "") + "-" + str(len(flags) + 1)
    entry.setdefault("status", "열림")
    entry.setdefault("diagnosis", "")
    flags.append(entry)
    _save_flags(flags)
    return entry


def update_flag(fid, status=None, diagnosis=None):
    flags = read_flags()
    hit = False
    for f in flags:
        if f.get("id") == fid:
            if status is not None:
                f["status"] = status
            if diagnosis is not None:
                f["diagnosis"] = diagnosis
            hit = True
            break
    if hit:
        _save_flags(flags)
    return hit


def _acanon(a):
    """작가 강축약: 괄호병기·한자·영문·구두점·공백 제거 (표기변형 제거용)"""
    return re.sub(r"[^가-힣0-9]", "", re.sub(r"[(（].*?[)）]", "", str(a or "")))


def detect_homonyms(df, limit=300):
    """E1 동명이작 자동 탐지: title_norm별 (작가 강축약)≥2 AND 클러스터별 레이블 disjoint.
    이미 신고함에 올라간(검토중/규칙반영/기각/열림) 동명이작 건은 제외 — 등록하면 목록에서 사라짐."""
    flagged = {f.get("key") for f in read_flags()
               if f.get("category") == "동명이작" and f.get("key")}
    sub = df[df["title_norm"] != ""]
    if "is_bundle" in sub.columns:
        sub = sub[~sub["is_bundle"]]
    au = sub[sub["author_resolved"] != ""].groupby("title_norm")["author_resolved"].nunique()
    multi = set(au[au >= 2].index) - flagged
    if not multi:
        return []
    sub = sub[sub["title_norm"].isin(multi)]
    out = []
    for key, g in sub.groupby("title_norm"):
        clusters = {}
        for au_r, lb_r, st_r in zip(g["author_resolved"], g["label_resolved"], g["settle"]):
            a = _acanon(au_r)
            if not a:
                continue
            c = clusters.setdefault(a, {"settle": 0.0, "labels": set(), "author": au_r})
            c["settle"] += n(st_r)
            if lb_r:
                c["labels"].add(re.sub(r"\s", "", str(lb_r)))
        if len(clusters) < 2:
            continue
        labs = [c["labels"] for c in clusters.values() if c["labels"]]
        disjoint = len(labs) >= 2 and all(labs[i].isdisjoint(labs[j])
                                          for i in range(len(labs)) for j in range(i + 1, len(labs)))
        if not disjoint:
            continue
        cl = sorted(clusters.values(), key=lambda c: -c["settle"])
        out.append({"title_norm": key, "sample": str(g["title_raw"].iloc[0]),
                    "clusters": [{"author": c["author"], "labels": sorted(c["labels"]),
                                  "settle": round(c["settle"])} for c in cl],
                    "settle": round(n(g["settle"].sum())),
                    "risk": round(sum(c["settle"] for c in cl[1:]))})
    out.sort(key=lambda x: x["risk"], reverse=True)
    return out[:limit]


def mismatch_queue(df, exclude_bundle=True):
    sub = df[df["match_status"] == "미매칭"]
    if exclude_bundle and "is_bundle" in sub.columns:
        sub = sub[~sub["is_bundle"]]
    total_settle = n(df["settle"].sum())          # 전체 정산액 대비 비중
    mismatch_total = n(sub["settle"].sum())       # 미매칭 합계 대비 비중
    # 작품(title_norm) 단위로 묶음 — 한 번 등록하면 그 작품의 모든 유통사·월이 함께 해결됨
    out = []
    for key, g in sub.groupby("title_norm"):
        s = n(g["settle"].sum())
        plats = sorted(set(g["platform"]))
        out.append({"title_norm": key,
                    "sample": str(g["title_raw"].iloc[0]),
                    "platforms": plats, "platform_count": len(plats),
                    "lines": int(len(g)),
                    "settle": round(s),
                    "periods": sorted(set(g["period"])),
                    "pct_total": round(s / total_settle * 100, 3) if total_settle else 0,
                    "pct_mismatch": round(s / mismatch_total * 100, 1) if mismatch_total else 0})
    out.sort(key=lambda x: x["settle"], reverse=True)
    return out


def origin_detail(df, title_norm, limit=200):
    """표준화 이전 원본 내역 — 동명이작/신고 판단 근거.
    플랫폼·원본 제목(title_raw)·원천 작가/레이블·원본 엑셀 파일(source_file)·정산액."""
    sub = df[df["title_norm"] == title_norm]
    if sub.empty:
        return {"title_norm": title_norm, "rows": [], "total_settle": 0}
    cols = [c for c in ["platform", "title_raw", "author", "author_src", "label", "label_src", "source_file"] if c in sub.columns]
    g = (sub.groupby(cols, dropna=False)
         .agg(settle=("settle", "sum"), lines=("settle", "size")).reset_index()
         .sort_values("settle", ascending=False))
    rows = [{"platform": r.get("platform", ""), "title_raw": str(r.get("title_raw", "")),
             "author": str(r.get("author", "") or ""), "label": str(r.get("label", "") or ""),
             "author_src": str(r.get("author_src", "") or ""), "label_src": str(r.get("label_src", "") or ""),
             "source_file": str(r.get("source_file", "") or ""),
             "settle": round(n(r["settle"])), "lines": int(r["lines"])}
            for _, r in g.head(limit).iterrows()]
    return {"title_norm": title_norm, "rows": rows, "total_settle": round(n(sub["settle"].sum()))}

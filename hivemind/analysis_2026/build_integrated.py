# -*- coding: utf-8 -*-
"""2026년 1~4월 공식 통합본 (신규 플랫폼·다중소스, engine 고급매칭)
- 입력 소스 파라미터화: 디렉터리(월별) + 개별파일(2·3월 신규플랫폼 backfill)
- 중복 방지: 02폴더는 에이블리 보유 → 2·3월 loose 에이블리 제외, 모픽·교보만 추가
- 매칭: webapp/engine.py (마스터→시드→별칭, 번들 분리) — 운영 솔루션과 동일 레이어
산출: output/2026_정산통합_1to4_v1.xlsx + 콘솔 검증 리포트
"""
import os, sys, unicodedata
from collections import defaultdict
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "pipeline"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "webapp"))
import pandas as pd
from run import parse_file, nfc
import engine

BASE = "/Users/rachel/workspace/hivemind"
OUT = os.path.join(BASE, "analysis_2026", "output")
SAMPLE = os.path.join(BASE, "정산서 샘플")
ORIG = os.path.join(BASE, "02. 정산서 다운로드 원본")
nfd = lambda p: unicodedata.normalize("NFD", p)

# 파라미터화된 입력 소스 ───────────────────────────────────────────
DIRS = [   # (기간, 디렉터리, 제외 키워드)
    ("2026-01", os.path.join(SAMPLE, "2026년 01월"), []),
    ("2026-02", os.path.join(ORIG, "26년 2월"), []),
    ("2026-03", os.path.join(ORIG, "26년 3월"), []),
    ("2026-04", os.path.join(SAMPLE, "2026년 04월"), []),
]
EXTRA = [  # 02폴더에 없는 신규플랫폼만 2·3월에 backfill (에이블리는 중복이라 제외)
    ("2026-02", os.path.join(SAMPLE, "모픽_작품별_정산_202602.xlsx")),
    ("2026-02", os.path.join(SAMPLE, "교보문고 2월.xlsx")),
    ("2026-03", os.path.join(SAMPLE, "모픽_작품별_정산_202603.xlsx")),
    ("2026-03", os.path.join(SAMPLE, "교보문고 3월.xlsx")),
]


def collect_files():
    files = []
    for period, d, excl in DIRS:
        for fn in sorted(os.listdir(nfd(d))):
            if fn.startswith(".") or fn.startswith("._"):
                continue
            if any(x in unicodedata.normalize("NFC", fn) for x in excl):
                continue
            files.append((os.path.join(nfd(d), fn), period, fn))
    for period, f in EXTRA:
        files.append((nfd(f), period, os.path.basename(f)))
    return files


def main():
    files = collect_files()
    recs, metas = [], []
    for path, period, name in files:
        try:
            r, m = parse_file(path, period, name)
        except Exception as e:
            r, m = None, {"file": nfc(name), "period": period, "error": repr(e)[:160]}
        metas.append(m)
        if r:
            recs.extend(r)
    from normalize import norm_title, strip_tags_keep_title
    for r in recs:
        r["title_series"] = strip_tags_keep_title(r["title_raw"])
        r["title_norm"] = norm_title(r["title_raw"])

    recs = engine.match_records(recs)
    # 유통대행 신호: 제공사/공급사 = 스토린랩 (모픽·알라딘B2B 명시 제공)
    for r in recs:
        r["is_distribution"] = "스토린랩" in (r.get("supplier") or "")
    df = engine.build_dataframe(recs)

    # ── 검증 리포트 (원본 합계 대사) ──
    ok = [m for m in metas if not m.get("error")]
    err = [m for m in metas if m.get("error")]
    pass_n = fail_n = nosum = 0
    fails = []
    for m in ok:
        exp = m.get("expected_settle")
        if exp is None:
            nosum += 1
        elif abs(m["settle_sum"] - exp) <= 1:
            pass_n += 1
        else:
            fail_n += 1
            fails.append(m)

    # ── 집계 ──
    is_b = df["is_bundle"]
    work = df[~is_b]
    by_month = df.groupby("period").agg(행수=("settle", "size"), 정산액=("settle", "sum")).reset_index()
    auth = (work[work["author_resolved"] != ""].groupby(["period", "author_resolved"], as_index=False)
            .agg(작품수=("title_norm", "nunique"), 정산액=("settle", "sum"), 총매출=("gross", "sum"))
            .sort_values(["period", "정산액"], ascending=[True, False]))
    auth.columns = ["정산월", "작가", "작품수", "정산액", "총매출"]
    ser = (work.groupby(["period", "platform", "title_norm"], as_index=False)
           .agg(시리즈명=("title_resolved", "first"), 원문예시=("title_raw", "first"),
                작가=("author_resolved", "first"), 레이블=("label_resolved", "first"),
                정산액=("settle", "sum"), 매칭=("match_status", "first")))
    # 출판사별 정산 집계 (유통대행 그룹핑) — 스토린랩→출판사 정산 뷰
    pub = (work[work["label_resolved"] != ""].groupby("label_resolved", as_index=False)
           .agg(작품수=("title_norm", "nunique"), 작가수=("author_resolved", "nunique"),
                정산액=("settle", "sum"), 총매출=("gross", "sum"), 행수=("settle", "size"))
           .sort_values("정산액", ascending=False))
    pub.columns = ["출판사", "작품수", "작가수", "정산액", "총매출", "행수"]
    queue = (work[work["match_status"] == "미매칭"].groupby(["platform", "title_norm"], as_index=False)
             .agg(원문예시=("title_raw", "first"), 행수=("title_raw", "size"), 정산액합=("settle", "sum"))
             .sort_values("정산액합", ascending=False))
    rep = pd.DataFrame(ok)[["period", "platform", "account", "file", "real_type", "rows",
                            "gross_sum", "settle_sum", "expected_settle"]]
    rep["판정"] = rep.apply(lambda r: ("PASS" if abs(r["settle_sum"] - r["expected_settle"]) <= 1 else "FAIL")
                           if pd.notna(r["expected_settle"]) else "합계행없음", axis=1)

    detail = df[["period", "platform", "account", "title_raw", "title_resolved", "author_resolved",
                 "label_resolved", "author_src", "label_src", "book_type", "gross", "settle",
                 "gross_basis", "settle_basis", "match_status", "is_bundle",
                 "supplier", "is_distribution", "source_file"]]
    xlsx = os.path.join(OUT, "2026_정산통합_1to4_v1.xlsx")
    os.makedirs(OUT, exist_ok=True)
    with pd.ExcelWriter(xlsx, engine="openpyxl") as w:
        by_month.to_excel(w, "월별요약", index=False)
        pub.to_excel(w, "출판사별정산", index=False)
        ser.to_excel(w, "시리즈별", index=False)
        auth.to_excel(w, "작가별정산", index=False)
        queue.to_excel(w, "미매칭검토큐", index=False)
        rep.to_excel(w, "검증리포트", index=False)
        detail.to_excel(w, "통합레코드", index=False)

    # ── 콘솔 리포트 ──
    s = engine.summary(df, metas, exclude_bundle=True)
    print("=" * 66)
    print(f"2026 1~4월 통합 — 파일 {len(metas)}개 / 레코드 {len(df):,}행 / 정산총액 {s['total_settle']:,.0f}원")
    print(f"\n[검증] PASS {pass_n} / FAIL {fail_n} / 합계행없음 {nosum} / 파싱에러 {len(err)}")
    for m in fails:
        print(f"   FAIL: [{m['period']}] {m['platform']} Δ{m['settle_sum']-m['expected_settle']:,.0f}")
    for m in err:
        print(f"   ERR : [{m.get('period')}] {m['file'][:40]} {m['error'][:50]}")
    print(f"\n[매칭] 완전 {s['match_full']:,} ({s['match_full_pct']}%) / 작가만 {int((df['match_status']=='작가만').sum()):,}"
          f" / 미매칭(번들제외) {s['mismatch']:,} ({s['mismatch_pct']}%)")
    print(f"   미매칭 정산액 {s['mismatch_settle']:,}원 ({s['mismatch_settle_pct']}%) / 번들분리 {s['bundle']}행 {s['bundle_settle']:,}원")
    print(f"\n[월별] " + " | ".join(f"{r.period} {int(r.행수):,}행 {r.정산액:,.0f}원" for r in by_month.itertuples()))
    # 유통대행 그룹핑 리포트
    pub_known = int((work["label_resolved"] != "").sum())
    dist_rows = int(df["is_distribution"].sum())
    print(f"\n[유통대행/출판사] 출판사 식별 {pub_known:,}행 ({pub_known/len(work)*100:.1f}%) / 출판사 {len(pub):,}개")
    print(f"   유통대행 명시신호(제공사·공급사=스토린랩): {dist_rows:,}행")
    print("   출판사별 정산 상위5: " + " | ".join(f"{r.출판사} {r.정산액:,.0f}" for r in pub.head(5).itertuples()))
    print(f"\n산출: {xlsx}  (+ 출판사별정산 시트)")
    print(f"   작가 {auth['작가'].nunique():,}명 / 시리즈 {ser['title_norm'].nunique():,}개 / 미매칭큐 {len(queue)}건")


if __name__ == "__main__":
    main()

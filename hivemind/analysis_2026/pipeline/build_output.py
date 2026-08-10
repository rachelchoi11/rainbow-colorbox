# -*- coding: utf-8 -*-
"""기준 5: 작품 매칭 (① 2026 자체 마스터 → ② 22년 수작업 시드 → ③ 미매칭 검토 큐)
산출물: 2026_정산통합_v1.xlsx (통합레코드 / 시리즈별 / 작가별 / 미매칭 큐 / 검증 리포트)
교차검증: 02 원본 파싱 결과 vs 03 클라이언트 수정본 파싱 결과 (2월)
"""
import os, sys, json, unicodedata, warnings
from collections import Counter, defaultdict
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(__file__))
import pandas as pd
from normalize import norm_title, strip_tags_keep_title
from run import parse_file, nfc

BASE = "/Users/rachel/workspace/hivemind"
OUT = os.path.join(BASE, "analysis_2026", "output")

# ── 1) 레코드 로드 ───────────────────────────────────────────
recs = json.load(open(os.path.join(OUT, "records.json")))
metas = json.load(open(os.path.join(OUT, "parse_meta.json")))
df = pd.DataFrame(recs)
print(f"레코드 {len(df):,}건 로드")

# ── 2) 22년 수작업 시드 (콘텐츠명→시리즈명·작가·브랜드) ─────────
seed = {}
f22 = os.path.join(BASE, "docs", "'22년 12월 매출 정리_jhs_20221227.xlsx")
s22 = pd.read_excel(unicodedata.normalize("NFD", f22))
for _, r in s22.iterrows():
    for src in (r.get("콘텐츠명"), r.get("시리즈명")):
        k = norm_title(src)
        if not k:
            continue
        if k not in seed:
            seed[k] = dict(series=str(r.get("시리즈명") or "").strip(),
                           author=str(r.get("작가명") or "").strip(),
                           label=str(r.get("브랜드명") or "").strip())
for v in seed.values():  # VLOOKUP 실패 잔존값 제거
    if v["label"] in ("#N/A", "0", "nan", "None"):
        v["label"] = ""
    if v["author"] in ("#N/A", "nan", "None"):
        v["author"] = ""
print(f"22년 시드 {len(seed):,}키")

# ── 3) 2026 자체 마스터 (제공 플랫폼 다수결) ──────────────────
master = defaultdict(lambda: {"authors": Counter(), "labels": Counter(), "titles": Counter()})
for r in recs:
    k = r["title_norm"]
    if not k:
        continue
    m = master[k]
    m["titles"][r["title_series"]] += 1
    if r["author"]:
        m["authors"][r["author"]] += 1
    if r["label"]:
        m["labels"][r["label"]] += 1

def top(counter):
    return counter.most_common(1)[0][0] if counter else ""

resolved = {}
for k, m in master.items():
    sd = seed.get(k, {})
    resolved[k] = dict(
        title=top(m["titles"]) or sd.get("series", ""),
        author=top(m["authors"]) or sd.get("author", ""),
        label=top(m["labels"]) or sd.get("label", ""),
        author_src="2026제공" if m["authors"] else ("22년시드" if sd.get("author") else ""),
        label_src="2026제공" if m["labels"] else ("22년시드" if sd.get("label") else ""),
    )

# ── 4) 레코드 보강 ───────────────────────────────────────────
df["title_resolved"] = df["title_norm"].map(lambda k: resolved.get(k, {}).get("title", ""))
df["author_resolved"] = df.apply(
    lambda r: r["author"] or resolved.get(r["title_norm"], {}).get("author", ""), axis=1)
df["label_resolved"] = df.apply(
    lambda r: r["label"] or resolved.get(r["title_norm"], {}).get("label", ""), axis=1)
df["match_status"] = df.apply(
    lambda r: "완전" if (r["author_resolved"] and r["label_resolved"])
    else ("작가만" if r["author_resolved"] else ("레이블만" if r["label_resolved"] else "미매칭")), axis=1)

n_full = (df["match_status"] == "완전").sum()
print(f"매칭: 완전 {n_full:,} ({n_full/len(df)*100:.1f}%) / 미매칭 {(df['match_status']=='미매칭').sum():,}")

# ── 5) 집계 ─────────────────────────────────────────────────
ser = (df.groupby(["period", "platform", "title_norm"], as_index=False)
       .agg(시리즈명=("title_resolved", "first"), 원문예시=("title_raw", "first"),
            작가=("author_resolved", "first"), 레이블=("label_resolved", "first"),
            구분=("book_type", lambda s: s.mode().iloc[0] if len(s.mode()) else ""),
            행수=("title_raw", "size"), 총매출=("gross", "sum"), 정산액=("settle", "sum"),
            매칭=("match_status", "first"))
       .sort_values(["period", "platform", "정산액"], ascending=[True, True, False]))

auth = (df[df["author_resolved"] != ""]
        .groupby(["period", "author_resolved"], as_index=False)
        .agg(작품수=("title_norm", "nunique"), 정산액=("settle", "sum"), 총매출=("gross", "sum"))
        .sort_values(["period", "정산액"], ascending=[True, False]))
auth.columns = ["정산월", "작가", "작품수", "정산액", "총매출"]

queue = (df[df["match_status"] == "미매칭"]
         .groupby(["platform", "title_norm"], as_index=False)
         .agg(원문예시=("title_raw", "first"), 행수=("title_raw", "size"),
              정산액합=("settle", "sum"))
         .sort_values("정산액합", ascending=False))

# ── 6) 03 수정본 교차검증 (2월) ──────────────────────────────
cross = []
d03 = os.path.join(BASE, "03. 26년 2월_일부 수정(확장자명 등)")
sums02 = defaultdict(float)
for m in metas:
    if m.get("period") == "2026-02" and "error" not in m:
        sums02[(m["platform"], m["account"])] += m["settle_sum"]
for fn in sorted(os.listdir(unicodedata.normalize("NFD", d03))):
    if fn.startswith(".") or fn.startswith("._"):
        continue
    try:
        r03, m03 = parse_file(os.path.join(unicodedata.normalize("NFD", d03), fn), "2026-02", fn)
        if r03 is None:
            cross.append(dict(파일=nfc(fn), 결과=f"스펙없음"))
            continue
        key = (m03["platform"], m03["account"])
        s02 = sums02.get(key)
        diff = None if s02 is None else m03["settle_sum"] - s02
        cross.append(dict(파일=nfc(fn), 플랫폼=m03["platform"], 계정=m03["account"],
                          정산액_03수정본=m03["settle_sum"], 정산액_02원본=s02,
                          차이=diff,
                          판정="일치 ✅" if diff is not None and abs(diff) <= 1 else "차이 — 사유 확인"))
    except Exception as e:
        cross.append(dict(파일=nfc(fn), 결과=f"ERR {repr(e)[:80]}"))
cdf = pd.DataFrame(cross)

# ── 7) 검증 리포트 ───────────────────────────────────────────
rep = pd.DataFrame([m for m in metas if "error" not in m])
rep["판정"] = rep.apply(lambda r: ("PASS" if abs(r["settle_sum"] - r["expected_settle"]) <= 1 else "FAIL")
                        if pd.notna(r["expected_settle"]) else "합계행 없음 → 교차검증 참조", axis=1)
rep = rep[["period", "platform", "account", "file", "real_type", "rows", "skipped",
           "gross_sum", "settle_sum", "expected_settle", "판정", "note"]]

# ── 8) 출력 ─────────────────────────────────────────────────
xlsx = os.path.join(OUT, "2026_정산통합_v1.xlsx")
detail = df[["period", "platform", "account", "title_raw", "title_resolved", "author_resolved",
             "label_resolved", "book_type", "content_type", "gross", "settle",
             "gross_basis", "settle_basis", "match_status", "sale_month", "settle_month",
             "source_file", "source_row"]].rename(columns={
    "period": "정산월", "platform": "플랫폼", "account": "계정", "title_raw": "작품명(원문)",
    "title_resolved": "시리즈명(정규)", "author_resolved": "작가", "label_resolved": "레이블",
    "book_type": "단행본/연재", "content_type": "콘텐츠유형", "gross": "총매출", "settle": "정산액",
    "gross_basis": "총매출근거", "settle_basis": "정산액근거", "match_status": "매칭상태",
    "sale_month": "판매월", "settle_month": "매출월", "source_file": "원본파일", "source_row": "원본행"})
with pd.ExcelWriter(xlsx, engine="openpyxl") as w:
    ser.to_excel(w, "시리즈별 통합", index=False)
    auth.to_excel(w, "작가별 정산", index=False)
    queue.to_excel(w, "미매칭 검토큐", index=False)
    rep.to_excel(w, "검증리포트(원본대사)", index=False)
    cdf.to_excel(w, "교차검증(03수정본)", index=False)
    detail.to_excel(w, "통합레코드(전체)", index=False)
print(f"\n산출: {xlsx}")
print(f"시리즈 {ser['title_norm'].nunique():,}개 / 작가 {auth['작가'].nunique():,}명 / 미매칭 큐 {len(queue):,}건")
print("\n--- 03 수정본 교차검증 ---")
if not cdf.empty and "판정" in cdf.columns:
    print(cdf["판정"].value_counts(dropna=False).to_string())

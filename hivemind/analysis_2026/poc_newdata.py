# -*- coding: utf-8 -*-
"""신규 데이터(2026 1·4월 + 신규플랫폼 교보·모픽) PoC
- 목적: ① 모픽·교보 파서 동작 ② 신규 월 전 파일 파싱·합계대사 ③ 매칭률
        ④ ablation: 모픽·교보가 '다른 플랫폼' 미매칭률을 낮추는지
"""
import os, sys, json, unicodedata
from collections import Counter, defaultdict
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "pipeline"))
from run import parse_file, nfc
from normalize import norm_title, strip_tags_keep_title

BASE = "/Users/rachel/workspace/hivemind"
SRC = os.path.join(BASE, "정산서 샘플")
MONTHS = [("2026-01", "2026년 01월"), ("2026-04", "2026년 04월")]
NEW_PLATFORMS = {"모픽", "교보문고"}


def parse_all():
    recs, metas = [], []
    for period, folder in MONTHS:
        d = unicodedata.normalize("NFD", os.path.join(SRC, folder))
        for fn in sorted(os.listdir(d)):
            if fn.startswith(".") or fn.startswith("._"):
                continue
            try:
                r, m = parse_file(os.path.join(d, fn), period, fn)
            except Exception as e:
                r, m = None, {"file": nfc(fn), "period": period, "error": repr(e)[:140]}
            metas.append(m)
            if r:
                recs.extend(r)
    for r in recs:
        r["title_series"] = strip_tags_keep_title(r["title_raw"])
        r["title_norm"] = norm_title(r["title_raw"])
    return recs, metas


def load_seed():
    import pandas as pd
    seed = {}
    f22 = unicodedata.normalize("NFD", os.path.join(BASE, "docs", "'22년 12월 매출 정리_jhs_20221227.xlsx"))
    s22 = pd.read_excel(f22)
    for _, r in s22.iterrows():
        for src in (r.get("콘텐츠명"), r.get("시리즈명")):
            k = norm_title(src)
            if k and k not in seed:
                a = str(r.get("작가명") or "").strip()
                l = str(r.get("브랜드명") or "").strip()
                seed[k] = dict(author="" if a in ("#N/A", "nan", "None") else a,
                               label="" if l in ("#N/A", "0", "nan", "None") else l)
    return seed


def build_master(recs, seed, exclude_platforms=()):
    master = defaultdict(lambda: {"authors": Counter(), "labels": Counter()})
    for r in recs:
        if r["platform"] in exclude_platforms:
            continue
        k = r["title_norm"]
        if not k:
            continue
        if r["author"]:
            master[k]["authors"][r["author"]] += 1
        if r["label"]:
            master[k]["labels"][r["label"]] += 1
    top = lambda c: c.most_common(1)[0][0] if c else ""
    resolved = {}
    keys = set(master) | set(seed)
    for k in keys:
        m = master.get(k, {"authors": Counter(), "labels": Counter()})
        sd = seed.get(k, {})
        resolved[k] = dict(author=top(m["authors"]) or sd.get("author", ""),
                           label=top(m["labels"]) or sd.get("label", ""))
    return resolved


def match_status(recs, resolved):
    out = []
    for r in recs:
        a = r["author"] or resolved.get(r["title_norm"], {}).get("author", "")
        l = r["label"] or resolved.get(r["title_norm"], {}).get("label", "")
        out.append("완전" if (a and l) else ("미매칭" if not (a or l) else "부분"))
    return out


def pct(n, d):
    return f"{n/d*100:.1f}%" if d else "—"


def main():
    recs, metas = parse_all()
    print(f"\n{'='*70}\n[1] 파싱 결과 — {len(recs):,}행 / 파일 {len(metas)}개")
    misses = [m for m in metas if m.get("error") or m.get("rows", 1) == 0]
    print(f"\n--- 스펙미스/0행/에러 {len(misses)}건 ---")
    for m in misses:
        print(f"  [{m.get('period')}] {m['file'][:45]:<46} {m.get('error') or ('0행 platform='+str(m.get('platform')))}")

    print(f"\n--- 합계 대사 (FAIL/신규플랫폼만 표시) ---")
    fails = 0
    for m in metas:
        if m.get("error"):
            continue
        exp = m.get("expected_settle")
        is_new = m.get("platform") in NEW_PLATFORMS
        if exp is None:
            if is_new:
                print(f"  [{m['period']}] {m['platform']:<8} {m['rows']:>5}행 정산합 {m['settle_sum']:>14,.0f}  (합계행 없음)")
            continue
        diff = m["settle_sum"] - exp
        ok = abs(diff) <= 1
        if not ok:
            fails += 1
        if not ok or is_new:
            v = "PASS ✅" if ok else f"FAIL ❌ Δ{diff:,.0f}"
            print(f"  [{m['period']}] {m['platform']:<8} {m['rows']:>5}행 정산합 {m['settle_sum']:>14,.0f} 기대 {exp:>14,.0f}  {v}")
    print(f"  → 대사 FAIL {fails}건")

    # ── 매칭 ──
    seed = load_seed()
    print(f"\n[2] 매칭 — 22년 시드 {len(seed):,}키")
    full = build_master(recs, seed)
    st_full = match_status(recs, full)
    n = len(recs)
    c = Counter(st_full)
    print(f"  전체: 완전 {c['완전']:,} ({pct(c['완전'],n)}) / 부분 {c['부분']:,} / 미매칭 {c['미매칭']:,} ({pct(c['미매칭'],n)})")

    # 신규플랫폼 자체 매칭
    for p in sorted(NEW_PLATFORMS):
        idx = [i for i, r in enumerate(recs) if r["platform"] == p]
        if idx:
            cp = Counter(st_full[i] for i in idx)
            print(f"  {p}: {len(idx):,}행 — 완전 {cp['완전']:,} ({pct(cp['완전'],len(idx))}) / 미매칭 {cp['미매칭']:,}")

    # ── ablation: 모픽·교보를 master 기여에서 빼면? (다른 플랫폼 영향) ──
    print(f"\n[3] Ablation — 신규플랫폼(모픽·교보)이 '다른 플랫폼' 미매칭을 낮추나?")
    base = build_master(recs, seed, exclude_platforms=NEW_PLATFORMS)
    st_base = match_status(recs, base)
    other = [i for i, r in enumerate(recs) if r["platform"] not in NEW_PLATFORMS]
    mis_base = sum(1 for i in other if st_base[i] == "미매칭")
    mis_full = sum(1 for i in other if st_full[i] == "미매칭")
    full_base = sum(1 for i in other if st_base[i] == "완전")
    full_full = sum(1 for i in other if st_full[i] == "완전")
    no = len(other)
    print(f"  다른 플랫폼 {no:,}행 기준")
    print(f"   - 신규플랫폼 제외 시: 완전 {pct(full_base,no)} / 미매칭 {mis_base:,} ({pct(mis_base,no)})")
    print(f"   - 신규플랫폼 포함 시: 완전 {pct(full_full,no)} / 미매칭 {mis_full:,} ({pct(mis_full,no)})")
    print(f"   ⇒ 미매칭 {mis_base-mis_full:+,}행 변화 / 완전매칭 {full_full-full_base:+,}행")

    # 정산액 기준 미매칭률(설계서 KPI와 동일 척도)
    settle_total = sum(r["settle"] or 0 for r in recs)
    mis_settle = sum(recs[i]["settle"] or 0 for i in range(n) if st_full[i] == "미매칭")
    print(f"\n[4] 정산액 기준 미매칭률: {pct(mis_settle, settle_total)} (미매칭 정산액 {mis_settle:,.0f} / 전체 {settle_total:,.0f})")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""26년 2·3월 정산서 → 표준 레코드 통합 실행
기준 4: 표준 13+α 필드, basis 플래그로 제공값/계산값 구분
기준 6: 플랫폼별 정산액 합계 = 원본 자체 합계행과 대사 (±1원 PASS)
"""
import os, re, sys, json, unicodedata
sys.path.insert(0, os.path.dirname(__file__))
from loaders import load_grids, flatten_header
from specs import find_spec, _num, _is_sum_row
from normalize import norm_title, strip_tags_keep_title

BASE = "/Users/rachel/workspace/hivemind"
MONTHS = [("2026-02", "26년 2월"), ("2026-03", "26년 3월")]
SRC = os.path.join(BASE, "02. 정산서 다운로드 원본")

def nfc(s):
    return unicodedata.normalize("NFC", s)

def canon(s):
    return re.sub(r"\s+", " ", str(s or "").strip())


class Getter:
    def __init__(self, name2cols, row):
        self.n2c, self.row = name2cols, row

    def _find(self, cands):
        for exact_pass in (True, False):
            for cand in cands:
                tokens = cand.split("&&")
                for name, cols in self.n2c.items():
                    ok = (name == cand) if exact_pass else all(t in name for t in tokens)
                    if ok:
                        for c in cols:
                            if c < len(self.row) and str(self.row[c]).strip() not in ("", "None"):
                                return self.row[c]
        return None

    def __call__(self, *cands):
        return _num(self._find(cands))

    def raw(self, *cands):
        v = self._find(cands)
        return None if v is None else str(v).strip()


def select_sheet(grids, sp):
    want = sp.get("sheet")
    items = list(grids.items())
    if want == "largest" or (want is None and len(items) > 1 and sp["kind"] == "html"):
        return max(items, key=lambda kv: len(kv[1]) * (len(kv[1][0]) if kv[1] else 0))[1]
    if want:
        for name, g in items:
            if nfc(name) == want or want in nfc(name):
                return g
    return items[0][1]


def locate_header(grid, sp):
    if "header" in sp:
        a, b = sp["header"]
        return a, b
    tokens = sp["header_find"]
    for i, row in enumerate(grid[:30], 1):
        cells = [canon(c) for c in row]
        if all(any(t == c or t in c for c in cells) for t in tokens):
            return i, i + sp.get("header_extra", 0)
    raise ValueError(f"헤더 미발견: {tokens}")


def parse_file(path, period, fname):
    sp = find_spec(nfc(fname))
    if not sp:
        return None, {"file": fname, "period": period, "error": "스펙 미등록"}
    grids, real = load_grids(path)
    grid = select_sheet(grids, sp)
    if "columns_pos" in sp:  # 헤더행 없는 원본: 위치 고정 매핑
        h1 = sp.get("data_start", 1) - 1
        name2cols = {k: [v - 1] for k, v in sp["columns_pos"].items()}
        F = {k: [k] for k in sp["columns_pos"]}
    else:
        h0, h1 = locate_header(grid, sp)
        names = [canon(nfc(n)) for n in flatten_header(grid, h0, h1)]
        name2cols = {}
        for i, n in enumerate(names):
            if n:
                name2cols.setdefault(n, []).append(i)
        F = sp["fields"]
    account = ""
    m = re.search(sp.get("account_from_name", r"\((\d)\)"), nfc(fname))
    if m:
        account = m.group(1)

    recs, skipped, expected = [], 0, {"gross": None, "settle": None}

    def harvest_expected(row, g):
        """합계/푸터 행에서 검증 기대값 수확"""
        for k in ("gross", "settle"):
            cands = F.get(k)
            v = g(*cands) if cands else None
            if v is None and k == "gross" and "gross_calc" in sp:
                try: v = sp["gross_calc"](g)
                except Exception: v = None
            if v is not None and expected[k] is None:
                expected[k] = v
        if expected["settle"] is None and "settle_calc" in sp:
            try:
                v = sp["settle_calc"](g)
                if v is not None:
                    expected["settle"] = v
            except Exception:
                pass
        if expected["settle"] is None:  # '소득액: 1,011,780' / '정산액 합계 | 3,341,366' 형
            cells = [str(c or "").strip() for c in row]
            for i in range(len(cells) - 1):
                if re.match(r"(소득액|정산금액|정산액|정산액 합계|합계)\s*:?\s*$", cells[i]) and _num(row[i + 1]) is not None:
                    expected["settle"] = _num(row[i + 1])
                    break

    # 헤더 이전 행(북큐브형 상단 합계) 수확
    for row in grid[:max(0, h1 - 1)]:
        if _is_sum_row(row):
            harvest_expected(row, Getter(name2cols, row))

    for ri in range(h1, len(grid)):
        row = grid[ri]
        if not any(str(c).strip() for c in row):
            continue
        g = Getter(name2cols, row)
        if _is_sum_row(row):
            harvest_expected(row, g)
            continue
        title = g.raw(*F["title"]) if "title" in F else None
        if not title:
            skipped += 1
            if ri >= len(grid) - 6:  # 말미 푸터형 합계(첫 셀 빈칸) 수확
                harvest_expected(row, g)
            continue
        title = nfc(title)

        gross = sp["gross_calc"](g) if "gross_calc" in sp else (g(*F["gross"]) if "gross" in F else None)
        settle = sp["settle_calc"](g) if "settle_calc" in sp else (g(*F["settle"]) if "settle" in F else None)

        label = g.raw(*F["label"]) if "label" in F else None
        if label and "label_split" in sp:
            mm = re.match(sp["label_split"], label)
            if mm:
                label = mm.group(1).strip()

        bt = ""
        if "book_type_col" in F:
            v = g.raw(*F["book_type_col"]) or ""
            bt = sp.get("book_type_map", {}).get(v, v)
        if not bt and "book_type" in sp:
            try: bt = sp["book_type"](title, g) or ""
            except Exception: bt = ""
        if bt in ("연재본",): bt = "연재"
        if bt and bt not in ("연재", "단행본", "구분불가(구독제)"):
            bt = "단행본" if "단행" in bt else ("연재" if "연재" in bt else bt)

        recs.append(dict(
            period=period, platform=sp["platform"], account=account,
            title_raw=title,
            author=nfc(g.raw(*F["author"]) or "") if "author" in F else "",
            label=nfc(label or ""),
            book_type=bt,
            content_type=nfc(g.raw(*F["content_type"]) or "") if "content_type" in F else "",
            gross=gross, settle=settle,
            gross_basis=sp.get("gross_basis", "제공값" if gross is not None else "미제공"),
            settle_basis=sp.get("settle_basis", "제공값" if settle is not None else "미제공"),
            sale_month=g.raw(*F["sale_month"]) if "sale_month" in F else "",
            settle_month=g.raw(*F["settle_month"]) if "settle_month" in F else "",
            supplier=nfc(g.raw(*F["supplier"]) or "") if "supplier" in F else "",
            source_file=nfc(fname), source_row=ri + 1,
        ))

    meta = dict(file=nfc(fname), period=period, platform=sp["platform"], account=account,
                real_type=real, rows=len(recs), skipped=skipped,
                gross_sum=round(sum(r["gross"] or 0 for r in recs), 1),
                settle_sum=round(sum(r["settle"] or 0 for r in recs), 1),
                expected_gross=expected["gross"], expected_settle=expected["settle"],
                note=sp.get("note", ""))
    return recs, meta


def main():
    all_recs, metas = [], []
    for period, folder in MONTHS:
        d = os.path.join(SRC, folder)
        for fn in sorted(os.listdir(d)):
            if fn.startswith(".") or fn.startswith("._"):
                continue
            try:
                recs, meta = parse_file(os.path.join(d, fn), period, fn)
            except Exception as e:
                recs, meta = None, {"file": nfc(fn), "period": period, "error": repr(e)[:160]}
            metas.append(meta)
            if recs:
                all_recs.extend(recs)

    # 정규화 키 부여
    for r in all_recs:
        r["title_series"] = strip_tags_keep_title(r["title_raw"])
        r["title_norm"] = norm_title(r["title_raw"])

    out_dir = os.path.join(BASE, "analysis_2026", "output")
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "records.json"), "w", encoding="utf-8") as f:
        json.dump(all_recs, f, ensure_ascii=False)
    with open(os.path.join(out_dir, "parse_meta.json"), "w", encoding="utf-8") as f:
        json.dump(metas, f, ensure_ascii=False, indent=1)

    # 콘솔 리포트: 합계 대사
    print(f"{'기간':<8}{'플랫폼':<14}{'계정':<4}{'행수':>7}{'정산액 합':>14}{'기대값':>14}  판정")
    fails = 0
    for m in metas:
        if "error" in m:
            print(f"{m['period']:<8}{'?':<14}{'':<4}{'ERR':>7}  {m['file'][:30]} {m['error'][:60]}")
            fails += 1
            continue
        exp = m["expected_settle"]
        if exp is None:
            verdict = "— (합계행 없음)"
        else:
            verdict = "PASS ✅" if abs(m["settle_sum"] - exp) <= 1 else f"FAIL ❌ (차이 {m['settle_sum']-exp:,.0f})"
            if verdict.startswith("FAIL"):
                fails += 1
        print(f"{m['period']:<8}{m['platform']:<14}{m['account']:<4}{m['rows']:>7}{m['settle_sum']:>14,.0f}"
              f"{(exp if exp is not None else 0):>14,.0f}  {verdict}")
    print(f"\n총 레코드 {len(all_recs):,}건 / 파일 {len(metas)}개 / 문제 {fails}건")


if __name__ == "__main__":
    main()

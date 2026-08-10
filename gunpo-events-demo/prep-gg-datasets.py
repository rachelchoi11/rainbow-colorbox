#!/usr/bin/env python3
"""경기데이터드림 다운로드 CSV(군포) → 구조화 집계 → gg-infra.json

경기데이터드림 신규가입 불가 기간(2026-05-22~29)이라 API 대신 다운로드 데이터셋 사용.
CSV는 cp949 인코딩. 군포 행만 필터해 핏치가 연계할 '독서·학습 인프라' + 취약계층 통계로 집계.
"""
import csv, json, os, unicodedata
from datetime import datetime, timezone

SRC = "/Users/rachel/Dropbox/2026/사업공고_2026/2026_군포시 사회적경제 창업팀 선발/경기데이터드림_데이터셋"


def nfc(s):
    return unicodedata.normalize("NFC", s or "")


def read(path):
    for enc in ("utf-8-sig", "cp949", "euc-kr", "utf-8"):
        try:
            with open(path, encoding=enc, newline="") as f:
                return list(csv.reader(f))
        except Exception:
            continue
    return []


def find(files, kw):
    # macOS 파일명은 NFD일 수 있어 NFC로 정규화 후 매칭
    for p in files:
        if kw in nfc(os.path.basename(p)):
            return p
    return None


def col(hdr, *names):
    for i, h in enumerate(hdr):
        for n in names:
            if n in (h or ""):
                return i
    return -1


def is_gunpo(row):
    return any("군포" in (c or "") for c in row)


def main():
    files = [os.path.join(SRC, f) for f in os.listdir(SRC) if f.lower().endswith(".csv")]
    out = {"generatedAt": datetime.now(timezone.utc).isoformat(), "source": "경기데이터드림 다운로드 데이터셋(군포)"}

    # 1) 학교도서관현황 — 군포 학교 수(최신연도, 학교명 중복제거) + 대출자료수
    #    원본은 2015~2025 누적이라 최신연도만, 학교명 기준 dedupe 필수.
    p = find(files, "학교도서관")
    if p:
        rows = read(p); hdr = rows[0]
        yi = col(hdr, "기준년도"); ni = col(hdr, "학교명")
        lv = col(hdr, "학교급명"); loan = col(hdr, "대출자료수"); ex = col(hdr, "제외여부")
        data = [r for r in rows[1:] if len(r) > max(ni, lv) and nfc(r[ni]).strip()]
        yrs = [(r[yi] or "").strip() for r in data if yi >= 0 and (r[yi] or "").strip().isdigit()]
        latest = max(yrs) if yrs else ""
        cur = [r for r in data
               if (yi < 0 or (r[yi] or "").strip() == latest)
               and (ex < 0 or len(r) <= ex or (r[ex] or "").strip() != "Y")]
        seen, by, total_loan = set(), {}, 0
        for r in cur:
            name = nfc(r[ni]).strip()
            if name in seen: continue
            seen.add(name)
            lvl = nfc(r[lv]).strip() if lv >= 0 and len(r) > lv else "기타"
            if lvl: by[lvl] = by.get(lvl, 0) + 1
            if loan >= 0 and len(r) > loan:
                try: total_loan += int((r[loan] or "0").replace(",", "") or 0)
                except: pass
        out["schoolLibrary"] = {"year": latest, "schools": len(seen), "byLevel": by, "loanItems": total_loan}

    # 2) 우리동네 학습공간 — 군포 거점 목록
    p = find(files, "학습공간")
    if p:
        rows = read(p); hdr = rows[0]
        nm = col(hdr, "시설명"); ty = col(hdr, "시설유형"); yr = col(hdr, "지정년도")
        ad = col(hdr, "도로명주소")
        g = [r for r in rows[1:] if is_gunpo(r)]
        out["learningSpaces"] = [{"name": r[nm].strip(), "type": (r[ty] or "").strip() if ty>=0 else "",
                                   "year": (r[yr] or "").strip() if yr>=0 else "",
                                   "addr": (r[ad] or "").strip() if ad>=0 else ""} for r in g]

    # 3) 다함께돌봄센터 — 군포 시설 목록 + 총 정원
    p = find(files, "돌봄센터")
    if p:
        rows = read(p); hdr = rows[0]
        nm = col(hdr, "시설명"); cap = col(hdr, "정원"); ad = col(hdr, "도로명주소")
        g = [r for r in rows[1:] if is_gunpo(r)]
        cents = []
        cap_total = 0
        for r in g:
            c = 0
            if cap >= 0:
                try: c = int((r[cap] or "0").replace(",", "") or 0)
                except: pass
            cap_total += c
            cents.append({"name": r[nm].strip(), "capacity": c, "addr": (r[ad] or "").strip() if ad>=0 else ""})
        out["careCenters"] = {"count": len(cents), "capacityTotal": cap_total, "list": cents}

    # 4) 책나래(접근성 도서 택배) 도서관
    p = find(files, "책나래")
    if p:
        rows = read(p); hdr = rows[0]
        nm = col(hdr, "기관명"); ph = col(hdr, "전화번호")
        g = [r for r in rows[1:] if is_gunpo(r)]
        out["chaekNarae"] = [{"name": r[nm].strip(), "phone": (r[ph] or "").strip() if ph>=0 else ""} for r in g]

    # 5) 기초생활수급자 — 군포 총 인원 + 18세미만(아동)
    p = find(files, "기초생활수급")
    if p:
        rows = read(p); hdr = rows[0]
        cnt = col(hdr, "인원수"); age = col(hdr, "연령구간")
        g = [r for r in rows[1:] if is_gunpo(r)]
        tot = child = 0
        for r in g:
            try: n = int((r[cnt] or "0").replace(",", "") or 0)
            except: n = 0
            tot += n
            if age >= 0 and "18세미만" in (r[age] or ""): child += n
        out["welfare"] = {"benefitCases": tot, "childCasesUnder18": child,
                          "note": "급여 자격별(생계/의료/주거/교육) 건수 합계 — 동일인 중복 가능, '인원'이 아님"}

    # 6) 드림스타트 사업비
    p = find(files, "드림스타트")
    if p:
        rows = read(p); hdr = rows[0]
        bud = col(hdr, "사업비")
        g = [r for r in rows[1:] if is_gunpo(r)]
        if g and bud >= 0:
            try: out["dreamStart"] = {"budgetThousandWon": int((g[0][bud] or "0").replace(",", "") or 0)}
            except: pass

    path = os.path.join(os.path.dirname(__file__), "gg-infra.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    # 요약 출력
    print("\n━━━ 경기데이터드림(군포) 집계 ━━━")
    sl = out.get("schoolLibrary", {})
    print(f"  학교도서관({sl.get('year','')}): {sl.get('schools',0)}개교  {sl.get('byLevel',{})}  대출자료 {sl.get('loanItems',0):,}권")
    print(f"  우리동네 학습공간: {len(out.get('learningSpaces',[]))}곳")
    cc = out.get("careCenters", {})
    print(f"  다함께돌봄센터: {cc.get('count',0)}곳 (정원 {cc.get('capacityTotal',0)}명)")
    print(f"  책나래 도서관: {len(out.get('chaekNarae',[]))}곳")
    w = out.get("welfare", {})
    print(f"  기초생활수급 급여건수(중복가능): {w.get('benefitCases',0):,}건 (18세미만 {w.get('childCasesUnder18',0):,}건)")
    if "dreamStart" in out:
        print(f"  드림스타트 사업비: {out['dreamStart']['budgetThousandWon']:,}천원")
    print(f"\n  → gg-infra.json 저장\n")


if __name__ == "__main__":
    main()

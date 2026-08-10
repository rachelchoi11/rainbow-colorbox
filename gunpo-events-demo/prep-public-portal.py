#!/usr/bin/env python3
"""공공데이터포털 다운로드(군포 도서관) → 구조화 → public-portal.json

  - 경기도 군포시_도서관 문화행사_*.csv   → 실제 행사 591건
  - 경기도 군포시_도서관홈페이지 인기검색어_*.csv → 인기 검색어 트렌드
  - 경기도 군포시_도서관 도서목록_*.xlsx  → 장서 총량 + 분관 분포

CSV는 cp949. 파일명은 NFD 가능 → listdir+NFC 매칭.
"""
import csv, json, os, unicodedata
from collections import Counter
from datetime import datetime, timezone

SRC = "/Users/rachel/Dropbox/2026/사업공고_2026/2026_군포시 사회적경제 창업팀 선발/공공데이터포털_데이터셋"


def nfc(s): return unicodedata.normalize("NFC", s or "")


def readcsv(p):
    for enc in ("utf-8-sig", "cp949", "euc-kr", "utf-8"):
        try:
            with open(p, encoding=enc, newline="") as f:
                return [[nfc(c) for c in row] for row in csv.reader(f)]
        except Exception:
            continue
    return []


def find(kw, ext):
    for f in os.listdir(SRC):
        if kw in nfc(f) and f.lower().endswith(ext):
            return os.path.join(SRC, f)
    return None


def main():
    out = {"generatedAt": datetime.now(timezone.utc).isoformat(),
           "source": "공공데이터포털 — 경기도 군포시 도서관(다운로드)"}

    # 1) 문화행사
    p = find("문화행사", ".csv")
    if p:
        rows = readcsv(p); hdr = rows[0]
        idx = {h: i for i, h in enumerate(hdr)}
        def g(r, k):
            i = idx.get(k, -1); return (r[i].strip() if 0 <= i < len(r) else "")
        evs = []
        for r in rows[1:]:
            if not g(r, "행사명"): continue
            evs.append({
                "title": g(r, "행사명"),
                "start": g(r, "시작일자")[:10], "end": g(r, "종료일자")[:10],
                "target": g(r, "대상"), "venue": g(r, "장소"),
                "fee": g(r, "비용"), "teacher": g(r, "강사"), "capacity": g(r, "정원"),
            })
        years = Counter(e["start"][:4] for e in evs if e["start"])
        venues = Counter((e["venue"].split()[0] if e["venue"] else "기타") for e in evs)
        evs.sort(key=lambda e: e["start"], reverse=True)
        out["events"] = {
            "total": len(evs),
            "byYear": dict(sorted(years.items())),
            "byVenue": venues.most_common(8),
            "recent": evs[:16],   # 최신 16건 (표시용)
        }

    # 2) 인기검색어 (최신 기준일자만)
    p = find("인기검색어", ".csv")
    if p:
        rows = readcsv(p); hdr = rows[0]
        idx = {h: i for i, h in enumerate(hdr)}
        kw = idx.get("검색키워드명", 1); cnt = idx.get("검색횟수", 2)
        dt = idx.get("기준일자", 3); rk = idx.get("순위", 0)
        data = [r for r in rows[1:] if len(r) > max(kw, cnt)]
        latest = max((r[dt] for r in data if dt < len(r) and r[dt]), default="")
        cur = [r for r in data if dt >= len(r) or r[dt] == latest]
        def num(s):
            try: return int((s or "0").replace(",", "") or 0)
            except: return 0
        cur.sort(key=lambda r: num(r[rk]) if rk < len(r) and r[rk] else 9999)
        out["keywords"] = {
            "date": latest,
            "top": [{"rank": r[rk] if rk < len(r) else "", "kw": r[kw], "count": num(r[cnt])}
                    for r in cur[:15]],
        }

    # 3) 도서목록 (대용량 xlsx → 총량 + 분관 분포만)
    p = find("도서목록", ".xlsx")
    if p:
        import openpyxl
        wb = openpyxl.load_workbook(p, read_only=True); ws = wb.active
        total = 0; branch = Counter(); hdr = None; bi = -1
        for row in ws.iter_rows(values_only=True):
            if hdr is None:
                hdr = [nfc(str(c)) for c in row]
                bi = next((i for i, h in enumerate(hdr) if "분관" in h), -1)
                continue
            total += 1
            if bi >= 0 and bi < len(row) and row[bi]:
                branch[nfc(str(row[bi]))] += 1
        wb.close()
        out["books"] = {"total": total, "byBranch": branch.most_common(8)}

    with open(os.path.join(os.path.dirname(__file__), "public-portal.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    e = out.get("events", {}); k = out.get("keywords", {}); b = out.get("books", {})
    print("\n━━━ 공공데이터포털(군포 도서관) 집계 ━━━")
    print(f"  문화행사: {e.get('total',0)}건  연도 {e.get('byYear',{})}")
    print(f"    장소: {e.get('byVenue',[])[:4]}")
    print(f"  인기검색어({k.get('date','')}): " + ", ".join(f"{t['kw']}({t['count']})" for t in k.get('top', [])[:6]))
    print(f"  도서목록: {b.get('total',0):,}권  분관 {b.get('byBranch',[])[:4]}")
    print("\n  → public-portal.json 저장\n")


if __name__ == "__main__":
    main()

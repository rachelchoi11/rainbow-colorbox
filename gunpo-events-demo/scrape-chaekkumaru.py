#!/usr/bin/env python3
"""그림책꿈마루 프로그램 실시간 스크래퍼 (포스터 + 신청URL 포함).

  https://www.gunpo.go.kr/picturebook — 교육/행사 프로그램이 JS(AJAX)로 렌더.
  카드 구조: <li><a onclick="fn_getView(N)"><img src=".../api/images?atchFileNo=K"><div class=thumb_txt>제목/기간/장소/대상</div></a></li>
  → 제목·포스터이미지·신청URL(eduProgrmNo=N)·기간·장소·대상을 추출.

  공공데이터포털 API는 과거 스냅샷이라, 현재 데이터+포스터+신청링크는 이 스크래핑이 담당.

결과: chaekkumaru.json
실행: python3 scrape-chaekkumaru.py
"""
import json, re
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "https://www.gunpo.go.kr"
LISTS = [
    ("그림책 교육", "M000000141", "edu", f"{BASE}/picturebook/ko/M000000141/edu/progrm/list", "eduProgrmNo"),
    ("그림책 행사", "M000000143", "evnt", f"{BASE}/picturebook/ko/M000000143/evnt/progrm/list", "evntProgrmNo"),
]
UA = "Mozilla/5.0 (PitchBot PoC; +contact)"
STATUS = ("마감", "종료", "모집중", "접수중", "예정", "진행중", "상시")


def scrape_list(pg, label, menu, kind, url, param):
    pg.goto(url, wait_until="networkidle", timeout=25000)
    pg.wait_for_timeout(1800)
    cards = pg.evaluate(r"""() => {
      const out=[];
      document.querySelectorAll('.board_gallery li, #list > li').forEach(li=>{
        const a=li.querySelector('a'); if(!a) return;
        const oc=a.getAttribute('onclick')||'';
        const m=oc.match(/fn_getView\((\d+)\)/);
        const img=li.querySelector('img');
        const titleEl=li.querySelector('.thumb_txt_top span, .thumb_txt_top');
        const title=(titleEl?titleEl.textContent:(img?img.alt:'')||'').trim();
        if(!title) return;
        const infos=[...li.querySelectorAll('.thumb_info')].map(s=>s.textContent.trim());
        out.push({no: m?m[1]:null, poster: img?img.getAttribute('src'):null, title,
                  period:infos[0]||'', place:infos[1]||'', target:infos[2]||''});
      });
      return out;
    }""")
    items = []
    for c in cards:
        title = c["title"]
        status = "진행"
        lead = re.match(r"^<(" + "|".join(STATUS) + r")>\s*(.+)$", title)
        if lead:
            status, title = lead.group(1), lead.group(2).strip()
        dates = re.findall(r"\d{4}[.\-]\d{1,2}[.\-]\d{1,2}", c["period"])
        dates = [d.replace(".", "-") for d in dates]
        poster = c["poster"]
        if poster and poster.startswith("/"):
            poster = BASE + poster
        apply_url = f"{BASE}/picturebook/ko/{menu}/{kind}/progrm/view?{param}={c['no']}" if c["no"] else f"{BASE}/picturebook"
        items.append({
            "title": title, "status": status,
            "start": dates[0] if dates else "", "end": dates[1] if len(dates) > 1 else (dates[0] if dates else ""),
            "venue": c["place"], "target": c["target"],
            "category": "그림책 행사" if kind == "evnt" else "그림책 교육",
            "poster": poster, "applyUrl": apply_url,
        })
    print(f"  {label}: {len(items)}건 (포스터 {sum(1 for i in items if i['poster'])})")
    return items


def main():
    allitems = []
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(user_agent=UA)
        for label, menu, kind, url, param in LISTS:
            try:
                allitems += scrape_list(pg, label, menu, kind, url, param)
            except Exception as e:
                print(f"  {label} 실패: {e}")
        b.close()
    seen, uniq = set(), []
    for e in allitems:
        k = (e["title"], e["start"])
        if k not in seen:
            seen.add(k); uniq.append(e)
    out = {"source": "그림책꿈마루", "url": f"{BASE}/picturebook",
           "scrapedAt": datetime.now(timezone.utc).isoformat(),
           "count": len(uniq), "items": uniq}
    Path(__file__).with_name("chaekkumaru.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n  → chaekkumaru.json 저장 ({len(uniq)}건, 포스터+신청URL 포함)\n")


if __name__ == "__main__":
    main()

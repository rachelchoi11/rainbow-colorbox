#!/usr/bin/env node
/**
 * 그림책꿈마루(군포시 그림책 전문시설) 프로그램 실시간 스크래퍼.
 *   https://www.gunpo.go.kr/picturebook  — 교육/행사 프로그램이 JS(AJAX)로 렌더되므로
 *   헤드리스 브라우저(Playwright)로 렌더한 뒤 구조화 파싱한다.
 *
 * 결과: chaekkumaru.json  (fetch-events.mjs의 책꿈마루 소스가 이 파일을 읽음)
 * 실행: node scrape-chaekkumaru.mjs        (playwright-core + 설치된 Chromium 사용)
 *
 * ※ Node에 playwright가 없으면 동봉한 scrape-chaekkumaru.py(파이썬)로 대체 가능.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'https://www.gunpo.go.kr/picturebook';
const LISTS = [
  { label: '교육프로그램', url: `${BASE}/ko/M000000141/edu/progrm/list` },
  { label: '행사프로그램', url: `${BASE}/ko/M000000143/evnt/progrm/list` },
];
const UA = 'Mozilla/5.0 (PitchBot PoC; +contact)';

/** 렌더된 본문 텍스트 → 프로그램 레코드 배열 */
function parseBody(text, label) {
  const out = [];
  // "제목\n기간 : YYYY.MM.DD ~ YYYY.MM.DD\n장소 : ..\n대상 : .." 블록
  const re = /(?:^|\n)\s*(?:<(마감|종료|모집중|접수중|예정)>)?\s*([^\n]{4,60}?)\s*\n\s*기간\s*:\s*(\d{4}\.\d{1,2}\.\d{1,2})\s*~\s*(\d{4}\.\d{1,2}\.\d{1,2})\s*\n\s*장소\s*:\s*([^\n]+?)\s*\n\s*대상\s*:\s*([^\n]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const [, status, title, start, end, venue, target] = m;
    out.push({
      title: title.trim(),
      status: status || '진행',
      start: start.replace(/\./g, '-'),
      end: end.replace(/\./g, '-'),
      venue: venue.trim(),
      target: target.trim(),
      category: label === '행사프로그램' ? '그림책 행사' : '그림책 교육',
    });
  }
  return out;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ userAgent: UA });
  let all = [];
  for (const { label, url } of LISTS) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForTimeout(1800);
      const body = await page.evaluate(() => document.body.innerText);
      const recs = parseBody(body, label);
      console.log(`  ${label}: ${recs.length}건`);
      all.push(...recs);
    } catch (e) {
      console.log(`  ${label} 실패: ${e.message}`);
    }
  }
  await browser.close();

  // 중복 제거
  const seen = new Set();
  all = all.filter((e) => {
    const k = `${e.title}::${e.start}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const result = { source: '그림책꿈마루', url: BASE, scrapedAt: new Date().toISOString(), count: all.length, items: all };
  writeFileSync(new URL('./chaekkumaru.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log(`\n  → chaekkumaru.json 저장 (${all.length}건, 실제 스크래핑)\n`);
}

main().catch((e) => { console.error('스크래핑 실패:', e); process.exit(1); });

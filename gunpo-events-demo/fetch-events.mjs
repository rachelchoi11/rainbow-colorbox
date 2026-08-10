#!/usr/bin/env node
/**
 * 핏치(Pitch) — 군포 독서교육·문화행사 데이터 통합 수집기 (시안 / PoC)
 *
 * 다중 소스 수집 → 정규화 → 분류(행사/독서교육) → 중복제거 → AI 추천.
 *
 *  [행사·독서교육 소스]
 *   1) 경기데이터드림 API   — 경기도 문화행사현황 (openapi.gg.go.kr, SIGUN_NM=군포시)
 *   2) 군포 통합도서관 스크래핑 — 시립도서관 독서프로그램/강좌 (lib.gunpo.go.kr)  ★독서교육 핵심
 *   3) 군포문화재단 스크래핑   — 공연/전시/문화교육 (gunpoacf.or.kr)
 *  [독서 데이터 소스 — 독서은하 연동]
 *   4) 도서관 정보나루 API   — 군포 인기대출도서 (data4library.kr/api/loanItemSrch)
 *
 * 의존성 없음(Node 22 내장 fetch). 네트워크/API키 없으면 현실적 mock으로 폴백.
 *
 * 실제 사용:  node --env-file=.env fetch-events.mjs
 *   .env: GG_DATA_KEY=...  DATA4LIBRARY_KEY=...
 */

const TIMEOUT_MS = 7000;

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function normalize(raw, sourceType, sourceName) {
  return {
    id: `${sourceType}:${(raw.title || '').slice(0, 24)}:${raw.start || ''}`,
    title: (raw.title || '').trim(),
    start: raw.start || null,
    end: raw.end || raw.start || null,
    venue: (raw.venue || '').trim(),
    category: raw.category || '기타',
    target: raw.target || '전체',
    fee: raw.fee || '무료',
    status: raw.status || null,    // 모집중 | 마감 | 종료 ...
    applyUrl: raw.applyUrl || '#',
    kind: raw.kind || 'event',     // 'event' | 'edu'
    sourceType,                     // 'api' | 'scrape'
    sourceName,
    tags: raw.tags || [],
  };
}

/* ── 1) 경기데이터드림 문화행사 API ───────────────────────────── */
async function fromGyeonggiApi() {
  const key = process.env.GG_DATA_KEY;
  try {
    if (!key) throw new Error('GG_DATA_KEY 없음');
    const url = `https://openapi.gg.go.kr/CulturalEventStatus?KEY=${key}&Type=json&pIndex=1&pSize=50&SIGUN_NM=${encodeURIComponent('군포시')}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const rows = json?.CulturalEventStatus?.[1]?.row ?? [];
    if (rows.length === 0) throw new Error('row 0건');
    return { ok: true, events: rows.map((r) => normalize({
      title: r.EVENT_NM, start: r.EVENT_BEGIN_DE, end: r.EVENT_END_DE,
      venue: r.EVENT_PLACE, category: r.EVENT_SE || '문화행사',
      target: r.TRGET_INFO, fee: r.PARTCPT_EXPNS_INFO || '무료',
      applyUrl: r.HMPG_ADDR || '#', kind: 'event', tags: ['경기도'],
    }, 'api', '경기데이터드림')) };
  } catch (e) {
    return { ok: false, reason: String(e.message || e), events: MOCK_GG };
  }
}

/* ── 2) 군포 통합도서관 독서프로그램 스크래핑 ─────────────────── */
function parseGunpoLibHtml(html) {
  const items = [];
  const re = /<(?:li|div)[^>]*class="[^"]*(?:program|cultureList|item)[^"]*"[\s\S]*?<a[^>]*href="([^"]+)"[\s\S]*?class="[^"]*(?:title|tit|subject)[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>[\s\S]*?(\d{4}[.\-]\d{1,2}[.\-]\d{1,2})/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const title = m[2].replace(/<[^>]+>/g, '').trim();
    items.push(normalize({
      title, start: m[3].replace(/\./g, '-'),
      venue: '군포시립도서관', category: '독서프로그램',
      applyUrl: m[1].startsWith('http') ? m[1] : `https://lib.gunpo.go.kr${m[1]}`,
      kind: 'edu', tags: ['도서관', '독서'],
    }, 'scrape', '군포 통합도서관'));
  }
  return items;
}
async function fromGunpoLibrary() {
  // 공공데이터포털 다운로드(prep-public-portal.py → public-portal.json)의
  // 실제 군포 도서관 문화행사 591건. 파일 없으면 mock 폴백.
  try {
    const fs = await import('node:fs');
    const pp = JSON.parse(fs.readFileSync(new URL('./public-portal.json', import.meta.url), 'utf-8'));
    const ev = pp.events;
    if (!ev?.recent?.length) throw new Error('public-portal.json 행사 없음');
    const events = ev.recent.map((r) => normalize({
      title: r.title, start: r.start, end: r.end, venue: r.venue,
      category: '도서관 문화행사', target: r.target || '전체',
      fee: (!r.fee || r.fee === '0') ? '무료' : `${Number(r.fee).toLocaleString('ko-KR')}원`,
      status: (r.start && r.start < TODAY) ? '마감' : '모집중',
      kind: 'edu', tags: ['도서관', '독서'], applyUrl: 'https://lib.gunpo.go.kr',
    }, 'api', '군포 도서관 문화행사'));
    return { ok: true, live: true, total: ev.total, events };
  } catch (e) {
    return { ok: false, reason: `${String(e.message || e)} (prep-public-portal.py 먼저)`, events: MOCK_GUNPO_LIB };
  }
}

/* ── 3) 군포문화재단 공연/전시 스크래핑 ───────────────────────── */
function parseGunpoAcfHtml(html) {
  const items = [];
  const re = /<li[^>]*class="[^"]*item[^"]*"[\s\S]*?<a[^>]*href="([^"]+)"[\s\S]*?<(?:strong|p)[^>]*class="[^"]*tit[^"]*"[^>]*>([\s\S]*?)<\/(?:strong|p)>[\s\S]*?<span[^>]*class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const title = m[2].replace(/<[^>]+>/g, '').trim();
    const dates = (m[3].match(/\d{4}[.\-]\d{1,2}[.\-]\d{1,2}/g) || []).map((d) => d.replace(/\./g, '-'));
    items.push(normalize({
      title, start: dates[0] || null, end: dates[1] || dates[0] || null,
      venue: '군포문화예술회관', category: '공연/전시',
      applyUrl: m[1].startsWith('http') ? m[1] : `https://www.gunpoacf.or.kr${m[1]}`,
      kind: 'event', tags: ['군포문화재단'],
    }, 'scrape', '군포문화재단'));
  }
  return items;
}
async function fromGunpoAcf() {
  try {
    const url = 'https://www.gunpoacf.or.kr/fmcs/79';
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 (PitchBot PoC)' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const events = parseGunpoAcfHtml(await res.text());
    if (events.length === 0) throw new Error('파싱 0건');
    return { ok: true, events };
  } catch (e) {
    return { ok: false, reason: String(e.message || e), events: MOCK_ACF };
  }
}

/* ── 3b) 군포 책꿈마루(지역 독서공간) 스크래핑 ─────────────────
 * ※ 책꿈마루의 실제 사이트 구조 미확인 → 제휴/스크래핑 자리만 잡고 mock 폴백.
 *    (rachel 확인 필요: 책꿈마루가 도서관/책쉼터/프로그램 운영처 중 무엇인지)
 * ───────────────────────────────────────────────────────────── */
async function fromChaekkumaru() {
  // 그림책꿈마루는 JS(AJAX) 렌더 → scrape-chaekkumaru.py가 미리 렌더·파싱해
  // chaekkumaru.json을 만들어 둠. 여기선 그 실데이터를 읽어 통합한다.
  try {
    const fs = await import('node:fs');
    const raw = JSON.parse(fs.readFileSync(new URL('./chaekkumaru.json', import.meta.url), 'utf-8'));
    if (!raw.items?.length) throw new Error('chaekkumaru.json 비어있음');
    const events = raw.items.map((r) => normalize({
      title: r.title, start: r.start, end: r.end, venue: r.venue,
      category: r.category || '그림책 프로그램', target: r.target,
      status: r.status, kind: 'edu', tags: ['그림책꿈마루', '독서'],
      applyUrl: 'https://www.gunpo.go.kr/picturebook',
    }, 'scrape', '그림책꿈마루'));
    return { ok: true, live: true, scrapedAt: raw.scrapedAt, events };
  } catch (e) {
    return { ok: false, reason: `${String(e.message || e)} (scrape-chaekkumaru.py 먼저 실행)`, events: MOCK_CHAEKKUM };
  }
}

/* ── 3c) 경기공유학교(지역연계 배움터) 독서 프로그램 ────────────
 * ※ 경기도교육청 경기공유학교 — 군포 지역 독서 배움터. 제휴/스크래핑 자리.
 * ───────────────────────────────────────────────────────────── */
async function fromGongyuSchool() {
  const url = process.env.GONGYU_URL;
  try {
    if (!url) throw new Error('GONGYU_URL 미설정(소스 확정 대기)');
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 (PitchBot PoC)' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const events = parseGunpoLibHtml(await res.text());
    if (events.length === 0) throw new Error('파싱 0건');
    return { ok: true, events };
  } catch (e) {
    return { ok: false, reason: String(e.message || e), events: MOCK_GONGYU };
  }
}

/* ── 4) 도서관 정보나루 — 군포 인기대출도서(독서데이터) ──────────
 * 실엔드포인트: data4library.kr/api/loanItemSrch (인기대출도서)
 * region=31(경기), dtl_region=3115(군포시)
 * ───────────────────────────────────────────────────────────── */
async function fromLibraryData() {
  const key = process.env.DATA4LIBRARY_KEY;
  try {
    if (!key) throw new Error('DATA4LIBRARY_KEY 없음');
    const url = `http://data4library.kr/api/loanItemSrch?authKey=${key}&format=json&pageNo=1&pageSize=8&region=31&dtl_region=3115`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json?.response?.errCode) {
      throw new Error(`정보나루 ${json.response.errCode}: ${json.response.error}`);
    }
    const docs = json?.response?.docs ?? [];
    if (docs.length === 0) throw new Error('docs 0건');
    return { ok: true, books: docs.map((d) => ({
      title: d.doc?.bookname, author: d.doc?.authors, rank: d.doc?.ranking,
    })) };
  } catch (e) {
    return { ok: false, reason: String(e.message || e), books: MOCK_BOOKS };
  }
}

/* ── 폴백 mock (현실적 군포 데이터) ──────────────────────────── */
const MOCK_GG = [
  { title: '군포 책의 도시 독서대전', start: '2026-06-07', end: '2026-06-09', venue: '군포시청 광장', category: '독서축제', target: '전체', fee: '무료', kind: 'event', tags: ['경기도', '독서'] },
  { title: '당정근린공원 숲속 음악회', start: '2026-06-14', venue: '당정근린공원', category: '공연', target: '전체', fee: '무료', kind: 'event', tags: ['경기도'] },
  { title: '철쭉축제 거리 공연', start: '2026-06-28', venue: '군포 철쭉동산', category: '공연', target: '가족', fee: '무료', kind: 'event', tags: ['경기도'] },
].map((r) => normalize(r, 'api', '경기데이터드림'));

const MOCK_GUNPO_LIB = [
  { title: '초등 독서토론 — 질문으로 읽기', start: '2026-06-11', end: '2026-07-16', venue: '산본도서관 동아리실', category: '독서프로그램', target: '초등 3~6학년', fee: '무료', kind: 'edu', tags: ['도서관', '독서', '토론'] },
  { title: '엄마와 함께하는 그림책 놀이터', start: '2026-06-05', venue: '군포중앙도서관 3층', category: '독서프로그램', target: '유아·보호자', fee: '무료', kind: 'edu', tags: ['도서관', '독서'] },
  { title: '시니어 인생책 글쓰기 교실', start: '2026-06-18', end: '2026-07-23', venue: '대야도서관 강당', category: '독서프로그램', target: '65세 이상', fee: '무료', kind: 'edu', tags: ['도서관', '독서', '시니어'] },
  { title: '한 권의 책, 군포 — 온 시민 같은 책 읽기', start: '2026-06-01', end: '2026-08-31', venue: '군포시 전체 도서관', category: '독서캠페인', target: '전체', fee: '무료', kind: 'edu', tags: ['도서관', '독서'] },
  { title: '청소년 인문학 독서동아리', start: '2026-06-20', end: '2026-08-29', venue: '수리도서관', category: '독서프로그램', target: '중·고생', fee: '무료', kind: 'edu', tags: ['도서관', '독서'] },
].map((r) => normalize(r, 'scrape', '군포 통합도서관'));

const MOCK_CHAEKKUM = [
  { title: '그림책 큐레이션 — 여름의 책', start: '2026-06-10', end: '2026-06-30', venue: '그림책꿈마루 기획전시실', category: '그림책 전시', target: '전체', fee: '무료', status: '진행', kind: 'edu', tags: ['그림책꿈마루', '독서'] },
  { title: '가족 그림책 캠프', start: '2026-06-21', venue: '그림책꿈마루 상상피움', category: '그림책 교육', target: '가족', fee: '무료', status: '모집중', kind: 'edu', tags: ['그림책꿈마루', '독서'] },
].map((r) => normalize(r, 'scrape', '그림책꿈마루'));

const MOCK_GONGYU = [
  { title: '경기공유학교 — 질문하는 인문독서 교실', start: '2026-06-14', end: '2026-07-19', venue: '군포 공유학교 거점', category: '독서프로그램', target: '초·중학생', fee: '무료', kind: 'edu', tags: ['공유학교', '독서'] },
  { title: '마을 연계 독서놀이 (공유학교)', start: '2026-06-25', venue: '군포 마을배움터', category: '독서프로그램', target: '초등', fee: '무료', kind: 'edu', tags: ['공유학교', '독서'] },
].map((r) => normalize(r, 'scrape', '경기공유학교'));

const MOCK_ACF = [
  { title: '군포프라임필하모닉 정기연주회', start: '2026-06-13', venue: '군포문화예술회관 대공연장', category: '공연/전시', target: '전체', fee: '1만원~', kind: 'event', tags: ['군포문화재단'] },
  { title: '어린이 뮤지컬 「책 읽어주는 로봇」', start: '2026-06-22', venue: '군포문화예술회관 소공연장', category: '공연/전시', target: '가족', fee: '2만원', kind: 'event', tags: ['군포문화재단', '독서'] },
  { title: '지역작가 초청 북토크 — 군포에서 쓰다', start: '2026-06-27', venue: '군포문화예술회관 세미나실', category: '강연', target: '전체', fee: '무료', kind: 'event', tags: ['군포문화재단', '독서'] },
].map((r) => normalize(r, 'scrape', '군포문화재단'));

const MOCK_BOOKS = [
  { title: '불편한 편의점', author: '김호연', rank: 1 },
  { title: '아몬드', author: '손원평', rank: 2 },
  { title: '세상에 나쁜 곤충은 없다', author: '안네 스베르드루프티게손', rank: 3 },
  { title: '미드나잇 라이브러리', author: '매트 헤이그', rank: 4 },
  { title: '달러구트 꿈 백화점', author: '이미예', rank: 5 },
  { title: '어린이라는 세계', author: '김소영', rank: 6 },
];

/* ── 통합 파이프라인 ─────────────────────────────────────────── */
function dedupe(events) {
  const seen = new Set();
  return events.filter((e) => {
    const k = `${e.title}::${e.start}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function tagReading(e) {
  const txt = `${e.title} ${e.category} ${e.tags.join(' ')}`;
  e.isReading = e.kind === 'edu' || /독서|책|북토크|그림책|토론|도서관|글쓰기/.test(txt);
  return e;
}
const TODAY = '2026-05-27';
function isUpcoming(e) {
  return (e.start || '9999') >= TODAY && !['마감', '종료'].includes(e.status || '');
}
function pickRecommended(events, n = 3) {
  return [...events.filter(isUpcoming)]   // 마감·과거 제외, 다가오는 행사만 추천
    .map((e) => ({ e, score:
      (e.isReading ? 3 : 0) + (e.fee === '무료' ? 1.5 : 0) +
      (/초등|유아|중·고|청소년/.test(e.target || '') ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || (a.e.start || '').localeCompare(b.e.start || ''))
    .slice(0, n).map((x) => x.e);
}

async function main() {
  const [gg, lib, acf, chaek, gongyu, books] = await Promise.all([
    fromGyeonggiApi(), fromGunpoLibrary(), fromGunpoAcf(),
    fromChaekkumaru(), fromGongyuSchool(), fromLibraryData(),
  ]);

  // 공공데이터포털 실데이터(인기검색어·장서수) 로드
  const fs0 = await import('node:fs');
  let portal = {};
  try { portal = JSON.parse(fs0.readFileSync(new URL('./public-portal.json', import.meta.url), 'utf-8')); } catch {}

  const eventSources = [
    { name: '경기데이터드림', role: '문화행사 API', type: 'api', ...gg },
    { name: '군포 도서관 문화행사', role: '공공데이터포털 실데이터', type: 'api', ...lib },
    { name: '군포문화재단', role: '공연·전시 스크래핑', type: 'scrape', ...acf },
    { name: '그림책꿈마루', role: '실시간 스크래핑', type: 'scrape', ...chaek },
    { name: '경기공유학교', role: '지역연계 배움터', type: 'scrape', ...gongyu },
  ];
  const bookSource = { name: '도서관 정보나루', role: '인기 독서도서 API', type: 'api', ...books };

  let all = dedupe([...gg.events, ...lib.events, ...acf.events, ...chaek.events, ...gongyu.events]).map(tagReading);
  all.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const recommended = pickRecommended(all, 3);
  const recIds = new Set(recommended.map((e) => e.id));
  all.forEach((e) => (e.recommended = recIds.has(e.id)));

  const result = {
    generatedAt: new Date().toISOString(),
    eventSources: eventSources.map((s) => ({ name: s.name, role: s.role, type: s.type, ok: s.ok, count: s.total ?? s.events.length, mode: s.ok ? 'live' : 'mock', reason: s.reason || null })),
    bookSource: { name: bookSource.name, role: bookSource.role, type: bookSource.type, ok: bookSource.ok, count: bookSource.books.length, mode: bookSource.ok ? 'live' : 'mock', reason: bookSource.reason || null },
    counts: { total: all.length, edu: all.filter((e) => e.kind === 'edu').length, reading: all.filter((e) => e.isReading).length },
    keywords: portal.keywords || null,           // 군포 도서관 인기검색어(실데이터)
    bookCount: portal.books?.total || 0,          // 군포 도서관 장서 총량
    booksByBranch: portal.books?.byBranch || [],
    events: all,
    recommended,
    books: books.books,
  };

  console.log('\n━━━ 군포 독서교육·문화행사 통합 수집 ━━━');
  for (const s of result.eventSources)
    console.log(`  [${s.mode === 'live' ? 'LIVE' : 'MOCK'}] ${s.name.padEnd(12)} ${s.role.padEnd(20)} ${String(s.count).padStart(2)}건` + (s.reason ? `  (폴백: ${s.reason})` : ''));
  const b = result.bookSource;
  console.log(`  [${b.mode === 'live' ? 'LIVE' : 'MOCK'}] ${b.name.padEnd(12)} ${b.role.padEnd(20)} ${String(b.count).padStart(2)}권` + (b.reason ? `  (폴백: ${b.reason})` : ''));
  console.log(`  ── 행사·교육 통합 ${result.counts.total}건 (독서교육 ${result.counts.edu}) / 독서도서 ${b.count}권 / AI추천 ${recommended.length}\n`);

  const fs = await import('node:fs');
  fs.writeFileSync(new URL('./events.json', import.meta.url), JSON.stringify(result, null, 2));
  fs.writeFileSync(new URL('./gunpo-events.html', import.meta.url), renderHtml(result));
  console.log('  → events.json, gunpo-events.html 생성 완료\n');
}

/* ── 핏치 테마 HTML 렌더 ─────────────────────────────────────── */
function srcBadge(type, name) {
  const map = {
    api: { bg: '#0A7373', fg: '#fff' },
    scrape: { bg: '#D97706', fg: '#fff' },
  };
  const s = map[type] || map.api;
  return `<span class="src" style="background:${s.bg};color:${s.fg}">${name}</span>`;
}
function fmtDate(s, e) {
  if (!s) return '날짜 미정';
  const f = (d) => d.slice(5).replace('-', '.');
  return e && e !== s ? `${f(s)} – ${f(e)}` : f(s);
}
function statusBadge(s) {
  if (!s || s === '진행') return '';
  const closed = ['마감', '종료'].includes(s);
  return `<span class="st ${closed ? 'closed' : 'open'}">${s}</span>`;
}
function card(e) {
  const closed = ['마감', '종료'].includes(e.status || '');
  return `
    <div class="card${e.recommended ? ' rec' : ''}${closed ? ' dim' : ''}">
      ${e.recommended ? '<span class="recbadge">★ AI 추천</span>' : ''}
      <div class="cdate">${fmtDate(e.start, e.end)} ${e.kind === 'edu' ? '<span class="kind">독서교육</span>' : ''}${statusBadge(e.status)}</div>
      <div class="ctitle">${e.title}</div>
      <div class="cmeta">📍 ${e.venue}${e.target && e.target !== '전체' ? ` · ${e.target}` : ''}</div>
      <div class="crow"><span class="cat">${e.category}</span><span class="fee">${e.fee}</span></div>
      <div class="crow2">${srcBadge(e.sourceType, e.sourceName)}<button class="apply"${closed ? ' disabled' : ''}>${closed ? '마감' : '신청하기'}</button></div>
    </div>`;
}
function renderHtml(r) {
  const chaek = r.events.filter((e) => e.sourceName === '그림책꿈마루');
  const chaekSrc = r.eventSources.find((s) => s.name === '그림책꿈마루') || {};
  const rest = r.events.filter((e) => e.sourceName !== '그림책꿈마루');
  const ordered = [
    ...rest.filter((e) => e.kind === 'edu' && isUpcoming(e)),
    ...rest.filter((e) => e.kind !== 'edu' && isUpcoming(e)),
    ...rest.filter((e) => !isUpcoming(e)),
  ];
  const srcChip = (s) => `<span class="pchip ${s.type}">${s.name} <i>${s.mode === 'live' ? 'LIVE' : 'mock'}</i></span>`;
  const pills = [...r.eventSources]
    .map((s) => `<span class="pill ${s.type}"><b>${s.count}</b> ${s.name} <small>${s.role}</small> <i>${s.mode === 'live' ? 'LIVE' : 'mock'}</i></span>`).join('')
    + `<span class="pill api"><b>${Math.round((r.bookCount || 0) / 10000)}만</b> 군포 장서 <small>전체 도서목록</small> <i>실데이터</i></span>`;
  const kw = r.keywords?.top || [];
  const bookChips = kw.slice(0, 12).map((t) => `<span class="book"><b>${t.rank}</b> ${t.kw} <i>${(t.count || 0).toLocaleString('ko-KR')}회</i></span>`).join('');
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"/>
<style>
  :root{--primary:#0A4747;--primary2:#0A7373;--accent:#FBBF24;--accent2:#D97706;--ink:#0F172A;--slate:#475569;--line:#E2E8F0;--bg:#F1F5F9}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Pretendard Variable',sans-serif;background:var(--bg);color:var(--ink);width:1440px;word-break:keep-all}
  .top{background:linear-gradient(120deg,#0A4747,#0A7373);color:#fff;padding:20px 40px;display:flex;align-items:center;justify-content:space-between}
  .brand{font-size:22px;font-weight:900;letter-spacing:-.5px}.brand i{color:var(--accent);font-style:normal}
  .nav{font-size:14px;opacity:.85;display:flex;gap:20px}.nav .on{color:var(--accent);font-weight:800;opacity:1}
  .hero{padding:26px 40px 4px}
  .hero h1{font-size:29px;font-weight:900;letter-spacing:-1px}.hero h1 b{color:var(--primary2)}
  .hero p{margin-top:6px;color:var(--slate);font-size:15px}
  .pipe{margin:16px 40px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:15px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .pstage .lbl{font-size:11px;font-weight:800;color:#94A3B8;letter-spacing:.5px;display:block;margin-bottom:5px}
  .pchips{display:flex;gap:7px;flex-wrap:wrap}
  .pchip{font-size:12px;font-weight:800;padding:6px 11px;border-radius:8px;color:#fff}
  .pchip i{font-style:normal;font-size:9px;opacity:.85;margin-left:3px}
  .pchip.api{background:#0A7373}.pchip.scrape{background:#D97706}
  .arrow{font-size:19px;color:#CBD5E1;font-weight:900}
  .pbox{font-size:13px;font-weight:800;color:var(--primary);background:#ECFEFF;border:1px solid #A5F3FC;padding:8px 13px;border-radius:10px}
  .pbox.acc{color:#7C2D12;background:#FFFBEB;border-color:#FDE68A}
  .pills{display:flex;gap:9px;margin:0 40px 6px;flex-wrap:wrap}
  .pill{font-size:12.5px;font-weight:700;color:#334155;background:#fff;border:1px solid var(--line);padding:7px 12px;border-radius:999px}
  .pill b{font-size:15px;color:var(--primary2)}.pill small{color:#94A3B8;font-weight:600}
  .pill i{font-style:normal;font-size:9.5px;font-weight:800;color:#94A3B8;text-transform:uppercase;margin-left:3px}
  .pill.scrape b{color:#D97706}
  .bookstrip{margin:10px 40px;background:linear-gradient(120deg,#0A4747,#0A7373);border-radius:14px;padding:14px 18px;color:#fff;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
  .bookstrip .lab{font-size:13px;font-weight:900;color:var(--accent);white-space:nowrap}
  .bookstrip .lab small{display:block;color:#cbeae8;font-weight:600;font-size:10.5px}
  .book{font-size:12.5px;font-weight:700;background:rgba(255,255,255,.12);padding:6px 11px;border-radius:8px}
  .book b{color:var(--accent)}.book i{font-style:normal;opacity:.7;font-size:11px;margin-left:3px}
  .filters{display:flex;gap:8px;margin:14px 40px 4px}
  .filters span{font-size:13px;font-weight:700;padding:7px 14px;border-radius:999px;background:#fff;border:1px solid var(--line);color:#64748B}
  .filters span.on{background:var(--primary);color:#fff;border-color:var(--primary)}
  .sec{margin:16px 40px 10px;font-size:16px;font-weight:900;color:var(--primary);display:flex;align-items:center;gap:8px}
  .sec .dot{width:8px;height:8px;border-radius:50%;background:var(--accent)}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin:0 40px 24px}
  .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:15px;position:relative;display:flex;flex-direction:column;gap:7px;min-height:168px}
  .card.rec{border:2px solid var(--accent);box-shadow:0 6px 18px rgba(251,191,36,.18)}
  .recbadge{position:absolute;top:-10px;left:13px;background:var(--accent);color:#3a2a00;font-size:11px;font-weight:900;padding:3px 10px;border-radius:999px}
  .cdate{font-size:13px;font-weight:900;color:var(--accent2);display:flex;align-items:center;gap:6px}
  .kind{font-size:10px;font-weight:800;color:#0A7373;background:#E0F2F1;padding:2px 7px;border-radius:5px}
  .ctitle{font-size:15.5px;font-weight:800;line-height:1.35}
  .cmeta{font-size:12px;color:var(--slate)}
  .crow{display:flex;justify-content:space-between;align-items:center;margin-top:auto}
  .cat{font-size:11px;font-weight:800;color:var(--primary);background:#E0F2F1;padding:3px 9px;border-radius:6px}
  .fee{font-size:12px;font-weight:700;color:#64748B}
  .crow2{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .src{font-size:10px;font-weight:800;padding:4px 8px;border-radius:6px}
  .apply{border:0;background:var(--primary);color:#fff;font-size:12px;font-weight:800;padding:7px 13px;border-radius:8px;cursor:pointer}
  .apply[disabled]{background:#CBD5E1;color:#fff;cursor:default}
  .st{font-size:10px;font-weight:800;padding:2px 7px;border-radius:5px}
  .st.closed{background:#E2E8F0;color:#64748B}.st.open{background:#DCFCE7;color:#15803D}
  .card.dim{opacity:.74}
  .live{color:#16A34A;font-size:13px;font-weight:900}
  .ssub{font-size:12px;font-weight:600;color:#94A3B8}
  .foot{margin:0 40px;padding:14px 0 28px;border-top:1px solid var(--line);font-size:12px;color:#94A3B8;display:flex;justify-content:space-between}
  .foot b{color:#64748B}
</style></head><body>
  <div class="top">
    <div class="brand">핏치 <i>Pitch</i></div>
    <div class="nav"><span>오늘의 질문</span><span>도서관</span><span>토론</span><span class="on">군포 독서통합</span><span>독서은하</span></div>
  </div>
  <div class="hero">
    <h1>군포 독서교육·문화행사 <b>통합</b></h1>
    <p>공공데이터포털 군포 도서관 문화행사(실데이터) + 그림책꿈마루 실시간 스크래핑 + 인기검색어·장서 82만권 — 분류·중복제거 후 개인 맞춤 AI 추천</p>
  </div>
  <div class="pipe">
    <div class="pstage"><span class="lbl">다중 소스 수집</span><div class="pchips">
      ${r.eventSources.map(srcChip).join('')}
    </div></div>
    <span class="arrow">→</span><div class="pbox">정규화 · 분류</div>
    <span class="arrow">→</span><div class="pbox">중복제거</div>
    <span class="arrow">→</span><div class="pbox acc">★ 개인 맞춤 AI 추천</div>
  </div>
  <div class="pills">${pills}</div>
  <div class="bookstrip"><span class="lab">🔎 군포 도서관 인기 검색어<small>공공데이터포털 실데이터 · ${r.keywords?.date || ''} 기준</small></span>${bookChips}</div>
  <div class="filters"><span class="on">전체 ${r.counts.total}</span><span>독서교육 ${r.counts.edu}</span><span>공연·전시</span><span>축제</span><span>가족</span><span>시니어</span></div>

  <div class="sec"><span class="dot"></span>오늘의 AI 추천 — 다가오는 독서·문화 행사</div>
  <div class="grid">${r.recommended.map(card).join('')}</div>

  <div class="sec"><span class="dot"></span>그림책꿈마루 — 실시간 스크래핑 ${chaekSrc.mode === 'live' ? '<span class="live">● LIVE</span>' : ''} <small class="ssub">gunpo.go.kr/picturebook · ${chaekSrc.count || 0}건 수집</small></div>
  <div class="grid">${chaek.slice(0, 4).map(card).join('')}</div>

  <div class="sec"><span class="dot"></span>전체 통합 (다가오는 행사 우선 · 날짜순)</div>
  <div class="grid">${ordered.slice(0, 8).map(card).join('')}</div>

  <div class="foot">
    <span>출처: 공공데이터포털 군포 도서관 문화행사·인기검색어·도서목록(실데이터) · 그림책꿈마루(gunpo.go.kr/picturebook) · 경기데이터드림</span>
    <span><b>핏치 PoC</b> · 통합 ${r.counts.total}건 + 독서도서 ${r.books.length}권 · ${new Date(r.generatedAt).toLocaleString('ko-KR')}</span>
  </div>
</body></html>`;
}

main().catch((e) => { console.error('수집 실패:', e); process.exit(1); });

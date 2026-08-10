#!/usr/bin/env node
/**
 * 공공데이터포털(data.go.kr) 범용 어댑터 — 승인된 API "전부" 동일 코드로 호출.
 *
 * data.go.kr 활용신청 API는 대부분 두 형태 중 하나이고, 둘 다 같은 serviceKey를 쓴다:
 *   (A) 표준 오픈API(odcloud)  https://api.odcloud.kr/api/.../v1/uddi:...   → { data:[...], totalCount }
 *   (B) 구형 오픈API           http://apis.data.go.kr/{org}/{svc}/{op}      → { response:{ body:{ items:{ item:[...] }}}}
 *
 * 그래서 "API마다 다른 건 URL(엔드포인트/UDDI) 하나뿐". 아래 ENDPOINTS에 URL만 추가하면 끝.
 *
 * 실행: node --env-file=.env datago.mjs                 # ENDPOINTS 전부 호출
 *       node --env-file=.env datago.mjs "<요청주소>"     # URL 하나만 테스트
 *
 * .env: DATA_GO_KR_KEY=...   (data.go.kr 마이페이지의 일반 인증키)
 */
const KEY = process.env.DATA_GO_KR_KEY;

/** 승인된 군포 API의 namespace 번호만 적으면 OAS(Swagger) 문서에서 최신 UDDI를 자동 해석해 호출.
 *  namespace는 각 API 상세의 Swagger URL에 들어있음:
 *    https://infuser.odcloud.kr/oas/docs?namespace=15070278/v1  → 15070278
 *  (URL을 직접 알면 ENDPOINTS에 {name,url}로 넣어도 됨) */
const NAMESPACES = [
  '15070278',  // 경기도 군포시_도서관 문화행사 (591건)
  '15062866',  // 경기도 군포시_추천도서 (156건)
  '15139151',  // (자동 해석)
  '15154906',  // (자동 해석)
  '15123369',  // (자동 해석)
  // 나머지 승인 API의 namespace 번호를 여기에 한 줄씩 추가하면 끝.
];
const ENDPOINTS = [
  // { name: '직접 URL', url: 'https://api.odcloud.kr/api/.../v1/uddi:....' },
];

/** namespace → OAS 문서에서 최신(날짜 큰) UDDI 경로 자동 해석 */
async function resolveNamespace(ns) {
  const oas = await (await fetch(`https://infuser.odcloud.kr/oas/docs?namespace=${ns}/v1`)).json();
  const rows = Object.keys(oas.paths || {}).map((p) => ({
    p, sum: oas.paths[p].get?.summary || '',
    date: (oas.paths[p].get?.summary || '').match(/\d{8}/)?.[0] || '',
  }));
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const latest = rows[rows.length - 1];
  return { title: oas.info?.title || ns, url: `https://api.odcloud.kr/api${latest.p}`, summary: latest.sum, versions: rows.length };
}

const TIMEOUT_MS = 10000;
async function fetchJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* XML 등 */ }
    return { status: res.status, ct: res.headers.get('content-type') || '', json, text };
  } finally { clearTimeout(t); }
}

/** serviceKey + 페이지 파라미터 주입 (이미 들어있으면 보존) */
function withParams(url, { page = 1, perPage = 100 } = {}) {
  const u = new URL(url);
  if (!u.searchParams.has('serviceKey') && !u.searchParams.has('ServiceKey')) {
    u.searchParams.set('serviceKey', KEY);
  }
  // odcloud는 page/perPage, 구형은 pageNo/numOfRows — 둘 다 세팅(서버가 무시)
  if (!u.searchParams.has('page')) u.searchParams.set('page', page);
  if (!u.searchParams.has('perPage')) u.searchParams.set('perPage', perPage);
  if (!u.searchParams.has('pageNo')) u.searchParams.set('pageNo', page);
  if (!u.searchParams.has('numOfRows')) u.searchParams.set('numOfRows', perPage);
  if (!u.searchParams.has('type') && !u.searchParams.has('_type')) u.searchParams.set('type', 'json');
  return u.toString();
}

/** 두 응답 형태를 공통 배열로 정규화 */
function extractRows(json) {
  if (!json) return null;
  if (Array.isArray(json.data)) return json.data;                       // (A) odcloud
  const item = json?.response?.body?.items?.item;                       // (B) 구형
  if (Array.isArray(item)) return item;
  if (item && typeof item === 'object') return [item];
  if (Array.isArray(json?.response?.body?.items)) return json.response.body.items;
  return null;
}

async function pull(name, url) {
  if (!KEY) return { name, ok: false, reason: 'DATA_GO_KR_KEY 없음' };
  try {
    const r = await fetchJson(withParams(url, { perPage: 1000 }));  // 전체 수집
    if (r.status !== 200) throw new Error(`HTTP ${r.status} ${r.text.slice(0, 120)}`);
    const rows = extractRows(r.json);
    if (rows == null) throw new Error(`형태 미인식: ${r.ct} ${r.text.slice(0, 120)}`);
    const total = r.json.totalCount ?? r.json?.response?.body?.totalCount ?? rows.length;
    return { name, ok: true, total, rows, sampleKeys: Object.keys(rows[0] || {}) };
  } catch (e) {
    return { name, ok: false, reason: String(e.message || e) };
  }
}

async function main() {
  const arg = process.argv[2];
  let targets = [];
  if (arg) {
    // 인자가 숫자면 namespace, 아니면 URL
    if (/^\d+$/.test(arg)) targets.push({ ns: arg });
    else targets.push({ name: 'test', url: arg });
  } else {
    targets = [...NAMESPACES.map((ns) => ({ ns })), ...ENDPOINTS];
  }
  if (targets.length === 0) {
    console.log('NAMESPACES 또는 ENDPOINTS를 채우거나, namespace/URL을 인자로 주세요.');
    console.log('예: node --env-file=.env datago.mjs 15070278');
    return;
  }
  const collected = {};
  for (const t of targets) {
    let name = t.name, url = t.url, title = t.name, ns = t.ns || null;
    if (t.ns) {
      try {
        const meta = await resolveNamespace(t.ns);
        title = meta.title; name = `${meta.title} [ns ${t.ns}]`; url = meta.url;
        console.log(`· ${name}  (버전 ${meta.versions}개, 최신: ${meta.summary})`);
      } catch (e) { console.log(`✗ ns ${t.ns}: OAS 해석 실패 ${e.message}`); continue; }
    }
    const r = await pull(name, url);
    if (r.ok) {
      console.log(`✓ ${r.name}: ${r.total}건  필드=[${r.sampleKeys.slice(0, 8).join(', ')}]`);
      console.log('  샘플:', JSON.stringify(r.rows[0]).slice(0, 180));
      collected[ns || title] = { title, ns, url, total: r.total, rows: r.rows };
    } else {
      console.log(`✗ ${r.name}: ${r.reason}`);
    }
  }
  // 인자 없이 NAMESPACES 전체 돌릴 때만 datago.json으로 저장 (데모가 소비)
  if (!arg && Object.keys(collected).length) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(new URL('./datago.json', import.meta.url),
      JSON.stringify({ fetchedAt: new Date().toISOString(), datasets: collected }, null, 2));
    console.log(`\n  → datago.json 저장 (${Object.keys(collected).length}개 데이터셋 LIVE)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

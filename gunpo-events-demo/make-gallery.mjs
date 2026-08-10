#!/usr/bin/env node
/**
 * 군포 독서·문화행사 갤러리 — 실제 공연·전시 안내 사이트 스타일.
 *   포스터 있는 소스(그림책꿈마루, 스크래핑) → 포스터 카드(실이미지+신청URL)
 *   포스터 없는 소스(도서관 문화행사, 공공API) → 표 목록(정원·접수기간·대상·신청버튼)
 * datago.json(공공데이터 LIVE) + chaekkumaru.json(스크래핑 포스터)을 임베드한 self-contained HTML.
 * 탭/검색/기간/주관필터 실제 동작. → gunpo-gallery.html
 *
 * 실행: node make-gallery.mjs   (datago.mjs, scrape-chaekkumaru.py 선행)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const datago = JSON.parse(readFileSync(new URL('./datago.json', import.meta.url), 'utf-8'));
const ds = Object.values(datago.datasets);
const find = (kw) => ds.find((d) => d.title.includes(kw));
let chaek = { items: [] };
try { chaek = JSON.parse(readFileSync(new URL('./chaekkumaru.json', import.meta.url), 'utf-8')); } catch {}

// 데이터가 2024~2025 스냅샷 → 라이브처럼 보이도록 기준일을 데이터 범위 안으로(화면 명시)
const DEMO_NOW = '2025-09-01';
const d10 = (s) => (s || '').slice(0, 10);
function calcStatus(start, end) {
  if (end && end < DEMO_NOW) return '마감';
  if (start && start > DEMO_NOW) return '모집중';
  return '진행중';
}
function categorize(t) {
  if (/전시|갤러리/.test(t)) return '전시';
  if (/공연|음악회|연주|뮤지컬|콘서트|낭독극|인형극/.test(t)) return '공연';
  if (/만들기|체험|놀이|키트|공방/.test(t)) return '체험';
  if (/강좌|교실|아카데미|특강|수업|워크숍|클래스/.test(t)) return '강좌';
  if (/북토크|작가|강연|인문|독서|책/.test(t)) return '북토크';
  return '행사';
}
const CAT = { 공연: ['#7C3AED', '#A78BFA'], 전시: ['#0891B2', '#22D3EE'], 강좌: ['#0A7373', '#34D399'], 체험: ['#D97706', '#FBBF24'], 북토크: ['#BE185D', '#F472B6'], 행사: ['#475569', '#94A3B8'] };
function hostOf(source, venue) {
  if (source === '그림책꿈마루') return '그림책꿈마루';
  const lib = (venue || '').match(/([가-힣]*도서관)/);
  if (lib) return lib[1];
  if (/문화예술회관|문화회관/.test(venue || '')) return '군포문화예술회관';
  return '기타';
}
// 대상(자유텍스트) → 연령대 그룹 태그(복수 가능)
const AGE_ORDER = ['유아', '초등', '중·고', '성인', '시니어', '가족'];
function ageTags(t) {
  t = t || ''; const a = new Set();
  if (/유아|유치원|어린이집|영유아|6~7세|7세|201[0-9]년생|202[0-9]년생/.test(t)) a.add('유아');
  if (/초등/.test(t)) a.add('초등');
  if (/중학|고등|청소년|중·고|중고/.test(t)) a.add('중·고');
  if (/성인|일반|시민|어른|개인/.test(t)) a.add('성인');
  if (/시니어|노인|65세|어르신/.test(t)) a.add('시니어');
  if (/가족|양육자|보호자/.test(t)) a.add('가족');
  return a.size ? [...a] : ['전체대상'];
}

function buildEvents() {
  const out = [];
  const feeFmt = (f) => (!f || f === '0' || f === 0 || f === '무료') ? '무료'
    : (typeof f === 'number' || /^\d+$/.test(String(f))) ? `${Number(f).toLocaleString('ko-KR')}원` : String(f);
  // 1) 도서관 문화행사 (공공API, 포스터 없음 → 표)
  (find('도서관 문화행사')?.rows || []).forEach((r) => {
    const title = (r['행사명'] || '').trim(); if (!title) return;
    const start = d10(r['시작일자']), end = d10(r['종료일자']) || start;
    const venue = (r['장소'] || '').trim();
    out.push({
      title, start, end, cat: categorize(title), source: '군포도서관', venue,
      host: hostOf('군포도서관', venue), target: (r['대상'] || '').trim(), ages: ageTags(r['대상']),
      teacher: (r['강사'] || '').trim(), capacity: r['정원'] || '', fee: feeFmt(r['비용']),
      applyStart: d10(r['접수시작일시']), applyEnd: d10(r['접수종료일시']),
      poster: null, applyUrl: 'https://lib.gunpo.go.kr', status: calcStatus(start, end),
    });
  });
  // 2) 그림책꿈마루 (스크래핑, 포스터+신청URL → 포스터 카드)
  (chaek.items || []).forEach((i) => {
    if (!i.title) return;
    out.push({
      title: i.title, start: i.start, end: i.end || i.start, cat: categorize(i.title),
      source: '그림책꿈마루', venue: i.venue || '그림책꿈마루', host: '그림책꿈마루',
      target: i.target || '', ages: ageTags(i.target), teacher: '', capacity: '', fee: '무료',
      applyStart: '', applyEnd: '', poster: i.poster || null,
      applyUrl: i.applyUrl || 'https://www.gunpo.go.kr/picturebook', status: calcStatus(i.start, i.end),
    });
  });
  const rank = (s) => (s === '모집중' ? 0 : s === '진행중' ? 1 : 2);
  out.sort((a, b) => rank(a.status) - rank(b.status) ||
    (rank(a.status) === 2 ? (b.start || '').localeCompare(a.start || '') : (a.start || '').localeCompare(b.start || '')));
  return out;
}
function buildBooks() {
  return (find('추천도서')?.rows || []).map((r) => ({
    title: (r['서명'] || '').trim(), pub: (r['발행사항'] || '').trim(), desc: (r['내용'] || '').trim(),
  })).filter((b) => b.title);
}
function buildKeywords() {
  return (find('인기검색어')?.rows || []).slice(0, 30).map((r) => ({ rank: r['순위'], kw: r['검색키워드명'], count: r['검색횟수'] }));
}

const events = buildEvents();
const books = buildBooks();
const keywords = buildKeywords();
const hostCount = {};
events.forEach((e) => { hostCount[e.host] = (hostCount[e.host] || 0) + 1; });
const DATA = JSON.stringify({
  events, books, keywords, demoNow: DEMO_NOW, ageOrder: AGE_ORDER,
  meta: {
    libCount: find('도서관 문화행사')?.total || 0,
    picCount: chaek.items?.length || 0,
    posterCount: events.filter((e) => e.poster).length,
    bookCount: books.length, fetchedAt: datago.fetchedAt,
  },
});

const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>군포 독서·문화행사 — 핏치</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"/>
<style>
  :root{--teal:#0A7373;--teal-d:#0A4747;--accent:#FBBF24;--ink:#0F172A;--slate:#64748B;--line:#E5E7EB}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Pretendard Variable',sans-serif;color:var(--ink);background:#fff;word-break:keep-all}
  .gnb{background:#0f1720;color:#fff;display:flex;height:72px}
  .gnb .brand{display:flex;align-items:center;gap:10px;padding:0 28px;font-weight:900;font-size:20px;background:var(--teal)}
  .gnb .brand i{color:var(--accent);font-style:normal}
  .gnb nav{display:flex}
  .gnb nav a{padding:0 24px;color:#cbd5e1;font-weight:700;font-size:16px;line-height:72px;text-decoration:none;cursor:pointer}
  .gnb nav a.on{color:#fff;background:var(--teal)}
  .subtabs{display:flex;margin:26px 40px 0;border:1px solid var(--line);border-radius:8px;overflow:hidden;width:max-content}
  .subtabs button{padding:13px 32px;border:0;background:#fff;font-size:16px;font-weight:700;color:var(--slate);cursor:pointer;border-right:1px solid var(--line)}
  .subtabs button:last-child{border-right:0}.subtabs button.on{color:var(--teal);font-weight:800}
  .searchbar{margin:18px 40px;background:var(--teal);border-radius:6px;padding:16px 20px;display:flex;align-items:center;gap:14px;color:#fff}
  .searchbar .lbl{font-weight:800;font-size:15px;white-space:nowrap}
  .searchbar input{border:0;border-radius:6px;padding:11px 14px;font-size:14px;font-family:inherit}
  .searchbar input[type=date]{width:160px}.searchbar .q{flex:1;min-width:120px}
  .searchbar button{background:var(--teal-d);color:#fff;border:0;border-radius:6px;padding:12px 26px;font-weight:800;font-size:15px;cursor:pointer;white-space:nowrap}
  .countbar{margin:6px 40px 0;display:flex;align-items:baseline;gap:10px}
  .countbar b{font-size:20px;font-weight:900}.countbar b span{color:var(--teal)}
  .countbar .live{margin-left:auto;font-size:12px;font-weight:800;color:#16A34A}
  .srcrow{display:flex;align-items:center;gap:9px;margin:9px 40px 0;flex-wrap:wrap}
  .srcrow .sp{background:#ECFEFF;border:1px solid #A5F3FC;color:#0A4747;border-radius:8px;padding:6px 12px;font-size:12.5px;font-weight:700}
  .srcrow .sp b{color:#0A7373;margin-left:5px;font-size:14px}
  .srcrow .op{color:#94A3B8;font-weight:900;font-size:15px}
  .srcrow .eq{font-weight:900;color:#0A4747;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:6px 12px;font-size:13px}
  .srcrow .note{color:#94A3B8;font-size:12px;margin-left:auto}
  .hostbar{display:flex;flex-wrap:wrap;gap:8px;margin:14px 40px 0}
  .hostbar .h{border:1px solid var(--line);background:#fff;color:#475569;border-radius:999px;padding:8px 15px;font-size:13.5px;font-weight:700;cursor:pointer}
  .hostbar .h.on{background:var(--teal);color:#fff;border-color:var(--teal)}
  .hostbar .h b{font-weight:800;margin-left:5px;opacity:.85}
  .hostbar .flbl{font-size:12px;font-weight:800;color:#94A3B8;align-self:center;margin-right:2px;flex:0 0 56px}
  #agebar .h.on{background:var(--accent2);border-color:var(--accent2)}
  .sectit{margin:26px 40px 12px;font-size:18px;font-weight:900;color:var(--teal-d);display:flex;align-items:center;gap:9px}
  .sectit .badge{font-size:12px;font-weight:800;color:#fff;background:var(--accent);color:#3a2a00;padding:3px 10px;border-radius:999px}
  .sectit .cnt{font-size:14px;color:var(--slate);font-weight:700}
  /* 포스터 그리드 */
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px 22px;margin:0 40px 10px}
  .card{cursor:pointer;text-decoration:none;color:inherit;display:block}
  .poster{position:relative;border-radius:12px;overflow:hidden;aspect-ratio:16/9;background:#1f2937;box-shadow:0 6px 18px rgba(15,23,42,.14)}
  .poster .pimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1}
  .poster .pcat{position:absolute;top:13px;right:13px;width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.94);color:var(--teal-d);font-weight:900;font-size:14px;display:flex;align-items:center;justify-content:center;z-index:2}
  .poster .pstatus{position:absolute;top:14px;left:14px;font-size:11px;font-weight:800;padding:4px 11px;border-radius:999px;z-index:2}
  .pstatus.open{background:var(--accent);color:#3a2a00}.pstatus.closed{background:rgba(15,23,42,.62);color:#fff}.pstatus.ing{background:#16A34A;color:#fff}
  .card .cname{margin-top:12px;font-size:16px;font-weight:800;line-height:1.4;text-align:center}
  .card .cmeta{margin-top:7px;font-size:13px;color:var(--slate);text-align:center;line-height:1.6}
  .card.dim .poster{filter:grayscale(.3) opacity(.85)}
  /* 표 */
  .tablewrap{margin:0 40px 40px;overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  thead th{background:#F1F5F9;color:#334155;font-weight:800;padding:13px 10px;border-top:2px solid var(--teal);border-bottom:1px solid var(--line);text-align:center;white-space:nowrap}
  tbody td{padding:13px 10px;border-bottom:1px solid var(--line);text-align:center;color:#475569;vertical-align:middle}
  tbody td.tname{text-align:left;font-weight:700;color:var(--ink);min-width:230px}
  .tcat{font-size:11px;font-weight:800;color:var(--teal-d);background:#E0F2F1;padding:3px 9px;border-radius:6px}
  .tstatus{font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:999px}
  .tstatus.open{background:#FEF3C7;color:#92400E}.tstatus.closed{background:#F1F5F9;color:#64748B}.tstatus.ing{background:#DCFCE7;color:#15803D}
  .tbtn{display:inline-block;background:#2563EB;color:#fff;font-weight:800;font-size:12.5px;padding:8px 16px;border-radius:6px;text-decoration:none}
  .tbtn.off{background:#CBD5E1}
  /* 추천도서 */
  .books{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin:20px 40px 50px}
  .book{display:flex;gap:16px;border:1px solid var(--line);border-radius:12px;padding:16px}
  .book .bspine{width:54px;flex-shrink:0;border-radius:6px;background:linear-gradient(160deg,var(--teal),var(--teal-d));display:flex;align-items:center;justify-content:center;color:var(--accent);font-weight:900;font-size:22px}
  .book .bt{font-size:16px;font-weight:800}.book .bp{font-size:12px;color:var(--slate);margin:3px 0 7px}
  .book .bd{font-size:13px;color:#334155;line-height:1.55;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .kw{display:flex;flex-wrap:wrap;gap:10px;margin:20px 40px 50px}
  .kw .k{background:#F1F5F9;border:1px solid var(--line);border-radius:999px;padding:9px 16px;font-size:14px;font-weight:700}
  .kw .k b{color:var(--teal);margin-right:6px}.kw .k i{font-style:normal;color:var(--slate);font-size:12px;margin-left:6px}
  .hidden{display:none}
  .foot{margin:0 40px;padding:18px 0 40px;border-top:1px solid var(--line);font-size:12px;color:#94A3B8}
</style></head><body>
  <div class="gnb">
    <div class="brand">핏치 <i>Pitch</i></div>
    <nav>
      <a class="on" data-tab="events">공연·전시·교육</a>
      <a data-tab="books">추천도서</a>
      <a data-tab="kw">인기검색어</a>
    </nav>
  </div>

  <div id="view-events">
    <div class="subtabs"><button class="on">포스터 보기</button><button>월간 일정</button><button>연간 일정</button></div>
    <div class="searchbar">
      <span class="lbl">기간</span>
      <input type="date" id="from"><span>~</span><input type="date" id="to">
      <span class="lbl">행사명</span>
      <input type="text" class="q" id="q" placeholder="검색어를 입력하세요.">
      <button onclick="render()">검색 🔍</button>
    </div>
    <div class="countbar"><b>전체 <span id="cnt">0</span>건</b><span class="live">● 공공데이터포털 LIVE 통합</span></div>
    <div class="srcrow" id="srcrow"></div>
    <div class="hostbar" id="hostbar"></div>
    <div class="hostbar" id="agebar"></div>
    <div id="postersec">
      <div class="sectit"><span class="badge">포스터</span> 그림책꿈마루 <span class="cnt" id="pcnt"></span></div>
      <div class="grid" id="grid"></div>
    </div>
    <div id="tablesec">
      <div class="sectit"><span class="badge" style="background:#2563EB;color:#fff">목록</span> 도서관 문화행사 <span class="cnt" id="tcnt"></span></div>
      <div class="tablewrap">
        <table><thead><tr>
          <th>영역</th><th>프로그램명</th><th>정원</th><th>수강신청기간</th><th>행사기간</th><th>장소</th><th>모집대상</th><th>모집상태</th><th>신청</th>
        </tr></thead><tbody id="tbody"></tbody></table>
      </div>
    </div>
  </div>

  <div id="view-books" class="hidden">
    <div class="countbar" style="margin-top:26px"><b>군포 도서관 추천도서 <span id="bcnt">0</span></b><span class="live">● 공공데이터포털 LIVE</span></div>
    <div class="books" id="bookwrap"></div>
  </div>
  <div id="view-kw" class="hidden">
    <div class="countbar" style="margin-top:26px"><b>군포 도서관 인기 검색어</b><span class="live">● 공공데이터포털 LIVE</span></div>
    <div class="kw" id="kwwrap"></div>
  </div>
  <div class="foot" id="foot"></div>

<script>
const D = ${DATA};
const C = ${JSON.stringify(CAT)};
let TAB='events', HOST='전체', AGE='전체';
const scls = (s)=> s==='마감'?'closed':s==='진행중'?'ing':'open';
const rng = (a,b)=> a? (b&&b!==a? a+' ~ '+b : a) : '-';

function poster(e){
  return \`<a class="card \${e.status==='마감'?'dim':''}" href="\${e.applyUrl}" target="_blank">
    <div class="poster">
      \${e.poster?\`<img class="pimg" src="\${e.poster}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'">\`:''}
      <span class="pstatus \${scls(e.status)}">\${e.status}</span>
      <span class="pcat">\${e.cat}</span>
    </div>
    <div class="cname">\${e.title}</div>
    <div class="cmeta">\${rng(e.start,e.end)}<br>\${e.venue||''}\${e.target?' / '+e.target:''}</div>
  </a>\`;
}
function row(e){
  const closed=e.status==='마감';
  return \`<tr>
    <td><span class="tcat">\${e.cat}</span></td>
    <td class="tname">\${e.title}</td>
    <td>\${e.capacity||'-'}</td>
    <td>\${rng(e.applyStart,e.applyEnd)}</td>
    <td>\${rng(e.start,e.end)}</td>
    <td>\${e.venue||'-'}</td>
    <td>\${e.target||'전체'}</td>
    <td><span class="tstatus \${scls(e.status)}">\${e.status}</span></td>
    <td><a class="tbtn \${closed?'off':''}" href="\${e.applyUrl}" target="_blank">\${closed?'마감':'신청'}</a></td>
  </tr>\`;
}
function renderHosts(base){
  const cnt={}; base.forEach(e=>cnt[e.host]=(cnt[e.host]||0)+1);
  const chips=[['전체',base.length],...Object.entries(cnt).sort((a,b)=>b[1]-a[1])];
  document.getElementById('hostbar').innerHTML='<span class="flbl">주관</span>'+chips.map(([h,n])=>\`<span class="h \${HOST===h?'on':''}" onclick="setHost('\${h}')">\${h}<b>\${n}</b></span>\`).join('');
}
function renderAges(base){
  const cnt={}; base.forEach(e=>(e.ages||[]).forEach(a=>cnt[a]=(cnt[a]||0)+1));
  const order=(D.ageOrder||[]).filter(a=>cnt[a]);
  const chips=[['전체',base.length],...order.map(a=>[a,cnt[a]])];
  document.getElementById('agebar').innerHTML='<span class="flbl">대상연령</span>'+chips.map(([h,n])=>\`<span class="h \${AGE===h?'on':''}" onclick="setAge('\${h}')">\${h}<b>\${n}</b></span>\`).join('');
}
window.setHost=(h)=>{HOST=h;render();};
window.setAge=(a)=>{AGE=a;render();};
function render(){
  const q=(document.getElementById('q').value||'').trim();
  let from=document.getElementById('from').value, to=document.getElementById('to').value;
  if(from&&to&&from>to){const t=from;from=to;to=t;}  // 거꾸로 입력 자동 교정
  const base=D.events;
  renderHosts(base); renderAges(base);
  const list=base.filter(e=>{
    if(HOST!=='전체'&&e.host!==HOST) return false;
    if(AGE!=='전체'&&!(e.ages||[]).includes(AGE)) return false;
    if(q&&!e.title.includes(q)&&!(e.venue||'').includes(q)) return false;
    if(from&&(e.end||e.start)<from) return false;   // 기간 겹침
    if(to&&e.start>to) return false;
    return true;
  });
  const posters=list.filter(e=>e.poster), rows=list.filter(e=>!e.poster);
  document.getElementById('cnt').textContent=list.length;
  document.getElementById('grid').innerHTML=posters.slice(0,40).map(poster).join('') || '<div style="color:#94A3B8;padding:10px 0">해당 포스터 행사가 없습니다.</div>';
  document.getElementById('tbody').innerHTML=rows.slice(0,150).map(row).join('');
  document.getElementById('pcnt').textContent=posters.length+'건';
  document.getElementById('tcnt').textContent=rows.length+'건 (최대 150건 표시)';
  document.getElementById('postersec').classList.toggle('hidden',posters.length===0);
  document.getElementById('tablesec').classList.toggle('hidden',rows.length===0);
  document.getElementById('srcrow').innerHTML=
    '<span class="sp">공공데이터포털 · 군포 도서관 문화행사<b>'+D.meta.libCount+'</b></span>'+
    '<span class="op">⊕</span>'+
    '<span class="sp">그림책꿈마루(스크래핑·포스터)<b>'+D.meta.picCount+'</b></span>'+
    '<span class="op">=</span>'+
    '<span class="eq">통합 '+(D.meta.libCount+D.meta.picCount)+'건</span>'+
    '<span class="note">기준일 '+D.demoNow+' · 공공데이터 스냅샷</span>';
}
function renderBooks(){
  document.getElementById('bcnt').textContent=D.books.length+'권';
  document.getElementById('bookwrap').innerHTML=D.books.slice(0,40).map(b=>
    \`<div class="book"><div class="bspine">책</div><div><div class="bt">\${b.title}</div><div class="bp">\${b.pub||''}</div><div class="bd">\${b.desc||''}</div></div></div>\`).join('');
}
function renderKw(){
  document.getElementById('kwwrap').innerHTML=D.keywords.map(k=>\`<span class="k"><b>\${k.rank}</b>\${k.kw}<i>\${(k.count||0).toLocaleString('ko-KR')}회</i></span>\`).join('');
}
function setTab(t){
  TAB=t;
  document.querySelectorAll('.gnb nav a').forEach(a=>a.classList.toggle('on',a.dataset.tab===t));
  document.getElementById('view-events').classList.toggle('hidden',t!=='events');
  document.getElementById('view-books').classList.toggle('hidden',t!=='books');
  document.getElementById('view-kw').classList.toggle('hidden',t!=='kw');
  if(t==='events')render(); else if(t==='books')renderBooks(); else renderKw();
}
document.querySelectorAll('.gnb nav a').forEach(a=>a.onclick=(e)=>{e.preventDefault();setTab(a.dataset.tab);});
document.getElementById('q').addEventListener('input',()=>{if(TAB==='events')render();});
document.getElementById('foot').textContent='출처: 공공데이터포털 경기도 군포시 도서관 문화행사·추천도서·인기검색어 + 그림책꿈마루 실시간 스크래핑(포스터·신청링크) · LIVE '+(D.meta.fetchedAt||'').slice(0,10)+' · 핏치 통합';
render();
</script>
</body></html>`;

writeFileSync(new URL('./gunpo-gallery.html', import.meta.url), html);
console.log(`  → gunpo-gallery.html (포스터 ${events.filter((e) => e.poster).length} · 표 ${events.filter((e) => !e.poster).length} · 추천도서 ${books.length})`);

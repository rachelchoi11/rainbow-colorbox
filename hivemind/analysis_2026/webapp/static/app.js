// 정산 표준화 솔루션 — PC 웹
const App = (() => {
  let S = { session:null, summary:null, tab:'home', period:null, platform:null, allPlatforms:[], files:[] };
  const $ = id => document.getElementById(id);
  const view = () => $('view');

  // ── 아이콘 (라인 SVG) ──
  const I = {
    home:'<path d="M4 13h7V4H4z"/><path d="M13 9h7V4h-7z"/><path d="M13 20h7v-7h-7z"/><path d="M4 20h7v-5H4z"/>',
    dist:'<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01"/>',
    author:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    mismatch:'<path d="M19.4 7.5a2 2 0 0 1 0 2.8l-1 1a2 2 0 0 0 0 2.8l1 1a2 2 0 0 1 0 2.8l-2 2a2 2 0 0 1-2.8 0l-1-1a2 2 0 0 0-2.8 0l-1 1a2 2 0 0 1-2.8 0l-2-2a2 2 0 0 1 0-2.8l1-1a2 2 0 0 0 0-2.8l-1-1a2 2 0 0 1 0-2.8l2-2a2 2 0 0 1 2.8 0l1 1a2 2 0 0 0 2.8 0l1-1a2 2 0 0 1 2.8 0z"/>',
    upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
    check:'<path d="M20 6L9 17l-5-5"/>',
    doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    coin:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 0 1 0 3H10a1.5 1.5 0 0 0 0 3h4.5"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/>',
    alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    chart:'<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/>',
  };
  const PAL=['#2f6bff','#f59e0b','#10b981','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16','#6366f1','#f97316','#14b8a6','#a855f7'];
  const svg = (p,cls='') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  // ── 유틸 ──
  const won = n => (n==null?'—':Math.round(n).toLocaleString('ko-KR'));
  const esc = s => (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const ini = s => (s||'?').trim().charAt(0)||'?';
  const avc = s => ['','g','o','p','r'][((s||'').charCodeAt(0)||0)%5];
  const pretty = p => {const[y,m]=p.split('-');return `${y}년 ${parseInt(m)}월`;};
  function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2000);}
  async function api(p){const r=await fetch(p);if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||'요청 실패');}return r.json();}
  const pq = () => S.period?`&period=${S.period}`:'';
  const scopeQ = () => (S.period?`&period=${S.period}`:'')+(S.platform?`&platform=${encodeURIComponent(S.platform)}`:'');
  const manAmt = v => {            // 금액 축약 라벨
    if(v>=1e8) return (v/1e8).toFixed(v>=1e9?0:1)+'억';
    if(v>=1e4) return Math.round(v/1e4).toLocaleString()+'만';
    return ''+Math.round(v);
  };

  // 월별 막대 차트 — 총매출(연) vs 정산액(진), 각 월 수치 라벨
  function barChart(trend,w=440,h=224){
    if(!trend||!trend.length) return '';
    const all=trend.flatMap(t=>[t.gross,t.settle]); const max=Math.max(...all,1);
    const padL=8,padR=8,padT=58,padB=26;   // 상단 여백 확대 — 범례와 값 라벨 겹침 방지
    const n=trend.length, gw=(w-padL-padR)/n, bw=Math.min(38,gw*0.32), gap=8;
    const y=v=>padT+(1-v/max)*(h-padT-padB);
    let bars='',labels='',legend='';
    trend.forEach((t,i)=>{
      const cx=padL+gw*i+gw/2;
      const x1=cx-bw-gap/2, x2=cx+gap/2;
      const gy=y(t.gross), sy=y(t.settle), base=h-padB;
      bars+=`<rect x="${x1}" y="${gy}" width="${bw}" height="${base-gy}" rx="4" fill="#d7e0f5"/>`;
      bars+=`<rect x="${x2}" y="${sy}" width="${bw}" height="${base-sy}" rx="4" fill="#2f6bff"/>`;
      labels+=`<text x="${x1+bw/2}" y="${gy-6}" text-anchor="middle" font-size="10" fill="#9aa1ac">${manAmt(t.gross)}</text>`;
      labels+=`<text x="${x2+bw/2}" y="${sy-6}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#2f6bff">${manAmt(t.settle)}</text>`;
      labels+=`<text x="${cx}" y="${base+16}" text-anchor="middle" font-size="11" fill="#6b727e">${pretty(t.period)}</text>`;
    });
    legend=`<g font-size="10.5" fill="#6b727e">
      <rect x="${padL}" y="10" width="11" height="11" rx="2" fill="#d7e0f5"/><text x="${padL+16}" y="19">총매출</text>
      <rect x="${padL+70}" y="10" width="11" height="11" rx="2" fill="#2f6bff"/><text x="${padL+86}" y="19">정산액</text></g>`;
    return `<svg width="100%" viewBox="0 0 ${w} ${h}" style="display:block">${legend}${bars}${labels}</svg>`;
  }

  // 가로 누적 비중 막대 (단행본/연재 등)
  function splitBar(items){
    if(!items||!items.length) return '';
    const cols={'단행본':'#2f6bff','연재':'#f59e0b','구독제':'#10b981','기타':'#9aa1ac'};
    const total=items.reduce((a,b)=>a+b.settle,0)||1;
    const seg=items.map(it=>`<div style="width:${(it.settle/total*100).toFixed(2)}%;background:${cols[it.key]||'#9aa1ac'}" title="${it.key} ${it.pct}%"></div>`).join('');
    const leg=items.map(it=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--sub);margin-right:14px">
      <i style="width:9px;height:9px;border-radius:2px;background:${cols[it.key]||'#9aa1ac'}"></i>${it.key} <b style="color:var(--ink)">${it.pct}%</b></span>`).join('');
    return `<div style="display:flex;height:12px;border-radius:6px;overflow:hidden;gap:2px">${seg}</div>
      <div style="margin-top:10px">${leg}</div>`;
  }

  // ── 통계 차트 helpers ──
  function donut(items,w=300,h=200){
    if(!items||!items.length) return '';
    const top=items.slice(0,8); const etc=items.slice(8).reduce((a,b)=>a+b.settle,0);
    if(etc>0) top.push({name:'기타',settle:etc,pct:0});
    const tot=top.reduce((a,b)=>a+b.settle,0)||1;
    const cx=h/2,cy=h/2,r=h/2-8,ir=r*0.58; let a0=-Math.PI/2,segs='';
    top.forEach((it,i)=>{
      const a1=a0+it.settle/tot*Math.PI*2;
      const x0=cx+r*Math.cos(a0),y0=cy+r*Math.sin(a0),x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1);
      const xi0=cx+ir*Math.cos(a1),yi0=cy+ir*Math.sin(a1),xi1=cx+ir*Math.cos(a0),yi1=cy+ir*Math.sin(a0);
      const lg=(a1-a0)>Math.PI?1:0;
      segs+=`<path d="M${x0} ${y0} A${r} ${r} 0 ${lg} 1 ${x1} ${y1} L${xi0} ${yi0} A${ir} ${ir} 0 ${lg} 0 ${xi1} ${yi1} Z" fill="${PAL[i%PAL.length]}"/>`;
      a0=a1;
    });
    const leg=top.map((it,i)=>`<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;margin-bottom:5px">
      <i style="width:9px;height:9px;border-radius:2px;background:${PAL[i%PAL.length]};flex-shrink:0"></i>
      <span style="flex:1;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.name)}</span>
      <b class="num" style="font-size:11.5px">${(it.settle/tot*100).toFixed(1)}%</b></div>`).join('');
    return `<div style="display:flex;gap:18px;align-items:center">
      <svg width="${h}" height="${h}" style="flex-shrink:0">${segs}</svg>
      <div style="flex:1;min-width:0">${leg}</div></div>`;
  }
  function hbar(data){  // {rows:[{name,settle,pct}],etc,count}
    const rows=data.rows||[]; if(!rows.length) return '<div class="empty">데이터 없음</div>';
    const max=Math.max(...rows.map(r=>r.settle),1);
    let html=rows.map((r,i)=>`
      <div style="margin-bottom:11px">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
          <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62%">${i+1}. ${esc(r.name)}</span>
          <span class="num"><b>${won(r.settle)}</b> <span style="color:var(--mute)">${r.pct}%</span></span></div>
        <div style="height:8px;background:#eef1f5;border-radius:5px;overflow:hidden">
          <div style="height:100%;width:${(r.settle/max*100).toFixed(1)}%;background:${PAL[i%PAL.length]};border-radius:5px"></div></div>
      </div>`).join('');
    if(data.etc>0) html+=`<div style="font-size:11.5px;color:var(--mute);margin-top:8px">그 외 ${data.count-rows.length}개 합계 ${won(data.etc)}원</div>`;
    return html;
  }
  function waterfall(wf,w=440,h=210){
    const g=wf.gross,s=wf.settle,gap=wf.gap; const max=g||1;
    const padT=30,padB=42,base=h-padB,scale=(h-padT-padB)/max;
    const bw=90, xs=[40,200,360];
    const bar=(x,top,bottom,color,lbl,val)=>`
      <rect x="${x}" y="${base-bottom*scale}" width="${bw}" height="${(bottom-top)*scale}" rx="4" fill="${color}"/>
      <text x="${x+bw/2}" y="${base-bottom*scale-8}" text-anchor="middle" font-size="11" font-weight="700" fill="#1a1d24">${manAmt(val)}</text>
      <text x="${x+bw/2}" y="${base+18}" text-anchor="middle" font-size="11.5" fill="#6b727e">${lbl}</text>`;
    return `<svg width="100%" viewBox="0 0 ${w} ${h}" style="display:block">
      ${bar(xs[0],0,g,'#2f6bff','총매출',g)}
      <rect x="${xs[1]}" y="${base-g*scale}" width="${bw}" height="${gap*scale}" rx="4" fill="#e5484d" opacity=".75"/>
      <text x="${xs[1]+bw/2}" y="${base-g*scale-8}" text-anchor="middle" font-size="11" font-weight="700" fill="#e5484d">−${manAmt(gap)}</text>
      <text x="${xs[1]+bw/2}" y="${base+18}" text-anchor="middle" font-size="11.5" fill="#6b727e">수수료·배분</text>
      ${bar(xs[2],0,s,'#138a5e','정산액',s)}
      <line x1="${xs[0]+bw}" y1="${base-g*scale}" x2="${xs[1]}" y2="${base-g*scale}" stroke="#cfd4dd" stroke-dasharray="3 3"/>
      <line x1="${xs[1]+bw}" y1="${base-s*scale}" x2="${xs[2]}" y2="${base-s*scale}" stroke="#cfd4dd" stroke-dasharray="3 3"/>
    </svg>`;
  }
  function paretoChart(pts,bands,w=440,h=210){
    if(!pts||!pts.length) return '';
    const padL=8,padR=8,padT=16,padB=26,n=pts.length;
    const x=i=>padL+(w-padL-padR)*i/(n-1), y=v=>padT+(1-v/100)*(h-padT-padB);
    const line=pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.cum_pct).toFixed(1)).join(' ');
    const area=line+` L ${x(n-1)} ${h-padB} L ${x(0)} ${h-padB} Z`;
    const gl=[25,50,75].map(v=>`<line x1="${padL}" y1="${y(v)}" x2="${w-padR}" y2="${y(v)}" stroke="#eef1f5"/><text x="${padL}" y="${y(v)-3}" font-size="9" fill="#cfd4dd">${v}%</text>`).join('');
    return `<svg width="100%" viewBox="0 0 ${w} ${h}" style="display:block">${gl}
      <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b5cf6" stop-opacity=".18"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#pg)"/><path d="${line}" fill="none" stroke="#8b5cf6" stroke-width="2.4"/>
      <text x="${x(0)}" y="${h-8}" font-size="10" fill="#9aa1ac">1위</text>
      <text x="${x(n-1)}" y="${h-8}" text-anchor="end" font-size="10" fill="#9aa1ac">${n}위</text></svg>`;
  }
  function heatmap(rows){
    if(!rows||!rows.length) return '<div class="empty">데이터 없음</div>';
    const max=Math.max(...rows.flatMap(r=>[r.단행본,r.연재]),1);
    const cell=v=>{const a=v/max; return `background:rgba(47,107,255,${(0.08+a*0.84).toFixed(2)});color:${a>0.5?'#fff':'#1a1d24'}`;};
    return `<table class="tbl"><thead><tr><th>유통사</th><th class="r">단행본</th><th class="r">연재</th></tr></thead><tbody>${
      rows.map(r=>`<tr><td class="nm">${esc(r.platform)}</td>
        <td class="r num" style="${cell(r.단행본)};font-weight:700">${won(r.단행본)}</td>
        <td class="r num" style="${cell(r.연재)};font-weight:700">${won(r.연재)}</td></tr>`).join('')}</tbody></table>`;
  }

  // ── 네비 ──
  const NAV=[
    ['home','정산 요약',I.home],['stats','통계 분석',I.chart],['dist','유통사별',I.dist],
    ['author','작가별',I.author],['work','작품별',I.doc],
    ['search','통합 검색',I.search],['mismatch','미매칭',I.mismatch],['lab','연구소',I.alert],['upload','업로드',I.upload],
  ];
  const TITLES={home:'정산 요약',stats:'통계 분석',dist:'유통사별 정산',author:'작가별 정산',work:'작품별 정산',search:'작가·작품 통합 검색',mismatch:'미매칭 보드',lab:'연구소 — 매칭 오류 검토',upload:'정산서 업로드'};
  function renderNav(){
    $('nav').innerHTML=NAV.map(([k,l,ic])=>{
      const mm=(k==='mismatch'&&S.summary&&S.summary.mismatch)?`<span class="badge">${S.summary.mismatch}</span>`:'';
      return `<button class="navitem ${S.tab===k?'on':''}" onclick="App.go('${k}')">${svg(ic)}<span>${l}</span>${mm}</button>`;
    }).join('');
  }

  function init(){ renderNav(); go('upload'); }

  function go(tab){
    if(tab!=='upload' && !S.session){ toast('먼저 정산서를 업로드해 주세요'); tab='upload'; }
    S.tab=tab; renderNav();
    $('pageTitle').textContent=TITLES[tab];
    const showMonth=S.session&&(tab==='home'||tab==='stats'||tab==='dist'||tab==='author'||tab==='work');
    const showPlat=S.session&&(tab==='home'||tab==='stats'||tab==='author'||tab==='work');  // 유통사 필터
    $('monthsel').classList.toggle('hide',!showMonth);
    $('platselWrap').classList.toggle('hide',!showPlat);
    $('exportBtn').classList.toggle('hide',!S.session);
    if(showMonth) renderMonth();
    if(showPlat) renderPlatSel();
    ({home:renderHome,stats:renderStats,dist:renderDist,author:renderAuthors,work:renderWorks,search:renderSearch,mismatch:renderMismatch,lab:renderLab,upload:renderUpload}[tab])();
  }

  function renderPlatSel(){
    const cur=S.platform||'';
    $('platSel').innerHTML=`<option value="">전체 유통사</option>`+
      S.allPlatforms.map(p=>`<option value="${esc(p)}" ${p===cur?'selected':''}>${esc(p)}</option>`).join('');
  }
  function setPlatform(v){ S.platform=v||null; go(S.tab); }

  function renderMonth(){
    $('monthLbl').childNodes[0].nodeValue = S.period?pretty(S.period):'전체 기간';
    $('monthSub').textContent = S.period?'단일 월':`${S.summary.periods.length}개월 합산`;
  }
  function shiftMonth(d){
    const ps=[null,...S.summary.periods]; let i=ps.indexOf(S.period);
    i=Math.max(0,Math.min(ps.length-1,i+d)); S.period=ps[i]; go(S.tab);
  }

  // ══ 업로드 ══
  function renderUpload(){
    view().innerHTML=`
      <div class="uploadwrap">
        <div class="drop" id="drop">
          <div class="ic">${svg(I.upload)}</div>
          <div class="t">정산서 파일을 끌어다 놓으세요</div>
          <div class="s">엑셀·CSV·HTML·ZIP 등 유통사 원본 그대로 · 다중 선택 가능</div>
          <input type="file" id="fileInput" multiple class="hide" accept=".xls,.xlsx,.csv,.zip,.htm,.html">
        </div>
        <div class="filechips" id="chips"></div>
        <div style="display:flex;gap:10px;margin-top:16px">
          <button class="btn btn-primary btn-lg" id="goBtn" style="flex:1;justify-content:center" disabled>표준화 실행</button>
          <button class="btn btn-lg" id="sampleBtn" style="flex:1;justify-content:center">26년 1~4월 샘플로 둘러보기</button>
        </div>
        <div class="steps">
          ${[['1','형식 자동 인식','유통사별로 다른 파일 형식·컬럼을 자동 판별'],
             ['2','작품·작가 대조','작품명 표기 통일, 작가·레이블 보강'],
             ['3','정확성 검증','원본 합계와 자동 대사'],
             ['4','정산 산출','작가별 지급액과 근거 도출']].map(([n,h,p])=>
            `<div class="step"><div class="n">${n}</div><div class="h">${h}</div><div class="p">${p}</div></div>`).join('')}
        </div>
      </div>`;
    const drop=$('drop'),input=$('fileInput');
    drop.onclick=()=>input.click();
    input.onchange=()=>setFiles([...input.files]);
    ['dragover','dragenter'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('over');}));
    ['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('over');}));
    drop.addEventListener('drop',ev=>setFiles([...ev.dataTransfer.files]));
    $('goBtn').onclick=runUpload; $('sampleBtn').onclick=runSample;
  }
  function setFiles(fs){S.files=fs;$('chips').innerHTML=fs.map(f=>`<span class="chip">${esc(f.name)}</span>`).join('');$('goBtn').disabled=!fs.length;}
  function loading(m){view().innerHTML=`<div class="loading"><div class="spin"></div>${esc(m)}</div>`;$('monthsel').classList.add('hide');}
  async function runUpload(){
    if(!S.files.length)return; loading(`정산서 ${S.files.length}개 표준화 중…`);
    const fd=new FormData(); S.files.forEach(f=>fd.append('files',f));
    try{const r=await fetch('/api/upload',{method:'POST',body:fd});
      if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||'실패');}
      const d=await r.json(); S.session=d.session; S.summary=d.summary; S.period=null; S.platform=null;
      S.allPlatforms=d.summary.all_platforms||[];
      toast('표준화 완료'); go('home');
    }catch(e){toast('오류: '+e.message); renderUpload();}
  }
  async function runSample(){
    loading('26년 1~4월 정산서 151개 표준화 중…');
    try{const r=await fetch('/api/load_sample',{method:'POST'});
      if(!r.ok)throw new Error('샘플 로드 실패');
      const d=await r.json(); S.session=d.session; S.summary=d.summary; S.period=null; S.platform=null;
      S.allPlatforms=d.summary.all_platforms||[];
      toast('샘플 로드 완료'); go('home');
    }catch(e){toast('오류: '+e.message); renderUpload();}
  }

  // ══ 홈 ══
  async function renderHome(){
    // 필터(월·유통사) 적용 시 범위 한정 요약 재조회
    const s=(S.period||S.platform)? await api(`/api/summary?session=${S.session}${scopeQ()}`) : S.summary;
    const vp=s.verify_total?Math.round(s.verify_pass/s.verify_total*100):100;
    const scopeLbl=[S.platform||'', S.period?pretty(S.period):''].filter(Boolean).join(' · ')||'전체 기간';
    const ratio=s.total_gross?Math.round(s.total_settle/s.total_gross*100):0;
    const distKpi = S.platform
      ? kpi(I.coin,'매출 대비 정산율',ratio+'%','선택 유통사 기준')
      : kpi(I.dist,'유통사',s.distributors,'개 플랫폼');
    view().innerHTML=`
      <div class="grid g-hero">
        <div class="card hero"><div class="bd">
          <div class="label">작가 지급 대상 정산액 · ${esc(scopeLbl)}</div>
          <div class="big">${won(s.total_settle)} <small>원</small></div>
          <div class="sub">총매출 ${won(s.total_gross)}원 · 작가 ${s.authors.toLocaleString()}명 · 작품 ${s.series.toLocaleString()}편 · 매출대비 ${ratio}%</div>
          <div class="chart" style="margin-top:6px">${barChart(s.trend)}</div>
        </div></div>
        <div class="grid" style="grid-template-columns:1fr 1fr;align-content:start">
          ${distKpi}
          ${kpi(I.coin,'자동 매칭',s.match_full_pct+'%',`완전 ${s.match_full.toLocaleString()}건 · 작가만 ${((s.by_status&&s.by_status['작가만'])||0).toLocaleString()}건(${(((s.by_status&&s.by_status['작가만'])||0)/s.records*100).toFixed(2)}%·레이블만 없음)`,s.match_full_pct>=95?'ok':'')}
          ${kpi(I.alert,'미매칭',s.mismatch_pct+'%',`${s.mismatch.toLocaleString()}건 · 정산액 ${s.mismatch_settle_pct}% · 작가만 제외 시 합계 100%`,s.mismatch?'warn':'ok')}
          ${kpi(I.check,'원본 검증',`${s.verify_pass}/${s.verify_total}`,`합계 대사 ${vp}% 일치`,'ok')}
        </div>
      </div>

      ${s.book_split&&s.book_split.length?`<div class="card" style="margin-top:16px"><div class="hd"><div class="t">정산 구성 · 단행본 vs 연재 (정산액 기준)</div></div>
        <div class="bd">${splitBar(s.book_split)}</div></div>`:''}

      <div class="grid g-2" style="margin-top:16px">
        <div class="card">
          <div class="hd"><div class="t">유통사별 정산</div><div class="lnk" onclick="App.go('dist')">전체 보기</div></div>
          <div id="homeDist"></div>
        </div>
        <div class="card">
          <div class="hd"><div class="t">정산액 상위 작가</div><div class="lnk" onclick="App.go('author')">전체 보기</div></div>
          <div id="homeAuthor"></div>
        </div>
      </div>`;
    const dist=await api(`/api/distributors?session=${S.session}${pq()}`);
    $('homeDist').innerHTML=tblDist(dist.slice(0,6));
    const au=await api(`/api/authors?session=${S.session}${scopeQ()}`);
    $('homeAuthor').innerHTML=tblAuthor(au.slice(0,6));
  }

  // ══ 통계 분석 ══
  async function renderStats(){
    view().innerHTML=`<div class="loading"><div class="spin"></div></div>`;
    const d=await api(`/api/stats?session=${S.session}${scopeQ()}`);
    const card=(t,sub,body)=>`<div class="card"><div class="hd"><div class="t">${t}</div>${sub?`<div style="font-size:11.5px;color:var(--mute)">${sub}</div>`:''}</div><div class="bd">${body}</div></div>`;
    const b=d.pareto_bands||{};
    view().innerHTML=`
      <div class="grid g-2">
        ${card('유통사별 매출 비중','판매처별 정산액',donut(d.distributors))}
        ${card('매출 → 정산액 구조','총매출에서 수수료·배분 차감 후 정산액',waterfall(d.waterfall))}
      </div>
      <div class="grid g-2" style="margin-top:16px">
        ${card('레이블(브랜드)별 매출','상위 '+(d.labels.rows.length)+'개',hbar(d.labels))}
        ${card('작품별 매출 순위','시리즈 단위 상위 '+(d.works.rows.length)+'개',hbar(d.works))}
      </div>
      <div class="grid g-2" style="margin-top:16px">
        ${card('작가 정산 집중도 (파레토)',`상위 10명 ${b[10]||0}% · 50명 ${b[50]||0}% · 100명 ${b[100]||0}% (총 ${d.author_total.toLocaleString()}명)`,paretoChart(d.pareto,b))}
        ${card('유통사 × 단행본/연재','유형별 강세 유통사 (정산액)',heatmap(d.heatmap))}
      </div>
      <div class="grid g-2" style="margin-top:16px">
        ${card('장르(분류)별 매출', d.genres.rows.length?'유통사 제공 분류 기준':'분류 정보 제공 유통사 한정', d.genres.rows.length?hbar(d.genres):'<div class="empty">분류(장르)를 제공하는 유통사가 제한적입니다.<br><span style="font-size:12px">대부분 유통사 정산서에 장르 항목이 없어 부분 집계만 가능합니다.</span></div>')}
        <div class="card"><div class="hd"><div class="t">데이터 안내</div></div><div class="bd" style="font-size:12.5px;color:var(--sub);line-height:1.9">
          · 모든 수치는 업로드된 정산서를 표준화·합산한 <b>실데이터</b>이며 원본 합계 대사 검증을 거쳤습니다.<br>
          · 상단 <b>유통사·기간 필터</b>에 따라 모든 차트가 함께 갱신됩니다.<br>
          · <b>출간연도별</b> 통계는 정산서에 출간일 정보가 없어 제외했습니다(작품 마스터 입력 시 추가 가능).</div></div>
      </div>
      <div style="height:8px"></div>`;
  }
  function kpi(ic,l,v,d,cls=''){return `<div class="kpi"><div class="ico">${svg(ic)}</div><div class="l">${l}</div><div class="v ${cls}">${v}</div><div class="d">${d}</div></div>`;}

  // ══ 테이블 컴포넌트 ══
  function tblDist(rows){
    if(!rows.length)return `<div class="empty">데이터 없음</div>`;
    return `<table class="tbl"><thead><tr><th>유통사</th><th class="r">정산액</th><th class="r">총매출</th><th class="r">작가</th></tr></thead><tbody>${
      rows.map(d=>`<tr class="clk" onclick="App.openDist('${esc(d.platform)}')">
        <td><span class="av ${avc(d.platform)}">${esc(ini(d.platform))}</span><span class="nm">${esc(d.platform)}</span></td>
        <td class="r"><span class="v num">${won(d.settle)}</span></td>
        <td class="r num" style="color:var(--mute)">${won(d.gross)}</td>
        <td class="r num">${d.authors}</td></tr>`).join('')}</tbody></table>`;
  }
  function tblAuthor(rows){
    if(!rows.length)return `<div class="empty">검색 결과 없음</div>`;
    return `<table class="tbl"><thead><tr><th>작가</th><th class="r">정산액</th><th class="r">작품</th><th class="r">유통사</th></tr></thead><tbody>${
      rows.map(a=>`<tr class="clk" onclick="App.openAuthor('${esc(a.author_key||a.author).replace(/'/g,"\\'")}')">
        <td><span class="av ${avc(a.author)}">${esc(ini(a.author))}</span><span class="nm">${esc(a.author)}</span>${a.variants&&a.variants.length?`<span class="badge b-gray" style="margin-left:6px" title="통합된 표기">+${a.variants.length}</span>`:''}</td>
        <td class="r"><span class="v num">${won(a.settle)}</span><div class="vsub">총매출 ${won(a.gross)}</div></td>
        <td class="r num">${a.works}</td><td class="r num">${a.platforms}</td></tr>`).join('')}</tbody></table>`;
  }

  // ══ 유통사 전체 ══
  async function renderDist(){
    view().innerHTML=`<div class="card" id="distCard"><div class="loading"><div class="spin"></div></div></div>`;
    const d=await api(`/api/distributors?session=${S.session}${pq()}`);
    $('distCard').innerHTML=`<div class="hd"><div class="t">유통사별 정산 · ${d.length}곳</div></div>
      <table class="tbl"><thead><tr><th class="rank">#</th><th>유통사</th><th class="r">정산액</th><th class="r">총매출</th><th class="r">정산율(추정)</th><th class="r">작가</th><th class="r">레코드</th></tr></thead><tbody>${
      d.map((x,i)=>`<tr class="clk" onclick="App.openDist('${esc(x.platform)}')">
        <td class="rank">${i+1}</td>
        <td><span class="av ${avc(x.platform)}">${esc(ini(x.platform))}</span><span class="nm">${esc(x.platform)}</span></td>
        <td class="r"><span class="v num">${won(x.settle)}</span></td>
        <td class="r num" style="color:var(--mute)">${won(x.gross)}</td>
        <td class="r num">${x.gross?Math.round(x.settle/x.gross*100)+'%':'—'}</td>
        <td class="r num">${x.authors}</td><td class="r num" style="color:var(--mute)">${x.records.toLocaleString()}</td></tr>`).join('')}</tbody></table>`;
  }

  // ══ 작가 전체 ══
  async function renderAuthors(){
    view().innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div class="search">${svg(I.search)}<input id="aq" placeholder="작가명 검색" oninput="App.searchAuthor()"></div>
      </div>
      <div class="card" id="authorCard"><div class="loading"><div class="spin"></div></div></div>`;
    loadAuthors('');
  }
  let _t; function searchAuthor(){clearTimeout(_t);_t=setTimeout(()=>loadAuthors($('aq').value.trim()),250);}
  async function loadAuthors(q){
    const a=await api(`/api/authors?session=${S.session}&q=${encodeURIComponent(q)}${scopeQ()}`);
    $('authorCard').innerHTML=`<div class="hd"><div class="t">작가별 정산 · ${a.length.toLocaleString()}명</div></div>
      <table class="tbl"><thead><tr><th class="rank">#</th><th>작가</th><th class="r">정산액</th><th class="r">총매출</th><th class="r">작품</th><th class="r">유통사</th><th></th></tr></thead><tbody>${
      a.length?a.map((x,i)=>`<tr class="clk" onclick="App.openAuthor('${esc(x.author).replace(/'/g,"\\'")}')">
        <td class="rank">${i+1}</td>
        <td><span class="av ${avc(x.author)}">${esc(ini(x.author))}</span><span class="nm">${esc(x.author)}</span></td>
        <td class="r"><span class="v num">${won(x.settle)}</span></td>
        <td class="r num" style="color:var(--mute)">${won(x.gross)}</td>
        <td class="r num">${x.works}</td><td class="r num">${x.platforms}</td>
        <td class="r"><button class="flagbtn" title="신고" onclick="event.stopPropagation();App.flagItem('작가별','${esc(x.author).replace(/'/g,"\\'")}','${esc(x.author).replace(/'/g,"\\'")}','정산액 ${won(x.settle)} · 작품 ${x.works}',${x.settle})">🚩</button></td></tr>`).join(''):`<tr><td colspan="7"><div class="empty">검색 결과 없음</div></td></tr>`}</tbody></table>`;
  }

  // ══ 작품별 ══
  function tblWork(rows){
    if(!rows.length)return `<div class="empty">검색 결과 없음</div>`;
    return `<table class="tbl"><thead><tr><th class="rank">#</th><th>작품(시리즈)</th><th>작가</th><th>레이블</th><th class="r">정산액</th><th class="r">유통사</th><th></th></tr></thead><tbody>${
      rows.map((x,i)=>{
        const multi=(x.author&&x.author.includes(','))||(x.label&&x.label.includes(','));
        return `<tr class="clk" onclick="App.openWork('${esc(x.title_norm).replace(/'/g,"\\'")}')">
        <td class="rank">${i+1}</td>
        <td><span class="nm">${esc(x.title)}</span> <span class="badge ${x.book_type==='연재'?'b-orange':'b-gray'}">${esc(x.book_type||'-')}</span>${multi?' <span class="badge b-red" title="작가/레이블 복수 — 동명이작 의심">⚠</span>':''}</td>
        <td>${x.author?esc(x.author):'<span class="badge b-red">미상</span>'}</td>
        <td style="color:var(--sub)">${esc(x.label)||'—'}</td>
        <td class="r"><span class="v num">${won(x.settle)}</span><div class="vsub">총매출 ${won(x.gross)}</div></td>
        <td class="r num">${x.platforms}</td>
        <td class="r"><button class="flagbtn" title="신고" onclick="event.stopPropagation();App.flagItem('작품별','${esc(x.title_norm).replace(/'/g,"\\'")}','${esc(x.title).replace(/'/g,"\\'")}','작가 ${esc(x.author||'미상').replace(/'/g,"\\'")} / 레이블 ${esc(x.label||'—').replace(/'/g,"\\'")}',${x.settle})">🚩</button></td></tr>`;}).join('')}</tbody></table>`;
  }
  async function renderWorks(){
    view().innerHTML=`
      <div style="margin-bottom:14px"><div class="search">${svg(I.search)}<input id="wq" placeholder="작품명 검색" oninput="App.searchWork()"></div></div>
      <div class="card" id="workCard"><div class="loading"><div class="spin"></div></div></div>`;
    loadWorks('');
  }
  let _wt; function searchWork(){clearTimeout(_wt);_wt=setTimeout(()=>loadWorks($('wq').value.trim()),250);}
  async function loadWorks(q){
    const a=await api(`/api/works?session=${S.session}&q=${encodeURIComponent(q)}${scopeQ()}`);
    $('workCard').innerHTML=`<div class="hd"><div class="t">작품별 정산 · ${a.length.toLocaleString()}편</div></div>${tblWork(a)}`;
  }
  async function openWork(tn){
    openDrawer(`<div class="loading"><div class="spin"></div></div>`);
    const pp=S.platform?`&platform=${encodeURIComponent(S.platform)}`:'';
    const d=await api(`/api/work?session=${S.session}&title_norm=${encodeURIComponent(tn)}${pp}`);
    const chips=d.plat_sum.map(p=>`<span class="badge b-blue" style="margin:0 5px 5px 0">${esc(p.platform)} ${won(p.settle)}</span>`).join('');
    const evi=d.breakdown.map(b=>`<div class="evi">
      <div class="top"><div class="tt">${esc(b.platform)} <span class="badge ${b.book_type==='연재'?'b-orange':'b-gray'}">${esc(b.book_type||'-')}</span> <span class="badge b-gray">${esc(b.period)}</span></div>
        <div class="vv num">${won(b.settle)}원</div></div>
      <div class="why">총매출 <b>${won(b.gross)}원</b> · 정산액 <b>${won(b.settle)}원</b> · 원본 ${b.lines}행 · 산출 근거 <b>${esc(b.basis||'제공값')}</b></div>
    </div>`).join('');
    openDrawer(`<div class="dh"><div class="dh-actions"><button class="x" onclick="App.closeDrawer()">×</button></div>
      <div class="nm">${esc(d.title)}</div>
      <div class="mt">작가 ${d.authors.length?d.authors.map(esc).join(', '):'미상'} · 레이블 ${d.labels.length?d.labels.map(esc).join(', '):'—'} · 유통사 ${d.platforms}곳</div></div>
      <div class="db">
        <div class="card hero"><div class="bd">
          <div class="label">작품 정산액 · 전체 기간</div>
          <div class="big">${won(d.total_settle)} <small>원</small></div>
          <div class="sub">총매출 ${won(d.total_gross)}원</div>
          <div style="margin-top:12px">${chips}</div></div></div>
        <div class="sec-h">유통사·월별 정산 내역</div>
        <div class="evigrid">${evi}</div>
        <div class="card" style="margin-top:16px"><div class="hd" style="cursor:pointer" onclick="App.toggleVol()">
          <div class="t">세부 · 권/회차별 내역 <span class="badge b-gray">${d.volume_count}종 표기</span></div>
          <div class="lnk" id="volToggle">펼치기 ▾</div></div>
          <div id="volBody" class="hide"><table class="tbl"><thead><tr><th>원문 표기 (권/회차)</th><th class="r">정산액</th><th class="r">총매출</th><th class="r">행</th><th class="r">유통사</th></tr></thead><tbody>${
            d.volumes.map(v=>`<tr><td class="nm" style="font-weight:500">${esc(v.title)}</td>
              <td class="r"><span class="v num">${won(v.settle)}</span></td>
              <td class="r num" style="color:var(--mute)">${won(v.gross)}</td>
              <td class="r num">${v.lines}</td><td class="r num">${v.platforms}</td></tr>`).join('')}</tbody></table></div>
        </div>
      </div>`);
  }
  function toggleVol(){const b=$('volBody'),t=$('volToggle');if(!b)return;const h=b.classList.toggle('hide');t.textContent=h?'펼치기 ▾':'접기 ▴';}

  // ══ 작가 상세 (근거) — 우측 드로어 ══
  let _author=null, _authorPeriod=undefined;   // 드로어 내부 기간 필터 상태
  async function openAuthor(name, periodArg){
    _author=name;
    _authorPeriod = (periodArg===undefined) ? S.period : (periodArg||null);
    openDrawer(`<div class="loading"><div class="spin"></div></div>`);
    const pp = (_authorPeriod?`&period=${_authorPeriod}`:'')+(S.platform?`&platform=${encodeURIComponent(S.platform)}`:'');
    const d=await api(`/api/author?session=${S.session}&name=${encodeURIComponent(name)}${pp}`);
    const chips=d.plat_sum.map(p=>`<span class="badge b-blue" style="margin:0 5px 5px 0">${esc(p.platform)} ${won(p.settle)}</span>`).join('');
    // 기간 세그먼트
    const segs=[['전체',null],...S.summary.periods.map(p=>[pretty(p),p])];
    const segHtml=segs.map(([lab,p])=>{
      const on=(_authorPeriod||null)===(p||null);
      return `<button class="seg ${on?'on':''}" onclick="App.openAuthor('${esc(name).replace(/'/g,"\\'")}',${p?`'${p}'`:"''"})">${lab}</button>`;
    }).join('');
    // 근거: 전체 기간이면 월 배지 표시, 단일 월이면 생략
    const showMonth=!_authorPeriod;
    const evi=d.breakdown.map(b=>`
      <div class="evi">
        <div class="top"><div class="tt">${esc(b.title)} <span class="badge ${b.book_type==='연재'?'b-orange':'b-gray'}">${esc(b.book_type||'-')}</span>${showMonth?` <span class="badge b-gray">${esc(b.period)}</span>`:''}</div>
          <div class="vv num">${won(b.settle)}원</div></div>
        <div class="meta">${esc(b.platform)}${b.label?' · 레이블 '+esc(b.label):''} · 원본 ${b.lines}행 집계</div>
        <div class="why">총매출 <b>${won(b.gross)}원</b> · 정산액 <b>${won(b.settle)}원</b> · 산출 근거 <b>${esc(b.basis||'제공값')}</b></div>
      </div>`).join('');
    const stmtOpts=`<option value="">전체 유통사</option>`+d.plat_sum.map(p=>`<option value="${esc(p.platform)}">${esc(p.platform)} (${won(p.settle)})</option>`).join('');
    const vnote=d.variants&&d.variants.length?` · 통합표기 ${d.variants.map(esc).join(', ')}`:'';
    openDrawer(`
      <div class="dh">
        <div class="dh-actions">
          <div class="selctl"><select id="stmtPlat" title="정산서 발행 대상 유통사">${stmtOpts}</select></div>
          <button class="btn btn-primary" onclick="App.issueStatement('${esc(d.author_key).replace(/'/g,"\\'")}')">${svg(I.doc)} 정산서 발행</button>
          <button class="btn" onclick="App.exportAuthor('${esc(d.author_key).replace(/'/g,"\\'")}')">${svg(I.upload).replace('M17 8l-5-5-5 5','M7 10l5 5 5-5').replace('M12 3v12','M12 15V3')} 엑셀</button>
          <button class="x" onclick="App.closeDrawer()">×</button>
        </div>
        <div class="nm">${esc(d.author)}</div>
        <div class="mt">${d.label?'레이블 '+esc(d.label)+' · ':''}작품 ${d.works}편 · 유통사 ${d.platforms}곳${S.platform?' · '+esc(S.platform)+' 기준':''}${vnote}</div></div>
      <div class="db">
        <div class="card hero"><div class="bd">
          <div class="label">지급 대상 정산액${_authorPeriod?' · '+pretty(_authorPeriod):' · 전체 기간'}</div>
          <div class="big">${won(d.total_settle)} <small>원</small></div>
          <div class="sub">총매출 ${won(d.total_gross)}원</div>
          <div style="margin-top:12px">${chips}</div>
        </div></div>
        <div class="segbar">${segHtml}</div>
        <div class="sec-h">정산 산출 내역 · 작품 × 유통사별 근거</div>
        ${evi?`<div class="evigrid">${evi}</div>`:'<div class="empty">해당 기간 근거 없음</div>'}
      </div>`);
  }

  async function openDist(platform){
    openDrawer(`<div class="loading"><div class="spin"></div></div>`);
    const all=await api(`/api/distributors?session=${S.session}${pq()}`);
    const d=all.find(x=>x.platform===platform)||{};
    const au=await api(`/api/authors?session=${S.session}&platform=${encodeURIComponent(platform)}${pq()}`);
    openDrawer(`
      <div class="dh">
        <div class="dh-actions"><button class="btn" onclick="App.viewDistAll('${esc(platform).replace(/'/g,"\\'")}')">이 유통사로 전체 보기</button>
          <button class="x" onclick="App.closeDrawer()">×</button></div>
        <div class="nm">${esc(platform)}</div><div class="mt">${S.period?pretty(S.period):'전체 기간'}</div></div>
      <div class="db">
        <div class="card hero"><div class="bd">
          <div class="label">정산액</div><div class="big">${won(d.settle)} <small>원</small></div>
          <div class="sub">총매출 ${won(d.gross)}원</div></div></div>
        <div class="grid" style="grid-template-columns:1fr 1fr 1fr;margin-top:16px">
          ${kpi(I.doc,'정산 행',(d.records||0).toLocaleString(),'건')}
          ${kpi(I.users,'작가',(d.authors||0).toLocaleString(),'명')}
          ${kpi(I.coin,'정산율(추정)',d.gross?Math.round(d.settle/d.gross*100)+'%':'—','매출 대비')}
        </div>
        <div class="sec-h" style="margin-top:22px">이 유통사 정산액 상위 작가 · ${au.length.toLocaleString()}명</div>
        <div class="card">${au.length?tblAuthor(au.slice(0,15)):'<div class="empty">작가 정보 없음</div>'}</div>
      </div>`);
  }
  function viewDistAll(platform){ closeDrawer(); S.platform=platform; go('author'); }

  // ══ 미매칭 ══
  let _excludeBundle=true, _mmView='ai';
  async function renderMismatch(){
    view().innerHTML=`<div id="mmTop"></div><div id="mmBody"><div class="loading"><div class="spin"></div></div></div>`;
    const eb=_excludeBundle?1:0;
    let q,sg,s;
    try{
      [q,sg,s]=await Promise.all([
        api(`/api/mismatch?session=${S.session}&exclude_bundle=${eb}`),
        api(`/api/suggestions?session=${S.session}&exclude_bundle=${eb}`),
        api(`/api/summary?session=${S.session}&exclude_bundle=${eb}`)
      ]);
    }catch(e){
      view().innerHTML=`<div class="card"><div class="empty">미매칭을 불러오지 못했습니다.<br>${esc(e.message||'')}<br><button class="btn" style="margin-top:10px" onclick="App.go('mismatch')">다시 시도</button> <button class="btn" onclick="App.go('upload')">샘플 다시 로드</button></div></div>`;
      return;
    }
    if(S.tab!=='mismatch') return;  // 렌더 경쟁 방지: 그 사이 다른 탭으로 갔으면 중단
    _mmData={q,sg,s};
    S.summary=Object.assign({},S.summary,{mismatch:s.mismatch}); renderNav();
    const toggle=`<label style="display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--sub);cursor:pointer">
      <input type="checkbox" ${_excludeBundle?'checked':''} onchange="App.toggleBundle(this.checked)" style="width:16px;height:16px;accent-color:var(--blue)">
      번들/구독 제외 <span class="badge b-gray">${s.bundle}건 · ${won(s.bundle_settle)}원</span></label>`;
    $('mmTop').innerHTML=`<div class="card" style="margin-bottom:14px"><div class="bd" style="padding:18px 20px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div><div class="t" style="font-size:15px;font-weight:800">미매칭 ${q.length}개 작품 · 정산액 ${won(s.mismatch_settle)}원 <span style="color:var(--mute);font-weight:600">(전체의 ${s.mismatch_settle_pct}%)</span></div>
          <div style="font-size:12px;color:var(--mute);margin-top:3px">AI가 다른 유통사·유사 작품에서 작가를 찾아 제안합니다. 승인하면 이후 모든 월에 자동 반영됩니다.</div></div>
        <div style="display:flex;align-items:center;gap:14px">${toggle}
          <button class="btn" onclick="App.openHistory()">${svg(I.doc)} 결정 히스토리</button></div>
      </div>
      <div class="segbar" style="margin:16px 0 0">
        <button class="seg ${_mmView==='ai'?'on':''}" data-mm="ai" onclick="App.setMmView('ai')">✨ AI 제안 <b>${sg.length}</b></button>
        <button class="seg ${_mmView==='noclue'?'on':''}" data-mm="noclue" onclick="App.setMmView('noclue')">단서 없음 <b>${q.length-sg.length}</b></button>
        <button class="seg ${_mmView==='all'?'on':''}" data-mm="all" onclick="App.setMmView('all')">전체 <b>${q.length}</b></button>
      </div></div></div>`;
    renderMmBody();
  }
  let _mmData=null;
  function setMmView(v){_mmView=v; renderMmBody();
    document.querySelectorAll('.segbar .seg[data-mm]').forEach(b=>b.classList.toggle('on',b.dataset.mm===v));}
  function mmReason(m){  // 단서 없음 사유
    if(m.platform_count===1) return `단독 유통 · ${esc(m.platforms[0])} (작가 정보 미제공)`;
    return '교차 단서 없음 (유사 작품 없음)';
  }
  function mmTable(rows,withReason){
    if(!rows.length)return `<div class="card"><div class="empty">해당 항목이 없습니다.</div></div>`;
    return `<div class="card"><table class="tbl"><thead><tr><th>작품 (정산서 원문)</th>${withReason?'<th>사유</th>':'<th>유통사</th>'}<th class="r">행수</th><th class="r">정산액</th><th class="r">전체 대비</th><th></th></tr></thead><tbody>${
      rows.map(m=>`<tr class="clk" onclick="App.openRegister('${esc(m.title_norm).replace(/'/g,"\\'")}','${esc(m.sample).replace(/'/g,"\\'")}')">
        <td><span class="av r">!</span><span class="nm">${esc(m.sample)}</span></td>
        <td style="color:var(--mute);font-size:12px">${withReason?mmReason(m):(m.platforms.slice(0,2).map(esc).join(', ')+(m.platform_count>2?` 외 ${m.platform_count-2}곳`:''))}</td>
        <td class="r num">${m.lines}</td><td class="r"><span class="v num">${won(m.settle)}</span></td>
        <td class="r num" style="color:var(--mute)">${m.pct_total>=0.01?m.pct_total+'%':'<0.01%'}</td>
        <td class="r"><span class="badge b-blue">등록</span></td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderMmBody(){
    const {q,sg}=_mmData;
    const sgKeys=new Set(sg.map(x=>x.title_norm));
    if(_mmView==='ai') return void($('mmBody').innerHTML=renderSuggestions(sg));
    if(_mmView==='noclue'){
      const no=q.filter(m=>!sgKeys.has(m.title_norm));
      const note=`<div class="card" style="margin-bottom:12px"><div class="bd" style="padding:16px 18px">
        <div style="font-size:12.5px;color:var(--sub);line-height:1.7">
        🔍 다른 유통사·유사 작품에 작가 단서가 <b>없는</b> 작품입니다 (대부분 단독 유통 신간). AI가 추측하지 않고 담당자 확인으로 넘긴 건들입니다.<br>
        · <b>출판사가 아는 작가를 직접 등록</b>하거나, 아래 <b>알라딘 도서 DB 자동 조회</b>로 작가·ISBN을 끌어와 제안받을 수 있습니다. <span style="color:var(--mute)">(승인 필수 · 자동 적용 안 함)</span></div>
        <button class="btn btn-primary" style="margin-top:12px" id="aladinBtn" onclick="App.enrichAladin()">${svg(I.search)} 알라딘에서 작가 자동 조회</button>
        </div></div>
        <div id="aladinBox"></div>`;
      $('mmBody').innerHTML=note+mmTable(no,true);
      return;
    }
    if(!q.length){$('mmBody').innerHTML=`<div class="card"><div class="empty">모든 작품이 매칭되었습니다.</div></div>`;return;}
    $('mmBody').innerHTML=mmTable(q,false);
  }
  function confColor(c){return c>=0.85?'#138a5e':(c>=0.7?'#2f6bff':'#c9740f');}
  function bulkBar(scope,n){return `<div class="card" style="margin-bottom:10px"><div class="bd" style="padding:11px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
    <label style="display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;cursor:pointer"><input type="checkbox" onclick="App.toggleAllPick('${scope}',this.checked)" style="width:16px;height:16px;accent-color:var(--blue)"> 전체 선택</label>
    <button class="btn" style="padding:6px 14px" onclick="App.approveSelected('${scope}')">선택 승인</button>
    <button class="btn btn-primary" style="padding:6px 14px" onclick="App.approveAll('${scope}')">전체 승인 (${n})</button>
    <span style="font-size:11.5px;color:var(--mute)">체크 후 ‘선택 승인’ · 모두 승인은 ‘전체 승인’</span></div></div>`;}
  function renderSuggestions(sg){
    if(!sg.length) return `<div class="card"><div class="empty">AI가 제안할 후보가 없습니다.<br><span style="font-size:12px">남은 미매칭은 ‘전체 미매칭’ 탭에서 수동 등록할 수 있습니다.</span></div></div>`;
    return bulkBar('ai',sg.length)+sg.map((x,i)=>`<div class="card" style="margin-bottom:10px" id="sg${i}"><div class="bd">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px">
        <div style="flex:1;min-width:0;display:flex;gap:10px;align-items:flex-start">
          <input type="checkbox" class="pick-ai" data-i="${i}" style="width:17px;height:17px;margin-top:2px;accent-color:var(--blue);flex-shrink:0">
         <div style="min-width:0">
          <div style="font-size:14.5px;font-weight:700">${esc(x.sample)}</div>
          <div style="font-size:11.5px;color:var(--mute);margin-top:2px">유통사 ${x.platform_count}곳 · ${x.lines}행 · 정산액 ${won(x.settle)}원</div>
        </div></div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:11px;color:var(--mute)">AI 신뢰도</div>
          <div style="font-size:17px;font-weight:800;color:${confColor(x.confidence)}">${Math.round(x.confidence*100)}%</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin:11px 0;padding:11px 14px;background:#f7f9fc;border:1px solid var(--line2);border-radius:10px">
        <div style="flex:1"><span style="font-size:11px;color:var(--mute)">제안</span>
          <div style="font-size:14px;font-weight:700">작가 ${esc(x.suggest_author)||'—'}${x.suggest_label?` <span style="color:var(--sub);font-weight:500">· 레이블 ${esc(x.suggest_label)}</span>`:''}</div></div>
      </div>
      <div style="font-size:12px;color:var(--sub);line-height:1.6">📎 ${esc(x.reason)}${x.ref_title?` <span style="color:var(--mute)">(근거 작품: <b>${esc(x.ref_title)}</b>)</span>`:''}</div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="App.decide(${i},'accept')">승인 — 작가·레이블 등록</button>
        <button class="btn" onclick="App.decide(${i},'reject')">거절</button>
        <button class="btn" onclick="App.openEvidence(${i})">🔎 제안 근거 보기</button>
        <button class="btn" onclick="App.openRegister('${esc(x.title_norm).replace(/'/g,"\\'")}','${esc(x.sample).replace(/'/g,"\\'")}')">직접 수정</button>
      </div></div></div>`).join('');
  }
  async function openEvidence(i){
    const x=_mmData.sg[i]; if(!x) return;
    openDrawer(`<div class="loading"><div class="spin"></div></div>`);
    let self;
    try{ self=await api(`/api/lab/origin?session=${S.session}&title_norm=${encodeURIComponent(x.title_norm)}`); }
    catch(e){ openDrawer(`<div class="dh"><div class="dh-actions"><button class="x" onclick="App.closeDrawer()">×</button></div><div class="nm">오류</div></div><div class="db"><div class="card"><div class="empty">근거를 불러오지 못했습니다.<br>${esc(e.message||'')}</div></div></div>`); return; }
    const srcBadge=s=>{const m={'원천제공':'b-green','당월대조':'b-blue','사용자등록':'b-orange','과거자산':'b-gray'}[s];return s?`<span class="badge ${m||'b-gray'}">${esc(s)}</span>`:'';};
    // ① 이 작품의 원본 (작가/출판사 미제공 확인)
    const selfRows=(self.rows||[]).map(r=>`<tr>
      <td>${esc(r.platform)}</td><td><span class="nm" style="font-size:12px">${esc(r.title_raw)}</span></td>
      <td>${esc(r.author)||'<span style="color:#c0392b;font-weight:700">미제공</span>'}</td>
      <td>${esc(r.label)||'<span style="color:#c0392b;font-weight:700">미제공</span>'}</td>
      <td class="r num">${won(r.settle)}</td><td style="font-size:11px;color:var(--mute)">${esc(r.source_file)}</td></tr>`).join('');
    // ② AI가 근거로 삼은 유사 작품들
    const cands=(x.candidates||[]).map(c=>`<tr>
      <td><span class="nm" style="font-size:12px">${esc(c.ref_title)}</span></td>
      <td><span class="badge b-gray">${esc(c.reason_type||'')}</span></td>
      <td class="r num">${Math.round((c.similarity||0)*100)}%</td>
      <td><b>${esc(c.author)||'—'}</b>${c.label?` · ${esc(c.label)}`:''}</td>
      <td class="r">${c.ref_key?`<button class="btn" style="padding:3px 9px;font-size:11px" onclick="App.openOrigin('${esc(c.ref_key).replace(/'/g,"\\'")}','근거: ${esc(c.ref_title).replace(/'/g,"\\'")}',${i})">원본</button>`:''}</td></tr>`).join('');
    openDrawer(`<div class="dh"><div class="dh-actions"><button class="x" onclick="App.closeDrawer()">×</button></div>
      <div class="nm">제안 근거 — ${esc(x.sample)}</div>
      <div class="mt">이 작품은 정산서 원본에 작가·출판사가 없어, 제목이 유사한 다른 작품에서 작가를 끌어와 제안합니다. 아래 ①에서 비어있음을 확인하고, ②의 유사 작품 근거로 판단하세요.</div></div>
      <div class="db">
        <div style="background:#f7f9fc;border:1px solid var(--line2);border-radius:10px;padding:11px 14px;margin-bottom:14px;font-size:12.5px">
          <b>AI 제안</b> 작가 <b>${esc(x.suggest_author)||'—'}</b>${x.suggest_label?` · 레이블 ${esc(x.suggest_label)}`:''} <span style="color:var(--mute)">(신뢰도 ${Math.round(x.confidence*100)}%)</span><br>
          <span style="color:var(--sub)">📎 ${esc(x.reason)}</span></div>
        <div class="sec-h">① 이 작품의 원본 (작가·출판사 미제공)</div>
        <div class="card"><table class="tbl"><thead><tr><th>유통사</th><th>원본 제목</th><th>작가</th><th>출판사</th><th class="r">정산액</th><th>원본 파일</th></tr></thead><tbody>${selfRows||'<tr><td colspan=6><div class="empty">없음</div></td></tr>'}</tbody></table></div>
        <div class="sec-h" style="margin-top:18px">② AI가 근거로 삼은 유사 작품</div>
        <div style="font-size:11.5px;color:var(--mute);margin-bottom:8px">제목이 비슷하면서 작가가 등록된 작품들. 유사도가 높고 같은 작가를 여러 건이 가리킬수록 신뢰도가 올라갑니다. ‘원본’으로 그 작가가 어느 시트·출처에서 왔는지 확인할 수 있습니다.</div>
        <div class="card"><table class="tbl"><thead><tr><th>유사 작품</th><th>유형</th><th class="r">유사도</th><th>등록된 작가·레이블</th><th></th></tr></thead><tbody>${cands||'<tr><td colspan=5><div class="empty">없음</div></td></tr>'}</tbody></table></div>
      </div>`);
  }
  async function decide(i,action){
    const x=_mmData.sg[i]; if(!x) return;
    const fd=new FormData();
    fd.append('session',S.session); fd.append('title_norm',x.title_norm); fd.append('action',action);
    fd.append('sample',x.sample); fd.append('confidence',x.confidence); fd.append('reason',x.reason);
    fd.append('exclude_bundle',_excludeBundle?1:0);
    if(action==='accept'){fd.append('author',x.suggest_author);fd.append('label',x.suggest_label);}
    const el=$('sg'+i); if(el){el.style.transition='.25s';el.style.opacity='.4';}
    const r=await fetch('/api/suggestions/decide',{method:'POST',body:fd});
    if(!r.ok){toast('처리 실패');if(el)el.style.opacity='1';return;}
    const d=await r.json(); S.summary=Object.assign({},S.summary,d.summary); renderNav();
    toast(action==='accept'?`승인 완료 · 남은 제안 ${d.remaining_suggestions}건`:'거절 기록됨');
    renderMismatch();
  }
  function toggleBundle(v){_excludeBundle=v; renderMismatch();}
  let _histAll=[], _histLatest={}, _histTab='decision';
  async function openHistory(){
    openDrawer(`<div class="loading"><div class="spin"></div></div>`);
    _histAll=await api(`/api/decisions?session=${S.session}`);
    _histLatest={}; _histAll.forEach(e=>{if(e.title_norm&&!(e.title_norm in _histLatest))_histLatest[e.title_norm]=e.action;});
    renderHistory();
  }
  function setHistTab(t){_histTab=t; renderHistory();}
  function renderHistory(){
    const h=_histAll, latest=_histLatest;
    const badge={'accept':'b-green','reject':'b-red','manual':'b-blue','restore':'b-gray'};
    const lab={'accept':'AI 승인','reject':'거절','manual':'수동 등록','restore':'복원'};
    // 결정 탭: 현재 유효한 결정만(복원 액션 제외 + 복원되지 않은 것) · 복원됨 탭: 복원 액션
    const decisions=h.filter(e=>e.action!=='restore' && latest[e.title_norm]!=='restore');
    const restores=h.filter(e=>e.action==='restore');
    const list=_histTab==='decision'?decisions:restores;
    const restorable=a=>a==='accept'||a==='manual'||a==='reject';
    const rows=list.length?list.map(e=>{
      const isRestored=latest[e.title_norm]==='restore';
      const canRestore=_histTab==='decision'&&restorable(e.action)&&!isRestored;
      const tn=esc(e.title_norm||'').replace(/'/g,"\\'"), sm=esc(e.sample||'').replace(/'/g,"\\'");
      return `<div class="evi" style="margin-bottom:8px">
      <div class="top" style="display:flex;align-items:center;gap:8px">
        ${canRestore?`<input type="checkbox" class="pick-hist" data-tn="${esc(e.title_norm)}" data-sample="${esc(e.sample||'')}" style="width:15px;height:15px;accent-color:var(--blue);flex-shrink:0">`:'<span style="display:inline-block;width:15px;flex-shrink:0"></span>'}
        <div class="tt" style="flex:1;min-width:0">${esc(e.sample||e.title_norm)}</div>
        <span class="badge ${badge[e.action]||'b-gray'}">${lab[e.action]||e.action}</span>
        ${(_histTab==='decision'&&isRestored)?'<span class="badge b-gray">복원됨</span>':''}</div>
      <div class="meta">${esc(e.ts)} · ${esc(e.by||'')}${e.confidence?` · 신뢰도 ${Math.round(e.confidence*100)}%`:''}</div>
      ${(e.author||e.label)?`<div class="why">작가 <b>${esc(e.author)||'—'}</b>${e.label?` · 레이블 <b>${esc(e.label)}</b>`:''}${e.reason?`<br>${esc(e.reason)}`:''}</div>`:(e.reason?`<div class="why">${esc(e.reason)}</div>`:'')}
      ${canRestore?`<div style="margin-top:7px"><button class="btn" style="padding:4px 12px;font-size:12px" onclick="App.restoreOne('${tn}','${sm}')">↩ 복원</button></div>`:''}
      </div>`;}).join(''):`<div class="empty">${_histTab==='decision'?'결정 기록이 없습니다.':'복원된 기록이 없습니다.'}</div>`;
    const tabs=`<div class="segbar" style="margin-bottom:12px">
      <button class="seg ${_histTab==='decision'?'on':''}" onclick="App.setHistTab('decision')">결정 <b>${decisions.length}</b></button>
      <button class="seg ${_histTab==='restored'?'on':''}" onclick="App.setHistTab('restored')">복원됨 <b>${restores.length}</b></button></div>`;
    const bar=(_histTab==='decision'&&decisions.length)?`<div style="display:flex;gap:8px;align-items:center;padding:0 0 11px;border-bottom:1px solid var(--line2);margin-bottom:11px;flex-wrap:wrap">
      <label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;cursor:pointer"><input type="checkbox" onclick="App.toggleAllHist(this.checked)" style="width:15px;height:15px;accent-color:var(--blue)"> 전체 선택</label>
      <button class="btn" style="padding:5px 13px;font-size:12.5px" onclick="App.restoreSelected()">↩ 선택 복원</button></div>`:'';
    openDrawer(`<div class="dh"><div class="dh-actions"><button class="x" onclick="App.closeDrawer()">×</button></div>
      <div class="nm">미매칭 결정 히스토리</div><div class="mt">승인·거절·수동 등록은 ‘결정’ 탭, 되돌린 이력은 ‘복원됨’ 탭. 복원 시 등록 전 매칭 상태로 환원되며 시간이 기록됩니다.</div></div>
      <div class="db">${tabs}${bar}${rows}</div>`);
  }
  function toggleAllHist(on){document.querySelectorAll('.pick-hist').forEach(c=>c.checked=on);}
  async function restoreOne(tn,sample){
    const reason=prompt('복원 사유 (선택사항) — 비워도 됩니다','');
    if(reason===null) return;
    const fd=new FormData();fd.append('session',S.session);fd.append('title_norm',tn);
    fd.append('sample',sample);fd.append('reason',reason);fd.append('exclude_bundle',_excludeBundle?1:0);
    const r=await fetch('/api/decisions/restore',{method:'POST',body:fd});
    if(!r.ok){toast('복원 실패');return;}
    const d=await r.json();S.summary=Object.assign({},S.summary,d.summary);renderNav();
    toast('복원 완료 — 등록 전 상태로 환원');await renderMismatch();openHistory();
  }
  async function restoreSelected(){
    const items=[...document.querySelectorAll('.pick-hist:checked')].map(c=>({title_norm:c.dataset.tn,sample:c.dataset.sample}));
    if(!items.length){toast('선택된 항목이 없습니다');return;}
    const reason=prompt(`${items.length}건 복원 — 사유 (선택사항)`,'');
    if(reason===null) return;
    const fd=new FormData();fd.append('session',S.session);fd.append('items',JSON.stringify(items));
    fd.append('reason',reason);fd.append('exclude_bundle',_excludeBundle?1:0);
    const r=await fetch('/api/decisions/restore_bulk',{method:'POST',body:fd});
    if(!r.ok){toast('일괄 복원 실패');return;}
    const d=await r.json();S.summary=Object.assign({},S.summary,d.summary);renderNav();
    toast(`${d.count}건 복원 완료`);await renderMismatch();openHistory();
  }
  // 일괄 승인 (AI 제안 / 알라딘 결과)
  function _pickItems(scope){
    const src=scope==='ai'?_mmData.sg:_aladin;
    return [...document.querySelectorAll('.pick-'+scope+':checked')].map(c=>{
      const x=src[+c.dataset.i];
      return {title_norm:x.title_norm,author:x.suggest_author,label:x.suggest_label,sample:x.sample,confidence:x.confidence,reason:x.reason};
    });
  }
  function toggleAllPick(scope,on){document.querySelectorAll('.pick-'+scope).forEach(c=>c.checked=on);}
  async function _bulkApprove(items){
    if(!items.length){toast('선택된 항목이 없습니다');return;}
    const fd=new FormData();fd.append('session',S.session);fd.append('action','accept');
    fd.append('items',JSON.stringify(items));fd.append('exclude_bundle',_excludeBundle?1:0);
    const r=await fetch('/api/suggestions/decide_bulk',{method:'POST',body:fd});
    if(!r.ok){toast('일괄 승인 실패');return;}
    const d=await r.json();S.summary=Object.assign({},S.summary,d.summary);renderNav();
    toast(`${d.count}건 승인 완료 · 남은 제안 ${d.remaining_suggestions}건`);renderMismatch();
  }
  function approveSelected(scope){_bulkApprove(_pickItems(scope));}
  function approveAll(scope){
    const src=scope==='ai'?_mmData.sg:_aladin;
    if(!src||!src.length){toast(scope==='aladin'?'먼저 알라딘 조회를 실행하세요':'승인할 제안이 없습니다');return;}
    if(!confirm(`${scope==='ai'?'AI 제안':'알라딘 결과'} ${src.length}건을 모두 승인할까요?`))return;
    _bulkApprove(src.map(x=>({title_norm:x.title_norm,author:x.suggest_author,label:x.suggest_label,sample:x.sample,confidence:x.confidence,reason:x.reason})));
  }
  let _aladin=[];
  async function enrichAladin(){
    const btn=$('aladinBtn'); if(btn){btn.disabled=true;btn.textContent='알라딘 조회 중… (약 10초)';}
    $('aladinBox').innerHTML=`<div class="loading"><div class="spin"></div>알라딘 도서 DB 조회 중…</div>`;
    try{
      const d=await api(`/api/enrich_aladin?session=${S.session}&limit=12&exclude_bundle=${_excludeBundle?1:0}`);
      _aladin=d.candidates||[];
      if(!d.ok){$('aladinBox').innerHTML=`<div class="card"><div class="empty">${esc(d.error||'조회 실패')}</div></div>`;return;}
      if(!_aladin.length){$('aladinBox').innerHTML=`<div class="card"><div class="empty">알라딘에서 일치하는 작가를 찾지 못했습니다 (${d.checked}건 조회). 플랫폼 독점작은 도서 DB에 없을 수 있습니다.</div></div>`;return;}
      $('aladinBox').innerHTML=`<div class="sec-h" style="margin-top:18px">알라딘 조회 결과 · ${_aladin.length}건 (${d.checked}건 중) — 승인하면 등록됩니다</div>`+
        bulkBar('aladin',_aladin.length)+
        _aladin.map((x,i)=>`<div class="card" style="margin-bottom:10px" id="al${i}"><div class="bd">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px">
            <div style="flex:1;min-width:0;display:flex;gap:10px;align-items:flex-start">
              <input type="checkbox" class="pick-aladin" data-i="${i}" style="width:17px;height:17px;margin-top:2px;accent-color:var(--blue);flex-shrink:0">
             <div style="min-width:0"><div style="font-size:14.5px;font-weight:700">${esc(x.sample)}</div>
              <div style="font-size:11.5px;color:var(--mute);margin-top:2px">유통사 ${x.platforms.join(', ')} · 정산액 ${won(x.settle)}원</div></div></div>
            <div style="text-align:right"><div style="font-size:11px;color:var(--mute)">제목 일치도</div>
              <div style="font-size:16px;font-weight:800;color:${confColor(x.confidence)}">${Math.round(x.match_score*100)}%</div></div></div>
          <div style="display:flex;align-items:center;gap:10px;margin:11px 0;padding:11px 14px;background:#eef3ff;border:1px solid #d7e0f5;border-radius:10px">
            <span class="badge b-blue">알라딘</span>
            <div style="font-size:14px;font-weight:700">작가 ${esc(x.suggest_author)}${x.suggest_label?` <span style="color:var(--sub);font-weight:500">· ${esc(x.suggest_label)}</span>`:''}</div>
            ${x.isbn?`<span style="margin-left:auto;font-size:11px;color:var(--mute)">ISBN ${esc(x.isbn)}</span>`:''}</div>
          <div style="font-size:12px;color:var(--sub)">📎 ${esc(x.reason)}</div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-primary" onclick="App.decideAladin(${i},'accept')">승인 — 등록</button>
            <button class="btn" onclick="App.decideAladin(${i},'reject')">거절</button></div>
        </div></div>`).join('');
    }catch(e){$('aladinBox').innerHTML=`<div class="card"><div class="empty">오류: ${esc(e.message)}</div></div>`;}
    if(btn){btn.disabled=false;btn.innerHTML=`${svg(I.search)} 다시 조회`;}
  }
  async function decideAladin(i,action){
    const x=_aladin[i]; if(!x)return;
    const fd=new FormData();
    fd.append('session',S.session); fd.append('title_norm',x.title_norm); fd.append('action',action);
    fd.append('sample',x.sample); fd.append('confidence',x.confidence);
    fd.append('reason',x.reason); fd.append('exclude_bundle',_excludeBundle?1:0);
    if(action==='accept'){fd.append('author',x.suggest_author);fd.append('label',x.suggest_label);}
    const el=$('al'+i); if(el){el.style.transition='.25s';el.style.opacity='.35';}
    const r=await fetch('/api/suggestions/decide',{method:'POST',body:fd});
    if(!r.ok){toast('처리 실패');if(el)el.style.opacity='1';return;}
    const d=await r.json(); S.summary=Object.assign({},S.summary,d.summary); renderNav();
    toast(action==='accept'?`승인 완료 · ${x.suggest_author} 등록`:'거절 기록됨');
  }
  function openRegister(tn,sample){
    openDrawer(`
      <div class="dh"><div class="dh-actions"><button class="x" onclick="App.closeDrawer()">×</button></div>
        <div class="nm">작가·레이블 등록</div><div class="mt">작품 단위 등록 — 모든 유통사·월에 적용</div></div>
      <div class="db">
        <div class="card"><div class="bd">
          <div class="field"><label>작품 (정산서 원문)</label><input id="rTitle" value="${esc(sample)}" readonly></div>
          <div class="field"><label>작가명</label><input id="rAuthor" placeholder="예: 정천"></div>
          <div class="field"><label>레이블 (출판사)</label><input id="rLabel" placeholder="예: 드림북스"></div>
          <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center" onclick="App.submitRegister('${esc(tn).replace(/'/g,"\\'")}','${esc(sample).replace(/'/g,"\\'")}')">등록하고 재매칭</button>
        </div></div>
        <div class="card" style="margin-top:12px"><div class="bd" style="padding:14px 18px">
          <div style="font-size:12px;color:var(--sub);line-height:1.7">💡 작가명을 모르면 <b>통합 검색</b>에서 이 작품을 찾아보세요. 다른 유통사 정산서에 작가 정보가 있으면 거기서 확인할 수 있습니다.<br>
          <span onclick="App.searchFromRegister('${esc(sample).replace(/'/g,"\\'")}')" style="color:var(--blue);font-weight:700;cursor:pointer">→ 이 작품 통합 검색</span></div>
        </div></div>
      </div>`);
    setTimeout(()=>$('rAuthor')&&$('rAuthor').focus(),300);
  }
  function searchFromRegister(sample){closeDrawer(); go('search'); setTimeout(()=>{const i=$('sq'); if(i){i.value=sample.replace(/\[[^\]]*\]/g,'').replace(/\s*\d+\s*[화권부].*$/,'').trim(); doSearch();}},100);}
  async function submitRegister(tn,sample){
    const author=$('rAuthor').value.trim(),label=$('rLabel').value.trim();
    if(!author&&!label){toast('작가 또는 레이블을 입력해 주세요');return;}
    const fd=new FormData();fd.append('session',S.session);fd.append('title_norm',tn);
    fd.append('author',author);fd.append('label',label);fd.append('sample',sample);
    fd.append('exclude_bundle',_excludeBundle?1:0);
    const r=await fetch('/api/mismatch/register',{method:'POST',body:fd});
    if(!r.ok){toast('등록 실패');return;}
    const d=await r.json(); S.summary=Object.assign({},S.summary,d.summary); renderNav();
    closeDrawer(); toast(`등록 완료 · 잔여 ${d.remaining}개 작품`); renderMismatch();
  }

  // ══ 연구소(Lab) — 신고·검토·규칙반영 루프 ══
  let _flagCtx=null;
  function flagItem(kind,key,sample,detail,value){
    _flagCtx={kind,key,sample,detail,value};
    openDrawer(`<div class="dh"><div class="dh-actions"><button class="x" onclick="App.closeDrawer()">×</button></div>
      <div class="nm">🚩 결과 신고</div><div class="mt">이상해 보이는 결과를 연구소에 기록 — 모아서 검토·규칙 반영</div></div>
      <div class="db"><div class="card"><div class="bd">
        <div class="field"><label>대상 (${esc(kind)})</label><input value="${esc(sample)}" readonly></div>
        <div class="field"><label>참고</label><input value="${esc(detail||'')}" readonly></div>
        <div class="field"><label>사유 분류</label>
          <select id="flagCat" style="width:100%;padding:10px;border:1px solid var(--line2);border-radius:8px;font-size:14px">
            <option value="동명이작">동명이작 — 다른 작품인데 합쳐짐</option>
            <option value="작가오류">작가 오류</option>
            <option value="레이블오류">레이블(출판사) 오류</option>
            <option value="번들오분류">번들/구독 오분류</option>
            <option value="구분오판">단행본/연재 오판</option>
            <option value="정산액의심">정산액/합산 의심</option>
            <option value="기타">기타</option></select></div>
        <div class="field"><label>메모 (선택)</label><textarea id="flagNote" placeholder="무엇이 이상한지 적어주세요" style="width:100%;min-height:70px;padding:10px;border:1px solid var(--line2);border-radius:8px;font-size:14px;font-family:inherit"></textarea></div>
        <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center" onclick="App.submitFlag()">신고 기록</button>
      </div></div></div>`);
  }
  async function submitFlag(){
    if(!_flagCtx)return; const c=_flagCtx;
    const fd=new FormData();fd.append('session',S.session);fd.append('kind',c.kind);fd.append('key',c.key);
    fd.append('sample',c.sample);fd.append('category',$('flagCat').value);fd.append('note',($('flagNote').value||'').trim());fd.append('value',c.value||'');
    const r=await fetch('/api/flag',{method:'POST',body:fd});
    if(!r.ok){toast('신고 실패');return;}
    closeDrawer();toast('신고 기록됨 · 연구소에서 검토');
  }
  async function flagSuspect(tn,sample,note,risk){
    const fd=new FormData();fd.append('session',S.session);fd.append('kind','자동탐지');fd.append('key',tn);
    fd.append('sample',sample);fd.append('category','동명이작');fd.append('note',note);fd.append('value',risk);
    const r=await fetch('/api/flag',{method:'POST',body:fd});
    if(!r.ok){toast('등록 실패');return;}
    toast('신고함에 등록됨');renderLab();
  }
  const FLAG_ST=['열림','검토중','규칙반영','기각'];
  // 오류 유형 카탈로그 — E1만 자동탐지 활성, 나머지는 준비중(틀만)
  const E_TYPES=[
    {code:'E1',name:'동명이작 과병합',active:true},
    {code:'E2',name:'작가 표기변형',active:false},
    {code:'E3',name:'출판사 표기변형',active:false},
    {code:'E6',name:'단행본/연재 오판',active:false},
    {code:'E8',name:'합계 검증 사각',active:false},
    {code:'E9',name:'정산액 추정오차',active:false},
  ];
  let _labFilter='E1', _labData=null;
  async function renderLab(){
    view().innerHTML=`<div id="labBody"><div class="loading"><div class="spin"></div></div></div>`;
    const [flags,sus]=await Promise.all([
      api(`/api/flags?session=${S.session}`),
      api(`/api/lab/suspects?session=${S.session}&detector=homonym&limit=80`)
    ]);
    _labData={flags,items:sus.items||[]};
    const openN=flags.filter(f=>f.status!=='규칙반영'&&f.status!=='기각').length;
    // 안내: 무엇이 어떻게 들어오고 등록 후 어떻게 흐르는지
    const intro=`<div class="card" style="margin-bottom:14px"><div class="bd" style="padding:16px 20px">
      <div class="t" style="font-size:15px;font-weight:800">🔬 매칭 오류 연구소</div>
      <div style="font-size:12.5px;color:var(--sub);margin-top:6px;line-height:1.75">
        매칭이 틀릴 수 있는 사례를 모아 <b>검토 → 진단 → 규칙 반영</b>하는 상시 루프입니다.<br>
        <b>다루는 대상은 ‘오(誤)매칭’입니다 — 작가·출판사를 못 찾은 ‘미매칭’이 아니라, 매칭은 됐으나(완전매칭) 제목이 같아 다른 작품끼리 잘못 합쳐진 건</b>입니다. 완전매칭률만으로는 보이지 않는 정확도의 마지막 오차를 잡습니다.<br>
        <b>들어오는 경로</b> ① <b>자동 탐지</b>: 한 작품에 작가 그룹이 2개 이상이고 출판사가 서로 겹치지 않으면 ‘제목만 같은 다른 작품’으로 시스템이 자동 적출 &nbsp;②&nbsp;<b>담당자 신고</b>: 결과 화면의 🚩<br>
        <b>등록 후 흐름</b> <span class="badge b-orange">열림</span> → <span class="badge b-orange">검토중</span> → <span class="badge b-green">규칙반영</span>(분리·통합 확정) 또는 <span class="badge b-gray">기각</span>(같은 작품이었음). 모든 결정은 진단 메모와 함께 이력으로 남습니다.</div>
      <div style="font-size:12px;color:var(--mute);margin-top:8px">신고함 ${flags.length}건(미처리 ${openN}) · 자동탐지(E1) ${(_labData.items).length}건</div>
      </div></div>`;
    // 유형 필터 탭 (E1 활성 / 나머지 준비중)
    const cnt=c=>c==='E1'?_labData.items.length:0;
    const tabs=`<div class="segbar" style="margin-bottom:12px">`+E_TYPES.map(t=>
      `<button class="seg ${_labFilter===t.code?'on':''} ${t.active?'':'seg-dim'}" onclick="App.setLabFilter('${t.code}')" title="${t.active?'':'준비중 — 다음 작업'}">${t.code} ${esc(t.name)} <b>${t.active?cnt(t.code):'–'}</b></button>`
    ).join('')+`</div>`;
    $('labBody').innerHTML=intro
      +`<div class="sec-h">자동 탐지 — 의심 사례</div>${tabs}<div id="labSus"></div>`
      +`<div class="sec-h" style="margin-top:22px">신고함 — 검토·진단·규칙반영</div><div id="labFlags"></div>`;
    renderLabSus(); renderLabFlags();
  }
  function setLabFilter(code){const t=E_TYPES.find(x=>x.code===code); if(t&&!t.active){toast(t.code+' 자동탐지는 다음 작업입니다');return;} _labFilter=code; document.querySelectorAll('.segbar .seg').forEach(b=>{}); renderLab();}
  function renderLabSus(){
    const items=_labData.items;
    if(_labFilter!=='E1'){$('labSus').innerHTML=`<div class="card"><div class="empty">${_labFilter} 자동 탐지기는 다음 작업으로 예정되어 있습니다.</div></div>`;return;}
    if(!items.length){$('labSus').innerHTML=`<div class="card"><div class="empty">자동 탐지된 동명이작 의심이 없습니다.</div></div>`;return;}
    $('labSus').innerHTML=items.map((x,i)=>`<div class="card" style="margin-bottom:8px"><div class="bd">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px">${esc(x.sample)} <span class="badge b-blue">동명이작 의심</span></div>
          <div style="font-size:12px;color:var(--sub);margin-top:5px">${x.clusters.map(c=>`작가 <b>${esc(c.author)}</b> / ${esc(c.labels.join(',')||'출판사미상')} <span style="color:var(--mute)">(${won(c.settle)}원)</span>`).join(' &nbsp;⟷&nbsp; ')}</div>
          <div style="font-size:11.5px;color:var(--mute);margin-top:4px">제목은 같지만 작가·출판사가 서로 달라 다른 작품으로 의심됩니다.</div></div>
        <div style="text-align:right;flex-shrink:0"><div style="font-size:11px;color:var(--mute)">오귀속 위험액(원)</div><div style="font-weight:800;color:#c0392b">${won(x.risk)}</div></div></div>
      <div style="display:flex;gap:8px;margin-top:11px">
        <button class="btn" style="padding:5px 12px;font-size:12px" onclick="App.openOrigin('${esc(x.title_norm).replace(/'/g,"\\'")}','${esc(x.sample).replace(/'/g,"\\'")}')">🔎 원본 내역 보기</button>
        <button class="btn" style="padding:5px 12px;font-size:12px" onclick="App.flagSuspect('${esc(x.title_norm).replace(/'/g,"\\'")}','${esc(x.sample).replace(/'/g,"\\'")}','${x.clusters.map(c=>esc(c.author)+'/'+esc(c.labels.join(','))).join(' vs ').replace(/'/g,"\\'")}',${x.risk})">🚩 신고함에 등록</button>
      </div></div></div>`).join('');
  }
  function renderLabFlags(){
    const flags=_labData.flags;
    if(!flags.length){$('labFlags').innerHTML=`<div class="card"><div class="empty">신고 내역이 없습니다. 자동 탐지의 ‘신고함에 등록’ 또는 작품별·작가별 화면의 🚩로 신고하세요.</div></div>`;return;}
    const bar=`<div style="display:flex;gap:8px;align-items:center;padding:0 2px 11px;flex-wrap:wrap">
      <label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;cursor:pointer"><input type="checkbox" onclick="App.toggleAllFlag(this.checked)" style="width:15px;height:15px;accent-color:var(--blue)"> 전체 선택</label>
      <span style="font-size:12px;color:var(--mute)">선택 항목을</span>
      <button class="btn" style="padding:4px 11px;font-size:12px" onclick="App.bulkFlagStatus('규칙반영')">규칙반영</button>
      <button class="btn" style="padding:4px 11px;font-size:12px" onclick="App.bulkFlagStatus('기각')">기각</button>
      <button class="btn" style="padding:4px 11px;font-size:12px" onclick="App.bulkFlagStatus('검토중')">검토중</button>
      <span style="font-size:11.5px;color:var(--mute)">으로 일괄 반영</span></div>`;
    const rows=flags.slice().reverse().map(f=>`<div class="card" style="margin-bottom:8px"><div class="bd">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
        <div style="flex:1;min-width:0;display:flex;gap:9px;align-items:center">
          <input type="checkbox" class="pick-flag" data-id="${esc(f.id)}" style="width:15px;height:15px;accent-color:var(--blue);flex-shrink:0">
          <div style="min-width:0"><span class="badge b-blue">${esc(f.category)}</span> <span class="badge b-gray">${esc(f.kind)}</span> <b style="font-size:13.5px">${esc(f.sample)}</b></div></div>
        <span class="badge ${f.status==='규칙반영'?'b-green':(f.status==='기각'?'b-gray':'b-orange')}">${esc(f.status)}</span></div>
      ${f.note?`<div style="font-size:12.5px;color:var(--sub);margin-top:6px">${esc(f.note)}</div>`:''}
      <div style="font-size:11px;color:var(--mute);margin-top:4px">${esc(f.ts)} · ${esc(f.by||'')}</div>
      <div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap;align-items:center">
        ${f.key?`<button class="btn" style="padding:5px 11px;font-size:12px" onclick="App.openOrigin('${esc(f.key).replace(/'/g,"\\'")}','${esc(f.sample).replace(/'/g,"\\'")}')">🔎 원본</button>`:''}
        <select id="st_${f.id}" style="padding:5px 8px;border:1px solid var(--line2);border-radius:7px;font-size:12px">${FLAG_ST.map(s=>`<option ${f.status===s?'selected':''}>${s}</option>`).join('')}</select>
        <input id="dg_${f.id}" placeholder="진단/조치 메모" value="${esc(f.diagnosis||'')}" style="flex:1;min-width:120px;padding:5px 8px;border:1px solid var(--line2);border-radius:7px;font-size:12px">
        <button class="btn" style="padding:5px 12px;font-size:12px" onclick="App.saveFlag(this)">저장</button></div>
    </div></div>`).join('');
    $('labFlags').innerHTML=bar+rows;
  }
  function toggleAllFlag(on){document.querySelectorAll('.pick-flag').forEach(c=>c.checked=on);}
  async function bulkFlagStatus(status){
    const ids=[...document.querySelectorAll('.pick-flag:checked')].map(c=>c.dataset.id);
    if(!ids.length){toast('선택된 신고가 없습니다');return;}
    const fd=new FormData();fd.append('session',S.session);fd.append('ids',JSON.stringify(ids));fd.append('status',status);
    const r=await fetch('/api/flags/update_bulk',{method:'POST',body:fd});
    if(!r.ok){toast('일괄 반영 실패');return;}
    const d=await r.json();toast(`${d.count}건 ‘${status}’ 반영`);renderLab();
  }
  async function openOrigin(tn,sample,backIdx){
    openDrawer(`<div class="loading"><div class="spin"></div></div>`);
    let d;
    try{ d=await api(`/api/lab/origin?session=${S.session}&title_norm=${encodeURIComponent(tn)}`); }
    catch(e){ openDrawer(`<div class="dh"><div class="dh-actions"><button class="x" onclick="App.closeDrawer()">×</button></div><div class="nm">오류</div></div><div class="db"><div class="card"><div class="empty">원본을 불러오지 못했습니다.<br>${esc(e.message||'')}</div></div></div>`); return; }
    const backBtn=(backIdx!=null&&backIdx!=='')?`<button class="btn" style="padding:4px 11px;font-size:12px;margin-right:auto" onclick="App.openEvidence(${backIdx})">← 뒤로</button>`:'';
    const srcBadge=s=>{const m={'원천제공':'b-green','당월대조':'b-blue','사용자등록':'b-orange','과거자산':'b-gray'}[s];
      return s?`<span class="badge ${m||'b-gray'}">${esc(s)}</span>`:'';};
    const rows=(d.rows||[]).map(r=>`<tr>
      <td>${esc(r.platform)}</td>
      <td><span class="nm" style="font-size:12.5px">${esc(r.title_raw)}</span></td>
      <td>${esc(r.author)||'<span style="color:var(--mute)">—</span>'} ${srcBadge(r.author_src)}</td>
      <td>${esc(r.label)||'<span style="color:var(--mute)">—</span>'}</td>
      <td class="r num">${won(r.settle)}</td>
      <td style="font-size:11px;color:var(--mute)">${r.source_file?esc(r.source_file):(r.author_src==='과거자산'?'2022 수작업 시드(원본 파일 없음)':'—')}</td></tr>`).join('');
    openDrawer(`<div class="dh"><div class="dh-actions">${backBtn}<button class="x" onclick="App.closeDrawer()">×</button></div>
      <div class="nm">원본 내역 — ${esc(sample)}</div><div class="mt">표준화 이전, 유통사가 보낸 그대로. 같은 제목이 어느 유통사에서 어떤 작가·출판사로, 어느 파일에 들어왔는지로 판단합니다. 작가 옆 배지는 출처(원천제공=정산서에 직접 / 당월대조=다른 유통사에서 채움 / 과거자산=2022 시드 / 사용자등록=수동). 총 정산액 ${won(d.total_settle)}원</div></div>
      <div class="db"><div class="card"><table class="tbl"><thead><tr><th>유통사</th><th>원본 제목</th><th>작가(출처)</th><th>출판사</th><th class="r">정산액</th><th>원본 파일(시트)</th></tr></thead><tbody>${rows||'<tr><td colspan=6><div class="empty">내역 없음</div></td></tr>'}</tbody></table></div></div>`);
  }
  async function saveFlag(btn){
    const bd=btn.closest('.bd'); if(!bd){toast('저장 대상을 찾지 못했습니다');return;}
    const sel=bd.querySelector('select'), inp=bd.querySelector('input[placeholder="진단/조치 메모"]'), cb=bd.querySelector('.pick-flag');
    const id=cb?cb.dataset.id:null;
    if(!id||!sel){toast('저장 대상 오류');return;}
    const fd=new FormData();fd.append('session',S.session);fd.append('id',id);
    fd.append('status',sel.value);fd.append('diagnosis',(inp?inp.value:'').trim());
    const r=await fetch('/api/flags/update',{method:'POST',body:fd});
    if(!r.ok){toast('저장 실패');return;}
    toast('저장됨');renderLab();
  }

  // ══ 통합 검색 ══
  function renderSearch(){
    view().innerHTML=`
      <div style="margin-bottom:16px">
        <div class="search" style="max-width:520px">${svg(I.search)}<input id="sq" placeholder="작가명 또는 작품명 검색 (예: 월야환담, 홍정훈)" onkeydown="if(event.key==='Enter')App.doSearch()" oninput="App.searchDebounce()"></div>
        <div style="font-size:12px;color:var(--mute);margin-top:8px">같은 작품이 어느 유통사에 어떤 작가로 들어있는지 한눈에 확인 — 미매칭 작품의 작가를 다른 유통사 자료에서 찾을 때 유용합니다.</div>
      </div>
      <div id="searchResult"><div class="empty">검색어를 입력하세요.</div></div>`;
  }
  let _st; function searchDebounce(){clearTimeout(_st);_st=setTimeout(doSearch,350);}
  async function doSearch(){
    const q=$('sq').value.trim();
    if(!q){$('searchResult').innerHTML=`<div class="empty">검색어를 입력하세요.</div>`;return;}
    $('searchResult').innerHTML=`<div class="loading"><div class="spin"></div></div>`;
    const d=await api(`/api/search?session=${S.session}&q=${encodeURIComponent(q)}${pq()}`);
    const authorCard = d.authors.length?`
      <div class="card" style="margin-bottom:16px"><div class="hd"><div class="t">작가 검색 결과 · ${d.authors.length}명</div></div>
      ${tblAuthor(d.authors.slice(0,10))}</div>`:'';
    const workRows=d.works.map(wv=>{
      const auth = wv.authors.length?`<span class="nm">${wv.authors.map(esc).join(', ')}</span>`:`<span class="badge b-red">작가 미상</span>`;
      const plats = wv.platforms.map(p=>`<span class="badge ${p.has_author?'b-green':'b-gray'}" title="${p.has_author?'이 유통사에 작가정보 있음':'작가정보 없음'}" style="margin:0 4px 4px 0">${esc(p.platform)} ${won(p.settle)}${p.has_author?' ✓':''}</span>`).join('');
      const stB={'완전':'b-green','작가만':'b-blue','미매칭':'b-red','확인필요':'b-orange'}[wv.status]||'b-gray';
      return `<div class="card" style="margin-bottom:10px"><div class="bd">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div><div style="font-size:15px;font-weight:700">${esc(wv.title)} <span class="badge ${stB}">${wv.status}</span></div>
            <div style="font-size:12px;color:var(--mute);margin-top:3px">작가 ${auth} · 레이블 ${wv.labels.length?wv.labels.map(esc).join(', '):'—'} · 유통사 ${wv.platform_count}곳 · 표기 ${wv.variant_count}종 · ${wv.lines}행 · ${wv.periods.join(', ')}</div></div>
          <div style="text-align:right;flex-shrink:0"><div style="font-size:17px;font-weight:800;letter-spacing:-.02em">${won(wv.settle)}<span style="font-size:12px;color:var(--mute)">원</span></div></div>
        </div>
        <div style="margin-top:10px">${plats}</div>
        <div style="margin-top:8px;font-size:11.5px;color:var(--mute)">표기 변형: ${wv.variants.map(esc).join(' · ')}${wv.variant_count>wv.variants.length?' …':''}</div>
        ${(wv.status==='미매칭'||!wv.authors.length)?`<div style="margin-top:10px"><button class="btn" onclick="App.openRegister('${esc(wv.title_norm).replace(/'/g,"\\'")}','${esc(wv.variants[0]||wv.title).replace(/'/g,"\\'")}')">이 작품 작가·레이블 등록</button></div>`:''}
      </div></div>`;
    }).join('');
    $('searchResult').innerHTML=authorCard+
      `<div class="sec-h">작품 검색 결과 · ${d.work_total.toLocaleString()}건${d.work_total>d.works.length?` (상위 ${d.works.length} 표시)`:''}</div>`+
      (workRows||`<div class="empty">일치하는 작품이 없습니다.</div>`);
  }

  // ══ 엑셀·정산서 ══
  function exportXlsx(){toast('엑셀 생성 중…');window.location=`/api/export?session=${S.session}`;}
  function exportAuthor(key){
    toast('내역 생성 중…');
    const pp=_authorPeriod?`&period=${_authorPeriod}`:'';
    const plat=$('stmtPlat')&&$('stmtPlat').value?`&platform=${encodeURIComponent($('stmtPlat').value)}`:'';
    window.location=`/api/author_export?session=${S.session}&name=${encodeURIComponent(key)}${pp}${plat}`;
  }
  function issueStatement(key){
    const pp=_authorPeriod?`&period=${_authorPeriod}`:'';
    const plat=$('stmtPlat')&&$('stmtPlat').value?`&platform=${encodeURIComponent($('stmtPlat').value)}`:'';
    window.open(`/api/statement?session=${S.session}&name=${encodeURIComponent(key)}${pp}${plat}`,'_blank');
  }

  // ── 드로어 ──
  function openDrawer(html){$('drawer').innerHTML=html;$('drawer').classList.add('show');$('scrim').classList.add('show');}
  function closeDrawer(){$('drawer').classList.remove('show');$('scrim').classList.remove('show');}

  return {init,go,shiftMonth,setPlatform,openAuthor,openDist,viewDistAll,openWork,searchWork,openRegister,submitRegister,
          toggleBundle,setMmView,decide,enrichAladin,decideAladin,openHistory,toggleVol,closeDrawer,searchAuthor,renderSearch,doSearch,searchDebounce,searchFromRegister,
          toggleAllPick,approveSelected,approveAll,openEvidence,toggleAllHist,restoreOne,restoreSelected,setHistTab,
          flagItem,submitFlag,flagSuspect,renderLab,saveFlag,setLabFilter,toggleAllFlag,bulkFlagStatus,openOrigin,
          exportXlsx,exportAuthor,issueStatement};
})();
document.addEventListener('DOMContentLoaded',App.init);

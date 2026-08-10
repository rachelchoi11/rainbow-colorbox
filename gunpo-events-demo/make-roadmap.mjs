#!/usr/bin/env node
/**
 * 군포 독서교육 단계별 도달 전략 로드맵 패널 (발표용 인포그래픽).
 * gg-infra.json(경기데이터드림 군포 실측) + chaekkumaru.json(실시간 스크래핑)을 읽어
 * 1·2·3차 도달을 실데이터로 채운다. → gunpo-roadmap.html
 *
 * 실행: node make-roadmap.mjs   (먼저 prep-gg-datasets.py 실행 필요)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const infra = JSON.parse(readFileSync(new URL('./gg-infra.json', import.meta.url), 'utf-8'));
let chaekCount = 0;
try { chaekCount = JSON.parse(readFileSync(new URL('./chaekkumaru.json', import.meta.url), 'utf-8')).count || 0; } catch {}

const sl = infra.schoolLibrary || {};
const elem = sl.byLevel?.['초등학교'] || 0;
const mid = sl.byLevel?.['중학교'] || 0;
const high = sl.byLevel?.['고등학교'] || 0;
const spaces = (infra.learningSpaces || []).length;
const care = infra.careCenters || {};
const childCases = infra.welfare?.childCasesUnder18 || 0;
const ds = infra.dreamStart?.budgetThousandWon || 0;
const dsEok = (ds / 100000).toFixed(2); // 천원 → 억원
const won = (n) => n.toLocaleString('ko-KR');

const phases = [
  {
    no: '1차', tag: '진입 · Beachhead', color: '#FBBF24', ink: '#3a2a00',
    head: '군포 초등학교 직접 진입', big: `초등 ${elem}개교`,
    sub: `학교도서관 연계 · 연 ${won(sl.loanItems || 0)}권 대출`,
    rows: [
      ['연계', '군포의왕교육지원청 · 학교도서관 47개교'],
      ['핏치 제공', '독후활동지 9종 + AI 독서토론 + 사고력 진단'],
      ['확장', `중학교 ${mid} · 고등학교 ${high} (총 47개교)`],
    ],
  },
  {
    no: '2차', tag: '확장 · 돌봄', color: '#0A7373', ink: '#fff',
    head: '학습·돌봄 거점 + 취약계층', big: `거점 ${spaces + (care.count || 0)}곳`,
    sub: `학습공간 ${spaces} + 다함께돌봄 ${care.count || 0} (정원 ${care.capacityTotal || 0})`,
    rows: [
      ['연계', '방과후·돌봄 독서 프로그램 · 맞춤 독후활동지'],
      ['Buy-One-Give-One', `취약계층 아동 무료 — 18세미만 수급 ${won(childCases)}건`],
      ['공공 연계', `드림스타트 사업비 ${dsEok}억원`],
    ],
  },
  {
    no: '3차', tag: '전 시민 · 접근성', color: '#0A4747', ink: '#fff',
    head: '전 시민·시니어·접근성', big: '전 시민',
    sub: '그림책꿈마루 · 시립도서관 · 평생학습원',
    rows: [
      ['연계', `그림책꿈마루 실시간 연계(${chaekCount}건 수집) · 시립도서관`],
      ['접근성', '책나래 서비스 → 장애인·거동불편 시민'],
      ['핏치 제공', '두뇌친구(시니어 인지) · 말친구(아동 언어)'],
    ],
  },
];

const phaseCard = (p) => `
  <div class="phase">
    <div class="ph-head" style="background:${p.color};color:${p.ink}">
      <span class="ph-no">${p.no}</span><span class="ph-tag">${p.tag}</span>
    </div>
    <div class="ph-body">
      <div class="ph-title">${p.head}</div>
      <div class="ph-big" style="color:${p.color === '#FBBF24' ? '#B45309' : p.color}">${p.big}</div>
      <div class="ph-sub">${p.sub}</div>
      <div class="ph-rows">
        ${p.rows.map(([k, v]) => `<div class="ph-row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
      </div>
    </div>
  </div>`;

const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"/>
<style>
  :root{--primary:#0A4747;--primary2:#0A7373;--accent:#FBBF24;--ink:#0F172A;--slate:#475569;--line:#E2E8F0}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Pretendard Variable',sans-serif;background:#fff;color:var(--ink);width:1180px;word-break:keep-all}
  .wrap{padding:34px 40px 30px}
  .htitle{font-size:14px;font-weight:800;letter-spacing:3px;color:var(--primary2)}
  h1{font-size:32px;font-weight:900;letter-spacing:-1px;margin-top:6px;line-height:1.25}
  h1 b{color:var(--primary2)}
  .hsub{margin-top:8px;font-size:15px;color:var(--slate)}
  .data-strip{margin:18px 0 4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .data-strip .lbl{font-size:11px;font-weight:800;color:#94A3B8;letter-spacing:.5px}
  .chip{font-size:12.5px;font-weight:700;background:#F1F5F9;border:1px solid var(--line);padding:6px 12px;border-radius:999px;color:#334155}
  .chip b{color:var(--primary2)}
  .phases{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:20px;position:relative}
  .phase{border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.05)}
  .ph-head{padding:14px 18px;display:flex;align-items:center;gap:10px}
  .ph-no{font-size:20px;font-weight:900}
  .ph-tag{font-size:13px;font-weight:800;opacity:.92}
  .ph-body{padding:18px;display:flex;flex-direction:column;gap:9px;flex:1}
  .ph-title{font-size:17px;font-weight:900;color:var(--primary)}
  .ph-big{font-size:34px;font-weight:900;letter-spacing:-1.5px;line-height:1}
  .ph-sub{font-size:12.5px;color:var(--slate);margin-top:-2px}
  .ph-rows{margin-top:6px;display:flex;flex-direction:column;gap:7px}
  .ph-row{display:flex;gap:8px;align-items:flex-start}
  .ph-row .k{flex-shrink:0;font-size:11px;font-weight:800;color:#fff;background:var(--primary);padding:3px 8px;border-radius:6px;white-space:nowrap}
  .ph-row .v{font-size:12.5px;color:#334155;line-height:1.45;font-weight:500}
  /* 타임라인 */
  .tl{margin-top:22px;background:#F8FAFC;border:1px solid var(--line);border-radius:14px;padding:16px 20px}
  .tl-h{font-size:13px;font-weight:900;color:var(--primary);margin-bottom:12px;display:flex;align-items:center;gap:7px}
  .tl-h .dot{width:8px;height:8px;border-radius:50%;background:var(--accent)}
  .tl-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .q{border-radius:10px;padding:10px 12px;font-size:12.5px;font-weight:700}
  .q b{display:block;font-size:12px;font-weight:900;margin-bottom:3px}
  .q1{background:#FEF3C7;color:#92400E}.q2{background:#CCFBF1;color:#0F766E}.q3{background:#CCFBF1;color:#0F766E}.q4{background:#E0F2F1;color:#0A4747}
  .foot{margin-top:18px;border-top:1px solid var(--line);padding-top:12px;font-size:11.5px;color:#94A3B8;display:flex;justify-content:space-between}
  .foot b{color:#64748B}
</style></head><body>
<div class="wrap">
  <div class="htitle">GUNPO READING ROLLOUT · 실측 데이터 기반</div>
  <h1>군포 독서교육 <b>단계별 도달 전략</b></h1>
  <div class="hsub">경기데이터드림 군포 실측 데이터 + 그림책꿈마루 실시간 연계로 설계한 1·2·3차 도달</div>

  <div class="data-strip">
    <span class="lbl">실측(2025)</span>
    <span class="chip">학교도서관 <b>47</b>개교</span>
    <span class="chip">연 대출 <b>${won(sl.loanItems || 0)}</b>권</span>
    <span class="chip">학습공간 <b>${spaces}</b>곳</span>
    <span class="chip">다함께돌봄 <b>${care.count || 0}</b>곳</span>
    <span class="chip">책나래 <b>${(infra.chaekNarae || []).length}</b></span>
    <span class="chip">드림스타트 <b>${dsEok}</b>억</span>
  </div>

  <div class="phases">
    ${phases.map(phaseCard).join('')}
  </div>

  <div class="tl">
    <div class="tl-h"><span class="dot"></span>1년차 분기별 로드맵</div>
    <div class="tl-bar">
      <div class="q q1"><b>Q1</b>1차 — 초등 ${elem}개교 파일럿 + 독후활동지 공급</div>
      <div class="q q2"><b>Q2</b>2차 진입 — 돌봄·학습공간 거점 연계</div>
      <div class="q q3"><b>Q3</b>2차 확장 — Buy-One-Give-One 취약아동</div>
      <div class="q q4"><b>Q4</b>3차 — 전 시민·시니어·접근성 확대</div>
    </div>
  </div>

  <div class="foot">
    <span>출처: 경기데이터드림(군포 필터, 2025) · 그림책꿈마루 gunpo.go.kr/picturebook 실시간 스크래핑</span>
    <span><b>핏치 Pitch</b> · 수치는 군포 실측 데이터 (수급 건수는 자격 중복 가능)</span>
  </div>
</div>
</body></html>`;

writeFileSync(new URL('./gunpo-roadmap.html', import.meta.url), html);
console.log('  → gunpo-roadmap.html 생성 (실데이터 반영)');

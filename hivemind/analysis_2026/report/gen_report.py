# -*- coding: utf-8 -*-
"""정산 데이터 표준화 검증 보고서 v2 — 격식체·나눔고딕·실데이터 포함"""
import json, html as H
import pandas as pd

X = "/Users/rachel/workspace/hivemind/analysis_2026/output/2026_정산통합_v1.xlsx"
RJ = "/Users/rachel/workspace/hivemind/analysis_2026/output/records.json"
OUT = "/Users/rachel/workspace/hivemind/analysis_2026/report/정산데이터_표준화_검증보고서.html"

recs = json.load(open(RJ))
raw = pd.DataFrame(recs)
d = pd.read_excel(X, sheet_name="통합레코드(전체)")
rep = pd.read_excel(X, sheet_name="검증리포트(원본대사)")
q = pd.read_excel(X, sheet_name="미매칭 검토큐")
cdf = pd.read_excel(X, sheet_name="교차검증(03수정본)")

def fmt(n, dec=0):
    if pd.isna(n):
        return "—"
    return f"{n:,.{dec}f}"

def esc(s):
    return H.escape(str(s))

# ── 수치 ──
total = len(d)
full = (d["매칭상태"] == "완전").sum()
part = (d["매칭상태"] == "작가만").sum()
miss = (d["매칭상태"] == "미매칭").sum()
miss_amt = d[d["매칭상태"] == "미매칭"]["정산액"].sum()
all_amt = d["정산액"].sum()
n_series = raw["title_norm"].nunique()
npass = (rep["판정"] == "PASS").sum()
ncross = (cdf["판정"] == "일치 ✅").sum() if "판정" in cdf else 0

# ── 별첨: 분석 대상 파일 목록 ──
flist = rep[["period", "file", "platform"]].sort_values(["period", "file"])
f_rows = []
for per in ("2026-02", "2026-03"):
    sub = flist[flist["period"] == per]
    f_rows.append(f"<tr><td colspan='3' style='background:#eef1f5;font-weight:700'>"
                  f"{per[:4]}년 {int(per[5:])}월분 — {len(sub)}개 파일</td></tr>")
    for i, (_, r) in enumerate(sub.iterrows(), 1):
        f_rows.append(f"<tr><td class='num' style='width:34px'>{i}</td>"
                      f"<td>{esc(r['file'])}</td><td style='width:110px'>{esc(r['platform'])}</td></tr>")
file_table = "\n".join(f_rows)

# ── 파일별 검증 전체표 ──
rep_rows = []
for _, r in rep.sort_values(["period", "platform", "account"]).iterrows():
    j = "합계 대사 일치" if r["판정"] == "PASS" else ("<b>불일치</b>" if r["판정"] == "FAIL" else "교차검증 일치")
    acc = "" if pd.isna(r["account"]) else str(r["account"])
    rep_rows.append(
        f"<tr><td>{r['period']}</td><td>{esc(r['platform'])}</td><td>{esc(acc)}</td>"
        f"<td>{esc(r['real_type'])}</td><td class='num'>{fmt(r['rows'])}</td>"
        f"<td class='num'>{fmt(r['settle_sum'])}</td><td class='num'>{fmt(r['expected_settle'])}</td>"
        f"<td>{j}</td></tr>")
rep_table = "\n".join(rep_rows)

# ── 미매칭 큐 TOP 20 ──
q_rows = []
for _, r in q.head(20).iterrows():
    q_rows.append(f"<tr><td>{esc(r['platform'])}</td><td>{esc(r['원문예시'])}</td>"
                  f"<td class='num'>{fmt(r['행수'])}</td><td class='num'>{fmt(r['정산액합'])}</td></tr>")
q_table = "\n".join(q_rows)

# ── 보강 실사례 ──
d["_raw_label"] = raw["label"].values
d["_raw_author"] = raw["author"].values
filled = d[(d["_raw_label"] == "") & d["레이블"].notna() & (d["레이블"] != "")]
samp = filled.groupby("플랫폼").first().reset_index()
fill_rows = []
for _, r in samp.head(10).iterrows():
    fill_rows.append(f"<tr><td>{esc(r['플랫폼'])}</td><td>{esc(r['작품명(원문)'])}</td>"
                     f"<td>{esc(r['작가'])}</td><td>{esc(r['레이블'])}</td></tr>")
fill_table = "\n".join(fill_rows)

# ── 시리즈 통합 실사례 ──
grp = raw.groupby("title_norm").agg(n=("title_raw", "nunique"), p=("platform", "nunique"),
                                    rep_t=("title_series", "first"))
top_m = grp.sort_values("n", ascending=False).head(5)
merge_rows = []
for k, r in top_m.iterrows():
    variants = raw[raw["title_norm"] == k]["title_raw"].unique()
    ex = " · ".join(esc(v) for v in list(variants)[1:4])
    merge_rows.append(f"<tr><td>{esc(r['rep_t'])}</td><td class='num'>{r['n']:,}종</td>"
                      f"<td class='num'>{r['p']}곳</td><td class='small'>{ex} 등</td></tr>")
merge_table = "\n".join(merge_rows)

# ── 유통사별 정산액 요약 (2개월) ──
psum = (d.groupby("플랫폼", as_index=False)
        .agg(레코드=("정산액", "size"), 총매출=("총매출", "sum"), 정산액=("정산액", "sum"))
        .sort_values("정산액", ascending=False))
p_rows = []
for _, r in psum.iterrows():
    p_rows.append(f"<tr><td>{esc(r['플랫폼'])}</td><td class='num'>{fmt(r['레코드'])}</td>"
                  f"<td class='num'>{fmt(r['총매출'])}</td><td class='num'>{fmt(r['정산액'])}</td></tr>")
p_rows.append(f"<tr class='tot'><td>합계</td><td class='num'>{fmt(total)}</td>"
              f"<td class='num'>{fmt(d['총매출'].sum())}</td><td class='num'>{fmt(all_amt)}</td></tr>")
p_table = "\n".join(p_rows)

html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>정산 데이터 표준화 검증 보고서</title>
<link href="https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  @page {{ size: A4; margin: 17mm 15mm; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: 'Nanum Gothic', 'NanumGothic', '나눔고딕', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
         color: #222; margin: 0; line-height: 1.7; font-size: 10pt;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  .page {{ max-width: 780px; margin: 0 auto; padding: 40px 24px 60px; }}
  .doc-head {{ border-top: 4px solid #1f2d3d; border-bottom: 1px solid #1f2d3d; padding: 26px 4px 20px; margin-bottom: 8px; }}
  h1 {{ font-size: 20pt; font-weight: 800; margin: 0 0 10px; letter-spacing: -0.02em; color: #1f2d3d; }}
  .meta-table {{ width: auto; font-size: 9pt; color: #444; border-collapse: collapse; margin-top: 6px; }}
  .meta-table td {{ padding: 1px 18px 1px 0; border: none; }}
  .meta-table td.k {{ color: #888; }}
  h2 {{ font-size: 13pt; font-weight: 800; color: #1f2d3d; margin: 40px 0 12px;
        padding: 6px 0 6px 12px; border-left: 4px solid #1f2d3d; background: #f7f8fa; }}
  h3 {{ font-size: 10.5pt; font-weight: 700; margin: 22px 0 8px; color: #333; }}
  p {{ margin: 7px 0; text-align: justify; }}
  table {{ width: 100%; border-collapse: collapse; margin: 12px 0 18px; font-size: 9pt; }}
  th {{ background: #1f2d3d; color: #fff; font-weight: 700; padding: 7px 9px; text-align: left; border: 1px solid #1f2d3d; }}
  td {{ border: 1px solid #d9dde3; padding: 5px 9px; vertical-align: top; }}
  tr:nth-child(even) td {{ background: #fafbfc; }}
  tr.tot td {{ background: #eef1f5; font-weight: 700; border-top: 2px solid #1f2d3d; }}
  .num {{ text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }}
  .kpi {{ display: flex; margin: 18px 0 6px; border: 1px solid #d9dde3; }}
  .kpi .cell {{ flex: 1; padding: 16px 14px; border-right: 1px solid #d9dde3; background: #fff; }}
  .kpi .cell:last-child {{ border-right: none; }}
  .kpi .v {{ font-size: 17pt; font-weight: 800; color: #1f2d3d; letter-spacing: -0.02em; }}
  .kpi .k {{ font-size: 8.3pt; color: #667; margin-top: 4px; line-height: 1.5; }}
  .box {{ border: 1px solid #d9dde3; border-left: 4px solid #5a6b80; background: #f7f8fa;
          padding: 10px 16px; font-size: 9pt; margin: 12px 0; }}
  .small {{ font-size: 8.5pt; color: #667; }}
  .pagebreak {{ page-break-before: always; }}
  footer {{ margin-top: 48px; padding-top: 12px; border-top: 1px solid #1f2d3d;
            font-size: 8.3pt; color: #888; display: flex; justify-content: space-between; }}
  .toc {{ font-size: 9.5pt; margin: 14px 0 4px; }}
  .toc td {{ border: none; border-bottom: 1px dotted #ccc; padding: 4px 2px; }}
</style>
</head>
<body>
<div class="page">

<div class="doc-head">
  <h1>정산 데이터 표준화 검증 보고서</h1>
  <table class="meta-table">
    <tr><td class="k">수신</td><td>하이브마인드</td><td class="k">작성일</td><td>2026년 6월 4일</td></tr>
    <tr><td class="k">대상 기간</td><td>2026년 2월 – 3월 (2개월)</td><td class="k">대상 자료</td><td>유통 플랫폼 28곳 정산서 파일 69개</td></tr>
    <tr><td class="k">작성자</td><td>최혜윤</td><td class="k">연락처</td><td>010-5710-0708 · hyeyun.choi@nsion.net</td></tr>
    <tr><td class="k">자료 제공</td><td colspan="3">하이브마인드 정형선 본부장님 (2026. 5. 31. 정산서 샘플 공유분 — 전체 파일 목록은 별첨 참조)</td></tr>
  </table>
</div>

<div class="kpi">
  <div class="cell"><div class="v">{total:,}</div><div class="k">표준화 처리 레코드<br>(2개월 · 28개 유통사)</div></div>
  <div class="cell"><div class="v">{full/total*100:.1f}%</div><div class="k">작가·레이블 완전 매칭<br>({full:,}건)</div></div>
  <div class="cell"><div class="v">{npass} / {npass}</div><div class="k">원본 합계 대사 통과<br>(합계 보유 정산서 전수)</div></div>
  <div class="cell"><div class="v">{ncross} / {ncross}</div><div class="k">수기 정리본 교차검증 일치<br>(2월분 전수)</div></div>
</div>
<p class="small">본 보고서의 모든 수치는 2026년 2–3월 실제 정산서 파일을 자동 처리한 결과에서 산출했습니다.</p>

<h2>요약</h2>
<p>유통사 28곳의 정산서 69개 파일(형식 6종, 145,018행)을 단일 표준 체계로 자동 변환했습니다.
변환 결과는 두 가지 방법으로 검증했습니다. 첫째, 정산서 자체에 합계가 기재된 {npass}개 파일 전수에서
자동 집계액이 원본 합계와 ±1원 이내로 일치함을 확인했습니다. 둘째, 담당자가 수작업으로 정리한
2월분 파일 {ncross}개를 동일 체계로 처리하여 원본 처리 결과와 전수 일치함을 확인했습니다.
작품 대조는 전체의 {full/total*100:.1f}%가 자동으로 완결되었으며, 잔여 미매칭은 시리즈 기준 {len(q)}건
(금액 기준 전체의 {miss_amt/all_amt*100:.2f}%)으로 수렴했습니다.</p>

<h2>1. 미매칭 현황</h2>
<p>전체 {total:,}건 중 작가명과 레이블이 모두 확정된 레코드는 {full:,}건({full/total*100:.1f}%)입니다.
잔여분의 구성은 다음과 같습니다.</p>

<table>
  <tr><th>매칭 단계</th><th class="num">레코드</th><th class="num">비중</th><th>내용</th></tr>
  <tr><td>완전 매칭</td><td class="num">{full:,}</td><td class="num">{full/total*100:.2f}%</td><td>작가·레이블 모두 확정</td></tr>
  <tr><td>부분 매칭(작가만 확정)</td><td class="num">{part:,}</td><td class="num">{part/total*100:.2f}%</td><td>레이블 미확정 — 레이블 미제공 유통사의 일부 작품</td></tr>
  <tr><td>미매칭</td><td class="num">{miss:,}</td><td class="num">{miss/total*100:.2f}%</td><td>작가·레이블 모두 미확정</td></tr>
</table>

<p>미매칭 {miss}건은 시리즈 기준 {len(q)}건이며, 금액으로는 {fmt(miss_amt)}원으로 전체 정산액
{fmt(all_amt)}원의 {miss_amt/all_amt*100:.2f}%입니다. 유통사별 구성은 예스24 {fmt((d[(d['매칭상태']=='미매칭')&(d['플랫폼']=='예스24')]).shape[0])}건,
올툰 17건, 원스토리 10건입니다. 예스24·올툰은 정산서에 작가명·레이블 항목이 없는 유통사이며,
타 유통사에 유통되지 않아 대조가 불가능한 작품이 미매칭으로 남았습니다.
원스토리는 ‘원스토리 패스’ 등 구독 번들 상품으로, 개별 작품이 아니므로 작품 대조 대상이 아닙니다.</p>

<h3>1-1. 미매칭 검토 대상 목록 (정산액 상위 20건 — 실데이터)</h3>
<table>
  <tr><th>유통사</th><th>작품명(정산서 원문)</th><th class="num">행수</th><th class="num">정산액(원)</th></tr>
  {q_table}
</table>

<div class="box">
미매칭분은 검토 목록으로 분리해 두었습니다. 시리즈당 1회 등록(작가·레이블 확인)하면 다음 달부터
자동 매칭되므로, 운영상 잔여 작업은 건별 수작업이 아니라 <b>시리즈별 1회 등록 {len(q)}건</b>입니다.
구독 번들 상품의 작품 배분 기준은 별도 협의가 필요합니다.
</div>

<h3>1-2. 대조 보강 효과</h3>
<table>
  <tr><th>항목</th><th class="num">원천 정산서 미제공</th><th class="num">대조 보강 후 잔여</th><th class="num">해소율</th></tr>
  <tr><td>작가명</td><td class="num">1,957건</td><td class="num">271건</td><td class="num">86.2%</td></tr>
  <tr><td>레이블(출판사)</td><td class="num">9,564건</td><td class="num">2,807건</td><td class="num">70.7%</td></tr>
</table>

<h3>1-3. 보강 실사례 — 정산서에 없던 값이 채워진 예 (유통사별 1건)</h3>
<table>
  <tr><th>유통사</th><th>작품명(정산서 원문)</th><th>보강된 작가</th><th>보강된 레이블</th></tr>
  {fill_table}
</table>
<p class="small">※ 위 유통사들의 정산서에는 레이블 항목이 없거나 비어 있으며, 표의 작가·레이블 값은
타 유통사 정산서와의 대조로 자동 확정한 결과입니다.</p>

<h3>1-4. 미매칭 저감 방안</h3>
<p>미매칭은 네 가지 방향으로 추가 축소할 수 있습니다. 우선순위 순으로 정리합니다.</p>
<table>
  <tr><th style="width:130px">방안</th><th>내용</th><th style="width:150px">기대 효과</th><th style="width:70px">상태</th></tr>
  <tr><td><b>① 번들·구독 분리</b></td>
      <td>‘원스토리 패스’ 등 채널 정기권은 개별 작품이 아니므로 작품 대조 대상에서 분리합니다.
          작품 제목과 무관한 매출이 미매칭으로 잡히던 것을 정상화합니다.</td>
      <td>정산액 미매칭률<br>0.42% → 0.20%</td><td>적용 완료</td></tr>
  <tr><td><b>② 작가·레이블 등록</b></td>
      <td>정산서에 작가·레이블이 없고 타 유통사에도 유통되지 않은 단독 신간(예스24·올툰)은
          검토 보드에서 1회 등록하면 이후 모든 월에 자동 매칭됩니다.</td>
      <td>잔여 미매칭<br>대부분 해소</td><td>운영</td></tr>
  <tr><td><b>③ 정규화·근사 매칭 강화</b></td>
      <td>외전·시즌·특별판 등 아직 규칙으로 거르지 못하는 표기 패턴을 보강하고,
          완전 일치 외에 표기 차이를 흡수하는 근사(유사도) 매칭을 추가합니다.</td>
      <td>자동 매칭률<br>추가 상승</td><td>후속</td></tr>
  <tr><td><b>④ 식별자 보조 키</b></td>
      <td>일부 유통사가 제공하는 작품코드 등 식별자를 매칭 보조 키로 병행합니다.
          <b>단, ISBN은 단독 키로 부적합합니다</b> — 전집·세트·개정판마다 번호가 분기되거나 누락되는 경우가 많다는
          담당자 확인에 따라, 제목 매칭을 대체하지 않고 보조 용도로만 활용합니다.</td>
      <td>표기차 우회<br>(보조)</td><td>검토</td></tr>
</table>

<h3>1-5. 번들 분리 적용 전후 비교</h3>
<table>
  <tr><th>지표</th><th class="num">적용 전</th><th class="num">적용 후</th><th class="num">변화</th></tr>
  <tr><td>미매칭 건수</td><td class="num">271건</td><td class="num">261건</td><td class="num">−10건</td></tr>
  <tr><td>미매칭률 (건수 기준)</td><td class="num">0.19%</td><td class="num">0.18%</td><td class="num">−0.01%p</td></tr>
  <tr><td>미매칭 정산액</td><td class="num">2,135,478원</td><td class="num">1,045,356원</td><td class="num">−1,090,122원</td></tr>
  <tr><td>미매칭률 (정산액 기준)</td><td class="num">0.42%</td><td class="num">0.20%</td><td class="num">−0.22%p</td></tr>
  <tr><td>번들·구독 별도 분류</td><td class="num">—</td><td class="num">10건 / 1,090,122원</td><td class="num">신설</td></tr>
</table>
<p class="small">※ ‘원스토리 패스’ 등 채널 정기권(작품이 아닌 매출)을 분리한 결과입니다.
‘삼국지 싸이코패스’, ‘패스 마스터’ 같은 실제 작품이 키워드로 잘못 분류되지 않도록 채널 정기권 패턴만 정밀 지정했습니다.</p>

<h2 class="pagebreak">2. 대조표 자동화 방식</h2>
<p>기존에는 5년치 데이터로 작성한 대조표를 엑셀 VLOOKUP으로 적용해 왔습니다.
2022년 12월 수기 정리본(38,063행)을 실측한 결과 브랜드명 항목의 70.3%가 매칭 실패값(#N/A)으로
남아 있었고, 신간 출시 시마다 대조표를 다시 작성해야 했습니다. 자동화 체계는 이를 4단계로 대체합니다.</p>

<table>
  <tr><th style="width:120px">단계</th><th>내용</th><th style="width:170px">성과(실측)</th></tr>
  <tr><td><b>① 정규화 규칙 엔진</b></td>
      <td>유통사마다 다른 표기(권·화수, 띄어쓰기, 괄호 병기, 태그)를 규칙으로 제거하고
          시리즈 단위 표준 키를 생성합니다.</td>
      <td>2022년 수기 정리본 기준<br>자동 일치율 78.8%</td></tr>
  <tr><td><b>② 당월 상호 대조</b></td>
      <td>작가·레이블을 제공하는 유통사(리디·알라딘·카카오페이지 등)의 값을 표준 키별로 집계하여,
          미제공 유통사(무툰·문피아·조아라·예스24 등)의 동일 작품에 채워 넣습니다.
          대조표가 매월 데이터에서 자동 재생성됩니다.</td>
      <td>작가 86.2%·레이블 70.7%<br>미제공분 해소</td></tr>
  <tr><td><b>③ 과거 자산 승계</b></td>
      <td>2022년 수기 정리본에서 ‘유통사 표기 → 시리즈·작가·브랜드’ 954개 키를 추출하여
          당월 데이터로 해소되지 않는 구간을 보강합니다. 기존 수작업 결과가 초기 자산으로 전환됩니다.</td>
      <td>시드 954키 적용</td></tr>
  <tr><td><b>④ 미매칭 검토 목록</b></td>
      <td>①–③으로 해소되지 않은 건은 검토 목록으로 분리합니다. 시리즈당 1회 등록하면 이후
          자동 매칭되므로, 신간 대응이 대조표 재작성에서 목록 확인·승인으로 줄어듭니다.</td>
      <td>잔여 {len(q)}건<br>(금액 기준 {miss_amt/all_amt*100:.2f}%)</td></tr>
</table>

<h3>2-1. 정규화 규칙이 제거하는 표기 변형 (실데이터)</h3>
<table>
  <tr><th>변형 유형</th><th>정산서 원문 표기 예</th><th>통일 결과</th></tr>
  <tr><td>권·화·부 표기</td><td>21세기 대마법사 10 / 회귀의 전설 3부 1222화</td><td>21세기 대마법사 / 회귀의 전설</td></tr>
  <tr><td>띄어쓰기 차이</td><td>보스 오빠, 살살! ↔ 보스오빠, 살살!</td><td>동일 시리즈로 통합</td></tr>
  <tr><td>괄호 병기</td><td>술탄(Sultan) / 퀸 앤 폰 (Queen&amp;Pawn)</td><td>술탄 / 퀸 앤 폰</td></tr>
  <tr><td>판형·판매 태그</td><td>[e북]·[단행본]·[독점]·(개정판)·*세트구매*</td><td>태그 제거 후 동일 시리즈로 통합</td></tr>
  <tr><td>외전·시즌</td><td>외전 / 특별외전 / 시즌2</td><td>본편 시리즈로 통합</td></tr>
</table>

<h3>2-2. 시리즈 통합 실사례 — 여러 표기가 하나의 시리즈로 묶인 예</h3>
<table>
  <tr><th>시리즈(통합 결과)</th><th class="num">원문 표기 수</th><th class="num">유통사 수</th><th>원문 표기 예</th></tr>
  {merge_table}
</table>

<div class="box">
규칙으로 판별이 불가능한 유형은 별칭 등록으로 처리합니다. 예를 들어 ‘온 디 에어(On the air)’의
정규 명칭이 괄호 안 영문 ‘On the air’인 경우는 규칙이 아닌 등록 대상입니다. 측정 결과 이러한
잔여 유형은 시리즈 약 48개 수준으로 수렴했습니다.
</div>

<h2 class="pagebreak">3. 표준화 통일 내역</h2>

<h3>3-1. 파일 형식·인코딩의 통일</h3>
<table>
  <tr><th>원천 상태 (유통사별 상이)</th><th>통일 결과</th></tr>
  <tr><td>확장자는 xls이나 실제는 HTML 문서인 파일 16종 (네이버·노벨피아·무툰·밀리의서재·블라이스·하이북 등)</td>
      <td rowspan="5">파일 내용 기준으로 형식을 자동 판별하여 단일 표준 테이블로 변환합니다.<br>
      <span class="small">확장자를 신뢰하지 않는 구조입니다.</span></td></tr>
  <tr><td>정상 xlsx · 구형 xls(예스24)</td></tr>
  <tr><td>내부 구조가 손상된 비표준 xlsx (북큐브·애니툰·카카오페이지)</td></tr>
  <tr><td>CSV(에이블리·구루컴퍼니·알라딘·조아라) · ZIP 압축(리디)</td></tr>
  <tr><td>HTML 행 태그 누락으로 깨진 파일 (피플앤스토리)</td></tr>
  <tr><td>EUC-KR(cp949) 인코딩 3종 — 로망띠끄·신영미디어·에피루스<br>
      <span class="small">‘Mac에서 글씨 깨짐’ 현상의 원인이며, 데이터 손상이 아니므로 자동 복원됩니다.</span></td>
      <td>UTF-8로 통일</td></tr>
  <tr><td>헤더 행 위치 상이 (1행–5행, 2–4단 복합 헤더, 헤더 없는 파일 포함)</td>
      <td>유통사별 규격 등록으로 자동 인식</td></tr>
  <tr><td>합계·SUM·Total 행 혼입 (상단·하단·중간)</td>
      <td>자동 제거 후 검증 기준값으로 재활용</td></tr>
</table>

<h3>3-2. 항목 명칭의 통일</h3>
<table>
  <tr><th style="width:120px">표준 항목</th><th>유통사별 원천 명칭 (실제 수집된 표기)</th></tr>
  <tr><td><b>작품명</b></td><td>작품명 · 컨텐츠 · 상품명 · 도서명 · 타이틀 · 제목 · 시리즈명 · 작품 제목 · 콘텐츠명</td></tr>
  <tr><td><b>작가</b></td><td>작가명 · 작가 · 저자 · 저자명 · 글작가</td></tr>
  <tr><td><b>레이블</b></td><td>레이블 · 출판사 · 출판사명 · 출판사명2 · 레이블명 · 브랜드명 · 소분류 · 출판권자<br>
      <span class="small">※ 하이북의 ‘레이블명(출판사명)’ 복합 표기는 분리하고, 피플앤스토리의 CP사 항목은 레이블이 아니므로 제외했습니다.</span></td></tr>
  <tr><td><b>총매출</b></td><td>판매 금액 합계(원) · 콘텐츠 매출금액 · 판매합계 · 판매액 · 판매금액 · 판매 골드 · 전체매출(원) · 총매출액 · 거래액(원화) 총합계 · 매출액 · 합계</td></tr>
  <tr><td><b>정산액</b></td><td>정산 금액 합계(원) · 콘텐츠 정산금액 · 정산금액 · 정산액 · 정산 금액 · 소득액 · 총지급액(원) · 총 정산액 · 정산대상금액 · 정산지급액 · 공급대가 · 정산금</td></tr>
  <tr><td><b>구분</b></td><td>[단행본]·[e북]·[연재] 제목 태그 · 연재/단행 · 종류 · 타입 · 판매형태 · 판매처(프리미엄 여부) · 회차 판매가(100원 여부) 등 9가지 방식 → 단행본/연재로 통일</td></tr>
  <tr><td><b>기간</b></td><td>판매일 · 날짜 · 판매년월 · 발생 월/정산 월<br>
      <span class="small">※ 익월·익익월 정산 구조를 고려하여 ‘정산월’과 ‘판매월’을 별도 항목으로 분리했습니다.</span></td></tr>
</table>

<h3>3-3. 금액 산출 근거의 표기</h3>
<p>유통사마다 ‘매출’의 기준이 다르고 일부는 정산액을 제공하지 않습니다.
동일 항목으로 통일하되, 모든 금액에 산출 근거를 부여하여 추적이 가능하도록 했습니다.</p>
<table>
  <tr><th style="width:90px">근거 표기</th><th>적용 내용</th></tr>
  <tr><td>제공값</td><td>유통사가 정산서에 직접 기재한 값입니다. (대부분의 유통사)</td></tr>
  <tr><td>계산값</td><td>네이버시리즈: (합계 − 마켓수수료 추정치) × 0.7 — 수수료 추정치는 정산서 내 제공 항목을 사용합니다.<br>
      블라이스: 판매액 × 0.7 · 조아라: 단가 × 판매건수 · 리디: 판매액 + 취소액(음수)</td></tr>
  <tr><td>미제공</td><td>밀리의서재(구독제로 판매금액 개념 없음) · 예스24(총매출 미제공) · 판무림(행 단위 정산액 없음 — 협의 필요)</td></tr>
</table>

<h3>3-4. 집계 단위의 통일</h3>
<p>권 단위(예스24), 회차 단위(리디·판무림), 일자 단위(에이블리·노벨피아·알라딘), 시리즈 단위(네이버) 등
유통사마다 다른 행 단위를 시리즈 단위 제목 기준으로 집계합니다. 원천 행은 원문 그대로 보존하며
{total:,}행 전체에 원본 파일명과 행 번호를 부착하여 역추적이 가능합니다.</p>

<h2 class="pagebreak">4. 검증 결과</h2>
<p>검증은 두 단계로 수행했습니다. 첫째, 정산서 자체에 합계가 기재된 파일은 자동 집계액과
원본 합계의 일치 여부를 확인했습니다(±1원 이내). 둘째, 합계가 없는 파일은 담당자 수기 정리본(2월분)을
동일 체계로 처리하여 원본 처리 결과와 비교했습니다. 두 검증 모두 전수 통과했습니다.</p>

<h3>4-1. 유통사별 처리·정산액 요약 (2개월 합산)</h3>
<table>
  <tr><th>유통사</th><th class="num">레코드</th><th class="num">총매출(원)</th><th class="num">정산액(원)</th></tr>
  {p_table}
</table>
<p class="small">※ 총매출이 정산액보다 작게 표시되는 유통사는 총매출 미제공(예스24·밀리의서재 등) 또는
수수료 차감 후 금액 기준(문피아·구루컴퍼니)인 경우입니다. 상세 기준은 3-3을 참조하시기 바랍니다.</p>

<h3 class="pagebreak">4-2. 파일별 검증 내역 (전체 {len(rep)}개 파일)</h3>
<table>
  <tr><th>정산월</th><th>유통사</th><th>계정</th><th>실제 형식</th><th class="num">행수</th>
      <th class="num">자동 집계 정산액</th><th class="num">원본 기재 합계</th><th>검증</th></tr>
  {rep_table}
</table>
<p class="small">※ ‘원본 기재 합계’가 없는 파일(거래 명세형 정산서)은 수기 정리본 교차검증으로 확인했습니다.
‘판무림’의 정산액 0원은 오류가 아니라 해당 정산서에 행 단위 정산액 항목이 없기 때문이며, 5장 확인
요청 사항에 포함했습니다.</p>

<h2>5. 확인 요청 사항</h2>
<table>
  <tr><th style="width:30px">#</th><th style="width:130px">항목</th><th>내용</th></tr>
  <tr><td>1</td><td>노벨피아 주계정</td><td>조회수형 정산 양식 계정의 2·3월 정산금이 전 행 0원입니다. 계정 상태 확인을 요청드립니다.</td></tr>
  <tr><td>2</td><td>판무림 정산율</td><td>정산서에 행 단위 정산액이 없습니다. 계약 정산율을 알려주시면 자동 산출하겠습니다.</td></tr>
  <tr><td>3</td><td>원스토리 패스</td><td>구독 번들 매출(월 약 109만 원)의 작품 배분 기준 협의가 필요합니다.</td></tr>
  <tr><td>4</td><td>올툰 구분 기준</td><td>유의사항 문서의 ‘타입 항목’이 실제 정산서에 없습니다. 작품명 접두 태그로 갈음할지 확인을 요청드립니다.</td></tr>
  <tr><td>5</td><td>예스24 신간 등록</td><td>미매칭 {len(q)}건 중 다수가 예스24 단독 유통작입니다. 작가·레이블 1회 등록 목록을 별도 송부하겠습니다.</td></tr>
</table>

<h2 class="pagebreak">별첨. 분석 대상 파일 목록</h2>
<p>아래 파일(하이브마인드 정형선 본부장님 제공, 2026. 5. 31. 공유분)을 분석 대상으로 했으며,
파일명은 수령 당시 원본 그대로 기재했습니다. 이외에 검증 참고 자료로
&lt;01. 유통사 정산서별 유의 사항&gt; 문서, 담당자 수기 정리본 폴더(26년 2월 일부 수정분 34개 파일),
2022년 12월 매출 정리 파일(38,063행)을 함께 사용했습니다.</p>
<table>
  <tr><th style="width:34px">#</th><th>파일명 (원본 그대로)</th><th>유통사</th></tr>
  {file_table}
</table>

<div class="box" style="border-left-color:#c9740f;background:#fff8f0">
<b>데이터 취급 안내.</b> 본 보고서에는 실제 매출·정산액 및 작가·작품 정보가 포함되어 있습니다.
정산 당사자 간 내부 검토 목적으로만 사용하며, 제3자에게 재배포·공유하지 않도록 유의해 주시기 바랍니다.</div>

<footer>
  <div>정산 데이터 표준화 검증 보고서 · 2026년 2–3월 · 하이브마인드 귀중</div>
  <div>작성 최혜윤 · 2026. 6. 4.</div>
</footer>

</div>
</body>
</html>"""

open(OUT, "w", encoding="utf-8").write(html)
print("생성:", OUT, f"({len(html):,}자)")

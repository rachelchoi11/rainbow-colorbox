/* ============================================================
   AURORAH CHART THEME v2.0 — 값·규칙 (라이브러리 비종속)
   [v2.0] 브랜드 틸 전환: 범주 1=옥 #009999 · 2=호박 · 3=청람, 히트맵 옥 스케일
   자체 SVG/커스텀 차트에 매핑하기 위한 상수 객체입니다.
   디자인 가이드 v2.0 §02(차트 범주색) · §07(차트 스타일) 기준.
   사용: <script src="aurorah-chart-theme-v2.0.js"></script>
        → window.HM_CHART 로 접근 (ESM이면 하단 export 주석 해제)
   ============================================================ */
const HM_CHART = {

  /* ---- 색 ---- */
  colors: {
    /* 범주형: 항상 이 순서대로 배정. 1번(옥·브랜드 틸)은 언제나 '주인공' 시리즈(정산액 등) */
    categorical: ['#009999', '#E8A013', '#5B67D8', '#9C5BB8', '#D95B4A', '#7C8B8A'],
    /* 비교 기준(총매출 등 참조 시리즈)은 항상 이 색 — 주인공보다 앞에 서지 않게 */
    comparisonMuted: '#D6E2E0',
    /* 히트맵/농도: 옥 단색 스케일 (低 → 高). 중간값은 두 색 선형 보간 */
    heatmapScale: { min: '#DEF3F2', max: '#006060' },
    /* 결측·미수신 셀: '값 0'과 구분해 배경 + ✕ 아이콘 병기 */
    missingCell: { bg: '#FBE9E9', fg: '#D23F3F', glyph: '\u2715' },
    /* 막대 위 값 라벨(주인공 시리즈에만) */
    valueLabel: '#007272',
  },

  /* ---- 격자·축 ---- */
  grid: {
    horizontalOnly: true,          /* 수평 격자선만, 수직선 없음 */
    stroke: '#E8F0EF',
    strokeWidth: 1,
  },
  axis: {
    line: 'none',                  /* 축선 자체는 그리지 않음(격자·라벨로 충분) */
    label: { fontSize: 12, color: '#89A09C', fontWeight: 400 },
    /* 숫자 라벨은 tabular-nums: SVG text에 font-variant-numeric 적용 or Pretendard 유지 */
  },

  /* ---- 막대 ---- */
  bar: {
    cornerRadius: { top: 5, bottom: 2 },
    groupGap: 14,                  /* 월 그룹 사이 px */
    barGap: 5,                     /* 그룹 내 막대 사이 px */
    valueLabel: {                  /* 값 라벨: 주인공 시리즈에만 표시 */
      show: 'primary-series-only',
      fontSize: 11, fontWeight: 700, offsetY: -8,
    },
  },

  /* ---- 툴팁 ---- */
  tooltip: {
    bg: '#152220', color: '#FFFFFF',
    fontSize: 12, borderRadius: 10, padding: [8, 12],
    shadow: '0 4px 16px rgba(13,36,34,.10), 0 12px 40px rgba(13,36,34,.14)',
  },

  /* ---- 인터랙션 ---- */
  hover: {
    activeOpacity: 1,
    dimOpacity: 0.4,               /* 호버 시 나머지 시리즈 감쇠 */
    transitionMs: 120,             /* --dur-micro */
    easing: 'cubic-bezier(.2,0,0,1)',
  },

  /* ---- 숫자 표기 ---- */
  numberFormat: {
    axisAndBarLabels: 'eok-abbrev',   /* 차트 라벨에서만 억 단위 축약 허용: 2.8억 */
    tablesAndTooltips: 'full-comma',  /* 표·툴팁은 전체 자릿수 + 천 단위 콤마: 284,120,900 */
    currencySuffix: '원',
  },

  /* ---- 차트 유형 선택 규칙 ---- */
  rules: [
    '구성비 4개 이하는 도넛보다 스택 바 우선(비교가 쉬움). 도넛은 대표 화면 요약용으로만.',
    '비교 기준 시리즈(총매출 등)는 comparisonMuted 고정 — 범주색을 쓰지 않는다.',
    '값 라벨은 주인공 시리즈에만. 모든 막대에 라벨을 달지 않는다.',
    '히트맵의 결측 셀은 missingCell 스타일(✕ 병기)로 "없음"과 "0"을 구분한다.',
    '색은 여기 정의된 값만 사용 — 임의 색 생성 금지.',
  ],
};

window.HM_CHART = HM_CHART;
/* ESM 사용 시: export default HM_CHART; */

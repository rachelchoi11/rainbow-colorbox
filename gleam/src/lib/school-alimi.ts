// 학교알리미 OpenAPI (data.go.kr 한국교육학술정보원) 클라이언트
// 학교별 도서관 보유도서, 다문화 학생 비율, 학생수, 시설 등.

import type { Intelligence } from "./strength-matrix"

const BASE = "https://www.schoolinfo.go.kr/openApi.do"

function getKey(): string | null {
  return process.env.SCHOOL_ALIMI_KEY || null
}

export type SchoolDetail = {
  schoolCode: string
  name: string
  studentCount: number | null
  multiculturalRatio: number | null   // %
  libraryBooks: number | null
  perCapitaBooks: number | null       // 1인당 장서
  region: string
}

// 학교알리미는 실 API 호출 시 학교코드(EDU_CODE)와 apiType 조합 필요.
// 현재 구현은 mock 우선 — 실 키 발급 후 fetchDetail 채움.
export async function fetchSchoolDetail(schoolCode: string): Promise<SchoolDetail | null> {
  const key = getKey()
  if (!key) return null
  // TODO: 실 호출 (apiType=학교현황통계 등)
  // 현재는 mock으로 대체
  return mockSchoolDetail(schoolCode)
}

export function mockSchoolDetail(schoolCode: string): SchoolDetail {
  return {
    schoolCode,
    name: "별빛초등학교",
    studentCount: 412,
    multiculturalRatio: 7.3,
    libraryBooks: 8420,
    perCapitaBooks: 20.4,
    region: "서울특별시",
  }
}

// ─────────── 격차 분석 (전국 평균 대비) ───────────
// 출처: 학교도서관진흥법 시행령 + KLISS 공공도서관 통계 (대략 평균값)
const NATIONAL_AVG = {
  perCapitaBooks: 21.0,    // 학생 1인당 장서
  multiculturalRatio: 3.2, // 전국 평균 다문화 비율 (%)
}

export type SchoolGap = {
  perCapitaGap: number        // (학교 - 평균) / 평균. 음수면 평균 미달
  multiculturalRatio: number
  isLibraryUnderResourced: boolean   // 1인당 장서가 평균의 80% 이하
  isMulticulturalCluster: boolean    // 다문화 비율이 평균의 2배 이상
}

export function analyzeSchoolGap(d: SchoolDetail): SchoolGap {
  const perCapita = d.perCapitaBooks ?? 0
  const mc = d.multiculturalRatio ?? 0
  return {
    perCapitaGap: (perCapita - NATIONAL_AVG.perCapitaBooks) / NATIONAL_AVG.perCapitaBooks,
    multiculturalRatio: mc,
    isLibraryUnderResourced: perCapita > 0 && perCapita < NATIONAL_AVG.perCapitaBooks * 0.8,
    isMulticulturalCluster: mc > NATIONAL_AVG.multiculturalRatio * 2,
  }
}

// 다문화 학생 — 가중치 부여하지 않음 (알고리즘 공정성).
// 대신 *해석 신뢰도 페널티*: 한국어 의존이 높은 게임 결과의 불확실성이 큼을 명시.
export function multiculturalCaveat(ratio: number): string | null {
  if (ratio < 5) return null
  return `이 학생의 학교 다문화 비율은 ${ratio}%로 평균보다 높습니다. 한국어 의존도가 높은 게임(단어 폭포·이야기 이어쓰기)의 결과는 한국어 능력에 영향받을 수 있어 *해석 시 신뢰구간을 더 넓게* 두어야 합니다. 실제 강점 영역 추정에는 한국어 비의존 게임(시간과 패턴·어떤 장면이 끌려?)에 더 가중치를 둡니다.`
}

// 강점 추출 엔진의 핵심 프롬프트 — 게임 결과 + 도서 이력을 종합해 강점 프로파일 생성

import type { Intelligence } from "./strength-matrix"
import { INTELLIGENCES } from "./strength-matrix"
import { generateText } from "./anthropic"

export type FinalProfileInput = {
  studentName: string
  ageGroup: string
  scores: Record<Intelligence, number>
  topStrengths: Intelligence[]
  bottomWeaknesses: Intelligence[]
  unevennessIndex: number
  giftedReferral: boolean
  clinicReferral: boolean
  schoolScores?: { math?: number | null; korean?: number | null; science?: number | null }
  recentBooks?: string[]
  multiculturalRatio?: number
  region?: string
}

const STRENGTH_NAMES: Record<Intelligence, string> = Object.fromEntries(
  (Object.keys(INTELLIGENCES) as Intelligence[]).map((k) => [k, INTELLIGENCES[k].name])
) as Record<Intelligence, string>

// 학생용 따뜻한 종합 코멘트 생성
export async function generateStudentSummary(input: FinalProfileInput): Promise<string> {
  const top = input.topStrengths.map((s) => STRENGTH_NAMES[s]).join(", ")
  const sys = `당신은 따뜻한 학습 멘토입니다. 학생에게 자기 강점을 발견하는 기쁨을 주는 메시지를 작성합니다.
원칙:
- 학생을 부진/약자로 절대 표현하지 않습니다.
- 점수를 직접 말하지 않습니다("8점이야"X).
- 발견한 강점을 *이미 가지고 있던 빛*으로 표현합니다.
- 학교 시험 점수가 낮더라도 "지금 보이지 않는 다른 길이 있다"는 메시지로 풀어줍니다.
- 6~10문장, 따뜻한 한국어, 학생 연령에 맞춰 ${input.ageGroup}.`

  const user = `학생: ${input.studentName}, 연령: ${input.ageGroup}
TOP 강점: ${top}
${input.giftedReferral ? "참고: 이 학생은 학교 점수에서 보이지 않는 특별한 영역의 빛을 보였습니다 (이중특수성 가능성)." : ""}
${input.recentBooks?.length ? `최근 도서관에서 빌린 책: ${input.recentBooks.join(", ")}` : ""}
${input.region ? `지역: ${input.region}` : ""}

학생에게 보여줄 종합 메시지를 작성해주세요. 발견한 강점, 그 강점이 어떻게 빛나는지, 다음에 시도해볼 활동 1~2개 추천을 포함해주세요.`
  return generateText(sys, user, 800)
}

// 학부모용 리포트 마크다운 생성
export async function generateParentReport(input: FinalProfileInput): Promise<string> {
  const sys = `당신은 학부모와 교사가 함께 읽는 학생 강점 리포트를 작성하는 교육 전문가입니다.
원칙:
1. 학생을 약자로 묘사하지 않습니다. 발견된 강점을 명확히 짚어줍니다.
2. 학교 점수와 강점 사이의 격차가 있을 때, 그것이 *이중특수성(2e)* 영재 가능성을 시사함을 객관적으로 안내합니다.
3. 가드너 다중지능 이론은 *분석 프레임*이지 진단 도구가 아님을 명시합니다.
4. 가정에서 시도할 수 있는 구체적 활동 5개를 제안합니다.
5. 정책적 의뢰(영재교육원/학습클리닉) 트리거 시 그 근거를 투명하게 보입니다.
6. 톤: 정중하고 객관적인 한국어. 단정적인 말 회피("~경향이 보입니다", "~가능성이 시사됩니다").`

  const top = input.topStrengths.map((s) => `${INTELLIGENCES[s].emoji} ${STRENGTH_NAMES[s]}`).join(", ")
  const user = `## 학생 정보
- 이름: ${input.studentName}
- 연령: ${input.ageGroup}
${input.region ? `- 지역: ${input.region}` : ""}

## 분석 결과
- 강점 영역 TOP 3: ${top}
- 8지능 점수: ${(Object.entries(input.scores) as [Intelligence, number][])
    .map(([k, v]) => `${STRENGTH_NAMES[k]}=${v}`).join(", ")}
- 강점-약점 격차: ${input.unevennessIndex}
- 영재교육원 의뢰 추천: ${input.giftedReferral ? "예" : "아니오"}
- 학습클리닉 의뢰 추천: ${input.clinicReferral ? "예" : "아니오"}
${input.schoolScores ? `- 학교 점수: 수학 ${input.schoolScores.math ?? "-"}, 국어 ${input.schoolScores.korean ?? "-"}, 과학 ${input.schoolScores.science ?? "-"}` : ""}
${input.recentBooks?.length ? `- 최근 도서관 대출: ${input.recentBooks.join(", ")}` : ""}

## 작성 가이드
다음 마크다운 구조로 작성해주세요:

### 1. 한 줄 요약
학생의 가장 빛나는 영역을 한 문장으로.

### 2. 발견된 강점
TOP 3 강점 각각에 대해:
- 무엇을 의미하는지 (정의)
- 이 학생에게서 어떤 신호로 보였는지
- 가정에서 어떻게 키울 수 있는지

### 3. 학습 격차 해석 (해당 시만)
학교 점수가 낮은데 강점이 두드러진다면, 이중특수성(2e) 가능성과 그 의미를 객관적으로 안내. 단, 단정 금지.

### 4. 추천 활동 5개
강점 영역을 키우는 가정 활동 5개. 비용·시간·난이도 포함.

### 5. 진로 탐색 5개
강점 기반 직업 5개와 연결되는 구체적 다음 행동.

### 6. 다음 단계
- 영재교육원 의뢰 추천 시: 절차와 자동 생성된 의뢰서 안내
- 학습클리닉 의뢰 추천 시: 가까운 센터 안내
- 일반: 6개월 후 재진단 권장

### 7. 주의사항
가드너 다중지능 이론의 한계, 본 분석이 진단이 아닌 *탐색 시작점*임을 명시.`

  return generateText(sys, user, 3500)
}

// 영재교육원 의뢰서 (DOCX용 본문)
export async function generateGiftedReferral(input: FinalProfileInput): Promise<string> {
  const sys = `당신은 영재교육원 추천 의뢰서를 작성합니다. 공식적이고 객관적인 톤. 정확한 데이터 인용. 추천 근거를 명확히 적습니다.`
  const top = input.topStrengths.map((s) => STRENGTH_NAMES[s]).join(", ")
  const user = `## 학생 정보
- 이름: ${input.studentName}
- 연령: ${input.ageGroup}
${input.region ? `- 지역: ${input.region}` : ""}

## 추천 근거
- 강점 영역 TOP: ${top}
- 강점 영역 점수: ${input.topStrengths.map((s) => `${STRENGTH_NAMES[s]} ${input.scores[s]}/10`).join(", ")}
- 강점-약점 격차: ${input.unevennessIndex}/10 (격차 4점 이상은 단일분야 영재 시그널)
${input.schoolScores ? `- 학교 점수: 수학 ${input.schoolScores.math ?? "-"}, 국어 ${input.schoolScores.korean ?? "-"}, 과학 ${input.schoolScores.science ?? "-"}` : ""}
- 시스템 판단: 이중특수성(2e) 가능성

다음 형식으로 의뢰서를 작성해주세요:

# 영재교육원 진단 추천 의뢰서

## 1. 학생 개요
## 2. 추천 근거
- 강점 신호의 구체적 증거
- 학교 시험 점수와의 격차 해석
- 일반 영재 선발 경로에서 누락될 가능성에 대한 우려

## 3. 권장 진단 영역
구체적 영재 분야 (수학/과학/인문/예술/발명 중 추천)

## 4. 첨부 데이터
시스템에 기록된 게임 진단 결과·도서 이력 등.

## 5. 작성자
별의아이들 AI 시스템 (자동 생성)
주의: 본 의뢰서는 1차 스크리닝 도구입니다. 최종 영재 판정은 영재교육원 정식 절차를 따라야 합니다.`
  return generateText(sys, user, 2500)
}

// bookbot/src/lib/age-config.ts에서 발췌 — 별의아이들 대상(초등 저~고등) 4개로 축약
export type AgeGroup =
  | "ELEMENTARY_LOW"
  | "ELEMENTARY_HIGH"
  | "MIDDLE_SCHOOL"
  | "HIGH_SCHOOL"

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  ELEMENTARY_LOW: "초등 저학년 (1~3학년)",
  ELEMENTARY_HIGH: "초등 고학년 (4~6학년)",
  MIDDLE_SCHOOL: "중학생",
  HIGH_SCHOOL: "고등학생",
}

export function getAgeInstruction(ageGroup: AgeGroup): string {
  const map: Record<AgeGroup, string> = {
    ELEMENTARY_LOW: `대상: 초등 저학년 (1~3학년)
- 쉬운 단어와 짧은 문장 사용
- 어려운 단어는 괄호 안에 쉬운 설명 첨부
- "~합니다", "~했습니다" 친근한 서술형
- 등장인물의 감정·행동 중심으로 표현`,
    ELEMENTARY_HIGH: `대상: 초등 고학년 (4~6학년)
- 일상적인 어휘 + 새 단어 적절히 도입
- 인과관계 명확히
- 학생 자기 경험과 연결할 수 있는 질문 포함`,
    MIDDLE_SCHOOL: `대상: 중학생
- 일반적인 서술 수준
- 작품 주제·메시지 분석
- 사회적 맥락과 연결
- 비판적 사고를 유도하는 질문 포함`,
    HIGH_SCHOOL: `대상: 고등학생
- 분석적·논리적 서술
- 다양한 해석 가능성 제시
- 다른 작품·사회 현상과의 연관성 언급
- 논술형 사고 유도`,
  }
  return map[ageGroup] || map.ELEMENTARY_HIGH
}

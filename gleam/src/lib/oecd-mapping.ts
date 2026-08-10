// 가드너 8지능 → OECD 21세기 스킬 + Holland 흥미 코드 매핑
// 학술적 방어선: 가드너는 내부 분석 도구, 외부 표면은 OECD/Holland로.

import type { Intelligence } from "./strength-matrix"

// OECD Learning Compass 2030 핵심 4영역
export type OECDSkill = "CREATIVITY" | "CRITICAL" | "COLLABORATION" | "COMMUNICATION"

export const OECD_SKILL_LABELS: Record<OECDSkill, string> = {
  CREATIVITY: "창의적 사고력",
  CRITICAL: "비판적 사고력",
  COLLABORATION: "협업 능력",
  COMMUNICATION: "소통 능력",
}

// Holland Code (RIASEC) 흥미 영역
export type HollandCode = "R" | "I" | "A" | "S" | "E" | "C"

export const HOLLAND_LABELS: Record<HollandCode, string> = {
  R: "현실형 (Realistic) — 만들고 다루는 것",
  I: "탐구형 (Investigative) — 분석하고 이해하는 것",
  A: "예술형 (Artistic) — 표현하고 창조하는 것",
  S: "사회형 (Social) — 돕고 가르치는 것",
  E: "기업형 (Enterprising) — 이끌고 설득하는 것",
  C: "관습형 (Conventional) — 정리하고 체계화하는 것",
}

// 8지능 → OECD 매핑 (가중치)
const TO_OECD: Record<Intelligence, Partial<Record<OECDSkill, number>>> = {
  LING: { COMMUNICATION: 0.9, CRITICAL: 0.4, CREATIVITY: 0.5 },
  LOGI: { CRITICAL: 0.9, CREATIVITY: 0.3 },
  VISU: { CREATIVITY: 0.8, CRITICAL: 0.3 },
  MUSI: { CREATIVITY: 0.7, COMMUNICATION: 0.3 },
  BODY: { CREATIVITY: 0.4, COLLABORATION: 0.3 },
  INTP: { COLLABORATION: 0.9, COMMUNICATION: 0.7 },
  INTR: { CRITICAL: 0.6, CREATIVITY: 0.5 },
  NATU: { CRITICAL: 0.6, CREATIVITY: 0.4 },
}

// 8지능 → Holland 매핑
const TO_HOLLAND: Record<Intelligence, Partial<Record<HollandCode, number>>> = {
  LING: { A: 0.7, S: 0.5, I: 0.4 },
  LOGI: { I: 0.9, C: 0.5 },
  VISU: { A: 0.9, R: 0.4 },
  MUSI: { A: 0.9 },
  BODY: { R: 0.8, A: 0.4 },
  INTP: { S: 0.9, E: 0.7 },
  INTR: { I: 0.5, A: 0.5 },
  NATU: { I: 0.7, R: 0.5 },
}

export function intelligencesToOECD(scores: Record<Intelligence, number>): Record<OECDSkill, number> {
  const out: Record<OECDSkill, number> = { CREATIVITY: 0, CRITICAL: 0, COLLABORATION: 0, COMMUNICATION: 0 }
  const w: Record<OECDSkill, number> = { CREATIVITY: 0, CRITICAL: 0, COLLABORATION: 0, COMMUNICATION: 0 }
  for (const [intel, score] of Object.entries(scores) as [Intelligence, number][]) {
    const m = TO_OECD[intel]
    for (const [skill, weight] of Object.entries(m) as [OECDSkill, number][]) {
      out[skill] += score * weight
      w[skill] += weight
    }
  }
  for (const k of Object.keys(out) as OECDSkill[]) {
    out[k] = w[k] > 0 ? Math.round((out[k] / w[k]) * 10) / 10 : 5
  }
  return out
}

export function intelligencesToHolland(scores: Record<Intelligence, number>): Record<HollandCode, number> {
  const out: Record<HollandCode, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }
  const w: Record<HollandCode, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }
  for (const [intel, score] of Object.entries(scores) as [Intelligence, number][]) {
    const m = TO_HOLLAND[intel]
    for (const [code, weight] of Object.entries(m) as [HollandCode, number][]) {
      out[code] += score * weight
      w[code] += weight
    }
  }
  for (const k of Object.keys(out) as HollandCode[]) {
    out[k] = w[k] > 0 ? Math.round((out[k] / w[k]) * 10) / 10 : 5
  }
  return out
}

// 표준오차 (검증 에이전트 비판 #6 대응 — 모든 출력에 불확실성 명시)
export const SIGNAL_UNCERTAINTY = 1.5  // ±1.5점 신뢰 구간

export function withUncertainty(score: number): { score: number; low: number; high: number } {
  return {
    score,
    low: Math.max(0, score - SIGNAL_UNCERTAINTY),
    high: Math.min(10, score + SIGNAL_UNCERTAINTY),
  }
}

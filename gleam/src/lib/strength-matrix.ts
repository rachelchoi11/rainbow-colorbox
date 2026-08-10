// 별의아이들 — 강점 매트릭스 (Gardner 8지능 × SOLO 4차원)
// 핵심 자산. 게임 신호 → 8지능 점수 → 진로 매칭 → 정책 의뢰 트리거.

export type Intelligence =
  | "LING"  // 언어
  | "LOGI"  // 논리수학
  | "VISU"  // 시각공간
  | "MUSI"  // 음악
  | "BODY"  // 신체운동
  | "INTP"  // 대인관계
  | "INTR"  // 자기성찰
  | "NATU"  // 자연친화

export type SoloDim = "depth" | "creativity" | "logic" | "empathy"

export type IntelligenceMeta = {
  code: Intelligence
  name: string
  emoji: string
  description: string
  // 학생용 친근 설명 (저학년도 이해 가능)
  childFriendly: string
  // 게임 시그널 가중치 — 어떤 게임에서 측정 가능한가
  measurableBy: { gameType: GameType; weight: number }[]
  // 강점 시 매칭되는 직업 5개
  careers: string[]
  // 강점 시 추천 활동
  activities: string[]
  // KDC 도서 분류 (도서관정보나루 도서 → 강점 추정용)
  kdcRange: string[]
}

export type GameType = "WORD_ASSOC" | "STORY_COMPLETE" | "VISUAL_CHOICE" | "TIME_PATTERN"

export const INTELLIGENCES: Record<Intelligence, IntelligenceMeta> = {
  LING: {
    code: "LING",
    name: "언어 지능",
    emoji: "📖",
    description: "단어를 잘 다루고, 글로 생각을 잘 표현하며, 이야기에 강한 흥미를 보임",
    childFriendly: "이야기를 만들거나 말로 설명할 때 빛나는 친구!",
    measurableBy: [
      { gameType: "WORD_ASSOC", weight: 0.8 },
      { gameType: "STORY_COMPLETE", weight: 0.9 },
    ],
    careers: ["작가·시나리오 작가", "기자·PD", "변호사", "통역·번역가", "국어 교사"],
    activities: ["일기 쓰기", "독서 토론", "스토리 게임", "시 짓기"],
    kdcRange: ["800-899", "030", "330"],
  },
  LOGI: {
    code: "LOGI",
    name: "논리·수학 지능",
    emoji: "🧮",
    description: "숫자·규칙·패턴을 빠르게 인식. 추론과 가설 검증을 즐김",
    childFriendly: "퍼즐과 숫자 놀이에서 신나는 친구!",
    measurableBy: [
      { gameType: "WORD_ASSOC", weight: 0.4 },
      { gameType: "TIME_PATTERN", weight: 0.9 },
      { gameType: "VISUAL_CHOICE", weight: 0.5 },
    ],
    careers: ["데이터 사이언티스트", "엔지니어·연구원", "회계사", "경제 분석가", "프로그래머"],
    activities: ["수학 퍼즐", "프로그래밍", "보드게임", "과학 실험"],
    kdcRange: ["410-419", "510-519", "560"],
  },
  VISU: {
    code: "VISU",
    name: "시각·공간 지능",
    emoji: "🎨",
    description: "공간 관계와 시각 패턴 인식이 뛰어남. 머릿속에서 이미지를 잘 회전·조작",
    childFriendly: "그림으로 생각하고, 길을 잘 외우는 친구!",
    measurableBy: [
      { gameType: "VISUAL_CHOICE", weight: 1.0 },
      { gameType: "STORY_COMPLETE", weight: 0.4 },
    ],
    careers: ["디자이너·일러스트레이터", "건축가·도시 계획가", "영상 감독·촬영감독", "외과 의사·치과의사", "게임 그래픽 아티스트"],
    activities: ["스케치·만화", "건축 모형", "사진·영상 편집", "3D 모델링"],
    kdcRange: ["600-699", "540"],
  },
  MUSI: {
    code: "MUSI",
    name: "음악 지능",
    emoji: "🎵",
    description: "리듬·음정·음색에 민감. 소리 패턴을 잘 기억·재현",
    childFriendly: "노래·리듬·소리에 마음이 움직이는 친구!",
    measurableBy: [
      { gameType: "TIME_PATTERN", weight: 0.7 },
      { gameType: "STORY_COMPLETE", weight: 0.3 },
    ],
    careers: ["작곡가·가수·연주자", "음향 엔지니어", "음악 치료사", "광고 음악 PD", "사운드 디자이너"],
    activities: ["악기 연습", "작곡 앱", "리듬 게임", "DJ·믹싱"],
    kdcRange: ["670-679"],
  },
  BODY: {
    code: "BODY",
    name: "신체·운동 지능",
    emoji: "🏃",
    description: "몸의 움직임을 정교하게 제어. 손재주가 좋고 체험학습으로 잘 배움",
    childFriendly: "몸으로 배우고, 손으로 만들 때 신나는 친구!",
    measurableBy: [
      { gameType: "TIME_PATTERN", weight: 0.5 },
      { gameType: "VISUAL_CHOICE", weight: 0.4 },
    ],
    careers: ["운동선수·코치", "외과의·치과의·정형외과 PT", "셰프·바리스타", "메이크업 아티스트", "무용수·연기자"],
    activities: ["체육 활동", "공예·DIY", "요리", "댄스·연극"],
    kdcRange: ["690-699", "590-599"],
  },
  INTP: {
    code: "INTP",
    name: "대인관계 지능",
    emoji: "🤝",
    description: "타인의 감정·의도를 빠르게 읽음. 협업·중재·설득에 강함",
    childFriendly: "친구의 마음을 잘 알아주고, 분위기를 잘 만드는 친구!",
    measurableBy: [
      { gameType: "STORY_COMPLETE", weight: 0.7 },
      { gameType: "VISUAL_CHOICE", weight: 0.3 },
    ],
    careers: ["상담심리사·교사", "마케팅·영업 전문가", "정치인·기획자", "HR·조직 컨설턴트", "변호사"],
    activities: ["또래 멘토링", "동아리 운영", "토론·모의재판", "봉사활동"],
    kdcRange: ["180-189", "320-329"],
  },
  INTR: {
    code: "INTR",
    name: "자기성찰 지능",
    emoji: "🌙",
    description: "자기 감정·동기·강약점을 깊이 인식. 메타인지가 발달",
    childFriendly: "자기 마음을 잘 살피고 일기 쓰기를 좋아하는 친구!",
    measurableBy: [
      { gameType: "STORY_COMPLETE", weight: 0.6 },
      { gameType: "WORD_ASSOC", weight: 0.5 },
    ],
    careers: ["심리학자·정신건강 전문의", "철학자·작가", "코치·카운슬러", "명상 지도자", "기업가·CEO"],
    activities: ["일기·블로그", "철학 토론", "명상", "감정 기록"],
    kdcRange: ["100-199", "180-199"],
  },
  NATU: {
    code: "NATU",
    name: "자연친화 지능",
    emoji: "🌿",
    description: "생물·자연 패턴 인식·분류에 강함. 환경 변화에 민감",
    childFriendly: "동식물·날씨·자연을 관찰하는 걸 좋아하는 친구!",
    measurableBy: [
      { gameType: "VISUAL_CHOICE", weight: 0.5 },
      { gameType: "TIME_PATTERN", weight: 0.3 },
    ],
    careers: ["생물학자·수의사·해양학자", "환경 컨설턴트", "농축산·임업 전문가", "지질학자·기상예보관", "다큐 PD"],
    activities: ["곤충·식물 관찰", "자연 다큐", "캠핑·등산", "생태 일지"],
    kdcRange: ["400-499"],
  },
}

// ─────────────── 게임 시그널 → 지능 점수 가중 합산 ───────────────

export type GameSignals = Partial<Record<Intelligence, number>>

export function combineGameSignals(runs: { gameType: GameType; signals: GameSignals }[]): Record<Intelligence, number> {
  const totals: Record<Intelligence, { sum: number; weight: number }> = {
    LING: { sum: 0, weight: 0 },
    LOGI: { sum: 0, weight: 0 },
    VISU: { sum: 0, weight: 0 },
    MUSI: { sum: 0, weight: 0 },
    BODY: { sum: 0, weight: 0 },
    INTP: { sum: 0, weight: 0 },
    INTR: { sum: 0, weight: 0 },
    NATU: { sum: 0, weight: 0 },
  }
  for (const run of runs) {
    for (const [code, score] of Object.entries(run.signals)) {
      const intel = INTELLIGENCES[code as Intelligence]
      if (!intel) continue
      const w = intel.measurableBy.find((m) => m.gameType === run.gameType)?.weight ?? 0.2
      totals[code as Intelligence].sum += (score ?? 0) * w
      totals[code as Intelligence].weight += w
    }
  }
  const result: Record<Intelligence, number> = {} as never
  for (const code of Object.keys(totals) as Intelligence[]) {
    const t = totals[code]
    result[code] = t.weight > 0 ? Math.round((t.sum / t.weight) * 10) / 10 : 0
  }
  return result
}

// ─────────────── 강점 분석 — TOP 3 강점, 격차, 정책 의뢰 ───────────────

export type StrengthAnalysis = {
  scores: Record<Intelligence, number>
  topStrengths: Intelligence[]
  bottomWeaknesses: Intelligence[]
  unevennessIndex: number  // 0~10. 높을수록 2e(이중특수성) 가능성
  giftedReferral: boolean   // 영재교육원 의뢰 추천
  clinicReferral: boolean   // 학습클리닉 의뢰 추천
  strongestCareers: string[] // 강점 기반 진로 5개
  reasoning: string         // 의뢰 판단 근거
}

export function analyzeStrengths(
  scores: Record<Intelligence, number>,
  recentSchoolScores?: { math?: number | null; korean?: number | null; science?: number | null }
): StrengthAnalysis {
  const sorted = (Object.entries(scores) as [Intelligence, number][]).sort((a, b) => b[1] - a[1])
  const topStrengths = sorted.slice(0, 3).map((s) => s[0])
  const bottomWeaknesses = sorted.slice(-3).map((s) => s[0])

  const top1 = sorted[0][1]
  const bottom1 = sorted[sorted.length - 1][1]
  const unevennessIndex = Math.max(0, Math.min(10, top1 - bottom1))

  // 학교 점수 평균 (있을 때만)
  const schoolAvg = (() => {
    const arr = [recentSchoolScores?.math, recentSchoolScores?.korean, recentSchoolScores?.science]
      .filter((v): v is number => typeof v === "number")
    if (!arr.length) return null
    return arr.reduce((a, b) => a + b, 0) / arr.length
  })()

  // 영재교육원 의뢰 트리거
  // 1) 한 영역 8점 이상 + 다른 영역과 격차 4점 이상
  // 2) 학교 점수 하위 30% (40점 이하) + 어떤 영역이든 8점 이상  => 이중특수성 강력 시그널
  let giftedReferral = false
  let reason = ""
  if (top1 >= 8 && unevennessIndex >= 4) {
    giftedReferral = true
    reason = `${INTELLIGENCES[topStrengths[0]].name} 영역에서 ${top1}점으로 두드러진 강점이 보이며, 약점 영역과 ${unevennessIndex}점의 격차가 있습니다. 단일 분야 영재 가능성이 있습니다.`
  }
  if (schoolAvg !== null && schoolAvg <= 40 && top1 >= 8) {
    giftedReferral = true
    reason = `학교 점수 평균 ${Math.round(schoolAvg)}점(하위권)이지만 ${INTELLIGENCES[topStrengths[0]].name} 영역은 ${top1}점입니다. 이중특수성(2e) 영재 가능성이 매우 높아 영재교육원 진단을 권장합니다.`
  }

  // 학습클리닉 의뢰: 모든 영역 4점 이하
  const clinicReferral = sorted.every((s) => s[1] <= 4)
  if (clinicReferral) {
    reason = "8개 지능 모두 4점 이하로 측정되었습니다. 일시적 컨디션·정서 이슈 가능성을 배제하기 위해 학습클리닉 1회 진단을 권장합니다."
  }

  // 강점 기반 진로 매칭 (TOP 1·2·3에서 상위 careers 픽업)
  const strongestCareers: string[] = []
  for (const code of topStrengths) {
    for (const c of INTELLIGENCES[code].careers) {
      if (strongestCareers.length < 5 && !strongestCareers.includes(c)) {
        strongestCareers.push(c)
      }
    }
  }

  return {
    scores,
    topStrengths,
    bottomWeaknesses,
    unevennessIndex: Math.round(unevennessIndex * 10) / 10,
    giftedReferral,
    clinicReferral,
    strongestCareers,
    reasoning: reason || "전반적으로 균형 잡힌 프로파일입니다. 특정 의뢰 트리거에 해당하지 않습니다.",
  }
}

// ─────────────── KDC → 지능 추정 (도서관정보나루 도서 → 강점 시그널) ───────────────

export function kdcToIntelligences(kdc: string): Intelligence[] {
  if (!kdc) return []
  const result: Set<Intelligence> = new Set()
  const code = kdc.split(".")[0].padEnd(3, "0").slice(0, 3)
  const num = parseInt(code, 10)
  if (isNaN(num)) return []
  for (const [intel, meta] of Object.entries(INTELLIGENCES) as [Intelligence, IntelligenceMeta][]) {
    for (const range of meta.kdcRange) {
      if (range.includes("-")) {
        const [s, e] = range.split("-").map((n) => parseInt(n, 10))
        if (num >= s && num <= e) result.add(intel)
      } else {
        if (num === parseInt(range, 10)) result.add(intel)
      }
    }
  }
  return Array.from(result)
}

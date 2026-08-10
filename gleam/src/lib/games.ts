// 5분 게임형 진단 4종 — 데이터 정의 + AI 분석 프롬프트
// 게임은 학생이 5분 안에 모두 끝낼 수 있어야 함. 거부감 0, 진단처럼 안 느껴지게.

import type { GameType, Intelligence } from "./strength-matrix"
import { generateJSON } from "./anthropic"

// ─────────────── 게임 1. 단어 자유 연상 ───────────────
// 측정: 언어(LING), 논리수학(LOGI), 자기성찰(INTR)
// 학생에게 "씨앗"이라는 한 단어를 주고 1분 동안 떠오르는 단어 자유롭게 입력
// 분석 신호: 단어 수, 의미 클러스터 다양성, 추상도, 정서어 비율
export const WORD_ASSOC = {
  type: "WORD_ASSOC" as GameType,
  title: "단어 폭포 게임",
  durationSec: 60,
  description: "한 단어에서 시작해 1분 동안 떠오르는 단어를 자유롭게 적어보세요.",
  starterWords: ["씨앗", "달", "거울", "다리", "별"],
  // 학년별 starter — 저학년은 더 구체적
  starterByAge: {
    ELEMENTARY_LOW: ["씨앗", "별", "고양이", "비"],
    ELEMENTARY_HIGH: ["거울", "다리", "씨앗", "그림자"],
    MIDDLE_SCHOOL: ["경계", "거울", "균형", "흐름"],
    HIGH_SCHOOL: ["경계", "기억", "허물", "관성"],
  },
}

// ─────────────── 게임 2. 이야기 완성 ───────────────
// 측정: 언어(LING), 자기성찰(INTR), 대인관계(INTP), 시각공간(VISU)
// 짧은 이야기 시작 문장을 주고 학생이 5문장 이내로 마무리
// 분석 신호: 인물 감정 묘사, 갈등 인식, 결말 유형, 시각적 묘사
export const STORY_COMPLETE = {
  type: "STORY_COMPLETE" as GameType,
  title: "이야기 이어쓰기",
  durationSec: 120,
  description: "이야기 첫 부분을 읽고, 5문장 이내로 마무리해보세요.",
  prompts: [
    {
      id: "lost-key",
      starter: "지원이는 학교 사물함 앞에서 한참 서 있었다. 어제 분명히 두고 갔던 열쇠가 사라졌다. 옆 자리 친구가 미안한 표정으로 다가왔다.",
    },
    {
      id: "old-tree",
      starter: "운동장 끝의 오래된 나무에 누군가 작은 편지를 묶어두었다. 편지엔 내 이름이 적혀 있었다.",
    },
    {
      id: "mirror",
      starter: "어느 아침, 거울 속의 내가 나를 보고 손을 흔들었다. 나는 손을 들지 않았는데도.",
    },
  ],
}

// ─────────────── 게임 3. 그림 선택 + 이유 ───────────────
// 측정: 시각공간(VISU), 자연친화(NATU), 신체운동(BODY), 대인관계(INTP)
// 4컷의 짧은 묘사를 보고 가장 끌리는 장면을 고르고 이유를 1~2문장으로 적기
// 분석 신호: 선택 패턴 일관성, 이유의 구체성·시각성·정서성
export const VISUAL_CHOICE = {
  type: "VISUAL_CHOICE" as GameType,
  title: "어떤 장면이 끌려?",
  durationSec: 90,
  description: "4개의 장면 중에서 가장 끌리는 곳을 골라보세요. 그리고 왜 끌렸는지 적어주세요.",
  rounds: [
    {
      id: "round-1",
      scenes: [
        { code: "VISU", text: "거대한 통유리창 너머로 도시 전체가 보이는 도서관 꼭대기 자리" },
        { code: "BODY", text: "흙과 풀냄새가 나는 학교 운동장 한가운데, 친구들과 뛰어노는 자리" },
        { code: "NATU", text: "햇볕이 비스듬히 들어오는 작은 정원, 식물 사이로 새 한 마리가 앉아있다" },
        { code: "INTP", text: "사람들이 한가롭게 이야기 나누는 카페 한쪽, 따뜻한 음료를 두고 친구를 기다리는 자리" },
      ],
    },
    {
      id: "round-2",
      scenes: [
        { code: "VISU", text: "벽에 큰 그림이 가득 걸린 미술관, 한 그림 앞에 멈춰 한참을 보는 것" },
        { code: "BODY", text: "주방에서 직접 재료를 다듬고 요리하는 시간, 손에서 향이 난다" },
        { code: "NATU", text: "비 온 다음 날 산속 작은 길을 천천히 걷는 것, 나무 잎에 물방울이 떨어진다" },
        { code: "INTP", text: "여러 명이 둘러앉아 보드게임을 하며 웃고 떠드는 시간" },
      ],
    },
  ],
}

// ─────────────── 게임 4. 시간·패턴 추정 ───────────────
// 측정: 논리수학(LOGI), 음악(MUSI - 리듬), 신체운동(BODY)
// (1) 화면에 비트가 흐르고 같은 패턴 따라하기 / (2) "1분이 지났다고 생각하면 버튼" / (3) 다음 숫자 패턴 맞추기
export const TIME_PATTERN = {
  type: "TIME_PATTERN" as GameType,
  title: "시간과 패턴 게임",
  durationSec: 120,
  description: "세 가지 짧은 도전이에요. 정답이 있는 것도 있고, 없는 것도 있어요.",
  challenges: [
    {
      id: "rhythm-tap",
      kind: "rhythm",
      label: "들리는 박자에 맞춰 버튼을 눌러보세요 (8회)",
      // 클라에서 비트 시퀀스를 재생, 사용자 탭 타임스탬프 기록 → 일관성 측정 (MUSI/BODY)
    },
    {
      id: "minute-estimate",
      kind: "time-estimate",
      label: "지금부터 시간을 재요. '60초가 지났어'라고 생각하면 버튼을 눌러주세요.",
      // 정답은 60초. 편차의 절댓값 → BODY/LOGI
    },
    {
      id: "number-pattern",
      kind: "logic",
      label: "다음에 올 숫자는?",
      questions: [
        { seq: [2, 4, 8, 16, "?"], answer: 32 },
        { seq: [1, 1, 2, 3, 5, "?"], answer: 8 },
        { seq: [3, 6, 11, 18, "?"], answer: 27 },
      ],
    },
  ],
}

// ─────────────── 게임별 AI 분석 프롬프트 ───────────────
// 게임 raw 데이터를 받아 8지능 시그널 (0~10)을 추정한다.
// 결정적인 알고리즘은 클라/서버에서 1차 점수화 (단어 수, 정답률 등) 후, AI가 *질적 신호*를 추가 평가.

export const SIGNAL_SYSTEM = `당신은 인지·교육 평가 전문가입니다. 학생의 게임 결과 데이터를 분석해 가드너 다중지능 8영역 중 어느 영역에서 강점/약점 시그널이 보이는지 0~10 점수로 추정합니다.

핵심 원칙:
1. 단일 게임 결과만으로 단정하지 말고 '시그널'로만 다룬다 (최종 점수는 4개 게임 합산).
2. 학생을 약자/부진으로 보지 말고 *어떤 영역에 빛이 있는가* 관점으로 분석한다.
3. 자료가 부족한 영역은 0이 아니라 null로 표기하지 말고 5(중립)로 둔다.
4. 학생의 글이 짧거나 회피적이어도, 그 안에 보이는 미세한 신호(단어 선택, 문장 구조, 정서어)를 포착한다.
5. 한국어 학생을 가정하되, 다문화 학생일 가능성도 고려해 한국어 능력과 사고 깊이를 분리해 본다.

응답은 반드시 아래 JSON만:
{
  "signals": { "LING": 7.0, "LOGI": 4.0, "VISU": 6.0, "MUSI": 5.0, "BODY": 5.0, "INTP": 6.5, "INTR": 8.0, "NATU": 5.0 },
  "notes": "강점 신호 1~2개, 약점 신호 1~2개, 학생 격려 메시지를 3~4문장으로"
}`

export type SignalResult = {
  signals: Record<Intelligence, number>
  notes: string
}

export async function analyzeWordAssoc(words: string[], starter: string, ageGroup: string): Promise<SignalResult> {
  const userMsg = `[게임: 단어 폭포]
시작 단어: "${starter}"
대상 연령: ${ageGroup}
학생이 1분간 적은 단어 (${words.length}개): ${JSON.stringify(words)}

분석 포인트:
- 단어 수 (유창성): LING 시그널
- 의미 클러스터의 폭/전환 횟수 (음식·자연·감정·사람 등): 사고 유연성 → LING/LOGI
- 추상어·정서어 비율: INTR
- 인과·관계 표현 추정 (예: "비-우산"은 인과 연결): LOGI
- 시각·공간 단어 비중 (색·모양): VISU
- 자연·생물 단어 비중: NATU`
  return generateJSON<SignalResult>(SIGNAL_SYSTEM, userMsg, 800)
}

export async function analyzeStoryComplete(starter: string, ending: string, ageGroup: string): Promise<SignalResult> {
  const userMsg = `[게임: 이야기 이어쓰기]
시작 문장: "${starter}"
학생이 쓴 결말 (${ending.length}자): "${ending}"
대상 연령: ${ageGroup}

분석 포인트:
- 문장의 자연스러움·풍부함: LING
- 인물 감정·동기 묘사: INTP, INTR
- 갈등 해결 방식 (대화·행동·관찰): INTP/BODY/INTR
- 시각적 묘사·공간 표현: VISU
- 결말의 창의성 (예측 가능 vs 반전): 창의성 + LING
- 도덕적·관계적 메시지 인식: INTP/INTR`
  return generateJSON<SignalResult>(SIGNAL_SYSTEM, userMsg, 800)
}

export async function analyzeVisualChoice(
  picks: { roundId: string; sceneCode: string; reason: string }[],
  ageGroup: string
): Promise<SignalResult> {
  const userMsg = `[게임: 어떤 장면이 끌려?]
대상 연령: ${ageGroup}
학생의 선택과 이유:
${picks.map((p, i) => `R${i + 1}: 선택 ${p.sceneCode} | 이유: "${p.reason}"`).join("\n")}

분석 포인트:
- 선택 일관성 (같은 코드를 두 라운드에서 고름): 강한 선호
- 이유의 구체성/시각성: VISU
- 이유의 신체·감각 표현: BODY
- 이유의 자연·생물 묘사: NATU
- 이유의 사람·관계 묘사: INTP
- 이유의 자기 감정 인식: INTR`
  return generateJSON<SignalResult>(SIGNAL_SYSTEM, userMsg, 800)
}

export async function analyzeTimePattern(
  result: {
    rhythmConsistencyMs?: number  // 비트 탭 표준편차 (낮을수록 좋음)
    minuteEstimateMs?: number      // 60000ms와의 편차
    patternCorrect?: number        // 0~3
  },
  ageGroup: string
): Promise<SignalResult> {
  const userMsg = `[게임: 시간과 패턴]
대상 연령: ${ageGroup}
결과:
- 비트 탭 표준편차: ${result.rhythmConsistencyMs ?? "N/A"}ms (낮을수록 일관성 ↑, 200ms 이하면 우수)
- 1분 추정 편차: ${result.minuteEstimateMs ?? "N/A"}ms (절댓값. 5초 이내면 매우 정확)
- 숫자 패턴 정답: ${result.patternCorrect ?? 0}/3

분석 포인트:
- 비트 일관성 → MUSI (리듬), BODY (운동 제어)
- 시간 추정 정확도 → BODY (시간 감각), LOGI
- 패턴 정답 → LOGI`
  return generateJSON<SignalResult>(SIGNAL_SYSTEM, userMsg, 600)
}

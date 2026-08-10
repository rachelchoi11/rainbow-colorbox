"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"

type Game = "WORD_ASSOC" | "STORY_COMPLETE" | "VISUAL_CHOICE" | "TIME_PATTERN"

const GAMES: Game[] = ["WORD_ASSOC", "STORY_COMPLETE", "VISUAL_CHOICE", "TIME_PATTERN"]
const TITLES: Record<Game, string> = {
  WORD_ASSOC: "1/4. 단어 폭포",
  STORY_COMPLETE: "2/4. 이야기 이어쓰기",
  VISUAL_CHOICE: "3/4. 어떤 장면이 끌려?",
  TIME_PATTERN: "4/4. 시간과 패턴",
}

export default function DiagnosePage() {
  return (
    <Suspense fallback={<p className="text-[#9ba3c7]">로딩 중...</p>}>
      <DiagnoseInner />
    </Suspense>
  )
}

function DiagnoseInner() {
  const params = useSearchParams()
  const router = useRouter()
  const studentId = params.get("studentId") || ""
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  if (!studentId) {
    return <p className="text-[#9ba3c7]">학생 ID가 없습니다. <a href="/onboard" className="underline">진단을 시작</a>해주세요.</p>
  }

  const game = GAMES[step]

  async function handleResult(rawData: Record<string, unknown>, durationMs: number) {
    setBusy(true)
    try {
      await fetch("/api/games/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, gameType: game, rawData, durationMs }),
      })
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
      if (step < GAMES.length - 1) {
        setStep(step + 1)
      } else {
        finalize()
      }
    }
  }

  async function finalize() {
    setBusy(true)
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      })
      const data = await res.json()
      if (data.diagnosisId) router.push(`/result/${data.diagnosisId}`)
      else alert("분석 실패: " + (data.error || "알 수 없는 오류"))
    } catch (e) {
      alert("분석 중 오류: " + e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <p className="text-xs text-[#9ba3c7] uppercase tracking-widest">{TITLES[game]}</p>
        <div className="h-1 bg-[#1f2547] rounded mt-2">
          <div
            className="h-1 bg-[#8b9aff] rounded transition-all"
            style={{ width: `${((step + 1) / GAMES.length) * 100}%` }}
          />
        </div>
      </div>

      {busy && <p className="text-center text-[#9ba3c7] py-12">분석 중... 잠시만요.</p>}

      {!busy && game === "WORD_ASSOC" && <WordAssocGame onDone={handleResult} />}
      {!busy && game === "STORY_COMPLETE" && <StoryCompleteGame onDone={handleResult} />}
      {!busy && game === "VISUAL_CHOICE" && <VisualChoiceGame onDone={handleResult} />}
      {!busy && game === "TIME_PATTERN" && <TimePatternGame onDone={handleResult} />}
    </div>
  )
}

// ─────────────── 게임 1. 단어 폭포 ───────────────
function WordAssocGame({ onDone }: { onDone: (data: Record<string, unknown>, ms: number) => void }) {
  const STARTERS = ["거울", "씨앗", "다리", "별"]
  const [starter] = useState(() => STARTERS[Math.floor(Math.random() * STARTERS.length)])
  const [words, setWords] = useState<string[]>([])
  const [input, setInput] = useState("")
  const [secondsLeft, setSecondsLeft] = useState(60)
  const startedAt = useRef(Date.now())
  const submittedRef = useRef(false)

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t)
          if (!submittedRef.current) {
            submittedRef.current = true
            onDone({ starter, words }, Date.now() - startedAt.current)
          }
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [starter, words, onDone])

  function add() {
    const w = input.trim()
    if (!w) return
    setWords([...words, w])
    setInput("")
  }

  return (
    <div className="card">
      <h2 className="text-2xl font-bold mb-2">시작 단어: <span className="text-[#ffd97a]">"{starter}"</span></h2>
      <p className="text-sm text-[#9ba3c7] mb-6">
        떠오르는 단어를 순서대로 적어주세요. 한 단어씩, Enter로 추가됩니다.
      </p>
      <div className="text-center mb-4 text-3xl font-mono">{secondsLeft}s</div>
      <input
        autoFocus
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            add()
          }
        }}
        placeholder="단어..."
        className="w-full px-4 py-3 rounded-lg bg-[#0a0e1a] border border-[#1f2547] text-lg"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {words.map((w, i) => (
          <span key={i} className="px-3 py-1 bg-[#1a2046] rounded-full text-sm">{w}</span>
        ))}
      </div>
      <p className="mt-4 text-xs text-[#6b7280]">{words.length}개 입력됨</p>
    </div>
  )
}

// ─────────────── 게임 2. 이야기 이어쓰기 ───────────────
function StoryCompleteGame({ onDone }: { onDone: (data: Record<string, unknown>, ms: number) => void }) {
  const PROMPTS = [
    "지원이는 학교 사물함 앞에서 한참 서 있었다. 어제 분명히 두고 갔던 열쇠가 사라졌다. 옆 자리 친구가 미안한 표정으로 다가왔다.",
    "운동장 끝의 오래된 나무에 누군가 작은 편지를 묶어두었다. 편지엔 내 이름이 적혀 있었다.",
    "어느 아침, 거울 속의 내가 나를 보고 손을 흔들었다. 나는 손을 들지 않았는데도.",
  ]
  const [starter] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)])
  const [text, setText] = useState("")
  const startedAt = useRef(Date.now())

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-3">이야기 첫 부분</h2>
      <p className="text-[#c8cfe8] leading-relaxed mb-6 italic">"{starter}"</p>
      <p className="text-sm text-[#9ba3c7] mb-3">5문장 이내로 마무리해주세요.</p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="w-full px-4 py-3 rounded-lg bg-[#0a0e1a] border border-[#1f2547]"
        placeholder="이야기를 이어가세요..."
      />
      <button
        onClick={() => onDone({ starter, ending: text }, Date.now() - startedAt.current)}
        disabled={text.trim().length < 5}
        className="btn btn-primary mt-4 w-full disabled:opacity-50"
      >
        다음 →
      </button>
    </div>
  )
}

// ─────────────── 게임 3. 어떤 장면이 끌려? ───────────────
function VisualChoiceGame({ onDone }: { onDone: (data: Record<string, unknown>, ms: number) => void }) {
  const ROUNDS = [
    {
      id: "r1",
      scenes: [
        { code: "VISU", text: "거대한 통유리창 너머로 도시 전체가 보이는 도서관 꼭대기 자리" },
        { code: "BODY", text: "흙과 풀냄새가 나는 학교 운동장 한가운데, 친구들과 뛰어노는 자리" },
        { code: "NATU", text: "햇볕이 비스듬히 들어오는 작은 정원, 식물 사이로 새 한 마리가 앉아있다" },
        { code: "INTP", text: "사람들이 한가롭게 이야기 나누는 카페 한쪽, 따뜻한 음료를 두고 친구를 기다리는 자리" },
      ],
    },
    {
      id: "r2",
      scenes: [
        { code: "VISU", text: "벽에 큰 그림이 가득 걸린 미술관, 한 그림 앞에 멈춰 한참을 보는 것" },
        { code: "BODY", text: "주방에서 직접 재료를 다듬고 요리하는 시간, 손에서 향이 난다" },
        { code: "NATU", text: "비 온 다음 날 산속 작은 길을 천천히 걷는 것, 나무 잎에 물방울이 떨어진다" },
        { code: "INTP", text: "여러 명이 둘러앉아 보드게임을 하며 웃고 떠드는 시간" },
      ],
    },
  ]
  const [round, setRound] = useState(0)
  const [picks, setPicks] = useState<{ roundId: string; sceneCode: string; reason: string }[]>([])
  const [pickIdx, setPickIdx] = useState<number | null>(null)
  const [reason, setReason] = useState("")
  const startedAt = useRef(Date.now())

  const r = ROUNDS[round]

  function next() {
    if (pickIdx === null || !reason.trim()) return
    const newPicks = [...picks, { roundId: r.id, sceneCode: r.scenes[pickIdx].code, reason: reason.trim() }]
    setPicks(newPicks)
    setPickIdx(null)
    setReason("")
    if (round < ROUNDS.length - 1) {
      setRound(round + 1)
    } else {
      onDone({ picks: newPicks }, Date.now() - startedAt.current)
    }
  }

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-3">라운드 {round + 1}/{ROUNDS.length}: 어떤 장면이 가장 끌리나요?</h2>
      <div className="space-y-3 mb-6">
        {r.scenes.map((s, i) => (
          <button
            key={i}
            onClick={() => setPickIdx(i)}
            className={`block w-full text-left p-4 rounded-lg border transition ${
              pickIdx === i
                ? "border-[#8b9aff] bg-[#1a2046]"
                : "border-[#1f2547] hover:bg-[#131831]"
            }`}
          >
            {s.text}
          </button>
        ))}
      </div>
      <p className="text-sm text-[#9ba3c7] mb-2">왜 끌리나요? (1~2문장)</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        className="w-full px-4 py-3 rounded-lg bg-[#0a0e1a] border border-[#1f2547]"
      />
      <button onClick={next} disabled={pickIdx === null || !reason.trim()} className="btn btn-primary mt-4 w-full disabled:opacity-50">
        {round < ROUNDS.length - 1 ? "다음 라운드 →" : "다음 게임 →"}
      </button>
    </div>
  )
}

// ─────────────── 게임 4. 시간과 패턴 ───────────────
function TimePatternGame({ onDone }: { onDone: (data: Record<string, unknown>, ms: number) => void }) {
  const [phase, setPhase] = useState<"intro" | "rhythm" | "minute" | "logic">("intro")
  const [rhythmTaps, setRhythmTaps] = useState<number[]>([])
  const [minuteEstStart, setMinuteEstStart] = useState<number | null>(null)
  const [minuteEstResult, setMinuteEstResult] = useState<number | null>(null)
  const [logicAnswers, setLogicAnswers] = useState<(number | null)[]>([null, null, null])
  const startedAt = useRef(Date.now())

  const QS = [
    { seq: [2, 4, 8, 16, "?"], answer: 32, options: [24, 32, 40, 48] },
    { seq: [1, 1, 2, 3, 5, "?"], answer: 8, options: [7, 8, 10, 13] },
    { seq: [3, 6, 11, 18, "?"], answer: 27, options: [21, 25, 27, 30] },
  ]

  function finishAll() {
    const rhythmStd = rhythmTaps.length > 1
      ? (() => {
          const intervals = rhythmTaps.slice(1).map((t, i) => t - rhythmTaps[i])
          const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
          const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length
          return Math.sqrt(variance)
        })()
      : null
    const minuteDiff = minuteEstResult !== null ? Math.abs(minuteEstResult - 60000) : null
    const correct = logicAnswers.filter((a, i) => a === QS[i].answer).length
    onDone(
      {
        rhythmConsistencyMs: rhythmStd,
        minuteEstimateMs: minuteDiff,
        patternCorrect: correct,
      },
      Date.now() - startedAt.current
    )
  }

  if (phase === "intro") {
    return (
      <div className="card text-center">
        <h2 className="text-xl font-bold mb-4">시간과 패턴 게임</h2>
        <p className="text-[#9ba3c7] mb-6">3가지 짧은 도전입니다. 전부 해야 결과가 나옵니다.</p>
        <button className="btn btn-primary" onClick={() => setPhase("rhythm")}>시작 →</button>
      </div>
    )
  }

  if (phase === "rhythm") {
    return (
      <div className="card text-center">
        <h2 className="text-xl font-bold mb-3">1) 박자 따라하기</h2>
        <p className="text-[#9ba3c7] mb-6">머릿속에 일정한 박자를 떠올리고, 그 박자에 맞춰 버튼을 8번 눌러주세요.</p>
        <button
          className="btn btn-primary text-2xl px-12 py-8"
          onClick={() => {
            const newTaps = [...rhythmTaps, Date.now()]
            setRhythmTaps(newTaps)
            if (newTaps.length >= 8) setPhase("minute")
          }}
        >
          탭 ({rhythmTaps.length}/8)
        </button>
      </div>
    )
  }

  if (phase === "minute") {
    return (
      <div className="card text-center">
        <h2 className="text-xl font-bold mb-3">2) 1분이 지났다고 생각하면</h2>
        <p className="text-[#9ba3c7] mb-6">시작 버튼을 누르고, 머릿속으로 1분이 지났다 싶을 때 멈춤 버튼을 눌러주세요.</p>
        {minuteEstStart === null ? (
          <button className="btn btn-primary" onClick={() => setMinuteEstStart(Date.now())}>시작</button>
        ) : (
          <button
            className="btn btn-primary text-xl"
            onClick={() => {
              setMinuteEstResult(Date.now() - minuteEstStart)
              setPhase("logic")
            }}
          >
            지금! 1분이 됐어요
          </button>
        )}
      </div>
    )
  }

  if (phase === "logic") {
    return (
      <div className="card">
        <h2 className="text-xl font-bold mb-4">3) 다음에 올 숫자는?</h2>
        {QS.map((q, i) => (
          <div key={i} className="mb-4 pb-4 border-b border-[#1f2547] last:border-0">
            <p className="mb-2 font-mono text-lg">{q.seq.join(", ")}</p>
            <div className="flex gap-2 flex-wrap">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    const next = [...logicAnswers]
                    next[i] = opt
                    setLogicAnswers(next)
                  }}
                  className={`px-4 py-2 rounded-lg ${
                    logicAnswers[i] === opt ? "bg-[#8b9aff] text-[#0a0e1a]" : "bg-[#1a2046]"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={finishAll}
          disabled={logicAnswers.some((a) => a === null)}
          className="btn btn-primary w-full mt-4 disabled:opacity-50"
        >
          진단 완료 →
        </button>
      </div>
    )
  }

  return null
}

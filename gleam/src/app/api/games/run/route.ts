import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  analyzeWordAssoc,
  analyzeStoryComplete,
  analyzeVisualChoice,
  analyzeTimePattern,
} from "@/lib/games"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { studentId, gameType, rawData, durationMs } = body
  if (!studentId || !gameType || !rawData) {
    return NextResponse.json({ error: "필수 필드 누락" }, { status: 400 })
  }
  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) return NextResponse.json({ error: "학생 없음" }, { status: 404 })

  let signals
  try {
    if (gameType === "WORD_ASSOC") {
      signals = await analyzeWordAssoc(rawData.words ?? [], rawData.starter ?? "", student.ageGroup)
    } else if (gameType === "STORY_COMPLETE") {
      signals = await analyzeStoryComplete(rawData.starter ?? "", rawData.ending ?? "", student.ageGroup)
    } else if (gameType === "VISUAL_CHOICE") {
      signals = await analyzeVisualChoice(rawData.picks ?? [], student.ageGroup)
    } else if (gameType === "TIME_PATTERN") {
      signals = await analyzeTimePattern(rawData, student.ageGroup)
    } else {
      return NextResponse.json({ error: "알 수 없는 게임 타입" }, { status: 400 })
    }
  } catch (e) {
    console.error("[games/run] AI 분석 실패:", e)
    // 실패 시 모든 영역 5점 (중립)
    signals = {
      signals: { LING: 5, LOGI: 5, VISU: 5, MUSI: 5, BODY: 5, INTP: 5, INTR: 5, NATU: 5 },
      notes: "AI 분석 일시 오류 — 기본값으로 처리",
    }
  }

  const run = await prisma.gameRun.create({
    data: {
      studentId,
      gameType,
      rawData: JSON.stringify(rawData),
      durationMs: durationMs ?? 0,
      signals: JSON.stringify(signals.signals),
      aiNotes: signals.notes,
    },
  })

  return NextResponse.json({ runId: run.id, signals: signals.signals, notes: signals.notes })
}

// POST /api/diagnose — 학생의 게임 결과들을 합산해 강점 프로파일을 만들고 저장.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  combineGameSignals,
  analyzeStrengths,
  type Intelligence,
  type GameType,
  type GameSignals,
} from "@/lib/strength-matrix"
import { generateStudentSummary } from "@/lib/strength-prompts"

export async function POST(req: NextRequest) {
  const { studentId } = await req.json()
  if (!studentId) return NextResponse.json({ error: "studentId 필요" }, { status: 400 })

  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) return NextResponse.json({ error: "학생 없음" }, { status: 404 })

  const runs = await prisma.gameRun.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  if (runs.length < 2) {
    return NextResponse.json({ error: "게임을 2개 이상 완료해주세요." }, { status: 400 })
  }

  // 가장 최근 각 gameType의 결과만 사용
  const latestPerType = new Map<GameType, { gameType: GameType; signals: GameSignals }>()
  for (const r of runs) {
    const gt = r.gameType as GameType
    if (latestPerType.has(gt)) continue
    try {
      const signals = JSON.parse(r.signals) as GameSignals
      latestPerType.set(gt, { gameType: gt, signals })
    } catch { /* skip */ }
  }
  const combined = combineGameSignals(Array.from(latestPerType.values()))

  const analysis = analyzeStrengths(combined, {
    math: student.recentMath,
    korean: student.recentKorean,
    science: student.recentScience,
  })

  // 학생용 종합 메시지 생성
  let summary = ""
  try {
    summary = await generateStudentSummary({
      studentName: student.name,
      ageGroup: student.ageGroup,
      scores: analysis.scores,
      topStrengths: analysis.topStrengths,
      bottomWeaknesses: analysis.bottomWeaknesses,
      unevennessIndex: analysis.unevennessIndex,
      giftedReferral: analysis.giftedReferral,
      clinicReferral: analysis.clinicReferral,
      schoolScores: {
        math: student.recentMath,
        korean: student.recentKorean,
        science: student.recentScience,
      },
      region: student.region ?? undefined,
    })
  } catch (e) {
    console.error("[diagnose] summary 생성 실패:", e)
    summary = "강점 분석이 완료되었습니다. 상세 분석은 학부모 리포트에서 확인해주세요."
  }

  const diag = await prisma.diagnosis.create({
    data: {
      studentId,
      scores: JSON.stringify(analysis.scores),
      soloScores: JSON.stringify({
        depth: 5, creativity: 5, logic: 5, empathy: 5, // TODO: 게임에서 SOLO도 추출 시 채움
      }),
      topStrengths: JSON.stringify(analysis.topStrengths),
      careerSuggestions: JSON.stringify(analysis.strongestCareers.map((c) => ({ name: c, reason: "강점 영역 매칭" }))),
      giftedReferral: analysis.giftedReferral,
      clinicReferral: analysis.clinicReferral,
      unevennessIndex: analysis.unevennessIndex,
      summary,
    },
  })

  // 학생 모델에 강점 점수 캐시
  await prisma.student.update({
    where: { id: studentId },
    data: {
      ling: analysis.scores.LING,
      logi: analysis.scores.LOGI,
      visu: analysis.scores.VISU,
      musi: analysis.scores.MUSI,
      body: analysis.scores.BODY,
      intp: analysis.scores.INTP,
      intr: analysis.scores.INTR,
      natu: analysis.scores.NATU,
    },
  })

  return NextResponse.json({
    diagnosisId: diag.id,
    analysis,
    summary,
  })
}

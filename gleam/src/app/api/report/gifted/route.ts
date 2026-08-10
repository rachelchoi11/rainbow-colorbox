// POST /api/report/gifted — 영재교육원 자동 의뢰서 DOCX

import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateGiftedReferral } from "@/lib/strength-prompts"
import { buildReportDocx } from "@/lib/docx"
import type { Intelligence } from "@/lib/strength-matrix"

export async function POST(req: NextRequest) {
  const { studentId, diagnosisId } = await req.json()
  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) return new Response("학생 없음", { status: 404 })

  const diag = diagnosisId
    ? await prisma.diagnosis.findUnique({ where: { id: diagnosisId } })
    : await prisma.diagnosis.findFirst({ where: { studentId }, orderBy: { createdAt: "desc" } })
  if (!diag) return new Response("진단 결과 없음", { status: 404 })
  if (!diag.giftedReferral) {
    return new Response("이 학생은 현재 영재교육원 의뢰 트리거 조건을 충족하지 않습니다.", { status: 400 })
  }

  const scores = JSON.parse(diag.scores) as Record<Intelligence, number>
  const topStrengths = JSON.parse(diag.topStrengths) as Intelligence[]

  const bodyMd = await generateGiftedReferral({
    studentName: student.name,
    ageGroup: student.ageGroup,
    scores,
    topStrengths,
    bottomWeaknesses: (Object.entries(scores) as [Intelligence, number][]).sort((a, b) => a[1] - b[1]).slice(0, 3).map((s) => s[0]),
    unevennessIndex: diag.unevennessIndex,
    giftedReferral: true,
    clinicReferral: false,
    schoolScores: {
      math: student.recentMath,
      korean: student.recentKorean,
      science: student.recentScience,
    },
    region: student.region ?? undefined,
  })

  const buffer = await buildReportDocx({
    title: "영재교육원 진단 추천 의뢰서",
    subtitle: "별의아이들 AI 자동 생성 (1차 스크리닝)",
    studentName: student.name,
    bodyMd,
    scores,
  })

  await prisma.report.create({
    data: {
      studentId,
      diagnosisId: diag.id,
      audience: "GIFTED_REFERRAL",
      title: `${student.name} — 영재교육원 의뢰서`,
      contentMd: bodyMd,
    },
  })

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(student.name)}-gifted-referral.docx"`,
    },
  })
}

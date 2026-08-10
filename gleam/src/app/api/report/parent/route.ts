// POST /api/report/parent — 학부모용 강점 리포트 DOCX 생성

import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateParentReport } from "@/lib/strength-prompts"
import { buildReportDocx } from "@/lib/docx"
import type { Intelligence } from "@/lib/strength-matrix"

export async function POST(req: NextRequest) {
  const { studentId, diagnosisId } = await req.json()
  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) return new Response("학생 없음", { status: 404 })

  let diag
  if (diagnosisId) {
    diag = await prisma.diagnosis.findUnique({ where: { id: diagnosisId } })
  } else {
    diag = await prisma.diagnosis.findFirst({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    })
  }
  if (!diag) return new Response("진단 결과 없음", { status: 404 })

  const scores = JSON.parse(diag.scores) as Record<Intelligence, number>
  const topStrengths = JSON.parse(diag.topStrengths) as Intelligence[]
  const bottomWeaknesses = (Object.entries(scores) as [Intelligence, number][])
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map((s) => s[0])

  const recentBooks: string[] = []  // TODO: 도서관 이력 연결 시 채움

  const bodyMd = await generateParentReport({
    studentName: student.name,
    ageGroup: student.ageGroup,
    scores,
    topStrengths,
    bottomWeaknesses,
    unevennessIndex: diag.unevennessIndex,
    giftedReferral: diag.giftedReferral,
    clinicReferral: diag.clinicReferral,
    schoolScores: {
      math: student.recentMath,
      korean: student.recentKorean,
      science: student.recentScience,
    },
    recentBooks,
    region: student.region ?? undefined,
  })

  const buffer = await buildReportDocx({
    title: "별의아이들 — 강점 발견 리포트",
    subtitle: "학부모·교사용 종합 분석",
    studentName: student.name,
    bodyMd,
    scores,
  })

  await prisma.report.create({
    data: {
      studentId,
      diagnosisId: diag.id,
      audience: "PARENT",
      title: `${student.name} — 강점 발견 리포트`,
      contentMd: bodyMd,
    },
  })

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(student.name)}-strength-report.docx"`,
    },
  })
}

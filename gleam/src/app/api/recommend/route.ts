// GET /api/recommend?studentId=... — 학생 강점 프로파일 + 도서관정보나루 결합 추천

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchPopularBooks, mockPopularBooks } from "@/lib/data4library"
import { kdcToIntelligences, INTELLIGENCES, type Intelligence } from "@/lib/strength-matrix"

const AGE_RANGE: Record<string, [number, number]> = {
  ELEMENTARY_LOW: [7, 9],
  ELEMENTARY_HIGH: [10, 12],
  MIDDLE_SCHOOL: [13, 15],
  HIGH_SCHOOL: [16, 18],
}

export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get("studentId")
  if (!studentId) return NextResponse.json({ error: "studentId 필요" }, { status: 400 })
  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) return NextResponse.json({ error: "학생 없음" }, { status: 404 })

  // 또래 인기 도서 가져오기
  const today = new Date()
  const last30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const [from, to] = AGE_RANGE[student.ageGroup] ?? [10, 12]

  let books = await fetchPopularBooks({
    startDt: fmt(last30),
    endDt: fmt(today),
    fromAge: from,
    toAge: to,
    pageSize: 30,
  })
  if (!books.length) books = mockPopularBooks(student.ageGroup)

  // 학생 강점 추출
  const scores = {
    LING: student.ling, LOGI: student.logi, VISU: student.visu, MUSI: student.musi,
    BODY: student.body, INTP: student.intp, INTR: student.intr, NATU: student.natu,
  } as Record<Intelligence, number>
  const sorted = (Object.entries(scores) as [Intelligence, number][]).sort((a, b) => b[1] - a[1])
  const top3: Intelligence[] = sorted.slice(0, 3).map((s) => s[0])

  // 책별 강점 적합도 계산 (KDC → 8지능 매핑)
  type Scored = (typeof books)[number] & { matchScore: number; matchedStrengths: Intelligence[] }
  const scored: Scored[] = books.map((b) => {
    const intels = kdcToIntelligences(b.classNo)
    const matched = intels.filter((i) => top3.includes(i))
    const matchScore = matched.length * 3 + intels.filter((i) => sorted.slice(0, 5).map((s) => s[0]).includes(i)).length
    return { ...b, matchScore, matchedStrengths: matched }
  })
  scored.sort((a, b) => b.matchScore - a.matchScore || b.loanCount - a.loanCount)

  return NextResponse.json({
    student: {
      id: student.id,
      name: student.name,
      topStrengths: top3.map((t) => ({
        code: t,
        name: INTELLIGENCES[t].name,
        emoji: INTELLIGENCES[t].emoji,
      })),
    },
    recommendations: scored.slice(0, 10),
  })
}

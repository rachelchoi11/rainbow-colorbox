import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const StudentSchema = z.object({
  name: z.string().min(1).max(50),
  ageGroup: z.enum(["ELEMENTARY_LOW", "ELEMENTARY_HIGH", "MIDDLE_SCHOOL", "HIGH_SCHOOL"]),
  schoolName: z.string().optional(),
  schoolCode: z.string().optional(),
  grade: z.number().int().min(1).max(12).optional(),
  region: z.string().optional(),
  recentMath: z.number().int().min(0).max(100).optional(),
  recentKorean: z.number().int().min(0).max(100).optional(),
  recentScience: z.number().int().min(0).max(100).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parse = StudentSchema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: "유효하지 않은 입력", issues: parse.error.issues }, { status: 400 })
  }
  const student = await prisma.student.create({ data: parse.data })
  return NextResponse.json({ student }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    const all = await prisma.student.findMany({ orderBy: { createdAt: "desc" }, take: 20 })
    return NextResponse.json({ students: all })
  }
  const student = await prisma.student.findUnique({
    where: { id },
    include: { diagnoses: { orderBy: { createdAt: "desc" }, take: 1 } },
  })
  if (!student) return NextResponse.json({ error: "학생 없음" }, { status: 404 })
  return NextResponse.json({ student })
}

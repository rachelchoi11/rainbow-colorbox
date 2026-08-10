// 시드 데이터 — 가상 학생 6명 + 학습클리닉 시드
import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"
import { CLINIC_SEED } from "../src/lib/clinic-match"

config()
const prisma = new PrismaClient()

async function main() {
  console.log("🌱 시드 시작...")

  // 학습클리닉센터 시드
  for (const c of CLINIC_SEED) {
    await prisma.learningClinic.create({
      data: {
        region: c.region,
        city: c.city,
        name: c.name,
        phone: c.phone ?? null,
        address: c.address ?? null,
      },
    })
  }
  console.log(`✓ 학습클리닉센터 ${CLINIC_SEED.length}개 등록`)

  // 가상 학생 6명 (시연용)
  const STUDENTS = [
    {
      name: "지민",
      ageGroup: "ELEMENTARY_HIGH",
      grade: 5,
      schoolName: "별빛초등학교",
      region: "서울특별시",
      recentMath: 35,
      recentKorean: 60,
      recentScience: 80,
      ling: 6.5, logi: 4.0, visu: 9.0, musi: 7.0, body: 5.5, intp: 6.0, intr: 7.5, natu: 8.0,
    },
    {
      name: "서윤",
      ageGroup: "ELEMENTARY_HIGH",
      grade: 6,
      schoolName: "남촌초등학교",
      region: "경기도",
      recentMath: 92,
      recentKorean: 88,
      recentScience: 95,
      ling: 7.0, logi: 9.0, visu: 6.0, musi: 5.0, body: 4.5, intp: 5.5, intr: 6.0, natu: 5.5,
    },
    {
      name: "도현",
      ageGroup: "MIDDLE_SCHOOL",
      grade: 1,
      schoolName: "한울중학교",
      region: "부산광역시",
      recentMath: 25,
      recentKorean: 30,
      recentScience: 28,
      ling: 4.0, logi: 3.5, visu: 4.5, musi: 5.0, body: 4.0, intp: 4.0, intr: 3.5, natu: 4.0,
    },
    {
      name: "하준",
      ageGroup: "MIDDLE_SCHOOL",
      grade: 2,
      schoolName: "푸른중학교",
      region: "대전광역시",
      recentMath: 70,
      recentKorean: 45,
      recentScience: 60,
      ling: 5.5, logi: 7.0, visu: 5.0, musi: 8.5, body: 7.0, intp: 6.0, intr: 5.0, natu: 4.5,
    },
    {
      name: "예나",
      ageGroup: "ELEMENTARY_LOW",
      grade: 3,
      schoolName: "샛별초등학교",
      region: "인천광역시",
      recentMath: 50,
      recentKorean: 75,
      recentScience: 55,
      ling: 8.5, logi: 5.0, visu: 6.0, musi: 5.5, body: 4.5, intp: 8.0, intr: 7.0, natu: 5.0,
    },
    {
      name: "유진",
      ageGroup: "HIGH_SCHOOL",
      grade: 1,
      schoolName: "동산고등학교",
      region: "광주광역시",
      recentMath: 38,
      recentKorean: 50,
      recentScience: 35,
      ling: 5.5, logi: 4.0, visu: 8.5, musi: 7.5, body: 8.0, intp: 5.0, intr: 6.5, natu: 5.5,
    },
  ]

  for (const s of STUDENTS) {
    await prisma.student.create({ data: s })
  }
  console.log(`✓ 가상 학생 ${STUDENTS.length}명 등록`)

  console.log("🌱 시드 완료!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

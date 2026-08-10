"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function OnboardPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: "",
    ageGroup: "ELEMENTARY_HIGH",
    grade: "",
    schoolName: "",
    region: "",
    recentMath: "",
    recentKorean: "",
    recentScience: "",
  })
  const [busy, setBusy] = useState(false)

  function update(k: string, v: string) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch("/api/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          ageGroup: form.ageGroup,
          schoolName: form.schoolName || undefined,
          region: form.region || undefined,
          grade: form.grade ? parseInt(form.grade) : undefined,
          recentMath: form.recentMath ? parseInt(form.recentMath) : undefined,
          recentKorean: form.recentKorean ? parseInt(form.recentKorean) : undefined,
          recentScience: form.recentScience ? parseInt(form.recentScience) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert("입력 오류: " + JSON.stringify(data.issues ?? data.error))
        return
      }
      router.push(`/diagnose?studentId=${data.student.id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">진단 시작 전 — 학생 정보</h1>
      <p className="text-[#9ba3c7] mb-8">시험 점수는 *입력하면* 이중특수성(2e) 발굴 정확도가 올라갑니다. 비워둬도 됩니다.</p>

      <form onSubmit={submit} className="space-y-6">
        <div className="card space-y-4">
          <div>
            <label className="block text-sm mb-1">이름 *</label>
            <input
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[#0a0e1a] border border-[#1f2547]"
              placeholder="예: 지원이"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">연령대 *</label>
            <select
              value={form.ageGroup}
              onChange={(e) => update("ageGroup", e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[#0a0e1a] border border-[#1f2547]"
            >
              <option value="ELEMENTARY_LOW">초등 저학년 (1~3학년)</option>
              <option value="ELEMENTARY_HIGH">초등 고학년 (4~6학년)</option>
              <option value="MIDDLE_SCHOOL">중학생</option>
              <option value="HIGH_SCHOOL">고등학생</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">학년</label>
              <input
                type="number"
                min={1}
                max={12}
                value={form.grade}
                onChange={(e) => update("grade", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[#0a0e1a] border border-[#1f2547]"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">지역</label>
              <input
                value={form.region}
                onChange={(e) => update("region", e.target.value)}
                placeholder="예: 서울특별시"
                className="w-full px-4 py-2 rounded-lg bg-[#0a0e1a] border border-[#1f2547]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">학교명</label>
            <input
              value={form.schoolName}
              onChange={(e) => update("schoolName", e.target.value)}
              placeholder="예: 별빛초등학교"
              className="w-full px-4 py-2 rounded-lg bg-[#0a0e1a] border border-[#1f2547]"
            />
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold">최근 학교 시험 점수 (선택, 100점 만점)</h3>
          <p className="text-xs text-[#9ba3c7]">
            점수가 낮은 영역이 있어도 괜찮아요. 우리는 강점을 찾는 게 목표예요.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-1">수학</label>
              <input
                type="number" min={0} max={100}
                value={form.recentMath}
                onChange={(e) => update("recentMath", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[#0a0e1a] border border-[#1f2547]"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">국어</label>
              <input
                type="number" min={0} max={100}
                value={form.recentKorean}
                onChange={(e) => update("recentKorean", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[#0a0e1a] border border-[#1f2547]"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">과학</label>
              <input
                type="number" min={0} max={100}
                value={form.recentScience}
                onChange={(e) => update("recentScience", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[#0a0e1a] border border-[#1f2547]"
              />
            </div>
          </div>
        </div>

        <button type="submit" disabled={busy} className="btn btn-primary glow w-full">
          {busy ? "준비 중..." : "5분 진단으로 →"}
        </button>
      </form>
    </div>
  )
}

import { prisma } from "@/lib/prisma"
import { INTELLIGENCES, type Intelligence } from "@/lib/strength-matrix"
import { intelligencesToOECD, intelligencesToHolland, OECD_SKILL_LABELS, HOLLAND_LABELS, type HollandCode, type OECDSkill, withUncertainty } from "@/lib/oecd-mapping"
import { findNearestClinic } from "@/lib/clinic-match"
import { mockPopularBooks } from "@/lib/data4library"

type Params = Promise<{ id: string }>

export default async function ResultPage({ params }: { params: Params }) {
  const { id } = await params
  const diag = await prisma.diagnosis.findUnique({
    where: { id },
    include: { student: true },
  })
  if (!diag) {
    return <p className="text-[#9ba3c7]">결과를 찾을 수 없습니다.</p>
  }
  const student = diag.student
  const scores = JSON.parse(diag.scores) as Record<Intelligence, number>
  const topStrengths = JSON.parse(diag.topStrengths) as Intelligence[]
  const oecd = intelligencesToOECD(scores)
  const holland = intelligencesToHolland(scores)
  const topHolland = (Object.entries(holland) as [HollandCode, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  const topOECD = (Object.entries(oecd) as [OECDSkill, number][]).sort((a, b) => b[1] - a[1])

  const clinic = findNearestClinic(student.region)
  const recommendedBooks = mockPopularBooks(student.ageGroup).slice(0, 5)

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <p className="text-xs text-[#8b9aff] uppercase tracking-widest">교사용 학생 카드</p>
        <h1 className="text-3xl font-bold mt-2">
          <span className="star text-[#ffd97a]">✦</span> {student.name}
        </h1>
        <p className="text-sm text-[#9ba3c7] mt-1">
          {student.ageGroup === "ELEMENTARY_LOW" && "초등 저학년"}
          {student.ageGroup === "ELEMENTARY_HIGH" && "초등 고학년"}
          {student.ageGroup === "MIDDLE_SCHOOL" && "중학생"}
          {student.ageGroup === "HIGH_SCHOOL" && "고등학생"}
          {student.schoolName ? ` · ${student.schoolName}` : ""}
          {student.region ? ` · ${student.region}` : ""}
        </p>
      </div>

      {/* 면책 */}
      <div className="card border-l-4 border-[#ffd97a] bg-[#1a1505]">
        <p className="text-sm text-[#ffd97a] font-medium mb-1">⚠ 5분 탐색 결과 — 진단 아님</p>
        <p className="text-xs text-[#c8cfe8] leading-relaxed">
          이 카드는 4개 게임의 답변·반응 시간을 종합한 *탐색적 신호*입니다. 표준화된 심리검사가 아니며,
          영재성/학습장애 판정의 근거가 될 수 없습니다. 모든 점수는 ±1.5점 신뢰구간을 가집니다.
          최종 의사결정은 교사·전문가 검토 후 표준화된 절차를 따릅니다.
        </p>
      </div>

      {/* 종합 메시지 */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-3">학생용 메시지</h2>
        <p className="text-[#c8cfe8] leading-relaxed whitespace-pre-wrap">{diag.summary}</p>
      </div>

      {/* OECD 21세기 스킬 (최상위 표면) */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">OECD 21세기 핵심역량</h2>
        <p className="text-xs text-[#9ba3c7] mb-4">학생의 게임 결과에서 가장 강하게 보인 OECD Learning Compass 2030 영역</p>
        <div className="space-y-3">
          {topOECD.map(([code, score]) => {
            const u = withUncertainty(score)
            return (
              <div key={code}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{OECD_SKILL_LABELS[code]}</span>
                  <span className="text-[#9ba3c7] font-mono">{u.score.toFixed(1)} <span className="text-xs">({u.low.toFixed(1)}~{u.high.toFixed(1)})</span></span>
                </div>
                <div className="h-2 bg-[#1f2547] rounded">
                  <div
                    className="h-2 bg-gradient-to-r from-[#8b9aff] to-[#c8d3ff] rounded"
                    style={{ width: `${Math.min(100, (score / 10) * 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Holland 흥미 코드 */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">Holland 흥미 영역 TOP 3</h2>
        <p className="text-xs text-[#9ba3c7] mb-4">학생이 어떤 활동에 끌리는지 — 진로 탐색의 출발점</p>
        <ul className="space-y-2">
          {topHolland.map(([code, score]) => (
            <li key={code} className="flex justify-between p-3 rounded bg-[#0a0e1a]">
              <span>{HOLLAND_LABELS[code]}</span>
              <span className="font-mono text-[#ffd97a]">{score.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 가드너 8지능 (내부 분석 — 작게) */}
      <details className="card">
        <summary className="cursor-pointer font-semibold">상세: 가드너 8지능 신호 (내부 분석 프레임)</summary>
        <p className="text-xs text-[#9ba3c7] mt-3 mb-4">
          가드너 다중지능은 *분석 프레임*이며 학술적 진단 도구로서의 한계가 있습니다 (Visser et al. 2006 등).
          본 시스템은 가드너를 내부 표상으로만 사용하고, 학생/학부모 노출은 OECD·Holland로 표시합니다.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(Object.entries(scores) as [Intelligence, number][]).map(([code, score]) => {
            const meta = INTELLIGENCES[code]
            const isTop = topStrengths.includes(code)
            return (
              <div key={code} className={`p-3 rounded ${isTop ? "bg-[#1a2046] border border-[#8b9aff]" : "bg-[#0a0e1a]"}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">{meta.emoji} {meta.name}</span>
                  <span className="font-mono text-xs">{score.toFixed(1)}</span>
                </div>
                <div className="h-1 bg-[#1f2547] rounded">
                  <div
                    className={`h-1 rounded ${isTop ? "bg-[#ffd97a]" : "bg-[#8b9aff]"}`}
                    style={{ width: `${(score / 10) * 100}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </details>

      {/* 후속 조치 */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-3">교사 후속 조치 권장</h2>
        <div className="space-y-3">
          {diag.giftedReferral && (
            <div className="p-4 rounded bg-[#1a1505] border border-[#ffd97a]">
              <p className="text-sm font-medium text-[#ffd97a]">🌟 영재 추가 관찰 후보</p>
              <p className="text-xs text-[#c8cfe8] mt-2 leading-relaxed">
                학교 시험 점수와 강점 신호 사이의 비대칭이 큽니다. 일반 학업 평가에서는 보이지 않는 영역의 잠재력이 있을 수 있습니다.
                <strong className="block mt-2">교사 검토 후</strong> 영재교육원 1차 상담 또는 추가 관찰을 권장합니다.
                AI는 의뢰서 초안만 제공하며, 의뢰 결정은 교사가 합니다.
              </p>
            </div>
          )}
          {diag.clinicReferral && (
            <div className="p-4 rounded bg-[#0d1a1a] border border-[#5b9b9e]">
              <p className="text-sm font-medium text-[#9bd6d9]">📚 학습종합클리닉 1차 상담 권장</p>
              <p className="text-xs text-[#c8cfe8] mt-2 leading-relaxed">
                전 영역 신호가 낮습니다. 일시적 컨디션·정서 이슈 가능성을 배제하기 위해 1회 정밀 진단을 권장합니다.
              </p>
              {clinic && (
                <p className="text-xs text-[#9ba3c7] mt-3">
                  가장 가까운 센터: <strong>{clinic.name}</strong> ({clinic.region} {clinic.city})
                  {clinic.phone ? ` · ${clinic.phone}` : ""}
                </p>
              )}
            </div>
          )}
          {!diag.giftedReferral && !diag.clinicReferral && (
            <div className="p-4 rounded bg-[#0d1a14] border border-[#5b9e6f]">
              <p className="text-sm font-medium text-[#9bd9ad]">✓ 일반 보강 추천</p>
              <p className="text-xs text-[#c8cfe8] mt-2 leading-relaxed">
                특별한 의뢰 트리거에 해당하지 않습니다. 강점 영역 활동을 가정·학교에서 5개 시도해보세요.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-3 flex-wrap">
          <a
            href={`/api/report/parent`}
            onClick={(e) => {
              e.preventDefault()
              fetch("/api/report/parent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentId: student.id, diagnosisId: diag.id }),
              })
                .then((r) => r.blob())
                .then((blob) => {
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `${student.name}-strength-report.docx`
                  a.click()
                })
            }}
            className="btn btn-primary"
          >
            📄 학부모 리포트 DOCX 다운로드
          </a>
          {diag.giftedReferral && (
            <a
              href={`/api/report/gifted`}
              onClick={(e) => {
                e.preventDefault()
                fetch("/api/report/gifted", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ studentId: student.id, diagnosisId: diag.id }),
                })
                  .then((r) => r.blob())
                  .then((blob) => {
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `${student.name}-gifted-referral.docx`
                    a.click()
                  })
              }}
              className="btn btn-ghost"
            >
              🌟 영재 추가 관찰 의뢰서 (교사 검토용)
            </a>
          )}
        </div>
      </div>

      {/* 추천 도서 */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">강점·흥미 매칭 도서</h2>
        <p className="text-xs text-[#9ba3c7] mb-4">도서관정보나루 또래 인기대출 + 사서추천 기반</p>
        <ul className="space-y-2">
          {recommendedBooks.map((b) => (
            <li key={b.isbn13} className="flex justify-between p-3 rounded bg-[#0a0e1a]">
              <div>
                <p className="font-medium">{b.bookname}</p>
                <p className="text-xs text-[#9ba3c7]">{b.authors} · {b.publisher}</p>
              </div>
              <span className="text-xs text-[#6b7280] font-mono">대출 {b.loanCount.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-center pt-4">
        <a href="/" className="text-sm text-[#9ba3c7] underline">홈으로</a>
      </div>
    </div>
  )
}

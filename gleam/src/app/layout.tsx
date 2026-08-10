import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "별의아이들 (Gleam) — 부진의 가면 뒤 강점을 발견하는 AI",
  description: "제8회 교육공공데이터 AI활용대회 출품작. 가드너 8지능 × 학교 시험 데이터 결합으로 이중특수성(2e) 영재를 자동 발굴합니다.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-[#1f2547]">
            <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2 text-lg font-semibold">
                <span className="star text-[#ffd97a]">✦</span>
                별의아이들
              </a>
              <nav className="text-sm text-[#9ba3c7] flex gap-6">
                <a href="/" className="hover:text-white">소개</a>
                <a href="/onboard" className="hover:text-white">진단 시작</a>
                <a href="/about" className="hover:text-white">컨셉</a>
              </nav>
            </div>
          </header>
          <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
          <footer className="max-w-5xl mx-auto px-6 py-10 text-xs text-[#6b7280] border-t border-[#1f2547] mt-20">
            제8회 교육공공데이터 AI활용대회 출품작 · 별의아이들 (Gleam) · 2026 · 데이터 출처: 도서관정보나루, NEIS, 학교알리미, 학교도서관진흥법 KLISS
          </footer>
        </div>
      </body>
    </html>
  )
}

// 도서관정보나루 (data4library.kr) 클라이언트
// 인증키 즉시 발급, 30,000회/일(서버 IP 등록 시).
// 핵심 엔드포인트: loanItemSrch (인기대출도서), usageAnalysisList (ISBN 또래 분석)

const BASE = "http://data4library.kr/api"

function getKey(): string | null {
  return process.env.DATA4LIBRARY_KEY || null
}

export type PopularBook = {
  ranking: number
  bookname: string
  authors: string
  publisher: string
  isbn13: string
  classNo: string  // KDC
  bookImageURL?: string
  loanCount: number
}

// 인기대출도서 — 성별·연령·지역 필터 지원
export async function fetchPopularBooks(opts: {
  startDt: string  // YYYY-MM-DD
  endDt: string
  gender?: 0 | 1 | 2  // 0: 전체, 1: 남, 2: 여
  fromAge?: number
  toAge?: number
  region?: number    // 지역코드 (11=서울 등)
  pageSize?: number
}): Promise<PopularBook[]> {
  const key = getKey()
  if (!key) {
    console.warn("[data4library] DATA4LIBRARY_KEY not set — returning empty list")
    return []
  }
  const params = new URLSearchParams({
    authKey: key,
    startDt: opts.startDt,
    endDt: opts.endDt,
    pageSize: String(opts.pageSize ?? 20),
    format: "json",
  })
  if (opts.gender !== undefined) params.set("gender", String(opts.gender))
  if (opts.fromAge !== undefined) params.set("from_age", String(opts.fromAge))
  if (opts.toAge !== undefined) params.set("to_age", String(opts.toAge))
  if (opts.region !== undefined) params.set("region", String(opts.region))

  try {
    const res = await fetch(`${BASE}/loanItemSrch?${params}`, { cache: "no-store" })
    if (!res.ok) return []
    const data = await res.json()
    const docs = data?.response?.docs ?? []
    return docs.map((d: { doc: Record<string, unknown> }) => {
      const b = d.doc
      return {
        ranking: Number(b.ranking) || 0,
        bookname: String(b.bookname ?? ""),
        authors: String(b.authors ?? ""),
        publisher: String(b.publisher ?? ""),
        isbn13: String(b.isbn13 ?? ""),
        classNo: String(b.class_no ?? ""),
        bookImageURL: b.bookImageURL ? String(b.bookImageURL) : undefined,
        loanCount: Number(b.loan_count) || 0,
      }
    })
  } catch (e) {
    console.error("[data4library] fetchPopularBooks failed:", e)
    return []
  }
}

// ISBN으로 또래 분석 — 어느 연령대가 많이 빌렸는지
export type LoanAnalysis = {
  isbn13: string
  loanGrps: { name: string; ratio: number }[]   // 연령대별 비율
  genderResult: { name: string; ratio: number }[]
  recBooks: { bookname: string; isbn13: string; classNo: string }[]
}

export async function fetchUsageAnalysis(isbn13: string): Promise<LoanAnalysis | null> {
  const key = getKey()
  if (!key) return null
  const params = new URLSearchParams({ authKey: key, isbn13, format: "json" })
  try {
    const res = await fetch(`${BASE}/usageAnalysisList?${params}`, { cache: "no-store" })
    if (!res.ok) return null
    const data = await res.json()
    const r = data?.response
    if (!r) return null
    return {
      isbn13,
      loanGrps: r.loanGrps?.loanGrp?.map((g: Record<string, unknown>) => ({
        name: String(g.name ?? ""),
        ratio: Number(g.ratio) || 0,
      })) ?? [],
      genderResult: r.genderResult?.gender?.map((g: Record<string, unknown>) => ({
        name: String(g.name ?? ""),
        ratio: Number(g.ratio) || 0,
      })) ?? [],
      recBooks: r.recBooks?.book?.map((b: Record<string, unknown>) => ({
        bookname: String(b.bookname ?? ""),
        isbn13: String(b.isbn13 ?? ""),
        classNo: String(b.classNo ?? ""),
      })) ?? [],
    }
  } catch (e) {
    console.error("[data4library] fetchUsageAnalysis failed:", e)
    return null
  }
}

// 모의 데이터 (인증키 없을 때 데모 동작)
export function mockPopularBooks(ageGroup: string): PopularBook[] {
  const map: Record<string, PopularBook[]> = {
    ELEMENTARY_HIGH: [
      { ranking: 1, bookname: "푸른 사자 와니니", authors: "이현", publisher: "창비", isbn13: "9788936443511", classNo: "813", loanCount: 8421 },
      { ranking: 2, bookname: "건방진 도도군", authors: "김기정", publisher: "비룡소", isbn13: "9788949121123", classNo: "813", loanCount: 7218 },
      { ranking: 3, bookname: "수상한 우리 반 친구들", authors: "박현숙", publisher: "주니어김영사", isbn13: "9791156833253", classNo: "813", loanCount: 6905 },
      { ranking: 4, bookname: "명화 살리기", authors: "프란체스카 가스파리니", publisher: "톡", isbn13: "9788955823141", classNo: "650", loanCount: 5012 },
      { ranking: 5, bookname: "별 헤는 밤(어린이판)", authors: "윤동주", publisher: "보물섬", isbn13: "9788988717059", classNo: "811", loanCount: 4823 },
    ],
    MIDDLE_SCHOOL: [
      { ranking: 1, bookname: "달러구트 꿈 백화점", authors: "이미예", publisher: "팩토리나인", isbn13: "9791165341909", classNo: "813", loanCount: 12041 },
      { ranking: 2, bookname: "불편한 편의점", authors: "김호연", publisher: "나무옆의자", isbn13: "9791161571331", classNo: "813", loanCount: 10532 },
      { ranking: 3, bookname: "아몬드", authors: "손원평", publisher: "창비", isbn13: "9788936434267", classNo: "813", loanCount: 9847 },
    ],
    HIGH_SCHOOL: [
      { ranking: 1, bookname: "1984", authors: "조지 오웰", publisher: "민음사", isbn13: "9788937460777", classNo: "843", loanCount: 4521 },
      { ranking: 2, bookname: "데미안", authors: "헤르만 헤세", publisher: "민음사", isbn13: "9788937460449", classNo: "853", loanCount: 4203 },
    ],
  }
  return map[ageGroup] ?? map.ELEMENTARY_HIGH
}

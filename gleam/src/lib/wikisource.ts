// 위키문헌 한국어 — 저작권 만료 한국 근대문학 본문 가져오기
// MediaWiki API 무료, 인증 불필요. CC BY-SA 3.0 (PD 본문은 PD).

const API = "https://ko.wikisource.org/w/api.php"

export type WikisourceWork = {
  title: string
  pageId: number
  url: string
  extractText?: string
}

const PD_AUTHORS = [
  { name: "이상", deathYear: 1937 },
  { name: "김유정", deathYear: 1937 },
  { name: "현진건", deathYear: 1943 },
  { name: "나도향", deathYear: 1926 },
  { name: "윤동주", deathYear: 1945 },
  { name: "심훈", deathYear: 1936 },
  { name: "채만식", deathYear: 1950 },
  { name: "이효석", deathYear: 1942 },
  { name: "김소월", deathYear: 1934 },
  { name: "이상화", deathYear: 1943 },
  { name: "한용운", deathYear: 1944 },
]

export function getPDAuthors() {
  return PD_AUTHORS
}

export async function fetchAuthorWorks(authorName: string, limit = 30): Promise<WikisourceWork[]> {
  // 위키문헌 저자 페이지에서 작품 링크 수집 (간단 구현 — title 검색)
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: authorName,
    srlimit: String(limit),
    format: "json",
    origin: "*",
  })
  try {
    const res = await fetch(`${API}?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    const hits = data?.query?.search ?? []
    return hits.map((h: { title: string; pageid: number }) => ({
      title: h.title,
      pageId: h.pageid,
      url: `https://ko.wikisource.org/wiki/${encodeURIComponent(h.title)}`,
    }))
  } catch {
    return []
  }
}

export async function fetchPageText(pageId: number): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    pageids: String(pageId),
    prop: "extracts",
    explaintext: "1",
    format: "json",
    origin: "*",
  })
  try {
    const res = await fetch(`${API}?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    const page = data?.query?.pages?.[pageId]
    return page?.extract ?? null
  } catch {
    return null
  }
}

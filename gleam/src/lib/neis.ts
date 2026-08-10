// NEIS 교육정보 개방 (open.neis.go.kr) 클라이언트
// 학교 메타·학사일정·시간표 등. 인증키 즉시 무료 발급.

const BASE = "https://open.neis.go.kr/hub"

function getKey(): string | null {
  return process.env.NEIS_KEY || null
}

export type SchoolInfo = {
  schoolCode: string  // SD_SCHUL_CODE
  name: string
  type: string        // SCHUL_KND_SC_NM (초등학교/중학교/고등학교)
  region: string      // ATPT_OFCDC_SC_NM
  address: string
  phone: string
  homepage: string
  foundDate: string
}

export async function searchSchool(name: string): Promise<SchoolInfo[]> {
  const key = getKey()
  const params = new URLSearchParams({
    Type: "json",
    pIndex: "1",
    pSize: "10",
    SCHUL_NM: name,
  })
  if (key) params.set("KEY", key)

  try {
    const res = await fetch(`${BASE}/schoolInfo?${params}`, { cache: "no-store" })
    if (!res.ok) return []
    const data = await res.json()
    const rows: Record<string, unknown>[] = data?.schoolInfo?.[1]?.row ?? []
    return rows.map((r) => ({
      schoolCode: String(r.SD_SCHUL_CODE ?? ""),
      name: String(r.SCHUL_NM ?? ""),
      type: String(r.SCHUL_KND_SC_NM ?? ""),
      region: String(r.ATPT_OFCDC_SC_NM ?? ""),
      address: String(r.ORG_RDNMA ?? ""),
      phone: String(r.ORG_TELNO ?? ""),
      homepage: String(r.HMPG_ADRES ?? ""),
      foundDate: String(r.FOND_YMD ?? ""),
    }))
  } catch (e) {
    console.error("[neis] searchSchool failed:", e)
    return []
  }
}

// 모의 데이터 (인증키 없을 때)
export function mockSchool(name: string): SchoolInfo {
  return {
    schoolCode: "9296135",
    name: name || "별빛초등학교",
    type: "초등학교",
    region: "서울특별시교육청",
    address: "서울특별시 종로구 율곡로 12",
    phone: "02-000-0000",
    homepage: "http://example.es.kr",
    foundDate: "19560301",
  }
}

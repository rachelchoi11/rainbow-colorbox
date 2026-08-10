// 학습종합클리닉센터 매칭 — 시도교육청별 분포 (대표 샘플 시드)
// 실제 출시 시 공공데이터포털 + 시도교육청 행정정보로 자동 갱신.

export type ClinicCenter = {
  region: string
  city: string
  name: string
  phone?: string
  address?: string
  domains?: string[]
}

export const CLINIC_SEED: ClinicCenter[] = [
  // 서울
  { region: "서울특별시", city: "강남구", name: "서울 학습종합클리닉센터 강남센터", phone: "02-3017-7900", domains: ["기초학력", "학습부진"] },
  { region: "서울특별시", city: "노원구", name: "서울 학습종합클리닉센터 동북센터", phone: "02-944-4471", domains: ["기초학력", "ADHD"] },
  { region: "서울특별시", city: "양천구", name: "서울 학습종합클리닉센터 서남센터", phone: "02-2061-5550", domains: ["기초학력", "느린학습자"] },
  // 경기
  { region: "경기도", city: "수원시", name: "경기도 학습종합클리닉센터", phone: "031-820-0700", domains: ["기초학력"] },
  { region: "경기도", city: "성남시", name: "성남 위(Wee)센터", phone: "031-780-2535", domains: ["정서", "학습부진"] },
  // 부산
  { region: "부산광역시", city: "동래구", name: "부산광역시 학습종합클리닉센터", phone: "051-505-7943", domains: ["기초학력", "느린학습자"] },
  // 대구
  { region: "대구광역시", city: "수성구", name: "대구광역시 학습종합클리닉센터", phone: "053-231-0073" },
  // 인천
  { region: "인천광역시", city: "남동구", name: "인천광역시 학습종합클리닉센터", phone: "032-460-6300" },
  // 광주
  { region: "광주광역시", city: "북구", name: "광주광역시 학습종합클리닉센터", phone: "062-380-4517" },
  // 대전
  { region: "대전광역시", city: "서구", name: "대전광역시 학습종합클리닉센터", phone: "042-480-7799" },
  // 울산
  { region: "울산광역시", city: "남구", name: "울산광역시 학습종합클리닉센터", phone: "052-210-5470" },
  // 세종
  { region: "세종특별자치시", city: "세종시", name: "세종특별자치시 학습종합클리닉센터", phone: "044-320-2700" },
  // 강원
  { region: "강원특별자치도", city: "춘천시", name: "강원도 학습종합클리닉센터", phone: "033-258-5455" },
  // 충북
  { region: "충청북도", city: "청주시", name: "충청북도 학습종합클리닉센터", phone: "043-290-2154" },
  // 충남
  { region: "충청남도", city: "천안시", name: "충청남도 학습종합클리닉센터", phone: "041-640-7330" },
  // 전북
  { region: "전북특별자치도", city: "전주시", name: "전북도 학습종합클리닉센터", phone: "063-239-3170" },
  // 전남
  { region: "전라남도", city: "무안군", name: "전라남도 학습종합클리닉센터", phone: "061-260-0429" },
  // 경북
  { region: "경상북도", city: "안동시", name: "경상북도 학습종합클리닉센터", phone: "054-805-3242" },
  // 경남
  { region: "경상남도", city: "창원시", name: "경상남도 학습종합클리닉센터", phone: "055-268-1149" },
  // 제주
  { region: "제주특별자치도", city: "제주시", name: "제주특별자치도 학습종합클리닉센터", phone: "064-710-0760" },
]

export function findNearestClinic(region?: string | null): ClinicCenter | null {
  if (!region) return CLINIC_SEED[0]
  // 첫 매칭만으로 단순화. 실제로는 거리 기반 매칭 필요.
  const direct = CLINIC_SEED.find((c) => c.region.includes(region) || region.includes(c.region.replace("특별시", "").replace("광역시", "").replace("특별자치도", "")))
  return direct ?? CLINIC_SEED[0]
}

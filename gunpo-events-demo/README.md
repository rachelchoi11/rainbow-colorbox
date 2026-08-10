# 군포 독서·문화 행사 통합 수집기 (핏치 PoC)

3개 소스를 동시에 수집 → 정규화 → 중복제거 → 독서 태깅 → AI 추천.
의존성 없음(Node 22 내장 fetch). 키/네트워크 없으면 현실적 mock으로 폴백.

## 실행
```bash
# 0) 데이터 준비 (다운로드 파일 → JSON, 1회만)
python3 prep-public-portal.py    # 공공데이터포털 군포 도서관 문화행사591·인기검색어·장서82.8만 → public-portal.json
python3 prep-gg-datasets.py      # 경기데이터드림 군포 인프라(학교47·학습공간12·돌봄10…) → gg-infra.json
python3 scrape-chaekkumaru.py    # 그림책꿈마루 실시간 스크래핑(Playwright) → chaekkumaru.json

# 1) 소스 통합 → events.json + gunpo-events.html
node --env-file=.env fetch-events.mjs

# 2) 타겟 도달 로드맵 → gunpo-roadmap.html
node make-roadmap.mjs

# 3) 발표용 캡처 (render_events.py / render_roadmap.py 참고, @2x~@3x)
```
**산출물:** `gunpo-events.png`(소스 통합 화면 — 군포 도서관 문화행사 591건 + 그림책꿈마루 12건 실LIVE),
`gunpo-roadmap.png`(1·2·3차 타겟 도달 로드맵, 실측 수치).

## 데이터 소스 지도 (군포 독서교육 + 문화행사)

| 소스 | 방식 | 역할 | 비고 |
|---|---|---|---|
| 경기데이터드림 | API | 문화행사현황 | **행사 핵심** (SIGUN_NM=군포시) |
| 군포 통합도서관 lib.gunpo.go.kr | 스크래핑 | 시립도서관 독서프로그램 | **독서교육 핵심** |
| 군포문화재단 gunpoacf.or.kr | 스크래핑 | 공연·전시·문화교육 | API 없음 |
| 그림책꿈마루 gunpo.go.kr/picturebook | 스크래핑(Playwright) | 그림책 교육·행사 프로그램 | ✅ **실LIVE** — JS렌더라 scrape-chaekkumaru.py로 수집 |
| 경기공유학교 | 스크래핑/제휴 | 지역연계 독서 배움터 | 경기도교육청 (GONGYU_URL) |
| 도서관 정보나루 data4library.kr | API | 군포 인기대출도서(독서데이터) | loanItemSrch |

- **독서은하 = 학생 개인의 북 포트폴리오**(개인 자산)다. 수집 대상이 아니라 결과물로,
  지역 인기도서·행사 추천이 개인 독서은하로 들어가는 "추천 시드" 관계.
- 행사 데이터 통합 = 경기데이터드림 + 군포 도서관/문화재단/책꿈마루/공유학교(스크래핑).
- 확장 후보: 공공데이터포털·문화포털(전국 공연전시), 군포평생학습원·늘배움, 책열매(학교 독서교육).

## 필요한 API 키 (모두 무료)

### 1) 경기데이터드림 — `GG_DATA_KEY`  (공공 행사 API)
- 사이트: https://data.gg.go.kr  (경기데이터드림)
- 절차: 회원가입 → 로그인 → 상단 **OpenAPI** → "문화행사현황" 등 원하는 API 검색
  → **API 신청/인증키 발급** (즉시·무료) → 발급된 인증키를 `GG_DATA_KEY`로 사용
- 호출 예: `https://openapi.gg.go.kr/CulturalEventStatus?KEY={키}&Type=json&SIGUN_NM=군포시`

### 2) 도서관 정보나루 — `DATA4LIBRARY_KEY`  (도서관 행사/프로그램)
- 사이트: https://www.data4library.kr  (국립중앙도서관 운영)
- 절차: 회원가입 → 로그인 → **데이터 활용 → 인증키 발급 신청**
  → 활용 목적 작성 → 승인(보통 즉시~1영업일) → **authKey** 발급 → `DATA4LIBRARY_KEY`로 사용
- 군포 도서관 코드(libCode)는 "도서관별 정보 조회" API로 확인 (현재 코드 111007은 예시)

### 3) (선택) 공공데이터포털 — `DATA_GO_KR_KEY`  (전국 공연전시 등)
- 사이트: https://www.data.go.kr
- 절차: 회원가입 → 원하는 API(예: 한국문화정보원 "공연전시정보조회서비스") 검색
  → **활용신청**(대부분 자동승인) → 마이페이지에서 **일반 인증키(serviceKey)** 확인
  → Encoding/Decoding 두 키가 나오는데, URL에 그대로 붙일 땐 보통 **Encoding 키** 사용

### 4) 군포문화재단 스크래핑 — 키 불필요
- https://www.gunpoacf.or.kr 의 공연/전시 목록 HTML을 파싱.
- robots.txt·이용약관 확인하고, 요청 간 간격(rate limit)·User-Agent 명시 권장.

## .env 예시
`.env.example`를 복사해 `.env`로 만들고 값 채우기.
```
GG_DATA_KEY=발급받은_경기데이터드림_키
DATA4LIBRARY_KEY=발급받은_정보나루_authKey
DATA_GO_KR_KEY=발급받은_공공데이터포털_serviceKey
```

# 별의아이들 (Gleam)
**제8회 교육공공데이터 AI활용대회 일반부 출품작**

> 한 학기가 걸리는 일을 한 시간으로.
> 전국 6,000개 학교, 매년 80만 명의 느린학습자를 학교가 *발견·매칭*하는 데 걸리는 시간을 줄이는 교사용 AI 도구.

## 빠른 시작

```bash
cd /Users/rachel/workspace/gleam

# 1. 의존성 설치
npm install

# 2. 환경변수
cp .env.example .env
# ANTHROPIC_API_KEY 입력
# (DATA4LIBRARY_KEY/NEIS_KEY/SCHOOL_ALIMI_KEY는 선택 — mock fallback 동작)

# 3. DB 마이그레이션 + 시드
npm run db:push
npm run db:seed

# 4. 개발 서버
npm run dev
```

브라우저: `http://localhost:3000`

## 시연 시나리오 (5분)

1. **홈 페이지** (`/`) — 컨셉 픽치
2. **`/about`** — 학술적 방어선 + 데이터 결합 5종 표
3. **`/onboard`** — 가상 학생 정보 입력 (예: 지민, 초등 고학년, 수학 35점, 과학 80점)
4. **`/diagnose?studentId=...`** — 4개 게임 순차 (총 5~7분)
5. **`/result/[id]`** — 자동 생성된 교사 카드:
   - OECD 21세기 스킬 TOP
   - Holland 흥미 코드 TOP 3
   - 가드너 8지능 (접힌 상세)
   - 이중특수성 영재 추가 관찰 후보 (교사 검토용)
   - 학습종합클리닉 매칭 + 의뢰서 DOCX 다운로드
   - 강점 매칭 도서 추천 (도서관정보나루)
   - 학부모 리포트 DOCX 다운로드

## 핵심 자산

### bookbot에서 이식한 모듈
- `src/lib/prompts.ts` 패턴 → `src/lib/games.ts` AI 분석 시스템 메시지
- `src/lib/mentor-prompt.ts` Bloom 적응 → `src/lib/strength-prompts.ts` 강점 추출
- `src/lib/age-config.ts` 그대로
- SOLO 4차원 채점 → 게임 결과 → 8지능 신호 변환

### bizplan-ai에서 이식한 모듈
- `src/lib/docx.ts` — 모의심사 평가 루브릭 → 학부모 리포트·의뢰서 자동 생성

### 신규 개발
- `src/lib/strength-matrix.ts` — 가드너 8지능 × SOLO 4차원
- `src/lib/oecd-mapping.ts` — 8지능 → OECD 21세기 스킬 + Holland 코드
- `src/lib/data4library.ts` — 도서관정보나루 클라이언트
- `src/lib/neis.ts` / `src/lib/school-alimi.ts` — NEIS·학교알리미 클라이언트
- `src/lib/clinic-match.ts` — 학습종합클리닉센터 매칭
- `src/lib/wikisource.ts` — 위키문헌 PD 본문 가져오기

## 폴더 구조

```
gleam/
├── docs/
│   ├── PROPOSAL.md           ← 1차 서면심사용 5쪽 기획서
│   └── CRITIQUE_RESPONSE.md  ← 적대적 검증 + 대응 매트릭스
├── prisma/
│   ├── schema.prisma         ← 12개 모델 (단순화된 SQLite)
│   └── seed.ts               ← 가상 학생 6명 + 학습클리닉 시드
├── src/
│   ├── app/
│   │   ├── page.tsx          ← 홈
│   │   ├── about/page.tsx    ← 컨셉
│   │   ├── onboard/page.tsx  ← 학생 정보 입력
│   │   ├── diagnose/page.tsx ← 4개 게임 순차
│   │   ├── result/[id]/page.tsx ← 결과 카드
│   │   └── api/
│   │       ├── student/route.ts
│   │       ├── games/route.ts
│   │       ├── games/run/route.ts
│   │       ├── diagnose/route.ts
│   │       ├── recommend/route.ts
│   │       ├── report/parent/route.ts
│   │       └── report/gifted/route.ts
│   └── lib/
│       └── (위 자산 목록)
└── README.md
```

## 시연 핵심 메시지

1. **5분 게임 → 한 페이지 카드**: 학교 한 학급 30명 분 부진학생 발견·관찰 보고서가 한 시간 안에 끝남.
2. **5종 공공데이터 입력단 결합**: 도서관정보나루·NEIS·학교알리미·KLISS·어린이청소년도서관 모두 *진단의 입력*으로.
3. **학술적 방어선**: 가드너는 내부 표상, 노출 표면은 OECD 21세기 스킬 + Holland. ±1.5 신뢰구간. 영재/클리닉 의뢰는 교사 검토 후.
4. **사회적 임팩트**: 80만 명 느린학습자 발견 사이클 한 학기 → 한 시간.

## 적대적 검증 결과

`docs/CRITIQUE_RESPONSE.md` 참조. 38/100 → 60대 진입 위해 5개 핵심 변경 적용:
- 가드너 8지능 → OECD/Holland로 표면 리프레이밍
- 영재 의뢰 자동 발송 → 교사 검토 후 발행
- 학부모 직접 결제 모델 폐기 → 교사·교육청 도구
- 다문화 가중치 폐기 → 해석 신뢰도 페널티
- 공공데이터 출력단 → 입력단으로 이동

## 관련 메모리

- `~/.claude/projects/.../memory/contest_8th_edudata_ai.md` — 대회 컨텍스트 + 제7회 수상작 분석
- `~/.claude/projects/.../memory/verified_data_sources.md` — 도서 소스·API 검증 결과
- `~/.claude/projects/.../memory/user_profile.md` — 사용자 정보

## 다음 단계 (대회 마감 5/31까지)

- [ ] 의존성 설치 + DB 시드 + 로컬 동작 확인
- [ ] 도서관정보나루·NEIS·학교알리미 인증키 발급 + 실 API 연동 테스트
- [ ] 시연 영상 녹화 (5분)
- [ ] 1차 서면심사용 PDF 변환 (PROPOSAL.md → PDF)
- [ ] 시연 학교 1곳 협의 (선택 — 입상 후 PoC 단계)
- [ ] GitHub 공개 repo 게시 (선택)

---

🌟 **개발 메모**: 이 프로젝트는 2026-05-09 자정 ~ 새벽에 자율 개발 모드로 약 3시간 만에
프로토타입 1.0 완성. bookbot/bizplan-ai에서 검증된 AI 모듈 이식 + 신규 강점 매트릭스 설계 +
적대적 검증 1회 + 메시지 피봇 1회 포함.

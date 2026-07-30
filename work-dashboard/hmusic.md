# 현대음악 출판사 (유지보수)

> **트랙**: 엔시온 소속 | **역할**: 기획·PM
> **보수 변동**: 엔시온 계약 월 300만 구조. 기존엔 80만을 정윤재가 개발로 수령 → **6월 인수인계 → 7월부터 Rachel이 기획·PM 유지 + 그 80만원 수령, 개발은 회사로 이관**
> **경로**: `~/workspace/hdm` (실작업 레포 = `github.com/Violetdusk/hdm`, **PRIVATE**). 별도 `~/workspace/hmusic`(rachelchoi11/hmusic)은 옛 개인 백업 클론 — 인계 작업은 hdm에서.
> **현 단계**: 정윤재 → Rachel 인수인계 진행 중 (6월). **개발환경 세팅 + 개발서버 로컬 기동 검증 완료**, 인계 문서(`docs/handover-base.md`) 확보·정독 완료.
> 📖 **내 참고용 런북**: [hmusic-runbook.md](hmusic-runbook.md) — 제로→로컬 개발서버 실행 단계별(개념+명령어 전부). 노션 "인수인계 받기+세팅·숙지" 본문과 동일.

## 🎯 6월 목표
1. **인수인계 받기** (정윤재가 해주기로 함)
2. **필요한 세팅 + 업무 숙지**
3. **거래처 대표님 안심시키기** — 과거 이슈들이 있었음 ⚠️

## ✅ 완료한 일 (작업 로그)

### 2026-07-30 — 독자영역 검색·AI 노출 진단 리포트 v3 (모두플랜 브랜드)
- **산출물**: `~/workspace/hdm/docs/journal-seo-report-v3.{html,pdf}`(디자인 정본, 7p·모두플랜 브랜드) + `.md`(동기화본) + 커버레터 `docs/cover-letter-modooplan-ax-partner.md`.
- **구성**: ①요약(충족5/개선7/3축) → ②기술진단(12점검, 7개선 P0/P1) → ③**이미 완료(전→후 비교: 슬러그·301(1홉)·고유title·canonical·운영입력칸·65건 마이그레이션, 2026-07-17 운영 실측검증)** → ④권고 구축(CMS 자동출력·게시전 QA·발견경로) → ⑤AI검색(방향) → ⑥상시운영(모니터링) → ⑦로드맵 STEP1~4 + DoD.
- **톤 원칙**: 과장 제거(사이트맵·구조화데이터·AI인용 "보장 안 함"), 모두플랜=진단·모니터링 **파트너**(계약상 개발 주체 아님), §4 일반인용 평이표현+괄호 전문용어, 로드맵 기간 제거(순서만), 여백 넉넉히.
- **작성자**: 최혜윤 총괄디렉터 · choi@modooplan.kr · 010-5710-0708 (커버+사인오프).
- **근거**: hdm 실작업 `docs/journal-slug-seo-notes.md`(07-17 실측). 남은 P0(설명·OG·사이트맵·페이지네이션)+도서 상세 SEO는 강수아/개발 파트너 몫.
- **의미**: 대표님 발송 + 모두플랜 **AX 파트너 진입 포석**. GPT 작업본 개선안 반영해 재구축.

### 2026-06-18 — 원격접속 + 개발환경 세팅
- **Tailscale 테일넷 연결 완료** (`hdm.billing@gmail.com` 테일넷 = 출판사 서버망). macOS 네트워크 시스템확장이 "승인 대기(activated waiting for user)" 상태로 막혀 로그인이 계속 *"Unable to add a new user"* 로 실패하던 것 → **시스템설정 › 개인정보 보호 및 보안 › (맨 아래) 보안 › 시스템확장 허용** 후 해결. 재부팅이 아니라 *수동 승인*이 핵심이었음. (이 Mac tailnet IP `100.115.83.61`, 서버 `hmerp2-production`=100.86.123.77 / `hmerp2-test`=100.117.232.37 확인)
- **IntelliJ IDEA Ultimate 2026.1 설치** (Homebrew cask). 결제는 IDE가 아니라 jetbrains.com에서 **Organization(상업용) 라이선스**로 진행(업무용).
- **JDK 8 세팅** — 프로젝트가 Java 8 필수(Gradle 6.7.1은 JDK 20에서 빌드 깨짐). 최초 Zulu 8 수동설치 → 이후 인계 개발자 요청대로 **SDKMAN으로 Amazon Corretto 8(`8.0.472-amzn`) 관리**로 전환(Zulu 제거). Node v22.16.0/npm 기설치 확인.

### 2026-06-22 — 인계문서 확보 + 개발서버 기동 검증
- **main 최신화** — `git pull` (79커밋 반영, HEAD = `2d09177 update handover`).
- **인계 문서 `docs/handover-base.md` 정독** — 기술스택/인프라(Lightsail·Tailscale·systemd)/온보딩 런북/배포 절차/시크릿 인벤토리 전체 파악.
- **개발서버 로컬 기동 검증 성공** ✅ — `NS_HMERP_ENV=local VERTXWEB_ENVIRONMENT=dev ./gradlew run` → `💪Successfully Initialized!`, **ERP(9092)/독자웹(9091) 둘 다 HTTP 200**. PG/HBase/Redis 전부 tailnet 경유 연결 확인. (검증 후 서버는 정리·종료)
  - 기동 전제조건: `JAVA_HOME`=SDKMAN Corretto 경로, Tailscale ON, `/etc/hosts`에 `100.117.232.37 ht.vdsk.me hmerp2-test`.
- **`/etc/hosts` 복구** — `ht.vdsk.me` 항목이 기존에 잘못 들어가 있던 `export TAVILY_API_KEY=...` 줄 끝에 붙어 깨진 것 정리 + 월드리더블 파일의 키 노출 제거.
- **레포 비공개 확인** — `Violetdusk/hdm` = **PRIVATE** 확인. (시크릿 평문 다수라 public 전환 절대 금지)

## ⏳ 진행 중 / 다음 액션
- [x] Tailscale 가입(2026-06-13) → **테일넷(hdm.billing) 합류·서버 접속**(2026-06-18) ✅
- [x] 개발환경 세팅 — IntelliJ Ultimate + Corretto 8(SDKMAN) + Node (2026-06-18)
- [x] 개발서버 로컬 기동 검증 (2026-06-22)
- [ ] **업무 숙지** — `docs/project-structure.md` 정독, ERP/독자웹 화면·운영 흐름 파악
- [ ] **배포 절차 숙지·시연** — `deploy-dev.sh`/`deploy-live.sh` + 서버 `systemctl restart hmerp` 흐름 1회 실습
- [ ] **잔여 인계항목 수령** — 서버 `/etc/default/hmerp`(레포에 없는 환경변수파일) 내용, SSH alias·키, ERP/독자웹 테스트 계정, Iamport 대시보드 접근, **신규 AWS IAM 키 발급**
- [ ] 거래처 대표 커뮤니케이션 (안심 메시지) — M-1
- [ ] 7월 정식 인계 완료 + 보수 구조 전환(80만 수령 시작)

## 🐞 이슈 로그
| # | 상태 | 이슈 | 해결 과정 / 결과 |
|---|---|---|---|
| M-1 | 🔲 열림 | 과거 거래처 대표와의 신뢰 이슈 (있었던 문제들) | 차차 정리 예정 — Rachel이 내용 공유하면 분해 |
| M-2 | 🔲 열림 | 레포에 credential 평문 다수 (PG/Redis 비번, Iamport key/secret, AWS 액세스키 `.run/dev.run.xml` 등) | PRIVATE 레포 확인됨(즉시 외부노출 X). 인계 마무리 시 **시크릿 주입 seam + HEAD 제거 + 전량 로테이션**(키 회수·재발급, DB 비번) 백로그 — handover-base.md §8. **public 전환 금지** |
| M-3 | ✅ 해결 | macOS Tailscale *"Unable to add a new user"* — 테일넷 합류 불가 | 네트워크 시스템확장이 "승인 대기"였음 → 시스템설정 › 개인정보 보호 및 보안 › 보안 › 확장 허용으로 해결 (2026-06-18). 재부팅 무관, 수동 승인이 핵심 |

*(인수인계 받으며 과거 이슈들 여기 M-n으로 정리)*

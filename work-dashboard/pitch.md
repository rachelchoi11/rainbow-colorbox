# 핏치 (Pitch) — AI 독서토론 교육 플랫폼

> **트랙**: 개인 프로젝트 | **역할**: 대표·기획·개발·디자인 일체
> **경로**: `~/workspace/bookbot`(웹, 이 레포) · `~/workspace/bookbot-app`(React Native 모바일 — 오늘의 질문 독립 앱)
> **원격**: github.com/rachelchoi11/bookbot.git | **프로덕션**: https://bookbot-mu.vercel.app (Vercel + Supabase 도쿄)
> **현 단계(7/17)**: 프로덕션 AI 장애 복구 진행 중 + 웹 무료 제한베타 스코프 확정 대기.

## 🎯 현재 상태
- **제품**: K-12 초등 최우선 AI 독서토론 교육 플랫폼(질문→사고→토론→표현→분석→성장). 45+ 모델, 90+ API, 47 페이지, 4개 포털(학생/교사/출판사/관리자).
- **데이터 해자**: 사고력 진화 추적기 · 개인 지식 그래프 · 예측 학습 경로 (경쟁 차별화 핵심, 사업계획서 중심 논거).
- **콘텐츠 2계층**: Tier1 PD 공개도서 전문 보유(캐릭터 대화까지) / Tier2 현행도서 메타데이터+PDF 업로드+출판사 라이선스.

## 🔴 다음 액션 (최우선)
- **P-1** 🔴 **PR #1은 머지됨(main=795965b) — 그러나 Vercel 프로덕션 마지막 배포가 212일 전**(git 자동배포 미연동). 프로덕션은 여전히 은퇴 모델 → AI 404 상태로 추정. `npx vercel --prod` 수동 배포 필요 — *사용자 승인 대기*.
- **P-2** 🔲 PR #1 머지 후 `launch/web-beta-scope`를 main에 리베이스 (그 브랜치엔 아직 은퇴 모델 문자열 잔존 — 커밋 없어 main과 동일).
- **P-3** 🔲 웹 베타 스코프 확정. `src/lib/launch-config.ts`의 노출/숨김 두 배열 조정. **충돌 지점: `analytics`(데이터 해자 ↔ 콜드스타트)** — 로컬에서 데이터 있는 계정으로 `/analytics` 보고 판단.
- **P-4** 🔲 Opus 4.8 원가 청구서 확인 → 티어 재검토. 원가 부담 시 판단 개입 없는 경로만 선별 강등(book-enrichment·search/recommend). 채점·토론·음성은 Opus 유지.

## ✅ 완료 (7/17)
- **모델 은퇴 장애 복구**: `claude-sonnet-4-20250514`(2026-06-15 은퇴, API 404) → `claude-opus-4-8` 전 호출부 17개 파일 24곳 교체. 실제 API 호출로 검증(Opus OK / Sonnet 404), 격리 워크트리 typecheck 통과. `fix/claude-model-retirement` 브랜치 + PR #1 생성·푸시.
- **로컬 리뷰 환경**: Docker postgres + `.env.local`(로컬 DB) 우선 적용으로 http://localhost:3000 가동. PD 공개도서 34권 전문 적재 확인(작은아씨들 504p 등). nohup 분리로 세션 독립.
- **작업 보고서**: `bookbot/docs/작업보고서-2026-07-15.md`+`.pdf`(15p). 변환기 `scripts/md2pdf-report.py`(A4 세로, 한글).
- **내구성 복구 구조**: CLAUDE.md/AGENTS.md 복귀 앵커 + 이 파일 + 자동리콜 메모리 2건.

## ✅ 완료 (10/8)
- WIP 백업(`wip/backup-2026-09-16`)을 `chore/recovery-anchors`에 3커밋으로 정리·푸시(PR #2): docs·PD 파이프라인 / 베타 스코프 스위치(기본 OFF) / RLS SQL(미적용). tsc 통과.
- P-2 해소: `launch/web-beta-scope`는 이미 main(795965b)과 동일.

## ✅ 완료 (9/17)
- **모두의 창업 2차(재도전) 제출 완료** — 제출 기록: `Dropbox/2026/사업공고_2026/모두의창업_2026/2기_재도전/제출기록_2026-09-17.md`. 시제품 단계·주변 실증 완료·광정초 실증 준비 중·레미 협의 중 기준으로 작성.
- 오늘자 뉴스 160건 수집 → 토론 주제 생성·토론방 캡처(로컬 DB). 로컬 Postgres 컨테이너 실행 중.

## 📋 이슈 로그
- **P-1** 🔴 PR #1 머지 완료, 프로덕션 미배포 (Vercel 212일 전) — 수동 배포 승인 대기
- **P-3** 🔲 웹 베타 스코프 — analytics 노출 여부 충돌
- **P-5** 🔲 `.env.local`의 `AIFRAME_API_KEY` 오타 (정상: `APIFRAME_API_KEY`) — AI 이미지 생성 안 되면 의심

## 참고
- 삭제 금지 자산: 음성 AI 분석(senior/child-speech, voice-analysis 등), 채팅형 회원가입(bookbot-app). CLAUDE.md 「삭제/변경 금지 파일」 참조.
- 사업계획서: 예비창업패키지 제출 2026-03-24. 이화여대 여성특화 AC 등 다수 제출 이력(사용자 메모리 참조).

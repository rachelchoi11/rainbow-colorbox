# work-dashboard — 전 프로젝트 공용 진실원천

이 폴더는 모든 프로젝트의 진행 상황·이슈를 추적하는 공용 대시보드다.
Claude 메모리는 터미널·디렉터리 간 공유가 안 되므로, **공유할 정보는 반드시 여기 파일에 쓴다.**

- `DASHBOARD.md` — 마스터(우선순위·오픈이슈 표·한 줄 현황)
- `<프로젝트>.md` — 프로젝트별 상세 로그(완료/다음 액션/이슈, 절대날짜)
- `README.md` — 갱신 규칙(이슈 채번, 상태 이모지 🔲🔄✅⏸️)

## 실버톡톡 복귀 앵커 (재부팅 시 대화 사라짐)
> 현재 단계: 그룹웨어를 독립 멀티테넌트 SaaS 플랫폼으로 실서비스화(7/16~).
1. `~/workspace/work-dashboard/silvertoktok.md` — 다음 할 일(7월 베타 B-1~B-8)·이슈
2. `~/workspace/silvertoktok-groupware/docs/platform-architecture.md` — 설계 전문
3. `~/workspace/silvertoktok-groupware/docs/worklog-*.md` — 직전 세션 보고서
> 개발 레포: `github.com/rachelchoi11/silvertoktok-groupware`(개인 비공개). 인프라 = Supabase(AWS 서울).
> 로드맵: 7월 베타(VIP 내부) → 8월 VIP PoC(레미 IoT) → 9월 타 병원 → 연말 5개.

# 하이브마인드 — 출판사 정산 솔루션

> 트랙: 엔시온 연계 프리랜서 | 역할: PM·PO·기획·개발 | 계약: 2026-06-01~ (7개월)

## 업무 트래킹 (중요 — 모든 작업 종료 시)
작업이 끝나면 `~/workspace/work-dashboard/` 를 갱신한다 (전 프로젝트 공용 진실원천).
- 이 프로젝트 로그: `~/workspace/work-dashboard/hivemind.md` — 완료한 일/다음 액션/이슈 로그를 절대날짜와 함께 갱신
- 마스터: `~/workspace/work-dashboard/DASHBOARD.md` — 오픈이슈 표·한 줄 현황 동기화
- 규칙: `~/workspace/work-dashboard/README.md` 준수. 이슈 채번 **H-n**, 상태 이모지 🔲🔄✅⏸️
- Claude 메모리는 터미널 간 공유 안 되므로, 공유할 정보는 반드시 work-dashboard 파일에 쓴다.

## Codex 연동 — 검수 전용 (2026-09-11)
Codex는 **2차 검증자**다. 구현을 맡기지 않는다. 기획·아키텍처는 Rachel, 실행은 강수아, Codex는 독립 검수다.

**호출**
```
scripts/codex-audit.sh <레포경로> [--uncommitted | --base <브랜치> | --commit <SHA>]
                       [--account a|b] [--model <모델>] [--note "이번에 특히 볼 것"]
```
- 읽기 전용 샌드박스(`codex exec -s read-only`)로만 실행한다. 실행 전후 작업트리 sha256을 비교해 Codex가 파일을 건드리면 **실패로 끝낸다**(검수자가 코드를 고치면 2차 검증이 아니다).
- 결과는 `~/.codex-audit/<레포명>/<타임스탬프>.md`. 레포 안에 쓰지 않는다(무변경 검증이 스스로 깨진다).
- `codex review`는 대상 플래그와 커스텀 프롬프트를 함께 받지 못해(`--uncommitted cannot be used with [PROMPT]`) `exec`를 쓴다.

**계정 — 사용량이 계정별로 따로 쌓인다**
- `CODEX_HOME`으로 분리한다. 셸 별칭을 쓰지 않는다.
- `a` → `~/.codex-hive-a`, `b` → `~/.codex-hive-b`. 각 홈에 `codex login`을 따로 한다.
- 프로젝트별 기본 계정은 `~/.codex-audit/accounts.conf`에 선언한다(`<레포경로> = a`). **선언도 플래그도 없으면 실행을 거부한다** — 엉뚱한 계정의 쿼터를 쓰지 않기 위해서다.
- 데스크톱 홈(`~/.codex`)은 검수에 쓰지 않는다. Notion MCP·computer-use 플러그인이 붙고, 모델이 `gpt-6-astra`로 설정돼 CLI 0.147.0에서 400으로 죽는다. 검수 기본 모델은 `gpt-5.6-terra`.

**지킬 것**
- Claude 대화 전체는 전달되지 않는다. 필요한 맥락은 `--note`로 직접 넘긴다.
- Codex가 도는 동안 같은 파일을 수정하지 않는다.
- **Codex 지적을 액면 그대로 반영하지 않는다.** 재현 조건을 직접 확인하고, 확인된 것만 고친다. 틀린 지적은 기록만 남긴다.
- 검수 기준은 정산 금액 안전성이다: 금액 오류 경로 / 원본에 없는 값 생성 / 선언값 대신 추론 / 권한·격리 / 테스트가 실제로 그 결함을 잡는지.

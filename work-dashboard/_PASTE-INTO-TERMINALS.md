# 📋 다른 터미널에 복붙할 지시문

각 프로젝트 터미널(hivemind, silvertoktok, hmusic …)에서 작업 시작할 때 또는 끝낼 때 아래를 붙여넣으면 됨.

---

## A. 작업 끝낼 때마다 (복붙)

```
작업한 내용을 ~/workspace/work-dashboard/ 에 반영해줘.
- 이 프로젝트의 md 파일(예: hivemind.md)에 완료한 일/다음 액션/이슈를 날짜와 함께 갱신
- ~/workspace/work-dashboard/DASHBOARD.md 의 오픈이슈 표·한 줄 현황도 동기화
- 규칙은 ~/workspace/work-dashboard/README.md 따를 것 (이슈 채번 H-n/S-n/M-n, 상태 이모지, 절대날짜)
```

## B. 터미널 세팅용 — 한 번만 (각 프로젝트 CLAUDE.md에 추가하면 매번 안 붙여도 됨)

각 프로젝트 폴더의 `CLAUDE.md`(없으면 생성)에 아래 블록 추가:

```markdown
## 업무 트래킹
작업 종료 시 ~/workspace/work-dashboard/ 를 갱신한다(공용 진실원천).
- 이 프로젝트 md + DASHBOARD.md 동기화. 규칙은 work-dashboard/README.md.
- Claude 메모리는 터미널 간 공유 안 되므로, 공유 정보는 반드시 이 폴더에 쓴다.
```

## C. 정리 허브에서 (bizplan-ai 터미널 = 여기)

```
싱크해줘  →  work-dashboard 전 파일 읽고 일정·우선순위·오픈이슈 재정리
```

## D. 새 프로젝트 생겼을 때 — 부트스트랩 (그 새 터미널에 복붙)

새 프로젝트 폴더의 터미널에서 아래를 붙여넣으면 트래킹 셋업까지 알아서 함:

```
이 프로젝트를 work-dashboard 트래킹 체계에 등록해줘.
1. ~/workspace/work-dashboard/README.md 규칙을 읽고
2. 이 폴더에 CLAUDE.md 생성 (트래킹 블록 추가, 이슈 접두어는 프로젝트명에 맞게 새로 정해)
3. ~/workspace/work-dashboard/<프로젝트>.md 생성 (개요/완료한일/다음액션/이슈로그 골격)
4. ~/workspace/work-dashboard/DASHBOARD.md 의 '프로젝트별 한 줄 현황'에 한 줄 추가
그 다음부터 작업 끝낼 때마다 위 파일들 갱신해줘.
```

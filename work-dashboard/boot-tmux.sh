#!/usr/bin/env bash
# 모든 프로젝트 터미널을 tmux 세션 하나로 띄운다.
# 사용법:  ~/workspace/work-dashboard/boot-tmux.sh
# 이미 'work' 세션이 있으면 그냥 attach (중복 생성 안 함).
# tmux 안에서 작업하면 창을 닫아도 세션은 살아있고(detach),
# 15분마다 자동저장(tmux-continuum) + 재시작 시 자동복원된다.
set -euo pipefail

SESSION="work"
WS="$HOME/workspace"

# 우선순위 순서 = work-dashboard/DASHBOARD.md 기준
# "창이름:폴더" — 폴더 없으면 건너뜀
WINDOWS=(
  "hivemind:$WS/hivemind"          # 1순위
  "silvertok:$WS/silvertoktok"     # 2순위
  "stok-bot:$WS/silvertoktok_chatbot"
  "hmusic:$WS/hmusic"              # 3순위
  "sian:$WS/sian"                  # 시안 ERP (SI-1)
  "hub:$WS/bizplan-ai"            # 정리 허브 (싱크해줘)
  "hdm:$WS/hdm"                    # 현재 이벤트 랜딩
  "dash:$WS/work-dashboard"        # 대시보드 자체
)

# 이미 세션 있으면 그냥 붙기
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "세션 '$SESSION' 이미 있음 → attach"
  exec tmux attach -t "$SESSION"
fi

first=1
for entry in "${WINDOWS[@]}"; do
  name="${entry%%:*}"
  dir="${entry#*:}"
  [ -d "$dir" ] || { echo "건너뜀(폴더없음): $name"; continue; }
  if [ "$first" = 1 ]; then
    tmux new-session -d -s "$SESSION" -n "$name" -c "$dir"
    first=0
  else
    tmux new-window -t "$SESSION" -n "$name" -c "$dir"
  fi
done

tmux select-window -t "$SESSION:1"
echo "세션 '$SESSION' 생성 완료 → attach"
exec tmux attach -t "$SESSION"

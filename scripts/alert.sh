#!/bin/sh
# 사람을 부른다 — 배치(lshobby-alert@)·배포(deploy-local.sh) 실패의 공통 경로 (docs/16 §16.14).
# 이 PC는 데스크톱 세션이 없어 notify-send가 닿지 않는다 — Notion 백업 실패가 17일간 묻혔다 (2026-10-25).
# ntfy.sh 푸시: 토픽 이름은 ~/.lshobby/ntfy-topic 한 줄(폰의 ntfy 앱이 같은 토픽을 구독).
# 파일이 없으면 alerts.log 기록만 남기고 0으로 끝난다 — 경보 경로의 실패가 본 작업의 실패가 되지 않게.
# 사용: scripts/alert.sh "<제목>" "<본문>"
set -u
title=$1
body=$2
dir="$HOME/.lshobby"
mkdir -p "$dir"
printf '%s %s — %s\n' "$(date -Is)" "$title" "$body" >> "$dir/alerts.log"

topic=$(cat "$dir/ntfy-topic" 2>/dev/null || true)
[ -n "$topic" ] || { echo "경보 미전송: $dir/ntfy-topic 없음 ($title)" >&2; exit 0; }
# 헤더는 ASCII뿐이라 한글 제목은 JSON 본문으로 보낸다
payload=$(TOPIC="$topic" TITLE="$title" BODY="$body" python3 -c \
  'import json,os;print(json.dumps({"topic":os.environ["TOPIC"],"title":os.environ["TITLE"],"message":os.environ["BODY"],"priority":4,"tags":["warning"]}))')
curl -sf --max-time 10 -H "Content-Type: application/json" -d "$payload" https://ntfy.sh >/dev/null \
  || echo "경보 전송 실패: $title" >&2
exit 0

#!/bin/sh
# scripts/systemd/ 의 유닛을 ~/.config/systemd/user 에 복사하고 켠다 (docs/16 §16.5·§16.14). 재실행 안전.
# 앱(lshobby.service)은 켜 두기만 하고 재시작하지 않는다 — 유닛을 바꿨으면 systemctl --user restart lshobby
set -eu
src="$(cd "$(dirname "$0")" && pwd)/systemd"
dst="$HOME/.config/systemd/user"
mkdir -p "$dst"
cp "$src"/*.service "$src"/*.timer "$dst"/
systemctl --user daemon-reload
systemctl --user enable lshobby.service
for t in lshobby-deploy lshobby-digest lshobby-notion-backup lshobby-backup; do
  systemctl --user enable --now "$t.timer"
done
systemctl --user list-timers 'lshobby-*' --no-pager

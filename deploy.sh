#!/usr/bin/env bash
# GitHub main의 새 커밋을 받아 테스트 통과 시 서비스를 재시작한다.
#
# 원격에서 받을 게 없어도 "실행 중인 리비전 != HEAD"면 재시작한다.
# 이 서버에서 직접 커밋하고 push하면 로컬 == 원격이라 받을 게 없어,
# 예전 버전은 아무것도 하지 않고 옛 코드를 계속 띄워 두는 사각지대가 있었다.
# 실행 중인 리비전은 .deployed-rev에 기록해 둔다 (.gitignore 대상 —
# 추적되면 아래 dirty 검사에 걸려 배포가 영영 멈춘다).
set -euo pipefail
cd "$(dirname "$0")"

STAMP=.deployed-rev
SERVICE=spanish-practice

[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "not on main, skip"; exit 0; }

git fetch origin main

# 로컬에서 수정 작업 중이면 배포하지 않음
if [ -n "$(git status --porcelain)" ]; then
    echo "working tree dirty, skip deploy"
    exit 0
fi

# 원격에 새 커밋이 있으면 먼저 당겨온다
if [ "$(git rev-list main..origin/main --count)" -ne 0 ]; then
    git merge --ff-only origin/main
fi

head_rev=$(git rev-parse HEAD)
deployed_rev=$(cat "$STAMP" 2>/dev/null || echo none)

# HEAD가 이미 배포돼 있고 서비스도 살아 있으면 할 일 없음.
# (is-active 검사 덕분에 서비스가 죽어 있으면 타이머가 다시 살려낸다)
if [ "$head_rev" = "$deployed_rev" ] && systemctl --user is-active --quiet "$SERVICE"; then
    exit 0
fi

.venv/bin/pip install -q -r requirements.txt

if .venv/bin/python -m pytest tests/ -q; then
    systemctl --user restart "$SERVICE"
    echo "$head_rev" > "$STAMP"
    echo "deployed $(git rev-parse --short HEAD)"
else
    echo "tests failed — service NOT restarted (still running previous version)"
    exit 1
fi

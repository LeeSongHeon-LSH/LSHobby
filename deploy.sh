#!/usr/bin/env bash
# GitHub main에 새 커밋이 있으면 받아서 테스트 통과 시 서비스 재시작
set -euo pipefail
cd "$(dirname "$0")"

[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "not on main, skip"; exit 0; }

git fetch origin main
LOCAL=$(git rev-parse main)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

# 로컬에서 수정 작업 중이면 배포하지 않음
[ -n "$(git status --porcelain)" ] && { echo "working tree dirty, skip deploy"; exit 0; }

git merge --ff-only origin/main
.venv/bin/pip install -q -r requirements.txt

if .venv/bin/python -m pytest tests/ -q; then
    systemctl --user restart spanish-practice
    echo "deployed $(git rev-parse --short HEAD)"
else
    echo "tests failed — service NOT restarted (still running previous version)"
    exit 1
fi

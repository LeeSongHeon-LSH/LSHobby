#!/bin/sh
# main에 새 커밋이 있으면 받아서 빌드하고 서비스를 재시작한다 (docs/16 §16.5).
# systemd user 타이머(lshobby-deploy.timer)가 2분마다 호출 — 할 일이 없으면 조용히 끝난다.
set -eu

cd /home/leesongheon/projects/LSHobby

# 개발 중일 수 있다 — main이 아니거나 작업 트리가 더러우면 손대지 않는다
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "건너뜀: main 브랜치가 아님"; exit 0; }
[ -z "$(git status --porcelain)" ] || { echo "건너뜀: 작업 트리에 커밋 안 된 변경이 있음"; exit 0; }

git fetch --quiet origin main
old=$(git rev-parse HEAD)
new=$(git rev-parse origin/main)
[ "$old" != "$new" ] || exit 0

echo "배포 시작: $(git rev-parse --short "$old") → $(git rev-parse --short "$new")"
git merge --ff-only origin/main   # 갈라졌으면 여기서 실패한다 — 손으로 풀라는 뜻

# 의존성이 바뀐 커밋이면 먼저 설치 — 안 그러면 빌드가 엉뚱한 이유로 깨진다
if ! git diff --quiet "$old" "$new" -- package-lock.json; then
  echo "package-lock.json 변경 — npm ci"
  npm ci
fi

# 빌드가 실패하면 여기서 멈춘다: 재시작을 안 하므로 직전 빌드가 계속 서빙된다
npm run build
systemctl --user restart lshobby
echo "배포 완료: $(git rev-parse --short HEAD)"

#!/bin/sh
# main에 새 커밋이 있으면 CI 통과를 확인하고 받아서 빌드·재시작한다 (docs/16 §16.5).
# systemd user 타이머(lshobby-deploy.timer)가 2분마다 호출 — 할 일이 없으면 조용히 끝난다.
#
# 계약: 돌던 사이트를 내리지 않는다. 빌드는 .next-staging에서 하고, 빌드 성공 + 헬스체크
# 통과일 때만 .next와 바꿔치기한다. 어느 단계에서 실패하든 직전 빌드가 계속 서빙된다.
set -eu

# 이 스크립트 자신이 배포 대상이다 — 아래 git merge가 실행 중인 이 파일을 바꾸면 sh는 남은
# 부분을 새 파일의 같은 오프셋에서 읽는다(dash 실측: 파일이 읽기 버퍼를 넘으면 교체 이후
# 구간이 통째로 건너뛰어져 빌드·교체 없이 조용히 끝난다). 사본에 붙어서 돈다.
if [ "${DEPLOY_REEXEC:-}" != 1 ]; then
  self=$(mktemp)
  cat "$0" > "$self"
  DEPLOY_REEXEC=1 sh "$self" "$@" && rc=0 || rc=$?
  rm -f "$self"
  exit "$rc"
fi

REPO=/home/leesongheon/projects/LSHobby
SLUG=LeeSongHeon-LSH/LSHobby
HEALTH_URL=http://127.0.0.1:3000/
STATE="$HOME/.lshobby/deploy-state"   # "<sha> <사유>" — 같은 실패를 2분마다 반복하지 않기 위한 기록

cd "$REPO"

# 사람을 부른다. 타이머는 fire-and-forget이라 journald에만 쌓으면 아무도 안 본다.
alert() {
  echo "★ 배포 경보: $*" >&2
  notify-send -u critical "LSHobby 배포" "$*" 2>/dev/null || true
}

mark() { mkdir -p "$(dirname "$STATE")"; printf '%s %s\n' "$1" "$2" > "$STATE"; }

# --- 손대면 안 되는 상황들 -------------------------------------------------
# 이 PC가 개발기이자 서버다 (docs/16 §16.7)
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "건너뜀: main 브랜치가 아님"; exit 0; }
[ -z "$(git status --porcelain)" ] || { echo "건너뜀: 작업 트리에 커밋 안 된 변경이 있음"; exit 0; }

# 작업 트리가 깨끗해도 `npm run dev`가 돌고 있을 수 있다 — 교체·재시작이 dev 서버를 깬다
server_pid=$(systemctl --user show lshobby -p MainPID --value 2>/dev/null || echo 0)
for pid in $(pgrep -f 'next dev|next-server' 2>/dev/null || true); do
  [ "$pid" = "$server_pid" ] && continue
  [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)" = "$REPO" ] || continue
  echo "건너뜀: 이 체크아웃에서 개발 서버(pid $pid)가 돌고 있음"
  exit 0
done

# --- 배포할 것이 있나 -------------------------------------------------------
# 기준은 "지금 서빙 중인 빌드가 어느 커밋인가"다. HEAD와 origin을 비교하면, 이 PC가 개발기이자
# 서버라 여기서 직접 커밋할 때 둘이 함께 올라가 배포할 것이 없다고 판정되어 영영 돌지 않는다.
git fetch --quiet origin main
old=$(git rev-parse HEAD)
new=$(git rev-parse origin/main)
deployed=$(cat .next/DEPLOYED_SHA 2>/dev/null || true)
[ "$deployed" != "$new" ] || exit 0

state=$(cat "$STATE" 2>/dev/null || true)
state_sha=${state%% *}
state_reason=${state##* }
# 이미 실패로 판정한 커밋이면 조용히 넘어간다 — 고친 커밋이 올라오면 sha가 달라져 다시 시도한다
[ "$state_sha" = "$new" ] && [ "$state_reason" = blocked ] && exit 0

if ! git merge-base --is-ancestor "$old" "$new"; then
  # 로컬에만 있는 커밋 — 푸시 전 개발 중이다. 배포할 것이 없으니 조용히 넘어간다
  if git merge-base --is-ancestor "$new" "$old"; then
    echo "건너뜀: 로컬 main이 origin보다 앞서 있음 (푸시 안 된 커밋)"
    exit 0
  fi
  # 진짜로 갈라졌으면 자동으로 풀 방법이 없다. 2분마다 같은 실패를 720번 찍는 대신 타이머를 세우고 부른다
  alert "로컬 main이 origin과 갈라져 배포를 멈췄다. 정리한 뒤 'systemctl --user start lshobby-deploy.timer'"
  systemctl --user stop lshobby-deploy.timer
  exit 1
fi

# --- CI 게이트 (docs/12 NFR-06) --------------------------------------------
# pre-push 훅은 --no-verify와 GitHub UI 머지를 못 막는다. 초록 CI만 프로덕션에 올린다.
if [ "${DEPLOY_SKIP_CI:-}" != 1 ]; then
  runs=$(gh api "repos/$SLUG/commits/$new/check-runs" \
           --jq '.check_runs[] | "\(.status):\(.conclusion)"' 2>/dev/null || true)
  pending=1   # 결과가 하나도 없으면 아직 시작 전 = 대기
  failed=0
  for r in $runs; do
    pending=0
    case "$r" in
      completed:success|completed:skipped|completed:neutral) ;;
      completed:*) failed=1 ;;
      *) pending=1; break ;;
    esac
  done

  if [ "$failed" = 1 ]; then
    alert "CI 실패한 커밋($(git rev-parse --short "$new"))이라 배포하지 않는다"
    mark "$new" blocked
    exit 1
  fi

  if [ "$pending" = 1 ]; then
    echo "대기: CI가 아직 안 끝났다 ($(git rev-parse --short "$new"))"
    # 30분 넘게 안 끝나면 CI 자체가 안 도는 것이다 — 무한 대기도 침묵이므로 한 번 부른다
    if [ $(( $(date +%s) - $(git log -1 --format=%ct "$new") )) -gt 1800 ] \
       && ! { [ "$state_sha" = "$new" ] && [ "$state_reason" = stalled ]; }; then
      alert "CI가 30분째 안 끝나 배포가 멈춰 있다. CI를 못 쓰면 DEPLOY_SKIP_CI=1 로 수동 배포"
      mark "$new" stalled
    fi
    exit 0
  fi
fi

# --- 배포 -------------------------------------------------------------------
# 비교 기준은 마지막으로 배포된 커밋이다. 기록이 없거나(이 방식 도입 전 빌드) 그 커밋이
# 사라졌으면 HEAD로 대신한다 — 최악이라도 npm ci 한 번을 건너뛰는 정도다
base=$deployed
git rev-parse --quiet --verify "${base:-@invalid@}^{commit}" >/dev/null 2>&1 || base=$old

echo "배포 시작: $(git rev-parse --short "$base") → $(git rev-parse --short "$new")"
git merge --ff-only origin/main

# 의존성이 바뀐 커밋이면 먼저 설치 — 안 그러면 빌드가 엉뚱한 이유로 깨진다
if ! git diff --quiet "$base" "$new" -- package-lock.json; then
  echo "package-lock.json 변경 — npm ci"
  npm ci
fi

# next build는 cleanDistDir 기본값 때문에 distDir을 먼저 비운다. 그러니 .next가 아닌 곳에 짓는다
rm -rf .next-staging
mkdir -p .next-staging
# 폰트 캐시가 여기 산다 — 안 물려주면 매 배포가 fonts.gstatic.com 접속에 걸린다.
# cleanDistDir이 cache는 안 지우므로 원래 흐름에서는 저절로 유지되던 것이다
[ -d .next/cache ] && cp -a .next/cache .next-staging/cache
if NEXT_DIST_DIR=.next-staging npm run build; then build_ok=1; else build_ok=0; fi

# next build가 tsconfig.json에 distDir 타입 경로를 써넣는다. 스테이징 경로가 남으면 다음 tick의
# "작업 트리 더러움" 가드에 걸려 배포가 영영 멈춘다 — 생성물이므로 성공/실패 어느 쪽이든 되돌린다
git checkout -- tsconfig.json

if [ "$build_ok" = 0 ]; then
  rm -rf .next-staging
  mark "$new" blocked
  alert "빌드 실패 ($(git rev-parse --short "$new")) — 직전 빌드가 계속 서빙 중. 고쳐 푸시하면 다시 시도한다"
  exit 1
fi

# 이 빌드가 어느 커밋인지 빌드와 함께 옮긴다 — 다음 tick의 배포 판단 기준이고,
# 헬스체크 실패로 .next-prev를 되돌릴 때 그 기록도 같이 따라간다
printf '%s\n' "$new" > .next-staging/DEPLOYED_SHA

# 교체는 mv 두 번 + 재시작 — 사이트가 비는 창이 빌드 시간이 아니라 재시작 시간으로 줄어든다
rm -rf .next-prev
mv .next .next-prev
mv .next-staging .next
systemctl --user restart lshobby

# 빌드가 됐다고 뜨는 것은 아니다 — 새 BUILD_ID가 실제로 응답할 때까지 보고, 아니면 되돌린다
# (그냥 200만 보면 아직 안 죽은 직전 프로세스의 응답을 통과로 셀 수 있다)
build_id=$(cat .next/BUILD_ID)
healthy=0
i=0
while [ "$i" -lt 30 ]; do
  curl -sf --max-time 5 "$HEALTH_URL" 2>/dev/null | grep -q "$build_id" && { healthy=1; break; }
  sleep 1
  i=$((i + 1))
done

if [ "$healthy" != 1 ]; then
  rm -rf .next
  mv .next-prev .next
  systemctl --user restart lshobby
  mark "$new" blocked
  alert "새 빌드가 30초 안에 응답하지 않아 직전 빌드로 되돌렸다 (HEAD는 $(git rev-parse --short "$new"))"
  exit 1
fi

rm -rf .next-prev
rm -f "$STATE"
echo "배포 완료: $(git rev-parse --short HEAD)"

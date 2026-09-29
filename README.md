# LSHobby

개인 지식·취미 관리 웹앱 — 책 · 언어 · 생각 세 서랍을 한곳에서 (네 번째 서랍 CV는 [별도 리포](https://github.com/LeeSongHeon-LSH/LeeSongHeon-LSH.github.io)로 나갔다). 핵심 가치는 **"시간에 따라 생각이 변하는 과정"의 기록**(reflection).

- **프로덕션**: `https://lshobby.<테일넷>.ts.net` — 이 집 PC가 상시 호스팅, **테일넷 안에서만** 열린다. 앱마다 tailnet 장치 하나(`ops/tailscale-lshobby/`), 실제 주소는 공개할 이유가 없어 적지 않는다 ([docs/16 §16.5](docs/16-infra.md))
- **스택**: Next.js + Tailwind + Supabase, 호스팅은 집 PC + Tailscale — 근거는 [docs/02](docs/02-tech-stack.md)
- **설계 문서**: [docs/](docs/README.md) — 아키텍처·모듈 설계·ERD/DDL·요구사항 명세(SRS)·인프라 해설(§16)

## 화면

![펼친 책 — 여정 지면](docs/assets/library-book.png)

**책** — 서재에서 책등을 고르면 지면이 펼쳐지고, 접힌 모서리를 누르면 넘어간다. 벽·책장·펭귄은 세 서랍이 함께 쓰는 한 장면이고, 화면은 그 앞에 놓인다.

| 홈 — 세 서랍 | 서재 — 독서 여정 | 언어 — 오늘 복습 |
| :---: | :---: | :---: |
| ![홈 화면](docs/assets/home.png) | ![서재 책장](docs/assets/library-shelf.png) | ![언어 세션](docs/assets/language.png) |

## 개발

```bash
npm install         # prepare가 .githooks pre-push 훅(lint → typecheck → test)을 켠다
npm run dev         # localhost:3000 (.env 필요 — docs/16 §16.4)
npm test            # vitest (test:watch는 감시 모드)
npm run lint
npm run typecheck   # next typegen && tsc --noEmit
npm run db:types    # 마이그레이션 적용 뒤 Supabase 생성 타입 갱신
```

앱 실행에 필요한 env는 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY` 둘이다(배치 스크립트용은 docs/16 §16.4). 로컬 dev는 **프로덕션 DB**를 쓰고, :3000은 `lshobby` 서비스가 잡고 있다 — `systemctl --user stop lshobby` 또는 `npm run dev -- -p 3001` ([docs/16 §16.7](docs/16-infra.md)).

배포는 **`main` 푸시**다 — 이 PC의 systemd 타이머(`lshobby-deploy.timer`)가 2분마다 origin/main을 확인해 받아서 빌드·재시작한다. 작업 트리가 더럽거나 빌드가 실패하면 건드리지 않는다 ([docs/16 §16.5](docs/16-infra.md), 로그는 `journalctl --user -u lshobby-deploy`). 기다리지 않고 바로 올리려면:

```bash
DEPLOY_SKIP_CI=1 scripts/deploy-local.sh   # 스테이징 빌드 → 헬스체크 → 교체, 실패 시 직전 빌드 유지
```

맨손 `npm run build`는 서빙 중인 `.next`를 먼저 비우고 `DEPLOYED_SHA`도 남기지 않으므로 쓰지 않는다 ([docs/16 §16.5](docs/16-infra.md)).

DB 스키마 변경은 `supabase/migrations/`가 원본 — 절차는 [docs/16 §16.6](docs/16-infra.md).

## 로컬 LLM

생각 세션의 하루 요약(집 PC `lshobby-digest.timer` 매일 00:30 UTC = KST 09:30)은 **로컬 Ollama**(`localhost:11434`)로만 돈다 — 생각 데이터는 외부 API로 보내지 않는다는 정책 때문이다. 구성은 [docs/16 §16.11](docs/16-infra.md).

## Notion 백업 미러

책 여정(저자·완독·별점·태그·노트·감상)과 단어 일별 통계를 매일 00:40 UTC(KST 09:40) `lshobby-notion-backup.timer`가 **Notion DB로 단방향 미러**한다 — 생각 데이터는 위 정책에 따라 제외. 구성과 운영은 [docs/16 §16.12](docs/16-infra.md).

## 공개 CV

이력서는 [`LeeSongHeon-LSH.github.io`](https://github.com/LeeSongHeon-LSH/LeeSongHeon-LSH.github.io) 리포의 `cv.md`가 원본이고 GitHub Pages(https://leesongheon-lsh.github.io)로 나간다 — 이 앱에는 더 이상 CV 코드도 테이블도, 홈에서 나가는 링크도 없다(#69). 경위는 [docs/17](docs/17-cv.md).

> 구 스페인어 학습 앱(FastAPI + SQLite)은 2026-08-15 컷오버로 종료·삭제됨 (git 히스토리에 보존, `spanish.db` 백업은 홈 디렉터리).

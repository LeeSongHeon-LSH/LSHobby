> LSHobby 설계 문서 — 목차·로드맵·§번호↔파일 매핑은 [README](README.md) 참조

## 16. 인프라 구조 해설 — 현재 상태 (2026-08-30 로컬 호스팅 전환 반영)

§2(스택 선정 이유)·§12(보안 요구)의 결과물로 **실제로 세워진 인프라가 어떻게 맞물려 도는지**를 학습용으로 풀어쓴 문서. 규칙의 원본은 §12, 여기는 "왜 이렇게 생겼고 요청이 어디로 흐르는가"를 설명한다.

### 16.1 전체 그림

```mermaid
flowchart LR
    subgraph dev["개발 (이 서버)"]
        CODE["리포 Spanish-Practice<br/>(Next.js + 구 파이썬 공존)"]
    end
    subgraph gh["GitHub"]
        REPO["LeeSongHeon-LSH/LSHobby<br/>main 브랜치"]
    end
    subgraph home["집 PC (호스팅, 이 서버)"]
        BUILD["npm run build"]
        PROD["systemd --user lshobby<br/>next start :3000"]
        TS["tailscale serve :8443"]
    end
    subgraph pages["GitHub Pages"]
        CV["leesongheon-lsh.github.io<br/>공개 CV (별도 리포, §17)"]
    end
    subgraph supa["Supabase (백엔드, 서울 리전)"]
        AUTH["Auth (GoTrue)<br/>로그인·JWT 발급"]
        REST["PostgREST<br/>테이블 자동 REST API"]
        DB[("PostgreSQL 17<br/>19개 테이블 + RLS")]
        STG["Storage<br/>(버킷 아직 없음)"]
    end
    U["브라우저 (모바일/PC)"]

    CODE -- git push --> REPO
    CODE -- npm run build<br/>+ systemctl restart --> BUILD --> PROD --> TS
    U -- "HTML·JS·CSS<br/>(테일넷 안에서만)" --> TS
    U -- supabase-js<br/>(anon key + JWT) --> AUTH & REST
    REST --> DB
    U -- 공개 링크 --> CV
```

핵심 구조 두 가지:

1. **서버 코드가 거의 없는 구조** — 데이터 요청은 Next.js 서버를 거치지 않고 **브라우저 → Supabase 직행**이 기본이다. 호스팅(지금은 집 PC)은 화면(정적 자산)을 주는 역할, Supabase가 API·DB·인증 전부를 담당한다. 백엔드를 직접 짜는 대신 PostgREST가 테이블마다 REST API를 자동 생성해 준다.
2. **보안의 최종 방어선은 DB 안(RLS)에 있다** — API가 브라우저에 열려 있으므로, "누가 뭘 읽고 쓸 수 있나"는 서버 코드가 아니라 Postgres의 Row Level Security 정책이 결정한다(§16.3).

### 16.2 구성요소별 역할

| 구성요소 | 역할 | 우리 설정 |
|---|---|---|
| **GitHub** | 소스 저장 + CI | `main`·PR 푸시에 `npm run lint` + `npm test` (배포 트리거 아님 — 2026-08-30 Vercel 연동 해제) |
| **집 PC** | 빌드·호스팅 | `systemd --user lshobby` = `next start :3000`, 배포는 손으로 (§16.5) |
| **Tailscale** | 외부 접근 | `tailscale serve :8443` — **테일넷 안에서만** 열린다. 인터넷 공개(funnel) 아님 |
| **Next.js** | 화면 + (필요 시) 서버 코드 | 16.x, App Router, `src/` 구조 — 모듈 경계는 §3 |
| **Supabase Auth** | 로그인·세션(JWT) | 이메일 로그인, **가입 서버 차단**(SEC-01), 계정 1개 |
| **PostgREST** | 테이블 → REST API 자동화 | supabase-js가 클라이언트. 모든 요청에 RLS 적용 |
| **PostgreSQL** | 데이터 원본 | §9 DDL = `supabase/migrations/` 파일로 형상 관리 |
| **Storage** | 파일(이미지) | CS 모듈 때 private 버킷 생성 예정(SEC-04) |

### 16.3 데이터 요청 한 번이 흐르는 길

"단어장 목록을 연다"를 예로:

```mermaid
sequenceDiagram
    participant B as 브라우저 (supabase-js)
    participant A as Supabase Auth
    participant P as PostgREST
    participant D as PostgreSQL (RLS)

    Note over B: 앞서 로그인 시 JWT 보관 중
    B->>P: GET /rest/v1/es_words?select=…<br/>헤더: apikey(anon) + Authorization(JWT)
    P->>D: SQL로 변환해 질의<br/>role = authenticated
    D->>D: RLS 정책 평가<br/>authenticated_all → 허용
    D-->>P: 행 반환
    P-->>B: JSON
```

- **anon key**: "이 Supabase 프로젝트의 클라이언트"임을 나타내는 공개 가능한 키. 이것만으로는 role이 `anon`이라 **RLS에서 전부 거부**된다 (실측: SELECT 0행, INSERT 거부)
- **JWT**: 로그인 시 Auth가 발급. 이게 붙어야 role이 `authenticated`가 되고, 우리 정책("authenticated 전부 허용", #33)이 통과시킨다
- 즉 "로그인함 = 본인 = 전부 허용"이 성립하는 전제는 **가입이 서버에서 차단**돼 있다는 것(SEC-01). 이 사슬이 §12.4 위협 모델의 답이다

### 16.4 키·비밀 체계 (무엇이 어디에, 왜)

| 비밀 | 성격 | 위치 | 용도 |
|---|---|---|---|
| anon key | **공개돼도 됨** (RLS가 방어) | `.env`, 브라우저 번들 | 클라이언트 접속 |
| service_role key | **절대 비공개** — RLS를 통째로 우회 | `.env`(로컬), `~/.lshobby/api-keys.json` | 관리 작업(계정 생성·SEC-08 재설정), 추후 서버 코드 |
| DB 비밀번호 | 비공개 | `~/.lshobby/db-password` | `pg_dump` 백업(NFR-04), `supabase link` |
| 앱 로그인 비밀번호 | 본인만 | `~/.lshobby/app-password` (+비밀번호 관리자) | 앱 로그인. 분실 시 SEC-08 런북 |
| Supabase 대시보드 계정 | **최상위 복구 수단** | GitHub 로그인 | 모든 것의 마스터 키 |

규칙(SEC-03): 비밀은 `.env`(gitignore)로만 — 코드·리포에 하드코딩 금지. 호스팅이 집 PC로 내려오면서 원격 환경변수 저장소는 아예 없어졌다. **`NEXT_PUBLIC_` 접두사가 붙은 변수만 브라우저 번들에 들어간다**는 Next.js 규칙이 anon(공개)과 service_role(서버 전용)의 경계를 코드 레벨에서 지켜준다.

### 16.5 배포 — 집 PC 로컬 호스팅 + Tailscale (2026-08-30 전환, #73)

Vercel을 내리고 **이 PC가 프로덕션**이 됐다. 공개할 것은 CV 하나뿐인데 그건 이미 GitHub Pages로 나갔고(§17), 남은 취미공간은 나만 쓰므로 인터넷에 있을 이유가 없다. 배치(§16.11·§16.12)도 이미 이 PC의 cron이라 운영 지점이 한 곳으로 모인다.

```mermaid
flowchart LR
    A[git push main] --> T["lshobby-deploy.timer<br/>2분마다 origin/main 대조"]
    T --> B["git merge --ff-only<br/>+ npm run build"]
    B --> C["systemctl --user restart lshobby"]
    C --> D["next start :3000"]
    D --> E["tailscale serve :8443"]
    E --> F["https://leesongheon.tailc7c4e0.ts.net:8443<br/>(테일넷 기기에서만)"]
    B -. 빌드 실패 .-> G["재시작 안 함<br/>직전 빌드가 계속 서빙"]
```

- **배포 = `main` 푸시** (2026-08-30 자동화). `systemd --user` 타이머 `lshobby-deploy.timer`가 **2분마다** `scripts/deploy-local.sh`를 돌려 origin/main과 대조하고, 새 커밋이 있을 때만 받아서 빌드·재시작한다. 손으로 하려면 같은 두 줄이 그대로 통한다:
  ```bash
  npm run build && systemctl --user restart lshobby
  ```
  자동 배포의 안전장치 — 하나라도 걸리면 **돌던 사이트는 그대로 둔다**:

  | 상황 | 동작 |
  |---|---|
  | 작업 트리가 더럽거나 `main`이 아님 | 건너뜀 (개발 중일 수 있다 — 이 PC가 개발기이자 서버다) |
  | 로컬 `main`이 origin과 갈라짐 | `--ff-only` 실패 → 멈춤, 손이 개입 |
  | `package-lock.json`이 바뀐 커밋 | `npm ci` 먼저 |
  | 빌드 실패 | 재시작을 안 한다 → **직전 빌드가 계속 서빙** |

  로그는 `journalctl --user -u lshobby-deploy`. 잠깐 끄려면 `systemctl --user stop lshobby-deploy.timer`.
- **상시 구동**: `~/.config/systemd/user/lshobby.service` (`Restart=always`) + 배포 타이머 `lshobby-deploy.{service,timer}`, 그리고 `loginctl enable-linger` — 로그아웃·재부팅 뒤에도 자동으로 뜬다. nvm은 로그인 셸에서만 PATH를 잡아 주므로 유닛은 **node 절대 경로**를 쓴다(노드를 올리면 유닛도 고쳐야 한다).
- **외부 접근 = Tailscale `serve`**: 테일넷에 들어온 기기만 닿는다. `funnel`이 아니므로 인터넷에는 열리지 않는다. TLS는 tailscaled가 테일넷 도메인 인증서로 종단한다 — `next.config.ts`의 헤더 3종(SEC-06)은 그대로 살아서 나간다.
- **포트가 443이 아니라 8443인 이유**: 이 PC의 kind 클러스터(다른 프로젝트) 컨테이너가 `0.0.0.0:80`·`0.0.0.0:443`을 이미 점유하고 있어 tailscaled가 IPv4 443을 잡지 못한다. 443을 비우면 `tailscale serve --bg 3000`으로 되돌려 주소에서 포트를 뗄 수 있다.
- **끄고 켜기**: `tailscale serve --https=8443 off` / `tailscale serve --bg --https=8443 3000`, 상태는 `tailscale serve status`.
- **DB는 그대로 원격 Supabase**다. 호스팅만 내려왔을 뿐이라 PC가 꺼져도 데이터는 안전하고, 대신 PC가 꺼져 있으면 앱에 접속할 수 없다 — 가용성은 NFR-03의 best-effort에서 한 단계 더 내려간 셈(수용).

**공개 CV는 다른 경로다**: 별도 리포 `LeeSongHeon-LSH.github.io`의 `main` 푸시 → GitHub Actions → Pages (§17.4). 이쪽만 인터넷에 있다.

> **주의 이력**: `vercel deploy` CLI 직접 배포는 `.gitignore`를 무시하고 `.env`를 업로드해서 `.vercelignore`로 막아 뒀었다 (2026-08-14). Vercel을 쓰지 않게 되면서 `.vercelignore`·`.vercel/`도 함께 제거했다 — CLI로 다시 배포할 일이 생기면 이 차단부터 복원할 것.

### 16.6 스키마 변경 절차 (형상 관리)

DB 스키마의 진실은 대시보드가 아니라 **리포의 마이그레이션 파일**이다:

```
supabase/migrations/20260814224424_initial_schema.sql   ← §9 DDL 원본
```

변경 순서: ① 새 마이그레이션 파일 작성(`supabase migration new 이름`) → ② `supabase db push`로 원격 적용 → ③ 커밋. 대시보드에서 손으로 고치면 리포와 어긋나므로 금지. 영어 확장(`en_*` 4테이블)도 이 절차로 파일 하나 추가하면 된다(§6.2).

### 16.7 로컬 개발 ↔ 프로덕션

| | 개발 (`npm run dev`) | 프로덕션 |
|---|---|---|
| 화면 | localhost:3000 | `https://leesongheon.tailc7c4e0.ts.net:8443` (같은 PC의 :3000을 프록시) |
| 실행 | 터미널에서 직접 | `systemd --user lshobby` (`next start`) |
| 환경변수 | `.env` 파일 | 같은 `.env` 파일 |
| DB | **같은 Supabase를 바라봄** | 같음 |

이제 개발과 프로덕션이 **같은 PC·같은 파일**을 쓴다 — `npm run dev`를 띄워도 3000 포트가 이미 서비스에 잡혀 있으므로, 개발할 때는 서비스를 멈추거나(`systemctl --user stop lshobby`) 다른 포트로 띄운다. 로컬 개발도 프로덕션 DB를 직접 쓴다 — 1인 프로젝트라 dev/prod DB 분리를 하지 않았다(단순성 우선). 파괴적인 실험이 필요하면 그때 `supabase start`(로컬 Docker DB)를 검토.

### 16.8 구 파이썬 앱과의 공존 — **종료됨 (2026-08-15 컷오버, #49)**

> 아래는 기록용. 파이썬 앱·systemd 유닛·pytest CI는 삭제됐고(git 히스토리 보존), `spanish.db`는 `~/spanish.db.bak-cutover-20260815`로 백업됨. Tailscale serve 프록시 해제만 sudo 필요로 남음.

```
같은 리포 안:
  main.py, quiz.py, …, spanish.db   ← 구 앱 (Tailscale 사설망 + systemd, 계속 운영 중)
  package.json, src/, supabase/     ← 신 앱 (Vercel + Supabase)
```

- 두 앱은 **저장소만 공유하고 실행 환경·DB가 완전히 분리**되어 있다. 신 앱 작업이 구 앱을 건드릴 일 없음
- 구 앱의 2분 주기 자동 배포(systemd)는 git pull 기반이라, 신 앱 파일이 늘어나도 영향 없음 (단, 로컬 작업 트리가 dirty면 구 앱 배포가 멈추는 규칙은 여전— 커밋을 자주)
- §6.5 컷오버 시: 파이썬 파일·systemd 유닛 삭제, `spanish.db`는 파일 백업만

### 16.9 무료 티어 한계와 운영 수칙

- **Supabase Free**: DB 500MB · Storage 1GB · 자동 백업 없음 → **`pg_dump` 주 1회**(NFR-04). 장기 무활동 시 프로젝트 일시정지 가능(상시 사용이면 무관)
- **호스팅 비용 0원**: 집 PC + Tailscale(개인 무료 플랜) + GitHub Pages. 대역폭 한도라는 개념 자체가 사라졌다
- 락인 회피(§2.2): DB·Storage가 전부 Supabase(표준 Postgres)에 있으므로 호스팅 이전은 재배포 수준, Supabase 이전은 `pg_dump` 복원 수준 — 2026-08-30 Vercel → 집 PC 이전이 이 원칙의 실증

### 16.10 식별자 모음 (운영 참조)

| 항목 | 값 |
|---|---|
| Supabase 프로젝트 | `pxozfdypiexwakocfofs` (서울 ap-northeast-2) |
| Supabase URL | `https://pxozfdypiexwakocfofs.supabase.co` |
| 프로덕션 URL | `https://leesongheon.tailc7c4e0.ts.net:8443` (테일넷 전용) |
| 서비스 유닛 | `~/.config/systemd/user/lshobby.service` |
| 공개 CV | https://leesongheon-lsh.github.io (리포 `LeeSongHeon-LSH.github.io`, §17) |
| 구 Vercel 프로젝트 | `lshobby` (팀 `lsh12`) — GitHub 연동 해제됨 (2026-08-30) |
| 앱 계정 | leesongheon1209@gmail.com (1계정, 가입 차단) |
| 비밀 보관 | `~/.lshobby/` (600 권한) + 리포 `.env`(gitignore) |

### 16.11 로컬 LLM(Ollama) — 다이제스트 배치 전용

생각 세션의 하루 요약 배치(`scripts/digest-thoughts.mjs`, 집 PC cron 00:30)는 이 PC의 **로컬 Ollama**(`localhost:11434`, 기본 바인딩)로 exaone3.5:7.8b를 돌린다. 정책은 단순하다 — **생각 데이터는 어떤 외부 API로도 보내지 않는다.** 그래서 클라우드 추론은 쓰지 않고, Ollama는 네트워크에 노출하지 않는다.

> **철회 기록 (#63)**: 철학 정보 탭(브라우저→Ollama 문답 + 한↔영 통역)과 그를 위한 tailnet 노출(`tailscale serve :8443`, `OLLAMA_HOST` tailscale IP 바인딩, CORS, Vercel `NEXT_PUBLIC_OLLAMA_URL`)은 2026-08-24 당일 도입·철회했다. 구성과 근거는 git 히스토리에 보존(커밋 505629d 시점의 §16.11). 브라우저에서 Ollama를 다시 부를 일이 생기면 그 기록대로 재구성하면 된다.

### 16.12 Notion 백업 미러 (#64 → 백업 형태로 개편 2026-08-26)

앱 데이터를 **혹시 모를 백업 사본**으로 Notion에 미러한다 — 앱이 원본, 단방향(Notion 쪽 수정·삭제는 앱에 안 돌아온다). 활동 한 줄 append 방식(#64 원안)은 폐기하고 상태 미러로 바꿨다: activity 이벤트 나열보다 "책 1권 = 페이지 1장"이 백업으로서 복원 가치가 있다.

```
집 PC cron 00:40(UTC, =KST 09:40) → node --env-file=.env scripts/sync-notion-backup.mjs
  ① 책 여정 백업 DB — 페이지 = 책 1권. 저자·출판사·태그·여정 번호·회독·완독일·별점은
     속성으로, 노트·완독 기록·감상(reflection)은 본문 블록으로 upsert (book_id가 키)
  ② 단어 대시보드 DB — 언어×날짜 1행 (복습·정답·정답률). review_log에서 daily_stats
     RPC(tz=Asia/Seoul)로 집계 — 오늘(KST)은 확정 전이라 제외, 지난 날짜는 값 변경 시 갱신
```

| 항목 | 값 | 이유 |
|---|---|---|
| 커서 | 없음 — 매 실행 전체 상태 수렴 (책은 sync_hash로 무변경 스킵) | append 커서(activity_id)의 "한 번 보내면 끝" 박제 문제 제거 |
| 하루 경계 | 스크립트가 KST(Asia/Seoul)로 직접 계산 | 집 PC는 UTC — 시스템 타임존에 기대면 경계가 9시간 어긋난다 |
| 삭제 | 반영 안 함 | 백업이므로 앱에서 지워도 사본은 남긴다 |
| thought | 다루지 않음 | 생각 데이터 외부 반출 금지(§16.11) |
| Notion 구조 | 기존 LSHobby DB 안의 "📦 LSHobby 백업" 페이지 아래 인라인 DB 2개 | integration이 접근 가능한 유일한 컨테이너 (API는 워크스페이스 루트에 DB 생성 불가) |
| 비밀 | `.env`의 `NOTION_TOKEN`·`NOTION_BOOK_DB_ID`·`NOTION_WORD_DB_ID` | (구 `NOTION_DB_ID`는 활동 DB — 부모 페이지 생성 시에만 쓰였다) |
| 실패 정책 | 로그만(`~/.local/state/lshobby-notion-backup.log`), 알림 없음 | PC 꺼짐·Notion 장애는 다음 실행이 따라잡는다 (#45와 같은 1인 규모 판단) |

구 활동 미러의 행들은 Notion에 그대로 남아 있다(삭제는 수동). 백업 DB를 Notion에서 다른 위치로 옮기면 integration 공유가 끊길 수 있다 — 옮긴 뒤에는 해당 페이지에 integration을 다시 연결해야 한다.

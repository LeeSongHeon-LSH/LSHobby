> LSHobby 설계 문서 — 목차·로드맵·§번호↔파일 매핑은 [README](README.md) 참조

## 18. 정기 보안 점검 — 체크리스트·잔여 관찰·기록 (2026-09-08 신설, #88)

§12.4의 SEC-01~08은 **요구**이고, §12.6은 **프로젝트 생성 직후 1회** 체크리스트다. 이 문서는 그 둘을 **운영 중 반복 검증**으로 잇는다 — 무엇을, 어떻게, 언제 다시 확인하는지와 그 결과의 누적 기록. 요구가 바뀌면 §12.4를, 점검 결과는 여기 §18.4를 고친다.

### 18.1 주기와 트리거

| 언제 | 무엇을 |
|---|---|
| **분기 1회** (다음: 2026-12) | §18.2 전 항목. 방법은 `/security-review`(코드 전수 + 오탐 필터) 후 결과를 §18.4에 한 줄 |
| **마이그레이션 추가** (새 표·함수·정책) | C·B — 새 표에 RLS + `authenticated_all`이 붙었는지, anon REST 거부가 유지되는지 |
| **`src/app/api/` 라우트 추가·변경** | D — Bearer 검사, 호출자 JWT 클라이언트, 경로 파라미터 허용목록 |
| **외부 호출 추가** (fetch 대상·스크립트 비밀) | F·H — 호스트 상수 고정, 비밀은 `.env`·systemd `--env-file` 경로만 |
| **Supabase 대시보드 설정을 건드린 날** | A — 가입 차단이 여전히 off인지 그 자리에서 재확인 |
| **주요 의존성 업그레이드** (next·supabase-js·react-markdown·rehype-sanitize) | E·K |

### 18.2 체크리스트

자동 항목은 `npm test`의 `src/security.test.ts`가 CI에서 매 푸시 검사한다. 나머지는 손으로 — 명령은 리포 루트 기준.

| # | 항목 | 확인 방법 | 기대 결과 | 자동 |
|---|---|---|---|---|
| A | **가입 차단 (SEC-01)** — 호스티드 프로젝트 | Supabase 대시보드 → Authentication → Sign In / Providers → "Allow new users to sign up" | **off**. `supabase/config.toml`의 `enable_signup = false`는 **로컬 스택에만** 적용되므로 리포로는 검증 불가 | ✗ |
| B | **anon 전부 거부 (SEC-02)** — 실동작 | `curl -s "$URL/rest/v1/thought?select=id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"` (`$URL`·`$ANON`은 `.env`의 `NEXT_PUBLIC_*`). RPC도 하나: `curl -s -X POST "$URL/rest/v1/rpc/es_word_stats" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"` | 표는 `[]`, RPC도 빈 결과 — 행이 하나라도 오면 정책 누락 | ✗ |
| C | **RLS 형상 (SEC-02)** — 마이그레이션 | `grep -nE "create table\|enable row level security\|create policy\|to anon\|security definer\|^grant" supabase/migrations/*.sql` | 살아 있는 표마다 RLS enable + `authenticated_all`. `to anon`·`security definer`·`grant`는 **0건**(2026-09-08 기준 anon 정책은 drop된 `cv_document` 것뿐). 새 표는 §9 DDL 규약대로 `do $$ ... loop` 블록에 넣는다 | ✗ |
| D | **API 라우트 인증** | `ls src/app/api/**/route.ts` 후 각 파일 | ① `Authorization: Bearer` 없으면 401 ② DB는 `serverClientWithToken(token)`(anon key + 호출자 JWT → RLS가 호출자 권한으로 평가) ③ 경로 파라미터는 허용목록(`configFor`)·정수 검사 ④ `service_role` 사용 없음 ⑤ 표 이름은 config 객체에서만 | 부분(④는 테스트) |
| E | **XSS 표면 (SEC-05)** | `grep -rnE "dangerouslySetInnerHTML\|innerHTML\|eval\(\|javascript:" src/` · `src/modules/shared/markdown/index.tsx`가 `rehype-sanitize`를 유지하는지 · `href`에 데이터가 들어가는 곳이 없는지 | grep 0건. 마크다운 렌더는 그 파일 하나뿐(`book.note`). LLM 출력·Tatoeba 응답·사용자 입력은 전부 React 텍스트 노드 | 부분(`shared.test.tsx`가 sanitize 검증) |
| F | **외부 호출 호스트 고정 (SSRF)** | `grep -rn "fetch(" src/ scripts/` | 호스트는 상수(Tatoeba `tatoeba.ts`, Ollama `localhost:11434`, Gemini·Notion SDK). 사용자·DB 데이터는 쿼리 파라미터·본문에만 | ✗ |
| G | **필터 문자열 조립 (PostgREST 주입)** | `grep -rnE "\.or\(\|\.filter\([\"'\]\|ilike\|\.contains\(\|\.containedBy\(" src/` | `.or()`/`.filter()`에 문자열 조립 없음. `ilike`는 `thought/service.ts`뿐이고 `\ % _`를 먼저 이스케이프. `.contains()`도 같은 파일 1곳 — supabase-js는 `cs.{a,b}`로 **이스케이프 없이** 이어 붙이므로(postgrest-js) `arrayLiteralElement`로 원소를 인용해 넘긴다. `.in()`은 라이브러리가 예약문자를 인용하므로 제외. DOM `Node.contains`도 같이 걸리니 눈으로 거른다. **`.contains(`는 2026-09-11에 이 grep에 들어왔다** — 그전 패턴은 이 경로를 안 봐서 09-08 회차의 G 통과는 인용 없는 `.contains("topics", [query])`를 지나쳤다(쉼표가 원소 경계를 바꾸고 `}`는 400) | ✗ |
| H | **키·비밀 (SEC-03)** | `git ls-files \| grep -E '^\.env'` · `grep -rnE "SERVICE_ROLE\|GEMINI_API_KEY\|NOTION_TOKEN" src/ scripts/` | 추적 파일 0건. 세 비밀은 `scripts/*.mjs`에서만, systemd 유닛 `--env-file=.env`로 주입. `src/`에는 `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`만 | ✓ (`src/` 한정) |
| I | **서비스 워커 캐시** | `public/sw.js` | 동일 출처 `/_next/static/`·`/icons/` GET만. API·페이지 응답 캐시 없음 | ✗ |
| J | **배치·셸 입력원** (`scripts/`, `scripts/systemd/`) | 각 스크립트의 변수가 어디서 오는지 | `backup-db.sh`의 동적 SQL은 `format('%L','%I')`, 접속 정보는 `.env`·`~/.lshobby/db-password`. `deploy-local.sh` 변수는 git SHA·`gh api`. `lshobby-alert@.service`의 `%i`는 systemd가 넣는 유닛명. 외부 데이터(Notion·Gemini·Ollama 응답)가 셸·SQL 문자열로 들어가는 자리 없음 | ✗ |
| K | **의존성 취약점** | `npm audit --audit-level=high` | high 이상 0건. 있으면 업그레이드 후 E·D 재확인 | ✗ |
| L | **보안 헤더 (SEC-06)** | `next.config.ts headers()` | nosniff · Referrer-Policy · X-Frame-Options DENY | ✓ |

### 18.3 잔여 관찰 사항 (취약점 아님 — 추적만)

점검에서 나왔지만 §12.4 기준으로 **취약점이 아니거나 비채택(SEC-07) 범위**라 findings로 올리지 않은 것. 상태가 바뀌면 여기서 고친다.

| # | 항목 | 상태 | 처리 방향 |
|---|---|---|---|
| R1 | **SEC-01은 코드가 아니라 호스티드 설정** — 리포·CI로 검증 불가. 이 스위치 하나가 켜지면 "authenticated 전부 허용" RLS 모델이 통째로 무너진다 | 열림 (매회) | 체크리스트 A를 절대 건너뛰지 않는다. 대시보드를 만진 날은 그 자리에서 재확인 |
| R2 | **로컬 config의 약한 비밀번호 정책** — `supabase/config.toml` `minimum_password_length = 6`, `password_requirements = ""`. Auth 엔드포인트는 인터넷 노출이라 단일 계정 무차별 대입이 남는 위험 | 보류 | 레이트리밋·2FA는 SEC-07 비채택. 대신 **호스티드 계정 비밀번호를 길게** 유지(config는 로컬 전용이라 프로덕션과 무관) |
| R3 | **`scripts/gen-db-types.sh`가 DB 비밀번호를 `postgresql://` URL로 CLI 인자에 넘김** — 실행 중 `ps`에 노출 | 보류 | 1인 PC·수 초 실행이라 실익 낮음. `supabase gen types --db-url`이 URL 전체를 요구해 우회 수단도 마땅치 않음 |
| R4 | **`.env` 잔여 키** — `VERCEL_OIDC_TOKEN`·`SUPABASE_SECRET_KEY`·`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (§16.4 정리 대상) | 열림 | 코드 참조 없음 확인 후 제거. `SUPABASE_SECRET_KEY`는 이름상 service_role급이라 우선 정리 |

### 18.4 점검 기록

한 회차 = 한 블록. 날짜 · 대상 커밋 · 방법 · 결과(HIGH/MEDIUM 건수) · 체크리스트 통과 항목 · 새로 연 잔여 항목.

**2026-09-08** — `main` @ `5059119` · `/security-review`(발견 서브태스크 + 오탐 필터) · 범위는 diff가 없어 코드 전수(최근 15커밋 중점: 예문 API·퀴즈·생각 다이제스트·Notion 백업·systemd 타이머·DB 타입 생성·마이그레이션 전부)

- **결과: HIGH 0 · MEDIUM 0.** 신뢰도 0.8 이상 후보가 없어 오탐 필터 단계에 넘긴 항목 없음
- 통과: C(표 17개 전부 RLS + `authenticated_all`, anon 정책·grant·security definer 0건 — RPC 4종은 invoker, `tz`는 파라미터 바인딩) · D(`/api/sentence/[lang]/[wordId]` 하나뿐, ①~⑤ 전부 충족) · E(grep 0건, 마크다운 렌더 1곳 sanitize) · F(Tatoeba·Ollama 호스트 상수) · G(`ilike` 1곳 이스케이프) · H(추적 `.env` 0건, `src/` 비밀 참조 0건) · I · J · L
- 이번에 손으로 하지 않은 것: **A(대시보드)·B(anon curl)·K(npm audit)** — 코드 리뷰 범위 밖. 다음 회차(또는 대시보드를 만지는 날)에 A·B 먼저
- 새로 연 잔여: R1~R4 (§18.3)
- 직전 기록: 2026-08-20 보안·성능 리뷰 = 취약점 0건 (#62 ⑤). 그 사이 바뀐 표면 — CV 분리로 anon SELECT 예외 해소(#73), 로컬 호스팅 전환(테일넷 전용), 생각 세션·LLM 출력 저장(#67~), Notion·Gemini 비밀 추가, API 라우트 신설 — 전부 이번 범위에 포함

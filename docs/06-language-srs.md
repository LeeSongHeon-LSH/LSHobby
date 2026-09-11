> LSHobby 설계 문서 — 목차·로드맵·§번호↔파일 매핑은 [README](README.md) 참조

## 6. 언어 모듈 설계 — 확정 (2026-08-14)

> **개정 (2026-09-02, 코드 대조)**: §6.2 채점 규칙을 코드(`grading.ts`·`display.ts`)대로 구체화 — 콤마 동의어·공백·방향별 관대 비교·제시문 두 뜻(#79)·빈칸 단어 경계(#76), 언어 config 구성 요소 갱신. §6.3 출제 순서는 #82.

### 6.1 기존 스페인어 웹앱 구조 (파악 완료)

- **스택**: FastAPI + 단일 `index.html`(바닐라 JS) + SQLite(`spanish.db`), PWA(sw.js), 인증 없음(Tailscale 사설망 = 인증)
- **기능**: 단어 CRUD, SRS 퀴즈(Leitner 5박스 + 하루 새 단어 20개 한도 + 오답률 가중 출제), 어려운 단어 집중 모드, Tatoeba 예문 cloze, 통계/스트릭, CSV export
- **데이터**: 시드 218단어만 존재, 학습 이력(attempts) 0건 → **마이그레이션 부담 사실상 없음** (시드 이식이 전부)
- **배포**: systemd user 서비스 + 2분 타이머 CD + Tailscale https

### 6.2 언어 구조 — B안 확정 (언어별 테이블 + 공용 엔진)

- **단일 Supabase 프로젝트** 안에서 언어별 테이블(`es_words`, `en_words`, …). DB 인스턴스는 하나 — 언어 추가 비용 0원
- 각 테이블이 **자기 SRS 컬럼을 보유** (공용 review_state 테이블 없음 — reflection에서 지적한 다형 참조 문제를 언어 모듈 안에 또 만들지 않음)
- 퀴즈/SRS/통계 로직은 **코드 레벨 공용 엔진 한 벌**. 언어 추가 = 테이블 1개 + config 등록
- 언어 config는 **코드 객체**(`LanguageConfig` — 단어·리뷰로그·예문·fetch 테이블명, 집계 RPC명 `wordStatsFn`/`dailyStatsFn`, `normalize`, `gradeLenient`, `hasGender`, Tatoeba 언어코드·번역 우선순위, `speechLang`, 입력 보조 `accentChars`/`altKeyMap`) — DB에 언어 메타 테이블 없음
- **중복차단(norm)**: 스페인어 = 모음 악센트 제거·ñ 유지·trim·소문자 / 영어 = trim·소문자. **앞뒤 공백만** 무시한다
- **채점** (`gradeAnswer`, 언어 공통 — 언어별 차이는 config의 `gradeLenient`뿐):
  - 입력·정답 모두 소문자화 + **모든 공백 제거** 후 비교 ("일 하다" = "일하다") — norm과 달리 내부 공백도 무시
  - 뜻은 **콤마 구분 동의어 목록** ("나라, 국가") — 각 항목이 전부 정답이고, 콤마째 전체 문자열도 정답. 동의어는 Gemini 제안 → 사람 검수 → 반영 배치로 채운다(#79)
  - **관대 비교(스페인어 모음 악센트)는 대상 언어를 입력하는 방향(한→스, 빈칸)에만** 적용. 뜻을 입력하는 방향(스→한)은 정확 일치만. 영어는 `gradeLenient` 없음
  - **제시문의 뜻은 앞의 두 개까지만**(`promptMeaning`, #79) — 동의어가 길어지면 한→대상 제시문이 힌트 덩어리가 된다. 채점·정답 공개 화면은 전체를 쓴다
  - **빈칸 위치는 유니코드 단어 경계**로 찾는다(`clozeIndex`, #76) — "Solo quiero sol"의 sol을 Solo 안에서 잡지 않고, á·ñ도 단어의 일부
- `gender`(el/la) 같은 특수 필드는 해당 언어 테이블에만 존재

### 6.3 SRS — FSRS 확정 (Leitner 폐기)

- **FSRS** (`ts-fsrs` 라이브러리). 단어당 stability, difficulty, due, state 저장
- **평가 입력**: 타이핑 자동 채점 → 정답=Good, 오답=Again 이분 매핑. 자가평가 버튼 없음 (추후 정답 시 Hard/Easy 버튼 추가 여지)
- **출제 순서** (`session.practiceOrder`, 2026-09-02 개편): ① due 지난 복습과 신규를 1:1로 교대 → ② 아직 due 아닌 것.
  복습 구간은 정답률 오름차순 → 오래 안 본 순 → 랜덤, 신규는 등록 순. 한쪽이 바닥나면 남은 쪽을 이어 낸다.
  (2026-08-31안은 복습 전부 → 신규였으나, 오답이 1분·10분 뒤 due로 잡혀 세션마다 앞을 채우는 바람에
  신규를 못 만났다. 정답률이 떨어지더라도 새 단어를 만나는 쪽을 택했다.)
  한 바퀴가 전체 단어라 한 세션에서 같은 단어를 두 번 만나지 않고, 그래서 FSRS가 한 답에 한 번만 반영된다
- 구 앱의 **새 카드 일일 한도(20개)·어려운 단어 집중 모드는 폐기** (2026-08-31). 모드는 하나이고 끝은 사용자가
  종료 버튼으로 정한다. 어려운 단어는 정답률 오름차순에 흡수됐다
- §5.2 재검토 결과: **홈 복습 배지 없음** (원안 유지)

### 6.4 activity_feed 발행 단위

- 단어 추가: **건별** 이벤트
- 학습(복습): **일별 요약 1건** ("단어 12개 복습, 정답률 83%" — 당일 재학습 시 갱신)

### 6.5 전환 전략 — 빅뱅 교체

- Next.js로 재작성 **완성 후 한 번에 교체**. 완성까지 기존 앱 계속 운영
- **컷오버 기준** (전부 Vercel에서 동작 확인):
  단어 CRUD / FSRS 퀴즈 / Tatoeba cloze / 통계·스트릭 / CSV export / 시드 218단어 이식 / Supabase Auth(본인 1계정) / PWA 설치
  + 허브·activity_feed·reflection **골격 포함**, 언어 세션만 채운 상태로 출시
- **영어·책·CS 모듈은 컷오버 이후** 확장
- **컷오버 시 정리**: 파이썬 파일 전부 삭제(git 히스토리 보존), systemd 유닛 3종 해제·삭제, pytest GitHub Actions 제거, `spanish.db`는 파일 백업만 유지
- **UI 전면 재디자인** — azulejo 컨셉 폐기 (언어가 늘어나므로 스페인어 특화 자산을 남기지 않음). ~~컷오버 범위~~ → **전 기능 구현 후 1회로 조정** (#48, 2026-08-15)
- **PWA**: 설치형 최소(manifest + 기본 캐싱), 오프라인 퀴즈 없음 — 실사용에서 필요해지면 재검토
- **테스트**: vitest 단위 테스트(SRS 엔진·채점 규칙 위주), e2e는 초기 생략

### 6.6 이후 로드맵

1. ~~언어 모듈 상세 설계~~ ✅ (본 §6)
2. ~~책 모듈 상세 설계~~ ✅ (§7)
3. ~~CS 모듈 상세 설계~~ ✅ (§8)
4. ~~전체 ERD 통합 및 DDL 작성~~ ✅ (§9)
5. ~~화면 와이어프레임 (모바일 우선)~~ ✅ (§11)
6. ~~요구사항 명세(SRS) — 보안·백업 확정~~ ✅ (§12)
7. ~~프로젝트 초기 세팅 — Supabase(스키마·§12.6 체크리스트 통과)·Next.js·Vercel 자동 배포~~ ✅ (§16)
8. ~~언어 모듈 구현 — config·FSRS·CRUD·퀴즈·통계·CSV·Tatoeba·시드 218·PWA~~ ✅
9. ~~스페인어 컷오버 — 구 앱·systemd·CI 정리~~ ✅ (2026-08-15, 재디자인은 #48로 분리)
10. ~~책 모듈 구현 (§7)~~ ✅ (2026-08-15)
11. ~~CS 모듈 구현 (§8)~~ ✅ (2026-08-15)
12. ~~CV 공개 페이지 구현 (§17)~~ ✅ (2026-08-18)
13. ~~영어 확장 — enConfig·en_* 4테이블·언어 전환 ▾~~ ✅ (2026-08-18, #54)
14. ~~UI 전면 재디자인 1회 (#48 — 4등분 홈·CV 디자인 포함, #53)~~ ✅ (2026-08-18, 디자인 시스템 #55)
15. ~~비어 있어서 위험한 것 셋 — DB 백업 자동화(NFR-04)·배치 실패 알림·CI 타입 검사~~ ✅ (2026-09-06, #86 · §16.14)
16. ~~DB 인터페이스 = Supabase 생성 타입 — 손으로 쓴 행 인터페이스·`as X[]` 캐스트 제거, 표 목록 드리프트 테스트~~ ✅ (2026-09-06, #87)

**남은 고도화 후보** (2026-09-06 전수 점검, 우선순위순 — 각각 "언제 하는가"가 조건):
17. **FSRS 개인 파라미터 최적화** — `srs.ts`가 기본 파라미터(`fsrs()`)를 쓰고 있고 `es_review_log`·`en_review_log`에 이력이 쌓여 있다. 집 PC 배치(`scripts/`)로 최적화기를 돌려 파라미터를 뽑고, **예측 회상률 vs 실제 정답의 차이**(log-loss·보정 곡선)로 개선을 측정. 검증 가능한 목표가 있어 다음 본격 과제. 조건: 리뷰 로그 수천 건(지금 확인 필요)
18. **닮은 생각 연결** — 로컬 임베딩(Ollama 임베딩 모델) + pgvector, 하루 시트 안에 "닮은 날" 한 줄. 외부 반출 금지 경계(§16.11) 안에서 됨. 조건: 생각 몇 달치(#84 되돌아볼 신호와 함께 재논의)
19. **화면 스모크 테스트** — 이 PC의 헤드리스 Chrome으로 로그인 → 퀴즈 한 바퀴 → 생각 기록을 돌리고, `deploy-local.sh`의 교체 직전에 끼운다. #76(Enter 한 번에 채점 화면 건너뜀)이 손으로 잡혔던 회귀 — 재발 방지. 조건: 없음, 언제든
20. **서버 컴포넌트 전환** — 페이지 11개 중 10개가 `use client`라 인증 확인 → 브라우저 쿼리의 순차 대기가 매 진입마다 생긴다. 인증 경로까지 건드리는 리팩토링. 조건: 테일넷 1인 사용에서 그 지연이 실제로 거슬릴 때만

**남은 코드 리뷰 지적** (2026-09-11 `/code-review max` 전수 리뷰 15건 중 **6건은 #93·#94로 처리**했다. 아래 표는 남은 9건 + 리뷰가 다음 티어로 분류한 `stats.ts` 1건 — 전부 재현 경로까지 확인됐고 `eslint`·`tsc`·`vitest` 어느 것도 잡지 못한다):

| 자리 | 증상 |
|---|---|
| `scripts/deploy-local.sh:160` | 헬스체크가 `BUILD_ID`를 이스케이프 없이 grep 패턴으로 넘긴다. nanoid 알파벳에 `-`가 있어 **64회에 1회** BUILD_ID가 `-`로 시작 → grep이 인자로 해석해 실패 → 멀쩡한 빌드를 롤백하고 그 sha를 `blocked`로 박아 새 커밋 전까지 재시도조차 안 한다. `grep -q -- "$build_id"` |
| `scripts/digest-thoughts.mjs:131` | 전체 thought를 `.range()` 없이 읽어 PostgREST 1000행 상한(`supabase/config.toml:18`)에 걸린다. 1000번째 메모 이후로는 이미 처리된 옛 날짜만 보여 "처리할 날이 없습니다"를 찍고 **exit 0** — `OnFailure` 알림이 안 울리고 `last-ok` 도장까지 찍혀 실패가 완전히 안 보인다. `review-stats.ts:13`·#62가 같은 함정을 이미 기록 |
| `src/app/language/quiz/page.tsx:152` | 채점이 세션 시작 시점의 `Word` 스냅샷을 쓴다. `practiceOrder`가 같은 객체로 새 바퀴를 시작하므로(line 77) 2바퀴째에도 `state === New`라 `createEmptyCard`가 다시 돌아 1바퀴 답이 지워진다. 덱이 작을수록(20문제·8단어) 확실히 발생 |
| `src/modules/thought/service.ts:68` | `.contains("topics", [query])`가 검색어를 PostgREST 배열 리터럴에 따옴표 없이 박는다. 쉼표는 의미를 바꾸고(`AI, 설계` → 두 원소), `}`·`"`는 400 → throw → 병렬로 성공한 본문 검색 결과까지 버려져 "없음"으로 보인다. docs/18 §G의 주입 grep이 `.contains(`를 안 본다 |
| `src/app/library/book-sheet.tsx:104` | `try/finally`에 catch가 없다. `deleteBook`은 `removeThread`(감상 전체 캐스케이드 삭제) → `removeTaggings` → 본체 삭제 순인데 마지막이 실패하면 책은 남고 **생각 타임라인만 영구 소실**되며 화면엔 아무 메시지도 없다. `record/page.tsx:74·92`도 같은 모양이라 재탭 시 중복 회독·중복 책 |
| `src/app/language/quiz/page.tsx:98` | `finish()`가 장식용 요약 RPC를 catch 없이 await → 실패하면 `setPhase("done")`에 도달 못 해 **종료 버튼이 영구 무반응**. 큐 소진 시에도 같은 경로라 마지막 카드에 갇힌다. `language/page.tsx:37`엔 있는 guard가 여기만 빠졌다 |
| `src/app/language/words/page.tsx:59` | `updateWord`에 `addWord`의 중복 가드가 없고 호출부에 catch가 없다. `norm`이 UNIQUE라 `paiz`→`pais` 편집이 23505로 거부되면 시트가 열린 채 아무 표시가 없어 **저장된 줄 안다** |
| `src/app/language/stats/page.tsx:42` | CSV 내보내기가 document에 안 붙인 anchor를 클릭하고 같은 틱에 `revokeObjectURL`. standalone PWA(모바일 주 타깃)에선 아무 일도 안 일어난다 |
| `scripts/backfill-sentences.mjs:270` | "이미 예문 있음" 집합도 1000행 상한에 잘린다(시드 300단어 × 3 = 900행이라 ~34단어만 더 채우면 초과). 유일 키가 없고 plain insert라 **같은 문장이 매 실행 중복 적재**되고 Gemini·Tatoeba 예산을 다시 태운다. line 245는 미번역 전체를 `translateBatch`에 한 번에 보내 `out.length !== items.length`로 거의 매번 버려진다 |
| `src/modules/language/stats.ts` | `review_stats_fns.sql`의 RPC 4개는 1000행 상한을 피하려 만든 건데 PostgREST는 집합 반환 함수에도 `db-max-rows`를 적용한다. `es_daily_stats`가 오름차순이라 잘리면 **최신 날짜부터** 사라진다 (잠복, 약 2.7년 뒤) |

**테스트 가드 두 곳이 못 잡는다** — 위 결함들이 green으로 통과하는 이유이므로 먼저 볼 값이 있다.
- `src/modules/shared/shared.test.tsx:24` — supabase mock이 `select`가 든 체인이면 필터 인자를 안 보고 `selectData`를 돌려준다. `upsertDaily`에서 `.eq("action", …).gte(…).lt(…)`를 통째로 지워도 7개 테스트가 전부 통과 — "일별 1건" 규칙을 지키는 유일한 describe가 그 규칙의 제거를 감지 못 한다
- `src/design.test.ts:124` — `@media` 블록을 걷어낸 뒤 애니메이션 선택자를 모으므로 미디어 쿼리 안의 애니메이션은 reduced-motion 불변식에서 면제된다(프로브를 넣어도 전부 통과). line 72의 `walk("src/app")`은 `src/modules/**`를 안 봐서 유일한 잔존 #91 위반(`ReflectionBlock.tsx:66`의 `font-mono text-[11px]`)을 놓친다

그 밖(재현되나 영향이 작음): `registry.ts:8` `configFor("constructor")`가 `Object`를 돌려줘 API 라우트 `[lang]` 허용목록을 우회 · `thought/service.ts:57` ilike 이스케이프가 `*` 누락(PostgREST가 `%`로 별칭) · `ReflectionBlock.tsx:32`의 "N회독" 자동 입력이 `useState` 초기값으로만 읽혀 한 번도 동작한 적 없음 · `words/page.tsx:46`이 `w.word`만 소문자화하지 않아 대문자 단어 검색 불가 · `thoughts/page.tsx:238` 디바운스 검색에 `cancelled` 가드 누락 · `public/sw.js`가 `02584ca`(글꼴 교체) 뒤에도 `lshobby-static-v1`(#92 수칙 위반) · `activity/service.ts:48` select-then-insert 경합 · `library/page.tsx:106`이 조회 실패를 "빈 서재"로 표시 · `home/page.tsx:177` 설정 배경을 탭해 닫아도 `pwOpen`과 비밀번호 입력이 남음 · BookSheet가 DaySheet 복사본인데 `role="dialog"`·`aria-modal`·Esc를 빠뜨림 · 어떤 `<label>`에도 `htmlFor`가 없음 · 죽은 코드 `getFeed`·`PixelFlame`·`shared/search/index.ts`·`aggregate`·`loadDeck`의 `due`

같은 리뷰에서 **깨끗하다고 확인된 것**: 전 마이그레이션에서 RLS 활성 + 표마다 정책, `.env` 커밋 이력 없음, markdown sanitize, 보안 헤더, CV 마스코트 로그인 이스터에그(§17.6), i18n leaf-path 대칭, systemd 유닛, `prefers-reduced-motion` CSS 블록.

하지 않기로 한 것: 오프라인 퀴즈(FR-40 비채택), 큐·관측 스택·서버리스 이전(1인 규모에서 얻는 게 없다).


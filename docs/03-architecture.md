> LSHobby 설계 문서 — 목차·로드맵·§번호↔파일 매핑은 [README](README.md) 참조

> **개정 (2026-09-02, 코드 대조)**: `thought` 도메인 모듈·`shared/markdown` 추가, `app/` 트리를 실제 라우트대로, `search/`는 빈 스텁 표시, §3.4 규칙의 알려진 예외 2건 기록(#83).
> **개정 (2026-08-20, 결정 #57~61 반영 완료)**: CS 세션 제거 · 인용구 삭제가 코드(커밋 6246582~)와 DB(마이그레이션 20260820090000 · 20260820100000)에 모두 반영됐다. 본문은 현행 상태로 개정됨 — CS/quote 관련 폐기 항목은 사료 표시.

## 3. 아키텍처 (확정) — Modular Monolith

### 3.1 MSA를 선택하지 않은 이유

| MSA가 필요한 조건 | 본 프로젝트 |
|---|---|
| 팀이 여럿, 독립 배포 필요 | 1인 개발 ❌ |
| 서비스별 스케일 요구가 다름 | 사용자 = 본인 1명 ❌ |
| 기술 스택을 다르게 가져가야 함 | 전부 Next.js ❌ |
| 장애 격리가 중요 | 취미 프로젝트 ❌ |

추가로, 세 도메인의 **경계가 흐릿함**이 결정적이다.
"스페인어 원서를 읽고 정리했다" = 책이자 언어 학습.
MSA로 쪼개면 이런 교차 케이스마다 서비스 간 조인이 필요해지지만,
모듈러 모놀리스에서는 DB 조인 한 줄로 끝난다.

> **결론: Modular Monolith. 단, 모듈 경계는 MSA 수준으로 엄격하게 유지.**
> 나중에 필요하면 모듈 하나를 서비스로 승격할 수 있도록 지금부터 경계를 지킨다.

### 3.2 디렉터리 구조

```
src/
├── modules/
│   ├── library/          # 책 — books.ts(CRUD·회독·노트) + journey.ts(독서 여정 책장 계산)
│   ├── language/         # 언어 — config 주입(es/en), srs·session·answer·grading·stats·sentences
│   ├── thought/          # 생각 세션 (2026-08-21~) — append-only 스트림, 다이제스트는 읽기만
│   └── shared/
│       ├── reflection/   # ★ 생각 기록 타임라인 (핵심) — 렌더 블록 포함
│       ├── activity/     # 활동 피드 (앱 화면 소비처 없음 — 배치가 읽는다, §15.6-4)
│       ├── tag/
│       ├── markdown/     # 마크다운 렌더 (sanitize, SEC-05)
│       ├── search/       # 빈 스텁 (export {}) — 검색은 도메인별 구현
│       └── auth/         # 클라이언트 + AuthGuard + 서버 라우트용 client
└── app/
    ├── page.tsx          # 입구(/) — 마스코트 → 로그인, 세션 있으면 /home
    ├── login/
    ├── home/             # 통합 홈 (허브, 서랍 3개)
    ├── library/          # 세션별 전용 공간 (+ record/)
    ├── language/         # (+ add/ quiz/ stats/ words/)
    ├── thoughts/
    ├── api/sentence/     # Tatoeba 수집 서버 라우트
    ├── ui/               # 공용 UI — pixel(도트 스프라이트)·scene·tab-bar·home-button·icons
    ├── manifest.ts · sw-register.tsx   # PWA
    └── layout.tsx
```

> 공개 CV(§17)는 2026-08-30 별도 리포로 분리됐다 — `cv` 모듈·`app/cv/`는 더 이상 없다.

### 3.3 계층 구조

```
┌─────────────────────────────────────────────┐
│  library   │  language   │  thought          │  ← 도메인 모듈
└──────┬─────┴──────┬──────┴──────┬────────────┘
       │            │             │
       └────────────┴─────────────┤
                                  ▼
        ┌───────────────────────────────┐
        │  shared                        │
        │  ├── reflection (생각 타임라인) │  ← 핵심
        │  ├── activity   (활동 피드)     │
        │  ├── tag / markdown / auth     │
        │  └── search (빈 스텁)          │
        └───────────────────────────────┘
```

### 3.4 모듈 경계 규칙 (아키텍처 침식 방지)

1. **모듈 간 직접 import 금지** — 공개 인터페이스(`index.ts`)를 통해서만 접근
2. **각 모듈은 자기 테이블만 소유** — 타 모듈 테이블 직접 쿼리 금지
3. **모듈 간 통신은 이벤트 발행으로** — `shared/activity`가 수신
4. 공통 관심사(reflection, tag, search)는 `shared`에 위치
5. 도메인 모듈은 `shared`에 의존 가능, **역방향 의존 금지**

> 이 규칙들은 향후 정적 검사(import 경로 lint 규칙 등)로 강제하는 것을 검토.

**알려진 예외** (2026-09-02 대조에서 발견, #83 — 코드 수정 대기):
- 규칙 1 위반: `app/api/sentence/[lang]/[wordId]/route.ts`가 `modules/language/tatoeba`를 직접 import한다(`fetchFromTatoeba`가 `index.ts`에 미노출). 해법은 재노출 한 줄
- 규칙 2 위반: `modules/language/words.ts`의 `deleteWord`가 shared 소유 `reflection_thread`를 직접 select/delete한다. 같은 일을 하는 공개 API `removeThread`가 있고 library는 그걸 쓴다


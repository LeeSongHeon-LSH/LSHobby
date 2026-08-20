> LSHobby 설계 문서 — 목차·로드맵·§번호↔파일 매핑은 [README](README.md) 참조

> **개정 (2026-08-20, 결정 #57~59)**: CS 세션 제거 · 인용구 삭제 · 책 세션 = 독서 여정 책장(탭바 없음) · 탭바 [홈] 슬롯 폐지 — 14.1·14.5·14.7 반영, 14.6은 사료.

## 14. 흐름도 (Flow Diagram) — 확정 (2026-08-14)

주요 사용자 흐름과 데이터 흐름을 mermaid로 고정한다. 화면 요소의 원본은 §11, 규칙의 원본은 §12 — 여기서는 **분기와 부수효과(어느 테이블이 언제 쓰이는가)**를 드러내는 것이 목적이다.

### 14.1 전체 내비게이션 맵

```mermaid
flowchart LR
    L[로그인] --> H[홈 허브]
    H --> LA["언어 세션<br/>탭: 학습·단어장·통계·추가<br/>우상단 홈 버튼"]
    H --> LI["책 세션<br/>독서 여정 책장 — 탭바 없음<br/>우상단 홈 버튼"]
    LA -- 시작하기 --> QZ[퀴즈]
    LI -- 책등 탭 --> JB["펼친 책 (제N보)"]
    JB -- 자세히보기 --> BS["회독 기록 시트"]
```

- 세션 간 직접 이동 없음 — 항상 홈 경유(우상단 홈 버튼, #59). 상세·편집은 푸시 화면
- 홈 타임라인은 #53에서 제거 — activity_feed 발행 규약은 유지(§5.3)

### 14.2 인증

```mermaid
flowchart TD
    A[앱 진입] --> B{Supabase 세션 유효?}
    B -- 예 --> H[홈]
    B -- 아니오 --> L[로그인 화면]
    L --> C{Auth 인증}
    C -- 성공 --> H
    C -- 실패 --> L
```

- 회원가입·비밀번호 찾기 경로 없음 — 가입은 서버에서 차단(SEC-01), 분실 복구는 앱 밖 런북(SEC-08)

### 14.3 복습 퀴즈 (핵심 루프)

```mermaid
sequenceDiagram
    actor U as 사용자
    participant Q as 퀴즈 화면
    participant C as 언어 config
    participant E as SRS 엔진 (ts-fsrs)
    participant DB as Supabase

    U->>Q: 시작하기
    Q->>DB: due 단어 조회 (due ≤ now + 신규 일 20개 한도)
    loop 카드마다
        Q->>Q: 출제 방향 결정 (예문 있으면 cloze 우선)
        U->>Q: 타이핑 답안
        Q->>C: 채점 (악센트 관대 · ñ 엄격)
        Q->>E: 정답=Good / 오답=Again
        E->>DB: es_words FSRS 상태 갱신 (due·stability·…)
        E->>DB: es_review_log 1행 insert
        Q-->>U: 정답·예문 표시 → 다음
    end
    Q->>DB: activity_feed 일별 요약 upsert<br/>("단어 N개 복습, 정답률 M%")
```

- **복습 1회 = `es_review_log` 1행**이 유일한 이력 원본 — 통계·스트릭·어려운 단어·신규 한도 전부 여기서 파생(#36)
- activity는 당일 재학습 시 같은 행을 **갱신**(건별 발행 아님, §6.4)

### 14.4 단어 추가

```mermaid
flowchart TD
    A[단어·뜻·성별 입력] --> B["norm 계산<br/>(악센트 무시 정규화)"]
    B --> C{동일 norm 존재?}
    C -- 예 --> D["⚠ 중복 힌트 표시<br/>저장 차단"]
    D --> A
    C -- 아니오 --> E["es_words insert<br/>(state = New)"]
    E --> F["activity_feed 건별 발행<br/>'단어 추가'"]
```

### 14.5 책 완독 기록 (§7.2)

```mermaid
flowchart TD
    A["＋ 완독 기록"] --> B{책이 이미 서재에?}
    B -- 예 --> D
    B -- 아니오 --> C["새 책 등록<br/>제목·저자·옮긴이·출판사·원저연도"]
    C --> D["reading insert<br/>완독일(기본 오늘) + 선택 별점"]
    D --> E[여정 자세히보기로 이동]
    E --> F["노트·reflection(감상)<br/>자유 순서, 전부 선택"]
    F --> G["reflection 작성 시<br/>context = 'N회독' 자동"]
    D & F -.-> H["activity_feed 전부 건별<br/>(책은 저빈도 도메인)"]
```

- 중간 기록 없음 — 완독 전의 책을 앱은 모른다(§7.4, 의도된 트레이드오프)

### 14.6 개념 저장·제목 변경 — **폐기 (2026-08-20, #57)**

```mermaid
flowchart TD
    A[개념 편집 저장] --> B["본문에서 위키링크 추출"]
    B --> C["제목 문자열로 resolve"]
    C --> D["resolve 성공분만<br/>concept_link 전량 재기록"]
    C --> E["실패분 = dangling<br/>본문에만 red link로 남음"]
    D --> F["activity_feed<br/>개념당 당일 1건 upsert"]

    R[개념 제목 변경] --> S["참조하는 모든 본문의<br/>옛 제목 링크 일괄 치환"]
    S --> A
```

- `concept_link`는 저장 시마다 **전량 재기록**이라 증분 버그가 원리적으로 없음(§8.2)
- 개념 생성·reflection은 건별 발행, 본문 수정만 당일 1건(§8.4)

### 14.7 엔티티 삭제 — cascade 이원화 (§9.3, 유지보수 핵심 불변식)

```mermaid
flowchart TD
    A["엔티티 삭제<br/>(book / es_word / concept)"] --> B["DB: 진짜 FK 자식은<br/>on delete cascade<br/>(reading·review_log·<br/>sentences …)"]
    A --> C["앱 레이어: 다형 참조 행 삭제<br/>reflection_thread+entry · tagging<br/>(FK 없음 — DB가 못 지움)"]
    A --> D["activity_feed는 그대로 보존<br/>과거 이벤트 = 일어난 역사"]
    D --> E["홈 타임라인에서<br/>해당 이벤트 링크 비활성"]
```

- **삭제 구현 시 반드시 두 갈래(B+C)를 모두 수행**해야 한다. C를 빠뜨리면 고아 reflection/tagging이 남는다 — 무결성은 앱 레이어 책임(§4.5)

-- LSHobby 초기 스키마 — 원본: docs/09-erd-ddl.md §9.2 (2026-08-14 확정)
-- 13개 테이블 + RLS(authenticated 전부 허용, anon 기본 거부 — 결정 #33)

-- ============ shared ============

create table tag (
  id    bigint generated always as identity primary key,
  name  text not null unique
);

create table tagging (
  id           bigint generated always as identity primary key,
  tag_id       bigint not null references tag(id) on delete cascade,
  subject_type text not null,      -- 'book' | 'concept' (태그 대상이 늘면 값 추가)
  subject_id   bigint not null,    -- FK 없음: 다형 참조 (§4.5)
  unique (tag_id, subject_type, subject_id)
);
create index idx_tagging_subject on tagging (subject_type, subject_id);

create table reflection_thread (
  id           bigint generated always as identity primary key,
  subject_type text not null,      -- 'book' | 'es_word' | 'concept'
  subject_id   bigint not null,    -- FK 없음: 다형 참조
  created_at   timestamptz not null default now(),
  unique (subject_type, subject_id)   -- 엔티티당 스레드 1개
);

create table reflection_entry (
  id         bigint generated always as identity primary key,
  thread_id  bigint not null references reflection_thread(id) on delete cascade,
  content    text not null,
  context    text,                 -- 계기 메모 — 책은 'N회독' 자동 기입 (§7.2)
  created_at timestamptz not null default now()   -- 이 순서가 곧 타임라인
);
create index idx_reflection_entry_thread on reflection_entry (thread_id);

create table activity_feed (
  id          bigint generated always as identity primary key,
  domain      text not null,       -- 'library' | 'language' | 'knowledge'
  entity_type text not null,       -- 'book' | 'es_word' | 'concept' | 'reflection' …
  entity_id   bigint not null,     -- FK 없음: 엔티티 삭제 후에도 이벤트는 남는다 (§9.3)
  action      text not null,       -- 'created' | 'updated' | 'reflected' | 'completed' …
  summary     text not null,       -- 타임라인 한 줄 (비정규화 — 홈은 이 테이블만 읽음)
  occurred_at timestamptz not null default now()
);
create index idx_activity_feed_occurred on activity_feed (occurred_at desc);

-- ============ library ============

create table book (
  id         bigint generated always as identity primary key,
  title      text not null,
  author     text not null,
  translator text,                 -- 옮긴이 (선택)
  publisher  text not null,
  pub_year   text not null,        -- 원저 발표연도. 텍스트 — 'BC 380' 같은 값 허용
  note       text,                 -- 책당 1개 마크다운 노트 (§7.1)
  created_at timestamptz not null default now()
);

create table reading (
  id          bigint generated always as identity primary key,
  book_id     bigint not null references book(id) on delete cascade,
  finished_on date not null default current_date,        -- 미입력 시 기록일
  rating      smallint check (rating between 1 and 5),   -- 선택 별점
  created_at  timestamptz not null default now()
);
create index idx_reading_book on reading (book_id);

create table quote (
  id         bigint generated always as identity primary key,
  book_id    bigint not null references book(id) on delete cascade,
  content    text not null,
  page       int,                  -- 시작 페이지 (범위 인용은 코멘트에 부기)
  comment    text,                 -- 한 줄 코멘트 (선택)
  created_at timestamptz not null default now()
);
create index idx_quote_book on quote (book_id);

-- ============ knowledge ============

create table concept (
  id         bigint generated always as identity primary key,
  title      text not null unique, -- 위키링크가 제목으로 resolve되므로 유일 필수 (§8.2)
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()   -- 목록 기본 정렬 = 최근 수정순
);

create table concept_link (
  from_id bigint not null references concept(id) on delete cascade,
  to_id   bigint not null references concept(id) on delete cascade,
  primary key (from_id, to_id)     -- 본문 저장 시 [[...]] 추출로 전량 재기록
);
create index idx_concept_link_to on concept_link (to_id);   -- 백링크 조회

-- ============ language (스페인어 — 영어 확장 시 en_* 복제) ============

create table es_words (
  id             bigint generated always as identity primary key,
  word           text not null,
  gender         text not null check (gender in ('m','f','n','none')),  -- 언어 특수 필드
  meaning        text not null,
  norm           text not null unique,   -- 악센트 관대·ñ 엄격 정규화 결과로 중복 차단 (§6.2)
  -- FSRS 상태: ts-fsrs Card 필드 그대로 (§6.3)
  due            timestamptz,
  stability      real,
  difficulty     real,
  elapsed_days   int not null default 0,
  scheduled_days int not null default 0,
  reps           int not null default 0,
  lapses         int not null default 0,
  state          smallint not null default 0,  -- 0 New / 1 Learning / 2 Review / 3 Relearning
  last_review    timestamptz,
  created_at     timestamptz not null default now()
);
create index idx_es_words_due on es_words (due);

create table es_review_log (
  id          bigint generated always as identity primary key,
  word_id     bigint not null references es_words(id) on delete cascade,
  rating      smallint not null,   -- ts-fsrs Rating: 1 Again / 3 Good (자동 채점 이분 매핑)
  reviewed_at timestamptz not null default now()
);
create index idx_es_review_log_word on es_review_log (word_id);
create index idx_es_review_log_at   on es_review_log (reviewed_at);

create table es_sentences (
  id         bigint generated always as identity primary key,
  word_id    bigint not null references es_words(id) on delete cascade,
  es_text    text not null,
  ko_text    text,
  en_text    text,
  source_url text
);
create index idx_es_sentences_word on es_sentences (word_id);

create table es_sentence_fetch (
  word_id    bigint primary key references es_words(id) on delete cascade,
  fetched_at timestamptz not null default now()
);

-- ============ RLS: 전 테이블 "authenticated 전부 허용" ============
-- anon은 기본 거부(RLS 기본값), 로그인 = 본인 (1계정 전제 — §9.3)
-- 전제: Supabase Auth에서 신규 가입 서버 차단 (§12 SEC-01)

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy authenticated_all on %I for all to authenticated using (true) with check (true)',
      t);
  end loop;
end $$;

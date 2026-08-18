-- §6.2 영어 확장 (결정 #54) — es_* 4테이블 복제 + 예문 원문 컬럼 일반화

-- 원문 컬럼 일반화: es_text → text (언어가 늘어도 스키마가 자연스럽도록)
alter table es_sentences rename column es_text to text;

-- 영어 테이블 — es_*와 동일 구조, gender(언어 특수 필드)만 제외 (§6.2)
create table en_words (
  id             bigint generated always as identity primary key,
  word           text not null,
  meaning        text not null,
  norm           text not null unique,   -- 대소문자·앞뒤 공백 무시 정규화 (§6.2)
  due            timestamptz,
  stability      real,
  difficulty     real,
  elapsed_days   int not null default 0,
  scheduled_days int not null default 0,
  reps           int not null default 0,
  lapses         int not null default 0,
  learning_steps int not null default 0,
  state          smallint not null default 0,
  last_review    timestamptz,
  created_at     timestamptz not null default now()
);
create index idx_en_words_due on en_words (due);

create table en_review_log (
  id          bigint generated always as identity primary key,
  word_id     bigint not null references en_words(id) on delete cascade,
  rating      smallint not null,
  reviewed_at timestamptz not null default now()
);
create index idx_en_review_log_word on en_review_log (word_id);
create index idx_en_review_log_at   on en_review_log (reviewed_at);

create table en_sentences (
  id         bigint generated always as identity primary key,
  word_id    bigint not null references en_words(id) on delete cascade,
  text       text not null,              -- 영어 원문
  ko_text    text,
  en_text    text,                       -- 영어에선 항상 null (인터페이스 통일용)
  source_url text
);
create index idx_en_sentences_word on en_sentences (word_id);

create table en_sentence_fetch (
  word_id    bigint primary key references en_words(id) on delete cascade,
  fetched_at timestamptz not null default now()
);

-- RLS — 초기 스키마와 동일 정책 (§9.2)
do $$
declare t text;
begin
  foreach t in array array['en_words', 'en_review_log', 'en_sentences', 'en_sentence_fetch'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy authenticated_all on %I for all to authenticated using (true) with check (true)',
      t);
  end loop;
end $$;

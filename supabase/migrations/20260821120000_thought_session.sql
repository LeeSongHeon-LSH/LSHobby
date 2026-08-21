-- 생각 세션 (4번째 서랍) — 하루 생각 정리 스트림 + 로컬 워커 요약 (grill 결정 2026-08-21)
-- append-only: 수정·삭제 없음(감상과 같은 원칙). topics는 로컬 워커가 채우는 기계 주석.

create table thought (
  id         bigint generated always as identity primary key,
  content    text not null,
  topics     text[],                  -- 로컬 워커가 붙이는 주제 키워드 (null = 미분석)
  created_at timestamptz not null default now()
);
create index idx_thought_created on thought (created_at desc);

create table thought_digest (
  id         bigint generated always as identity primary key,
  day        date not null unique,    -- 요약 대상 날짜 (로컬 기준)
  summary    text not null,           -- 하루 요약 3~5줄
  topics     text[] not null default '{}',  -- 그날의 주제 키워드 (궤적 축적)
  model      text not null,           -- 생성한 로컬 모델 (예: exaone3.5:7.8b)
  created_at timestamptz not null default now()
);

-- RLS — 초기 스키마와 동일 정책 (§9.2)
do $$
declare t text;
begin
  foreach t in array array['thought', 'thought_digest'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy authenticated_all on %I for all to authenticated using (true) with check (true)',
      t);
  end loop;
end $$;

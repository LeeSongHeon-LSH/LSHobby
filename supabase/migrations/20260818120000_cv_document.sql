-- §17 CV 모듈 (결정 #51) — 공개 이력서 마크다운 1행 운용

create table cv_document (
  id         bigint generated always as identity primary key,
  content    text not null default '',   -- CV 전문 마크다운 (1행 운용)
  updated_at timestamptz not null default now()
);

alter table cv_document enable row level security;
create policy authenticated_all on cv_document
  for all to authenticated using (true) with check (true);

-- 공개 CV: 전 스키마에서 유일한 anon SELECT (§12 SEC-02 예외, #51)
create policy anon_read_cv on cv_document for select to anon using (true);

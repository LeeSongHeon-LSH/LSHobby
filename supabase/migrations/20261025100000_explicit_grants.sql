-- Data API 권한을 명시한다 (docs/16 §16.14, 2026-10-25).
-- Supabase는 2026-10-30부터 public의 새 표·시퀀스·함수를 anon·authenticated·service_role에 자동
-- 노출하지 않는다(config.toml의 auto_expose_new_tables 주석). 지금까지는 그 기본 권한에 기대어
-- 마이그레이션에 GRANT가 하나도 없었고 덤프도 --no-privileges였다 — 새 프로젝트로 복원하면 권한
-- 없는 스키마가 되어 앱이 RLS에 닿기도 전에 42501로 전부 실패하는데, 주간 리허설은 행 수만 보고
-- "일치"라 했다. 지금 라이브와 같은 권한(세 역할 모두 ALL — 접근 통제는 RLS, docs/16 §16.1)을
-- 명시하고, 이 뒤로 객체를 만드는 마이그레이션은 GRANT를 함께 적는다.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
-- 마이그레이션(postgres 역할)이 앞으로 만드는 객체에도 같은 권한 — Supabase가 이 기본 권한을
-- 걷어 가면 효력이 없으므로, 명시적 GRANT를 빠뜨리는 보험일 뿐 대신이 아니다
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;

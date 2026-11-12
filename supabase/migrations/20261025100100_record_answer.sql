-- 답안 1건 저장을 한 트랜잭션으로 (docs/14 §14.3).
-- 클라이언트가 "FSRS 필드 갱신 → review_log 삽입"을 두 요청으로 보내면 둘째가 실패할 때 상태만
-- 앞서가고(통계 1회 누락), 다른 기기에서 같은 단어를 먼저 채점한 상태를 모르는 채 덮어쓴다.
-- 저장 직전의 last_review를 함께 받아 그 값일 때만 갱신한다 — 다르면 0행 → 예외(P0002) → 클라이언트는
-- 저장 실패로 센다. security invoker(기본)라 RLS는 호출자 기준 그대로다.
create or replace function record_answer(
  lang text,
  p_word_id bigint,
  p_fields jsonb,
  p_rating smallint,
  p_reviewed_at timestamptz,
  p_prev_last_review timestamptz default null
) returns void
language plpgsql as $$
declare
  n int;
begin
  if lang not in ('es', 'en') then
    raise exception 'unknown lang %', lang;
  end if;
  execute format(
    'update %I w set (due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, learning_steps, state, last_review)
       = (f.due, f.stability, f.difficulty, f.elapsed_days, f.scheduled_days, f.reps, f.lapses, f.learning_steps, f.state, f.last_review)
     from jsonb_populate_record(null::%I, $1) f
     where w.id = $2 and w.last_review is not distinct from $3',
    lang || '_words', lang || '_words')
    using p_fields, p_word_id, p_prev_last_review;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'stale card % — last_review changed since the deck was loaded', p_word_id
      using errcode = 'P0002';
  end if;
  execute format('insert into %I (word_id, rating, reviewed_at) values ($1, $2, $3)', lang || '_review_log')
    using p_word_id, p_rating, p_reviewed_at;
end $$;
grant execute on function record_answer(text, bigint, jsonb, smallint, timestamptz, timestamptz)
  to anon, authenticated, service_role;

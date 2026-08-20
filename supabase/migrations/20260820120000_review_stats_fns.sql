-- 리뷰 집계를 DB로 내림 (성능 리뷰 P1 — #36 "review_log 파생" 원칙은 유지, 집계 위치만 이동).
-- 클라이언트 전량 조회는 PostgREST 1000행 캡에서 조용히 틀려지므로 RPC로 대체한다.
-- security invoker(기본)라 RLS가 호출자 기준으로 그대로 적용된다.

-- 단어별 집계 — reviewStats·오늘 신규 시작 판정(min reviewed_at) 대체
create or replace function es_word_stats()
returns table(word_id bigint, reviews bigint, correct bigint, first_reviewed_at timestamptz)
language sql stable as $$
  select word_id, count(*), count(*) filter (where rating >= 2), min(reviewed_at)
  from es_review_log group by word_id
$$;

create or replace function en_word_stats()
returns table(word_id bigint, reviews bigint, correct bigint, first_reviewed_at timestamptz)
language sql stable as $$
  select word_id, count(*), count(*) filter (where rating >= 2), min(reviewed_at)
  from en_review_log group by word_id
$$;

-- 일별 집계 — fetchStats·todayReviewSummary 대체. 일 경계는 호출자 타임존(tz) 기준
create or replace function es_daily_stats(tz text)
returns table(day date, total bigint, correct bigint)
language sql stable as $$
  select (reviewed_at at time zone tz)::date, count(*), count(*) filter (where rating >= 2)
  from es_review_log group by 1 order by 1
$$;

create or replace function en_daily_stats(tz text)
returns table(day date, total bigint, correct bigint)
language sql stable as $$
  select (reviewed_at at time zone tz)::date, count(*), count(*) filter (where rating >= 2)
  from en_review_log group by 1 order by 1
$$;

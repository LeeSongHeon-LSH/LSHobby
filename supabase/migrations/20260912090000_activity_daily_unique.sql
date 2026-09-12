-- "일별 activity 1건"(§6.4)을 DB 제약으로 올린다.
-- upsertDaily는 select 후 insert라 답을 빠르게 연속 제출하면 두 호출이 모두 "없음"을 보고
-- 같은 날 행을 두 개 만든다. 유일 키가 없으면 코드로는 못 막는다.
--
-- 날짜 칸을 따로 두는 이유: 일 경계는 **브라우저의 로컬 날짜**이고,
-- `(occurred_at at time zone '...')::date`는 STABLE이라 인덱스 표현식으로 쓸 수 없다.
-- 그래서 클라이언트가 자기 로컬 날짜를 occurred_on에 그대로 적는다.
--
-- 건별 이벤트(publish)는 이 칸을 비워 둔다. Postgres의 유니크 인덱스는 NULL을 서로
-- 구별되는 값으로 보므로, 같은 날 같은 책에 여러 건이 쌓이는 기존 동작은 그대로다.
-- 부분 인덱스(where occurred_on is not null)를 쓰지 않는 것은 PostgREST의 on_conflict가
-- 부분 인덱스를 추론하지 못하기 때문 — 전체 유니크 인덱스라야 upsert가 붙는다.

alter table activity_feed add column occurred_on date;

-- 기존 일별 행 백필. 일별 갱신을 쓰는 자리는 answer.ts 하나뿐이다
-- (domain='language', entity_type='{es,en}_review_day', action='reviewed').
-- 경계는 이 앱이 쓰는 KST — 스크립트·다이제스트와 같은 축(§16 §16.11)
update activity_feed
   set occurred_on = (occurred_at at time zone 'Asia/Seoul')::date
 where domain = 'language'
   and entity_type in ('es_review_day', 'en_review_day')
   and action = 'reviewed';

-- 인덱스를 붙이기 전에 이미 생긴 같은 날 중복을 정리한다 — 가장 나중 행만 남긴다
delete from activity_feed a
 using activity_feed b
 where a.occurred_on is not null
   and a.domain = b.domain
   and a.entity_type = b.entity_type
   and a.entity_id = b.entity_id
   and a.action = b.action
   and a.occurred_on = b.occurred_on
   and (a.occurred_at, a.id) < (b.occurred_at, b.id);

create unique index idx_activity_feed_daily
  on activity_feed (domain, entity_type, entity_id, action, occurred_on);

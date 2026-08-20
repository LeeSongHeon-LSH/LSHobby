-- 인용구 기능 삭제 (결정 #58) — "인용구를 기억해두지 않을 것" 확인, 데이터 0건 확인 후 drop.
-- 인용구 단위 reflection·tagging은 애초에 없었고(§7.1), activity_feed의 과거 quoted 이벤트는 보존(§14.7).
drop table if exists quote;

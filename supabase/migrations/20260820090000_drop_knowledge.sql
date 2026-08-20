-- CS 모듈 완전 삭제 (결정 #57) — 기록처를 Notion으로 이관, 개념 데이터 0건 확인 후 drop
drop table if exists concept_link;
drop table if exists concept;
-- CS 본문 이미지 전용이던 attachments 버킷의 RLS 정책 제거 (#33) — 다른 모듈 사용처 없음
-- 버킷 자체는 storage 테이블 직접 DML이 금지라 Storage API(DELETE /storage/v1/bucket/attachments)로 별도 삭제
drop policy if exists attachments_authenticated_all on storage.objects;

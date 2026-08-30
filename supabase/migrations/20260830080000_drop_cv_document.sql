-- CV 모듈 분리 — 공개 이력서는 별도 리포(LeeSongHeon-LSH.github.io)의 cv.md가 원본이 됐다.
-- 데이터 0행 확인 후 drop. 정책도 함께 사라지므로 SEC-02는 다시 "anon 전부 거부"로 단순해진다.
drop table if exists cv_document;

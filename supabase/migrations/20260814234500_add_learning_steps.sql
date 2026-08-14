-- ts-fsrs 5.x의 Card에 learning_steps 필드가 있음 (설계 시점 미파악)
-- §9.3 "FSRS 상태 = ts-fsrs Card 필드 그대로" 원칙에 따라 컬럼 추가
alter table es_words add column learning_steps int not null default 0;

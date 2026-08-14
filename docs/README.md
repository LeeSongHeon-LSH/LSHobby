# LSHobby — 개인 지식·취미 관리 웹앱 설계 문서

> **작성일**: 2026-08-14 (모듈·ERD/DDL·와이어프레임 확정: 2026-08-14)
> **앱 이름**: **LSHobby** — GitHub 리포 `LeeSongHeon-LSH/LSHobby` (구 Spanish-Practice에서 개명 완료)
> **상태**: 설계 단계 전부 확정 — 아키텍처·화면구조·세 모듈·ERD/DDL·와이어프레임·요구사항 명세(§12)
> **다음 작업**: 프로젝트 초기 세팅 — Next.js + Supabase 연결 (로드맵은 [06-language-srs.md](06-language-srs.md) §6.6, 세팅 직후 보안 체크리스트는 [§12.6](12-requirements.md))

## 1. 프로젝트 개요

개인의 취미 생활과 학습을 한곳에 집대성하는 웹 애플리케이션.
세 영역(책 / 언어 / CS)을 다루되, **각 영역이 화면상 명확히 분리**되어야 하며,
공통적으로 **"시간에 따라 생각이 변하는 과정"을 기록**하는 것이 핵심 가치.

### 1.1 세 가지 세션

| 세션 | 내용 |
|---|---|
| 📚 **책 (library)** | 탐독한 책 목록 관리, 간단한 내용 정리, 장르별 구분 |
| 🗣 **언어 (language)** | 스페인어 학습 (기존 웹앱 존재) + 영어 확장 |
| 💻 **CS (knowledge)** | 컴퓨터공학 학습 내용 정리 및 관리 |

## 문서 맵

원래 단일 문서였던 것을 주제별로 분할했다. **§ 번호 = 파일 번호** — 문서 전반의 `§N.x` 참조는 `docs/0N-*.md` 파일의 해당 절을 가리킨다 (§1은 본 README).

| § | 파일 | 내용 |
|---|---|---|
| §1 | (본 문서) | 프로젝트 개요 |
| §2 | [02-tech-stack.md](02-tech-stack.md) | 기술 스택 — Next.js·Supabase·Vercel, 락인 회피, 모바일 우선 |
| §3 | [03-architecture.md](03-architecture.md) | Modular Monolith — 디렉터리 구조, 모듈 경계 규칙 |
| §4 | [04-reflection.md](04-reflection.md) | Reflection(생각 기록) — append-only, 다형 참조 |
| §5 | [05-screens.md](05-screens.md) | 화면 구조 — 통합 홈 + 세션 탭, activity_feed |
| §6 | [06-language-srs.md](06-language-srs.md) | 언어 모듈 + **SRS(FSRS)** — 언어별 테이블, 빅뱅 컷오버, 로드맵(§6.6) |
| §7 | [07-library.md](07-library.md) | 책 모듈 — 완독 후 일괄 기록, 회독·인용구·노트 |
| §8 | [08-knowledge.md](08-knowledge.md) | CS 모듈 — 개념 문서, 태그 + 위키링크·백링크 |
| §9 | [09-erd-ddl.md](09-erd-ddl.md) | **전체 ERD + DDL** — 13개 테이블, RLS (컷오버 시 마이그레이션 원본) |
| §10 | [10-decisions.md](10-decisions.md) | 결정 사항 요약 #1~41 |
| §11 | [11-wireframes.md](11-wireframes.md) | 화면 와이어프레임 — 내비 문법, 전 세션 화면 인벤토리 |
| §12 | [12-requirements.md](12-requirements.md) | **요구사항 명세(SRS)** — FR/NFR/SEC 통합, 보안·백업 신규 확정, 수용 기준 |
| §13 | [13-user-stories.md](13-user-stories.md) | 유저 스토리 — 에픽 E1~E8, US↔FR 추적 매트릭스 |
| §14 | [14-flows.md](14-flows.md) | 흐름도(mermaid) — 내비·인증·퀴즈·완독 기록·개념 저장·삭제 |
| §15 | [15-dcd.md](15-dcd.md) | DCD — 모듈 공개 인터페이스·의존 방향·테이블 소유권·유지보수 불변식 |

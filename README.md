# LSHobby

개인 지식·취미 관리 웹앱 — 책 · 언어 · CS 세 세션을 한곳에서. 핵심 가치는 **"시간에 따라 생각이 변하는 과정"의 기록**(reflection).

- **프로덕션**: https://lshobby.vercel.app (main 푸시 = 자동 배포)
- **스택**: Next.js + Tailwind + Supabase + Vercel — 근거는 [docs/02](docs/02-tech-stack.md)
- **설계 문서**: [docs/](docs/README.md) — 아키텍처·모듈 설계·ERD/DDL·요구사항 명세(SRS)·인프라 해설(§16)

## 개발

```bash
npm install
npm run dev     # localhost:3000 (.env 필요 — docs/16 §16.4)
npm test        # vitest
```

DB 스키마 변경은 `supabase/migrations/`가 원본 — 절차는 [docs/16 §16.6](docs/16-infra.md).

> 구 스페인어 학습 앱(FastAPI + SQLite)은 2026-08-15 컷오버로 종료·삭제됨 (git 히스토리에 보존, `spanish.db` 백업은 홈 디렉터리).

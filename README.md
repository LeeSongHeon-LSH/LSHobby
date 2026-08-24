# LSHobby

개인 지식·취미 관리 웹앱 — 책 · 언어 · CV · 생각 네 서랍을 한곳에서. 핵심 가치는 **"시간에 따라 생각이 변하는 과정"의 기록**(reflection).

- **프로덕션**: https://lshobby.vercel.app (main 푸시 = 자동 배포)
- **스택**: Next.js + Tailwind + Supabase + Vercel — 근거는 [docs/02](docs/02-tech-stack.md)
- **설계 문서**: [docs/](docs/README.md) — 아키텍처·모듈 설계·ERD/DDL·요구사항 명세(SRS)·인프라 해설(§16)

## 개발

```bash
npm install
npm run dev          # localhost:3000 (.env 필요 — docs/16 §16.4)
npm test             # vitest
npm run check:ollama # 로컬 LLM 연결 점검 (docs/16 §16.11)
```

DB 스키마 변경은 `supabase/migrations/`가 원본 — 절차는 [docs/16 §16.6](docs/16-infra.md).

## 로컬 LLM

생각 세션의 하루 요약(cron 00:30)과 철학 정보는 **집 PC의 Ollama**로만 돈다 — 생각 데이터는 외부 API로 보내지 않는다는 정책 때문이다. 철학 정보의 한국어 질문은 exaone이 로컬에서 영어로 통역해 묻고 답변을 한국어로 되옮긴다 — 번역도 외부 API를 쓰지 않는다. 폰·외부 PC에서도 쓰려고 Tailscale로 tailnet 안에만 노출해 뒀다(`:8443/ollama`, 인터넷 노출 없음).

`.env`에 `OLLAMA_URL`(배치용)과 `NEXT_PUBLIC_OLLAMA_URL`(앱용)이 **반드시** 있어야 한다. 없으면 코드 기본값 `localhost:11434`로 떨어지는데 그 주소는 더 이상 리스닝하지 않아 조용히 실패한다. 구성과 근거는 [docs/16 §16.11](docs/16-infra.md).

> 구 스페인어 학습 앱(FastAPI + SQLite)은 2026-08-15 컷오버로 종료·삭제됨 (git 히스토리에 보존, `spanish.db` 백업은 홈 디렉터리).

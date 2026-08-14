> LSHobby 설계 문서 — 목차·로드맵·§번호↔파일 매핑은 [README](README.md) 참조

## 2. 기술 스택 (확정)

| 레이어 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | **Next.js (React)** | 프론트 + API Routes |
| 스타일 | **Tailwind CSS** | 모바일 우선 반응형 |
| DB | **Supabase (PostgreSQL)** | 무료 티어 |
| 인증 | **Supabase Auth** | |
| 스토리지 | **Supabase Storage** | 이미지/첨부 |
| 배포 | **Vercel** | GitHub 연동 자동 배포 |
| 비용 | **0원** | 개인 취미 프로젝트 범위 내 |

### 2.1 왜 AWS가 아닌가
- 취미 프로젝트에 월 4~6만원 + 서버 관리 부담은 오버킬
- Vercel + Supabase 무료 티어로 충분 (DB 500MB, 스토리지 1GB, 대역폭 100GB/월)

### 2.2 락인(lock-in) 회피 원칙
Vercel이 유료화되어도 쉽게 이전할 수 있도록 다음을 지킨다.

- [ ] **DB는 Supabase 사용** — Vercel Postgres/KV/Blob **사용 금지**
- [ ] 파일/이미지도 Supabase Storage (또는 Cloudflare R2)
- [ ] 모든 연결 정보는 **환경변수**로 관리, 코드 하드코딩 금지
- [ ] Vercel 전용 API 최소화, 표준 Next.js 기능 위주
- [ ] 정기 백업 (`pg_dump`)

> 이 원칙을 지키면 Vercel → Netlify/Cloudflare/Railway 이전은 30분~1시간,
> Supabase → 다른 PostgreSQL 이전은 반나절 수준.

### 2.3 모바일 우선 설계
입력의 대부분이 모바일에서 발생하므로 **모바일 우선 → PC 확장** 순서로 설계.

```
스페인어 단어 암기  → 지하철, 자투리 시간 → 📱
독서 중 인용구 기록  → 책 읽다가 바로      → 📱
추억/사진 기록      → 찍은 그 자리에서     → 📱
월간 회고, 통계     → 책상 앞에서          → 💻
```

**모바일 체크포인트**
- 터치 타겟 44px 이상
- 하단 탭 네비게이션 (상단 메뉴는 한 손으로 못 닿음)
- 입력 폼 최소화 (필드 2~3개)
- 사진 업로드 전 클라이언트 리사이즈
- **PWA 적용 검토** (홈 화면 추가 → 앱처럼 사용, 오프라인 캐싱)


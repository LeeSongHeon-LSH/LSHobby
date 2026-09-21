import type { NextConfig } from "next";

// 클라이언트가 말을 걸 외부 오리진은 Supabase 하나다 (Tatoeba는 서버 라우트가, 글꼴은 npm 패키지가).
// env가 없는 자리(vitest·CI)에서는 'self'만 남는다 — 빌드는 .env가 있는 이 PC에서만 한다
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // 배포는 .next를 건드리지 않고 별도 디렉토리에 빌드한 뒤 성공했을 때만 교체한다
  // (scripts/deploy-local.sh, docs/16 §16.5). 평소에는 기본값 .next 그대로다.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  // 최소 보안 헤더 (§12 SEC-06 개정, 결정 #56·#72) — 마크다운 sanitize(SEC-05)의 심층 방어
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 클릭재킹 차단 (#72) — iframe 삽입 전면 거부, 삽입 허용 시나리오 없음
          { key: "X-Frame-Options", value: "DENY" },
          // 느슨한 CSP — script-src·style-src는 두지 않는다: Next 하이드레이션 인라인 스크립트와
          // style={{}} 20곳 때문에 'unsafe-inline'이 들어가 방어 가치가 없고, 제대로 하려면 nonce
          // 미들웨어가 필요하다(코드 리뷰 2026-09-21 #9, 보류). 여기 넷은 인라인과 무관하게 서는 것만:
          // connect-src = XSS가 있어도 fetch로 밖에 못 내보냄 / frame-ancestors = X-Frame-Options의 CSP판
          {
            key: "Content-Security-Policy",
            value: [
              `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

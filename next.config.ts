import type { NextConfig } from "next";

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
        ],
      },
    ];
  },
};

export default nextConfig;

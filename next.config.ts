import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 최소 보안 헤더 (§12 SEC-06 개정, 결정 #56) — 마크다운 sanitize(SEC-05)의 심층 방어
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

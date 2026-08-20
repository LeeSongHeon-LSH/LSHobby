import type { MetadataRoute } from "next";

// PWA 설치형 최소 (결정 #19) — 아이콘 = 잠옷 펭귄 마스코트 (#60, scripts/generate-icons.mjs로 생성)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LSHobby",
    short_name: "LSHobby",
    description: "개인 지식·취미 기록 — 책 · 언어 · CV",
    start_url: "/home", // 설치형 앱은 취미공간이 목적 — 공개 CV(`/`) 경유·리다이렉트 생략 (§17.2)
    scope: "/",
    display: "standalone",
    background_color: "#eef1f4",
    theme_color: "#eef1f4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

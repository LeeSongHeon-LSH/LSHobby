import type { MetadataRoute } from "next";

// PWA 설치형 최소 (결정 #19) — 아이콘은 중립 모노그램 임시본, 디자인 패스에서 교체
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LSHobby",
    short_name: "LSHobby",
    description: "개인 지식·취미 관리 — 책 · 언어 · CS",
    start_url: "/home", // 설치형 앱은 취미공간이 목적 — 공개 CV(`/`) 경유·리다이렉트 생략 (§17.2)
    scope: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#fafafa",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SwRegister } from "./sw-register";
import { LocaleSync } from "@/modules/shared/i18n";

// #90 타이포 시스템 — 제목·본문: Pretendard Variable / 수치·상태·말풍선: Galmuri11(도트).
// 두 글꼴 다 npm 패키지(pretendard·galmuri)의 파일을 그대로 쓴다 (#92) — 예약 글꼴명(OFL RFN)이라
// 수정·서브셋 금지, 버전은 package.json 이 기록한다. Pretendard는 제작자 배포 동적 서브셋(92조각,
// unicode-range)을 globals.css가 @import한다 — next/font/local은 조각별 unicode-range를 못 다룬다.
// Galmuri11은 Regular 한 파일만 — 도트 글꼴 자리에 굵기를 쓰는 곳이 없다. 굵은 도트가 필요해지면
// Galmuri11-Bold.woff2 를 weight "700" 으로 한 줄 추가한다 (파일마다 모든 라우트에 preload 된다).
const galmuri = localFont({
  src: "../../node_modules/galmuri/dist/Galmuri11.woff2",
  weight: "400",
  variable: "--font-galmuri",
});

export const metadata: Metadata = {
  title: "LSHobby",
  description: "개인 지식·취미 기록 — 책 · 언어 · 생각",
  appleWebApp: { capable: true, title: "LSHobby", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#eef1f4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${galmuri.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-paper text-ink">
        {children}
        <SwRegister />
        <LocaleSync />
      </body>
    </html>
  );
}

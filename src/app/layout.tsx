import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SwRegister } from "./sw-register";
import { LocaleSync } from "@/modules/shared/i18n";

// #90 타이포 시스템 — 제목·본문: Pretendard Variable / 수치·상태·말풍선: Galmuri11(도트).
// Pretendard는 제작자 배포 동적 서브셋(92조각, unicode-range)을 globals.css가 @import한다 —
// next/font/local은 조각별 unicode-range를 못 다룬다. Galmuri11은 원본 2파일이라 next/font/local.
// 두 글꼴 모두 예약 글꼴명(OFL RFN)이 있어 파일을 수정하지 않고 그대로 쓴다 (OFL.txt 동봉).
const galmuri = localFont({
  src: [
    { path: "../fonts/galmuri/Galmuri11.woff2", weight: "400" },
    { path: "../fonts/galmuri/Galmuri11-Bold.woff2", weight: "700" },
  ],
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

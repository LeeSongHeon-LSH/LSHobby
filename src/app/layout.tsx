import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LSHobby",
  description: "개인 지식·취미 관리 — 책 · 언어 · CS",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">{children}</body>
    </html>
  );
}

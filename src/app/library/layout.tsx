"use client";

import { AuthGuard } from "@/modules/shared/auth";

// #58·#59 — 책 세션은 탭바 없음: 독서 여정 책장이 단일 진입점, 홈 복귀는 우상단 HomeButton
export default function LibraryLayout({ children }: LayoutProps<"/library">) {
  return (
    <AuthGuard>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">{children}</div>
    </AuthGuard>
  );
}

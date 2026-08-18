"use client";

import { AuthGuard } from "@/modules/shared/auth";
import { TabBar } from "../ui/tab-bar";

// §11.1 — 책 세션 탭: [홈][서재][인용구]
const TABS = [
  { href: "/home", label: "홈", exact: true },
  { href: "/library", label: "서재", exact: true },
  { href: "/library/quotes", label: "인용구", exact: false },
];

export default function LibraryLayout({ children }: LayoutProps<"/library">) {
  return (
    <AuthGuard>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex-1 pb-20">{children}</div>
        <TabBar tabs={TABS} accent="lib" />
      </div>
    </AuthGuard>
  );
}

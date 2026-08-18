"use client";

import { AuthGuard } from "@/modules/shared/auth";
import { TabBar } from "../ui/tab-bar";

// §11.1 — CS 세션 탭: [홈][개념]
const TABS = [
  { href: "/home", label: "홈", exact: true },
  { href: "/knowledge", label: "개념", exact: false },
];

export default function KnowledgeLayout({ children }: LayoutProps<"/knowledge">) {
  return (
    <AuthGuard>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex-1 pb-20">{children}</div>
        <TabBar tabs={TABS} accent="cs" />
      </div>
    </AuthGuard>
  );
}

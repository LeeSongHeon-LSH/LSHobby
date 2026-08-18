"use client";

import { AuthGuard } from "@/modules/shared/auth";
import { TabBar } from "../ui/tab-bar";

// §11.1 — 세션 탭바: 첫 슬롯 [홈] = 허브 복귀, 세션 간 이동은 홈 경유
const TABS = [
  { href: "/home", label: "홈", exact: true },
  { href: "/language", label: "학습", exact: true },
  { href: "/language/words", label: "단어장", exact: false },
  { href: "/language/stats", label: "통계", exact: false },
  { href: "/language/add", label: "추가", exact: false },
];

export default function LanguageLayout({ children }: LayoutProps<"/language">) {
  return (
    <AuthGuard>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex-1 pb-20">{children}</div>
        <TabBar tabs={TABS} accent="lang" />
      </div>
    </AuthGuard>
  );
}

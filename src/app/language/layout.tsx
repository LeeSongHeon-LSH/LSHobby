"use client";

import { AuthGuard } from "@/modules/shared/auth";
import { TabBar } from "../ui/tab-bar";

// #59 — 4탭(도메인 기능만), 홈 복귀는 각 화면 우상단 HomeButton
const TABS = [
  { href: "/language", label: "학습", exact: true },
  { href: "/language/words", label: "단어장", exact: false },
  { href: "/language/stats", label: "통계", exact: false },
  { href: "/language/add", label: "추가", exact: false },
];

export default function LanguageLayout({ children }: LayoutProps<"/language">) {
  return (
    <AuthGuard>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex flex-1 flex-col pb-20">{children}</div>
        <TabBar tabs={TABS} accent="lang" />
      </div>
    </AuthGuard>
  );
}

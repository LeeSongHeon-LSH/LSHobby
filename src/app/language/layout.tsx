"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/modules/shared/auth";
import { TabBar } from "../ui/tab-bar";
import { useT } from "@/modules/shared/i18n";
import { PixelMascot } from "../ui/pixel";
import { ChatterScene } from "../ui/scene";

// #59 — 4탭(도메인 기능만), 홈 복귀는 각 화면 우상단 HomeButton.
// 데스크톱(md~)은 탭바 대신 좌측 사이드바 — 하단 탭 문법의 번역 (목업 데스크톱 페이지)
const TABS = [
  { href: "/language", key: "learn", exact: true },
  { href: "/language/words", key: "words", exact: false },
  { href: "/language/stats", key: "stats", exact: false },
  { href: "/language/add", key: "add", exact: false },
] as const;

// 라벨은 렌더 시점에 사전에서 — UI 언어 전환에 따라오게
const useTabs = () => {
  const t = useT();
  return TABS.map((tab) => ({ ...tab, label: t.lang.tabs[tab.key] }));
};

function Sidebar() {
  const pathname = usePathname();
  const t = useT();
  const tabs = useTabs();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-line bg-card px-4 pb-5 pt-6 md:flex">
      <p className="font-dot text-dot uppercase tracking-dot-wide text-lang">Language</p>
      <p className="mb-5 mt-0.5 font-display text-xl font-bold">{t.lang.title}</p>
      <nav className="flex flex-col gap-1">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative rounded-lg px-3.5 py-2.5 text-sm ${
                active ? "bg-lang-soft font-semibold text-lang" : "text-faint"
              }`}
            >
              {active && (
                <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-sm bg-lang" aria-hidden="true" />
              )}
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      <div className="flex justify-center">
        <PixelMascot size={44} />
      </div>
    </aside>
  );
}

export default function LanguageLayout({ children }: LayoutProps<"/language">) {
  const tabs = useTabs();
  return (
    <AuthGuard>
      <ChatterScene />
      <div className="flex min-h-dvh w-full">
        <Sidebar />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col pb-20 md:pb-6">{children}</div>
        <TabBar tabs={tabs} accent="lang" />
      </div>
    </AuthGuard>
  );
}

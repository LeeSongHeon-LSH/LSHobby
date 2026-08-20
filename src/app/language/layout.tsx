"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/modules/shared/auth";
import { TabBar } from "../ui/tab-bar";
import { PixelMascot } from "../ui/pixel";

// #59 — 4탭(도메인 기능만), 홈 복귀는 각 화면 우상단 HomeButton.
// 데스크톱(md~)은 탭바 대신 좌측 사이드바 — 하단 탭 문법의 번역 (목업 데스크톱 페이지)
const TABS = [
  { href: "/language", label: "학습", exact: true },
  { href: "/language/words", label: "단어장", exact: false },
  { href: "/language/stats", label: "통계", exact: false },
  { href: "/language/add", label: "추가", exact: false },
];

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-line bg-card px-4 pb-5 pt-6 md:flex">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lang">Language</p>
      <p className="mb-5 mt-0.5 font-display text-xl font-bold">언어</p>
      <nav className="flex flex-col gap-1">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative rounded-lg px-3.5 py-2.5 text-sm ${
                active ? "bg-lang-soft font-semibold text-lang" : "text-faint"
              }`}
            >
              {active && (
                <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-sm bg-lang" aria-hidden="true" />
              )}
              {t.label}
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
  return (
    <AuthGuard>
      <div className="flex min-h-dvh w-full">
        <Sidebar />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col pb-20 md:pb-6">{children}</div>
        <TabBar tabs={TABS} accent="lang" />
      </div>
    </AuthGuard>
  );
}

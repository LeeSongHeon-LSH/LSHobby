"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/modules/shared/auth";
import { TabBar } from "../ui/tab-bar";
import { PixelPenguinThink } from "../ui/pixel";

// 언어 세션과 같은 문법(#59) — 모바일 하단 탭바, 데스크톱(md~)은 좌측 사이드바
const TABS = [
  { href: "/thoughts", label: "기록", exact: true },
  { href: "/thoughts/ask", label: "철학 문답", exact: false },
];

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-line bg-card px-4 pb-5 pt-6 md:flex">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-thought">Thought</p>
      <p className="mb-5 mt-0.5 font-display text-xl font-bold">생각</p>
      <nav className="flex flex-col gap-1">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative rounded-lg px-3.5 py-2.5 text-sm ${
                active ? "bg-thought-soft font-semibold text-thought" : "text-faint"
              }`}
            >
              {active && (
                <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-sm bg-thought" aria-hidden="true" />
              )}
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      <div className="flex justify-center">
        <PixelPenguinThink size={44} />
      </div>
    </aside>
  );
}

export default function ThoughtsLayout({ children }: LayoutProps<"/thoughts">) {
  return (
    <AuthGuard>
      <div className="flex min-h-dvh w-full">
        <Sidebar />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col pb-20 md:max-w-2xl md:pb-6">
          {children}
        </div>
        <TabBar tabs={TABS} accent="thought" />
      </div>
    </AuthGuard>
  );
}

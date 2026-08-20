"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// #59 — 세션 탭바: 도메인 기능 탭만 (홈 복귀는 우상단 HomeButton). 활성 탭에 도메인색 인디케이터
export interface Tab {
  href: string;
  label: string;
  exact: boolean;
}

const ACCENT = {
  lang: { text: "text-lang", bar: "bg-lang" },
} as const;

export function TabBar({ tabs, accent }: { tabs: Tab[]; accent: keyof typeof ACCENT }) {
  const pathname = usePathname();
  const a = ACCENT[accent];
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-card">
      <div className="mx-auto flex max-w-md">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative flex-1 py-4 text-center text-sm ${
                active ? `font-semibold ${a.text}` : "text-faint"
              }`}
            >
              {active && <span className={`absolute inset-x-4 top-0 h-0.5 ${a.bar}`} />}
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

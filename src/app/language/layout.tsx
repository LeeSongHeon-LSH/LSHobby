"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/modules/shared/auth";

// §11.1 — 세션 탭바: 첫 슬롯 [홈] = 허브 복귀, 세션 간 이동은 홈 경유
const TABS = [
  { href: "/home", label: "홈", exact: true },
  { href: "/language", label: "학습", exact: true },
  { href: "/language/words", label: "단어장", exact: false },
  { href: "/language/stats", label: "통계", exact: false },
  { href: "/language/add", label: "추가", exact: false },
];

export default function LanguageLayout({ children }: LayoutProps<"/language">) {
  const pathname = usePathname();
  return (
    <AuthGuard>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex-1 pb-20">{children}</div>
        <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-md">
            {TABS.map((t) => {
              const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex-1 py-4 text-center text-sm ${
                    active ? "font-semibold text-neutral-900" : "text-neutral-400"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </AuthGuard>
  );
}

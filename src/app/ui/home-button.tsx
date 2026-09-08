"use client";

import Link from "next/link";
import { PixelDrawer } from "./pixel";
import { ACCENT, type Accent } from "./accent";
import { useT } from "@/modules/shared/i18n";

// #59 — 탭바의 [홈] 슬롯을 대체하는 우상단 홈 버튼: 도트 서랍 + 도메인색 손잡이
export function HomeButton({ accent }: { accent: Accent }) {
  const a = ACCENT[accent];
  const t = useT();
  return (
    <Link
      href="/home"
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 font-dot text-dot tracking-dot ${a.pill} ${a.text}`}
    >
      <PixelDrawer size={14} accent={a.hex} />{t.common.home}
    </Link>
  );
}

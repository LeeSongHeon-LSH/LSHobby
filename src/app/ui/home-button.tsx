"use client";

import Link from "next/link";
import { PixelDrawer } from "./pixel";

// #59 — 탭바의 [홈] 슬롯을 대체하는 우상단 홈 버튼: 도트 서랍 + 도메인색 손잡이
const ACCENT = {
  lib: { text: "text-lib", pill: "border-lib/40 bg-lib-soft", hex: "#4d7fa3" },
  lang: { text: "text-lang", pill: "border-lang/40 bg-lang-soft", hex: "#d9821f" },
  cv: { text: "text-cv", pill: "border-cv/40 bg-cv-soft", hex: "#c05e7c" },
  thought: { text: "text-thought", pill: "border-thought/40 bg-thought-soft", hex: "#6f66a8" },
} as const;

export function HomeButton({ accent }: { accent: keyof typeof ACCENT }) {
  const a = ACCENT[accent];
  return (
    <Link
      href="/home"
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 font-mono text-xs tracking-[0.08em] ${a.pill} ${a.text}`}
    >
      <PixelDrawer size={14} accent={a.hex} />홈
    </Link>
  );
}

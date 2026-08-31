"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HomeButton } from "../ui/home-button";
import { PixelPenguinBubble } from "../ui/pixel";
import {
  languageConfigs,
  loadDeck,
  setCurrentLang,
  todayReviewSummary,
  useCurrentConfig,
} from "@/modules/language";

// §11.4.1 학습 (세션 랜딩) — 덱 + 칩(대상 있을 때만) + 오늘 요약. 헤더 ▾로 언어 전환 (#54)
export default function LanguageHome() {
  const config = useCurrentConfig();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [today, setToday] = useState<{ count: number; correct: number } | null>(null);

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const [{ words, due }, summary] = await Promise.all([
          loadDeck(config),
          todayReviewSummary(config),
        ]);
        if (stale) return;
        setTotal(words.length);
        setDueCount(due.length);
        setToday(summary);
      } catch {
        if (!stale) setDueCount(0);
      }
    })();
    return () => {
      stale = true;
    };
  }, [config]);

  // 열려 있는 동안만 바깥 탭·Esc로 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const switchLang = (code: string) => {
    setMenuOpen(false);
    if (code === config.code) return;
    setDueCount(null);
    setTotal(0);
    setToday(null);
    setCurrentLang(code);
  };

  const free = dueCount === 0;
  return (
    <main className="flex flex-1 flex-col p-4">
      <header className="mb-7 flex items-start justify-between gap-3">
        <div className="relative" ref={menuRef}>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lang">Language</p>
        <h1 className="font-display text-2xl font-bold">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="언어 전환"
            aria-expanded={menuOpen}
            className="inline-flex items-center gap-1.5"
          >
            {config.label}
            <span
              className={`text-base text-faint transition-transform ${menuOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>
        </h1>
        {menuOpen && (
          <div className="anim-rise absolute left-0 top-full z-10 mt-2 w-44 overflow-hidden rounded-lg border border-line bg-card pt-1 shadow-[0_10px_30px_rgba(34,38,43,0.14)]">
            <span className="absolute left-4 top-0 h-1 w-10 bg-lang" aria-hidden="true" />
            {Object.values(languageConfigs).map((c) => {
              const active = c.code === config.code;
              return (
                <button
                  key={c.code}
                  onClick={() => switchLang(c.code)}
                  className={`flex min-h-11 w-full items-center justify-between px-4 py-2.5 text-left ${
                    active ? "bg-lang-soft" : ""
                  }`}
                >
                  <span className={`font-display font-bold ${active ? "" : "text-faint"}`}>
                    {c.label}
                  </span>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.15em] ${
                      active ? "text-lang" : "text-faint"
                    }`}
                  >
                    {c.code}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        </div>
        <HomeButton accent="lang" />
      </header>
      <div className="flex flex-1 flex-col justify-center pb-9">
      <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-lg border border-line bg-card p-8 text-center">
        <span className="absolute left-4 top-0 h-1 w-10 bg-lang" aria-hidden="true" />
        <div className="mb-2.5 flex justify-center"><PixelPenguinBubble size={44} /></div>
        <p className="text-sm text-faint">{free ? "연습" : "복습 대기"}</p>
        <p className="my-3 font-mono text-5xl font-medium tabular-nums">{free ? "∞" : (dueCount ?? "–")}</p>
        <Link
          href="/language/quiz"
          className="block w-full rounded-md bg-lang py-3 font-medium text-white"
        >
          시작하기
        </Link>
      </div>

      <p className="mt-6 text-center font-mono text-xs text-faint">
        {today && today.count > 0
          ? `오늘 ${today.count}회 복습 · 정답률 ${Math.round((today.correct / today.count) * 100)}% · `
          : ""}
        전체 {total}단어
      </p>
      </div>
    </main>
  );
}

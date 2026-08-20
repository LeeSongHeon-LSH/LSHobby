"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HomeButton } from "../ui/home-button";
import { PixelFlame, PixelPenguinBubble } from "../ui/pixel";
import {
  isHard,
  languageConfigs,
  setCurrentLang,
  todayPool,
  todayReviewSummary,
  useCurrentConfig,
} from "@/modules/language";

// §11.4.1 학습 (세션 랜딩) — 덱 + 칩(대상 있을 때만) + 오늘 요약. 헤더 ▾로 언어 전환 (#54)
export default function LanguageHome() {
  const config = useCurrentConfig();
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [hardCount, setHardCount] = useState(0);
  const [today, setToday] = useState<{ count: number; correct: number } | null>(null);

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const [{ words, pool, stats }, summary] = await Promise.all([
          todayPool(config),
          todayReviewSummary(config),
        ]);
        if (stale) return;
        setTotal(words.length);
        setDueCount(pool.length);
        setHardCount(
          words.filter((w) => {
            const s = stats.get(w.id);
            return s ? isHard(s.reviews, s.correct) : false;
          }).length,
        );
        setToday(summary);
      } catch {
        if (!stale) setDueCount(0);
      }
    })();
    return () => {
      stale = true;
    };
  }, [config]);

  const switchLang = (code: string) => {
    setDueCount(null);
    setTotal(0);
    setHardCount(0);
    setToday(null);
    setCurrentLang(code);
  };

  const free = dueCount === 0;
  return (
    <main className="flex flex-1 flex-col p-4">
      <header className="mb-7 flex items-start justify-between gap-3">
        <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lang">Language</p>
        <h1 className="font-display text-2xl font-bold">
          <select
            value={config.code}
            onChange={(e) => switchLang(e.target.value)}
            aria-label="언어 전환"
            className="appearance-none bg-transparent font-display font-bold"
          >
            {Object.values(languageConfigs).map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="ml-1 text-base text-faint">▾</span>
        </h1>
        </div>
        <HomeButton accent="lang" />
      </header>
      <div className="flex flex-1 flex-col justify-center pb-9">
      <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-lg border border-line bg-card p-8 text-center">
        <span className="absolute left-4 top-0 h-1 w-10 bg-lang" aria-hidden="true" />
        <div className="mb-2.5 flex justify-center"><PixelPenguinBubble size={44} /></div>
        <p className="text-sm text-faint">{free ? "자유 연습" : "오늘 복습"}</p>
        <p className="my-3 font-mono text-5xl font-medium tabular-nums">{free ? "∞" : (dueCount ?? "–")}</p>
        <Link
          href="/language/quiz"
          className="block w-full rounded-md bg-lang py-3 font-medium text-white"
        >
          시작하기
        </Link>
      </div>

      {hardCount > 0 && (
        <div className="mt-5 text-center">
          <Link
            href="/language/quiz?hard=1"
            className="inline-flex items-center gap-1.5 rounded-full border border-err/30 bg-err/5 px-4 py-2 text-sm text-err"
          >
            <PixelFlame size={12} />어려운 단어 {hardCount}개
          </Link>
        </div>
      )}

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

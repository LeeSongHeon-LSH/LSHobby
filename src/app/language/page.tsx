"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { esConfig, isHard, reviewStats, todayPool, todayReviewSummary } from "@/modules/language";

// §11.4.1 학습 (세션 랜딩) — 덱 + 칩(대상 있을 때만) + 오늘 요약
export default function LanguageHome() {
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [hardCount, setHardCount] = useState(0);
  const [today, setToday] = useState<{ count: number; correct: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ words, pool }, stats, summary] = await Promise.all([
          todayPool(esConfig),
          reviewStats(esConfig),
          todayReviewSummary(esConfig),
        ]);
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
        setDueCount(0);
      }
    })();
  }, []);

  const free = dueCount === 0;
  return (
    <main className="p-4">
      <h1 className="mb-8 text-lg font-semibold">언어 · 스페인어</h1>
      <div className="mx-auto max-w-xs rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-neutral-500">{free ? "자유 연습" : "오늘 복습"}</p>
        <p className="my-3 text-5xl font-bold tabular-nums">{free ? "∞" : (dueCount ?? "–")}</p>
        <Link
          href="/language/quiz"
          className="block w-full rounded-lg bg-neutral-900 py-3 font-medium text-white"
        >
          시작하기
        </Link>
      </div>

      {hardCount > 0 && (
        <div className="mt-5 text-center">
          <Link
            href="/language/quiz?hard=1"
            className="inline-block rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-700"
          >
            🔥 어려운 단어 {hardCount}개
          </Link>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-neutral-400">
        {today && today.count > 0
          ? `오늘 ${today.count}회 복습 · 정답률 ${Math.round((today.correct / today.count) * 100)}% · `
          : ""}
        전체 {total}단어
      </p>
    </main>
  );
}

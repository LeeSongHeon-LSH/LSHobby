"use client";

import { useEffect, useState } from "react";
import { esConfig, todayPool } from "@/modules/language";

// §11.4.1 학습 (세션 랜딩) — 덱: 오늘 복습 수 + 시작. 퀴즈 화면은 다음 단계
export default function LanguageHome() {
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    todayPool(esConfig)
      .then(({ words, pool }) => {
        setTotal(words.length);
        setDueCount(pool.length);
      })
      .catch(() => setDueCount(0));
  }, []);

  return (
    <main className="p-4">
      <h1 className="mb-8 text-lg font-semibold">언어 · 스페인어</h1>
      <div className="mx-auto max-w-xs rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-neutral-500">{dueCount === 0 ? "자유 연습" : "오늘 복습"}</p>
        <p className="my-3 text-5xl font-bold tabular-nums">{dueCount ?? "–"}</p>
        <button
          disabled
          className="w-full rounded-lg bg-neutral-900 py-3 font-medium text-white opacity-40"
          title="퀴즈는 다음 단계에서 구현"
        >
          시작하기 (준비 중)
        </button>
      </div>
      <p className="mt-6 text-center text-sm text-neutral-400">전체 {total}단어</p>
    </main>
  );
}

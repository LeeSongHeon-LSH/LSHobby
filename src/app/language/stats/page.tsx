"use client";

import { useEffect, useState } from "react";
import {
  buildCsv,
  esConfig,
  fetchStats,
  listWords,
  reviewStats,
  stateLabel,
  type LangStats,
  type Word,
} from "@/modules/language";

// §11.4.4 통계 — 전부 es_review_log 파생 집계 (결정 #36), 상태 분포는 FSRS state
export default function StatsPage() {
  const [stats, setStats] = useState<LangStats | null>(null);
  const [words, setWords] = useState<Word[]>([]);

  useEffect(() => {
    (async () => {
      const ws = await listWords(esConfig);
      setWords(ws);
      setStats(await fetchStats(esConfig, ws));
    })().catch(() => {});
  }, []);

  const exportCsv = async () => {
    const per = await reviewStats(esConfig);
    const csv = buildCsv(words, per);
    const bom = String.fromCharCode(0xfeff); // 엑셀 한글 호환
    const url = URL.createObjectURL(new Blob([bom + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "spanish-words.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!stats)
    return (
      <main className="p-4">
        <h1 className="text-lg font-semibold">학습 통계</h1>
      </main>
    );

  const acc =
    stats.totalReviews === 0 ? null : Math.round((stats.totalCorrect / stats.totalReviews) * 100);
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.total));
  const maxState = Math.max(1, ...stats.stateCounts);

  return (
    <main className="p-4">
      <h1 className="mb-4 text-lg font-semibold">학습 통계</h1>

      <div className="mb-6 grid grid-cols-3 gap-2">
        {[
          { v: stats.streak, l: "연속일" },
          { v: stats.todayTotal, l: "오늘" },
          { v: acc === null ? "–" : `${acc}%`, l: "전체 정답률" },
        ].map((t) => (
          <div key={t.l} className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{t.v}</p>
            <p className="mt-1 text-xs text-neutral-500">{t.l}</p>
          </div>
        ))}
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-neutral-500">최근 14일 학습량</h2>
        <div className="flex h-20 items-end gap-1 rounded-xl border border-neutral-200 bg-white p-3">
          {stats.daily.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.total}회`}
              className="flex-1 rounded-t bg-neutral-800"
              style={{ height: `${(d.total / maxDaily) * 100}%`, minHeight: d.total > 0 ? 3 : 0 }}
            />
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-neutral-500">FSRS 상태 분포</h2>
        <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
          {stats.stateCounts.map((n, state) => (
            <div key={state} className="flex items-center gap-2 text-sm">
              <span className="w-14 shrink-0 text-neutral-500">{stateLabel(state)}</span>
              <div className="h-3 rounded bg-neutral-800" style={{ width: `${(n / maxState) * 70}%` }} />
              <span className="tabular-nums text-neutral-600">{n}</span>
            </div>
          ))}
        </div>
      </section>

      <button
        onClick={exportCsv}
        className="w-full rounded-lg border border-neutral-300 bg-white py-3 font-medium"
      >
        CSV 내보내기
      </button>
    </main>
  );
}

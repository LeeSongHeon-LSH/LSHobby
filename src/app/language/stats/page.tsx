"use client";

import { useEffect, useState } from "react";
import { HomeButton } from "../../ui/home-button";
import { PixelPenguinBubble } from "../../ui/pixel";
import {
  buildCsv,
  useCurrentConfig,
  fetchStats,
  listWords,
  reviewStats,
  type LangStats,
  type Word,
} from "@/modules/language";
import { useT } from "@/modules/shared/i18n";

// §11.4.4 통계 — 전부 es_review_log 파생 집계 (결정 #36), 상태 분포는 FSRS state
export default function StatsPage() {
  const config = useCurrentConfig();
  const t = useT();
  const langName = t.lang.languageNames[config.code] ?? config.label;
  // 어느 언어의 집계인지 함께 담는다 — 하이드레이션 스냅샷(es)으로 나간 요청이 늦게 오면 영어 헤더
  // 아래 스페인어 통계가 들어가고 CSV는 두 언어를 id로 섞는다. 실패는 로딩에 머무는 대신 말한다
  const [loaded, setLoaded] = useState<{ code: string; stats: LangStats; words: Word[] } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const stats = loaded?.code === config.code ? loaded.stats : null;
  const words = loaded?.code === config.code ? loaded.words : [];

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const ws = await listWords(config);
        const st = await fetchStats(config, ws);
        if (stale) return;
        setLoaded({ code: config.code, stats: st, words: ws });
        setLoadFailed(false);
      } catch {
        if (!stale) setLoadFailed(true);
      }
    })();
    return () => {
      stale = true;
    };
  }, [config]);

  const exportCsv = async () => {
    const per = await reviewStats(config);
    const csv = buildCsv(words, per);
    const bom = String.fromCharCode(0xfeff); // 엑셀 한글 호환
    const url = URL.createObjectURL(new Blob([bom + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.code}-words.csv`;
    // 문서에 붙여야 한다 — WebKit은 붙지 않은 anchor의 programmatic download를 무시한다.
    // 해제도 같은 틱에 하면 안 된다: 다운로드가 시작하기 전에 blob URL이 죽는다.
    // 이 앱은 standalone PWA(모바일 주 타깃)라 둘 다 지키지 않으면 조용히 아무 일도 안 일어난다
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (!stats)
    return (
      <main className="p-4">
        <header>
          <p className="font-dot text-dot uppercase tracking-dot-wide text-lang">{langName}</p>
          <h1 className="font-display text-2xl font-bold">{t.lang.stats.title}</h1>
        </header>
        <p className={`mt-16 text-center text-sm ${loadFailed ? "text-err" : "text-faint"}`}>
          {loadFailed ? t.lang.stats.loadFailed : t.common.loading}
        </p>
      </main>
    );

  const acc =
    stats.totalReviews === 0 ? null : Math.round((stats.totalCorrect / stats.totalReviews) * 100);
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.total));
  const maxState = Math.max(1, ...stats.stateCounts);

  return (
    <main className="flex flex-1 flex-col p-4">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-dot text-dot uppercase tracking-dot-wide text-lang">{langName}</p>
          <h1 className="font-display text-2xl font-bold">{t.lang.stats.title}</h1>
        </div>
        <HomeButton accent="lang" />
      </header>

      <div className="mb-7 grid grid-cols-3 gap-2">
        {[
          { v: stats.streak, l: t.lang.stats.streak },
          { v: stats.todayTotal, l: t.lang.stats.today },
          { v: acc === null ? "–" : `${acc}%`, l: t.lang.stats.accuracy },
        ].map((tile) => (
          <div key={tile.l} className="rounded-md border border-line bg-card p-4 text-center">
            <p className="font-dot text-dot-lg tabular-nums">{tile.v}</p>
            <p className="mt-1 text-xs text-faint">{tile.l}</p>
          </div>
        ))}
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-faint">{t.lang.stats.last14}</h2>
        <div className="flex h-28 items-end gap-1 rounded-md border border-line bg-card p-3">
          {stats.daily.map((d) => (
            <div
              key={d.date}
              title={t.lang.stats.dayTitle(d.date, d.total)}
              className="flex-1 rounded-t-sm bg-lang"
              style={{ height: `${(d.total / maxDaily) * 100}%`, minHeight: d.total > 0 ? 3 : 0 }}
            />
          ))}
          <div className="flex shrink-0 items-end pl-1"><PixelPenguinBubble size={26} /></div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-faint">{t.lang.stats.stateDist}</h2>
        <div className="space-y-2 rounded-md border border-line bg-card p-4">
          {stats.stateCounts.map((n, state) => (
            <div key={state} className="flex items-center gap-2 text-sm">
              <span className="w-14 shrink-0 text-faint">{t.lang.states[state] ?? "?"}</span>
              <div className="h-3 rounded-sm bg-lang" style={{ width: `${(n / maxState) * 70}%` }} />
              <span className="font-dot text-dot tabular-nums text-faint">{n}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="flex-1" />
      <button
        onClick={exportCsv}
        className="w-full rounded-md border border-lang/40 bg-lang-soft py-3 font-medium"
      >
        {t.lang.stats.exportCsv}
      </button>
    </main>
  );
}

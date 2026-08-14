import { supabase } from "../shared/auth";
import type { LanguageConfig } from "./types";
import type { Word } from "./words";

/** 로컬 기준 YYYY-MM-DD */
export const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface DailyCount {
  date: string;
  total: number;
  correct: number;
}

export interface LangStats {
  streak: number;
  todayTotal: number;
  totalReviews: number;
  totalCorrect: number;
  daily: DailyCount[]; // 오래된 → 최신 14일
  stateCounts: [number, number, number, number]; // New/Learning/Review/Relearning
}

/** 연속 학습일 (구 stats.py compute_streak 이식) — 마지막 학습이 오늘/어제인 연속만 인정 */
export function computeStreak(datesDesc: string[], today: string): number {
  if (datesDesc.length === 0) return 0;
  const dayMs = 86400000;
  const t = new Date(today).getTime();
  const latest = new Date(datesDesc[0]).getTime();
  if ((t - latest) / dayMs > 1) return 0;
  let streak = 1;
  let prev = latest;
  for (const ds of datesDesc.slice(1)) {
    const d = new Date(ds).getTime();
    if ((prev - d) / dayMs === 1) {
      streak += 1;
      prev = d;
    } else break;
  }
  return streak;
}

/** 로그·단어에서 통계 집계 (전부 review_log 파생 — 결정 #36) */
export function aggregate(
  logs: { rating: number; reviewed_at: string }[],
  words: Word[],
  now: Date = new Date(),
): LangStats {
  const byDay = new Map<string, { total: number; correct: number }>();
  for (const l of logs) {
    const day = localDate(new Date(l.reviewed_at));
    const e = byDay.get(day) ?? { total: 0, correct: 0 };
    e.total += 1;
    if (l.rating >= 2) e.correct += 1;
    byDay.set(day, e);
  }
  const today = localDate(now);
  const daily: DailyCount[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = localDate(new Date(now.getTime() - i * 86400000));
    const e = byDay.get(d);
    daily.push({ date: d, total: e?.total ?? 0, correct: e?.correct ?? 0 });
  }
  const datesDesc = [...byDay.keys()].sort().reverse();
  const stateCounts: [number, number, number, number] = [0, 0, 0, 0];
  for (const w of words) stateCounts[w.state] = (stateCounts[w.state] ?? 0) + 1;
  return {
    streak: computeStreak(datesDesc, today),
    todayTotal: byDay.get(today)?.total ?? 0,
    totalReviews: logs.length,
    totalCorrect: logs.filter((l) => l.rating >= 2).length,
    daily,
    stateCounts,
  };
}

export async function fetchStats(config: LanguageConfig, words: Word[]): Promise<LangStats> {
  const { data, error } = await supabase
    .from(config.reviewLogTable)
    .select("rating, reviewed_at");
  if (error) throw error;
  return aggregate(data as { rating: number; reviewed_at: string }[], words);
}

/** CSV export (§6.5 — 구 EXPORT_COLUMNS를 FSRS 체계로) */
export function buildCsv(words: Word[], perWord: Map<number, { reviews: number; correct: number }>): string {
  const esc = (v: unknown): string => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["word", "gender", "meaning", "reviews", "correct", "state", "due", "created_at"];
  const lines = [header.join(",")];
  for (const w of words) {
    const s = perWord.get(w.id) ?? { reviews: 0, correct: 0 };
    lines.push(
      [w.word, w.gender, w.meaning, s.reviews, s.correct, w.state, w.due ?? "", w.created_at]
        .map(esc)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

import { supabase } from "../shared/auth";
import type { LanguageConfig } from "./types";

export interface WordStat {
  reviews: number;
  correct: number;
}

/** 단어별 복습 횟수·정답 수 — 전부 review_log 파생 (결정 #36). rating≥2 = 정답(Good) */
export async function reviewStats(config: LanguageConfig): Promise<Map<number, WordStat>> {
  const { data, error } = await supabase.from(config.reviewLogTable).select("word_id, rating");
  if (error) throw error;
  const map = new Map<number, WordStat>();
  for (const r of data as { word_id: number; rating: number }[]) {
    const s = map.get(r.word_id) ?? { reviews: 0, correct: 0 };
    s.reviews += 1;
    if (r.rating >= 2) s.correct += 1;
    map.set(r.word_id, s);
  }
  return map;
}

export const dayStartIso = (now: Date): string =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

/** 오늘의 학습 요약 — 일별 activity 요약(§6.4)·덱 하단 표시용 */
export async function todayReviewSummary(
  config: LanguageConfig,
  now: Date = new Date(),
): Promise<{ count: number; correct: number }> {
  const { data, error } = await supabase
    .from(config.reviewLogTable)
    .select("rating")
    .gte("reviewed_at", dayStartIso(now));
  if (error) throw error;
  const ratings = data as { rating: number }[];
  return { count: ratings.length, correct: ratings.filter((r) => r.rating >= 2).length };
}

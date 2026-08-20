import { duePool } from "./srs";
import { listWords, type Word } from "./words";
import { reviewStats, type WordStat } from "./review-stats";
import type { LanguageConfig } from "./types";

/**
 * 오늘 처음 복습을 시작한 단어 수 — 신규 일일 한도 차감분.
 * word_stats의 최초 복습 시각으로 판정하는 순수 함수 (구 2연쇄 쿼리 대체, 성능 리뷰 P1)
 */
export function countNewStartedToday(stats: Map<number, WordStat>, now: Date = new Date()): number {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let n = 0;
  for (const s of stats.values()) {
    if (s.firstReviewedAt && new Date(s.firstReviewedAt).getTime() >= from) n += 1;
  }
  return n;
}

/** 오늘 출제 풀 (§6.3 — due 복습 전부 + 새 단어 남은 한도만큼). 단어·집계 병렬 조회, 통계도 함께 반환 */
export async function todayPool(
  config: LanguageConfig,
  now: Date = new Date(),
): Promise<{ words: Word[]; pool: Word[]; stats: Map<number, WordStat> }> {
  const [words, stats] = await Promise.all([listWords(config), reviewStats(config)]);
  return { words, pool: duePool(words, now, countNewStartedToday(stats, now)), stats };
}

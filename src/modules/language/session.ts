import { supabase } from "../shared/auth";
import { duePool } from "./srs";
import { listWords, type Word } from "./words";
import type { LanguageConfig } from "./types";

const dayStartIso = (now: Date): string =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

/**
 * 오늘 처음 복습을 시작한 단어 수 — 신규 일일 한도 차감분
 * (구 count_words_first_attempted_on 이식, es_review_log 파생 — 결정 #36)
 */
export async function countNewStartedToday(config: LanguageConfig, now: Date = new Date()): Promise<number> {
  const from = dayStartIso(now);
  const { data: today, error } = await supabase
    .from(config.reviewLogTable)
    .select("word_id")
    .gte("reviewed_at", from);
  if (error) throw error;
  const ids = [...new Set(today.map((r) => r.word_id as number))];
  if (ids.length === 0) return 0;
  const { data: before, error: e2 } = await supabase
    .from(config.reviewLogTable)
    .select("word_id")
    .lt("reviewed_at", from)
    .in("word_id", ids);
  if (e2) throw e2;
  const seen = new Set(before.map((r) => r.word_id as number));
  return ids.filter((id) => !seen.has(id)).length;
}

/** 오늘 출제 풀 (§6.3 — due 복습 전부 + 새 단어 남은 한도만큼) */
export async function todayPool(
  config: LanguageConfig,
  now: Date = new Date(),
): Promise<{ words: Word[]; pool: Word[] }> {
  const words = await listWords(config);
  const newStarted = await countNewStartedToday(config, now);
  return { words, pool: duePool(words, now, newStarted) };
}

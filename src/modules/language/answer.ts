import { supabase } from "../shared/auth";
import { upsertDaily } from "../shared/activity";
import { applyAnswer, type SrsFields } from "./srs";
import { todayReviewSummary } from "./stats";
import type { LanguageConfig } from "./types";
import type { Word } from "./words";

/**
 * 답안 1건 반영 (docs/14 §14.3):
 * FSRS 상태 갱신 → review_log 1행 → activity 일별 요약 upsert (§6.4)
 */
export async function answerWord(
  config: LanguageConfig,
  word: Word,
  correct: boolean,
  now: Date = new Date(),
): Promise<SrsFields> {
  const { fields, rating } = applyAnswer(word, correct, now);
  const { error } = await supabase.from(config.wordTable).update(fields).eq("id", word.id);
  if (error) throw error;
  const { error: logErr } = await supabase
    .from(config.reviewLogTable)
    .insert({ word_id: word.id, rating, reviewed_at: now.toISOString() });
  if (logErr) throw logErr;

  const { count, correct: ok } = await todayReviewSummary(config, now);
  const rate = count === 0 ? 0 : Math.round((ok / count) * 100);
  await upsertDaily(
    "language",
    `${config.code}_review_day`,
    0,
    "reviewed",
    `단어 ${count}개 복습, 정답률 ${rate}%`,
    now,
  );
  return fields;
}

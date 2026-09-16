import { supabase } from "../shared/auth";
import { upsertDaily } from "../shared/activity";
import type { SrsFields } from "./srs";
import { todayReviewSummary } from "./stats";
import type { LanguageConfig } from "./types";
import type { Grade } from "ts-fsrs";

/**
 * 답안 1건 저장 (docs/14 §14.3):
 * FSRS 필드 갱신 → review_log 1행 → activity 일별 요약 upsert (§6.4)
 * FSRS 계산(applyAnswer)은 호출부가 먼저 한다 — 세션이 재출제 시각을 저장을 기다리지 않고 알아야 해서
 */
export async function saveAnswer(
  config: LanguageConfig,
  wordId: number,
  applied: { fields: SrsFields; rating: Grade },
  now: Date = new Date(),
): Promise<void> {
  const { fields, rating } = applied;
  const { error } = await supabase.from(config.wordTable).update(fields).eq("id", wordId);
  if (error) throw error;
  const { error: logErr } = await supabase
    .from(config.reviewLogTable)
    .insert({ word_id: wordId, rating, reviewed_at: now.toISOString() });
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
}

import { supabase } from "../shared/auth";
import { upsertDaily } from "../shared/activity";
import type { SrsFields } from "./srs";
import { todayReviewSummary } from "./stats";
import type { LanguageConfig } from "./types";
import type { Grade } from "ts-fsrs";

/**
 * 답안 1건 저장 (docs/14 §14.3):
 * FSRS 필드 갱신 + review_log 1행(한 트랜잭션, RPC record_answer) → activity 일별 요약 upsert (§6.4)
 * FSRS 계산(applyAnswer)은 호출부가 먼저 한다 — 세션이 재출제 시각을 저장을 기다리지 않고 알아야 해서.
 * prevLastReview는 덱을 읽었을 때의 last_review — 그사이 다른 기기가 먼저 채점했으면 RPC가 거부한다(P0002)
 */
export async function saveAnswer(
  config: LanguageConfig,
  wordId: number,
  applied: { fields: SrsFields; rating: Grade },
  prevLastReview: string | null,
  now: Date = new Date(),
): Promise<void> {
  const { fields, rating } = applied;
  const { error } = await supabase.rpc("record_answer", {
    lang: config.code,
    p_word_id: wordId,
    p_fields: { ...fields },
    p_rating: rating,
    p_reviewed_at: now.toISOString(),
    ...(prevLastReview === null ? {} : { p_prev_last_review: prevLastReview }),
  });
  if (error) throw error;

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

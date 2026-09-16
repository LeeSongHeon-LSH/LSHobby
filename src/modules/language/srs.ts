import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";

/** es_words(및 향후 en_words) 행의 FSRS 컬럼 — ts-fsrs Card와 1:1 (docs/09 §9.3) */
export interface SrsFields {
  due: string | null;
  stability: number | null;
  difficulty: number | null;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  learning_steps: number;
  state: number;
  last_review: string | null;
}

/**
 * 학습·재학습 스텝 3단계 (2026-09-16, #99) — 새 단어는 같은 세션에서 세 번 맞혀야 Review로 간다.
 * ts-fsrs 기본(1분·10분)은 두 번이었다. 첫 Good은 1분 스텝을 건너뛰어 5분으로 가고 Again은 1분으로 돌아온다.
 * 나머지 파라미터는 기본값 (개인 최적화는 이력이 쌓인 뒤 검토, §6.6 17)
 */
export const LEARNING_STEPS = ["1m", "5m", "15m"] as const;
const scheduler = fsrs({ learning_steps: LEARNING_STEPS, relearning_steps: LEARNING_STEPS });

export function toCard(row: SrsFields): Card {
  return {
    due: row.due ? new Date(row.due) : new Date(0), // null = 즉시 출제 대상
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    learning_steps: row.learning_steps,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

export function fromCard(card: Card): SrsFields {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learning_steps,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

/** 자동 채점 이분 매핑 (docs/06 §6.3): 정답=Good(3), 오답=Again(1) */
export const ratingFor = (correct: boolean): Grade => (correct ? Rating.Good : Rating.Again);

/** 답안 1건 반영 → 갱신된 FSRS 필드 + es_review_log에 남길 rating */
export function applyAnswer(
  row: SrsFields,
  correct: boolean,
  now: Date,
): { fields: SrsFields; rating: Grade } {
  const rating = ratingFor(correct);
  const card = row.state === State.New ? createEmptyCard(now) : toCard(row);
  const next = scheduler.next(card, now, rating);
  return { fields: fromCard(next.card), rating };
}

export const isNew = (row: SrsFields): boolean => row.state === State.New;

/** 학습 스텝 안에 있는 카드 — 세션 안 재출제 대상 */
export const isLearning = (row: SrsFields): boolean =>
  row.state === State.Learning || row.state === State.Relearning;

export const isDue = (row: SrsFields, now: Date): boolean =>
  row.due === null || new Date(row.due) <= now;

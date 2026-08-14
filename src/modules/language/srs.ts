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

const scheduler = fsrs(); // 기본 파라미터 (개인 최적화는 이력이 쌓인 뒤 검토)

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

export const isDue = (row: SrsFields, now: Date): boolean =>
  row.due === null || new Date(row.due) <= now;

/** 새 카드 일일 한도 (구 앱 DAILY_NEW_LIMIT 이식) */
export const DAILY_NEW_LIMIT = 20;

export interface PoolWord extends SrsFields {
  id: number;
}

/**
 * 오늘 출제 풀 (구 quiz.py _due_pool 이식):
 * due 지난 복습 전부 + 새 단어는 (한도 − 오늘 이미 시작한 새 단어 수)까지 id 순.
 */
export function duePool<T extends PoolWord>(
  words: T[],
  now: Date,
  newStartedToday: number,
  newLimit: number = DAILY_NEW_LIMIT,
): T[] {
  const reviews = words.filter((w) => !isNew(w) && isDue(w, now));
  const quota = Math.max(0, newLimit - newStartedToday);
  const fresh = words
    .filter(isNew)
    .sort((a, b) => a.id - b.id)
    .slice(0, quota);
  return [...reviews, ...fresh];
}

/** 어려운 단어 판정 (구 quiz.py is_hard 이식) — 수치는 es_review_log 파생 집계 (결정 #36) */
export const HARD_MIN_REVIEWS = 4;
export const HARD_MAX_ACCURACY = 0.6;
export const isHard = (reviews: number, correct: number): boolean =>
  reviews >= HARD_MIN_REVIEWS && correct / reviews < HARD_MAX_ACCURACY;

/** 오답률 가중치 (구 quiz.py _weight 이식) — Laplace smoothing */
export const pickWeight = (reviews: number, correct: number): number =>
  (reviews - correct + 1) / (reviews + 1);

/** 가중 랜덤 추첨 (구 random.choices 상당) */
export function weightedPick<T>(pool: T[], weight: (t: T) => number, rand: () => number = Math.random): T | null {
  if (pool.length === 0) return null;
  const weights = pool.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

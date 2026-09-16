import { isDue, isLearning, isNew } from "./srs";
import { listWords, type Word } from "./words";
import { reviewStats, type WordStat } from "./review-stats";
import type { LanguageConfig } from "./types";

/**
 * 학습 세션 (결정 2026-09-16, #99 — 소개 단계·세션 안 재출제·복습 우선):
 *
 *   ① 세션 안에서 due가 다시 도래한 Learning·Relearning 카드 (FSRS 학습 스텝 1·5·15분)
 *   ② 소개 카드를 본 뒤 몇 장 지난 단어의 첫 인출
 *   ③ due 지난 복습 — 정답률 오름차순 → 오래 안 본 순 → 난수
 *   ④ 신규 — 하루 고정 난수로 섞고, 상한 12개·세션 정답률 75% 가드 안에서만
 *   ⑤ 남은 것이 대기 카드뿐이면 due를 기다리지 않고 낸다 (Anki의 learn-ahead)
 *   전부 비면 세션 끝. due 아닌 카드는 내지 않는다 (#81이 막은 "연습이 일정을 덮어쓰기").
 *
 * 2026-09-02(#82)의 "복습·신규 1:1 교대, 한 바퀴 = 전체 단어"는 오답의 1분·10분 재출제가
 * 세션 안에서 소화되지 않아 Learning에 카드가 고였다(es 258 중 130). 신규는 소개 없이 시험을
 * 봤다. 둘이 "틀리기만 한다"의 기계적 원인이었다.
 *
 * 소개 카드: New이거나 정답 기록이 0회인 단어의 첫 등장. FSRS에 기록하지 않는다.
 */

export const NEW_CAP = 12;
export const GUARD_MIN_ANSWERS = 10;
export const GUARD_ACCURACY = 0.75;
/** 소개 뒤 첫 인출까지 사이에 두는 카드 수 — 보고 바로 답하면 단기 기억에서 읽어낸다 */
const FIRST_RETRIEVAL_GAP = 3;
/** 이보다 먼 due는 세션 안 재출제 대상이 아니다 (학습 스텝은 최대 15분) */
const REQUEUE_HORIZON_MS = 60 * 60_000;

export type SessionCard = { kind: "intro" | "quiz"; word: Word };

/** 문자열 시드 → [0,1) 난수 (mulberry32) — 신규 순서를 하루 안에서 고정해, 나갔다 들어와도 같은 단어를 만난다 */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class StudySession {
  private readonly reviews: Word[];
  private readonly fresh: Word[];
  private readonly learning: { word: Word; due: number }[] = [];
  private readonly delayed: { word: Word; after: number }[] = [];
  private readonly introduced = new Set<number>();
  private shown = 0;
  /** 이번 세션에 채점한 수·맞힌 수·소개한 신규 수 */
  answered = 0;
  correct = 0;
  newCount = 0;

  constructor(
    words: Word[],
    private readonly stats: Map<number, WordStat>,
    now: Date = new Date(),
    rand: () => number = Math.random,
  ) {
    // 비교 도중 값이 흔들리면 정렬이 깨진다 — 무작위 키를 미리 뽑아 둔다
    const shuffle = new Map(words.map((w) => [w.id, rand()]));
    const accuracy = (w: Word): number => {
      const s = stats.get(w.id);
      return s && s.reviews > 0 ? s.correct / s.reviews : 0;
    };
    const lastSeen = (w: Word): number => (w.last_review ? new Date(w.last_review).getTime() : 0);
    this.reviews = words
      .filter((w) => !isNew(w) && isDue(w, now))
      .sort(
        (a, b) =>
          accuracy(a) - accuracy(b) || lastSeen(a) - lastSeen(b) || shuffle.get(a.id)! - shuffle.get(b.id)!,
      );
    this.fresh = words.filter(isNew).sort((a, b) => shuffle.get(a.id)! - shuffle.get(b.id)!);
  }

  /** 다음 카드. null이면 오늘 몫이 끝났다 */
  next(now: Date = new Date()): SessionCard | null {
    this.shown += 1;
    const t = now.getTime();
    const dueIdx = this.earliestLearning((d) => d <= t);
    if (dueIdx >= 0) return { kind: "quiz", word: this.learning.splice(dueIdx, 1)[0].word };
    const dIdx = this.delayed.findIndex((d) => d.after <= this.shown);
    if (dIdx >= 0) return { kind: "quiz", word: this.delayed.splice(dIdx, 1)[0].word };
    const review = this.reviews.shift();
    if (review) return this.present(review);
    if (this.fresh.length > 0 && this.newAllowed()) {
      this.newCount += 1;
      return this.present(this.fresh.shift()!);
    }
    if (this.delayed.length > 0) return { kind: "quiz", word: this.delayed.shift()!.word };
    const aheadIdx = this.earliestLearning(() => true);
    if (aheadIdx >= 0) return { kind: "quiz", word: this.learning.splice(aheadIdx, 1)[0].word };
    return null;
  }

  /**
   * 오늘 소개될 수 있는 신규 단어 — 상한만큼 앞에서부터. 예문을 미리 데우는 데 쓴다:
   * 소개 카드는 예문 캐시가 없는 첫 등장이라, 화면이 뜬 뒤에 Tatoeba를 처음 물으면 늦는다
   */
  upcomingFresh(): Word[] {
    return this.fresh.slice(0, NEW_CAP - this.newCount);
  }

  /**
   * 채점 결과 반영 — FSRS 필드가 이미 갱신된 단어를 받는다.
   * Learning·Relearning으로 남았으면 그 due에 맞춰 세션 안에서 다시 낸다
   */
  graded(word: Word, ok: boolean, now: Date = new Date()): void {
    this.answered += 1;
    if (ok) this.correct += 1;
    const s = this.stats.get(word.id) ?? { reviews: 0, correct: 0 };
    this.stats.set(word.id, { reviews: s.reviews + 1, correct: s.correct + (ok ? 1 : 0) });
    if (!isLearning(word) || !word.due) return;
    const due = new Date(word.due).getTime();
    if (due - now.getTime() <= REQUEUE_HORIZON_MS) this.learning.push({ word, due });
  }

  private present(word: Word): SessionCard {
    if (!this.needsIntro(word)) return { kind: "quiz", word };
    this.introduced.add(word.id);
    this.delayed.push({ word, after: this.shown + FIRST_RETRIEVAL_GAP });
    return { kind: "intro", word };
  }

  private needsIntro(word: Word): boolean {
    if (this.introduced.has(word.id)) return false;
    if (isNew(word)) return true;
    const s = this.stats.get(word.id);
    return s !== undefined && s.reviews > 0 && s.correct === 0;
  }

  private newAllowed(): boolean {
    if (this.newCount >= NEW_CAP) return false;
    return this.answered < GUARD_MIN_ANSWERS || this.correct / this.answered >= GUARD_ACCURACY;
  }

  private earliestLearning(pick: (due: number) => boolean): number {
    let best = -1;
    this.learning.forEach((l, i) => {
      if (pick(l.due) && (best < 0 || l.due < this.learning[best].due)) best = i;
    });
    return best;
  }
}

/**
 * 문제 방향 — 수용 먼저(Q2·§6.3): New·Learning·Relearning은 단어→뜻(뒤집기)만.
 * Review는 단어→뜻·뜻→단어 반반, 30% 확률로 빈칸 시도(예문 없으면 호출부가 폴백).
 * Review 안의 승급 기준(stability)은 2단계에서 정한다.
 */
export function pickDirection(word: Word, rand: () => number = Math.random): { dir: "sk" | "ks"; tryCloze: boolean } {
  if (isNew(word) || isLearning(word)) return { dir: "sk", tryCloze: false };
  return { dir: rand() < 0.5 ? "sk" : "ks", tryCloze: rand() < 0.3 };
}

/** 내일이 끝나기 전에 due가 오는 단어 수 — 끝 화면의 "내일 복습" (로컬 날짜 기준) */
export function dueByTomorrow(words: Word[], now: Date = new Date()): number {
  const until = new Date(now);
  until.setHours(0, 0, 0, 0);
  until.setDate(until.getDate() + 2);
  return words.filter((w) => !isNew(w) && w.due !== null && new Date(w.due) < until).length;
}

/** 덱 전체 + 단어별 집계 (단어·집계 병렬 조회) */
export async function loadDeck(config: LanguageConfig): Promise<{ words: Word[]; stats: Map<number, WordStat> }> {
  const [words, stats] = await Promise.all([listWords(config), reviewStats(config)]);
  return { words, stats };
}

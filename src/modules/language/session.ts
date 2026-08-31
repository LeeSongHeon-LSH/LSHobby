import { isDue, isNew } from "./srs";
import { listWords, type Word } from "./words";
import { reviewStats, type WordStat } from "./review-stats";
import type { LanguageConfig } from "./types";

/**
 * 연습 출제 순서 (결정 2026-08-31 — 하루 할당 폐지, 한 세션은 원하는 만큼):
 *   ① due 지난 복습 → ② 신규 → ③ 아직 due 아닌 것
 *
 * 복습은 유한하고 신규는 무한하다. 신규를 앞에 두면 신규가 매 세션 앞을 다 채워 복습이
 * 영영 나오지 않으므로, 유한한 복습을 먼저 비운다. 굶는 쪽이 없다.
 *
 * 각 구간은 정답률 오름차순 → 오래 안 본 순 → 랜덤. 신규는 집계가 없어 정답률 0%가 되므로
 * 별도 분기 없이 ③보다 앞에 서고, 구간 안에서는 등록 순(기초 단어부터)으로 나간다.
 * 한 바퀴가 전체 단어라 한 세션에서 같은 단어를 두 번 만나지 않는다.
 */
export function practiceOrder<T extends Word>(
  words: T[],
  stats: Map<number, WordStat>,
  now: Date = new Date(),
  rand: () => number = Math.random,
): T[] {
  // 비교 도중 값이 흔들리면 정렬이 깨진다 — 무작위 키를 미리 뽑아 둔다
  const shuffle = new Map(words.map((w) => [w.id, rand()]));
  const accuracy = (w: T): number => {
    const s = stats.get(w.id);
    return s && s.reviews > 0 ? s.correct / s.reviews : 0;
  };
  const lastSeen = (w: T): number => (w.last_review ? new Date(w.last_review).getTime() : 0);
  const compare = (a: T, b: T): number =>
    accuracy(a) - accuracy(b) ||
    lastSeen(a) - lastSeen(b) ||
    shuffle.get(a.id)! - shuffle.get(b.id)!;

  const fresh = words.filter(isNew).sort((a, b) => a.id - b.id);
  const seen = words.filter((w) => !isNew(w));
  return [
    ...seen.filter((w) => isDue(w, now)).sort(compare),
    ...fresh,
    ...seen.filter((w) => !isDue(w, now)).sort(compare),
  ];
}

/** 덱 전체 + 복습 대기분 + 단어별 집계 (단어·집계 병렬 조회) */
export async function loadDeck(
  config: LanguageConfig,
  now: Date = new Date(),
): Promise<{ words: Word[]; due: Word[]; stats: Map<number, WordStat> }> {
  const [words, stats] = await Promise.all([listWords(config), reviewStats(config)]);
  return { words, due: words.filter((w) => !isNew(w) && isDue(w, now)), stats };
}

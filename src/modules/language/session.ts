import { isDue, isNew } from "./srs";
import { listWords, type Word } from "./words";
import { reviewStats, type WordStat } from "./review-stats";
import type { LanguageConfig } from "./types";

/**
 * 연습 출제 순서 (결정 2026-09-02 — 섞어 내기):
 *   ① due 지난 복습과 신규를 1:1로 교대 → ② 아직 due 아닌 것
 *
 * 2026-08-31에는 복습을 전부 앞에 두고 신규를 뒤에 붙였다(복습은 유한, 신규는 무한이라
 * 신규가 앞을 채우면 복습이 굶는다는 이유). 그러나 오답은 FSRS가 1분·10분 뒤로 잡아 다음
 * 세션 시작 시 거의 항상 due라서, 세션이 due 수(당시 25)보다 짧으면 신규를 영영 못 만났다.
 * 매 세션 본 단어만 보게 되어, 정답률이 떨어지더라도 새 단어를 만나는 쪽을 택했다.
 * 교대라 복습도 굶지 않는다. 한쪽이 바닥나면 남은 쪽을 이어 낸다.
 *
 * 복습 구간(①·②)은 정답률 오름차순 → 오래 안 본 순 → 랜덤. 신규는 등록 순(기초 단어부터).
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
    ...interleave(seen.filter((w) => isDue(w, now)).sort(compare), fresh),
    ...seen.filter((w) => !isDue(w, now)).sort(compare),
  ];
}

/** a·b를 번갈아 하나씩 — 한쪽이 끝나면 나머지를 그대로 잇는다 */
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

/** 덱 전체 + 복습 대기분 + 단어별 집계 (단어·집계 병렬 조회) */
export async function loadDeck(
  config: LanguageConfig,
  now: Date = new Date(),
): Promise<{ words: Word[]; due: Word[]; stats: Map<number, WordStat> }> {
  const [words, stats] = await Promise.all([listWords(config), reviewStats(config)]);
  return { words, due: words.filter((w) => !isNew(w) && isDue(w, now)), stats };
}

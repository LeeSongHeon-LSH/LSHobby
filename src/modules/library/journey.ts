import type { BookListItem } from "./books";

// #58 독서 여정 — 완독 20권 = 한 보(步). 여정 번호·보 배치의 단일 규칙 원본 (화면은 이 함수만 쓴다)

export const VOL_CAP = 20;

/** 여정 정렬 — 최초 완독 오름차순, 미완독(기록 0)은 끝, 동일 날짜는 id 오름차순 */
export function sortJourney(books: BookListItem[]): BookListItem[] {
  return [...books].sort(
    (a, b) =>
      (a.firstFinishedOn ?? "9999").localeCompare(b.firstFinishedOn ?? "9999") || a.id - b.id,
  );
}

/** 보(步) 단위 분할 — 20권씩 */
export function chunkVolumes(journey: BookListItem[]): BookListItem[][] {
  const out: BookListItem[][] = [];
  for (let i = 0; i < journey.length; i += VOL_CAP) out.push(journey.slice(i, i + VOL_CAP));
  return out;
}

/** 책 id → 여정 번호(1-base) — 완독 이력이 있는 책만 대상 */
export function journeyNumbers(books: BookListItem[]): Map<number, number> {
  const j = sortJourney(books.filter((b) => b.readCount > 0));
  return new Map(j.map((b, i) => [b.id, i + 1]));
}

/**
 * 완독 기록 미리보기 — 이번 완독일까지 반영한 여정 번호.
 * 최초 완독일 = min(기존 최초 완독일, 이번 완독일)이므로 재독을 과거로 소급하면 번호가 앞당겨질 수 있다.
 * 동일 날짜는 id 오름차순 — 방금 등록한 새 책은 id가 가장 커서 같은 날짜의 기존 책들 뒤에 선다.
 */
export function previewJourneyNo(
  books: BookListItem[],
  pickedId: number,
  finishedOn: string,
): number {
  const prior = books.find((b) => b.id === pickedId)?.firstFinishedOn ?? null;
  const first = prior && prior <= finishedOn ? prior : finishedOn;
  const ahead = books.filter(
    (b) =>
      b.id !== pickedId &&
      b.readCount > 0 &&
      b.firstFinishedOn !== null &&
      (b.firstFinishedOn < first || (b.firstFinishedOn === first && b.id < pickedId)),
  ).length;
  return ahead + 1;
}

/** 여정 번호 → 몇 보(步)인가 */
export function volOf(no: number): number {
  return Math.floor((no - 1) / VOL_CAP) + 1;
}

/** 여정 번호 → 보 안에서 몇 쪽(1~20)인가 */
export function noInVol(no: number): number {
  return ((no - 1) % VOL_CAP) + 1;
}

import { describe, expect, it } from "vitest";
import type { BookListItem } from "./books";
import {
  VOL_CAP,
  bookNav,
  chunkVolumes,
  journeyNumbers,
  noInVol,
  previewJourneyNo,
  sortJourney,
  volOf,
} from "./journey";

// #58 독서 여정 규칙 — 서재 책장·완독 기록 미리보기가 공유하는 단일 원본(journey.ts) 검증

const book = (
  id: number,
  firstFinishedOn: string | null,
  readCount = firstFinishedOn ? 1 : 0,
): BookListItem => ({
  id,
  title: `책${id}`,
  author: "저자",
  translator: null,
  publisher: "출판사",
  pub_year: "2000",
  note: null,
  created_at: "2026-01-01",
  readCount,
  firstFinishedOn,
  lastFinishedOn: firstFinishedOn,
  lastRating: null,
  tags: [],
});

describe("sortJourney — 최초 완독 오름차순", () => {
  it("최초 완독일 순으로 정렬하고, 완독 기록 없는 책은 끝에 둔다", () => {
    const j = sortJourney([book(2, "2026-03-01"), book(3, null), book(1, "2026-01-01")]);
    expect(j.map((b) => b.id)).toEqual([1, 2, 3]);
  });

  it("동일 날짜는 id 오름차순 — 방금 등록한 책(최대 id)이 뒤에 선다", () => {
    const j = sortJourney([book(5, "2026-02-01"), book(2, "2026-02-01")]);
    expect(j.map((b) => b.id)).toEqual([2, 5]);
  });
});

describe("chunkVolumes — 20권 = 한 보(步)", () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => book(i + 1, "2026-01-01"));

  it("빈 서재는 보가 없다", () => {
    expect(chunkVolumes([])).toEqual([]);
  });

  it("정확히 20권이면 완결된 한 보", () => {
    const vols = chunkVolumes(many(VOL_CAP));
    expect(vols).toHaveLength(1);
    expect(vols[0]).toHaveLength(VOL_CAP);
  });

  it("21번째 기록에서 다음 보가 태어난다", () => {
    const vols = chunkVolumes(many(VOL_CAP + 1));
    expect(vols).toHaveLength(2);
    expect(vols[1]).toHaveLength(1);
  });
});

describe("journeyNumbers — 완독 이력이 있는 책만 번호를 받는다", () => {
  it("완독 기록 0인 책은 여정 번호가 없다", () => {
    const nos = journeyNumbers([book(1, "2026-01-01"), book(2, null)]);
    expect(nos.get(1)).toBe(1);
    expect(nos.has(2)).toBe(false);
  });
});

describe("previewJourneyNo — 완독일까지 반영한 번호 미리보기", () => {
  const shelf = [book(1, "2026-01-10"), book(2, "2026-02-10"), book(3, "2026-03-10")];

  it("새 책(목록에 없음)을 최신 날짜로 기록하면 마지막 다음 번호", () => {
    expect(previewJourneyNo(shelf, 99, "2026-08-01")).toBe(4);
  });

  it("새 책을 과거 날짜로 소급하면 그 날짜 자리에 끼어든다", () => {
    expect(previewJourneyNo(shelf, 99, "2026-01-20")).toBe(2);
  });

  it("기존 책과 같은 날짜면 id 순서 — 새 책(id 최대)은 그 뒤", () => {
    expect(previewJourneyNo(shelf, 99, "2026-02-10")).toBe(3);
  });

  it("재독을 더 늦은 날짜로 기록해도 번호는 그대로 (최초 완독일 불변)", () => {
    expect(previewJourneyNo(shelf, 2, "2026-08-01")).toBe(2);
    expect(previewJourneyNo(shelf, 2, "2026-08-01")).toBe(journeyNumbers(shelf).get(2));
  });

  it("재독을 기존 최초 완독일보다 이전으로 소급하면 번호가 앞당겨진다", () => {
    expect(previewJourneyNo(shelf, 3, "2026-01-01")).toBe(1);
  });
});

describe("bookNav — 펼친 책 넘김 산술 (모바일 한 쪽 / 데스크톱 양면)", () => {
  // 완결 보: 목차 2 + 여정 20 = 22쪽 / 진행중 보(4권): 목차 2 + 여정 4 + 빈 쪽 1 = 7쪽
  const FULL = 22;
  const PARTIAL = 7;

  it("한 쪽 모드 — 첫 쪽은 이전 없음, 끝 쪽은 다음 없음", () => {
    expect(bookNav(FULL, 0, false)).toMatchObject({ total: FULL, step: 1, base: 0, hasPrev: false, hasNext: true });
    expect(bookNav(FULL, FULL - 1, false)).toMatchObject({ base: FULL - 1, hasPrev: true, hasNext: false });
  });

  it("양면 모드 — 홀수 쪽이면 빈 쪽을 덧대 짝수 펼침이 된다", () => {
    expect(bookNav(PARTIAL, 0, true).total).toBe(PARTIAL + 1);
    expect(bookNav(FULL, 0, true).total).toBe(FULL);
  });

  it("양면 모드 — 홀수 인덱스도 같은 펼침(짝수 base)으로 정렬된다", () => {
    expect(bookNav(FULL, 3, true).base).toBe(2);
    expect(bookNav(FULL, 4, true).base).toBe(4);
  });

  it("양면 모드 — 첫 펼침(목차 i·ii)은 이전 없음, 마지막 펼침은 다음 없음", () => {
    expect(bookNav(FULL, 0, true)).toMatchObject({ step: 2, hasPrev: false, hasNext: true });
    expect(bookNav(FULL, FULL - 2, true)).toMatchObject({ hasPrev: true, hasNext: false });
    expect(bookNav(PARTIAL, PARTIAL - 1, true)).toMatchObject({ base: PARTIAL - 1, hasNext: false });
  });
});

describe("volOf · noInVol — 여정 번호의 보 배치", () => {
  it.each([
    [1, 1, 1],
    [VOL_CAP, 1, VOL_CAP],
    [VOL_CAP + 1, 2, 1],
    [VOL_CAP * 2, 2, VOL_CAP],
  ])("여정 %i → 제%i보 %i쪽", (no, vol, inVol) => {
    expect(volOf(no)).toBe(vol);
    expect(noInVol(no)).toBe(inVol);
  });
});

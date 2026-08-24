import { describe, expect, it } from "vitest";
import { dayKey, groupByDay, mergeThoughts, type Thought } from "./service";

const at = (y: number, m: number, d: number, h: number) =>
  new Date(y, m - 1, d, h).toISOString();

const t = (id: number, created_at: string): Thought => ({
  id,
  content: `생각 ${id}`,
  topics: null,
  created_at,
});

describe("thought 날짜 그룹핑", () => {
  it("dayKey: 로컬 기준 YYYY-MM-DD", () => {
    expect(dayKey(at(2026, 8, 21, 9))).toBe("2026-08-21");
    expect(dayKey(at(2026, 1, 3, 23))).toBe("2026-01-03");
  });

  it("groupByDay: 같은 날은 묶고 순서 유지, 날짜가 바뀌면 새 그룹", () => {
    const list = [
      t(3, at(2026, 8, 21, 22)),
      t(2, at(2026, 8, 21, 9)),
      t(1, at(2026, 8, 20, 23)),
    ];
    const groups = groupByDay(list);
    expect(groups.map((g) => g.day)).toEqual(["2026-08-21", "2026-08-20"]);
    expect(groups[0].items.map((i) => i.id)).toEqual([3, 2]);
    expect(groups[1].items.map((i) => i.id)).toEqual([1]);
  });

  it("groupByDay: 빈 목록은 빈 배열", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("mergeThoughts (검색 결과 병합)", () => {
  it("id 중복 제거 + 최신순 정렬 + limit 적용", () => {
    const a = [t(3, at(2026, 8, 21, 22)), t(1, at(2026, 8, 20, 9))];
    const b = [t(2, at(2026, 8, 21, 9)), t(1, at(2026, 8, 20, 9))];
    expect(mergeThoughts(a, b, 80).map((x) => x.id)).toEqual([3, 2, 1]);
    expect(mergeThoughts(a, b, 2).map((x) => x.id)).toEqual([3, 2]);
  });
});

import { describe, expect, it } from "vitest";
import { dayKey, groupByDay, mergeThoughts, topTopics, type Thought } from "./service";
import { parseStreamLine } from "./philosophy";

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

describe("topTopics (주제 궤적 집계)", () => {
  it("빈도순 정렬, 동률은 이름순, limit·null 처리", () => {
    const lists = [["습관", "정체성"], null, ["습관"], ["예문", "정체성"], ["습관"]];
    expect(topTopics(lists)).toEqual([
      ["습관", 3],
      ["정체성", 2],
      ["예문", 1],
    ]);
    expect(topTopics(lists, 1)).toEqual([["습관", 3]]);
    expect(topTopics([])).toEqual([]);
  });
});

describe("parseStreamLine (철학 문답 스트림)", () => {
  it("본문 조각 추출, 빈 줄·본문 없는 줄·완성 마커는 빈 문자열", () => {
    expect(
      parseStreamLine('{"message":{"role":"assistant","content":"Kant argued"},"done":false}'),
    ).toBe("Kant argued");
    expect(parseStreamLine('{"done":true,"total_duration":123}')).toBe("");
    expect(parseStreamLine("")).toBe("");
    expect(parseStreamLine("잘린 조각 {")).toBe("");
  });

  it("error 응답은 예외로 던진다", () => {
    expect(() => parseStreamLine('{"error":"model not found"}')).toThrow("model not found");
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

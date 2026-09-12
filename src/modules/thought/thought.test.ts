import { describe, expect, it } from "vitest";
import {
  arrayLiteralElement,
  ilikePattern,
  dayKey,
  groupByDay,
  mergeThoughts,
  topTopics,
  type Thought,
} from "./service";

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

describe("mergeThoughts (검색 결과 병합)", () => {
  it("id 중복 제거 + 최신순 정렬 + limit 적용", () => {
    const a = [t(3, at(2026, 8, 21, 22)), t(1, at(2026, 8, 20, 9))];
    const b = [t(2, at(2026, 8, 21, 9)), t(1, at(2026, 8, 20, 9))];
    expect(mergeThoughts(a, b, 80).map((x) => x.id)).toEqual([3, 2, 1]);
    expect(mergeThoughts(a, b, 2).map((x) => x.id)).toEqual([3, 2]);
  });
});

describe("arrayLiteralElement (PostgREST 배열 리터럴 인용 — docs/18 §18.2 G)", () => {
  it("평범한 주제는 그대로 인용한다", () => {
    expect(arrayLiteralElement("AI")).toBe('"AI"');
  });

  it("쉼표가 원소 경계가 되지 않는다 — 인용 없으면 `AI, 설계`가 두 원소로 갈린다", () => {
    expect(arrayLiteralElement("AI, 설계")).toBe('"AI, 설계"');
  });

  it("따옴표·역슬래시를 이스케이프해 리터럴이 깨지지 않는다", () => {
    expect(arrayLiteralElement('he said "hi"')).toBe('"he said \\"hi\\""');
    expect(arrayLiteralElement("back\\slash")).toBe('"back\\\\slash"');
  });

  it("중괄호는 인용 안에서 안전하다 — 인용 없으면 400이 난다", () => {
    expect(arrayLiteralElement("a}b")).toBe('"a}b"');
  });
});

describe("ilikePattern (내용 검색 — 와일드카드 이스케이프)", () => {
  it("평범한 질의는 앞뒤에 % 하나씩만 붙인다", () => {
    expect(ilikePattern("설계")).toBe("%설계%");
  });

  it("PostgREST가 %로 별칭 처리하는 *도 막는다", () => {
    expect(ilikePattern("a*b")).toBe("%a\\*b%");
  });

  it("%·_·역슬래시를 이스케이프한다", () => {
    expect(ilikePattern("50%")).toBe("%50\\%%");
    expect(ilikePattern("a_b")).toBe("%a\\_b%");
    expect(ilikePattern("c\\d")).toBe("%c\\\\d%");
  });
});

import { describe, expect, it } from "vitest";
import { ko } from "./ko";
import { en } from "./en";
import { es } from "./es";

// 사전 형태는 타입이 지키지만, 빈 문자열·빠진 배열 원소는 타입을 통과한다 — 여기서 잡는다
const leaves = (o: unknown, path = ""): [string, unknown][] =>
  o && typeof o === "object" && !Array.isArray(o)
    ? Object.entries(o).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
    : [[path, o]];

const dicts = { ko, en, es };

describe("UI 문구 사전", () => {
  it.each(Object.entries(dicts))("%s — 문자열 잎이 비어 있지 않다", (_n, d) => {
    for (const [path, v] of leaves(d)) {
      if (typeof v === "string") expect(v, path).not.toBe("");
      // 배열 원소는 문자열이면 된다 — volParts의 접미처럼 빈 조각이 정상인 경우가 있다
      if (Array.isArray(v)) expect(v.every((x) => typeof x === "string"), path).toBe(true);
    }
  });

  it("고정 길이 배열(요일 7·FSRS 상태 4·책등 조각 2)이 언어마다 같다", () => {
    for (const d of Object.values(dicts)) {
      expect(d.thoughts.weekdays).toHaveLength(7);
      expect(d.lang.states).toHaveLength(4);
      expect(d.library.volParts).toHaveLength(2);
    }
  });

  it("언어마다 잎 경로 집합이 ko와 같다", () => {
    const paths = (d: unknown) => leaves(d).map(([p]) => p).sort();
    expect(paths(en)).toEqual(paths(ko));
    expect(paths(es)).toEqual(paths(ko));
  });
});

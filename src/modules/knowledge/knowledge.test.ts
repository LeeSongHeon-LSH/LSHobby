import { describe, expect, it } from "vitest";
import { extractWikiLinks, renderWikiLinks, replaceWikiTitle } from "./wikilink";

describe("위키링크 (§8.2)", () => {
  it("extract: trim·중복 제거, 줄바꿈·빈 링크 제외", () => {
    const md = "리더 선출은 [[타임아웃]] 기반. [[ 타임아웃 ]]과 [[Paxos]] 비교. [[]] 무시";
    expect(extractWikiLinks(md)).toEqual(["타임아웃", "Paxos"]);
  });
  it("replaceTitle: 정확한 [[제목]]만 일괄 치환", () => {
    const md = "[[Raft]]와 [[Raft 합의]]는 다른 링크. Raft 평문은 유지";
    expect(replaceWikiTitle(md, "Raft", "Raft 합의")).toBe(
      "[[Raft 합의]]와 [[Raft 합의]]는 다른 링크. Raft 평문은 유지",
    );
  });
  it("render: 존재 → 상세 링크, dangling → red 생성 링크", () => {
    const index = new Map([["타임아웃", 7]]);
    const out = renderWikiLinks("[[타임아웃]]과 [[페이지 교체]]", index);
    expect(out).toContain("[타임아웃](/knowledge/concept/7)");
    expect(out).toContain("[페이지 교체](/knowledge/edit?title=");
    expect(out).toContain("&red=1)");
  });
});

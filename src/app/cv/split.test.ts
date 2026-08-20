import { describe, expect, it } from "vitest";
import { splitSections } from "./split";

// #61 섹션 필터 — h2 기준 분할 규칙 (서버 렌더·클라 필터가 공유)
describe("splitSections", () => {
  it("h2가 없으면 전부 intro", () => {
    const md = "# 이름\n소개 문단";
    expect(splitSections(md)).toEqual({ intro: md, sections: [] });
  });

  it("h2 기준으로 제목·본문을 자른다", () => {
    const { intro, sections } = splitSections("# 이름\n\n## 소개\n안녕\n\n## 기술\nTS");
    expect(intro).toBe("# 이름\n");
    expect(sections.map((s) => s.title)).toEqual(["소개", "기술"]);
    expect(sections[0].body).toBe("## 소개\n안녕\n");
    expect(sections[1].body).toBe("## 기술\nTS");
  });

  it("문서가 h2로 시작하면 intro 없음", () => {
    const { intro, sections } = splitSections("## 소개\n안녕");
    expect(intro).toBe("");
    expect(sections).toHaveLength(1);
  });

  it("빈 문서", () => {
    expect(splitSections("")).toEqual({ intro: "", sections: [] });
  });
});

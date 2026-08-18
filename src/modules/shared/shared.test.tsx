import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "./markdown";

// ---- supabase 체이닝 mock (activity 발행 규칙 검증용) ----

type Call = { table: string; method: string; args: unknown[] };
const calls: Call[] = [];
let selectData: unknown[] = [];

vi.mock("./auth", () => ({
  supabase: {
    from(table: string) {
      const ops: string[] = [];
      const builder: Record<string, unknown> = {};
      for (const m of ["select", "insert", "update", "delete", "eq", "gte", "lt", "in", "limit", "order"]) {
        builder[m] = (...args: unknown[]) => {
          calls.push({ table, method: m, args });
          ops.push(m);
          return builder;
        };
      }
      builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        const result = ops.includes("select") ? { data: selectData, error: null } : { error: null };
        return Promise.resolve(result).then(resolve, reject);
      };
      return builder;
    },
  },
}));

const of = (table: string, method: string) =>
  calls.filter((c) => c.table === table && c.method === method);

describe("activity 발행 규칙 (FR-03 · §6.4)", () => {
  beforeEach(() => {
    calls.length = 0;
    selectData = [];
  });

  it("publish: activity_feed에 건별 이벤트 1행 insert", async () => {
    const { publish } = await import("./activity");
    await publish("library", "quote", 7, "created", "인용구 저장");
    expect(of("activity_feed", "insert").map((c) => c.args[0])).toEqual([
      { domain: "library", entity_type: "quote", entity_id: 7, action: "created", summary: "인용구 저장" },
    ]);
  });

  it("upsertDaily: 당일 이벤트가 없으면 새로 발행한다", async () => {
    const { upsertDaily } = await import("./activity");
    await upsertDaily("language", "es_review_day", 0, "reviewed", "단어 3개 복습, 정답률 100%");
    expect(of("activity_feed", "insert")).toHaveLength(1);
    expect(of("activity_feed", "update")).toHaveLength(0);
  });

  it("upsertDaily: 당일 이벤트가 있으면 그 행의 요약만 갱신한다 (일별 1건)", async () => {
    selectData = [{ id: 42 }];
    const { upsertDaily } = await import("./activity");
    await upsertDaily("language", "es_review_day", 0, "reviewed", "단어 12개 복습, 정답률 83%");
    expect(of("activity_feed", "insert")).toHaveLength(0);
    const updates = of("activity_feed", "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].args[0]).toMatchObject({ summary: "단어 12개 복습, 정답률 83%" });
    // 갱신 대상은 당일 조회로 찾은 그 행
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "id" && c.args[1] === 42)).toBe(true);
  });
});

describe("마크다운 sanitize (SEC-05 — 저장 XSS 차단)", () => {
  const render = (md: string) => renderToStaticMarkup(<Markdown>{md}</Markdown>);

  it("script 태그는 제거된다", () => {
    const html = render("본문 <script>alert(1)</script> 끝");
    expect(html).not.toContain("<script");
  });

  it("인라인 이벤트 핸들러는 제거된다", () => {
    const html = render('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });

  it("javascript: 링크는 제거된다", () => {
    const html = render("[클릭](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("정상 마크다운은 그대로 렌더된다", () => {
    expect(render("**굵게**")).toContain("<strong>굵게</strong>");
  });
});

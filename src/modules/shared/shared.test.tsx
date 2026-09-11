import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "./markdown";

// ---- supabase 체이닝 mock (activity 발행 규칙 검증용) ----
//
// 필터를 **실제로 적용한다**. 인자를 무시하고 selectData를 그대로 돌려주면
// upsertDaily에서 .eq("action", …)·.gte/.lt를 통째로 지워도 테스트가 통과해,
// "일별 1건" 규칙을 지키는 유일한 검사가 그 규칙의 제거를 감지하지 못한다.
// ISO-8601 UTC 문자열은 사전순 비교가 시간순과 같아 gte/lt를 문자열로 견준다.

type Row = Record<string, unknown>;
type Call = { table: string; method: string; args: unknown[] };
const calls: Call[] = [];
let selectData: Row[] = [];

vi.mock("./auth", () => ({
  supabase: {
    from(table: string) {
      const ops: string[] = [];
      let rows: Row[] = [];
      let take: number | null = null;
      const builder: Record<string, unknown> = {};
      const keep = (pred: (r: Row) => boolean) => {
        rows = rows.filter(pred);
      };
      const filters: Record<string, (col: string, val: unknown) => void> = {
        eq: (col, val) => keep((r) => r[col] === val),
        gte: (col, val) => keep((r) => String(r[col]) >= String(val)),
        lt: (col, val) => keep((r) => String(r[col]) < String(val)),
        in: (col, val) => keep((r) => (val as unknown[]).includes(r[col])),
      };
      for (const m of ["select", "insert", "update", "delete", "eq", "gte", "lt", "in", "limit", "order"]) {
        builder[m] = (...args: unknown[]) => {
          calls.push({ table, method: m, args });
          ops.push(m);
          if (m === "select") rows = [...selectData];
          else if (m === "limit") take = args[0] as number;
          else filters[m]?.(args[0] as string, args[1]);
          return builder;
        };
      }
      builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        const data = take === null ? rows : rows.slice(0, take);
        const result = ops.includes("select") ? { data, error: null } : { error: null };
        return Promise.resolve(result).then(resolve, reject);
      };
      return builder;
    },
  },
}));

// 하루 경계는 프로덕션과 같은 식으로 뽑는다(로컬 타임존) — 타임존에 안 흔들리게
const NOW = new Date("2026-09-11T12:00:00Z");
const dayFrom = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
const HOUR = 3600_000;
const at = (ms: number) => new Date(dayFrom.getTime() + ms).toISOString();

const feedRow = (id: number, over: Row = {}): Row => ({
  id,
  domain: "language",
  entity_type: "es_review_day",
  entity_id: 0,
  action: "reviewed",
  occurred_at: at(HOUR),
  ...over,
});

// upsertDaily의 필터 여섯 개가 각각 걸러내야 하는 행. 정답 행보다 **앞**에 둬서
// 필터 하나라도 빠지면 limit(1)이 집는 행이 바뀌고 테스트가 깨진다
const decoys: Row[] = [
  feedRow(1, { domain: "library" }), // eq domain
  feedRow(2, { entity_type: "cs_note" }), // eq entity_type
  feedRow(3, { entity_id: 7 }), // eq entity_id
  feedRow(4, { action: "created" }), // eq action
  feedRow(5, { occurred_at: at(-HOUR) }), // gte from — 어제
  feedRow(6, { occurred_at: at(24 * HOUR + HOUR) }), // lt to — 내일
];

const of = (table: string, method: string) =>
  calls.filter((c) => c.table === table && c.method === method);

describe("activity 발행 규칙 (FR-03 · §6.4)", () => {
  beforeEach(() => {
    calls.length = 0;
    selectData = [];
  });

  it("publish: activity_feed에 건별 이벤트 1행 insert", async () => {
    const { publish } = await import("./activity");
    await publish("library", "book", 7, "created", "책 등록");
    expect(of("activity_feed", "insert").map((c) => c.args[0])).toEqual([
      { domain: "library", entity_type: "book", entity_id: 7, action: "created", summary: "책 등록" },
    ]);
  });

  it("upsertDaily: 당일 이벤트가 없으면 새로 발행한다 (미끼 행은 전부 걸러져야 한다)", async () => {
    selectData = decoys; // 하나라도 통과하면 insert가 아니라 update가 된다
    const { upsertDaily } = await import("./activity");
    await upsertDaily("language", "es_review_day", 0, "reviewed", "단어 3개 복습, 정답률 100%", NOW);
    expect(of("activity_feed", "insert")).toHaveLength(1);
    expect(of("activity_feed", "update")).toHaveLength(0);
  });

  it("upsertDaily: 당일 이벤트가 있으면 그 행의 요약만 갱신한다 (일별 1건)", async () => {
    selectData = [...decoys, feedRow(42)];
    const { upsertDaily } = await import("./activity");
    await upsertDaily("language", "es_review_day", 0, "reviewed", "단어 12개 복습, 정답률 83%", NOW);
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

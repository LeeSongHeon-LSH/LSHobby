import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "./markdown";

// ---- supabase 체이닝 mock (activity 발행 규칙 검증용) ----
//
// "일별 1건"은 2026-09-12부터 DB 유니크 인덱스가 지킨다(#96) — 코드가 하는 일은
// **조회 없이 한 번 upsert 하는 것**과 **충돌 열을 그 인덱스와 똑같이 대는 것**뿐이라
// mock도 호출 기록만 남기면 된다. 필터를 실제로 적용하던 이전 mock은 upsertDaily의
// select 여섯 필터를 지키려던 것이라 그 필터와 함께 사라졌다.

type Call = { table: string; method: string; args: unknown[] };
const calls: Call[] = [];

vi.mock("./auth", () => ({
  supabase: {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      for (const m of ["select", "insert", "upsert", "update", "delete", "eq", "limit", "order"]) {
        builder[m] = (...args: unknown[]) => {
          calls.push({ table, method: m, args });
          return builder;
        };
      }
      builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject);
      return builder;
    },
  },
}));

const NOW = new Date("2026-09-11T12:00:00Z");

const of = (table: string, method: string) =>
  calls.filter((c) => c.table === table && c.method === method);

/** 마이그레이션이 만든 유니크 인덱스의 열 목록 — upsert의 on_conflict가 이것과 같아야 한다 */
const uniqueIndexColumns = (): string => {
  const sql = readFileSync(
    join(__dirname, "../../../supabase/migrations/20260912090000_activity_daily_unique.sql"),
    "utf8",
  );
  const m = /create unique index idx_activity_feed_daily\s+on activity_feed \(([^)]+)\)/.exec(sql);
  expect(m, "마이그레이션에서 유니크 인덱스를 못 찾음").toBeTruthy();
  return m![1].split(",").map((c) => c.trim()).join(",");
};

describe("activity 발행 규칙 (FR-03 · §6.4)", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("publish: activity_feed에 건별 이벤트 1행 insert", async () => {
    const { publish } = await import("./activity");
    await publish("library", "book", 7, "created", "책 등록");
    expect(of("activity_feed", "insert").map((c) => c.args[0])).toEqual([
      { domain: "library", entity_type: "book", entity_id: 7, action: "created", summary: "책 등록" },
    ]);
  });

  it("publish: occurred_on을 비워 둔다 — NULL이라야 같은 날 여러 건이 그대로 쌓인다", async () => {
    const { publish } = await import("./activity");
    await publish("library", "book", 7, "created", "책 등록");
    expect(of("activity_feed", "insert")[0].args[0]).not.toHaveProperty("occurred_on");
  });

  it("upsertDaily: 조회 없이 upsert 한 번 — select 후 insert의 경합 창을 남기지 않는다", async () => {
    const { upsertDaily } = await import("./activity");
    await upsertDaily("language", "es_review_day", 0, "reviewed", "단어 3개 복습, 정답률 100%", NOW);
    expect(of("activity_feed", "select")).toHaveLength(0);
    expect(of("activity_feed", "insert")).toHaveLength(0);
    expect(of("activity_feed", "update")).toHaveLength(0);
    expect(of("activity_feed", "upsert")).toHaveLength(1);
  });

  it("upsertDaily: 유니크 인덱스를 이루는 다섯 열을 그대로 보내고, 충돌 열도 같다", async () => {
    const { upsertDaily } = await import("./activity");
    await upsertDaily("language", "es_review_day", 0, "reviewed", "단어 12개 복습, 정답률 83%", NOW);
    const [row, opts] = of("activity_feed", "upsert")[0].args as [Record<string, unknown>, { onConflict: string }];
    // 열 목록이 어긋나면 런타임 42P10 — 게이트가 아니라 첫 복습에서 터진다
    expect(opts.onConflict).toBe(uniqueIndexColumns());
    for (const col of uniqueIndexColumns().split(",")) expect(row).toHaveProperty(col);
    expect(row).toMatchObject({
      domain: "language",
      entity_type: "es_review_day",
      entity_id: 0,
      action: "reviewed",
      summary: "단어 12개 복습, 정답률 83%",
    });
  });

  // 이 PC는 UTC라 아무 시각이나 쓰면 로컬 날짜와 UTC 날짜가 같아져
  // `now.toISOString().slice(0,10)` 같은 구현도 통과한다 — 날짜가 실제로 갈리는 조건을 만든다.
  // Node는 process.env.TZ 재할당을 Date에 바로 반영한다
  it("upsertDaily: occurred_on은 UTC가 아니라 브라우저 로컬 날짜다 (일 경계 = §6.4)", async () => {
    const prev = process.env.TZ;
    process.env.TZ = "Asia/Seoul";
    try {
      const { upsertDaily } = await import("./activity");
      const nearMidnight = new Date("2026-09-11T20:00:00Z"); // KST로는 이미 9/12
      await upsertDaily("language", "es_review_day", 0, "reviewed", "요약", nearMidnight);
      const row = of("activity_feed", "upsert")[0].args[0] as Record<string, unknown>;
      expect(row.occurred_on).toBe("2026-09-12");
      expect(row.occurred_on).not.toBe(nearMidnight.toISOString().slice(0, 10));
    } finally {
      process.env.TZ = prev;
    }
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

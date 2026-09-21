import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 스키마 드리프트 — 마이그레이션이 만든 표 목록과 생성 타입(database.types.ts)의 표 목록이 같아야 한다.
// 표를 추가·삭제하고 npm run db:types를 잊으면 여기서 잡힌다. (컬럼 변경은 재생성으로만 잡힌다)
const root = join(__dirname, "..");

function tablesFromMigrations(): Set<string> {
  const dir = join(root, "supabase/migrations");
  const live = new Set<string>();
  for (const f of readdirSync(dir).sort()) {
    const sql = readFileSync(join(dir, f), "utf8").toLowerCase();
    for (const m of sql.matchAll(/create table (?:if not exists )?([a-z_]+)/g)) live.add(m[1]);
    for (const m of sql.matchAll(/drop table (?:if exists )?([a-z_]+)/g)) live.delete(m[1]);
  }
  return live;
}

function tablesFromTypes(): Set<string> {
  const ts = readFileSync(join(root, "src/modules/shared/db/database.types.ts"), "utf8");
  const block = /Tables: \{\n([\s\S]*?)\n    \}\n    Views:/.exec(ts);
  expect(block, "생성 타입에서 Tables 블록을 못 찾음").toBeTruthy();
  return new Set([...block![1].matchAll(/^      ([a-z_]+): \{$/gm)].map((m) => m[1]));
}

describe("스키마 드리프트 (마이그레이션 ↔ 생성 타입)", () => {
  it("표 목록이 같다", () => {
    const fromSql = [...tablesFromMigrations()].sort();
    const fromTs = [...tablesFromTypes()].sort();
    expect(fromSql.length).toBeGreaterThan(0);
    expect(fromTs).toEqual(fromSql);
  });
});

// RLS 커버리지 — 마이그레이션이 만든 표는 전부 RLS가 켜져 있고 정책이 붙어 있어야 한다.
// Supabase는 public 표에 anon·authenticated 기본 권한을 주므로, `create table`만 쓰고 RLS 블록을
// 빠뜨리면 그 표는 anon 키(클라이언트 번들에 있다)로 읽고 쓸 수 있다. 표 목록 드리프트(위)와 달리
// 이건 실행해 보기 전엔 아무 데서도 안 걸린다. 기존 마이그레이션이 쓰는 세 문법을 읽는다:
//   ① alter table X enable row level security / create policy … on X
//   ② do $$ … foreach t in array array['a','b'] … $$  (열거한 표)
//   ③ do $$ … from pg_tables where schemaname = 'public' … $$  (그 시점에 살아 있는 표 전부)
// 새 문법을 쓰면 여기서 실패한다 — 그때 이 목록에 한 줄 더한다
function rlsCoverage(): { live: Set<string>; rls: Set<string>; policy: Set<string> } {
  const dir = join(root, "supabase/migrations");
  const live = new Set<string>();
  const rls = new Set<string>();
  const policy = new Set<string>();
  const cover = (targets: Iterable<string>, block: string) => {
    for (const t of targets) {
      if (/enable row level security/.test(block)) rls.add(t);
      if (/create policy/.test(block)) policy.add(t);
    }
  };
  for (const f of readdirSync(dir).sort()) {
    const sql = readFileSync(join(dir, f), "utf8").toLowerCase();
    for (const m of sql.matchAll(/create table (?:if not exists )?([a-z_]+)/g)) live.add(m[1]);
    for (const m of sql.matchAll(/drop table (?:if exists )?([a-z_]+)/g)) {
      live.delete(m[1]);
      rls.delete(m[1]);
      policy.delete(m[1]);
    }
    // ① 단문 — %i 자리표시자는 [a-z_]+에 안 걸리므로 do 블록 안 문장은 여기 안 잡힌다
    for (const m of sql.matchAll(/alter table ([a-z_]+) enable row level security/g)) rls.add(m[1]);
    for (const m of sql.matchAll(/create policy [a-z_]+ on ([a-z_]+)/g)) policy.add(m[1]);
    // ②·③ do 블록
    for (const [block] of sql.matchAll(/do \$\$[\s\S]*?\$\$/g)) {
      const listed = /array\[([^\]]+)\]/.exec(block);
      if (listed) cover([...listed[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]), block);
      else if (/from pg_tables where schemaname = 'public'/.test(block)) cover(live, block);
    }
  }
  return { live, rls, policy };
}

describe("RLS 커버리지 (마이그레이션이 만든 표 전부)", () => {
  const { live, rls, policy } = rlsCoverage();

  it("살아 있는 표는 전부 RLS가 켜져 있다", () => {
    expect(live.size).toBeGreaterThan(0);
    expect([...live].filter((t) => !rls.has(t))).toEqual([]);
  });

  it("살아 있는 표는 전부 정책이 하나는 있다 (RLS만 켜면 authenticated도 막힌다)", () => {
    expect([...live].filter((t) => !policy.has(t))).toEqual([]);
  });
});

// A1 시드 218단어 이식 (§6.5) — 빈 테이블일 때만 시딩 (구 seed.py 정책)
// 실행: node --env-file=.env scripts/seed-es-words.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { count, error: cntErr } = await supabase
  .from("es_words")
  .select("*", { count: "exact", head: true });
if (cntErr) throw cntErr;
if (count > 0) {
  console.log(`es_words에 이미 ${count}건 존재 — 시딩 건너뜀`);
  process.exit(0);
}

const rows = JSON.parse(readFileSync(new URL("../supabase/seed/es_words.json", import.meta.url)));
const { error } = await supabase.from("es_words").insert(rows);
if (error) throw error;
console.log(`시딩 완료: ${rows.length}단어`);

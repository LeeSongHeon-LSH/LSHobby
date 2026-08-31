// 뜻 동의어 백필 배치 — 기존 단어의 한국어 뜻에 동의어를 덧붙인다
// 실행: node --env-file=.env scripts/backfill-meanings.mjs [es|en] [--budget N] [--apply]
//
// 채점기(src/modules/language/grading.ts)는 콤마로 구분된 뜻을 모두 정답으로 받는다.
// "소년"만 저장돼 있으면 "남자아이"가 오답이 되므로, 그 대체 표기를 채워 넣는 배치다.
//
// LLM 제안을 곧바로 DB에 넣지 않는다 — 두 단계다:
//   1) 플래그 없이 실행 → Gemini에 물어 meaning-proposals.<code>.json에 적는다 (DB 안 건드림)
//   2) 파일을 눈으로 고친 뒤 --apply → 파일 그대로 반영한다 (Gemini 호출 없음)
// 잘못된 동의어는 오답을 정답으로 만들어 학습을 망치므로, 검수 없이 넣지 않는다.
//
// 재실행 안전: 제안 파일에 이미 있는 단어는 건너뛴다(동의어 없음으로 판정된 단어 포함).
// 파일 자체가 그 기록이라 지우면 다시 묻는다. 이미 콤마가 있는 뜻도 대상에서 뺀다.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MODEL = "gemini-3.6-flash"; // backfill-sentences.mjs와 동일 — 2.5는 신규 키에서 404
const GEMINI_INTERVAL_MS = 13000;
const GROUP = 16; // 한 호출에 묶는 단어 수
const MAX_SYNONYMS = 3;
const MAX_SYNONYM_LEN = 20; // 설명문이 딸려 오면 버리기 위한 상한

const LANGS = {
  es: { label: "스페인어", wordTable: "es_words", langName: "Spanish" },
  en: { label: "영어", wordTable: "en_words", langName: "English" },
};

const args = process.argv.slice(2);
const langFilter = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
const budgetArg = args.indexOf("--budget");
const BUDGET = budgetArg >= 0 ? Number(args[budgetArg + 1]) : 230;

if (langFilter && !LANGS[langFilter]) {
  console.error(`알 수 없는 언어: ${langFilter} (es | en)`);
  process.exit(1);
}
if (!Number.isFinite(BUDGET) || BUDGET <= 0) {
  console.error("--budget 값이 올바르지 않습니다");
  process.exit(1);
}
if (!APPLY && !process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY가 없습니다 — .env에 추가하세요 (https://aistudio.google.com/apikey)");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proposalPath = (code) => `meaning-proposals.${code}.json`;
// grading.ts의 answerAlternatives·collapse와 같은 규칙 — 여기서도 같은 기준으로 중복을 걸러야 한다
const alternatives = (meaning) => meaning.split(",").map((s) => s.trim()).filter(Boolean);
const collapse = (s) => s.toLowerCase().replace(/\s+/g, "");

// ---------- Gemini (backfill-sentences.mjs와 동일한 호출 규약) ----------
let geminiCalls = 0;
let budgetExhausted = false;

async function gemini(prompt) {
  if (budgetExhausted) return null;
  if (geminiCalls >= BUDGET) {
    budgetExhausted = true;
    return null;
  }
  if (geminiCalls > 0) await sleep(GEMINI_INTERVAL_MS);
  geminiCalls++;
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(120000),
      },
    );
    if (res.status === 429 && attempt < 1) {
      console.log("  … 429 — 분당 한도일 수 있어 65초 대기 후 재시도");
      await sleep(65000);
      continue;
    }
    if (res.status >= 500 && attempt < 2) {
      await sleep(30000);
      continue;
    }
    break;
  }
  if (res.status === 429) {
    budgetExhausted = true;
    console.log("\nGemini 일일 한도 도달(429 지속) — 여기서 중단, 내일 재실행하면 이어서 진행됩니다.");
    return null;
  }
  if (res.status >= 500) {
    budgetExhausted = true;
    console.log(`\nGemini 서버 오류(${res.status}) 지속 — 여기서 중단, 나중에 재실행하면 이어서 진행됩니다.`);
    return null;
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 한 호출로 여러 단어의 동의어를 받는다 — words: [{word, meaning}], 반환: index → string[] */
async function synonymBatch(cfg, words) {
  const prompt = [
    `For each entry below, list Korean words that mean exactly the same as the given Korean meaning,`,
    `so that a learner typing them should be graded as the SAME correct answer for that ${cfg.langName} word.`,
    `Rules:`,
    `- Exact synonyms only. Do NOT include broader, narrower, or merely related words.`,
    `  (For 소년: 남자아이 is fine; 남자 or 아이 is NOT — the scope differs.)`,
    `- At most ${MAX_SYNONYMS} per entry. Use an empty array when there is no true synonym.`,
    `- Korean only. No commas inside a synonym, no parentheses, no explanations.`,
    `- Do not repeat the given meaning itself.`,
    `Return ONLY a JSON array, one item per entry in the same order and length (${words.length}):`,
    `{"n": <entry number>, "synonyms": ["..."]}`,
    ...words.map((w, i) => `${i + 1}. ${w.word} — 뜻: ${w.meaning}`),
  ].join("\n");

  const out = await gemini(prompt);
  const map = new Map();
  if (!Array.isArray(out)) return map;
  for (let i = 0; i < words.length; i++) {
    const item = out.find((o) => o && Number(o.n) === i + 1) ?? out[i];
    if (!item || !Array.isArray(item.synonyms)) continue;
    const existing = alternatives(words[i].meaning).map(collapse);
    const kept = [];
    for (const raw of item.synonyms) {
      if (typeof raw !== "string") continue;
      const s = raw.trim();
      // 콤마는 뜻 구분자라 들어오면 안 되고, 긴 것은 설명문이 딸려 온 경우다
      if (!s || s.includes(",") || s.length > MAX_SYNONYM_LEN) continue;
      const key = collapse(s);
      if (existing.includes(key) || kept.some((k) => collapse(k) === key)) continue;
      kept.push(s);
      if (kept.length >= MAX_SYNONYMS) break;
    }
    map.set(i, kept);
  }
  return map;
}

// ---------- 1단계: 제안 만들기 ----------
async function propose(code) {
  const cfg = LANGS[code];
  console.log(`\n=== ${cfg.label} (${code}) — 제안 ===`);

  const { data: words, error } = await supabase
    .from(cfg.wordTable)
    .select("id, word, meaning")
    .order("id");
  if (error) throw error;

  const path = proposalPath(code);
  const prior = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
  const seen = new Set(prior.map((p) => p.id));

  const targets = words.filter((w) => !seen.has(w.id) && alternatives(w.meaning).length === 1);
  console.log(
    `대상: ${targets.length}단어 (전체 ${words.length}, 이미 대체 뜻 보유 ${
      words.filter((w) => alternatives(w.meaning).length > 1).length
    }, 제안 완료 ${seen.size})`,
  );
  if (targets.length === 0) return;

  const fresh = [];
  for (let g = 0; g < targets.length; g += GROUP) {
    if (budgetExhausted) break;
    const group = targets.slice(g, g + GROUP);
    const syn = await synonymBatch(cfg, group);
    if (syn.size === 0) {
      console.log(`  ✗ ${g + 1}~${g + group.length}번째 묶음 — 응답을 해석하지 못해 건너뜀`);
      continue; // 기록하지 않는다 → 다음 실행에서 재시도
    }
    for (let i = 0; i < group.length; i++) {
      const w = group[i];
      const synonyms = syn.get(i) ?? [];
      fresh.push({ id: w.id, word: w.word, meaning: w.meaning, synonyms });
      console.log(
        synonyms.length > 0
          ? `  · ${w.word} — ${w.meaning} → ${[w.meaning, ...synonyms].join(", ")}`
          : `  · ${w.word} — ${w.meaning} (동의어 없음)`,
      );
    }
    writeFileSync(path, JSON.stringify([...prior, ...fresh], null, 2) + "\n");
  }

  const withSyn = fresh.filter((p) => p.synonyms.length > 0).length;
  console.log(
    `제안 ${fresh.length}단어 기록 (동의어 있음 ${withSyn} · 없음 ${fresh.length - withSyn}) → ${path}`,
  );
  console.log(`검수한 뒤 반영: node --env-file=.env scripts/backfill-meanings.mjs ${code} --apply`);
}

// ---------- 2단계: 검수한 제안 반영 ----------
async function apply(code) {
  const cfg = LANGS[code];
  const path = proposalPath(code);
  if (!existsSync(path)) {
    console.log(`\n=== ${cfg.label} (${code}) — 반영 ===\n제안 파일이 없습니다: ${path}`);
    return;
  }
  console.log(`\n=== ${cfg.label} (${code}) — 반영 ===`);

  const proposals = JSON.parse(readFileSync(path, "utf8")).filter((p) => p.synonyms?.length > 0);
  const { data: words, error } = await supabase.from(cfg.wordTable).select("id, word, meaning");
  if (error) throw error;
  const byId = new Map(words.map((w) => [w.id, w]));

  const stat = { updated: 0, skipped: 0 };
  for (const p of proposals) {
    const current = byId.get(p.id);
    if (!current) {
      console.log(`  ✗ id ${p.id} (${p.word}) — 단어가 사라져 건너뜀`);
      stat.skipped++;
      continue;
    }
    // 제안 이후 뜻이 바뀌었으면 덮어쓰지 않는다 — 사람이 손댄 것을 되돌리는 쪽이 더 나쁘다
    if (current.meaning !== p.meaning) {
      console.log(`  ✗ ${p.word} — 뜻이 그사이 바뀌어 건너뜀 ("${p.meaning}" → "${current.meaning}")`);
      stat.skipped++;
      continue;
    }
    const existing = alternatives(current.meaning).map(collapse);
    const add = p.synonyms.filter((s) => s && !existing.includes(collapse(s)));
    if (add.length === 0) {
      stat.skipped++;
      continue;
    }
    const meaning = [...alternatives(current.meaning), ...add].join(", ");
    const { error: uErr } = await supabase.from(cfg.wordTable).update({ meaning }).eq("id", p.id);
    if (uErr) throw uErr;
    console.log(`  ✓ ${p.word} — ${meaning}`);
    stat.updated++;
  }
  console.log(`${cfg.label} 반영 완료: 갱신 ${stat.updated} · 건너뜀 ${stat.skipped}`);
}

for (const code of langFilter ? [langFilter] : Object.keys(LANGS)) {
  if (APPLY) await apply(code);
  else await propose(code);
  if (budgetExhausted) break;
}
if (!APPLY) {
  console.log(`\nGemini 호출 ${geminiCalls}/${BUDGET}회 사용.`);
  if (budgetExhausted) console.log("한도로 중단됨 — 내일 같은 명령으로 재실행하면 이어서 진행됩니다.");
}

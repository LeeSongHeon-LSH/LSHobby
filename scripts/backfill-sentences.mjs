// 예문 백필 배치 — Tatoeba 원문 우선, 부족분만 Gemini 번역·생성 (결정: grill 세션 2026-08-21)
// 실행: node --env-file=.env scripts/backfill-sentences.mjs [es|en] [--budget N]
//
// 정책:
// - 예문 0개인 단어만 처리 (재실행 안전 — 완료 단어는 건너뜀)
// - Tatoeba 수집(단어당 최대 3개, 표층형 정확 일치·70자 이하 — src/modules/language/tatoeba.ts와 동일 필터)
//   · es: 한국어 번역 우선, 부족하면 영어 번역 보충 (기존 transLangs와 동일)
//   · en: 한국어 번역 우선, 부족하면 번역 없는 원문도 수용 (ko_text는 Gemini가 번역)
// - ko_text 없는 예문만 Gemini 번역, Tatoeba에 아예 없는 단어만 Gemini 예문 생성
// - 무료 한도가 짜서(실측 일 ~20회) 호출을 묶는다: 번역은 16단어 1호출, 생성은 8단어 1호출
// - 429는 1분 대기 후 1회 재시도로 분당/일일 한도를 구분, 일일 한도면 중단 후 다음 날 재개
// - 성공(예문 1개 이상 확보)한 단어만 *_sentence_fetch에 마킹 → 퀴즈 lazy 경로는 캐시 히트
import { createClient } from "@supabase/supabase-js";

const MAX_SENTENCES = 3;
const MAX_LEN = 70;
const MODEL = "gemini-3.6-flash"; // 2.5는 신규 사용자에게 404 — 신규 키로 확인된 모델
const GEMINI_INTERVAL_MS = 13000;
const TATOEBA_INTERVAL_MS = 700;
const GROUP = 16; // 그룹당 Gemini 호출 최대 2회 (번역 1 + 생성 1~2)
const GEN_CHUNK = 8;

const LANGS = {
  es: {
    label: "스페인어",
    wordTable: "es_words",
    sentenceTable: "es_sentences",
    fetchTable: "es_sentence_fetch",
    tatoebaLang: "spa",
    passes: [{ trans: "kor" }, { trans: "eng" }],
    langName: "Spanish",
  },
  en: {
    label: "영어",
    wordTable: "en_words",
    sentenceTable: "en_sentences",
    fetchTable: "en_sentence_fetch",
    tatoebaLang: "eng",
    passes: [{ trans: "kor" }, { raw: true }],
    langName: "English",
  },
};

const args = process.argv.slice(2);
const langFilter = args.find((a) => !a.startsWith("--"));
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
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY가 없습니다 — .env에 추가하세요 (https://aistudio.google.com/apikey)");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wordPattern = (word) => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!\\w)${escaped}(?!\\w)`, "i");
};

// ---------- Tatoeba (tatoeba.ts 이식 + raw 패스 추가) ----------
async function fetchTatoeba(word, cfg) {
  const found = [];
  for (const pass of cfg.passes) {
    if (found.length >= MAX_SENTENCES) break;
    const params = new URLSearchParams({
      from: cfg.tatoebaLang,
      query: word,
      sort: "words",
      limit: "10",
    });
    if (pass.trans) {
      params.set("to", pass.trans);
      params.set("trans_filter", "limit");
      params.set("trans_to", pass.trans);
    }
    try {
      const res = await fetch(`https://tatoeba.org/en/api_v0/search?${params}`, {
        headers: { "User-Agent": "LSHobby (personal study app)" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const pattern = wordPattern(word);
      for (const r of data.results ?? []) {
        const text = r.text ?? "";
        if (text.length > MAX_LEN || !pattern.test(text)) continue;
        if (found.some((f) => f.text === text)) continue;
        let trans = null;
        outer: for (const group of r.translations ?? []) {
          for (const tr of group) {
            if (tr.lang === pass.trans) {
              trans = tr.text ?? null;
              break outer;
            }
          }
        }
        found.push({
          text,
          ko_text: pass.trans === "kor" ? trans : null,
          en_text: pass.trans === "eng" ? trans : null,
          source_url: r.id ? `https://tatoeba.org/en/sentences/show/${r.id}` : null,
        });
        if (found.length >= MAX_SENTENCES) break;
      }
    } catch {
      continue;
    }
    await sleep(TATOEBA_INTERVAL_MS);
  }
  return found;
}

// ---------- Gemini (무료 등급, REST 직접 호출) ----------
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
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
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
      await sleep(30000); // 일시 과부하(503 등) — 30초 후 재시도
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

/** 여러 단어의 예문을 한 호출로 번역 — items: [{word, text}], 실패 시 null */
async function translateBatch(cfg, items) {
  const prompt = [
    `Translate the following ${cfg.langName} sentences into natural Korean.`,
    `Each line is "<n>. (<study word>) <sentence>" — the sentence is a study example for that word.`,
    `Return ONLY a JSON array of strings: the Korean translation of each sentence, same order, same length (${items.length}).`,
    ...items.map((x, i) => `${i + 1}. (${x.word}) ${x.text}`),
  ].join("\n");
  const out = await gemini(prompt);
  if (!Array.isArray(out) || out.length !== items.length) return null;
  return out.map((s) => (typeof s === "string" ? s.trim() : null));
}

/** 여러 단어의 예문을 한 호출로 생성 — words: [{word, meaning}], 반환: word → drafts */
async function generateBatch(cfg, words) {
  const prompt = [
    `For each ${cfg.langName} word below, write ${MAX_SENTENCES} simple example sentences for a beginner-intermediate learner.`,
    `Rules: each sentence must contain the exact surface form of its word (no conjugation/inflection of it), be at most 60 characters, and be natural everyday ${cfg.langName}.`,
    `Return ONLY a JSON array, one item per word in order: {"word": "<word>", "sentences": [{"text": "<${cfg.langName} sentence>", "ko": "<natural Korean translation>"}]}`,
    ...words.map((w, i) => `${i + 1}. ${w.word} — Korean meaning: ${w.meaning}`),
  ].join("\n");
  const out = await gemini(prompt);
  const map = new Map();
  if (!Array.isArray(out)) return map;
  for (const w of words) {
    const item = out.find((o) => o && o.word === w.word);
    if (!item || !Array.isArray(item.sentences)) continue;
    const pattern = wordPattern(w.word);
    const drafts = item.sentences
      .filter(
        (s) =>
          s &&
          typeof s.text === "string" &&
          typeof s.ko === "string" &&
          s.text.length <= MAX_LEN &&
          pattern.test(s.text),
      )
      .slice(0, MAX_SENTENCES)
      .map((s) => ({
        text: s.text.trim(),
        ko_text: s.ko.trim(),
        en_text: null,
        source_url: `llm:${MODEL}`,
      }));
    if (drafts.length > 0) map.set(w.word, drafts);
  }
  return map;
}

// ---------- 백필 본체 ----------
async function backfillLang(code) {
  const cfg = LANGS[code];
  console.log(`\n=== ${cfg.label} (${code}) ===`);

  // 0. 기존 예문 중 ko_text 없는 것 번역 (es에 eng 보충분 등)
  const { data: untranslated, error: uErr } = await supabase
    .from(cfg.sentenceTable)
    .select("id, word_id, text")
    .is("ko_text", null);
  if (uErr) throw uErr;
  let translatedExisting = 0;
  if (untranslated.length > 0 && !budgetExhausted) {
    const kos = await translateBatch(
      cfg,
      untranslated.map((r) => ({ word: "(unknown)", text: r.text })),
    );
    if (kos) {
      for (let i = 0; i < untranslated.length; i++) {
        if (!kos[i]) continue;
        const { error } = await supabase
          .from(cfg.sentenceTable)
          .update({ ko_text: kos[i] })
          .eq("id", untranslated[i].id);
        if (error) throw error;
        translatedExisting++;
      }
    }
  }

  // 1. 예문 0개인 단어 목록
  const { data: words, error: wErr } = await supabase
    .from(cfg.wordTable)
    .select("id, word, meaning")
    .order("id");
  if (wErr) throw wErr;
  const { data: haveRows, error: hErr } = await supabase
    .from(cfg.sentenceTable)
    .select("word_id");
  if (hErr) throw hErr;
  const have = new Set(haveRows.map((r) => r.word_id));
  const targets = words.filter((w) => !have.has(w.id));
  console.log(`대상: ${targets.length}단어 (전체 ${words.length}, 예문 보유 ${have.size})`);

  const stat = { tatoeba: 0, generated: 0, failed: 0, done: 0 };
  for (let g = 0; g < targets.length; g += GROUP) {
    if (budgetExhausted) break;
    const group = targets.slice(g, g + GROUP);

    // 1a. 그룹 전체 Tatoeba 수집
    const fetched = [];
    for (const w of group) fetched.push({ w, drafts: await fetchTatoeba(w.word, cfg) });

    // 1b. ko_text 없는 문장 전부 모아 한 호출로 번역
    const needT = [];
    for (const f of fetched) for (const d of f.drafts) if (!d.ko_text) needT.push({ f, d });
    if (needT.length > 0) {
      const kos = await translateBatch(
        cfg,
        needT.map((x) => ({ word: x.f.w.word, text: x.d.text })),
      );
      if (kos) needT.forEach((x, i) => {
        if (kos[i]) x.d.ko_text = kos[i];
      });
    }
    for (const f of fetched) f.drafts = f.drafts.filter((d) => d.ko_text || d.en_text);

    // 1c. 예문 확보 못한 단어들만 모아 생성 (8단어씩 한 호출)
    const empty = fetched.filter((f) => f.drafts.length === 0);
    for (let c = 0; c < empty.length; c += GEN_CHUNK) {
      if (budgetExhausted) break;
      const chunk = empty.slice(c, c + GEN_CHUNK);
      const gen = await generateBatch(cfg, chunk.map((f) => f.w));
      for (const f of chunk) {
        const drafts = gen.get(f.w.word);
        if (drafts) {
          f.drafts = drafts;
          f.generated = true;
        }
      }
    }

    // 1d. 단어별 저장 + 마킹
    for (const f of fetched) {
      if (f.drafts.length === 0) {
        if (!budgetExhausted) {
          stat.failed++;
          console.log(`  ✗ ${f.w.word} — 예문 확보 실패`);
        }
        continue; // fetch 마킹 안 함 → 다음 실행에서 재시도
      }
      const rows = f.drafts.map((d) => ({ word_id: f.w.id, ...d }));
      const { error: iErr } = await supabase.from(cfg.sentenceTable).insert(rows);
      if (iErr) throw iErr;
      const { error: fErr } = await supabase
        .from(cfg.fetchTable)
        .upsert({ word_id: f.w.id }, { onConflict: "word_id" });
      if (fErr) throw fErr;
      stat[f.generated ? "generated" : "tatoeba"]++;
      stat.done++;
      console.log(`  ✓ ${f.w.word} — ${rows.length}개 (${f.generated ? "llm" : "tatoeba"})`);
    }
  }

  console.log(
    `${cfg.label} 완료: tatoeba ${stat.tatoeba} · 생성 ${stat.generated} · 실패 ${stat.failed} · 잔여 ${targets.length - stat.done - stat.failed}` +
      (translatedExisting ? ` · 기존 예문 번역 ${translatedExisting}` : ""),
  );
}

for (const code of langFilter ? [langFilter] : Object.keys(LANGS)) {
  await backfillLang(code);
  if (budgetExhausted) break;
}
console.log(`\nGemini 호출 ${geminiCalls}/${BUDGET}회 사용.`);
if (budgetExhausted) console.log("한도로 중단됨 — 내일 같은 명령으로 재실행하면 이어서 진행됩니다.");

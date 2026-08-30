// Notion 백업 — 책 여정 + 단어 대시보드를 상태 그대로 미러 (§16.12 개편)
// 실행: node --env-file=.env scripts/sync-notion-backup.mjs  (집 PC cron 매일 00:40)
//
// 설계 (활동 미러 #64를 백업 형태로 개편, 2026-08-26):
// - 원본은 앱, Notion은 혹시 모를 백업 사본 — 앱→Notion 단방향
// - 책: 페이지 = 책 1권(제목), 여정에 기록된 모든 것(저자·완독·별점·태그·노트·감상)을
//   속성 + 본문으로 upsert. sync_hash가 같으면 건너뛴다 (커서 없음 — 매일 전체 수렴)
// - 단어: 언어×날짜 1행, review_log에서 Asia/Seoul 경계로 집계 — 오늘(KST)은 아직
//   확정 전이라 제외, 지난 날짜는 값이 달라졌으면 갱신 (PC 타임존과 무관)
// - 삭제는 반영하지 않는다 — 백업이므로 앱에서 지워도 Notion 사본은 남긴다
// - thought 도메인 데이터는 다루지 않는다 (생각 데이터 외부 반출 금지, §16.11)

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const LANGS = [
  { code: "es", label: "스페인어", reviewLogTable: "es_review_log", dailyStatsFn: "es_daily_stats" },
  { code: "en", label: "영어", reviewLogTable: "en_review_log", dailyStatsFn: "en_daily_stats" },
];

const { NOTION_TOKEN, NOTION_BOOK_DB_ID, NOTION_WORD_DB_ID } = process.env;
if (!NOTION_TOKEN || !NOTION_BOOK_DB_ID || !NOTION_WORD_DB_ID) {
  console.error("NOTION_TOKEN / NOTION_BOOK_DB_ID / NOTION_WORD_DB_ID가 .env에 없습니다");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const notion = async (path, body, method = "POST") => {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Notion ${method} ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
};

/** DB 전체 페이지 조회 (백업 규모 전제 — 수백 건) */
async function queryAll(dbId) {
  const out = [];
  let cursor;
  do {
    const data = await notion(`databases/${dbId}/query`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    out.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return out;
}

/** KST 기준 YYYY-MM-DD — PC 타임존과 무관하게 앱의 하루 경계를 따른다 */
const kstDate = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);

const rt = (s) => (s ? [{ text: { content: String(s).slice(0, 1900) } }] : []);
const para = (text) => ({ paragraph: { rich_text: rt(text) } });
const heading = (text) => ({ heading_2: { rich_text: rt(text) } });
const bullet = (text) => ({ bulleted_list_item: { rich_text: rt(text) } });

// ---------- ① 책 여정 ----------

/** 여정 정렬 규칙 — src/modules/library/journey.ts sortJourney와 동일 (최초 완독 오름차순) */
const journeyNo = (books) => {
  const done = books
    .filter((b) => b.readings.length > 0)
    .sort((a, b) => a.readings[0].finished_on.localeCompare(b.readings[0].finished_on) || a.id - b.id);
  return new Map(done.map((b, i) => [b.id, i + 1]));
};

async function fetchBooks() {
  const [{ data: books, error: bErr }, { data: readings, error: rErr }, { data: taggings, error: tErr }] =
    await Promise.all([
      supabase.from("book").select("*").order("id"),
      supabase.from("reading").select("book_id, finished_on, rating").order("finished_on"),
      supabase.from("tagging").select("subject_id, tag(name)").eq("subject_type", "book"),
    ]);
  if (bErr) throw bErr;
  if (rErr) throw rErr;
  if (tErr) throw tErr;

  const { data: threads, error: thErr } = await supabase
    .from("reflection_thread")
    .select("id, subject_id")
    .eq("subject_type", "book");
  if (thErr) throw thErr;
  const threadIds = threads.map((t) => t.id);
  const { data: entries, error: enErr } = threadIds.length
    ? await supabase
        .from("reflection_entry")
        .select("thread_id, content, context, created_at")
        .in("thread_id", threadIds)
        .order("created_at")
    : { data: [], error: null };
  if (enErr) throw enErr;
  const bookIdByThread = new Map(threads.map((t) => [t.id, t.subject_id]));

  const byBook = new Map(books.map((b) => [b.id, { ...b, readings: [], tags: [], reflections: [] }]));
  for (const r of readings) byBook.get(r.book_id)?.readings.push(r);
  for (const t of taggings) byBook.get(t.subject_id)?.tags.push(t.tag.name);
  for (const e of entries) byBook.get(bookIdByThread.get(e.thread_id))?.reflections.push(e);
  return [...byBook.values()];
}

function bookBlocks(b) {
  const blocks = [];
  if (b.note) {
    blocks.push(heading("노트"));
    for (const line of b.note.split("\n")) blocks.push(para(line));
  }
  blocks.push(heading("완독 기록"));
  b.readings.forEach((r, i) =>
    blocks.push(bullet(`${i + 1}회독 · ${r.finished_on}${r.rating ? ` · ${"★".repeat(r.rating)}` : ""}`)),
  );
  if (b.reflections.length > 0) {
    blocks.push(heading("감상"));
    for (const e of b.reflections)
      blocks.push(bullet(`[${e.created_at.slice(0, 10)}${e.context ? ` · ${e.context}` : ""}] ${e.content}`));
  }
  return blocks;
}

function bookProps(b, no) {
  const last = b.readings[b.readings.length - 1];
  return {
    제목: { title: rt(b.title) },
    저자: { rich_text: rt(b.author) },
    옮긴이: { rich_text: rt(b.translator) },
    출판사: { rich_text: rt(b.publisher) },
    발표연도: { rich_text: rt(b.pub_year) },
    태그: { multi_select: b.tags.map((name) => ({ name })) },
    "여정 번호": { number: no ?? null },
    회독: { number: b.readings.length },
    "최초 완독일": { date: b.readings[0] ? { start: b.readings[0].finished_on } : null },
    "최근 완독일": { date: last ? { start: last.finished_on } : null },
    별점: { number: last?.rating ?? null },
    book_id: { number: b.id },
  };
}

async function replaceChildren(pageId, blocks) {
  let cursor;
  const old = [];
  do {
    const data = await notion(`blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`, undefined, "GET");
    old.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  for (const blk of old) await notion(`blocks/${blk.id}`, undefined, "DELETE");
  await notion(`blocks/${pageId}/children`, { children: blocks }, "PATCH");
}

async function syncBooks() {
  const books = await fetchBooks();
  const numbers = journeyNo(books);
  const pages = await queryAll(NOTION_BOOK_DB_ID);
  const pageByBookId = new Map(pages.map((p) => [p.properties.book_id?.number, p]));

  let created = 0, updated = 0;
  for (const b of books) {
    const no = numbers.get(b.id) ?? null;
    const hash = createHash("sha1")
      .update(JSON.stringify([bookProps(b, no), b.note, b.reflections]))
      .digest("hex");
    const page = pageByBookId.get(b.id);
    if (page) {
      if (page.properties.sync_hash?.rich_text?.[0]?.plain_text === hash) continue;
      await notion(`pages/${page.id}`, { properties: { ...bookProps(b, no), sync_hash: { rich_text: rt(hash) } } }, "PATCH");
      await replaceChildren(page.id, bookBlocks(b));
      updated += 1;
    } else {
      await notion("pages", {
        parent: { database_id: NOTION_BOOK_DB_ID },
        properties: { ...bookProps(b, no), sync_hash: { rich_text: rt(hash) } },
        children: bookBlocks(b),
      });
      created += 1;
    }
  }
  return { total: books.length, created, updated };
}

// ---------- ② 단어 대시보드 ----------

async function syncWords() {
  const today = kstDate();
  const pages = await queryAll(NOTION_WORD_DB_ID);
  const byKey = new Map(
    pages.map((p) => [`${p.properties.언어?.select?.name}|${p.properties.날짜?.date?.start}`, p]),
  );

  let created = 0, updated = 0;
  for (const lang of LANGS) {
    const { data, error } = await supabase.rpc(lang.dailyStatsFn, { tz: "Asia/Seoul" });
    if (error) throw error;
    for (const row of data) {
      if (row.day >= today) continue; // 오늘(KST)은 아직 확정 전 — 내일 실행이 박제
      const props = {
        이름: { title: rt(`${row.day} ${lang.label}`) },
        날짜: { date: { start: row.day } },
        언어: { select: { name: lang.label } },
        복습: { number: row.total },
        정답: { number: row.correct },
        정답률: { number: row.total ? Math.round((row.correct / row.total) * 100) : 0 },
      };
      const page = byKey.get(`${lang.label}|${row.day}`);
      if (page) {
        if (page.properties.복습?.number === row.total && page.properties.정답?.number === row.correct) continue;
        await notion(`pages/${page.id}`, { properties: props }, "PATCH");
        updated += 1;
      } else {
        await notion("pages", { parent: { database_id: NOTION_WORD_DB_ID }, properties: props });
        created += 1;
      }
    }
  }
  return { created, updated };
}

// ---------- 실행 ----------
try {
  const b = await syncBooks();
  const w = await syncWords();
  console.log(
    `[${new Date().toISOString()}] 책 ${b.total}권 (신규 ${b.created}·갱신 ${b.updated}) / 단어 일별 신규 ${w.created}·갱신 ${w.updated}`,
  );
} catch (e) {
  console.error(`[${new Date().toISOString()}] 백업 중단: ${e.message}`);
  process.exit(1);
}

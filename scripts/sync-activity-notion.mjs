// Notion 활동 미러 — activity_feed를 Notion DB에 단방향 append (결정 #64, §16.12)
// 실행: node --env-file=.env scripts/sync-activity-notion.mjs  (집 PC cron 매일 00:40)
//
// 설계 (grill 세션 2026-08-24):
// - 원본은 앱, Notion은 읽기 사본 — 앱→Notion 단방향, Notion 쪽 수정은 반영 안 함
// - thought 도메인은 보내지 않는다 (생각 데이터 외부 반출 금지, §16.11) — 포함 목록으로 강제
// - 커서 저장소 없음: Notion DB의 최대 activity_id를 조회해 그 다음부터 (사본에 직접 묻기)
// - 어제까지만 전송 — 언어의 당일 1건 갱신(upsertDaily)이 확정되기 전에 박제하지 않기
// - id 오름차순 순차 전송, 실패 시 중단 — 다음 실행이 이어받는다 (PC 꺼진 날도 소급)

import { createClient } from "@supabase/supabase-js";

const SYNC_DOMAINS = ["library", "language", "cv"]; // thought는 정책상 제외 (§16.11)

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB_ID = process.env.NOTION_DB_ID;
if (!NOTION_TOKEN || !NOTION_DB_ID) {
  console.error("NOTION_TOKEN / NOTION_DB_ID가 .env에 없습니다");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const notion = async (path, body) => {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
};

// ---------- ① 커서: Notion에 이미 있는 마지막 activity_id ----------
async function lastSyncedId() {
  const data = await notion(`databases/${NOTION_DB_ID}/query`, {
    sorts: [{ property: "activity_id", direction: "descending" }],
    page_size: 1,
  });
  return data.results[0]?.properties?.activity_id?.number ?? 0;
}

// ---------- ② 미전송분 조회 (어제까지, 포함 도메인만) ----------
async function fetchUnsent(sinceId) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const { data, error } = await supabase
    .from("activity_feed")
    .select("id, domain, action, summary, occurred_at")
    .gt("id", sinceId)
    .lt("occurred_at", todayStart)
    .in("domain", SYNC_DOMAINS)
    .order("id", { ascending: true });
  if (error) throw error;
  return data;
}

// ---------- ③ 행 → 표준 이벤트 배열 → Notion 전송 (경계 유지 — 대상 교체 시 이 아래만 바뀐다) ----------
const toEvents = (rows) =>
  rows.map((r) => ({
    id: r.id,
    occurredAt: r.occurred_at,
    domain: r.domain,
    action: r.action,
    summary: r.summary,
  }));

async function sendToNotion(events) {
  let sent = 0;
  for (const e of events) {
    await notion("pages", {
      parent: { database_id: NOTION_DB_ID },
      properties: {
        요약: { title: [{ text: { content: e.summary } }] },
        날짜: { date: { start: e.occurredAt } },
        도메인: { select: { name: e.domain } },
        액션: { select: { name: e.action } },
        activity_id: { number: e.id },
      },
    });
    sent += 1;
  }
  return sent;
}

const since = await lastSyncedId();
const events = toEvents(await fetchUnsent(since));
if (events.length === 0) {
  console.log(`[${new Date().toISOString()}] 보낼 활동 없음 (커서 id=${since})`);
  process.exit(0);
}
try {
  const sent = await sendToNotion(events);
  console.log(`[${new Date().toISOString()}] ${sent}건 전송 (id ${events[0].id}–${events[events.length - 1].id})`);
} catch (e) {
  // 순차 전송이라 여기서 죽어도 커서는 어긋나지 않는다 — 다음 실행이 이어받음
  console.error(`[${new Date().toISOString()}] 전송 중단: ${e.message}`);
  process.exit(1);
}

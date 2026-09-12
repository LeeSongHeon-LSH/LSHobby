import { supabase } from "../auth";

/** 건별 이벤트 발행 (docs/05 §5.3) */
export async function publish(
  domain: string,
  entityType: string,
  entityId: number,
  action: string,
  summary: string,
): Promise<void> {
  const { error } = await supabase
    .from("activity_feed")
    .insert({ domain, entity_type: entityType, entity_id: entityId, action, summary });
  if (error) throw error;
}

/** 로컬(브라우저) 기준 오늘 — occurred_on에 적는 값 */
const localDay = (now: Date): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

/**
 * 당일 1건 갱신 발행 — 언어 학습 요약(§6.4)·CS 본문 수정(§8.4)용.
 * select 후 insert는 답을 빠르게 연속 제출하면 두 호출이 모두 "없음"을 보고 같은 날 행을
 * 둘 만든다 — 유일 키에 기대는 단일 upsert로 경합을 DB에 맡긴다 (#96).
 * occurred_on은 유니크 인덱스의 마지막 열이자 이 upsert의 충돌 열이다.
 */
export async function upsertDaily(
  domain: string,
  entityType: string,
  entityId: number,
  action: string,
  summary: string,
  now: Date = new Date(),
): Promise<void> {
  const { error } = await supabase.from("activity_feed").upsert(
    {
      domain,
      entity_type: entityType,
      entity_id: entityId,
      action,
      summary,
      occurred_at: now.toISOString(),
      occurred_on: localDay(now),
    },
    { onConflict: "domain,entity_type,entity_id,action,occurred_on" },
  );
  if (error) throw error;
}

import { supabase } from "../auth";

export interface Tag {
  id: number;
  name: string;
}

/** 특정 유형(subject_type) 전체의 태깅 맵 — 목록 화면 1회 조회용. subject_id → 태그 이름들 */
export async function tagsByType(subjectType: string): Promise<Map<number, string[]>> {
  const { data, error } = await supabase
    .from("tagging")
    .select("subject_id, tag(name)")
    .eq("subject_type", subjectType);
  if (error) throw error;
  const map = new Map<number, string[]>();
  for (const row of data as unknown as { subject_id: number; tag: { name: string } }[]) {
    const list = map.get(row.subject_id) ?? [];
    list.push(row.tag.name);
    map.set(row.subject_id, list);
  }
  return map;
}

/** 대상의 태그를 이름 목록으로 동기화 — 없는 태그는 생성, 빠진 태깅은 삭제 (자유 태그, #22) */
export async function setTags(
  subjectType: string,
  subjectId: number,
  names: string[],
): Promise<void> {
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const tagIds: number[] = [];
  for (const name of clean) {
    const { data: up, error } = await supabase
      .from("tag")
      .upsert({ name }, { onConflict: "name" })
      .select("id")
      .single();
    if (error) throw error;
    tagIds.push(up.id);
  }
  const { data: existing, error: exErr } = await supabase
    .from("tagging")
    .select("id, tag_id")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId);
  if (exErr) throw exErr;
  const stale = existing.filter((e) => !tagIds.includes(e.tag_id)).map((e) => e.id);
  if (stale.length > 0) {
    const { error } = await supabase.from("tagging").delete().in("id", stale);
    if (error) throw error;
  }
  const have = new Set(existing.map((e) => e.tag_id));
  const fresh = tagIds.filter((id) => !have.has(id));
  if (fresh.length > 0) {
    const { error } = await supabase
      .from("tagging")
      .insert(fresh.map((tag_id) => ({ tag_id, subject_type: subjectType, subject_id: subjectId })));
    if (error) throw error;
  }
}

/** 대상 하나의 다형 태깅 행 삭제 — 엔티티 삭제 시 앱 레이어 정리용 (§14.7) */
export async function removeTaggings(subjectType: string, subjectId: number): Promise<void> {
  const { error } = await supabase
    .from("tagging")
    .delete()
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId);
  if (error) throw error;
}

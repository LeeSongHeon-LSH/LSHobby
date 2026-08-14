import { supabase } from "../shared/auth";
import { publish, upsertDaily } from "../shared/activity";
import { removeTaggings, setTags, tagsByType } from "../shared/tag";
import { removeThread } from "../shared/reflection";
import { extractWikiLinks, replaceWikiTitle } from "./wikilink";

export interface Concept {
  id: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ConceptListItem extends Concept {
  tags: string[];
}

/** 목록 — 최근 수정순 (§8.3), 발췌는 화면에서 본문 첫 줄 사용 */
export async function listConcepts(): Promise<ConceptListItem[]> {
  const [{ data, error }, tags] = await Promise.all([
    supabase.from("concept").select("*").order("updated_at", { ascending: false }),
    tagsByType("concept"),
  ]);
  if (error) throw error;
  return (data as Concept[]).map((c) => ({ ...c, tags: tags.get(c.id) ?? [] }));
}

export async function getConcept(id: number): Promise<Concept | null> {
  const { data, error } = await supabase.from("concept").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Concept | null;
}

export async function countConcepts(): Promise<number> {
  const { count, error } = await supabase
    .from("concept")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/** 제목 → id 인덱스 — 위키링크 resolve·자동완성용 */
export async function titleIndex(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from("concept").select("id, title");
  if (error) throw error;
  return new Map((data as { id: number; title: string }[]).map((c) => [c.title, c.id]));
}

/** 백링크 — 이 개념을 참조하는 문서들 (§8.2) */
export async function backlinks(id: number): Promise<{ id: number; title: string }[]> {
  const { data: links, error } = await supabase
    .from("concept_link")
    .select("from_id")
    .eq("to_id", id);
  if (error) throw error;
  const ids = links.map((l) => l.from_id as number);
  if (ids.length === 0) return [];
  const { data, error: cErr } = await supabase
    .from("concept")
    .select("id, title")
    .in("id", ids)
    .order("title");
  if (cErr) throw cErr;
  return data as { id: number; title: string }[];
}

/** 저장 시 [[...]] 추출 → resolve 성공분만 concept_link 전량 재기록 (§14.6) */
async function syncLinks(id: number, body: string): Promise<void> {
  const titles = extractWikiLinks(body);
  const index = await titleIndex();
  const toIds = [...new Set(titles.map((t) => index.get(t)).filter((x): x is number => x !== undefined))];
  const { error: delErr } = await supabase.from("concept_link").delete().eq("from_id", id);
  if (delErr) throw delErr;
  if (toIds.length > 0) {
    const { error } = await supabase
      .from("concept_link")
      .insert(toIds.map((to_id) => ({ from_id: id, to_id })));
    if (error) throw error;
  }
}

/** 제목 변경: 참조하는 모든 본문의 [[옛제목]] 일괄 치환 (§8.2 — 데이터 소규모 전제로 전량 조회) */
async function renameInBodies(oldTitle: string, newTitle: string): Promise<void> {
  const { data, error } = await supabase.from("concept").select("id, body");
  if (error) throw error;
  const marker = `[[${oldTitle}]]`;
  for (const c of data as { id: number; body: string }[]) {
    if (!c.body.includes(marker)) continue;
    const { error: uErr } = await supabase
      .from("concept")
      .update({ body: replaceWikiTitle(c.body, oldTitle, newTitle) })
      .eq("id", c.id);
    if (uErr) throw uErr;
  }
}

export async function saveConcept(input: {
  id: number | null;
  title: string;
  body: string;
  tags: string[];
}): Promise<number> {
  const title = input.title.trim();
  const now = new Date().toISOString();
  let id = input.id;

  if (id === null) {
    const { data, error } = await supabase
      .from("concept")
      .insert({ title, body: input.body })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id as number;
    await publish("knowledge", "concept", id, "created", `개념 등록: ${title}`);
  } else {
    const before = await getConcept(id);
    if (!before) throw new Error("concept not found");
    if (before.title !== title) await renameInBodies(before.title, title);
    const { error } = await supabase
      .from("concept")
      .update({ title, body: input.body, updated_at: now })
      .eq("id", id);
    if (error) throw error;
    // 본문 수정은 개념당 당일 1건 갱신 (§8.4 — 오탈자 수정 도배 방지)
    await upsertDaily("knowledge", "concept", id, "updated", `「${title}」 정리 갱신`);
  }

  await syncLinks(id, input.body);
  await setTags("concept", id, input.tags);
  return id;
}

/** 삭제 — cascade 이원화 (§14.7): concept_link는 DB cascade, 다형 행은 여기서 */
export async function deleteConcept(id: number): Promise<void> {
  await removeThread("concept", id);
  await removeTaggings("concept", id);
  const { error } = await supabase.from("concept").delete().eq("id", id);
  if (error) throw error;
}

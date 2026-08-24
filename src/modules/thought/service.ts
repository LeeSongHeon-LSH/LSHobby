import { supabase } from "../shared/auth";
import { publish } from "../shared/activity";

export interface Thought {
  id: number;
  content: string;
  topics: string[] | null; // 로컬 워커가 채우는 주제 키워드 (null = 미분석)
  created_at: string;
}

export interface ThoughtDigest {
  id: number;
  day: string; // YYYY-MM-DD
  summary: string;
  topics: string[];
  model: string;
  created_at: string;
}

/** 생각 기록 — append-only (감상과 같은 원칙, 수정·삭제 없음) */
export async function addThought(content: string): Promise<Thought> {
  const { data, error } = await supabase
    .from("thought")
    .insert({ content })
    .select()
    .single();
  if (error) throw error;
  const added = data as Thought;
  const line = content.split("\n")[0].slice(0, 30);
  await publish("thought", "thought", added.id, "created", `생각 기록: ${line}`);
  return added;
}

export async function listThoughts(limit = 80, before?: string): Promise<Thought[]> {
  let q = supabase
    .from("thought")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  return data as Thought[];
}

export async function countThoughts(): Promise<number> {
  const { count, error } = await supabase
    .from("thought")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/** 최신순 병합 + id 중복 제거 (내용 검색·주제 검색 결과 합치기) */
export function mergeThoughts(a: Thought[], b: Thought[], limit: number): Thought[] {
  const seen = new Set<number>();
  return [...a, ...b]
    .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
    .sort((x, y) => (x.created_at < y.created_at ? 1 : -1))
    .slice(0, limit);
}

/** 검색 — 내용 부분일치 또는 주제 키워드 정확 일치 (최신순) */
export async function searchThoughts(query: string, limit = 80): Promise<Thought[]> {
  const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const [byContent, byTopic] = await Promise.all([
    supabase
      .from("thought")
      .select("*")
      .ilike("content", pattern)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("thought")
      .select("*")
      .contains("topics", [query])
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);
  if (byContent.error) throw byContent.error;
  if (byTopic.error) throw byTopic.error;
  return mergeThoughts(byContent.data as Thought[], byTopic.data as Thought[], limit);
}

export async function recentDigests(limit = 30): Promise<ThoughtDigest[]> {
  const { data, error } = await supabase
    .from("thought_digest")
    .select("*")
    .order("day", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ThoughtDigest[];
}

/** 로컬 기준 날짜 키 (YYYY-MM-DD) — digest.day와 같은 축 */
export const dayKey = (iso: string): string => {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

/** 최신순 목록을 날짜 그룹으로 (입력 순서 유지) */
export function groupByDay(thoughts: Thought[]): { day: string; items: Thought[] }[] {
  const groups: { day: string; items: Thought[] }[] = [];
  for (const t of thoughts) {
    const day = dayKey(t.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(t);
    else groups.push({ day, items: [t] });
  }
  return groups;
}

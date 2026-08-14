import { supabase } from "../shared/auth";
import type { LanguageConfig } from "./types";

export interface Sentence {
  id: number;
  word_id: number;
  es_text: string;
  ko_text: string | null;
  en_text: string | null;
  source_url: string | null;
}

/**
 * 예문 확보 (구 fetchSentence 이식): 서버 API가 캐시 우선·미수집 시 Tatoeba 수집.
 * 첫 수집은 느릴 수 있어 2.5초 제한 — 초과해도 서버는 수집을 마치고 저장하므로 다음번엔 즉시.
 */
export async function ensureSentences(config: LanguageConfig, wordId: number): Promise<Sentence[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return [];
  try {
    const res = await fetch(`/api/sentence/${config.code}/${wordId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return [];
    return (await res.json()) as Sentence[];
  } catch {
    return [];
  }
}

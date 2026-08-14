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

/** 저장된 예문 중 하나 (cloze용). Tatoeba 수집은 별도 단계 — 없으면 null */
export async function pickSentence(config: LanguageConfig, wordId: number): Promise<Sentence | null> {
  const { data, error } = await supabase
    .from(config.sentenceTable)
    .select("*")
    .eq("word_id", wordId);
  if (error) throw error;
  const rows = data as Sentence[];
  if (rows.length === 0) return null;
  return rows[Math.floor(Math.random() * rows.length)];
}

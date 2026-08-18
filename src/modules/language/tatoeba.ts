// Tatoeba 예문 수집 (구 sentences.py 이식) — 서버(API route)에서만 호출
const API = "https://tatoeba.org/en/api_v0/search";
const MAX_SENTENCES = 3;
const MAX_LEN = 70;

export interface SentenceDraft {
  text: string;
  ko_text: string | null;
  en_text: string | null;
  source_url: string | null;
}

interface TatoebaResult {
  id?: number;
  text?: string;
  translations?: { lang?: string; text?: string }[][];
}

/** 검색 결과에서 단어가 표층형 그대로 든 짧은 문장 + 번역만 추림 (어간 매칭 변형 배제) */
export function extractSentences(
  results: TatoebaResult[],
  word: string,
  transLang: "kor" | "eng",
): SentenceDraft[] {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<!\\w)${escaped}(?!\\w)`, "i");
  const out: SentenceDraft[] = [];
  for (const r of results) {
    const text = r.text ?? "";
    if (text.length > MAX_LEN || !pattern.test(text)) continue;
    let trans: string | null = null;
    outer: for (const group of r.translations ?? []) {
      for (const tr of group) {
        if (tr.lang === transLang) {
          trans = tr.text ?? null;
          break outer;
        }
      }
    }
    out.push({
      text,
      ko_text: transLang === "kor" ? trans : null,
      en_text: transLang === "eng" ? trans : null,
      source_url: r.id ? `https://tatoeba.org/en/sentences/show/${r.id}` : null,
    });
  }
  return out;
}

/** 번역 언어 우선순위(config.transLangs — 스페인어: 한국어 우선, 부족하면 영어 보충) 순으로 수집 */
export async function fetchFromTatoeba(
  word: string,
  fromLang: string,
  transLangs: readonly ("kor" | "eng")[],
): Promise<SentenceDraft[]> {
  const found: SentenceDraft[] = [];
  for (const lang of transLangs) {
    if (found.length >= MAX_SENTENCES) break;
    const params = new URLSearchParams({
      from: fromLang,
      to: lang,
      query: word,
      trans_filter: "limit",
      trans_to: lang,
      sort: "words",
      limit: "10",
    });
    try {
      const res = await fetch(`${API}?${params}`, {
        headers: { "User-Agent": "LSHobby (personal study app)" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: TatoebaResult[] };
      for (const s of extractSentences(data.results ?? [], word, lang)) {
        if (found.some((f) => f.text === s.text)) continue;
        found.push(s);
        if (found.length >= MAX_SENTENCES) break;
      }
    } catch {
      continue;
    }
  }
  return found;
}

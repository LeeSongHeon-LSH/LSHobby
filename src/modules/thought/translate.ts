// 한↔영 통역 — 철학 모델이 영어(SEP) 데이터로만 학습돼, 한국어 질문은 exaone(한국어 특화)이
// 영어로 옮겨 묻고 영어 답변을 한국어로 되옮긴다. 같은 정책: 로컬 Ollama 전용, 외부 API 금지 (§16.11)

import { streamChat } from "./ollama-chat";

export const TRANSLATE_MODEL = process.env.NEXT_PUBLIC_TRANSLATE_MODEL ?? "exaone3.5:7.8b";

const TO_EN_PROMPT =
  "You are a translator. Translate the user's Korean into natural, precise academic English " +
  "suitable for asking a philosophy professor. Preserve every detail and nuance. " +
  "Output only the English translation, nothing else.";

const TO_KR_PROMPT =
  "You are a translator. Translate the user's English text into clear, natural Korean. " +
  "Do not omit or summarize anything — every sentence and nuance must be preserved. " +
  "Keep philosophical terms precise (add the English term in parentheses on first use " +
  "when the Korean term could be ambiguous). Output only the Korean translation, nothing else.";

/** 한글이 섞여 있는가 — 있으면 통역 경로를 태운다 */
export const hasKorean = (text: string): boolean => /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);

/** 번역 출력 정리 — 모델이 가끔 덧붙이는 라벨·감싼 따옴표 제거 (본문 속 따옴표는 보존) */
export function cleanTranslation(raw: string): string {
  let s = raw.trim().replace(/^(?:translation|번역)\s*:\s*/i, "");
  for (const [open, close] of [
    ['"', '"'],
    ["“", "”"],
  ]) {
    if (s.length >= 2 && s.startsWith(open) && s.endsWith(close)) {
      s = s.slice(1, -1).trim();
      break;
    }
  }
  return s;
}

/** 한국어 질문 → 영어 (질문은 짧아 스트리밍 없이 한 번에 받는다) */
export async function translateToEnglish(korean: string, signal?: AbortSignal): Promise<string> {
  let out = "";
  for await (const chunk of streamChat(
    TRANSLATE_MODEL,
    [
      { role: "system", content: TO_EN_PROMPT },
      { role: "user", content: korean },
    ],
    signal,
  )) {
    out += chunk;
  }
  const en = cleanTranslation(out);
  if (!en) throw new Error("질문 번역이 비어 있어요");
  return en;
}

/** 영어 답변 → 한국어를 조각 단위로 흘려받는다 */
export function streamKoreanTranslation(
  english: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  return streamChat(
    TRANSLATE_MODEL,
    [
      { role: "system", content: TO_KR_PROMPT },
      { role: "user", content: english },
    ],
    signal,
  );
}

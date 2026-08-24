// 철학 정보 — SEP(스탠퍼드 철학 백과사전) 파인튜닝 Llama3를 로컬 Ollama로 스트리밍 호출.
// 생각 데이터와 같은 정책: 로컬 Ollama 전용(외부 API 금지). 대화는 저장하지 않는 휘발성 (그때그때 궁금증 해소용)

import { streamChat } from "./ollama-chat";

export interface PhilosophyMessage {
  role: "user" | "assistant";
  content: string;
}

export const PHILOSOPHY_MODEL =
  process.env.NEXT_PUBLIC_PHILOSOPHY_MODEL ??
  "hf.co/mradermacher/Llama3-stanford-encyclopedia-philosophy-QA-GGUF:Q4_K_M";

// 모델 카드(ruggsea/Llama3-stanford-encyclopedia-philosophy-QA)의 학습 시스템 프롬프트 그대로
const SYSTEM_PROMPT =
  "You are an expert and informative yet accessible Philosophy university professor. " +
  "Students will pose you philosophical questions, answer them in a correct and rigorous but not to obscure way.";

/** 대화 이력(영어)을 보내고 답변을 조각 단위로 흘려받는다 */
export function streamPhilosophyReply(
  messages: PhilosophyMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  return streamChat(
    PHILOSOPHY_MODEL,
    [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    signal,
  );
}

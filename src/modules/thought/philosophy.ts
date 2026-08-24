// 철학 정보 — SEP(스탠퍼드 철학 백과사전) 파인튜닝 Llama3를 로컬 Ollama로 스트리밍 호출.
// 생각 데이터와 같은 정책: 로컬 Ollama 전용(외부 API 금지). 대화는 저장하지 않는 휘발성 (그때그때 궁금증 해소용)

export interface PhilosophyMessage {
  role: "user" | "assistant";
  content: string;
}

const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL ?? "http://localhost:11434";

export const PHILOSOPHY_MODEL =
  process.env.NEXT_PUBLIC_PHILOSOPHY_MODEL ??
  "hf.co/mradermacher/Llama3-stanford-encyclopedia-philosophy-QA-GGUF:Q4_K_M";

// 모델 카드(ruggsea/Llama3-stanford-encyclopedia-philosophy-QA)의 학습 시스템 프롬프트 그대로
const SYSTEM_PROMPT =
  "You are an expert and informative yet accessible Philosophy university professor. " +
  "Students will pose you philosophical questions, answer them in a correct and rigorous but not to obscure way.";

/** Ollama NDJSON 스트림 한 줄 → 본문 조각 ("" = 이 줄엔 본문 없음). error 응답은 예외 */
export function parseStreamLine(line: string): string {
  const s = line.trim();
  if (!s) return "";
  let parsed: { message?: { content?: unknown }; error?: unknown };
  try {
    parsed = JSON.parse(s);
  } catch {
    return "";
  }
  if (typeof parsed.error === "string") throw new Error(parsed.error);
  return typeof parsed.message?.content === "string" ? parsed.message.content : "";
}

/** 대화 이력을 보내고 답변을 조각 단위로 흘려받는다 (브라우저 → 집 PC Ollama, tailnet 경유 — §16.11) */
export async function* streamPhilosophyReply(
  messages: PhilosophyMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: PHILOSOPHY_MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream: true,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 300)}`);
  if (!res.body) throw new Error("Ollama 응답에 본문이 없습니다");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const chunk = parseStreamLine(line);
      if (chunk) yield chunk;
    }
  }
  const tail = parseStreamLine(buffer);
  if (tail) yield tail;
}

// Ollama /api/chat 공통부 — 철학 정보와 통역(translate)이 같은 스트리밍 경로를 쓴다.
// 브라우저 → 집 PC Ollama, tailnet 경유 (§16.11). 외부 API 금지 정책의 공통 지점.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL ?? "http://localhost:11434";

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

/** 메시지를 보내고 답변을 조각 단위로 흘려받는다 */
export async function* streamChat(
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
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

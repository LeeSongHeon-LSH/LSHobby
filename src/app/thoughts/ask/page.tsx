"use client";

import { useEffect, useRef, useState } from "react";
import {
  PHILOSOPHY_MODEL,
  streamPhilosophyReply,
  type PhilosophyMessage,
} from "@/modules/thought";
import { HomeButton } from "../../ui/home-button";
import { PixelPenguinThink } from "../../ui/pixel";

// 철학 문답 — 휘발성 채팅: 저장하지 않고 그때그때 궁금증만 해소 (새로고침 = 초기화).
// 모델이 영어(SEP) 데이터로 학습돼 영어로 물어야 답이 좋다
export default function PhilosophyAskPage() {
  const [messages, setMessages] = useState<PhilosophyMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (messages.length > 0) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = async () => {
    const content = input.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    const history: PhilosophyMessage[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let reply = "";
      for await (const chunk of streamPhilosophyReply(history, controller.signal)) {
        reply += chunk;
        setMessages([...history, { role: "assistant", content: reply }]);
      }
      if (!reply) throw new Error("모델이 빈 응답을 보냈어요");
    } catch (e) {
      if (controller.signal.aborted) return;
      setMessages(history); // 실패한 답변 자리는 비운다 — 어차피 휘발
      setError(
        e instanceof TypeError
          ? "Ollama에 연결하지 못했어요 — 이 PC에서 Ollama가 실행 중인지, OLLAMA_ORIGINS 설정을 확인하세요"
          : e instanceof Error
            ? e.message
            : "요청 실패",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-10 md:max-w-2xl">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-thought">Thought</p>
          <h1 className="font-display text-2xl font-bold">철학 문답</h1>
          <p className="mt-1 font-mono text-[11px] text-faint">
            {PHILOSOPHY_MODEL.split("/").pop()} · 저장 안 함
          </p>
        </div>
        <HomeButton accent="thought" />
      </header>

      {messages.length === 0 ? (
        <div className="mt-14 text-center">
          <div className="mb-3 flex justify-center">
            <PixelPenguinThink size={48} />
          </div>
          <p className="text-sm text-faint">
            스탠퍼드 철학 백과사전으로 배운 교수에게 영어로 물어보세요
          </p>
          <p className="mt-1 font-mono text-[11px] text-faint">
            대화는 저장되지 않아요 — 그때그때의 궁금증 해소용
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <li key={i} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-md bg-thought px-3.5 py-2.5 text-sm leading-relaxed text-white">
                  {m.content}
                </p>
              </li>
            ) : (
              <li key={i} className="flex">
                <div className="max-w-[85%] rounded-md border border-line bg-card px-3.5 py-2.5">
                  {m.content ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                  ) : (
                    <p className="text-sm text-faint">생각 중…</p>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="relative mt-5 overflow-hidden rounded-lg border border-thought/40 bg-card p-4">
        <span className="absolute left-4 top-0 h-1 w-10 bg-thought" aria-hidden="true" />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="What is the trolley problem?"
          className="w-full resize-y rounded-md border border-line bg-card px-3.5 py-3 text-sm"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="font-mono text-[11px] text-faint">Enter로 전송 · Shift+Enter 줄바꿈</p>
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="rounded-md bg-thought px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            묻기
          </button>
        </div>
      </div>
      <div ref={endRef} />
    </main>
  );
}

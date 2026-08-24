"use client";

import { useEffect, useRef, useState } from "react";
import {
  hasKorean,
  streamKoreanTranslation,
  streamPhilosophyReply,
  translateToEnglish,
  type PhilosophyMessage,
} from "@/modules/thought";
import { HomeButton } from "../../ui/home-button";
import { PixelPenguinThink } from "../../ui/pixel";

// 철학 정보 — 휘발성 채팅: 저장하지 않고 그때그때 궁금증만 해소 (새로고침 = 초기화).
// 모델이 영어(SEP) 데이터로 학습돼, 한국어 질문은 exaone이 영어로 통역해 묻고 답변을 한국어로 되옮긴다.
// 영어로 물으면 통역 없이 영어로만 주고받는다.

interface Turn {
  question: string; // 입력 원문 (화면 표시용)
  questionEn: string; // 모델에 실제 보낸 영어 ("" = 아직 통역 중)
  answerEn: string; // 철학 모델의 영어 답변 (스트리밍)
  answerKr: string; // exaone의 한국어 번역 (한국어 질문일 때만)
  translating: boolean; // 영어 답변 완료 후 한국어로 옮기는 중
}

function Answer({ turn }: { turn: Turn }) {
  if (!turn.answerEn) return <p className="text-sm text-faint">생각 중…</p>;
  if (!hasKorean(turn.question))
    return <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.answerEn}</p>;
  if (!turn.answerKr)
    return (
      <>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.answerEn}</p>
        {turn.translating && <p className="mt-2 text-sm text-faint">한국어로 옮기는 중…</p>}
      </>
    );
  return (
    <>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.answerKr}</p>
      <details className="mt-2 border-t border-line pt-2">
        <summary className="cursor-pointer font-mono text-[11px] text-faint">영어 원문</summary>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-faint">
          {turn.answerEn}
        </p>
      </details>
    </>
  );
}

export default function PhilosophyAskPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (turns.length > 0) endRef.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  const send = async () => {
    const question = input.trim();
    if (!question || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    const controller = new AbortController();
    abortRef.current = controller;
    const korean = hasKorean(question);
    const prior = turns;
    let turn: Turn = {
      question,
      questionEn: korean ? "" : question,
      answerEn: "",
      answerKr: "",
      translating: false,
    };
    const show = () => setTurns([...prior, turn]);
    show();
    try {
      if (korean) {
        turn = { ...turn, questionEn: await translateToEnglish(question, controller.signal) };
        show();
      }
      const history: PhilosophyMessage[] = [
        ...prior.flatMap((t): PhilosophyMessage[] => [
          { role: "user", content: t.questionEn },
          { role: "assistant", content: t.answerEn },
        ]),
        { role: "user", content: turn.questionEn },
      ];
      for await (const chunk of streamPhilosophyReply(history, controller.signal)) {
        turn = { ...turn, answerEn: turn.answerEn + chunk };
        show();
      }
      if (!turn.answerEn) throw new Error("모델이 빈 응답을 보냈어요");
      if (korean) {
        turn = { ...turn, translating: true };
        show();
        for await (const chunk of streamKoreanTranslation(turn.answerEn, controller.signal)) {
          turn = { ...turn, answerKr: turn.answerKr + chunk };
          show();
        }
        turn = { ...turn, translating: false };
        show();
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      const message =
        e instanceof TypeError
          ? "Ollama에 연결하지 못했어요 — 이 PC에서 Ollama가 실행 중인지, OLLAMA_ORIGINS 설정을 확인하세요"
          : e instanceof Error
            ? e.message
            : "요청 실패";
      if (turn.translating) {
        // 답변은 이미 받았고 번역만 실패 — 영어 원문은 남긴다
        turn = { ...turn, translating: false };
        show();
        setError(`한국어 번역에 실패했어요 (영어 원문은 남겨뒀어요) — ${message}`);
      } else {
        setTurns(prior); // 실패한 턴 자리는 비운다 — 어차피 휘발
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-10 md:max-w-2xl">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-thought">Thought</p>
          <h1 className="font-display text-2xl font-bold">철학 정보</h1>
        </div>
        <HomeButton accent="thought" />
      </header>

      {turns.length === 0 ? (
        <div className="mt-14 text-center">
          <div className="mb-3 flex justify-center">
            <PixelPenguinThink size={48} />
          </div>
          <p className="text-sm text-faint">
            스탠퍼드 철학 백과사전으로 배운 교수에게 물어보세요
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {turns.map((t, i) => (
            <li key={i} className="space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-md bg-thought px-3.5 py-2.5 text-sm leading-relaxed text-white">
                  <p className="whitespace-pre-wrap">{t.question}</p>
                  {t.question !== t.questionEn && (
                    <p className="mt-1.5 border-t border-white/20 pt-1.5 font-mono text-[11px] leading-relaxed text-white/70">
                      {t.questionEn || "영어로 옮기는 중…"}
                    </p>
                  )}
                </div>
              </div>
              {t.questionEn && (
                <div className="flex">
                  <div className="max-w-[85%] rounded-md border border-line bg-card px-3.5 py-2.5">
                    <Answer turn={t} />
                  </div>
                </div>
              )}
            </li>
          ))}
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
          placeholder="트롤리 문제가 뭐야?"
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

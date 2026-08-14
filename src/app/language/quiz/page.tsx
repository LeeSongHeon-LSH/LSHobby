"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  answerWord,
  articleFor,
  esConfig,
  gradeAnswer,
  isHard,
  pickSentence,
  pickWeight,
  reviewStats,
  todayPool,
  todayReviewSummary,
  weightedPick,
  type GradeResult,
  type Sentence,
  type Word,
  type WordStat,
} from "@/modules/language";

// §11.4.2 퀴즈 — 3방향: 스→한(sk)·한→스(ks) 타이핑 + 30% 확률로 예문 있으면 cloze (결정 #41 현행 이식)
// 받아쓰기(listen)·관사(gender) 문제는 이식 제외 (#41 범위, 2026-08-15 확정)

type Dir = "sk" | "ks" | "cloze";
type Phase = "loading" | "question" | "answered" | "done" | "empty";

interface Question {
  word: Word;
  dir: Dir;
  sentence: Sentence | null;
  blankAt: number; // cloze에서 es_text 안 단어 위치
}

const ACCENT_CHARS = ["á", "é", "í", "ó", "ú", "ñ"];
const ALT_MAP: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú", n: "ñ" };

const speak = (text: string) => {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES";
    speechSynthesis.speak(u);
  } catch {
    /* 음성 미지원 무시 */
  }
};

export default function QuizPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [mode, setMode] = useState<"due" | "free" | "hard">("due");
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState<Question | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [summary, setSummary] = useState<{ count: number; correct: number } | null>(null);

  const pool = useRef<Word[]>([]);
  const stats = useRef<Map<number, WordStat>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  const next = async () => {
    const remaining = pool.current;
    if (remaining.length === 0) {
      setSummary(await todayReviewSummary(esConfig));
      setPhase("done");
      return;
    }
    const word = weightedPick(remaining, (w) => {
      const s = stats.current.get(w.id);
      return s ? pickWeight(s.reviews, s.correct) : 1;
    })!;
    let dir: Dir = Math.random() < 0.5 ? "sk" : "ks";
    let sentence: Sentence | null = null;
    let blankAt = -1;
    if (Math.random() < 0.3) {
      sentence = await pickSentence(esConfig, word.id).catch(() => null);
      if (sentence) {
        blankAt = sentence.es_text.toLowerCase().indexOf(word.word.toLowerCase());
        if (blankAt >= 0) dir = "cloze";
        else sentence = null;
      }
    }
    setQ({ word, dir, sentence, blankAt });
    setInput("");
    setResult(null);
    setPhase("question");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    const hard = window.location.search.includes("hard=1");
    (async () => {
      const [{ words, pool: due }, st] = await Promise.all([
        todayPool(esConfig),
        reviewStats(esConfig),
      ]);
      stats.current = st;
      if (hard) {
        setMode("hard");
        pool.current = words.filter((w) => {
          const s = st.get(w.id);
          return s ? isHard(s.reviews, s.correct) : false;
        });
      } else if (due.length > 0) {
        setMode("due");
        pool.current = [...due];
      } else {
        setMode("free");
        pool.current = [...words];
      }
      setTotal(pool.current.length);
      if (pool.current.length === 0) setPhase("empty");
      else next();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!q || phase !== "question" || !input.trim()) return;
    const expected = q.dir === "sk" ? q.word.meaning : q.word.word;
    const res = gradeAnswer(input, expected, q.dir === "sk" ? "toMeaning" : "toWord", esConfig);
    setResult(res);
    setPhase("answered");
    if (q.dir !== "sk") speak(q.word.word);

    // 로컬 통계 갱신 (가중치·어려운 단어 판정용)
    const s = stats.current.get(q.word.id) ?? { reviews: 0, correct: 0 };
    stats.current.set(q.word.id, { reviews: s.reviews + 1, correct: s.correct + (res.ok ? 1 : 0) });
    // 정답이면 풀에서 제거, 오답은 남겨 재출제 (자유 연습은 계속 순환)
    if (res.ok && mode !== "free") {
      pool.current = pool.current.filter((w) => w.id !== q.word.id);
    }
    answerWord(esConfig, q.word, res.ok).catch(() => {});
  };

  const insertChar = (ch: string) => {
    const el = inputRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const a = selectionStart ?? input.length;
    const b = selectionEnd ?? input.length;
    const nextVal = input.slice(0, a) + ch + input.slice(b);
    setInput(nextVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(a + 1, a + 1);
    }, 0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.altKey && ALT_MAP[e.key]) {
      e.preventDefault();
      insertChar(ALT_MAP[e.key]);
    }
  };

  const progress = mode === "free" ? "자유 연습" : `진행 ${total - pool.current.length}/${total}`;

  if (phase === "loading") return <main className="p-4" />;

  if (phase === "empty")
    return (
      <main className="p-4 text-center">
        <p className="mt-16 text-neutral-500">출제할 단어가 없습니다</p>
        <Link href="/language" className="mt-4 inline-block text-sm underline">
          덱으로 돌아가기
        </Link>
      </main>
    );

  if (phase === "done")
    return (
      <main className="p-4 text-center">
        <p className="mt-16 text-2xl font-bold">오늘 학습 끝 🎉</p>
        {summary && summary.count > 0 && (
          <p className="mt-3 text-neutral-500">
            오늘 {summary.count}회 복습 · 정답률 {Math.round((summary.correct / summary.count) * 100)}%
          </p>
        )}
        <Link
          href="/language"
          className="mt-8 inline-block rounded-lg bg-neutral-900 px-6 py-3 font-medium text-white"
        >
          덱으로
        </Link>
      </main>
    );

  if (!q) return null;
  const answered = phase === "answered";
  const showSpanishInput = q.dir !== "sk";

  return (
    <main className="p-4">
      <header className="mb-6 flex items-center justify-between text-sm text-neutral-500">
        <Link href="/language">←</Link>
        <span>{mode === "hard" ? `🔥 ${progress}` : progress}</span>
      </header>

      <div
        className={`rounded-2xl border bg-white p-6 shadow-sm ${
          answered ? (result?.ok ? "border-green-300" : "border-red-300") : "border-neutral-200"
        }`}
      >
        {/* 문제 영역 */}
        {q.dir === "cloze" && q.sentence ? (
          <div className="mb-4">
            <p className="text-lg leading-relaxed">
              {q.sentence.es_text.slice(0, q.blankAt)}
              {answered ? (
                <span className="font-bold text-green-700">{q.word.word}</span>
              ) : (
                <span className="inline-block w-20 border-b-2 border-neutral-400" />
              )}
              {q.sentence.es_text.slice(q.blankAt + q.word.word.length)}
            </p>
            <p className="mt-2 text-sm text-neutral-500">뜻: {q.word.meaning}</p>
            {answered && (q.sentence.ko_text || q.sentence.en_text) && (
              <p className="mt-2 text-sm text-neutral-400">{q.sentence.ko_text ?? q.sentence.en_text}</p>
            )}
          </div>
        ) : (
          <p className="mb-4 text-center text-3xl font-bold">
            {q.dir === "sk" ? (
              <>
                {articleFor(q.word.gender) && (
                  <span className="mr-2 text-neutral-400">{articleFor(q.word.gender)}</span>
                )}
                {q.word.word}
              </>
            ) : (
              `"${q.word.meaning}"`
            )}
          </p>
        )}

        {/* 입력 영역 */}
        {!answered ? (
          <>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                onKeyDown(e);
                if (e.key === "Enter") submit();
              }}
              placeholder={showSpanishInput ? "español..." : "한국어 뜻..."}
              className="w-full rounded-lg border border-neutral-300 px-4 py-3"
              lang={showSpanishInput ? "es" : "ko"}
              autoCapitalize="off"
              autoComplete="off"
            />
            {showSpanishInput && (
              <div className="mt-2 flex items-center gap-1.5">
                {ACCENT_CHARS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => insertChar(c)}
                    className="rounded border border-neutral-200 px-2 py-1 text-sm text-neutral-600"
                  >
                    {c}
                  </button>
                ))}
                <span className="ml-1 text-xs text-neutral-400">alt+모음→á · alt+n→ñ</span>
              </div>
            )}
            <button
              onClick={submit}
              disabled={!input.trim()}
              className="mt-4 w-full rounded-lg bg-neutral-900 py-3 font-medium text-white disabled:opacity-40"
            >
              확인
            </button>
          </>
        ) : (
          <div className="text-center">
            <p className={`font-semibold ${result?.ok ? "text-green-700" : "text-red-600"}`}>
              {result?.accentCorrected
                ? `✓ 정답 — 악센트 표기: ${result.accentCorrected}`
                : result?.ok
                  ? "✓ 정답"
                  : "✗ 오답"}
            </p>
            <p className="mt-3 text-2xl font-bold">
              {articleFor(q.word.gender) && (
                <span className="mr-2 text-neutral-400">{articleFor(q.word.gender)}</span>
              )}
              {q.word.word}
            </p>
            <p className="mt-1 text-neutral-600">{q.word.meaning}</p>
            <button
              onClick={next}
              autoFocus
              className="mt-5 w-full rounded-lg bg-neutral-900 py-3 font-medium text-white"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

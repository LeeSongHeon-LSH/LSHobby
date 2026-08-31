"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  answerWord,
  articleFor,
  promptMeaning,
  useCurrentConfig,
  gradeAnswer,
  ensureSentences,
  loadDeck,
  practiceOrder,
  todayReviewSummary,
  type GradeResult,
  type Sentence,
  type Word,
  type WordStat,
} from "@/modules/language";

// §11.4.2 퀴즈 — 3방향: 스→한(sk)·한→스(ks) 타이핑 + 30% 확률로 예문 있으면 cloze (결정 #41 현행 이식)
// 받아쓰기(listen)·관사(gender) 문제는 이식 제외 (#41 범위, 2026-08-15 확정)
//
// 모드는 하나다 (2026-08-31). 하루 할당도 끝도 없고, 종료를 누를 때까지 이어진다.
// 출제 순서는 practiceOrder가 정하며, 한 바퀴(전체 단어)를 다 돌면 그 시점 정답률로
// 다시 정렬해 새 바퀴를 시작한다 — 같은 단어가 한 바퀴 안에 두 번 나오지 않는다.

type Dir = "sk" | "ks" | "cloze";
type Phase = "loading" | "question" | "answered" | "done" | "empty";

interface Question {
  word: Word;
  dir: Dir;
  sentence: Sentence | null;
  blankAt: number; // cloze에서 원문(text) 안 단어 위치
}

const speak = (text: string, lang: string) => {
  try {
    speechSynthesis.cancel(); // 앞 문제의 발음이 밀려 있으면 끊는다 — 항상 지금 단어를 읽게
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    speechSynthesis.speak(u);
  } catch {
    /* 음성 미지원 무시 */
  }
};

export default function QuizPage() {
  const config = useCurrentConfig(); // 전환은 랜딩에서만 일어남 (#54)
  const [phase, setPhase] = useState<Phase>("loading");
  const [seen, setSeen] = useState(0); // 이번 세션에 푼 문제 수 — 진행률 대신 표시
  const [q, setQ] = useState<Question | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [summary, setSummary] = useState<{ count: number; correct: number } | null>(null);

  const queue = useRef<Word[]>([]); // practiceOrder가 정한 이번 바퀴의 순서
  const cursor = useRef(0);
  const stats = useRef<Map<number, WordStat>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  // 정답 화면에 머무는 동안 다음 문제(예문 페치 포함)를 미리 준비 — "다음" 탭이 즉시가 되게
  const upcoming = useRef<Promise<Question | null> | null>(null);
  const advancing = useRef(false); // next() 진행 중 — 중복 호출이 문제를 건너뛰지 못하게
  // 채점 화면이 실제로 그려진 뒤에만 "다음"을 받는다 — 제출 제스처의 꼬리가 화면을 건너뛰지 못하게
  const canAdvance = useRef(false);

  const buildQuestion = async (): Promise<Question | null> => {
    if (queue.current.length === 0) return null;
    if (cursor.current >= queue.current.length) {
      // 한 바퀴 끝 — 이번 세션에서 쌓인 정답률로 다시 정렬해 새 바퀴 (FSRS 필드는 세션 시작 시점 기준)
      queue.current = practiceOrder(queue.current, stats.current);
      cursor.current = 0;
    }
    const word = queue.current[cursor.current];
    cursor.current += 1;
    let dir: Dir = Math.random() < 0.5 ? "sk" : "ks";
    let sentence: Sentence | null = null;
    let blankAt = -1;
    if (Math.random() < 0.3) {
      const candidates = await ensureSentences(config, word.id).catch(() => [] as Sentence[]);
      if (candidates.length > 0) {
        sentence = candidates[Math.floor(Math.random() * candidates.length)];
        blankAt = sentence.text.toLowerCase().indexOf(word.word.toLowerCase());
        if (blankAt >= 0) dir = "cloze";
        else sentence = null;
      }
    }
    return { word, dir, sentence, blankAt };
  };

  const finish = async () => {
    setSummary(await todayReviewSummary(config));
    setPhase("done");
  };

  const next = async () => {
    // 연타·더블클릭 가드 — await 사이에 두 번째 호출이 끼면 첫 문제가 출제 없이 소모된다
    if (advancing.current) return;
    advancing.current = true;
    try {
      const built = await (upcoming.current ?? buildQuestion());
      upcoming.current = null;
      if (!built) {
        await finish();
        return;
      }
      setQ(built);
      setInput("");
      setResult(null);
      setPhase("question");
      setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      advancing.current = false;
    }
  };

  useEffect(() => {
    if (phase === "answered") canAdvance.current = true;
  }, [phase]);

  useEffect(() => {
    (async () => {
      const { words, stats: st } = await loadDeck(config);
      stats.current = st;
      queue.current = practiceOrder(words, st);
      cursor.current = 0;
      if (queue.current.length === 0) setPhase("empty");
      else next();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!q || phase !== "question" || !input.trim()) return;
    const expected = q.dir === "sk" ? q.word.meaning : q.word.word;
    const res = gradeAnswer(input, expected, q.dir === "sk" ? "toMeaning" : "toWord", config);
    setResult(res);
    canAdvance.current = false;
    setPhase("answered");
    speak(q.word.word, config.speechLang); // 방향·유형과 무관하게 항상 한 번 읽는다

    // 로컬 통계 갱신 (가중치·어려운 단어 판정용)
    const s = stats.current.get(q.word.id) ?? { reviews: 0, correct: 0 };
    stats.current.set(q.word.id, { reviews: s.reviews + 1, correct: s.correct + (res.ok ? 1 : 0) });
    setSeen((n) => n + 1);
    answerWord(config, q.word, res.ok).catch(() => {});
    upcoming.current = buildQuestion(); // 프리페치 — 오답 재출제 확률도 그대로 반영됨
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
    if (e.altKey && config.altKeyMap[e.key]) {
      e.preventDefault();
      insertChar(config.altKeyMap[e.key]);
    }
  };

  const progress = `${seen}문제`;

  if (phase === "loading")
    return (
      <main className="p-4">
        <p className="mt-16 text-center text-sm text-faint">불러오는 중…</p>
      </main>
    );

  if (phase === "empty")
    return (
      <main className="p-4 text-center">
        <p className="mt-16 text-faint">출제할 단어가 없습니다</p>
        <Link
          href="/language"
          className="mt-4 inline-flex min-h-11 items-center rounded-md border border-lang/40 bg-lang-soft px-4 text-sm text-lang"
        >
          덱으로 돌아가기
        </Link>
      </main>
    );

  if (phase === "done")
    return (
      <main className="p-4 text-center">
        <p className="mt-16 font-display text-2xl font-bold">연습 끝 🎉</p>
        {summary && summary.count > 0 && (
          <p className="mt-3 font-mono text-sm text-faint">
            오늘 {summary.count}회 복습 · 정답률 {Math.round((summary.correct / summary.count) * 100)}%
          </p>
        )}
        <Link
          href="/language"
          className="mt-8 inline-block rounded-md bg-lang px-6 py-3 font-medium text-white"
        >
          덱으로
        </Link>
      </main>
    );

  if (!q) return null;
  const answered = phase === "answered";
  const showTargetInput = q.dir !== "sk"; // 대상 언어를 입력하는 방향

  return (
    <main className="p-4">
      <header className="mb-6 flex items-center justify-between text-sm text-faint">
        <button
          type="button"
          onClick={finish}
          className="inline-flex min-h-11 items-center rounded-lg border border-lang/40 bg-lang-soft px-3.5 font-mono text-xs text-lang"
        >
          종료
        </button>
        <span className="font-mono text-xs">{progress}</span>
      </header>

      <div
        className={`rounded-lg border bg-card p-6 ${
          answered ? (result?.ok ? "border-ok" : "border-err") : "border-line"
        }`}
      >
        {/* 문제 영역 */}
        {q.dir === "cloze" && q.sentence ? (
          <div className="mb-4">
            <p className="font-display text-lg leading-relaxed">
              {q.sentence.text.slice(0, q.blankAt)}
              {answered ? (
                <span className="font-bold text-ok">{q.word.word}</span>
              ) : (
                <span className="inline-block w-20 border-b-2 border-lang" />
              )}
              {q.sentence.text.slice(q.blankAt + q.word.word.length)}
            </p>
            <p className="mt-2 text-sm text-faint">뜻: {promptMeaning(q.word.meaning)}</p>
            {answered && (q.sentence.ko_text || q.sentence.en_text) && (
              <p className="mt-2 text-sm text-faint">{q.sentence.ko_text ?? q.sentence.en_text}</p>
            )}
          </div>
        ) : (
          <p className="mb-4 text-center font-display text-3xl font-bold">
            {q.dir === "sk" ? (
              <>
                {articleFor(q.word.gender) && (
                  <span className="mr-2 text-faint">{articleFor(q.word.gender)}</span>
                )}
                {q.word.word}
              </>
            ) : (
              `"${promptMeaning(q.word.meaning)}"`
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
              onBlur={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                onKeyDown(e);
                // preventDefault 없으면 이 Enter의 keypress가 방금 autoFocus된 "다음" 버튼으로 가
                // 곧바로 next()까지 실행됨 — 정답/오답 화면이 안 보이고 넘어감
                if (e.key === "Enter" && !e.nativeEvent.isComposing && !e.repeat) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={showTargetInput ? config.inputPlaceholder : "한국어 뜻..."}
              className="w-full rounded-md border border-line bg-card px-4 py-3"
              lang={showTargetInput ? config.code : "ko"}
              autoCapitalize="off"
              autoComplete="off"
            />
            {showTargetInput && config.accentChars.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                {config.accentChars.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => insertChar(c)}
                    className="rounded border border-lang/40 bg-lang-soft px-2 py-1 font-mono text-sm text-lang"
                  >
                    {c}
                  </button>
                ))}
                <span className="ml-1 font-mono text-[11px] text-faint">alt+모음→á · alt+n→ñ</span>
              </div>
            )}
            <button
              onClick={submit}
              disabled={!input.trim()}
              className="mt-4 w-full rounded-md bg-lang py-3 font-medium text-white disabled:opacity-40"
            >
              확인
            </button>
          </>
        ) : (
          <div className="text-center">
            <p className={`font-semibold ${result?.ok ? "text-ok" : "text-err"}`}>
              {result?.accentCorrected
                ? `✓ 정답 — 악센트 표기: ${result.accentCorrected}`
                : result?.ok
                  ? "✓ 정답"
                  : "✗ 오답"}
            </p>
            <p className="mt-3 font-display text-2xl font-bold">
              {articleFor(q.word.gender) && (
                <span className="mr-2 text-faint">{articleFor(q.word.gender)}</span>
              )}
              {q.word.word}
            </p>
            <p className="mt-1 text-faint">{q.word.meaning}</p>
            <button
              onClick={() => {
                if (canAdvance.current) next();
              }}
              onKeyDown={(e) => {
                // Enter를 누른 채로 두면 오토리핏이 채점 화면을 연달아 넘긴다.
                // keydown을 취소하면 버튼을 누르는 keypress 자체가 생기지 않는다
                if (e.key === "Enter" && e.repeat) e.preventDefault();
              }}
              autoFocus
              className="mt-5 w-full rounded-md bg-lang py-3 font-medium text-white"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

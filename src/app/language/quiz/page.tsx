"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  applyAnswer,
  articleFor,
  clozeIndex,
  dueByTomorrow,
  ensureSentences,
  gradeAnswer,
  loadDeck,
  localDate,
  pickDirection,
  promptMeaning,
  saveAnswer,
  seededRandom,
  StudySession,
  useCurrentConfig,
  type GradeResult,
  type Sentence,
  type Word,
} from "@/modules/language";
import { useT } from "@/modules/shared/i18n";
import { pill } from "../../ui/accent";

// §11.4.2 퀴즈 (2026-09-16, #99 — 소개 단계·세션 안 재출제·복습 우선)
// 카드 세 종류: 소개(새 단어, 채점 없음) · 뒤집기(단어→뜻, 자기 채점 2버튼) · 타이핑(뜻→단어, 빈칸)
// 순서와 끝은 StudySession이 정한다 — due 복습 → 신규(상한·정답률 가드) → 대기 카드, 다 비면 끝.
// 받아쓰기(listen)·관사(gender) 문제는 이식 제외 (#41 범위, 2026-08-15 확정)

type Dir = "sk" | "ks" | "cloze";
type Phase = "loading" | "intro" | "question" | "revealed" | "answered" | "done" | "empty";

interface Question {
  word: Word;
  dir: Dir;
  sentence: Sentence | null;
  blankAt: number; // cloze에서 원문(text) 안 단어 위치
}
type Card = { kind: "intro"; word: Word } | ({ kind: "quiz" } & Question);

interface Wrap {
  answered: number;
  correct: number;
  newCount: number;
  tomorrow: number;
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
  const t = useT();
  const [phase, setPhase] = useState<Phase>("loading");
  const [seen, setSeen] = useState(0); // 이번 세션에 채점한 수 — 진행률 대신 표시
  const [card, setCard] = useState<Card | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [introSentence, setIntroSentence] = useState<Sentence | null>(null);
  const [wrap, setWrap] = useState<Wrap | null>(null);
  const [saveFailures, setSaveFailures] = useState(0); // DB에 안 남은 답안 수 — 조용히 잃지 않게 표시

  const session = useRef<StudySession | null>(null);
  const deck = useRef<Word[]>([]); // FSRS 필드를 답마다 되먹인 덱 — 끝 화면의 내일 복습 수
  const inputRef = useRef<HTMLInputElement>(null);
  // 정답 화면에 머무는 동안 다음 문제(예문 페치 포함)를 미리 준비 — "다음" 탭이 즉시가 되게
  const upcoming = useRef<Promise<Card | null> | null>(null);
  const advancing = useRef(false); // next() 진행 중 — 중복 호출이 문제를 건너뛰지 못하게
  // 버튼 화면이 실제로 그려진 뒤에만 진행을 받는다 — 제출 제스처의 꼬리가 화면을 건너뛰지 못하게 (#76)
  const canAdvance = useRef(false);

  const buildCard = async (): Promise<Card | null> => {
    const item = session.current?.next();
    if (!item) return null;
    if (item.kind === "intro") return { kind: "intro", word: item.word };
    const { dir: base, tryCloze } = pickDirection(item.word);
    let dir: Dir = base;
    let sentence: Sentence | null = null;
    let blankAt = -1;
    if (tryCloze) {
      const candidates = await ensureSentences(config, item.word.id).catch(() => [] as Sentence[]);
      if (candidates.length > 0) {
        sentence = candidates[Math.floor(Math.random() * candidates.length)];
        blankAt = clozeIndex(sentence.text, item.word.word);
        if (blankAt >= 0) dir = "cloze";
        else sentence = null;
      }
    }
    return { kind: "quiz", word: item.word, dir, sentence, blankAt };
  };

  const finish = () => {
    const s = session.current;
    setWrap({
      answered: s?.answered ?? 0,
      correct: s?.correct ?? 0,
      newCount: s?.newCount ?? 0,
      tomorrow: dueByTomorrow(deck.current),
    });
    setPhase("done");
  };

  const next = async () => {
    // 연타·더블클릭 가드 — await 사이에 두 번째 호출이 끼면 첫 문제가 출제 없이 소모된다
    if (advancing.current) return;
    advancing.current = true;
    canAdvance.current = false;
    try {
      const built = await (upcoming.current ?? buildCard());
      upcoming.current = null;
      if (!built) {
        finish();
        return;
      }
      setCard(built);
      setInput("");
      setResult(null);
      setIntroSentence(null);
      setPhase(built.kind === "intro" ? "intro" : "question");
      if (built.kind === "quiz" && built.dir !== "sk") setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      advancing.current = false;
    }
  };

  // card도 의존성에 둔다 — 소개 카드가 연달아 오면 phase는 "intro"→"intro"로 같아 게이트가 닫힌 채 남는다
  useEffect(() => {
    if (phase === "intro" || phase === "revealed" || phase === "answered") canAdvance.current = true;
  }, [phase, card]);

  // 소개 카드: 보이는 즉시 읽어 주고, 예문은 있으면 뒤따라 붙인다 (없어도 카드는 그대로 — Q13)
  useEffect(() => {
    if (phase !== "intro" || card?.kind !== "intro") return;
    let stale = false;
    speak(card.word.word, config.speechLang);
    ensureSentences(config, card.word.id)
      .then((list) => {
        if (!stale && list.length > 0) setIntroSentence(list[0]);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, card]);

  // config는 하이드레이션 직후 저장값으로 한 번 바뀐다 ([]로 두면 덱은 es, 채점은 저장값으로 갈린다)
  useEffect(() => {
    let stale = false;
    (async () => {
      const { words, stats } = await loadDeck(config);
      if (stale) return; // 앞 config의 덱이 늦게 도착해 덮어쓰지 못하게
      deck.current = words;
      const now = new Date();
      session.current = new StudySession(words, stats, now, seededRandom(`${localDate(now)}:${config.code}`));
      if (words.length === 0) setPhase("empty");
      else next();
    })();
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  /** 채점 결과 1건 반영 — FSRS는 여기서 계산해 카드에 곧장 되먹이고(세션이 재출제 시각을 알게), 저장은 뒤따른다 */
  const record = (word: Word, ok: boolean) => {
    const now = new Date();
    const applied = applyAnswer(word, ok, now);
    Object.assign(word, applied.fields);
    session.current?.graded(word, ok, now);
    setSeen(session.current?.answered ?? 0);
    saveAnswer(config, word.id, applied, now).catch(() => setSaveFailures((n) => n + 1));
  };

  const submit = () => {
    if (card?.kind !== "quiz" || phase !== "question" || !input.trim()) return;
    const res = gradeAnswer(input, card.word.word, "toWord", config);
    setResult(res);
    canAdvance.current = false;
    setPhase("answered");
    speak(card.word.word, config.speechLang);
    record(card.word, res.ok);
    upcoming.current = buildCard(); // 프리페치 — 채점이 반영된 뒤라 재출제·가드도 그대로 반영됨
  };

  const reveal = () => {
    if (card?.kind !== "quiz" || phase !== "question") return;
    canAdvance.current = false;
    setPhase("revealed");
    speak(card.word.word, config.speechLang);
  };

  const selfGrade = (ok: boolean) => {
    if (card?.kind !== "quiz" || phase !== "revealed" || !canAdvance.current) return;
    record(card.word, ok);
    next();
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

  // Enter를 누른 채로 두면 오토리핏이 버튼 화면을 연달아 넘긴다 — keydown을 취소하면 keypress 자체가 생기지 않는다
  const noRepeat = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" && e.repeat) e.preventDefault();
  };

  const progress = t.lang.quiz.seen(seen);
  const failed = saveFailures > 0 ? t.lang.quiz.saveFailed(saveFailures) : null;

  if (phase === "loading")
    return (
      <main className="p-4">
        <p className="mt-16 text-center text-sm text-faint">{t.common.loading}</p>
      </main>
    );

  if (phase === "empty")
    return (
      <main className="p-4 text-center">
        <p className="mt-16 text-faint">{t.lang.quiz.empty}</p>
        <Link
          href="/language"
          className="mt-4 inline-flex min-h-11 items-center rounded-md border border-lang/40 bg-lang-soft px-4 text-sm text-lang"
        >
          {t.lang.quiz.backToDeck}
        </Link>
      </main>
    );

  if (phase === "done")
    return (
      <main className="p-4 text-center">
        <p className="mt-16 font-display text-2xl font-bold">{t.lang.quiz.done}</p>
        {wrap && (
          <div className="mt-3 space-y-1 font-dot text-dot text-faint">
            {wrap.answered > 0 && <p>{t.lang.quiz.sessionResult(wrap.correct, wrap.answered)}</p>}
            <p>
              {t.lang.quiz.newLearned(wrap.newCount)} · {t.lang.quiz.dueTomorrow(wrap.tomorrow)}
            </p>
          </div>
        )}
        {failed && <p className="mt-3 font-dot text-dot text-err">{failed}</p>}
        <Link
          href="/language"
          className="mt-8 inline-block rounded-md bg-lang px-6 py-3 font-medium text-white"
        >
          {t.lang.quiz.toDeck}
        </Link>
      </main>
    );

  if (!card) return null;

  const header = (
    <header className="mb-6 flex items-center justify-between text-sm text-faint">
      <button type="button" onClick={finish} className={pill("lang")}>
        {t.lang.quiz.quit}
      </button>
      <span className="font-dot text-dot">
        {failed && <span className="mr-2 text-err">{failed}</span>}
        {progress}
      </span>
    </header>
  );

  const headword = (word: Word) => (
    <>
      {articleFor(word.gender) && <span className="mr-2 text-faint">{articleFor(word.gender)}</span>}
      {word.word}
    </>
  );

  if (card.kind === "intro")
    return (
      <main className="p-4">
        {header}
        <div className="rounded-lg border border-lang/40 bg-card p-6 text-center">
          <p className="font-dot text-dot uppercase tracking-dot-wide text-lang">{t.lang.quiz.newWord}</p>
          <p className="mt-3 font-display text-3xl font-bold">{headword(card.word)}</p>
          <p className="mt-2 text-lg">{card.word.meaning}</p>
          {introSentence && (
            <div className="mt-5 text-left">
              <p className="font-display leading-relaxed">{introSentence.text}</p>
              {(introSentence.ko_text || introSentence.en_text) && (
                <p className="mt-1 text-sm text-faint">{introSentence.ko_text ?? introSentence.en_text}</p>
              )}
            </div>
          )}
          <button
            onClick={() => {
              if (canAdvance.current) next();
            }}
            onKeyDown={noRepeat}
            autoFocus
            className="mt-6 w-full rounded-md bg-lang py-3 font-medium text-white"
          >
            {t.lang.quiz.gotIt}
          </button>
        </div>
      </main>
    );

  const q = card;
  const answered = phase === "answered";
  const revealed = phase === "revealed";
  const flip = q.dir === "sk"; // 단어→뜻은 뒤집기 + 자기 채점 (Q9)

  return (
    <main className="p-4">
      {header}

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
            <p className="mt-2 text-sm text-faint">{t.lang.quiz.meaning(promptMeaning(q.word.meaning))}</p>
            {answered && (q.sentence.ko_text || q.sentence.en_text) && (
              <p className="mt-2 text-sm text-faint">{q.sentence.ko_text ?? q.sentence.en_text}</p>
            )}
          </div>
        ) : (
          <p className="mb-4 text-center font-display text-3xl font-bold">
            {flip ? headword(q.word) : `"${promptMeaning(q.word.meaning)}"`}
          </p>
        )}

        {/* 뒤집기: 뜻 보기 → 틀림/맞음 */}
        {flip && !revealed && (
          <button
            onClick={reveal}
            autoFocus
            className="mt-2 w-full rounded-md bg-lang py-3 font-medium text-white"
          >
            {t.lang.quiz.reveal}
          </button>
        )}
        {flip && revealed && (
          <div className="text-center">
            <p className="text-lg">{q.word.meaning}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => selfGrade(false)}
                onKeyDown={noRepeat}
                className="rounded-md border border-err py-3 font-medium text-err"
              >
                {t.lang.quiz.selfWrong}
              </button>
              <button
                onClick={() => selfGrade(true)}
                onKeyDown={noRepeat}
                autoFocus
                className="rounded-md bg-lang py-3 font-medium text-white"
              >
                {t.lang.quiz.selfRight}
              </button>
            </div>
          </div>
        )}

        {/* 타이핑: 입력 → 채점 → 다음 */}
        {!flip && !answered && (
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
              placeholder={config.inputPlaceholder}
              className="w-full rounded-md border border-line bg-card px-4 py-3"
              lang={config.code}
              autoCapitalize="off"
              autoComplete="off"
            />
            {config.accentChars.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                {config.accentChars.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => insertChar(c)}
                    className="rounded border border-lang/40 bg-lang-soft px-2 py-1 font-dot text-dot text-lang"
                  >
                    {c}
                  </button>
                ))}
                <span className="ml-1 font-dot text-dot text-faint">{t.lang.quiz.accentHint}</span>
              </div>
            )}
            <button
              onClick={submit}
              disabled={!input.trim()}
              className="mt-4 w-full rounded-md bg-lang py-3 font-medium text-white disabled:opacity-40"
            >
              {t.lang.quiz.check}
            </button>
          </>
        )}
        {!flip && answered && (
          <div className="text-center">
            <p className={`font-semibold ${result?.ok ? "text-ok" : "text-err"}`}>
              {result?.accentCorrected
                ? t.lang.quiz.correctAccent(result.accentCorrected)
                : result?.ok
                  ? t.lang.quiz.correct
                  : t.lang.quiz.wrong}
            </p>
            <p className="mt-3 font-display text-2xl font-bold">{headword(q.word)}</p>
            <p className="mt-1 text-faint">{q.word.meaning}</p>
            <button
              onClick={() => {
                if (canAdvance.current) next();
              }}
              onKeyDown={noRepeat}
              autoFocus
              className="mt-5 w-full rounded-md bg-lang py-3 font-medium text-white"
            >
              {t.lang.quiz.next}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

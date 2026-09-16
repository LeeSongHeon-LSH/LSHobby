import { beforeEach, describe, expect, it, vi } from "vitest";
import { esConfig } from "./es";
import { enConfig } from "./en";
import { configFor, languageConfigs } from "./registry";
import { articleFor, clozeIndex, promptMeaning } from "./display";
import { answerAlternatives, gradeAnswer } from "./grading";
import {
  applyAnswer,
  fromCard,
  isLearning,
  LEARNING_STEPS,
  toCard,
  type SrsFields,
} from "./srs";
import { StudySession, dueByTomorrow, pickDirection, seededRandom, type SessionCard } from "./session";
import type { Word } from "./words";
import type { WordStat } from "./review-stats";

const NOW = new Date("2026-08-14T12:00:00Z");

const newRow = (over: Partial<SrsFields> = {}): SrsFields => ({
  due: null,
  stability: null,
  difficulty: null,
  elapsed_days: 0,
  scheduled_days: 0,
  reps: 0,
  lapses: 0,
  learning_steps: 0,
  state: 0,
  last_review: null,
  ...over,
});

describe("esConfig.normalize (중복 차단 norm — 구 db.py normalize_word)", () => {
  it("모음 악센트를 제거한다", () => {
    expect(esConfig.normalize("país")).toBe("pais");
    expect(esConfig.normalize("DÓNDE")).toBe("donde");
  });
  it("ñ은 유지한다", () => {
    expect(esConfig.normalize("Año")).toBe("año");
    expect(esConfig.normalize("ESPAÑOL")).toBe("español");
  });
  it("trim + 소문자화한다", () => {
    expect(esConfig.normalize("  Casa  ")).toBe("casa");
  });
});

describe("enConfig (§6.2 — 대소문자·앞뒤 공백 무시 정확 일치)", () => {
  it("normalize: trim + 소문자화만 한다", () => {
    expect(enConfig.normalize("  Apple ")).toBe("apple");
  });
  it("채점: 대소문자·공백 차이는 정답", () => {
    expect(gradeAnswer(" APPLE ", "apple", "toWord", enConfig).ok).toBe(true);
  });
  it("채점: 관대 비교 없음 — 철자가 다르면 오답", () => {
    expect(enConfig.gradeLenient).toBeNull();
    expect(gradeAnswer("aple", "apple", "toWord", enConfig).ok).toBe(false);
  });
  it("성별 필드 없음", () => {
    expect(enConfig.hasGender).toBe(false);
  });
});

describe("언어 레지스트리 (FR-18·§6.2 — 언어 추가 = config 등록만)", () => {
  it("es·en이 등록돼 있고 미지원 코드는 null", () => {
    expect(configFor("es")).toBe(esConfig);
    expect(configFor("en")).toBe(enConfig);
    expect(configFor("jp")).toBeNull();
  });
  it("프로토타입 멤버 이름도 null — API 라우트 [lang] 허용목록이 뚫리지 않게", () => {
    for (const code of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
      expect(configFor(code)).toBeNull();
    }
  });
  it("언어별 테이블명이 서로 겹치지 않는다", () => {
    const tables = Object.values(languageConfigs).flatMap((c) => [
      c.wordTable,
      c.reviewLogTable,
      c.sentenceTable,
      c.sentenceFetchTable,
    ]);
    expect(new Set(tables).size).toBe(tables.length);
  });
});

describe("표시 규칙 (§11.4.3)", () => {
  it("articleFor: m=el, f=la, n=el/la, none·성별 없는 언어=빈 문자열", () => {
    expect(articleFor("m")).toBe("el");
    expect(articleFor("f")).toBe("la");
    expect(articleFor("n")).toBe("el/la");
    expect(articleFor("none")).toBe("");
    expect(articleFor(undefined)).toBe("");
  });
  it("promptMeaning: 제시문에는 앞의 두 뜻까지만 (채점은 전체를 받는다)", () => {
    expect(promptMeaning("도착하다, 도달하다, 당도하다, 다다르다")).toBe("도착하다, 도달하다");
    expect(promptMeaning("소년, 남자아이")).toBe("소년, 남자아이");
    expect(promptMeaning("소년")).toBe("소년");
    expect(promptMeaning(" 나라 ,  국가 ")).toBe("나라, 국가"); // 공백은 정리된다
  });
  it("clozeIndex: 단어 경계를 보고 찾는다 — 다른 단어 안에 든 같은 철자는 건너뛴다", () => {
    expect(clozeIndex("Solo quiero sol.", "sol")).toBe(12);
    expect(clozeIndex("¿Tienen casa?", "casa")).toBe(8);
    expect(clozeIndex("Feliz cumpleaños, es tu año.", "año")).toBe(24); // cumpleaños 안은 아님
    expect(clozeIndex("Mi casa es tu casa.", "Casa")).toBe(3); // 대소문자 무시
    expect(clozeIndex("Está solá.", "sol")).toBe(-1); // 악센트 글자도 단어의 일부
    expect(clozeIndex("No hay nada.", "sol")).toBe(-1);
  });
});

describe("gradeAnswer (구 checkAnswer 이식)", () => {
  it("정확 일치는 정답", () => {
    expect(gradeAnswer("la manzana", "la manzana", "toWord", esConfig)).toEqual({
      ok: true,
      accentCorrected: null,
    });
  });
  it("대소문자·공백 차이는 무시한다", () => {
    expect(gradeAnswer(" La  Manzana ", "la manzana", "toWord", esConfig).ok).toBe(true);
    expect(gradeAnswer("일 하다", "일하다", "toMeaning", esConfig).ok).toBe(true);
  });
  it("콤마 대체 정답 중 하나면 정답", () => {
    expect(answerAlternatives("나라, 국가")).toEqual(["나라", "국가"]);
    expect(gradeAnswer("국가", "나라, 국가", "toMeaning", esConfig).ok).toBe(true);
  });
  it("콤마 뜻 전체를 그대로 입력해도 정답", () => {
    expect(gradeAnswer("나라, 국가", "나라, 국가", "toMeaning", esConfig).ok).toBe(true);
  });
  it("toWord: 모음 악센트만 틀리면 정답 + 올바른 표기 안내", () => {
    expect(gradeAnswer("pais", "país", "toWord", esConfig)).toEqual({
      ok: true,
      accentCorrected: "país",
    });
  });
  it("toWord: ñ을 n으로 쓰면 오답 (엄격)", () => {
    expect(gradeAnswer("ano", "año", "toWord", esConfig).ok).toBe(false);
  });
  it("toMeaning: 관대 비교를 적용하지 않는다", () => {
    expect(gradeAnswer("pais", "país", "toMeaning", esConfig).ok).toBe(false);
  });
  it("무관한 답은 오답", () => {
    expect(gradeAnswer("perro", "gato", "toWord", esConfig).ok).toBe(false);
  });
});

describe("FSRS 래퍼 (§6.3 — 정답=Good/오답=Again)", () => {
  it("새 카드 정답: Good(3) 기록, 상태 전진, due는 미래", () => {
    const { fields, rating } = applyAnswer(newRow(), true, NOW);
    expect(rating).toBe(3);
    expect(fields.state).not.toBe(0);
    expect(fields.reps).toBe(1);
    expect(new Date(fields.due!).getTime()).toBeGreaterThan(NOW.getTime());
    expect(fields.last_review).toBe(NOW.toISOString());
  });
  it("오답: Again(1) 기록", () => {
    const { rating } = applyAnswer(newRow(), false, NOW);
    expect(rating).toBe(1);
  });
  it("Review 상태에서 오답이면 lapse가 쌓인다", () => {
    let row = newRow();
    let t = NOW;
    // Good을 반복해 Review(2) 상태까지 끌어올린 뒤 due 시점에 오답
    for (let i = 0; i < 10 && row.state !== 2; i++) {
      row = applyAnswer(row, true, t).fields;
      t = new Date(row.due!);
    }
    expect(row.state).toBe(2);
    const failed = applyAnswer(row, false, t).fields;
    expect(failed.lapses).toBe(row.lapses + 1);
    expect(failed.state).toBe(3); // Relearning
  });
  it("학습 스텝 3단계 — 새 카드는 Good 세 번에 Review로 졸업한다 (#99)", () => {
    expect(LEARNING_STEPS).toEqual(["1m", "5m", "15m"]);
    let row = newRow();
    let t = NOW;
    const steps: number[] = [];
    for (let i = 0; i < 3; i++) {
      row = applyAnswer(row, true, t).fields;
      steps.push(Math.round((new Date(row.due!).getTime() - t.getTime()) / 60_000));
      t = new Date(row.due!);
    }
    expect(steps.slice(0, 2)).toEqual([5, 15]); // 첫 Good은 1분을 건너뛴다
    expect(row.state).toBe(2);
    expect(steps[2]).toBeGreaterThanOrEqual(24 * 60);
  });
  it("Again은 1분 스텝으로 돌아온다 — 세션 안 재출제 대상(isLearning)", () => {
    const first = applyAnswer(newRow(), true, NOW).fields;
    const again = applyAnswer(first, false, new Date(first.due!)).fields;
    expect(isLearning(again)).toBe(true);
    expect(Math.round((new Date(again.due!).getTime() - new Date(first.due!).getTime()) / 60_000)).toBe(1);
    expect(isLearning(newRow({ state: 2 }))).toBe(false);
    expect(isLearning(newRow({ state: 3 }))).toBe(true);
  });
  it("toCard/fromCard 왕복이 필드를 보존한다", () => {
    const row = applyAnswer(newRow(), true, NOW).fields;
    expect(fromCard(toCard(row))).toEqual(row);
  });
  it("반영 결과를 되먹이지 않으면 다음 답이 앞 답을 지운다 — 퀴즈가 카드를 갱신해야 하는 이유", () => {
    const row = newRow();
    const first = applyAnswer(row, true, NOW).fields;
    expect(first.reps).toBe(1);
    const at = new Date(first.due!);
    // 같은 스냅샷으로 다시 채점: state가 아직 New라 createEmptyCard가 또 돌아 1회차가 사라진다
    expect(applyAnswer(row, true, at).fields.reps).toBe(1);
    // 되먹인 카드로 채점: 이력이 이어진다
    expect(applyAnswer(first, true, at).fields.reps).toBe(2);
  });
});

describe("StudySession (세션 구성 — 소개·재출제·복습 우선, 2026-09-16 #99)", () => {
  const past = "2026-08-13T00:00:00Z";
  const future = "2026-08-20T00:00:00Z";
  const w = (id: number, over: Partial<SrsFields> = {}): Word =>
    ({ id, word: `w${id}`, meaning: `뜻${id}`, norm: `w${id}`, created_at: past, ...newRow(over) }) as Word;
  const review = (id: number, over: Partial<SrsFields> = {}) => w(id, { state: 2, due: past, ...over });
  const stat = (pairs: [number, number, number][]): Map<number, WordStat> =>
    new Map(pairs.map(([id, reviews, correct]) => [id, { reviews, correct }]));
  const fixed = () => 0.5;
  /**
   * 카드를 끝까지 뽑아 "종류:id" 목록으로 — 채점은 grade가 정하고(기본: 전부 정답) FSRS를 실제로 적용한다.
   * 시각은 고정이라 학습 스텝의 재출제는 learn-ahead로 온다: 새 단어는 소개 + Good 3회로 졸업
   */
  const drain = (s: StudySession, grade: (card: SessionCard) => boolean = () => true, limit = 100): string[] => {
    const out: string[] = [];
    for (let i = 0; i < limit; i++) {
      const c = s.next(NOW);
      if (!c) break;
      out.push(`${c.kind}:${c.word.id}`);
      if (c.kind === "quiz") {
        const ok = grade(c);
        Object.assign(c.word, applyAnswer(c.word, ok, NOW).fields);
        s.graded(c.word, ok, NOW);
      }
    }
    return out;
  };

  it("due 복습을 전부 낸 뒤에야 신규가 나온다 — 신규는 소개 카드로 시작한다", () => {
    const s = new StudySession([w(1), review(10), review(11)], stat([[10, 2, 1], [11, 2, 2]]), NOW, fixed);
    expect(drain(s)).toEqual(["quiz:10", "quiz:11", "intro:1", "quiz:1", "quiz:1", "quiz:1"]);
  });
  it("복습은 정답률 낮은 순, 같으면 오래 안 본 순", () => {
    const words = [
      review(1, { last_review: "2026-08-12T00:00:00Z" }),
      review(2, { last_review: "2026-08-01T00:00:00Z" }),
      review(3),
    ];
    expect(drain(new StudySession(words, stat([[1, 4, 4], [2, 4, 4], [3, 4, 1]]), NOW, fixed))).toEqual([
      "quiz:3",
      "quiz:2",
      "quiz:1",
    ]);
  });
  it("due 아닌 카드는 내지 않는다 — 다 떨어지면 세션이 끝난다", () => {
    const s = new StudySession([review(1, { due: future })], stat([[1, 1, 1]]), NOW, fixed);
    expect(s.next(NOW)).toBeNull();
  });
  it("소개 뒤 첫 인출은 다른 카드 셋을 지나서 온다", () => {
    const words = [w(1), review(10), review(11), review(12), review(13)];
    const s = new StudySession(words, stat([[10, 1, 1], [11, 1, 1], [12, 1, 1], [13, 1, 1]]), NOW, fixed);
    // 복습 넷이 먼저 — 신규가 복습 앞에 나올 수 없으니 첫 인출 간격은 신규끼리로 본다
    const order = drain(s);
    expect(order.slice(0, 4)).toEqual(["quiz:10", "quiz:11", "quiz:12", "quiz:13"]);
    expect(order.slice(4)).toEqual(["intro:1", "quiz:1", "quiz:1", "quiz:1"]); // 남은 게 없으면 기다리지 않는다
  });
  it("신규가 여럿이면 소개들 사이에 첫 인출이 끼어 든다", () => {
    const s = new StudySession([w(1), w(2), w(3), w(4), w(5)], stat([]), NOW, () => 0.5);
    const order = drain(s);
    // 소개 셋 뒤(카드 4장째)에 첫 소개 단어의 인출이 온다
    const firstIntro = order[0].replace("intro:", "");
    expect(order[3]).toBe(`quiz:${firstIntro}`);
    expect(order).toHaveLength(20); // 소개 5 + 인출 3회씩
  });
  it("정답 기록이 0회인 Learning 단어도 소개를 먼저 받는다 — 맞힌 적 있는 단어는 받지 않는다", () => {
    const words = [w(1, { state: 1, due: past }), w(2, { state: 1, due: past })];
    const s = new StudySession(words, stat([[1, 3, 0], [2, 3, 1]]), NOW, fixed);
    const order = drain(s);
    expect(order).toContain("intro:1");
    expect(order).not.toContain("intro:2");
    expect(order.indexOf("quiz:1")).toBeGreaterThan(order.indexOf("intro:1"));
  });
  it("신규는 하루 고정 난수 순 — 같은 시드면 같은 순서, 다른 시드면 다른 순서", () => {
    const words = () => Array.from({ length: 8 }, (_, i) => w(i + 1)); // drain이 FSRS를 적용하므로 매번 새로
    const order = (seed: string) =>
      drain(new StudySession(words(), stat([]), NOW, seededRandom(seed))).filter((c) => c.startsWith("intro"));
    expect(order("2026-09-16:es")).toEqual(order("2026-09-16:es"));
    expect(order("2026-09-16:es")).not.toEqual(order("2026-09-17:es"));
    expect(order("2026-09-16:es")).not.toEqual(words().map((x) => `intro:${x.id}`)); // id 순이 아니다
  });
  it("upcomingFresh는 신규 순서대로 상한까지 — 소개 뒤엔 그만큼 줄어든다", () => {
    const words = Array.from({ length: 30 }, (_, i) => w(i + 1));
    const s = new StudySession(words, stat([]), NOW, seededRandom("2026-09-16:es"));
    const ahead = s.upcomingFresh().map((x) => x.id);
    expect(ahead).toHaveLength(12);
    const intros = drain(s).filter((c) => c.startsWith("intro")).map((c) => Number(c.slice(6)));
    expect(intros).toEqual(ahead);
    expect(s.upcomingFresh()).toHaveLength(0);
  });
  it("신규는 세션당 12개까지", () => {
    const words = Array.from({ length: 30 }, (_, i) => w(i + 1));
    const s = new StudySession(words, stat([]), NOW, fixed);
    const order = drain(s);
    expect(order.filter((c) => c.startsWith("intro"))).toHaveLength(12);
    expect(s.newCount).toBe(12);
  });
  it("채점 10회 이후 정답률이 75% 아래면 신규 투입을 멈춘다", () => {
    const reviews = Array.from({ length: 10 }, (_, i) => review(100 + i));
    const s = new StudySession([w(1), ...reviews], stat(reviews.map((r) => [r.id, 2, 2])), NOW, fixed);
    const order = drain(s, (c) => c.word.id < 105); // 열 개 중 다섯만 정답 → 50%
    expect(order.some((c) => c.startsWith("intro"))).toBe(false);
    expect(s.answered).toBeGreaterThanOrEqual(10);
  });
  it("정답률 가드는 채점 10회 전에는 작동하지 않는다 — 첫 오답 하나로 신규가 막히지 않게", () => {
    const s = new StudySession([w(1), review(10)], stat([[10, 2, 2]]), NOW, fixed);
    expect(drain(s, () => false)).toContain("intro:1");
  });
  it("Learning으로 남은 카드는 due가 오면 세션 안에서 다시 나온다 — 그 전엔 다른 카드가 먼저", () => {
    const later = new Date(NOW.getTime() + 5 * 60_000).toISOString();
    const s = new StudySession([review(1), review(2)], stat([[1, 2, 1], [2, 2, 2]]), NOW, fixed);
    expect(s.next(NOW)).toEqual({ kind: "quiz", word: review(1) });
    const card = { ...review(1), state: 3, due: later }; // 오답 → Relearning, 5분 뒤
    s.graded(card, false, NOW);
    expect(s.next(NOW)!.word.id).toBe(2); // 아직 due 전 — 복습 먼저
    expect(s.next(new Date(NOW.getTime() + 60_000))!.word.id).toBe(1); // 남은 게 없으면 앞당겨 낸다
    expect(s.next(NOW)).toBeNull();
  });
  it("재출제가 여럿이면 due가 이른 것부터", () => {
    const at = (min: number) => new Date(NOW.getTime() + min * 60_000).toISOString();
    const s = new StudySession([], stat([]), NOW, fixed);
    s.graded({ ...review(1), state: 1, due: at(15) }, true, NOW);
    s.graded({ ...review(2), state: 1, due: at(5) }, true, NOW);
    const t = new Date(NOW.getTime() + 20 * 60_000);
    expect(s.next(t)!.word.id).toBe(2);
    expect(s.next(t)!.word.id).toBe(1);
  });
  it("Review로 졸업했거나 due가 한 시간 넘게 남으면 다시 내지 않는다", () => {
    const s = new StudySession([], stat([]), NOW, fixed);
    s.graded({ ...review(1), state: 2, due: future }, true, NOW);
    s.graded({ ...review(2), state: 1, due: future }, true, NOW);
    expect(s.next(new Date(future))).toBeNull();
  });
  it("채점 수·정답 수·단어별 집계를 세션이 든다", () => {
    const st = stat([[1, 2, 1], [2, 2, 2]]);
    const s = new StudySession([review(1), review(2)], st, NOW, fixed);
    s.graded(s.next(NOW)!.word, false, NOW); // 정답률 낮은 1이 먼저
    s.graded(s.next(NOW)!.word, true, NOW);
    expect([s.answered, s.correct]).toEqual([2, 1]);
    expect(st.get(1)).toEqual({ reviews: 3, correct: 1 });
    expect(st.get(2)).toEqual({ reviews: 3, correct: 3 });
  });
});

describe("pickDirection (수용 먼저 — Learning은 단어→뜻만)", () => {
  const base = { id: 1, word: "w", meaning: "m", norm: "w", created_at: "" };
  it("New·Learning·Relearning은 sk, 빈칸 시도 없음", () => {
    for (const state of [0, 1, 3]) {
      expect(pickDirection({ ...base, ...newRow({ state }) } as Word, () => 0.9)).toEqual({ dir: "sk", tryCloze: false });
    }
  });
  it("Review는 반반 + 30% 빈칸 시도", () => {
    const rv = { ...base, ...newRow({ state: 2 }) } as Word;
    expect(pickDirection(rv, () => 0.1)).toEqual({ dir: "sk", tryCloze: true });
    expect(pickDirection(rv, () => 0.7)).toEqual({ dir: "ks", tryCloze: false });
  });
});

describe("dueByTomorrow (끝 화면 — 로컬 날짜 기준 내일까지의 due)", () => {
  const at = (y: number, mo: number, d: number, h: number) => new Date(y, mo - 1, d, h);
  const row = (id: number, due: Date | null, state = 2): Word =>
    ({ id, word: "w", meaning: "m", norm: `n${id}`, created_at: "", ...newRow({ state, due: due?.toISOString() ?? null }) }) as Word;
  it("오늘 남은 것·내일 것은 세고, 모레 0시부터는 세지 않는다. New는 제외", () => {
    const now = at(2026, 9, 16, 22);
    const words = [
      row(1, at(2026, 9, 16, 23)),
      row(2, at(2026, 9, 17, 23)),
      row(3, at(2026, 9, 18, 0)),
      row(4, at(2026, 9, 1, 0)),
      row(5, null, 0),
    ];
    expect(dueByTomorrow(words, now)).toBe(3);
  });
});

describe("seededRandom", () => {
  it("같은 시드는 같은 수열, [0,1) 범위", () => {
    const a = seededRandom("x");
    const b = seededRandom("x");
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
  });
});

describe("통계 집계 (구 stats.py 이식)", () => {
  it("computeStreak: 오늘/어제로 끝나는 연속만 인정", async () => {
    const { computeStreak } = await import("./stats");
    const today = "2026-08-15";
    expect(computeStreak([], today)).toBe(0);
    expect(computeStreak(["2026-08-15", "2026-08-14", "2026-08-13"], today)).toBe(3);
    expect(computeStreak(["2026-08-14", "2026-08-13"], today)).toBe(2); // 어제까지 인정
    expect(computeStreak(["2026-08-13"], today)).toBe(0); // 이틀 전 = 끊김
    expect(computeStreak(["2026-08-15", "2026-08-13"], today)).toBe(1); // 중간 공백
  });

  it("aggregateDaily: 일별 14칸·오늘 수·상태 분포", async () => {
    const { aggregateDaily } = await import("./stats");
    const now = new Date("2026-08-15T12:00:00");
    const rows = [
      { day: "2026-08-14", total: 1, correct: 1 },
      { day: "2026-08-15", total: 2, correct: 1 },
    ];
    const words = [newRow({ state: 0 }), newRow({ state: 2 }), newRow({ state: 2 })].map(
      (r, i) => ({ ...r, id: i + 1, word: "w", gender: "none" as const, meaning: "m", norm: `n${i}`, created_at: "" }),
    );
    const s = aggregateDaily(rows, words, now);
    expect(s.daily).toHaveLength(14);
    expect(s.daily[13]).toEqual({ date: "2026-08-15", total: 2, correct: 1 });
    expect(s.todayTotal).toBe(2);
    expect(s.streak).toBe(2);
    expect(s.totalReviews).toBe(3);
    expect(s.totalCorrect).toBe(2);
    expect(s.stateCounts).toEqual([1, 0, 2, 0]);
  });
  it("buildCsv: 헤더 + 이스케이프", async () => {
    const { buildCsv } = await import("./stats");
    const w = {
      ...newRow(),
      id: 1,
      word: "casa",
      gender: "f" as const,
      meaning: '집, "가정"',
      norm: "casa",
      created_at: "2026-08-15",
    };
    const csv = buildCsv([w], new Map([[1, { reviews: 2, correct: 1 }]]));
    const [header, row] = csv.trim().split("\n");
    expect(header).toBe("word,gender,meaning,reviews,correct,state,due,created_at");
    expect(row).toContain('casa,f,"집, ""가정""",2,1,0,,2026-08-15');
  });
});

describe("Tatoeba 추출 (구 _extract 이식)", () => {
  it("표층형 그대로 든 70자 이하 문장만, 지정 언어 번역 채택", async () => {
    const { extractSentences } = await import("./tatoeba");
    const results = [
      { id: 1, text: "Mi casa es grande.", translations: [[{ lang: "kor", text: "우리 집은 크다." }]] },
      { id: 2, text: "Las casas son caras.", translations: [] }, // 변형(casas) → 제외
      { id: 3, text: "casa ".repeat(20), translations: [] }, // 70자 초과 → 제외
      { id: 4, text: "¿Vamos a casa?", translations: [[{ lang: "eng", text: "Shall we go home?" }]] },
    ];
    const out = extractSentences(results, "casa", "kor");
    expect(out.map((s) => s.text)).toEqual(["Mi casa es grande.", "¿Vamos a casa?"]);
    expect(out[0].ko_text).toBe("우리 집은 크다.");
    expect(out[0].en_text).toBeNull();
    expect(out[1].ko_text).toBeNull(); // kor 모드에선 eng 번역 무시
    expect(out[0].source_url).toContain("/sentences/show/1");
  });

  it("경계는 유니코드 — 수집이 통과시킨 문장은 반드시 빈칸이 뚫린다", async () => {
    const { extractSentences } = await import("./tatoeba");
    const results = [
      { id: 1, text: "Compré estaño para el techo.", translations: [] }, // estaño → 제외
      { id: 2, text: "Esta casa es grande.", translations: [] },
    ];
    const out = extractSentences(results, "esta", "kor");
    expect(out.map((s) => s.text)).toEqual(["Esta casa es grande."]);
    // 두 경계가 어긋나면 저장은 되는데 cloze가 안 나와 슬롯만 먹는다 — 그 드리프트를 여기서 막는다
    for (const s of out) expect(clozeIndex(s.text, "esta")).toBeGreaterThanOrEqual(0);
  });
});

describe("Tatoeba 도달 여부 (#94)", () => {
  // fetch를 갈아끼우고 결과만 본다 — 장애를 "문장 없음"으로 뭉개지 않는지가 전부
  const probe = async (impl: () => Promise<Response>, langs: ("kor" | "eng")[] = ["kor"]) => {
    const { fetchFromTatoeba } = await import("./tatoeba");
    const orig = globalThis.fetch;
    globalThis.fetch = impl as unknown as typeof fetch;
    try {
      return await fetchFromTatoeba("casa", "spa", langs);
    } finally {
      globalThis.fetch = orig;
    }
  };
  const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)));

  it("타임아웃·비2xx는 complete=false — 재시도 방지 마커를 찍으면 안 되는 경우", async () => {
    expect(await probe(() => Promise.reject(new Error("timeout")))).toEqual({
      drafts: [],
      complete: false,
    });
    expect((await probe(() => Promise.resolve(new Response("{}", { status: 503 })))).complete).toBe(
      false,
    );
  });

  it("답은 받았는데 문장이 없으면 complete=true — 이때만 마커가 정당하다", async () => {
    expect(await probe(() => ok({ results: [] }))).toEqual({ drafts: [], complete: true });
  });

  it("묻는 언어 중 하나라도 실패하면 complete=false (es는 kor·eng 둘을 묻는다)", async () => {
    let n = 0;
    const out = await probe(
      () => (++n === 1 ? ok({ results: [] }) : Promise.reject(new Error("timeout"))),
      ["kor", "eng"],
    );
    expect(out.complete).toBe(false);
  });
});

// ---- RPC mock — PostgREST를 흉내 낸다 (max_rows 포함) ----
//
// 순서는 order()가 온 대로 적용하고, range()로 자른 뒤 **마지막에** max_rows로 한 번 더 자른다.
// 상한이 집합 반환 함수에도 걸린다는 것이 이 블록이 지키려는 사실이므로, 그걸 mock에 넣는다.
const MAX_ROWS = 1000;
type RpcRow = Record<string, unknown>;
let rpcRows: RpcRow[] = [];
const rpcCalls: { fn: string; orders: [string, boolean][]; range: [number, number] | null }[] = [];

vi.mock("../shared/auth", () => ({
  supabase: {
    rpc(fn: string) {
      const call = { fn, orders: [] as [string, boolean][], range: null as [number, number] | null };
      rpcCalls.push(call);
      const builder = {
        order(col: string, opts?: { ascending?: boolean }) {
          call.orders.push([col, opts?.ascending ?? true]);
          return builder;
        },
        range(from: number, to: number) {
          call.range = [from, to];
          return builder;
        },
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
          let rows = [...rpcRows];
          for (const [col, asc] of call.orders) {
            rows.sort((a, b) => ((a[col] as never) < (b[col] as never) ? -1 : (a[col] as never) > (b[col] as never) ? 1 : 0) * (asc ? 1 : -1));
          }
          if (call.range) rows = rows.slice(call.range[0], call.range[1] + 1);
          return Promise.resolve({ data: rows.slice(0, MAX_ROWS), error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  },
}));

describe("PostgREST 1000행 상한 (max_rows는 집합 반환 함수에도 걸린다)", () => {
  beforeEach(() => {
    rpcRows = [];
    rpcCalls.length = 0;
  });

  it("dailyStats는 내림차순으로 읽어 잘려도 최신 날짜가 남는다", async () => {
    const { dailyStats } = await import("./stats");
    // RPC 자체는 `order by 1`(오름차순)이라 상한에 걸리면 최신 날짜부터 사라진다
    rpcRows = Array.from({ length: 1200 }, (_, i) => ({
      day: new Date(Date.UTC(2023, 0, 1 + i)).toISOString().slice(0, 10),
      total: 1,
      correct: 1,
    }));
    const newest = rpcRows[rpcRows.length - 1].day;

    const rows = await dailyStats(esConfig);

    expect(rows).toHaveLength(MAX_ROWS); // 상한은 그대로다 — 살아남는 쪽이 어디인지가 요점
    expect(rows.map((r) => r.day)).toContain(newest);
    expect(rpcCalls[0].orders).toEqual([["day", false]]);
  });

  it.each([0, 999, 1000, 2000, 2237])("reviewStats는 %i행을 끝까지 읽는다", async (n) => {
    const { reviewStats } = await import("./review-stats");
    rpcRows = Array.from({ length: n }, (_, i) => ({
      word_id: i + 1,
      reviews: 2,
      correct: 1,
      first_reviewed_at: null,
    }));

    const stats = await reviewStats(esConfig);

    expect(stats.size).toBe(n);
    if (n > 0) expect(stats.get(n)).toEqual({ reviews: 2, correct: 1, firstReviewedAt: null });
    // 정확히 배수면 빈 페이지를 한 번 더 읽어야 끝인 줄 안다
    expect(rpcCalls).toHaveLength(Math.floor(n / MAX_ROWS) + 1);
  });

  it("reviewStats는 페이지 경계가 흔들리지 않게 word_id로 정렬한다", async () => {
    const { reviewStats } = await import("./review-stats");
    rpcRows = Array.from({ length: 1500 }, (_, i) => ({
      word_id: 1500 - i, // *_word_stats에는 order by가 없다 — 아무 순서로나 온다
      reviews: 1,
      correct: 1,
      first_reviewed_at: null,
    }));

    const stats = await reviewStats(esConfig);

    expect(stats.size).toBe(1500);
    for (const call of rpcCalls) expect(call.orders).toEqual([["word_id", true]]);
  });
});

import { describe, expect, it } from "vitest";
import { esConfig } from "./es";
import { enConfig } from "./en";
import { configFor, languageConfigs } from "./registry";
import { articleFor, stateLabel } from "./display";
import { answerAlternatives, gradeAnswer } from "./grading";
import {
  applyAnswer,
  duePool,
  fromCard,
  isDue,
  isHard,
  isNew,
  pickWeight,
  toCard,
  weightedPick,
  type PoolWord,
  type SrsFields,
} from "./srs";

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
  it("stateLabel: FSRS 상태 0~3 라벨, 범위 밖은 ?", () => {
    expect([0, 1, 2, 3].map(stateLabel)).toEqual(["신규", "학습중", "복습", "재학습"]);
    expect(stateLabel(9)).toBe("?");
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
  it("toCard/fromCard 왕복이 필드를 보존한다", () => {
    const row = applyAnswer(newRow(), true, NOW).fields;
    expect(fromCard(toCard(row))).toEqual(row);
  });
});

describe("duePool (구 _due_pool 이식 — 새 단어 일일 한도)", () => {
  const past = "2026-08-13T00:00:00Z";
  const future = "2026-08-20T00:00:00Z";
  const w = (id: number, over: Partial<SrsFields> = {}): PoolWord => ({ id, ...newRow(over) });

  it("due 지난 복습은 전부, 미래 due는 제외", () => {
    const words = [w(1, { state: 2, due: past }), w(2, { state: 2, due: future })];
    expect(duePool(words, NOW, 0).map((x) => x.id)).toEqual([1]);
  });
  it("새 단어는 남은 한도만큼 id 순으로", () => {
    const words = [w(3), w(1), w(2)];
    expect(duePool(words, NOW, 0, 2).map((x) => x.id)).toEqual([1, 2]);
  });
  it("오늘 이미 시작한 새 단어 수만큼 한도에서 차감", () => {
    const words = [w(1), w(2), w(3)];
    expect(duePool(words, NOW, 19).map((x) => x.id)).toEqual([1]);
    expect(duePool(words, NOW, 20)).toEqual([]);
  });
  it("복습 + 새 단어 혼합", () => {
    const words = [w(5, { state: 2, due: past }), w(1), w(2)];
    expect(duePool(words, NOW, 0, 1).map((x) => x.id)).toEqual([5, 1]);
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
  it("countNewStartedToday: 최초 복습이 오늘 자정 이후인 단어만 센다 (성능 P1)", async () => {
    const { countNewStartedToday } = await import("./session");
    const now = new Date("2026-08-14T12:00:00");
    const stats = new Map([
      [1, { reviews: 3, correct: 2, firstReviewedAt: "2026-08-14T01:00:00" }], // 오늘 시작
      [2, { reviews: 5, correct: 5, firstReviewedAt: "2026-08-13T23:59:00" }], // 어제 시작
      [3, { reviews: 1, correct: 1 }], // 로컬 갱신 객체 — 시각 없음
    ]);
    expect(countNewStartedToday(stats, now)).toBe(1);
  });

  it("aggregateDaily: 사전 집계 행에서 aggregate와 같은 결과 (성능 P1)", async () => {
    const { aggregate, aggregateDaily, localDate } = await import("./stats");
    const now = new Date("2026-08-14T12:00:00");
    const words = [newRow({ state: 0 }), newRow({ state: 2 })].map(
      (r, i) => ({ ...r, id: i + 1, word: "w", gender: "none" as const, meaning: "m", norm: `n${i}`, created_at: "" }),
    );
    const logs = [
      { rating: 3, reviewed_at: "2026-08-14T01:00:00" },
      { rating: 1, reviewed_at: "2026-08-14T02:00:00" },
      { rating: 3, reviewed_at: "2026-08-13T01:00:00" },
    ];
    const rows = [
      { day: localDate(new Date("2026-08-13T01:00:00")), total: 1, correct: 1 },
      { day: localDate(new Date("2026-08-14T01:00:00")), total: 2, correct: 1 },
    ];
    expect(aggregateDaily(rows, words, now)).toEqual(aggregate(logs, words, now));
  });

  it("aggregate: 일별 14칸·오늘 수·상태 분포", async () => {
    const { aggregate } = await import("./stats");
    const now = new Date("2026-08-15T12:00:00");
    const logs = [
      { rating: 3, reviewed_at: "2026-08-15T09:00:00" },
      { rating: 1, reviewed_at: "2026-08-15T09:01:00" },
      { rating: 3, reviewed_at: "2026-08-14T09:00:00" },
    ];
    const words = [newRow({ state: 0 }), newRow({ state: 2 }), newRow({ state: 2 })].map(
      (r, i) => ({ ...r, id: i + 1, word: "w", gender: "none" as const, meaning: "m", norm: `n${i}`, created_at: "" }),
    );
    const s = aggregate(logs, words, now);
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
});

describe("파생 판정·가중치 (구 is_hard/_weight 이식)", () => {
  it("isHard: 4회 이상 + 정답률 60% 미만", () => {
    expect(isHard(4, 2)).toBe(true); // 50%
    expect(isHard(3, 0)).toBe(false); // 횟수 부족
    expect(isHard(5, 3)).toBe(false); // 정확히 60%는 어려움 아님
    expect(isHard(10, 4)).toBe(true); // 40%
  });
  it("pickWeight: 미출제 1.0, 오답 많을수록 큼", () => {
    expect(pickWeight(0, 0)).toBe(1);
    expect(pickWeight(4, 4)).toBeCloseTo(0.2);
    expect(pickWeight(4, 0)).toBe(1);
  });
  it("weightedPick: 빈 풀은 null, rand 주입으로 결정적", () => {
    expect(weightedPick([], () => 1)).toBeNull();
    const pool = ["a", "b"];
    expect(weightedPick(pool, (x) => (x === "a" ? 1 : 9), () => 0.05)).toBe("a");
    expect(weightedPick(pool, (x) => (x === "a" ? 1 : 9), () => 0.5)).toBe("b");
  });
  it("isNew/isDue 기본 동작", () => {
    expect(isNew(newRow())).toBe(true);
    expect(isDue(newRow(), NOW)).toBe(true); // due null = 즉시 대상
    expect(isDue(newRow({ due: "2026-08-20T00:00:00Z" }), NOW)).toBe(false);
  });
});

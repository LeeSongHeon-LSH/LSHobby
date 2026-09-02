import { describe, expect, it } from "vitest";
import { esConfig } from "./es";
import { enConfig } from "./en";
import { configFor, languageConfigs } from "./registry";
import { articleFor, clozeIndex, promptMeaning, stateLabel } from "./display";
import { answerAlternatives, gradeAnswer } from "./grading";
import {
  applyAnswer,
  fromCard,
  toCard,
  type SrsFields,
} from "./srs";
import { practiceOrder } from "./session";
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
  it("toCard/fromCard 왕복이 필드를 보존한다", () => {
    const row = applyAnswer(newRow(), true, NOW).fields;
    expect(fromCard(toCard(row))).toEqual(row);
  });
});

describe("practiceOrder (출제 순서 — 하루 할당 폐지, 2026-08-31)", () => {
  const past = "2026-08-13T00:00:00Z";
  const future = "2026-08-20T00:00:00Z";
  const w = (id: number, over: Partial<SrsFields> = {}): Word =>
    ({ id, word: `w${id}`, meaning: `뜻${id}`, norm: `w${id}`, created_at: past, ...newRow(over) }) as Word;
  const stat = (pairs: [number, number, number][]): Map<number, WordStat> =>
    new Map(pairs.map(([id, reviews, correct]) => [id, { reviews, correct }]));
  const ids = (list: Word[]) => list.map((x) => x.id);
  const fixed = () => 0.5; // 랜덤 동률은 고정해 결과를 결정적으로

  it("구간 순서: due 복습 → 신규 → 아직 due 아닌 것", () => {
    const words = [w(1, { state: 2, due: future }), w(2), w(3, { state: 2, due: past })];
    expect(ids(practiceOrder(words, stat([[1, 2, 2], [3, 2, 2]]), NOW, fixed))).toEqual([3, 2, 1]);
  });
  it("구간 안에서는 정답률 낮은 순", () => {
    const words = [w(1, { state: 2, due: past }), w(2, { state: 2, due: past })];
    expect(ids(practiceOrder(words, stat([[1, 4, 4], [2, 4, 1]]), NOW, fixed))).toEqual([2, 1]);
  });
  it("정답률이 같으면 오래 안 본 순", () => {
    const words = [
      w(1, { state: 2, due: past, last_review: "2026-08-12T00:00:00Z" }),
      w(2, { state: 2, due: past, last_review: "2026-08-01T00:00:00Z" }),
    ];
    expect(ids(practiceOrder(words, stat([[1, 2, 1], [2, 2, 1]]), NOW, fixed))).toEqual([2, 1]);
  });
  it("신규는 집계가 없어 0%지만 별도 구간이라 등록 순으로 나간다", () => {
    const words = [w(3), w(1), w(2)];
    expect(ids(practiceOrder(words, stat([]), NOW, fixed))).toEqual([1, 2, 3]);
  });
  it("한 바퀴에 모든 단어가 정확히 한 번씩 들어간다", () => {
    const words = [w(1, { state: 2, due: past }), w(2), w(3, { state: 2, due: future })];
    const out = practiceOrder(words, stat([[1, 1, 0], [3, 1, 1]]), NOW, fixed);
    expect(out).toHaveLength(3);
    expect(new Set(ids(out))).toEqual(new Set([1, 2, 3]));
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

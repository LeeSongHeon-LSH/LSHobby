import { describe, expect, it } from "vitest";
import { esConfig } from "./es";
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

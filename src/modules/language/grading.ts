import type { LanguageConfig } from "./types";

export type GradeResult = {
  ok: boolean;
  /** 악센트만 틀려 정답 처리된 경우 올바른 표기 (UI 안내용), 그 외 null */
  accentCorrected: string | null;
};

// 대소문자·공백 차이 무시 ("일 하다" = "일하다") — 구 앱 checkAnswer의 norm
const collapse = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** 콤마로 구분된 대체 정답 목록 ("나라, 국가" → 둘 다 정답) */
export const answerAlternatives = (expected: string): string[] =>
  expected
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * 타이핑 답안 채점 (docs/06 §6.2, 결정 #41 — 구 앱 checkAnswer 이식).
 * - toWord: 대상 언어를 입력하는 방향(한→스, cloze) — 관대 비교(모음 악센트) 적용
 * - toMeaning: 뜻을 입력하는 방향(스→한) — 정확 일치만
 */
export function gradeAnswer(
  input: string,
  expected: string,
  direction: "toWord" | "toMeaning",
  config: LanguageConfig,
): GradeResult {
  const alts = answerAlternatives(expected);
  const user = collapse(input);
  if (alts.some((a) => collapse(a) === user)) return { ok: true, accentCorrected: null };
  if (direction === "toWord" && config.gradeLenient) {
    const lenient = config.gradeLenient;
    const hit = alts.find((a) => lenient(collapse(a)) === lenient(user));
    if (hit) return { ok: true, accentCorrected: hit };
  }
  return { ok: false, accentCorrected: null };
}

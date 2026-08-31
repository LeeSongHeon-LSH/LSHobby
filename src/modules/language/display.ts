import { answerAlternatives } from "./grading";
import type { Gender } from "./types";

/** 성별을 관사 표기로 (§11.4.3 — 구 앱 문법). 성별 없는 언어(en) 행은 undefined → "" */
export const articleFor = (gender: Gender | undefined): string =>
  gender === "m" ? "el" : gender === "f" ? "la" : gender === "n" ? "el/la" : "";

/** FSRS 상태 뱃지 라벨 */
export const stateLabel = (state: number): string =>
  ["신규", "학습중", "복습", "재학습"][state] ?? "?";

/**
 * 문제에 보여 줄 뜻 — 앞의 2개까지. 동의어 백필로 뜻이 "도착하다, 도달하다, 당도하다,
 * 다다르다"처럼 길어지면 한→대상 방향 제시문이 힌트 덩어리가 된다.
 * 채점은 그대로 전체 대체 뜻을 받는다 (grading.answerAlternatives).
 */
export const promptMeaning = (meaning: string): string =>
  answerAlternatives(meaning).slice(0, 2).join(", ");

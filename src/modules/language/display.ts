import type { Gender } from "./types";

/** 성별을 관사 표기로 (§11.4.3 — 구 앱 문법). 성별 없는 언어(en) 행은 undefined → "" */
export const articleFor = (gender: Gender | undefined): string =>
  gender === "m" ? "el" : gender === "f" ? "la" : gender === "n" ? "el/la" : "";

/** FSRS 상태 뱃지 라벨 */
export const stateLabel = (state: number): string =>
  ["신규", "학습중", "복습", "재학습"][state] ?? "?";

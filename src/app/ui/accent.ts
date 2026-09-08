// 도메인색 인덱스 — 홈 버튼(#59)과 화면 안 알약 버튼이 같은 색·같은 알약 문자열을 쓴다 (#91)
export const ACCENT = {
  lib: { text: "text-lib", pill: "border-lib/40 bg-lib-soft", hex: "#4d7fa3" },
  lang: { text: "text-lang", pill: "border-lang/40 bg-lang-soft", hex: "#d9821f" },
  thought: { text: "text-thought", pill: "border-thought/40 bg-thought-soft", hex: "#6f66a8" },
} as const;

export type Accent = keyof typeof ACCENT;

/** 화면 안 알약 버튼(모서리 둥근 사각) — 책 기록·퀴즈에서 같은 모양 */
export const pill = (accent: Accent) =>
  `inline-flex min-h-11 items-center rounded-lg border px-3.5 font-dot text-dot ${ACCENT[accent].pill} ${ACCENT[accent].text}`;

import type { LanguageConfig } from "./types";

// 모음 악센트만 제거하고 ñ(결합 틸데 U+0303)은 유지
// 구 앱 db.py normalize_word / index.html deaccentGrading 이식: país → pais, año → año
const stripAccentsKeepTilde = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u0302\u0304-\u036f]/g, "")
    .normalize("NFC");

export const esConfig: LanguageConfig = {
  code: "es",
  wordTable: "es_words",
  normalize: (word) => stripAccentsKeepTilde(word.trim().toLowerCase()),
  gradeLenient: stripAccentsKeepTilde,
};

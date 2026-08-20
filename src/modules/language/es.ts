import type { LanguageConfig } from "./types";

// 모음 악센트만 제거하고 ñ(결합 틸데 U+0303)은 유지
// 구 앱 db.py normalize_word / index.html deaccentGrading 이식: país → pais, año → año
const stripAccentsKeepTilde = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u0302\u0304-\u036f]/g, "")
    .normalize("NFC");

export const esConfig: LanguageConfig = {
  // 언어 추가 시 이 객체를 복제해 규칙만 바꾼다 (§6.2)
  code: "es",
  label: "스페인어",
  wordTable: "es_words",
  reviewLogTable: "es_review_log",
  wordStatsFn: "es_word_stats",
  dailyStatsFn: "es_daily_stats",
  sentenceTable: "es_sentences",
  sentenceFetchTable: "es_sentence_fetch",
  tatoebaLang: "spa",
  transLangs: ["kor", "eng"],
  normalize: (word) => stripAccentsKeepTilde(word.trim().toLowerCase()),
  gradeLenient: stripAccentsKeepTilde,
  hasGender: true,
  speechLang: "es-ES",
  inputPlaceholder: "español...",
  accentChars: ["á", "é", "í", "ó", "ú", "ñ"],
  altKeyMap: { a: "á", e: "é", i: "í", o: "ó", u: "ú", n: "ñ" },
};

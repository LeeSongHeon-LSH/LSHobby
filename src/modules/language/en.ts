import type { LanguageConfig } from "./types";

// 영어 = 대소문자·앞뒤 공백 무시 정확 일치 (§6.2) — 관대 비교·특수문자 보조 없음
export const enConfig: LanguageConfig = {
  code: "en",
  label: "영어",
  wordTable: "en_words",
  reviewLogTable: "en_review_log",
  sentenceTable: "en_sentences",
  sentenceFetchTable: "en_sentence_fetch",
  tatoebaLang: "eng",
  transLangs: ["kor"],
  normalize: (word) => word.trim().toLowerCase(),
  gradeLenient: null,
  hasGender: false,
  speechLang: "en-US",
  inputPlaceholder: "english...",
  accentChars: [],
  altKeyMap: {},
};

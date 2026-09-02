// language 모듈 공개 인터페이스 — 타 모듈은 이 파일을 통해서만 접근 (docs/03 §3.4)
export type { Gender, LanguageConfig } from "./types";
export { esConfig } from "./es";
export { enConfig } from "./en";
export { setCurrentLang, useCurrentConfig } from "./current";
export { gradeAnswer, answerAlternatives, type GradeResult } from "./grading";
export { addWord, countWords, deleteWord, findByNorm, listWords, updateWord, type Word } from "./words";
export { loadDeck, practiceOrder } from "./session";
export { reviewStats, type WordStat } from "./review-stats";
export { answerWord } from "./answer";
export { ensureSentences, type Sentence } from "./sentences";
export { configFor, languageConfigs } from "./registry";
export {
  aggregate,
  aggregateDaily,
  buildCsv,
  computeStreak,
  fetchStats,
  localDate,
  todayReviewSummary,
  type DailyRow,
  type LangStats,
} from "./stats";
export { articleFor, clozeIndex, promptMeaning, stateLabel } from "./display";
export {
  applyAnswer,
  isDue,
  isNew,
  ratingFor,
  type SrsFields,
} from "./srs";

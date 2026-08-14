// language 모듈 공개 인터페이스 — 타 모듈은 이 파일을 통해서만 접근 (docs/03 §3.4)
export type { Gender, LanguageConfig } from "./types";
export { esConfig } from "./es";
export { gradeAnswer, answerAlternatives, type GradeResult } from "./grading";
export { addWord, countWords, deleteWord, findByNorm, listWords, updateWord, type Word } from "./words";
export { countNewStartedToday, todayPool } from "./session";
export { articleFor, stateLabel } from "./display";
export {
  applyAnswer,
  duePool,
  isDue,
  isHard,
  isNew,
  pickWeight,
  ratingFor,
  weightedPick,
  DAILY_NEW_LIMIT,
  type PoolWord,
  type SrsFields,
} from "./srs";

export type Gender = "m" | "f" | "n" | "none";

/**
 * 언어별 규칙 주입점 (docs/06 §6.2 — 언어별 분기는 config 안에만 존재).
 * 언어 추가 = 이 인터페이스 구현 1개 + 테이블 복제.
 */
export interface LanguageConfig {
  code: string;
  wordTable: string;
  /** 중복 차단용 정규화 — DB norm 컬럼 값 */
  normalize(word: string): string;
  /** 채점 관대 비교용 변형. null이면 정확 일치만 */
  gradeLenient: ((s: string) => string) | null;
}

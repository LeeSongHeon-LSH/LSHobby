export type Gender = "m" | "f" | "n" | "none";

/**
 * 언어별 규칙 주입점 (docs/06 §6.2 — 언어별 분기는 config 안에만 존재).
 * 언어 추가 = 이 인터페이스 구현 1개 + 테이블 복제.
 */
export interface LanguageConfig {
  code: string;
  /** 화면 표시명 ("스페인어") */
  label: string;
  wordTable: string;
  reviewLogTable: string;
  /** 단어별 집계 RPC (reviews·correct·최초 복습 시각) — 성능 리뷰 P1 */
  wordStatsFn: string;
  /** 일별 집계 RPC (tz 인자) */
  dailyStatsFn: string;
  sentenceTable: string;
  sentenceFetchTable: string;
  /** Tatoeba 검색 소스 언어 코드 (스페인어 'spa') */
  tatoebaLang: string;
  /** Tatoeba 번역 수집 언어 우선순위 — 원문 언어 자신은 제외 */
  transLangs: ("kor" | "eng")[];
  /** 중복 차단용 정규화 — DB norm 컬럼 값 */
  normalize(word: string): string;
  /** 채점 관대 비교용 변형. null이면 정확 일치만 */
  gradeLenient: ((s: string) => string) | null;
  /** 성별(관사) 특수 필드 보유 여부 — 해당 언어 테이블에만 컬럼 존재 (§6.2) */
  hasGender: boolean;
  /** speechSynthesis 발음 lang */
  speechLang: string;
  /** 대상 언어 입력 placeholder */
  inputPlaceholder: string;
  /** 입력 보조 문자 버튼 (빈 배열 = 미표시) */
  accentChars: string[];
  /** alt+키 → 특수문자 입력 */
  altKeyMap: Record<string, string>;
}

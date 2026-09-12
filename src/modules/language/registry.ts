import { esConfig } from "./es";
import { enConfig } from "./en";
import type { LanguageConfig } from "./types";

// 언어 추가 = config 구현 + 여기 등록 (§6.2)
export const languageConfigs: Record<string, LanguageConfig> = { es: esConfig, en: enConfig };

// Object.hasOwn 가드 — 객체 리터럴 인덱싱이라 "constructor"·"__proto__"가 프로토타입 멤버를
// 돌려준다. /api/sentence/[lang]/[wordId]의 `if (!config)` 허용목록이 그대로 뚫린다
export const configFor = (code: string): LanguageConfig | null =>
  Object.hasOwn(languageConfigs, code) ? languageConfigs[code] : null;

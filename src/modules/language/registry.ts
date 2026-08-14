import { esConfig } from "./es";
import type { LanguageConfig } from "./types";

// 언어 추가 = config 구현 + 여기 등록 (§6.2)
export const languageConfigs: Record<string, LanguageConfig> = { es: esConfig };

export const configFor = (code: string): LanguageConfig | null => languageConfigs[code] ?? null;

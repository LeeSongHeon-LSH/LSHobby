import { esConfig } from "./es";
import { enConfig } from "./en";
import type { LanguageConfig } from "./types";

// 언어 추가 = config 구현 + 여기 등록 (§6.2)
export const languageConfigs: Record<string, LanguageConfig> = { es: esConfig, en: enConfig };

export const configFor = (code: string): LanguageConfig | null => languageConfigs[code] ?? null;

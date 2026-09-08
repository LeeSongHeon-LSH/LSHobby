// i18n 모듈 공개 인터페이스 — UI 고정 문구(버튼·라벨·안내)의 다국어 사전 (docs/03 §3.4)
export type { Dict } from "./ko";
export { locales, setLocale, useLocale, useT, type Locale } from "./locale";
export { LocaleSync } from "./LocaleSync";

"use client";

import { useSyncExternalStore } from "react";
import { ko, type Dict } from "./ko";
import { en } from "./en";
import { es } from "./es";

/** UI 언어 등록부 — 언어 추가 = 사전 파일 하나 + 여기 한 줄 (docs/10 #89) */
export const locales = { ko, en, es } satisfies Record<string, Dict>;
export type Locale = keyof typeof locales;

const KEY = "lshobby.locale";
const DEFAULT: Locale = "ko";

const isLocale = (v: string | null): v is Locale => v !== null && v in locales;

// 같은 탭 안에서의 전환을 구독자에게 알린다 (storage 이벤트는 타 탭 전용) — language/current.ts와 같은 꼴
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const read = (): Locale => {
  try {
    const v = localStorage.getItem(KEY);
    return isLocale(v) ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
};

/** 홈 ⚙ 시트의 언어 선택에서 호출 */
export function setLocale(code: Locale): void {
  localStorage.setItem(KEY, code);
  listeners.forEach((l) => l());
}

/**
 * 현재 UI 언어 — localStorage 전역. 서버·하이드레이션 렌더는 ko로 그리고 마운트 직후 저장값으로 갱신된다.
 */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, read, () => DEFAULT);
}

/** 현재 UI 언어의 문구 사전 */
export function useT(): Dict {
  return locales[useLocale()];
}

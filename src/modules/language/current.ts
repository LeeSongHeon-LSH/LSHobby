"use client";

import { useSyncExternalStore } from "react";
import { esConfig } from "./es";
import { configFor } from "./registry";
import type { LanguageConfig } from "./types";

const KEY = "lshobby.lang";

// 같은 탭 안에서의 전환을 구독자에게 알린다 (storage 이벤트는 타 탭 전용)
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** 학습 랜딩 헤더 드롭다운에서 전환 시 저장 (§11.4.1, 결정 #54) */
export function setCurrentLang(code: string): void {
  localStorage.setItem(KEY, code);
  listeners.forEach((l) => l());
}

/**
 * 현재 선택 언어 config — localStorage 전역, 언어 세션 5화면 공용 (결정 #54).
 * 서버·하이드레이션 렌더는 es로 그리고 마운트 직후 저장값으로 갱신된다.
 */
export function useCurrentConfig(): LanguageConfig {
  const code = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(KEY) ?? "es",
    () => "es",
  );
  return configFor(code) ?? esConfig;
}

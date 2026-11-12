"use client";

import { useSyncExternalStore } from "react";
import { esConfig } from "./es";
import { configFor } from "./registry";
import type { LanguageConfig } from "./types";

const KEY = "lshobby.lang";

// 같은 탭 안에서의 전환은 직접 알리고(storage 이벤트는 타 탭 전용), 다른 탭의 전환은 storage 이벤트로 받는다.
// 둘 다 구독해야 한다 — 타 탭을 놓치면 이 탭은 렌더마다 localStorage를 새로 읽어 config만 바뀐 채
// 화면의 단어는 그대로라, 앞 언어 단어의 답이 새 언어 표의 같은 id에 저장된다
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
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

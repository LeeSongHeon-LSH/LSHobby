"use client";

import { useEffect } from "react";
import { useLocale } from "./locale";

/** `<html lang>`을 현재 UI 언어에 맞춘다 — 루트 레이아웃은 서버 컴포넌트라 여기서 클라이언트로 */
export function LocaleSync() {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}

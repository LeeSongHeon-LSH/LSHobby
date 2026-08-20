"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./client";

/**
 * 로그인 세션 없으면 /login으로 — 보호가 목적이 아니라 UX (실제 접근 통제는 RLS, docs/16 §16.1).
 * 낙관적 렌더: 화면·데이터 페치를 먼저 시작하고, 세션이 없을 때만 되돌린다 (비로그인은 RLS가 빈 결과)
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
    });
  }, [router]);
  return <>{children}</>;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** 로그인 상태에서의 비밀번호 변경 (결정 #50) — 분실 복구는 여전히 SEC-08 런북 */
export async function updatePassword(newPassword: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? error.message : null;
}

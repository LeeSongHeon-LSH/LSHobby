"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/modules/shared/auth";

// §17.2 — `/`에서 로그인 세션이 있으면 홈으로. 세션은 브라우저에만 있어 클라이언트 검사 (크롤러 무영향)
export function RedirectIfAuthed() {
  const router = useRouter();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/home");
    });
  }, [router]);
  return null;
}

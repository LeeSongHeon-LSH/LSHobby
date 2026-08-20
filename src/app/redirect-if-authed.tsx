"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// §17.2 — `/`에서 로그인 세션이 있으면 홈으로. 세션은 브라우저에만 있어 클라이언트 검사 (크롤러 무영향).
// supabase-js를 부팅하지 않고 저장된 세션 키 존재만 본다 — 공개 페이지 번들에서 supabase 청크 제거
// (성능 리뷰 P3). 토큰이 만료됐어도 /home의 AuthGuard가 재검증해 /login으로 되돌린다.
export function RedirectIfAuthed() {
  const router = useRouter();
  useEffect(() => {
    try {
      const authed = Object.keys(localStorage).some(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      );
      if (authed) router.replace("/home");
    } catch {
      /* localStorage 접근 불가 환경 무시 */
    }
  }, [router]);
  return null;
}

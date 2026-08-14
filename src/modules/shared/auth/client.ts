import { createClient } from "@supabase/supabase-js";

// 브라우저·서버 공용 anon 클라이언트 — service_role 키는 여기에 절대 넣지 않는다 (docs/12 SEC-03)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

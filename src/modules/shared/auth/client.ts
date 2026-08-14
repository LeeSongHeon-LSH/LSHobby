import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 브라우저·서버 공용 anon 클라이언트 — service_role 키는 여기에 절대 넣지 않는다 (docs/12 SEC-03)
// 지연 생성: env 없는 환경(vitest·빌드)에서 import만으로 터지지 않게 첫 사용 시점에 만든다
let client: SupabaseClient | null = null;

/** API route(서버)에서 호출자 JWT로 만드는 클라이언트 — RLS가 authenticated로 평가됨 */
export const serverClientWithToken = (token: string): SupabaseClient =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    client ??= createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

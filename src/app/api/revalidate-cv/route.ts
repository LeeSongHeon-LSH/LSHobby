import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { serverClientWithToken } from "@/modules/shared/auth";

// #51 개정 (성능 리뷰 P2) — 공개 CV는 정적 렌더, 저장 직후 이 핸들러가 캐시를 무효화해
// "수정 즉시 반영"을 유지한다. 호출자 JWT 검증 — 익명 무효화 소음 방지 (데이터 변경은 없음).
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await serverClientWithToken(token).auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  revalidatePath("/");
  revalidatePath("/cv");
  return NextResponse.json({ revalidated: true });
}

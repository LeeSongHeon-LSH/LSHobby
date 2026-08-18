import { supabase } from "../shared/auth";

export interface CvDocument {
  id: number;
  content: string;
  updated_at: string;
}

/** 공개 CV 본문 — anon SELECT 허용 유일 테이블 (§17.3), 서버 컴포넌트에서도 호출 */
export async function getCv(): Promise<CvDocument | null> {
  const { data, error } = await supabase
    .from("cv_document")
    .select("*")
    .order("id")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CvDocument | null;
}

/** 1행 운용 — 있으면 갱신, 없으면 생성. activity 미발행 (#52) */
export async function saveCv(content: string): Promise<void> {
  const existing = await getCv();
  if (existing) {
    const { error } = await supabase
      .from("cv_document")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("cv_document").insert({ content });
    if (error) throw error;
  }
}

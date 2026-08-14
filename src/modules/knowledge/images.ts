import { supabase } from "../shared/auth";

const MAX_DIM = 1600; // 업로드 전 클라이언트 리사이즈 (§2.3)
const SIGNED_TTL = 60 * 60 * 24 * 365 * 10; // private 버킷이므로 장기 서명 URL을 본문에 저장

async function resizeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("resize failed"))), "image/jpeg", 0.85),
  );
}

/** 이미지 업로드 (§8.1) — attachments(private, SEC-04)에 올리고 본문 삽입용 서명 URL 반환 */
export async function uploadConceptImage(file: File): Promise<string> {
  const blob = await resizeToJpeg(file);
  const path = `concepts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from("attachments")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage
    .from("attachments")
    .createSignedUrl(path, SIGNED_TTL);
  if (sErr) throw sErr;
  return data.signedUrl;
}

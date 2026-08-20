import type { Metadata } from "next";
import { CvView } from "./cv/view";
import { RedirectIfAuthed } from "./redirect-if-authed";

// §17 루트 = 공개 CV — 정적 렌더 + 저장 시 revalidatePath로 즉시 반영 (#51 개정, 성능 리뷰 P2), 색인 허용
export const metadata: Metadata = {
  title: "이송헌 — CV",
  description: "이송헌(Lee SongHeon)의 이력서",
};

export default function PublicCvPage() {
  return (
    <>
      <RedirectIfAuthed />
      <CvView />
    </>
  );
}

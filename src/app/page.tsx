import type { Metadata } from "next";
import { CvView } from "./cv/view";
import { RedirectIfAuthed } from "./redirect-if-authed";

// §17 루트 = 공개 CV — 첫 서버 컴포넌트 페이지, 매 요청 렌더(수정 즉시 반영), 색인 허용 (#51)
export const dynamic = "force-dynamic";

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

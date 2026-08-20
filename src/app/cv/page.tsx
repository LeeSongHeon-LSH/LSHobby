import type { Metadata } from "next";
import { CvView } from "./view";

// §17.2 — 로그인 여부와 무관하게 항상 CV 표시 (본인 확인용 우회로). 정적 + 저장 시 재검증 (#51 개정)
export const metadata: Metadata = {
  title: "이송헌 — CV",
  description: "이송헌(Lee SongHeon)의 이력서",
};

export default function CvPage() {
  return <CvView />;
}

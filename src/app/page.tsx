import type { Metadata } from "next";
import Link from "next/link";
import { PixelMascot } from "./ui/pixel";
import { IceScene } from "./ui/scene";
import { RedirectIfAuthed } from "./redirect-if-authed";

// §17 개정 — CV가 별도 리포(GitHub Pages)로 떠나면서 루트는 취미공간의 문이 됐다.
// 색인은 막는다: 더는 공개 문서가 아니고, 테일넷 안에서만 열리는 주소다.
export const metadata: Metadata = {
  title: "LSHobby",
  robots: { index: false, follow: false },
};

export default function EntrancePage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <IceScene />
      <RedirectIfAuthed />
      <Link href="/login" aria-label="LSHobby" className="pg-host inline-block">
        <span className="pg-waddle">
          <PixelMascot size={160} />
        </span>
      </Link>
    </main>
  );
}

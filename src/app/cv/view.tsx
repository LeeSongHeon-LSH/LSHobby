import Link from "next/link";
import type { Components } from "react-markdown";
import { getCv } from "@/modules/cv";
import { Markdown } from "@/modules/shared/markdown";
import { PixelCat } from "../ui/pixel";

// #48 CV 문서 타이포그래피 — 제목은 고운바탕, 링크·괘선은 마법사 보라 (§17.4)
const cvComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-2 font-display text-3xl font-bold leading-snug">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 border-b border-line pb-1.5 font-display text-xl font-bold">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mt-5 font-display text-base font-bold">{children}</h3>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-cv underline underline-offset-2">
      {children}
    </a>
  ),
};

// §17.4 공개 CV — 서버 렌더 공용 뷰 (`/`·`/cv`). 고양이 아이콘 = 로그인 이스터에그 (§17.6)
export async function CvView() {
  const cv = await getCv().catch(() => null);
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10 pb-20">
      <header className="mb-10 flex justify-center">
        <Link href="/login" aria-label="LSHobby">
          <PixelCat size={44} />
        </Link>
      </header>
      {cv && cv.content.trim() ? (
        <Markdown components={cvComponents}>{cv.content}</Markdown>
      ) : (
        <p className="text-center text-sm text-faint">CV 준비 중입니다.</p>
      )}
    </main>
  );
}

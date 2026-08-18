import Link from "next/link";
import { getCv } from "@/modules/cv";
import { Markdown } from "@/modules/shared/markdown";
import { PixelCat } from "./pixel-cat";

// §17.4 공개 CV — 서버 렌더 공용 뷰 (`/`·`/cv`). 고양이 아이콘 = 로그인 이스터에그 (§17.6)
export async function CvView() {
  const cv = await getCv().catch(() => null);
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6 pb-16">
      <header className="mb-8 flex justify-center">
        <Link href="/login" aria-label="LSHobby">
          <PixelCat size={40} />
        </Link>
      </header>
      {cv && cv.content.trim() ? (
        <Markdown>{cv.content}</Markdown>
      ) : (
        <p className="text-center text-sm text-neutral-400">CV 준비 중입니다.</p>
      )}
    </main>
  );
}

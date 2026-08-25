import Link from "next/link";
import type { Components } from "react-markdown";
import { getCv } from "@/modules/cv";
import { Markdown } from "@/modules/shared/markdown";
import { PixelMascot } from "../ui/pixel";
import { IceScene } from "../ui/scene";
import { splitSections } from "./split";
import { CvFilter } from "./sections";

const fmtMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// #61 CV 문서 타이포그래피 — 제목은 고운바탕, 링크·괘선 포인트는 잠옷 로즈
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

/**
 * #61 공개 CV — "이력서 = 종이 한 장": 눈밭 위 종이 시트, 위 모서리에 잠옷 펭귄.
 * 펭귄 클릭 = 로그인 (§17.6 이스터에그 — 어떤 개편에서도 유지). 서버 렌더 공용 뷰 (`/`·`/cv`).
 * 마크다운은 여기(RSC)서 렌더하고 클라이언트는 섹션 필터만 (성능 리뷰 P3)
 */
export async function CvView() {
  const cv = await getCv().catch(() => null);
  const content = cv?.content.trim() ?? "";
  const { intro, sections } = splitSections(content);
  return (
    <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-14 sm:px-6">
      <IceScene />
      <div className="absolute left-1/2 top-[26px] z-[2] -translate-x-1/2">
        <Link href="/login" aria-label="LSHobby" className="pg-host inline-block">
          <span className="pg-waddle">
            <PixelMascot size={48} />
          </span>
        </Link>
      </div>
      <div className="relative z-[1] min-h-[70dvh] rounded-lg border border-line bg-sheet px-6 pb-12 pt-10 shadow-[0_10px_30px_rgba(34,38,43,0.08)] sm:px-10">
        {content ? (
          <CvFilter
            intro={intro ? <Markdown components={cvComponents}>{intro}</Markdown> : null}
            sections={sections.map((s) => ({
              title: s.title,
              node: <Markdown components={cvComponents}>{s.body}</Markdown>,
            }))}
          />
        ) : (
          <p className="pt-16 text-center text-sm text-faint">CV 준비 중입니다.</p>
        )}
        {cv && content && (
          <p className="absolute bottom-3.5 right-5 font-mono text-[10px] text-line">
            마지막 수정 {fmtMonth(cv.updated_at)}
          </p>
        )}
      </div>
    </main>
  );
}

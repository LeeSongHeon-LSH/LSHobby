import Link from "next/link";
import { getCv } from "@/modules/cv";
import { PixelMascot } from "../ui/pixel";
import { CvSections } from "./sections";

const fmtMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * #61 공개 CV — "이력서 = 종이 한 장": 눈밭 위 종이 시트, 위 모서리에 잠옷 펭귄.
 * 펭귄 클릭 = 로그인 (§17.6 이스터에그 — 어떤 개편에서도 유지). 서버 렌더 공용 뷰 (`/`·`/cv`).
 */
export async function CvView() {
  const cv = await getCv().catch(() => null);
  const content = cv?.content.trim() ?? "";
  return (
    <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 pb-14 pt-14 sm:px-6">
      <div className="absolute left-1/2 top-[26px] z-[2] -translate-x-1/2">
        <Link href="/login" aria-label="LSHobby" className="inline-block">
          <PixelMascot size={48} />
        </Link>
      </div>
      <div className="relative min-h-[70dvh] rounded-lg border border-line bg-sheet px-6 pb-12 pt-10 shadow-[0_10px_30px_rgba(34,38,43,0.08)] sm:px-10">
        {content ? (
          <CvSections content={content} />
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

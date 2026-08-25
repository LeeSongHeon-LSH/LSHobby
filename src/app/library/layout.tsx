"use client";

import { usePathname } from "next/navigation";
import { AuthGuard } from "@/modules/shared/auth";
import { IglooScene } from "../ui/scene";

// #58·#59 — 책 세션은 탭바 없음: 독서 여정 책장이 단일 진입점, 홈 복귀는 우상단 HomeButton
// #68 후속 — 책장 화면만 벽 위 영역 안에서 스크롤해 벽이 늘 보이게 한다.
// 기록 폼은 문서 스크롤 그대로: 소프트 키보드가 올라오면 남는 높이가 전부 폼에 필요하다
export default function LibraryLayout({ children }: LayoutProps<"/library">) {
  const shelf = usePathname() === "/library";
  const inner = "mx-auto flex w-full max-w-md flex-col md:max-w-4xl";
  return (
    <AuthGuard>
      <IglooScene />
      {shelf ? (
        <div className="h-[calc(100dvh-var(--shelf-h)-var(--shelf-lip))] overflow-y-auto">
          <div className={`${inner} min-h-full`}>{children}</div>
        </div>
      ) : (
        <div className={`${inner} min-h-dvh pb-[calc(var(--shelf-h)+var(--shelf-lip))]`}>
          {children}
        </div>
      )}
    </AuthGuard>
  );
}

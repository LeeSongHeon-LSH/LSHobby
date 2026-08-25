"use client";

import { AuthGuard } from "@/modules/shared/auth";
import { IglooScene } from "../ui/scene";

// #58·#59 — 책 세션은 탭바 없음: 독서 여정 책장이 단일 진입점, 홈 복귀는 우상단 HomeButton
// #68 후속 — 콘텐츠는 책장 벽(하단 20vh) 위 영역 안에서만 스크롤: 벽은 항상 보인다
export default function LibraryLayout({ children }: LayoutProps<"/library">) {
  return (
    <AuthGuard>
      <IglooScene />
      <div className="h-[calc(100dvh-max(20vh,132px))] overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col md:max-w-4xl">{children}</div>
      </div>
    </AuthGuard>
  );
}

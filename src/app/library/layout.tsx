"use client";

import { usePathname } from "next/navigation";
import { AuthGuard } from "@/modules/shared/auth";
import { IglooScene } from "../ui/scene";

// #58·#59 — 책 세션은 탭바 없음: 독서 여정 책장이 단일 진입점, 홈 복귀는 우상단 HomeButton
// 높이 규칙은 화면이 정한다 — /library는 책장과 펼친 책 두 상태를 같은 라우트에서 그리는데,
// 책장은 벽 위 영역 안에서 스크롤하고(#68) 펼친 책은 벽 앞으로 내려온다(#75). 경로만 보고
// 한쪽 규칙을 양쪽에 씌우면 안 되므로 여기서는 폭만 잡는다.
// 기록 폼은 문서 스크롤 그대로: 소프트 키보드가 올라오면 남는 높이가 전부 폼에 필요하다
export default function LibraryLayout({ children }: LayoutProps<"/library">) {
  const shelf = usePathname() === "/library";
  const inner = "mx-auto flex w-full max-w-md flex-col md:max-w-4xl";
  return (
    <AuthGuard>
      <IglooScene />
      <div className={shelf ? inner : `${inner} min-h-dvh pb-[calc(var(--shelf-h)+var(--shelf-lip))]`}>
        {children}
      </div>
    </AuthGuard>
  );
}

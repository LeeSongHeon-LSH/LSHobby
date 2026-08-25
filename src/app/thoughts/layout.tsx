import type { Viewport } from "next";

// 생각 세션만 하늘이 밤(#68) — 루트의 밝은 themeColor를 쓰면 standalone 모드에서
// 상태바만 눈밭색으로 떠 화면 위에 띠가 생긴다. 하늘 맨 위 색과 맞춘다
export const viewport: Viewport = {
  themeColor: "#201c3e",
};

export default function ThoughtsLayout({ children }: LayoutProps<"/thoughts">) {
  return children;
}

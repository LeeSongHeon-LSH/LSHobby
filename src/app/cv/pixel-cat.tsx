// §17.6 로그인 이스터에그 아이콘 — 마법사 모자 + 동그란 안경 + 책 읽는 도트 고양이 (16×16)
const GRID = [
  ".......P........",
  "......PPP.......",
  "......PYP.......",
  ".....PPPPP......",
  "..ODDDDDDDDDDO..",
  "..OOOOOOOOOOOO..",
  "..OOOGOOOOGOOO..",
  "..OOGEGGGGEGOO..",
  "..OOOGOOOOGOOO..",
  "..OOOCCNNCCOOO..",
  "...OOOCCCCOOO...",
  "...OWWWWWWWWO...",
  "...WWWWSSWWWW.O.",
  "...RRRRRRRRRR.O.",
  "..OOoOOOOOOoOOO.",
  "...OOO....OOO...",
];

const PALETTE: Record<string, string> = {
  P: "#8b5cf6", // 모자
  D: "#6d28d9", // 모자 챙
  Y: "#facc15", // 별
  O: "#f59e0b", // 털
  o: "#d97706", // 줄무늬
  G: "#18181b", // 안경테
  E: "#e0f2fe", // 렌즈
  N: "#f472b6", // 코
  C: "#fde68a", // 주둥이·가슴
  W: "#f8fafc", // 책 페이지
  S: "#64748b", // 책 접힘선
  R: "#b91c1c", // 책 표지
};

export function PixelCat({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {GRID.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={PALETTE[ch]} />,
        ),
      )}
    </svg>
  );
}

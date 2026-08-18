// #48 픽셀 아이콘 세트 — CV 이스터에그 고양이(§17.6)와 같은 16×16 도트 문법으로
// 도메인 아이콘(책 더미·말풍선·터미널)을 통일. 색은 globals.css 도메인 토큰과 일치.

function PixelArt({
  grid,
  palette,
  size,
}: {
  grid: string[];
  palette: Record<string, string>;
  size: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {grid.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === "." ? null : (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={palette[ch]} />
          ),
        ),
      )}
    </svg>
  );
}

// 책 — 서가에 쌓인 세 권 (초록 계열)
const BOOKS_GRID = [
  "................",
  "................",
  "................",
  "...AAAAAAAAAA...",
  "...AAWWAAAAAA...",
  "...AAAAAAAAAA...",
  "..BBBBBBBBBBBB..",
  "..BBBBWWBBBBBB..",
  "..BBBBBBBBBBBB..",
  "....CCCCCCCC....",
  "....CCWWCCCC....",
  "....CCCCCCCC....",
  "..KKKKKKKKKKKK..",
  "................",
  "................",
  "................",
];
const BOOKS_PALETTE = { A: "#578a68", B: "#3e6b4e", C: "#2c4f3a", W: "#f5f4ef", K: "#211f1a" };

export const PixelBooks = ({ size = 40 }: { size?: number }) => (
  <PixelArt grid={BOOKS_GRID} palette={BOOKS_PALETTE} size={size} />
);

// 언어 — 말줄임표가 든 말풍선 (파란펜)
const SPEECH_GRID = [
  "................",
  "................",
  "................",
  "...BBBBBBBBBB...",
  "..BBBBBBBBBBBB..",
  "..BBBBBBBBBBBB..",
  "..BBWWBWWBWWBB..",
  "..BBBBBBBBBBBB..",
  "...BBBBBBBBBB...",
  "....BBB.........",
  "....BB..........",
  "....B...........",
  "................",
  "................",
  "................",
  "................",
];
const SPEECH_PALETTE = { B: "#2b5bb7", W: "#f5f4ef" };

export const PixelSpeech = ({ size = 40 }: { size?: number }) => (
  <PixelArt grid={SPEECH_GRID} palette={SPEECH_PALETTE} size={size} />
);

// CS — 프롬프트가 깜빡이는 브라운관 (앰버)
const TERMINAL_GRID = [
  "................",
  "................",
  "..KKKKKKKKKKKK..",
  "..KSSSSSSSSSSK..",
  "..KSASSSSSSSSK..",
  "..KSSASAASSSSK..",
  "..KSASSSSSSSSK..",
  "..KSSSSSSSSSSK..",
  "..KKKKKKKKKKKK..",
  ".......KK.......",
  ".....KKKKKK.....",
  "................",
  "................",
  "................",
  "................",
  "................",
];
const TERMINAL_PALETTE = { K: "#211f1a", S: "#2a2620", A: "#e8a33d" };

export const PixelTerminal = ({ size = 40 }: { size?: number }) => (
  <PixelArt grid={TERMINAL_GRID} palette={TERMINAL_PALETTE} size={size} />
);

// CV — 마법사 모자 + 동그란 안경 + 책 읽는 고양이 (§17.6 이스터에그 원본)
const CAT_GRID = [
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
const CAT_PALETTE = {
  P: "#8b5cf6",
  D: "#6d28d9",
  Y: "#facc15",
  O: "#f59e0b",
  o: "#d97706",
  G: "#18181b",
  E: "#e0f2fe",
  N: "#f472b6",
  C: "#fde68a",
  W: "#f8fafc",
  S: "#64748b",
  R: "#b91c1c",
};

export const PixelCat = ({ size = 32 }: { size?: number }) => (
  <PixelArt grid={CAT_GRID} palette={CAT_PALETTE} size={size} />
);

// #60 픽셀 아이콘 세트 — 마스코트 고양이를 잇는 16×16 도트 펭귄 가족.
// 색은 globals.css 도메인 토큰과 일치: 책=빙하 파랑 / 언어=부리 주황 / CV=잠옷 로즈.

function PixelArt({
  grid,
  palette,
  size,
  cells = 16,
  cellsY,
  flip = false,
}: {
  grid: string[];
  palette: Record<string, string>;
  size: number;
  cells?: number;
  cellsY?: number; // 세로 셀 수 — 정사각이 아닌 스프라이트(빙하·발자국)용
  flip?: boolean; // 좌우 반전
}) {
  const rows = cellsY ?? cells;
  return (
    <svg
      width={size}
      height={(size * rows) / cells}
      viewBox={`0 0 ${cells} ${rows}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <g transform={flip ? `translate(${cells} 0) scale(-1 1)` : undefined}>
        {grid.flatMap((row, y) =>
          [...row].map((ch, x) =>
            ch === "." ? null : (
              <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={palette[ch]} />
            ),
          ),
        )}
      </g>
    </svg>
  );
}

// 책 — 파란 표지 책을 펼쳐 든 펭귄 (독서 여정 책등과 같은 자세)
const PENGUIN_BOOK_GRID = [
  "................",
  "................",
  ".....KKKKKK.....",
  "....KKKKKKKK....",
  "....KKWKKWKK....",
  "....KKKCCKKK....",
  "...KKKWWWWKKK...",
  "...KKWWWWWWKK...",
  "...BDDDDDDDDB...",
  "...BDDDDDDDDB...",
  "....BBBBBBBB....",
  "....KKWWWWKK....",
  ".....KKKKKK.....",
  ".....CC..CC.....",
  "................",
  "................",
];
const PENGUIN_BOOK_PALETTE = {
  K: "#22262b",
  C: "#e2801f",
  B: "#4d7fa3",
  D: "#f1ead9",
  W: "#fafbfc",
};

export const PixelPenguinBook = ({ size = 44 }: { size?: number }) => (
  <PixelArt grid={PENGUIN_BOOK_GRID} palette={PENGUIN_BOOK_PALETTE} size={size} />
);

// 언어 — 주황 말풍선으로 말하는 펭귄
const PENGUIN_BUBBLE_GRID = [
  "..........OOOO..",
  ".........OWOWOO.",
  "..........OOOO..",
  "....KKKKKKO.....",
  "...KKKKKKKK.....",
  "...KKWKKWKK.....",
  "...KKKCCKKK.....",
  "...KKWWWWKK.....",
  "..KKWWWWWWKK....",
  "..KKWWWWWWKK....",
  "..KKWWWWWWKK....",
  "..KKWWWWWWKK....",
  "...KKWWWWKK.....",
  "....CC..CC......",
  "................",
  "................",
];
const PENGUIN_BUBBLE_PALETTE = {
  K: "#22262b",
  O: "#d9821f",
  C: "#e2801f",
  W: "#fafbfc",
};

export const PixelPenguinBubble = ({ size = 44 }: { size?: number }) => (
  <PixelArt grid={PENGUIN_BUBBLE_GRID} palette={PENGUIN_BUBBLE_PALETTE} size={size} />
);

// 생각 — 보라 생각 구름을 띄운 펭귄 (생각 세션)
const PENGUIN_THINK_GRID = [
  "..........TTTT..",
  ".........TWWWWT.",
  "..........TTTT..",
  "....KKKKKK..T...",
  "...KKKKKKKK.....",
  "...KKWKKWKK.....",
  "...KKKCCKKK.....",
  "...KKWWWWKK.....",
  "..KKWWWWWWKK....",
  "..KKWWWWWWKK....",
  "..KKWWWWWWKK....",
  "..KKWWWWWWKK....",
  "...KKWWWWKK.....",
  "....CC..CC......",
  "................",
  "................",
];
const PENGUIN_THINK_PALETTE = {
  K: "#22262b",
  T: "#6f66a8",
  C: "#e2801f",
  W: "#fafbfc",
};

export const PixelPenguinThink = ({ size = 44 }: { size?: number }) => (
  <PixelArt grid={PENGUIN_THINK_GRID} palette={PENGUIN_THINK_PALETTE} size={size} />
);

// 마스코트 — 잠옷 모자를 쓰고 펼쳐진 책 위에 앉은 펭귄 (§17.6 로그인 이스터에그, 구 고양이 승계 #60)
const MASCOT_GRID = [
  "......CCCC......",
  ".....CCCCCC.....",
  ".....FFFFFF.....",
  "....CCCCCCCCWW..",
  "....KKKKKKKK....",
  "...KKKKKKKKKK...",
  "...KKWKKKKWKK...",
  "...KKKKEEKKKK...",
  "...KKWWWWWWKK...",
  "...KKWWWWWWKK...",
  "...KKWWWWWWKK...",
  "...KKKWWWWKKK...",
  ".....EE..EE.....",
  "BGGGGGGDDGGGGGGB",
  "BGGGGGGDDGGGGGGB",
  ".BBBBBBBBBBBBBB.",
];
const MASCOT_PALETTE = {
  K: "#22262b",
  B: "#8b6f47",
  C: "#c05e7c",
  D: "#cfc4a8",
  E: "#e2801f",
  F: "#e8b7c5",
  G: "#f1ead9",
  W: "#fafbfc",
};

export const PixelMascot = ({ size = 44 }: { size?: number }) => (
  <PixelArt grid={MASCOT_GRID} palette={MASCOT_PALETTE} size={size} />
);

// 홈 버튼 — 손잡이 두 개짜리 서랍장 ("네 서랍"), 손잡이 색 = 도메인색
const DRAWER_GRID = [
  "KKKKKKKK",
  "KWWWWWWK",
  "KWWaaWWK",
  "KKKKKKKK",
  "KWWWWWWK",
  "KWWaaWWK",
  "KKKKKKKK",
  "........",
];

export const PixelDrawer = ({ size = 14, accent }: { size?: number; accent: string }) => (
  <PixelArt
    grid={DRAWER_GRID}
    palette={{ K: "#22262b", W: "#fafbfc", a: accent }}
    size={size}
    cells={8}
  />
);

// 어려운 단어 칩 — 도트 불꽃
const FLAME_GRID = [
  "...R....",
  "...RR...",
  "..RRR...",
  "..RRRR..",
  ".RRORR..",
  ".ROOORR.",
  ".ROOOR..",
  "..RRR...",
];

export const PixelFlame = ({ size = 12 }: { size?: number }) => (
  <PixelArt grid={FLAME_GRID} palette={{ R: "#c23b3b", O: "#d9821f" }} size={size} cells={8} />
);

/* ── 남극 장면 스프라이트 — 배경 소품이라 도메인 3색을 쓰지 않고 빙하 톤만 ── */

// 꼬마 펭귄 — 장면에 세워 두는 소품 (아무것도 들지 않은 기본 자세)
const PENGUIN_TINY_GRID = [
  "...KKKKKK...",
  "..KKKKKKKK..",
  "..KKWKKWKK..",
  "..KKKCCKKK..",
  "..KKWWWWKK..",
  ".KKWWWWWWKK.",
  ".KKWWWWWWKK.",
  ".KKWWWWWWKK.",
  "..KKWWWWKK..",
  "...CC..CC...",
];

export const PixelPenguinTiny = ({ size = 22, flip = false }: { size?: number; flip?: boolean }) => (
  <PixelArt
    grid={PENGUIN_TINY_GRID}
    palette={{ K: "#22262b", C: "#e2801f", W: "#fafbfc" }}
    size={size}
    cells={12}
    cellsY={10}
    flip={flip}
  />
);

// 빙하 산 — 두 봉우리, 눈 덮인 능선(W)·빙벽(I)·그늘 파셋(J). 밑단은 눈 지면에 묻힌다
const BERG_GRID = [
  "......W.................",
  ".....WWW................",
  ".....WWWW...............",
  "....WWIWWW..............",
  "....WIIWWJW.............",
  "...WWIIIWWJW.....W......",
  "...WIIIIIWJJW...WWW.....",
  "..WWIIIIIIJJW..WWIWW....",
  "..WIIIIIIIJJJW.WWIIJW...",
  ".WWIIIIIIIIJJWWIIIIJJW..",
  "WWIIIIIIIIIJJJWIIIIIJJW.",
  "WIIIIIIIIIIJJJIIIIIIJJJW",
  "IIIIIIIIIIIJJJIIIIIIJJJJ",
  "IIIIIIIIIIJJJJIIIIIJJJJJ",
];

export const PixelBerg = ({ size = 160, flip = false }: { size?: number; flip?: boolean }) => (
  <PixelArt
    grid={BERG_GRID}
    palette={{ W: "#fafbfc", I: "#cfdfe9", J: "#a9c4d6" }}
    size={size}
    cells={24}
    cellsY={14}
    flip={flip}
  />
);

// 눈 위 펭귄 발자국 — 좌우 번갈아 딛은 자국
const TRACKS_GRID = [
  "FF........FF........FF......",
  "............................",
  ".....FF........FF........FF.",
];

export const PixelTracks = ({ size = 92 }: { size?: number }) => (
  <PixelArt grid={TRACKS_GRID} palette={{ F: "#c5d2dd" }} size={size} cells={28} cellsY={3} />
);

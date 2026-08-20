// PWA 아이콘 생성 (#60 펭귄 리테마) — 마스코트 도트의 원본은 src/app/ui/pixel.tsx,
// 여기서 그리드를 읽어 렌더하므로 마스코트가 바뀌면 이 스크립트만 다시 실행하면 된다.
//   node scripts/generate-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const SNOW = "#eef1f4"; // globals.css --color-paper

// pixel.tsx에서 MASCOT_GRID·MASCOT_PALETTE 추출
const src = readFileSync("src/app/ui/pixel.tsx", "utf8");
const gridBlock = src.match(/const MASCOT_GRID = \[([\s\S]*?)\];/)[1];
const grid = [...gridBlock.matchAll(/"([.A-Za-z]{16})"/g)].map((m) => m[1]);
const palBlock = src.match(/const MASCOT_PALETTE = \{([\s\S]*?)\};/)[1];
const palette = Object.fromEntries(
  [...palBlock.matchAll(/([A-Za-z]+):\s*"(#[0-9a-fA-F]{6})"/g)].map((m) => [m[1], m[2]]),
);
if (grid.length !== 16) throw new Error(`마스코트 그리드 파싱 실패: ${grid.length}행`);

// 16×16 도트를 cell 배율로 캔버스 중앙에 — 정수 배율이라 어느 크기에서도 도트가 또렷하다
function svgIcon(size, cell) {
  const margin = (size - cell * 16) / 2;
  const rects = grid
    .flatMap((row, y) =>
      [...row].map((ch, x) =>
        ch === "."
          ? ""
          : `<rect x="${margin + x * cell}" y="${margin + y * cell}" width="${cell}" height="${cell}" fill="${palette[ch]}"/>`,
      ),
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${SNOW}"/>${rects}</svg>`;
}

const targets = [
  // [경로, 캔버스, cell] — maskable은 안전 영역(중앙 지름 80% 원) 안에 도트가 들어가는 배율
  ["public/icons/icon-192.png", 192, 10],
  ["public/icons/icon-512.png", 512, 26],
  ["public/icons/icon-maskable-512.png", 512, 19],
  ["public/icons/apple-touch-icon.png", 180, 9],
];
for (const [path, size, cell] of targets) {
  await sharp(Buffer.from(svgIcon(size, cell))).png().toFile(path);
  console.log(path, `${size}px (cell ${cell})`);
}

// favicon.ico — 32px PNG를 ICO 컨테이너로 감싼다 (모던 브라우저는 ICO 안 PNG 지원)
const png32 = await sharp(Buffer.from(svgIcon(32, 2))).png().toBuffer();
const header = Buffer.alloc(6 + 16);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // count
header.writeUInt8(32, 6); // width
header.writeUInt8(32, 7); // height
header.writeUInt8(0, 8); // palette
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // planes
header.writeUInt16LE(32, 12); // bpp
header.writeUInt32LE(png32.length, 14); // data size
header.writeUInt32LE(22, 18); // data offset
writeFileSync("src/app/favicon.ico", Buffer.concat([header, png32]));
console.log("src/app/favicon.ico 32px");

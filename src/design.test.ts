import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 화면을 띄우지 않고 지킬 수 있는 디자인 불변식 — 도트 격자, 모션 축소, 밤하늘 대비.
// 셋 다 눈으로만 확인해 오다 실제로 한 번씩 어긋났던 것들이라 값이 아니라 규칙을 고정한다.

const ROOT = process.cwd();
const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
const pixelSrc = readFileSync(join(ROOT, "src/app/ui/pixel.tsx"), "utf8");

/** `start`의 `{`부터 짝이 맞는 `}`까지 (중첩 포함) */
const blockAt = (src: string, start: number): { body: string; end: number } => {
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return { body: src.slice(open + 1, i), end: i + 1 };
  }
  throw new Error(`짝이 맞는 } 를 찾지 못했습니다 (offset ${start})`);
};

describe("도트 스프라이트 격자 (PixelArt)", () => {
  // grid에만 있고 palette에 없는 문자는 fill=undefined → 검은 사각형으로 조용히 렌더된다
  const sprites = [...pixelSrc.matchAll(/<PixelArt\b/g)].map((m) => {
    const call = pixelSrc.slice(m.index!, pixelSrc.indexOf("/>", m.index!));
    const gridName = /grid=\{(\w+)\}/.exec(call)![1];
    const cells = Number(/cells=\{(\d+)\}/.exec(call)?.[1] ?? 16);
    const cellsYRaw = /cellsY=\{(\d+)\}/.exec(call)?.[1];
    // palette는 인라인 객체이거나 이름 있는 상수 (`palette={{…}}` / `palette={NAME}`)
    const named = /palette=\{([A-Za-z_]\w*)\}/.exec(call)?.[1];
    const paletteBody = named
      ? blockAt(pixelSrc, pixelSrc.indexOf(`const ${named}`)).body
      : blockAt(call, call.indexOf("palette=")).body;
    const keys = [...paletteBody.matchAll(/(?:^|[{,])\s*(?:"([^"]+)"|([A-Za-z0-9_]+))\s*:/g)].map(
      (k) => k[1] ?? k[2],
    );
    const decl = new RegExp(`const ${gridName}\\s*=\\s*\\[([\\s\\S]*?)\\];`).exec(pixelSrc)!;
    const rows = [...decl[1].matchAll(/"([^"]*)"/g)].map((r) => r[1]);
    return { gridName, cells, cellsY: cellsYRaw ? Number(cellsYRaw) : cells, keys, rows };
  });

  it("파일 안의 스프라이트를 모두 읽어냈다", () => {
    expect(sprites.length).toBe((pixelSrc.match(/<PixelArt\b/g) ?? []).length);
    expect(sprites.length).toBeGreaterThan(15);
  });

  it.each(sprites.map((s) => [s.gridName, s] as const))("%s — 행 수가 cellsY와 같다", (_n, s) => {
    expect(s.rows.length).toBe(s.cellsY);
  });

  it.each(sprites.map((s) => [s.gridName, s] as const))("%s — 모든 행이 cells 폭이다", (_n, s) => {
    expect(s.rows.filter((r) => r.length !== s.cells)).toEqual([]);
  });

  it.each(sprites.map((s) => [s.gridName, s] as const))("%s — 쓰인 색이 palette에 다 있다", (_n, s) => {
    const used = new Set(s.rows.flatMap((r) => [...r]).filter((ch) => ch !== "."));
    expect([...used].filter((ch) => !s.keys.includes(ch))).toEqual([]);
  });
});

describe("모션 축소 (prefers-reduced-motion)", () => {
  // @keyframes와 축소 블록을 걷어낸 나머지에서 animation을 선언한 규칙을 모은다
  const stripped = (() => {
    let out = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const at of ["@keyframes", "@media"]) {
      let i: number;
      while ((i = out.indexOf(at)) >= 0) out = out.slice(0, i) + out.slice(blockAt(out, i).end);
    }
    return out;
  })();

  const animated = [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /animation(-name)?\s*:/.test(m[2]))
    .flatMap((m) => m[1].split(",").map((sel) => sel.trim().replace(/\s+/g, " ")))
    .filter(Boolean);

  const reduced = (() => {
    const i = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(i).toBeGreaterThan(-1);
    return blockAt(css, i).body;
  })();

  it("애니메이션을 선언한 규칙을 찾았다", () => {
    expect(animated.length).toBeGreaterThan(5);
  });

  it.each(animated.map((s) => [s]))("%s 가 모션 축소 블록에 있다", (sel) => {
    expect(reduced).toContain(sel);
  });
});

describe("밤하늘 위 글자 대비 (생각 세션)", () => {
  const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) =>
    parseInt(h.slice(i, i + 2), 16) / 255,
  ) as [number, number, number];
  const lum = (h: string) => {
    const [r, g, b] = hex(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const token = (name: string) =>
    new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css)![1];
  const skyStops = (() => {
    const rule = /\.sky-night\s*\{([^}]*)\}/.exec(css)![1];
    return [...rule.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);
  })();

  it("하늘 그라데이션 색을 모두 읽었다", () => {
    expect(skyStops.length).toBeGreaterThanOrEqual(3);
  });

  // 하늘이 지평선으로 밝아지므로 가장 밝은 정지점에서도 AA(4.5:1)를 넘어야 한다
  for (const name of ["night-ink", "night-faint"]) {
    it(`${name} 가 모든 하늘 정지점에서 AA를 넘는다`, () => {
      const fg = token(name);
      const failing = skyStops.filter((bg) => ratio(fg, bg) < 4.5);
      expect(failing).toEqual([]);
    });
  }
});

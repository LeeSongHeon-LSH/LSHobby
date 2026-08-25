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

  // 파서가 스프라이트를 건너뛰면 그 스프라이트의 검사가 통째로 사라진다 —
  // 내보낸 컴포넌트 수와 대조해 조용히 빠지는 일을 막는다
  it("내보낸 스프라이트를 하나도 빠뜨리지 않고 읽어냈다", () => {
    const exported = [...pixelSrc.matchAll(/export const (Pixel\w+)/g)].map((m) => m[1]);
    expect(sprites.length).toBe(exported.length);
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
  // 주석은 먼저 걷어낸다 — 주석에 들어간 셀렉터가 검사를 통과시켜서는 안 된다
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectorsOf = (src: string, bodyMatches: (body: string) => boolean) =>
    [...src.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => bodyMatches(m[2]))
      .flatMap((m) => m[1].split(",").map((sel) => sel.trim().replace(/\s+/g, " ")))
      .filter(Boolean);

  // @keyframes·축소 블록을 걷어낸 나머지에서 애니메이션을 선언한 규칙
  const animated = selectorsOf(
    (() => {
      let out = bare;
      for (const at of ["@keyframes", "@media"]) {
        let i: number;
        while ((i = out.indexOf(at)) >= 0) out = out.slice(0, i) + out.slice(blockAt(out, i).end);
      }
      return out;
    })(),
    (body) => /animation(-name)?\s*:/.test(body),
  );

  // 축소 블록에서 "실제로 모션을 끄는" 규칙만 인정한다 — 이름만 남고 선언이 바뀌면 통과시키지 않는다
  const disabled = new Set(
    selectorsOf(blockAt(bare, bare.indexOf("@media (prefers-reduced-motion: reduce)")).body, (body) =>
      /(animation(-name)?|display)\s*:\s*none/.test(body),
    ),
  );

  it("애니메이션을 선언한 규칙과 끄는 규칙을 모두 찾았다", () => {
    expect(animated.length).toBeGreaterThan(5);
    expect(disabled.size).toBeGreaterThan(5);
  });

  it.each(animated.map((s) => [s]))("%s 가 모션 축소 시 꺼진다", (sel) => {
    expect([...disabled]).toContain(sel);
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
  const skyRule = /\.sky-night\s*\{([^}]*)\}/.exec(css)![1];
  const skyStops = [...skyRule.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0]);

  // 하늘이 지평선으로 밝아지므로 가장 밝은 정지점에서도 AA(4.5:1)를 넘어야 한다.
  // 정지점을 세는 가드를 같은 it 안에 둔다 — 따로 두면 파서가 아무것도 못 읽어도 대비 검사가 초록으로 뜬다
  for (const name of ["night-ink", "night-faint"]) {
    it(`${name} 가 모든 하늘 정지점에서 AA를 넘는다`, () => {
      // 6자리 hex만 읽으므로 다른 표기가 섞이면 조용히 지나친다 → 여기서 먼저 크게 실패시킨다
      const unreadable = skyRule
        .replace(/#[0-9a-f]{6}\b/gi, "")
        .match(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(|#[0-9a-f]{3,4}\b|\b(white|black|currentcolor)\b/i);
      expect(unreadable).toBeNull();
      expect(skyStops.length).toBeGreaterThanOrEqual(3);

      const fg = token(name);
      expect(skyStops.filter((bg) => ratio(fg, bg) < 4.5)).toEqual([]);
    });
  }
});

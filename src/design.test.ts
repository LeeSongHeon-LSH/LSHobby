import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 화면을 띄우지 않고 지킬 수 있는 디자인 불변식 — 도트 격자(스프라이트·글꼴), 모션 축소, 밤하늘 대비.
// 전부 눈으로만 확인해 오다 실제로 한 번씩 어긋났던 것들이라 값이 아니라 규칙을 고정한다.

const ROOT = process.cwd();
const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
const pixelSrc = readFileSync(join(ROOT, "src/app/ui/pixel.tsx"), "utf8");

const walk = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : d.name.endsWith(".tsx") ? [join(dir, d.name)] : [],
  );

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

describe("도트 글꼴 격자 (Galmuri11, #91)", () => {
  // 도트 글꼴은 11px·22px에서만 픽셀이 맞고 자간도 정수 px여야 한다. 크기·자간을 손으로 친 값이
  // 65곳에 흩어져 있던 것을 dot 토큰으로 묶었으니, 토큰 밖의 값이 끼어들면 여기서 잡는다.
  // src/app만 보면 src/modules의 화면 조각(ReflectionBlock 등)이 검사 밖에 남는다
  const lines = [...walk("src/app"), ...walk("src/modules")]
    .filter((f) => !f.endsWith(".test.tsx"))
    .flatMap((f) =>
    readFileSync(join(ROOT, f), "utf8")
      .split("\n")
      .map((line, i) => ({ at: `${f}:${i + 1}`, line })),
    );
  const dotLines = lines.filter(({ line }) => /\bfont-dot\b/.test(line));

  it("도트 글꼴 자리를 하나도 빠뜨리지 않고 읽어냈다", () => {
    expect(dotLines.length).toBeGreaterThan(50);
  });

  it.each(dotLines.map(({ at, line }) => [at, line]))("%s 가 dot 크기·자간 토큰만 쓴다", (_at, line) => {
    expect(line).toMatch(/\btext-dot(-lg)?\b/);
    expect(line).not.toMatch(/\btext-(\[|xs|sm|base|lg|xl|\dxl)\b/);
    for (const m of line.matchAll(/\btracking-[\w[\]./-]+/g)) expect(m[0]).toMatch(/^tracking-dot(-wide)?$/);
  });

  it("font-mono 는 화면에 쓰지 않는다 — code·pre 몫으로 남겨 둔다", () => {
    expect(lines.filter(({ line }) => /\bfont-mono\b/.test(line)).map(({ at }) => at)).toEqual([]);
    expect(css).not.toMatch(/--font-mono\s*:/);
  });

  it("globals.css 의 도트 글꼴 규칙도 dot 토큰으로 크기를 잡는다", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /var\(--font-dot\)/.test(m[2]));
    expect(rules.length).toBeGreaterThan(0);
    for (const m of rules) expect(m[2]).toMatch(/font-size:\s*var\(--text-dot(-lg)?\)/);
  });

  it("dot 토큰이 격자 값 그대로다", () => {
    expect(css).toMatch(/--text-dot:\s*11px/);
    expect(css).toMatch(/--text-dot-lg:\s*22px/);
    for (const m of css.matchAll(/--tracking-dot(?:-\w+)?:\s*([\d.]+)(\w+)/g)) {
      expect(m[2]).toBe("px");
      expect(Number(m[1]) % 1).toBe(0);
    }
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

  const REDUCE = "@media (prefers-reduced-motion: reduce)";

  // @keyframes와 **축소 블록만** 걷어낸다. @media를 통째로 걷어내면 미디어 쿼리 안에 든
  // 애니메이션이 아래 불변식에서 통째로 면제된다 — 남겨 두면 바깥 @media 줄은 규칙 정규식에
  // 안 걸리고 그 안의 규칙만 잡힌다
  const animated = selectorsOf(
    (() => {
      let out = bare;
      for (const at of ["@keyframes", REDUCE]) {
        let i: number;
        while ((i = out.indexOf(at)) >= 0) out = out.slice(0, i) + out.slice(blockAt(out, i).end);
      }
      return out;
    })(),
    (body) => /animation(-name)?\s*:/.test(body),
  );

  // 축소 블록에서 "실제로 모션을 끄는" 규칙만 인정한다 — 이름만 남고 선언이 바뀌면 통과시키지 않는다
  // 축소 블록이 여럿일 수 있다 — 첫 블록만 읽으면 나머지에 쓴 규칙이 없는 것으로 보인다
  const reduceBodies = (() => {
    const out: string[] = [];
    for (let i = bare.indexOf(REDUCE); i >= 0; i = bare.indexOf(REDUCE, i + 1)) {
      out.push(blockAt(bare, i).body);
    }
    return out;
  })();
  const disabled = new Set(
    reduceBodies.flatMap((body) =>
      selectorsOf(body, (b) => /(animation(-name)?|display)\s*:\s*none/.test(b)),
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

"use client";

import { useMemo, useState } from "react";
import type { Components } from "react-markdown";
import { Markdown } from "@/modules/shared/markdown";

// #61 CV 문서 타이포그래피 — 제목은 고운바탕, 링크·괘선 포인트는 잠옷 로즈
const cvComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-2 font-display text-3xl font-bold leading-snug">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 border-b border-line pb-1.5 font-display text-xl font-bold">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mt-5 font-display text-base font-bold">{children}</h3>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-cv underline underline-offset-2">
      {children}
    </a>
  ),
};

/** 마크다운을 `## ` 제목 기준으로 자른다 — 문서는 1덩어리 그대로(§17.1), 필터는 렌더에서만 */
function splitSections(md: string): { intro: string; sections: { title: string; body: string }[] } {
  const chunks = md.split(/\n(?=## )/);
  const intro = chunks[0]?.startsWith("## ") ? "" : (chunks.shift() ?? "");
  const sections = chunks
    .filter((c) => c.startsWith("## "))
    .map((c) => ({ title: c.slice(3, c.indexOf("\n") < 0 ? undefined : c.indexOf("\n")).trim(), body: c }));
  return { intro, sections };
}

/**
 * #61 섹션 필터 칩 — 무선택 = 전체 보기, 같은 칩 재탭 = 전체로 복귀.
 * 서버는 전체를 렌더하므로(§17.4) 색인에는 영향 없음.
 */
export function CvSections({ content }: { content: string }) {
  const { intro, sections } = useMemo(() => splitSections(content), [content]);
  const [active, setActive] = useState<string | null>(null);

  return (
    <>
      {intro && <Markdown components={cvComponents}>{intro}</Markdown>}
      {sections.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {sections.map((s) => (
            <button
              key={s.title}
              onClick={() => setActive(active === s.title ? null : s.title)}
              className={`rounded-full border px-3.5 py-1.5 font-mono text-[11px] ${
                active === s.title ? "border-cv bg-cv text-sheet" : "border-line bg-card text-faint"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}
      {sections
        .filter((s) => !active || s.title === active)
        .map((s) => (
          <Markdown key={s.title} components={cvComponents}>
            {s.body}
          </Markdown>
        ))}
    </>
  );
}

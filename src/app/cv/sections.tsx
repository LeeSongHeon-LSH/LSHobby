"use client";

import { useState, type ReactNode } from "react";

/**
 * #61 섹션 필터 칩 — 무선택 = 전체 보기, 같은 칩 재탭 = 전체로 복귀.
 * 마크다운은 서버(view.tsx)에서 이미 렌더된 노드로 받는다 — react-markdown이
 * 공개 페이지 클라이언트 번들에 실리지 않게 (성능 리뷰 P3)
 */
export function CvFilter({
  intro,
  sections,
}: {
  intro: ReactNode;
  sections: { title: string; node: ReactNode }[];
}) {
  const [active, setActive] = useState<string | null>(null);

  return (
    <>
      {intro}
      {sections.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {sections.map((s) => (
            <button
              key={s.title}
              onClick={() => setActive(active === s.title ? null : s.title)}
              className={`rounded-full border px-3.5 py-1.5 font-mono text-[11px] ${
                active === s.title ? "border-cv bg-cv text-sheet" : "border-cv/30 bg-cv-soft/40 text-faint"
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
          <div key={s.title}>{s.node}</div>
        ))}
    </>
  );
}

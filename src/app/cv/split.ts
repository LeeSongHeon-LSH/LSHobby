/** 마크다운을 `## ` 제목 기준으로 자른다 — 문서는 1덩어리 그대로(§17.1), 필터는 렌더에서만 */
export function splitSections(md: string): {
  intro: string;
  sections: { title: string; body: string }[];
} {
  const chunks = md.split(/\n(?=## )/);
  const intro = chunks[0]?.startsWith("## ") ? "" : (chunks.shift() ?? "");
  const sections = chunks
    .filter((c) => c.startsWith("## "))
    .map((c) => ({
      title: c.slice(3, c.indexOf("\n") < 0 ? undefined : c.indexOf("\n")).trim(),
      body: c,
    }));
  return { intro, sections };
}

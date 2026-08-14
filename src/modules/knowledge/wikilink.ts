// 위키링크 처리 (§8.2) — 제목 문자열 매칭, resolve된 링크만 concept_link에 기록
const LINK_RE = /\[\[([^\][\n]+)\]\]/g;

/** 본문에서 [[제목]] 추출 — trim·중복 제거 */
export function extractWikiLinks(md: string): string[] {
  const out: string[] = [];
  for (const m of md.matchAll(LINK_RE)) {
    const t = m[1].trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** 제목 변경 시 참조 본문 일괄 치환 — [[옛제목]] → [[새제목]] (§8.2 Obsidian 방식) */
export function replaceWikiTitle(md: string, oldTitle: string, newTitle: string): string {
  return md.split(`[[${oldTitle}]]`).join(`[[${newTitle}]]`);
}

/**
 * 렌더 전처리: [[제목]] → 마크다운 링크.
 * 존재하는 개념 → 상세, 없으면 red link → 그 제목으로 생성 진입 (dangling 허용, §8.2)
 */
export function renderWikiLinks(md: string, titleToId: Map<string, number>): string {
  return md.replace(LINK_RE, (_, raw: string) => {
    const title = raw.trim();
    const id = titleToId.get(title);
    return id !== undefined
      ? `[${title}](/knowledge/concept/${id})`
      : `[${title}](/knowledge/edit?title=${encodeURIComponent(title)}&red=1)`;
  });
}

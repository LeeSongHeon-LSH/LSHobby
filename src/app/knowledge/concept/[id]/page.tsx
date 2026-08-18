"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import type { Components } from "react-markdown";
import {
  backlinks,
  getConcept,
  renderWikiLinks,
  titleIndex,
  type Concept,
} from "@/modules/knowledge";
import { tagsByType } from "@/modules/shared/tag";
import { ReflectionBlock } from "@/modules/shared/reflection";
import { Markdown } from "@/modules/shared/markdown";

// 위키링크 렌더: 존재 → 파랑 내부 링크, dangling → red link (탭 시 그 제목으로 생성, §11.6.2)
const wikiComponents: Components = {
  a({ href, children }) {
    const h = href ?? "";
    if (h.includes("red=1"))
      return (
        <Link href={h} className="text-err underline decoration-dotted">
          {children}
        </Link>
      );
    if (h.startsWith("/"))
      return (
        <Link href={h} className="text-cs underline underline-offset-2">
          {children}
        </Link>
      );
    return (
      <a href={h} target="_blank" rel="noreferrer" className="underline">
        {children}
      </a>
    );
  },
};

// §11.6.2 개념 상세 — 본문(위키링크 활성) → 백링크 → reflection
export default function ConceptDetailPage({ params }: PageProps<"/knowledge/concept/[id]">) {
  const { id: idStr } = use(params);
  const id = Number(idStr);

  const [concept, setConcept] = useState<Concept | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [links, setLinks] = useState<{ id: number; title: string }[]>([]);
  const [rendered, setRendered] = useState("");
  const [missing, setMissing] = useState(false);

  const reload = useCallback(async () => {
    const c = await getConcept(id).catch(() => null);
    if (!c) {
      setMissing(true);
      return;
    }
    const [index, back, tagMap] = await Promise.all([
      titleIndex(),
      backlinks(id),
      tagsByType("concept").catch(() => new Map<number, string[]>()),
    ]);
    setConcept(c);
    setRendered(renderWikiLinks(c.body, index));
    setLinks(back);
    setTags(tagMap.get(id) ?? []);
  }, [id]);

  useEffect(() => {
    void (async () => {
      await reload();
    })();
  }, [reload]);

  if (missing)
    return (
      <main className="p-4 text-center">
        <p className="mt-16 text-faint">개념을 찾을 수 없습니다</p>
        <Link href="/knowledge" className="mt-4 inline-block text-sm underline">목록으로</Link>
      </main>
    );
  if (!concept) return <main className="p-4" />;

  return (
    <main className="space-y-6 p-4">
      <header>
        <div className="flex items-start justify-between">
          <Link href="/knowledge" className="py-1 pr-3 text-faint">←</Link>
          <Link href={`/knowledge/edit?id=${id}`} aria-label="편집" className="py-1 pl-3 text-faint">✎</Link>
        </div>
        <h1 className="font-display text-2xl font-bold leading-snug">{concept.title}</h1>
        {tags.length > 0 && (
          <p className="mt-1 font-mono text-xs text-cs">{tags.map((t) => `#${t}`).join(" ")}</p>
        )}
      </header>

      <section className="rounded-md border border-line bg-card p-4">
        {concept.body.trim() ? (
          <Markdown components={wikiComponents}>{rendered}</Markdown>
        ) : (
          <p className="text-sm text-faint">본문이 비어 있습니다</p>
        )}
      </section>

      {links.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-faint">이 개념을 참조하는 문서</h2>
          <ul className="rounded-md border border-line bg-card px-4 py-1 text-sm">
            {links.map((l) => (
              <li key={l.id}>
                <Link href={`/knowledge/concept/${l.id}`} className="block py-2 text-cs">
                  · {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ReflectionBlock subjectType="concept" subjectId={id} />
    </main>
  );
}

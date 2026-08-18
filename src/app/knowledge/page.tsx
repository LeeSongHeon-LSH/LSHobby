"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listConcepts, type ConceptListItem } from "@/modules/knowledge";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const excerpt = (body: string) => body.split("\n").find((l) => l.trim()) ?? "";

// §11.6.1 개념 목록 — 최근 수정순, 제목·본문 검색, 태그 필터, 첫 줄 발췌
export default function KnowledgePage() {
  const [concepts, setConcepts] = useState<ConceptListItem[]>([]);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  useEffect(() => {
    listConcepts().then(setConcepts).catch(() => setConcepts([]));
  }, []);

  const allTags = useMemo(() => [...new Set(concepts.flatMap((c) => c.tags))].sort(), [concepts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return concepts.filter(
      (c) =>
        (!q || c.title.toLowerCase().includes(q) || c.body.toLowerCase().includes(q)) &&
        (!tag || c.tags.includes(tag)),
    );
  }, [concepts, query, tag]);

  return (
    <main className="p-4">
      <div className="mb-4 flex items-end justify-between">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cs">Knowledge</p>
          <h1 className="font-display text-2xl font-bold">개념</h1>
        </header>
        <Link href="/knowledge/edit" className="px-2 text-lg text-cs">＋</Link>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 제목·본문 검색"
        className="mb-2 w-full rounded-md border border-line bg-card px-4 py-2.5"
      />
      {allTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setTag(null)}
            className={`rounded-full border px-3 py-1 text-xs ${!tag ? "border-cs bg-cs text-white" : "border-line text-faint"}`}
          >
            전체
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={`rounded-full border px-3 py-1 text-xs ${tag === t ? "border-cs bg-cs text-white" : "border-line text-faint"}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <ul className="divide-y divide-line rounded-md border border-line bg-card">
        {filtered.map((c) => (
          <li key={c.id}>
            <Link href={`/knowledge/concept/${c.id}`} className="block px-4 py-3">
              <p className="font-medium">{c.title}</p>
              <p className="mt-0.5 font-mono text-[11px] text-faint">
                {c.tags.map((t) => `#${t}`).join(" ")}
                {c.tags.length > 0 ? " · " : ""}
                {fmtDate(c.updated_at)} 수정
              </p>
              {excerpt(c.body) && (
                <p className="mt-1 truncate text-sm text-faint">{excerpt(c.body)}</p>
              )}
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-faint">
            {concepts.length === 0 ? "첫 개념을 정리해 보세요" : "검색 결과가 없습니다"}
          </li>
        )}
      </ul>
    </main>
  );
}

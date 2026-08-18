"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listBooks, type BookListItem } from "@/modules/library";

const stars = (n: number | null) => (n ? "★".repeat(n) : "");

// §11.5.1 서재 — 표지 없는 타이포그래피 카드, 최근 완독순, 태그 필터 + 검색
export default function LibraryPage() {
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  useEffect(() => {
    listBooks().then(setBooks).catch(() => setBooks([]));
  }, []);

  const allTags = useMemo(() => [...new Set(books.flatMap((b) => b.tags))].sort(), [books]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter(
      (b) =>
        (!q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)) &&
        (!tag || b.tags.includes(tag)),
    );
  }, [books, query, tag]);

  return (
    <main className="p-4">
      <header className="mb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lib">Library</p>
        <h1 className="font-display text-2xl font-bold">서재</h1>
      </header>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 제목·저자 검색"
        className="mb-2 w-full rounded-md border border-line bg-card px-4 py-2.5"
      />
      {allTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setTag(null)}
            className={`rounded-full border px-3 py-1 text-xs ${!tag ? "border-lib bg-lib text-white" : "border-line text-faint"}`}
          >
            전체
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={`rounded-full border px-3 py-1 text-xs ${tag === t ? "border-lib bg-lib text-white" : "border-line text-faint"}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((b) => (
          <Link
            key={b.id}
            href={`/library/book/${b.id}`}
            className="block border-l-2 border-l-lib rounded-md border border-line bg-card p-5"
          >
            <p className="font-display text-lg font-bold leading-snug">{b.title}</p>
            <p className="mt-0.5 text-sm text-faint">{b.author}</p>
            <p className="mt-2 font-mono text-[11px] text-faint">
              {b.readCount}회독
              {b.lastRating ? ` · ${stars(b.lastRating)}` : ""}
              {b.tags.length > 0 ? ` · ${b.tags.map((t) => `#${t}`).join(" ")}` : ""}
            </p>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-faint">
            {books.length === 0 ? "완독한 책을 기록해 보세요" : "검색 결과가 없습니다"}
          </p>
        )}
      </div>

      <Link
        href="/library/record"
        className="mt-5 block w-full rounded-md bg-lib py-3 text-center font-medium text-white"
      >
        ＋ 완독 기록
      </Link>
    </main>
  );
}

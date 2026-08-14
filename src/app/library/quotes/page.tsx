"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listAllQuotes, type Quote } from "@/modules/library";

// §11.5.4 인용구 (책 횡단) — 최신 등록순, 검색, 탭 → 책 상세. 추가는 책 상세에서만
export default function QuotesPage() {
  const [quotes, setQuotes] = useState<(Quote & { bookTitle: string })[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listAllQuotes().then(setQuotes).catch(() => setQuotes([]));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(
      (x) =>
        x.content.toLowerCase().includes(q) ||
        x.bookTitle.toLowerCase().includes(q) ||
        (x.comment ?? "").toLowerCase().includes(q),
    );
  }, [quotes, query]);

  return (
    <main className="p-4">
      <h1 className="mb-3 text-lg font-semibold">인용구</h1>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 인용구 검색"
        className="mb-3 w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5"
      />
      <ul className="space-y-2">
        {filtered.map((q) => (
          <li key={q.id}>
            <Link
              href={`/library/book/${q.book_id}`}
              className="block rounded-xl border border-neutral-200 bg-white p-4 text-sm"
            >
              <p className="leading-relaxed">“{q.content}”</p>
              <p className="mt-1.5 text-xs text-neutral-400">
                {q.bookTitle}
                {q.page ? ` p.${q.page}` : ""}
              </p>
              {q.comment && <p className="mt-0.5 text-xs text-neutral-500">└ {q.comment}</p>}
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="py-10 text-center text-sm text-neutral-400">
            {quotes.length === 0 ? "아직 인용구가 없습니다" : "검색 결과가 없습니다"}
          </li>
        )}
      </ul>
    </main>
  );
}

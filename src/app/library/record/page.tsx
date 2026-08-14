"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createBook,
  listBooks,
  recordCompletion,
  type Book,
  type BookListItem,
} from "@/modules/library";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const EMPTY = { title: "", author: "", translator: "", publisher: "", pub_year: "" };

// §11.5.2 완독 기록 플로우 — 1단계 책 선택/신규 등록 → 2단계 완독일·별점
export default function RecordPage() {
  const router = useRouter();
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [picked, setPicked] = useState<Book | null>(null);
  const [finishedOn, setFinishedOn] = useState(todayStr());
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listBooks().then(setBooks).catch(() => setBooks([]));
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q ? books.filter((b) => b.title.toLowerCase().includes(q)) : books;

  const createAndPick = async () => {
    setBusy(true);
    try {
      const book = await createBook({
        title: form.title.trim(),
        author: form.author.trim(),
        translator: form.translator.trim() || null,
        publisher: form.publisher.trim(),
        pub_year: form.pub_year.trim(),
      });
      setPicked(book);
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await recordCompletion(picked, finishedOn, rating);
      router.replace(`/library/book/${picked.id}`);
    } finally {
      setBusy(false);
    }
  };

  // 2단계: 회독 기록
  if (picked)
    return (
      <main className="p-4">
        <h1 className="mb-6 text-lg font-semibold">{picked.title}</h1>
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-sm text-neutral-500">완독일</label>
            <input
              type="date"
              value={finishedOn}
              onChange={(e) => setFinishedOn(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-4 py-2.5"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-500">별점 (선택)</label>
            <div className="flex gap-1 text-2xl">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(rating === n ? null : n)}
                  className={rating && n <= rating ? "text-amber-500" : "text-neutral-300"}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={complete}
            disabled={busy || !finishedOn}
            className="w-full rounded-lg bg-neutral-900 py-3 font-medium text-white disabled:opacity-40"
          >
            기록 완료
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-neutral-400">
          인용구·노트·생각은 기록 후 책 상세에서 자유롭게
        </p>
      </main>
    );

  // 1단계: 책 선택 / 신규 등록
  return (
    <main className="p-4">
      <h1 className="mb-3 text-lg font-semibold">완독 기록</h1>
      {!creating ? (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 제목 검색"
            className="mb-3 w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5"
          />
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {matches.map((b) => (
              <li key={b.id}>
                <button onClick={() => setPicked(b)} className="w-full px-4 py-3 text-left">
                  <span className="font-medium">{b.title}</span>
                  <span className="ml-2 text-sm text-neutral-400">
                    {b.author} · {b.readCount}회독 → +1
                  </span>
                </button>
              </li>
            ))}
            <li>
              <button
                onClick={() => {
                  setCreating(true);
                  setForm({ ...EMPTY, title: query.trim() });
                }}
                className="w-full px-4 py-3 text-left text-neutral-600"
              >
                ＋ 새 책 등록{q ? `: "${query.trim()}"` : ""}
              </button>
            </li>
          </ul>
        </>
      ) : (
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
          {(
            [
              ["title", "제목", true],
              ["author", "저자", true],
              ["translator", "옮긴이 (선택)", false],
              ["publisher", "출판사", true],
              ["pub_year", "원저 발표연도 (예: 1943, BC 380)", true],
            ] as const
          ).map(([key, label]) => (
            <input
              key={key}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              placeholder={label}
              className="w-full rounded-lg border border-neutral-300 px-4 py-2.5"
            />
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => setCreating(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
            >
              뒤로
            </button>
            <button
              onClick={createAndPick}
              disabled={
                busy ||
                !form.title.trim() ||
                !form.author.trim() ||
                !form.publisher.trim() ||
                !form.pub_year.trim()
              }
              className="flex-1 rounded-lg bg-neutral-900 py-2.5 font-medium text-white disabled:opacity-40"
            >
              등록하고 계속
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

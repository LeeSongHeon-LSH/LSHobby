"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  VOL_CAP,
  createBook,
  journeyNumbers,
  listBooks,
  noInVol,
  previewJourneyNo,
  recordCompletion,
  volOf,
  type Book,
  type BookListItem,
} from "@/modules/library";
import { setTags } from "@/modules/shared/tag";
import { SearchIcon } from "../../ui/icons";
import { PixelPenguinBook } from "../../ui/pixel";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const EMPTY = { title: "", author: "", translator: "", publisher: "", pub_year: "", tags: "" };

function Ornament() {
  return (
    <div className="my-4 flex items-center justify-center gap-2.5" aria-hidden="true">
      <span className="w-9 border-t border-line" />
      <span className="h-[5px] w-[5px] rotate-45 bg-lib/70" />
      <span className="w-9 border-t border-line" />
    </div>
  );
}

// 한글 IME: 조합 중 포커스 이동 시 마지막 글자 유실 방지 — blur에 확정값 동기화
// §11.5.2 완독 기록 — 기록 = 여정에 속표지 한 쪽을 쓰는 것.
// 1단계 책 선택(목차 문법) → 2단계 속표지 미리보기 + 완독일·별점 (#58)
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

  // 여정 번호 규칙은 modules/library/journey.ts가 원본 (서재 책장과 동일)
  const journeyNoById = useMemo(() => journeyNumbers(books), [books]);
  const nextJourneyNo = journeyNoById.size + 1;

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
      if (form.tags.trim()) await setTags("book", book.id, form.tags.split(","));
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
      router.replace(`/library?open=${picked.id}`); // #58 — 여정 자세히보기로
    } finally {
      setBusy(false);
    }
  };

  // 2단계: 속표지 미리보기 + 회독 기록
  if (picked) {
    const readCount = books.find((b) => b.id === picked.id)?.readCount ?? 0;
    // 완독일을 바꾸면 번호도 그 날짜 기준으로 재계산된다 (소급 입력 대응)
    const no = previewJourneyNo(books, picked.id, finishedOn);
    const vol = volOf(no);
    const inVol = noInVol(no);

    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col p-4">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lib">Library</p>
            <h1 className="font-display text-2xl font-bold">완독 기록</h1>
          </div>
          <button
            onClick={() => setPicked(null)}
            className="inline-flex min-h-11 items-center px-2 text-sm text-faint"
          >
            ← 책 선택
          </button>
        </header>

        <div className="relative flex-1 rounded-lg border border-line bg-sheet px-6 pb-8 pt-9 shadow-[0_10px_30px_rgba(34,38,43,0.08)]">
          <div className="flex flex-col items-center text-center">
            <PixelPenguinBook size={36} />
            <p className="mt-3 font-mono text-[11px] tracking-[0.18em] text-lib">
              제{vol}보 · 여정 {inVol} / {VOL_CAP} · {readCount > 0 ? `${readCount + 1}회독째` : "첫 완독"}
            </p>
            <h2 className="mt-3 max-w-[262px] font-display text-[26px] font-bold leading-snug">
              {picked.title}
            </h2>
            <p className="mt-1.5 text-[13px] text-faint">{picked.author}</p>
            <Ornament />
          </div>

          <div className="mx-auto mt-2 max-w-[300px] space-y-5">
            <div>
              <label className="mb-1.5 block text-center font-mono text-[11px] tracking-[0.08em] text-faint">
                완독일
              </label>
              <input
                type="date"
                value={finishedOn}
                onChange={(e) => setFinishedOn(e.target.value)}
                className="w-full rounded-md border border-line bg-card px-4 py-2.5 text-center"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-center font-mono text-[11px] tracking-[0.08em] text-faint">
                별점 (선택)
              </label>
              <div className="flex justify-center gap-1.5 text-3xl">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(rating === n ? null : n)}
                    aria-label={`별점 ${n}`}
                    className={rating && n <= rating ? "text-star" : "text-line"}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={complete}
              disabled={busy || !finishedOn}
              className="w-full rounded-md bg-lib py-3 font-medium text-white disabled:opacity-40"
            >
              기록 완료
            </button>
          </div>
          <p className="absolute inset-x-0 bottom-3 text-center font-mono text-[11px] text-line">
            p.{inVol}
          </p>
        </div>

        <p className="mt-3 text-center font-mono text-[11px] text-faint">
          노트·감상은 기록 후 여정 자세히보기에서 자유롭게
        </p>
      </main>
    );
  }

  // 1단계: 책 선택(목차 문법) / 신규 등록
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col p-4">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lib">Library</p>
          <h1 className="font-display text-2xl font-bold">완독 기록</h1>
        </div>
        <Link href="/library" className="inline-flex min-h-11 items-center px-2 text-sm text-faint">
          ← 책장
        </Link>
      </header>

      {!creating ? (
        <>
          <div className="relative mb-3">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
              <SearchIcon />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={(e) => setQuery(e.target.value)}
              placeholder="제목 검색"
              className="w-full rounded-md border border-line bg-card py-2.5 pl-10 pr-4"
            />
          </div>
          <div className="rounded-lg border border-line bg-sheet px-5 py-3 shadow-[0_10px_30px_rgba(34,38,43,0.08)]">
            <p className="mb-1 pt-1 text-center font-mono text-[11px] tracking-[0.2em] text-lib">
              다시 읽은 책이라면
            </p>
            {matches.map((b) => {
              const no = journeyNoById.get(b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => setPicked(b)}
                  className="flex w-full items-baseline gap-2 border-b border-dotted border-line px-0.5 py-3 text-left text-[13px]"
                >
                  <span className="w-5 shrink-0 font-mono text-[10px] text-lib">
                    {no ? String(no).padStart(2, "0") : "—"}
                  </span>
                  <span className="truncate font-display">{b.title}</span>
                  <span className="min-w-3.5 flex-1 -translate-y-[3px] border-b border-dotted border-line/80" />
                  <span className="shrink-0 font-mono text-[10px] text-faint">
                    {b.readCount}회독 → {b.readCount + 1}회독
                  </span>
                </button>
              );
            })}
            {matches.length === 0 && (
              <p className="py-6 text-center text-sm text-faint">
                {books.length === 0 ? "첫 여정을 시작해 보세요" : "검색 결과가 없습니다"}
              </p>
            )}
            <button
              onClick={() => {
                setCreating(true);
                setForm({ ...EMPTY, title: query.trim() });
              }}
              className="my-3 flex min-h-11 w-full items-center justify-center rounded-md border border-dashed border-line text-sm text-lib"
            >
              ＋ 새 책 등록{q ? `: "${query.trim()}"` : ""}
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-line bg-sheet px-6 py-6 shadow-[0_10px_30px_rgba(34,38,43,0.08)]">
          <p className="mb-4 text-center font-mono text-[11px] tracking-[0.18em] text-lib">
            여정 {nextJourneyNo}번째가 될 책
          </p>
          <div className="space-y-3">
            {(
              [
                ["title", "제목"],
                ["author", "저자"],
                ["translator", "옮긴이 (선택)"],
                ["publisher", "출판사"],
                ["pub_year", "원저 발표연도 (예: 1943, BC 380)"],
                ["tags", "태그 (선택, 쉼표 구분 — 예: 철학, 역사)"],
              ] as const
            ).map(([key, label]) => (
              <input
                key={key}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                onBlur={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={label}
                className="w-full rounded-md border border-line bg-card px-4 py-2.5"
              />
            ))}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setCreating(false)}
                className="rounded-md border border-line px-4 py-2.5 text-sm"
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
                className="flex-1 rounded-md bg-lib py-2.5 font-medium text-white disabled:opacity-40"
              >
                등록하고 계속
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

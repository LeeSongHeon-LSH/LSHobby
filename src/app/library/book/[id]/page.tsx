"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addQuote,
  deleteBook,
  getBook,
  saveNote,
  updateBook,
  type Book,
  type Quote,
  type Reading,
} from "@/modules/library";
import { setTags, tagsByType } from "@/modules/shared/tag";
import { ReflectionBlock } from "@/modules/shared/reflection";
import { Markdown } from "@/modules/shared/markdown";

const stars = (n: number | null) => (n ? "★".repeat(n) : "");
const fmtMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// §11.5.3 책 상세 — 메타 → 회독 → 노트 → 인용구 → reflection (§7.3 확정 순서)
export default function BookDetailPage({ params }: PageProps<"/library/book/[id]">) {
  const { id: idStr } = use(params);
  const id = Number(idStr);
  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [tags, setTagsState] = useState<string[]>([]);
  const [missing, setMissing] = useState(false);

  const [editingMeta, setEditingMeta] = useState(false);
  const [meta, setMeta] = useState({ title: "", author: "", translator: "", publisher: "", pub_year: "", tags: "" });
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [addingQuote, setAddingQuote] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ content: "", page: "", comment: "" });
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const data = await getBook(id).catch(() => null);
    if (!data) {
      setMissing(true);
      return;
    }
    setBook(data.book);
    setReadings(data.readings);
    setQuotes(data.quotes);
    const t = await tagsByType("book").catch(() => new Map<number, string[]>());
    setTagsState(t.get(id) ?? []);
  }, [id]);

  useEffect(() => {
    void (async () => {
      await reload();
    })();
  }, [reload]);

  if (missing)
    return (
      <main className="p-4 text-center">
        <p className="mt-16 text-faint">책을 찾을 수 없습니다</p>
        <Link href="/library" className="mt-4 inline-block text-sm underline">서재로</Link>
      </main>
    );
  if (!book) return <main className="p-4" />;

  const openMetaEdit = () => {
    setMeta({
      title: book.title,
      author: book.author,
      translator: book.translator ?? "",
      publisher: book.publisher,
      pub_year: book.pub_year,
      tags: tags.join(", "),
    });
    setEditingMeta(true);
  };

  const saveMeta = async () => {
    setBusy(true);
    try {
      await updateBook(id, {
        title: meta.title.trim(),
        author: meta.author.trim(),
        translator: meta.translator.trim() || null,
        publisher: meta.publisher.trim(),
        pub_year: meta.pub_year.trim(),
      });
      await setTags("book", id, meta.tags.split(","));
      setEditingMeta(false);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`「${book.title}」과 회독·인용구·노트·생각 기록을 모두 삭제할까요?`)) return;
    setBusy(true);
    try {
      await deleteBook(id);
      router.replace("/library");
    } finally {
      setBusy(false);
    }
  };

  const submitQuote = async () => {
    setBusy(true);
    try {
      await addQuote(book, {
        content: quoteForm.content.trim(),
        page: quoteForm.page.trim() ? Number(quoteForm.page) : null,
        comment: quoteForm.comment.trim() || null,
      });
      setQuoteForm({ content: "", page: "", comment: "" });
      setAddingQuote(false);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const submitNote = async () => {
    setBusy(true);
    try {
      await saveNote(book, noteDraft.trim());
      setEditingNote(false);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="space-y-6 p-4">
      <header>
        <div className="flex items-start justify-between">
          <Link href="/library" className="py-1 pr-3 text-faint">←</Link>
          <button onClick={openMetaEdit} aria-label="수정" className="py-1 pl-3 text-faint">✎</button>
        </div>
        <h1 className="font-display text-2xl font-bold leading-snug">{book.title}</h1>
        <p className="mt-1 text-sm text-faint">
          {book.author}
          {book.translator ? ` · ${book.translator} 옮김` : ""} · {book.publisher} · {book.pub_year}
        </p>
        {tags.length > 0 && (
          <p className="mt-1 font-mono text-xs text-lib">{tags.map((t) => `#${t}`).join(" ")}</p>
        )}
      </header>

      <section>
        <h2 className="mb-2 text-sm font-medium text-faint">회독</h2>
        <ul className="rounded-md border border-line bg-card px-4 py-2 text-sm">
          {readings.map((r, i) => (
            <li key={r.id} className="flex justify-between py-1.5">
              <span className="font-mono text-xs">{readings.length - i}회독 · {fmtMonth(r.finished_on)}</span>
              <span className="text-cs">{stars(r.rating)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-faint">노트</h2>
          <button
            onClick={() => {
              setNoteDraft(book.note ?? "");
              setEditingNote(true);
            }}
            className="text-sm text-faint"
          >
            ✎
          </button>
        </div>
        {editingNote ? (
          <div className="space-y-2">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={8}
              placeholder="마크다운 노트…"
              className="w-full rounded-md border border-line bg-card px-3 py-2 font-mono text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setEditingNote(false)} className="rounded-md border border-line px-4 py-2 text-sm">취소</button>
              <button onClick={submitNote} disabled={busy} className="flex-1 rounded-md bg-lib py-2 text-sm font-medium text-white disabled:opacity-40">저장</button>
            </div>
          </div>
        ) : book.note ? (
          <div className="rounded-md border border-line bg-card p-4">
            <Markdown>{book.note}</Markdown>
          </div>
        ) : (
          <p className="text-sm text-faint">아직 노트가 없습니다</p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-faint">인용구 ({quotes.length})</h2>
          <button onClick={() => setAddingQuote(true)} className="text-sm text-faint">＋</button>
        </div>
        {addingQuote && (
          <div className="mb-3 space-y-2 rounded-md border border-line bg-card p-4">
            <textarea
              value={quoteForm.content}
              onChange={(e) => setQuoteForm({ ...quoteForm, content: e.target.value })}
              rows={3}
              placeholder="인용문…"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <input
                value={quoteForm.page}
                onChange={(e) => setQuoteForm({ ...quoteForm, page: e.target.value })}
                placeholder="페이지"
                inputMode="numeric"
                className="w-24 rounded-md border border-line px-3 py-2 text-sm"
              />
              <input
                value={quoteForm.comment}
                onChange={(e) => setQuoteForm({ ...quoteForm, comment: e.target.value })}
                placeholder="한 줄 코멘트 (선택)"
                className="flex-1 rounded-md border border-line px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAddingQuote(false)} className="rounded-md border border-line px-4 py-2 text-sm">취소</button>
              <button onClick={submitQuote} disabled={busy || !quoteForm.content.trim()} className="flex-1 rounded-md bg-lib py-2 text-sm font-medium text-white disabled:opacity-40">추가</button>
            </div>
          </div>
        )}
        <ul className="space-y-2">
          {quotes.map((q) => (
            <li key={q.id} className="rounded-md border border-line bg-card p-4 text-sm">
              <p className="font-display leading-relaxed">“{q.content}”{q.page ? <span className="ml-1 font-mono text-[11px] text-faint">p.{q.page}</span> : null}</p>
              {q.comment && <p className="mt-1 text-xs text-faint">└ {q.comment}</p>}
            </li>
          ))}
        </ul>
      </section>

      <ReflectionBlock
        subjectType="book"
        subjectId={id}
        defaultContext={readings.length > 0 ? `${readings.length}회독` : undefined}
      />

      {editingMeta && (
        <div className="fixed inset-0 z-10 flex items-end bg-black/30" onClick={() => setEditingMeta(false)}>
          <div className="mx-auto w-full max-w-md space-y-2.5 rounded-t-xl bg-card p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            {(
              [
                ["title", "제목"],
                ["author", "저자"],
                ["translator", "옮긴이 (선택)"],
                ["publisher", "출판사"],
                ["pub_year", "원저 발표연도"],
                ["tags", "태그 (쉼표 구분 — 예: 철학, 역사)"],
              ] as const
            ).map(([key, label]) => (
              <input
                key={key}
                value={meta[key]}
                onChange={(e) => setMeta({ ...meta, [key]: e.target.value })}
                placeholder={label}
                className="w-full rounded-md border border-line px-4 py-2.5 text-sm"
              />
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={remove} disabled={busy} className="rounded-md border border-err/40 px-4 py-2.5 text-sm text-err disabled:opacity-50">삭제</button>
              <button
                onClick={saveMeta}
                disabled={busy || !meta.title.trim() || !meta.author.trim() || !meta.publisher.trim() || !meta.pub_year.trim()}
                className="flex-1 rounded-md bg-lib py-2.5 font-medium text-white disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

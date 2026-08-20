"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  deleteBook,
  getBook,
  saveNote,
  updateBook,
  type Book,
  type BookListItem,
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

/**
 * #58 여정 "자세히보기" 시트 — 구 책 상세를 대체하는 바텀시트.
 * 회독 이력 → 노트 → 감상(reflection) 순서, 메타 수정·삭제는 ✎로 시트 안에서.
 */
export function BookSheet({
  item,
  journeyNo,
  onClose,
  onChanged,
}: {
  item: BookListItem;
  journeyNo: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [book, setBook] = useState<Book | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [tags, setTagsState] = useState<string[]>(item.tags);

  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingMeta, setEditingMeta] = useState(false);
  const [meta, setMeta] = useState({ title: "", author: "", translator: "", publisher: "", pub_year: "", tags: "" });
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const data = await getBook(item.id).catch(() => null);
    if (!data) return;
    setBook(data.book);
    setReadings(data.readings);
    const t = await tagsByType("book").catch(() => new Map<number, string[]>());
    setTagsState(t.get(item.id) ?? []);
  }, [item.id]);

  useEffect(() => {
    void (async () => {
      await reload();
    })();
  }, [reload]);

  const openMetaEdit = () => {
    if (!book) return;
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
      await updateBook(item.id, {
        title: meta.title.trim(),
        author: meta.author.trim(),
        translator: meta.translator.trim() || null,
        publisher: meta.publisher.trim(),
        pub_year: meta.pub_year.trim(),
      });
      await setTags("book", item.id, meta.tags.split(","));
      setEditingMeta(false);
      await reload();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!book || !confirm(`「${book.title}」과 회독·노트·생각 기록을 모두 삭제할까요?`)) return;
    setBusy(true);
    try {
      await deleteBook(item.id);
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const submitNote = async () => {
    if (!book) return;
    setBusy(true);
    try {
      await saveNote(book, noteDraft.trim());
      setEditingNote(false);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const title = book?.title ?? item.title;

  return (
    // 모바일 = 바텀시트 / 데스크톱(md~) = 우측 종이 토스트 (목업 데스크톱 페이지 — 테이프·살짝 기운 종이)
    <div
      className="fixed inset-0 z-10 flex items-end bg-black/30 md:items-center md:justify-end md:p-10"
      onClick={onClose}
    >
      <div
        className="anim-sheet-up relative mx-auto flex max-h-[82dvh] w-full max-w-md flex-col rounded-t-2xl border border-b-0 border-line bg-sheet shadow-[0_-16px_48px_rgba(34,38,43,0.3)] md:mx-0 md:max-h-full md:w-[440px] md:-rotate-[0.6deg] md:rounded-lg md:border-b md:shadow-[0_24px_60px_rgba(34,38,43,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="absolute -top-3 left-1/2 hidden h-6 w-24 -translate-x-1/2 rotate-[1.5deg] border-x border-dashed border-ink/10 bg-line/60 md:block"
          aria-hidden="true"
        />
        <div className="mx-auto mt-2.5 h-1 w-11 shrink-0 rounded-full bg-line md:hidden" aria-hidden="true" />
        <header className="flex items-start justify-between gap-3 border-b border-line/70 px-5 pb-3.5 pt-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-lib">MY NOTES · 여정 {journeyNo} / 20</p>
            <h2 className="mt-1 font-display text-lg font-bold leading-snug">{title}</h2>
            {book && (
              <p className="mt-0.5 text-xs text-faint">
                {book.author}
                {book.translator ? ` · ${book.translator} 옮김` : ""} · {book.publisher} · {book.pub_year}
                {tags.length > 0 ? ` · ${tags.map((t) => `#${t}`).join(" ")}` : ""}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={openMetaEdit} aria-label="수정" className="p-2 text-faint">✎</button>
            <button onClick={onClose} aria-label="닫기" className="p-2 text-faint">✕</button>
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {editingMeta ? (
            <div className="space-y-2.5">
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
                  className="w-full rounded-md border border-line bg-card px-4 py-2.5 text-sm"
                />
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={remove} disabled={busy} className="rounded-md border border-err/40 px-4 py-2.5 text-sm text-err disabled:opacity-50">삭제</button>
                <button onClick={() => setEditingMeta(false)} className="rounded-md border border-line px-4 py-2.5 text-sm">취소</button>
                <button
                  onClick={saveMeta}
                  disabled={busy || !meta.title.trim() || !meta.author.trim() || !meta.publisher.trim() || !meta.pub_year.trim()}
                  className="flex-1 rounded-md bg-lib py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <>
              <section>
                <h3 className="mb-2 text-sm font-medium text-faint">회독</h3>
                <ul className="rounded-md border border-line bg-card px-4 py-2 text-sm">
                  {readings.map((r, i) => (
                    <li key={r.id} className="flex justify-between py-1.5">
                      <span className="font-mono text-xs">{readings.length - i}회독 · {fmtMonth(r.finished_on)}</span>
                      <span className="text-star">{stars(r.rating)}</span>
                    </li>
                  ))}
                  {readings.length === 0 && <li className="py-1.5 text-xs text-faint">아직 완독 기록이 없습니다</li>}
                </ul>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-faint">노트</h3>
                  <button
                    onClick={() => {
                      setNoteDraft(book?.note ?? "");
                      setEditingNote(true);
                    }}
                    aria-label="노트 편집"
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
                ) : book?.note ? (
                  <div className="rounded-md border border-line bg-card p-4">
                    <Markdown>{book.note}</Markdown>
                  </div>
                ) : (
                  <p className="text-sm text-faint">아직 노트가 없습니다</p>
                )}
              </section>

              <ReflectionBlock
                subjectType="book"
                subjectId={item.id}
                defaultContext={readings.length > 0 ? `${readings.length}회독` : undefined}
              />
            </>
          )}
        </div>

        <footer className="border-t border-line/70 px-5 py-3">
          <Link
            href="/library/record"
            className="inline-flex min-h-11 items-center rounded-md border border-dashed border-line px-4 text-sm text-faint"
          >
            ＋ 재독 기록 추가
          </Link>
        </footer>
      </div>
    </div>
  );
}

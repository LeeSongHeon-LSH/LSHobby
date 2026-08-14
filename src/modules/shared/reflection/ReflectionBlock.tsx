"use client";

import { useEffect, useState } from "react";
import { addEntry, getTimeline, type ReflectionEntry } from "./service";

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * 생각 타임라인 블록 (§11.7) — 책·개념(·추후 단어) 상세 하단 공통, shared가 렌더링 소유.
 * append-only: 항목 수정·삭제 UI 없음 (§4.2)
 */
export function ReflectionBlock({
  subjectType,
  subjectId,
  defaultContext,
  onAdded,
}: {
  subjectType: string;
  subjectId: number;
  /** 입력 폼 context 기본값 — 책 완독 플로우의 "N회독" 자동 기입 (§7.2) */
  defaultContext?: string;
  onAdded?: () => void;
}) {
  const [entries, setEntries] = useState<ReflectionEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [context, setContext] = useState(defaultContext ?? "");
  const [busy, setBusy] = useState(false);

  const reload = () =>
    getTimeline(subjectType, subjectId)
      .then(setEntries)
      .catch(() => setEntries([]));
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectType, subjectId]);

  const submit = async () => {
    if (!content.trim()) return;
    setBusy(true);
    try {
      await addEntry(subjectType, subjectId, content, context);
      setContent("");
      setContext(defaultContext ?? "");
      setOpen(false);
      await reload();
      onAdded?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-neutral-500">생각 타임라인</h2>
      {entries.length > 0 && (
        <ul className="mb-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          {entries.map((e) => (
            <li key={e.id} className="p-4">
              <p className="mb-1 text-xs text-neutral-400">
                {fmtDate(e.created_at)}
                {e.context ? ` · ${e.context}` : ""}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{e.content}</p>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="지금의 생각…"
            rows={4}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            autoFocus
          />
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="계기 (선택 — 예: 재독, 3개월 후)"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">
              취소
            </button>
            <button
              onClick={submit}
              disabled={busy || !content.trim()}
              className="flex-1 rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              추가
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-lg border border-dashed border-neutral-300 py-2.5 text-sm text-neutral-500"
        >
          ＋ 지금 생각 추가
        </button>
      )}
    </section>
  );
}

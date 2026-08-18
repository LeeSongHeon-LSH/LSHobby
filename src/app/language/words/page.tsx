"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  articleFor,
  useCurrentConfig,
  deleteWord,
  listWords,
  stateLabel,
  updateWord,
  type Word,
} from "@/modules/language";
import type { Gender } from "@/modules/language";

// 검색용: 모든 악센트 무시 (구 index.html deaccent — 검색은 ñ도 관대)
const deaccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const GENDERS: { value: Gender; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "m", label: "남성" },
  { value: "f", label: "여성" },
  { value: "n", label: "양성" },
];

// §11.4.3 단어장 — 검색·상태 뱃지, 행 탭 → 편집/삭제
export default function WordsPage() {
  const config = useCurrentConfig();
  const [words, setWords] = useState<Word[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Word | null>(null);
  const [form, setForm] = useState({ word: "", meaning: "", gender: "none" as Gender });
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    () => listWords(config).then(setWords).catch(() => setWords([])),
    [config],
  );
  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = deaccent(query.trim().toLowerCase());
    if (!q) return words;
    return words.filter(
      (w) =>
        deaccent(w.word).includes(q) || deaccent(w.meaning.toLowerCase()).includes(q),
    );
  }, [words, query]);

  const openEdit = (w: Word) => {
    setEditing(w);
    setForm({ word: w.word, meaning: w.meaning, gender: w.gender ?? "none" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await updateWord(config, editing.id, form);
      setEditing(null);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const removeEditing = async () => {
    if (!editing || !confirm(`"${editing.word}"를 삭제할까요?`)) return;
    setBusy(true);
    try {
      await deleteWord(config, editing.id);
      setEditing(null);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="p-4">
      <header className="mb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lang">{config.label}</p>
        <h1 className="font-display text-2xl font-bold">단어장</h1>
      </header>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 단어·뜻 검색"
        className="mb-2 w-full rounded-md border border-line bg-card px-4 py-2.5"
      />
      <p className="mb-3 font-mono text-xs text-faint">
        {query ? `${filtered.length} / ${words.length}단어` : `${words.length}단어`}
      </p>
      <ul className="divide-y divide-line rounded-md border border-line bg-card">
        {filtered.map((w) => (
          <li key={w.id}>
            <button
              onClick={() => openEdit(w)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="flex-1 truncate">
                {articleFor(w.gender) && (
                  <span className="mr-1 text-lang">{articleFor(w.gender)}</span>
                )}
                {w.word}
              </span>
              <span className="flex-1 truncate text-faint">{w.meaning}</span>
              <span className="shrink-0 rounded-sm bg-lang-soft px-2 py-0.5 font-mono text-[11px] text-lang">
                {stateLabel(w.state)}
              </span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-faint">단어가 없습니다</li>
        )}
      </ul>

      {editing && (
        <div className="fixed inset-0 z-10 flex items-end bg-black/30" onClick={() => setEditing(null)}>
          <div
            className="mx-auto w-full max-w-md space-y-3 rounded-t-xl bg-card p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              value={form.word}
              onChange={(e) => setForm({ ...form, word: e.target.value })}
              className="w-full rounded-md border border-line px-4 py-2.5"
              placeholder="단어"
            />
            <input
              value={form.meaning}
              onChange={(e) => setForm({ ...form, meaning: e.target.value })}
              className="w-full rounded-md border border-line px-4 py-2.5"
              placeholder="뜻"
            />
            {config.hasGender && (
              <div className="flex gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setForm({ ...form, gender: g.value })}
                    className={`flex-1 rounded-md border py-2 text-sm ${
                      form.gender === g.value
                        ? "border-lang bg-lang text-white"
                        : "border-line text-faint"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={removeEditing}
                disabled={busy}
                className="rounded-md border border-err/40 px-4 py-2.5 text-sm text-err disabled:opacity-50"
              >
                삭제
              </button>
              <button
                onClick={saveEdit}
                disabled={busy || !form.word.trim() || !form.meaning.trim()}
                className="flex-1 rounded-md bg-lang py-2.5 font-medium text-white disabled:opacity-50"
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

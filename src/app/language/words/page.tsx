"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HomeButton } from "../../ui/home-button";
import { SearchIcon } from "../../ui/icons";
import { PixelPenguinBubble } from "../../ui/pixel";
import {
  articleFor,
  useCurrentConfig,
  deleteWord,
  listWords,
  updateWord,
  type Word,
} from "@/modules/language";
import type { Gender } from "@/modules/language";
import { useT } from "@/modules/shared/i18n";

// 검색용: 모든 악센트 무시 (구 index.html deaccent — 검색은 ñ도 관대)
const deaccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const GENDERS: Gender[] = ["none", "m", "f", "n"];

// §11.4.3 단어장 — 검색·상태 뱃지, 행 탭 → 편집/삭제
export default function WordsPage() {
  const config = useCurrentConfig();
  const t = useT();
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
    if (!editing || !confirm(t.lang.words.confirmDelete(editing.word))) return;
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
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lang">{t.lang.languageNames[config.code] ?? config.label}</p>
          <h1 className="font-display text-2xl font-bold">{t.lang.words.title}</h1>
        </div>
        <HomeButton accent="lang" />
      </header>
      <div className="relative mb-2">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"><SearchIcon /></span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={(e) => setQuery(e.target.value)}
          placeholder={t.lang.words.search}
          className="w-full rounded-md border border-line bg-card py-2.5 pl-10 pr-4"
        />
      </div>
      <p className="mb-3 flex items-center gap-1.5 font-mono text-[11px] text-faint">
        <PixelPenguinBubble size={20} />
        {query ? t.lang.words.countFiltered(filtered.length, words.length) : t.lang.words.count(words.length)}
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
                {t.lang.states[w.state] ?? "?"}
              </span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-faint">{t.lang.words.empty}</li>
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
              onBlur={(e) => setForm({ ...form, word: e.target.value })}
              className="w-full rounded-md border border-line px-4 py-2.5"
              placeholder={t.lang.words.word}
            />
            <input
              value={form.meaning}
              onChange={(e) => setForm({ ...form, meaning: e.target.value })}
              onBlur={(e) => setForm({ ...form, meaning: e.target.value })}
              className="w-full rounded-md border border-line px-4 py-2.5"
              placeholder={t.lang.words.meaning}
            />
            {config.hasGender && (
              <div className="flex gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setForm({ ...form, gender: g })}
                    className={`flex-1 rounded-md border py-2 text-sm ${
                      form.gender === g
                        ? "border-lang bg-lang text-white"
                        : "border-lang/30 bg-lang-soft/40 text-faint"
                    }`}
                  >
                    {t.lang.genders[g]}
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
                {t.common.delete}
              </button>
              <button
                onClick={saveEdit}
                disabled={busy || !form.word.trim() || !form.meaning.trim()}
                className="flex-1 rounded-md bg-lang py-2.5 font-medium text-white disabled:opacity-50"
              >
                {t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

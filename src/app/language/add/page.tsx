"use client";

import { useEffect, useState } from "react";
import { addWord, findByNorm, useCurrentConfig } from "@/modules/language";
import { HomeButton } from "../../ui/home-button";
import { AlertIcon } from "../../ui/icons";
import { PixelPenguinBubble } from "../../ui/pixel";
import type { Gender } from "@/modules/language";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "m", label: "남성" },
  { value: "f", label: "여성" },
  { value: "n", label: "양성" },
];

// §11.4.5 추가 — 3필드 + norm 중복 실시간 힌트 (구 앱 이식)
export default function AddPage() {
  const config = useCurrentConfig();
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [gender, setGender] = useState<Gender>("none");
  // dup은 어느 입력(query)에 대한 결과인지 함께 저장 — 입력이 바뀌면 렌더에서 무효화
  const [dup, setDup] = useState<{ query: string; word: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dupWord = dup && dup.query === word.trim() ? dup.word : null;

  // 입력 멈춘 뒤 중복 조회 (디바운스 300ms)
  useEffect(() => {
    const w = word.trim();
    if (!w) return;
    const t = setTimeout(() => {
      findByNorm(config, w)
        .then((hit) => setDup(hit ? { query: w, word: hit.word } : null))
        .catch(() => setDup(null));
    }, 300);
    return () => clearTimeout(t);
  }, [word, config]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setDone(null);
    try {
      const { added, duplicate } = await addWord(config, { word, meaning, gender });
      if (duplicate) {
        setDup({ query: word.trim(), word: duplicate.word });
      } else if (added) {
        setDone(`추가됨: ${added.word}`);
        setWord("");
        setMeaning("");
        setGender("none");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col p-4">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lang">{config.label}</p>
          <h1 className="font-display text-2xl font-bold">단어 추가</h1>
        </div>
        <HomeButton accent="lang" />
      </header>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm text-faint">단어</label>
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder={config.inputPlaceholder}
            className="w-full rounded-md border border-line bg-card px-4 py-3"
            lang={config.code}
            autoCapitalize="off"
          />
          {dupWord && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-err">
              <AlertIcon />이미 있는 단어: <b className="font-semibold">{dupWord}</b>
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm text-faint">뜻</label>
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="한국어 뜻..."
            className="w-full rounded-md border border-line bg-card px-4 py-3"
          />
        </div>
        {config.hasGender && (
          <div>
            <label className="mb-1 block text-sm text-faint">성별 (선택)</label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  type="button"
                  key={g.value}
                  onClick={() => setGender(gender === g.value ? "none" : g.value)}
                  className={`flex-1 rounded-md border py-2.5 text-sm ${
                    gender === g.value
                      ? "border-lang bg-lang text-white"
                      : "border-line text-faint"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          type="submit"
          disabled={busy || !word.trim() || !meaning.trim() || dupWord !== null}
          className="w-full rounded-md bg-lang py-3 font-medium text-white disabled:opacity-40"
        >
          추가하기
        </button>
        {done && <p className="text-center text-sm text-ok">{done}</p>}
      </form>
      <div className="flex-1" />
      <div className="mb-2 flex justify-center"><PixelPenguinBubble size={40} /></div>
    </main>
  );
}

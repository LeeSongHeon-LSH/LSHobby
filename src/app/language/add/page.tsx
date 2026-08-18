"use client";

import { useEffect, useState } from "react";
import { addWord, findByNorm, useCurrentConfig } from "@/modules/language";
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
  const [dup, setDup] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 입력 멈춘 뒤 중복 조회 (디바운스 300ms)
  useEffect(() => {
    setDup(null);
    const w = word.trim();
    if (!w) return;
    const t = setTimeout(() => {
      findByNorm(config, w)
        .then((hit) => setDup(hit ? hit.word : null))
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
        setDup(duplicate.word);
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
    <main className="p-4">
      <h1 className="mb-4 text-lg font-semibold">단어 추가</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-neutral-500">단어</label>
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder={config.inputPlaceholder}
            className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3"
            lang={config.code}
            autoCapitalize="off"
          />
          {dup && <p className="mt-1 text-sm text-amber-600">⚠ 이미 있는 단어: {dup}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm text-neutral-500">뜻</label>
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="한국어 뜻..."
            className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3"
          />
        </div>
        {config.hasGender && (
          <div>
            <label className="mb-1 block text-sm text-neutral-500">성별 (선택)</label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  type="button"
                  key={g.value}
                  onClick={() => setGender(gender === g.value ? "none" : g.value)}
                  className={`flex-1 rounded-lg border py-2.5 text-sm ${
                    gender === g.value
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-300 text-neutral-600"
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
          disabled={busy || !word.trim() || !meaning.trim() || dup !== null}
          className="w-full rounded-lg bg-neutral-900 py-3 font-medium text-white disabled:opacity-40"
        >
          추가하기
        </button>
        {done && <p className="text-center text-sm text-green-700">{done}</p>}
      </form>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteConcept,
  getConcept,
  saveConcept,
  titleIndex,
  uploadConceptImage,
} from "@/modules/knowledge";
import { tagsByType } from "@/modules/shared/tag";

// §11.6.3 개념 편집 — [[ 자동완성 팝업 + 이미지 첨부(Storage). ?id=N 편집 / ?title=T 신규(red link 진입)
export default function ConceptEditPage() {
  const router = useRouter();
  const [id, setId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [body, setBody] = useState("");
  const [titles, setTitles] = useState<string[]>([]);
  const [suggest, setSuggest] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const qid = sp.get("id");
    (async () => {
      const index = await titleIndex().catch(() => new Map<string, number>());
      setTitles([...index.keys()].sort());
      if (qid) {
        const c = await getConcept(Number(qid)).catch(() => null);
        if (c) {
          setId(c.id);
          setTitle(c.title);
          setBody(c.body);
          const t = await tagsByType("concept").catch(() => new Map<number, string[]>());
          setTags((t.get(c.id) ?? []).join(", "));
        }
      } else if (sp.get("title")) {
        setTitle(sp.get("title")!); // red link → 그 제목으로 생성 진입 (§8.2)
      }
      setLoaded(true);
    })();
  }, []);

  // 커서 앞의 "[[검색어" 패턴 → 자동완성 (§11.6.3)
  const updateSuggest = (value: string, cursor: number) => {
    const before = value.slice(0, cursor);
    const m = before.match(/\[\[([^\][\n]*)$/);
    if (!m) {
      setSuggest([]);
      return;
    }
    const q = m[1].toLowerCase();
    setSuggest(titles.filter((t) => t.toLowerCase().includes(q)).slice(0, 5));
  };

  const pickSuggestion = (t: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    const before = body.slice(0, cursor).replace(/\[\[[^\][\n]*$/, `[[${t}]]`);
    const next = before + body.slice(cursor);
    setBody(next);
    setSuggest([]);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    }, 0);
  };

  const attachImage = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadConceptImage(file);
      const el = bodyRef.current;
      const at = el ? el.selectionStart : body.length;
      setBody(`${body.slice(0, at)}\n![](${url})\n${body.slice(at)}`);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const savedId = await saveConcept({
        id,
        title,
        body,
        tags: tags.split(","),
      });
      router.replace(`/knowledge/concept/${savedId}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (id === null || !confirm(`「${title}」 개념과 생각 기록을 삭제할까요?`)) return;
    setBusy(true);
    try {
      await deleteConcept(id);
      router.replace("/knowledge");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <main className="p-4" />;

  return (
    <main className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm text-faint">← 취소</button>
        <button
          onClick={save}
          disabled={busy || !title.trim()}
          className="rounded-md bg-cs px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          저장
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="mb-2 w-full rounded-md border border-line bg-card px-4 py-2.5 font-medium"
      />
      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="태그 (쉼표 구분 — 예: 분산시스템, 합의)"
        className="mb-2 w-full rounded-md border border-line bg-card px-4 py-2.5 text-sm"
      />
      <div className="relative">
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            updateSuggest(e.target.value, e.target.selectionStart);
          }}
          onClick={(e) => updateSuggest(body, e.currentTarget.selectionStart)}
          rows={16}
          placeholder={"마크다운 본문…\n[[다른 개념]] 으로 연결"}
          className="w-full rounded-md border border-line bg-card px-3 py-2 font-mono text-sm"
        />
        {suggest.length > 0 && (
          <ul className="absolute left-3 top-full z-10 -mt-1 w-56 rounded-md border border-line bg-card shadow-lg">
            {suggest.map((t) => (
              <li key={t}>
                <button
                  onClick={() => pickSuggestion(t)}
                  className="w-full px-3 py-2 text-left text-sm"
                >
                  {t}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <label className="cursor-pointer rounded-md border border-line px-4 py-2 text-sm text-faint">
          🖼 이미지 첨부
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => attachImage(e.target.files?.[0] ?? null)}
          />
        </label>
        {id !== null && (
          <button onClick={remove} disabled={busy} className="text-sm text-err">
            삭제
          </button>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/modules/shared/auth";
import {
  addThought,
  dayKey,
  groupByDay,
  listThoughts,
  recentDigests,
  type Thought,
  type ThoughtDigest,
} from "@/modules/thought";
import { HomeButton } from "../ui/home-button";
import { PixelPenguinThink } from "../ui/pixel";

const PAGE_SIZE = 80;

const dayLabel = (day: string): string => {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (day === today) return "오늘";
  if (day === yesterday) return "어제";
  const [y, m, d] = day.split("-").map(Number);
  return y === new Date().getFullYear() ? `${m}월 ${d}일` : `${y}년 ${m}월 ${d}일`;
};

const timeOf = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// 생각 세션 — 하루 생각 정리 스트림 (append-only) + 로컬 워커의 하루 요약
function ThoughtStream() {
  const [input, setInput] = useState("");
  const [thoughts, setThoughts] = useState<Thought[] | null>(null);
  const [digests, setDigests] = useState<Map<string, ThoughtDigest>>(new Map());
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [list, digs] = await Promise.all([listThoughts(PAGE_SIZE), recentDigests()]);
        setThoughts(list);
        setHasMore(list.length === PAGE_SIZE);
        setDigests(new Map(digs.map((d) => [d.day, d])));
      } catch {
        setThoughts([]);
      }
    })();
  }, []);

  const submit = async () => {
    const content = input.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const added = await addThought(content);
      setThoughts((prev) => [added, ...(prev ?? [])]);
      setInput("");
    } catch {
      alert("저장 실패 — 잠시 후 다시 시도하세요");
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    if (!thoughts || thoughts.length === 0 || busy) return;
    setBusy(true);
    try {
      const more = await listThoughts(PAGE_SIZE, thoughts[thoughts.length - 1].created_at);
      setThoughts([...thoughts, ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } finally {
      setBusy(false);
    }
  };

  const groups = groupByDay(thoughts ?? []);

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-10 md:max-w-2xl">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-thought">Thought</p>
          <h1 className="font-display text-2xl font-bold">생각</h1>
        </div>
        <HomeButton accent="thought" />
      </header>

      <div className="relative overflow-hidden rounded-lg border border-thought/40 bg-card p-4">
        <span className="absolute left-4 top-0 h-1 w-10 bg-thought" aria-hidden="true" />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="지금 드는 생각, 오늘의 정리..."
          className="w-full resize-y rounded-md border border-line bg-card px-3.5 py-3 text-sm"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="font-mono text-[11px] text-faint">쓴 생각은 고치지 않아요 — 이어서 쓰기</p>
          <button
            onClick={submit}
            disabled={busy || !input.trim()}
            className="rounded-md bg-thought px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            기록
          </button>
        </div>
      </div>

      {thoughts === null ? (
        <p className="mt-14 text-center text-sm text-faint">불러오는 중…</p>
      ) : thoughts.length === 0 ? (
        <div className="mt-14 text-center">
          <div className="mb-3 flex justify-center"><PixelPenguinThink size={48} /></div>
          <p className="text-sm text-faint">첫 생각을 남겨보세요</p>
        </div>
      ) : (
        <div className="mt-7 space-y-7">
          {groups.map((g) => {
            const digest = digests.get(g.day);
            return (
              <section key={g.day}>
                <h2 className="mb-2.5 flex items-baseline gap-2">
                  <span className="font-display font-bold">{dayLabel(g.day)}</span>
                  <span className="font-mono text-[11px] text-faint">{g.items.length}개</span>
                </h2>
                {digest && (
                  <div className="relative mb-2.5 overflow-hidden rounded-md border border-thought/40 bg-thought-soft p-3.5">
                    <span className="absolute left-4 top-0 h-1 w-10 bg-thought" aria-hidden="true" />
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-thought">
                      하루 요약 · {digest.model}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm">{digest.summary}</p>
                    {digest.topics.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {digest.topics.map((topic) => (
                          <span
                            key={topic}
                            className="rounded-full border border-thought/40 bg-card px-2.5 py-0.5 font-mono text-[11px] text-thought"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <ul className="space-y-2">
                  {g.items.map((t) => (
                    <li key={t.id} className="rounded-md border border-line bg-card p-3.5">
                      <p className="font-mono text-[11px] text-faint">{timeOf(t.created_at)}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{t.content}</p>
                      {t.topics && t.topics.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {t.topics.map((topic) => (
                            <span
                              key={topic}
                              className="rounded-full bg-thought-soft px-2 py-0.5 font-mono text-[10px] text-thought"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={busy}
              className="w-full rounded-md border border-line py-3 text-sm text-faint disabled:opacity-40"
            >
              더 보기
            </button>
          )}
        </div>
      )}
    </main>
  );
}

export default function ThoughtsPage() {
  return (
    <AuthGuard>
      <ThoughtStream />
    </AuthGuard>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/modules/shared/auth";
import {
  addThought,
  dayKey,
  groupByDay,
  listThoughts,
  recentDigests,
  recentTopics,
  searchThoughts,
  thoughtsDaysAgo,
  topTopics,
  type Thought,
  type ThoughtDigest,
} from "@/modules/thought";
import { HomeButton } from "../ui/home-button";
import { PixelPenguinThink } from "../ui/pixel";

const PAGE_SIZE = 80;

// 과거의 오늘 되짚기 — 고치지 않고 남긴 생각을 다시 만나는 자리 (append-only의 보상)
const ECHOES = [
  { label: "1년 전 오늘", days: 365 },
  { label: "한 달 전 오늘", days: 30 },
  { label: "일주일 전 오늘", days: 7 },
];

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

// 메모 카드 — 스트림·검색 결과 공용. 주제 칩 클릭 시 해당 주제로 검색
function ThoughtCard({ t, onTopic }: { t: Thought; onTopic: (topic: string) => void }) {
  return (
    <li className="rounded-md border border-line bg-card p-3.5">
      <p className="font-mono text-[11px] text-faint">{timeOf(t.created_at)}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{t.content}</p>
      {t.topics && t.topics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {t.topics.map((topic) => (
            <button
              key={topic}
              onClick={() => onTopic(topic)}
              className="rounded-full bg-thought-soft px-2 py-0.5 font-mono text-[10px] text-thought"
            >
              {topic}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

// 생각 세션 — 하루 생각 정리 스트림 (append-only) + 로컬 워커의 하루 요약
function ThoughtStream() {
  const [input, setInput] = useState("");
  const [thoughts, setThoughts] = useState<Thought[] | null>(null);
  const [digests, setDigests] = useState<Map<string, ThoughtDigest>>(new Map());
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  // 검색 결과 — 어떤 질의의 결과인지 함께 저장 (질의가 바뀌면 무시)
  const [results, setResults] = useState<{ q: string; list: Thought[] } | null>(null);
  const [echoes, setEchoes] = useState<{ label: string; items: Thought[] }[]>([]);
  const [trajectory, setTrajectory] = useState<[string, number][]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [list, digs, topics, ...pasts] = await Promise.all([
          listThoughts(PAGE_SIZE),
          recentDigests(),
          recentTopics(),
          ...ECHOES.map((e) => thoughtsDaysAgo(e.days)),
        ]);
        setThoughts(list);
        setHasMore(list.length === PAGE_SIZE);
        setDigests(new Map(digs.map((d) => [d.day, d])));
        setTrajectory(topTopics(topics));
        setEchoes(
          ECHOES.map((e, i) => ({ label: e.label, items: pasts[i] })).filter(
            (e) => e.items.length > 0,
          ),
        );
      } catch {
        setThoughts([]);
      }
    })();
  }, []);

  // 검색 — 입력 후 300ms 디바운스, 비우면 스트림으로 복귀
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const timer = setTimeout(async () => {
      try {
        setResults({ q, list: await searchThoughts(q) });
      } catch {
        setResults({ q, list: [] });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

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

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="내용·주제 검색"
        className="mt-3 w-full rounded-md border border-line bg-card px-3.5 py-2.5 text-sm"
      />

      {!query.trim() && (trajectory.length > 0 || echoes.length > 0) && (
        <div className="mt-5 space-y-3">
          {trajectory.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] text-faint">최근 30일 주제</span>
              {trajectory.map(([topic, n]) => (
                <button
                  key={topic}
                  onClick={() => setQuery(topic)}
                  className="rounded-full bg-thought-soft px-2.5 py-0.5 font-mono text-[11px] text-thought"
                >
                  {topic} <span className="opacity-60">{n}</span>
                </button>
              ))}
            </div>
          )}
          {echoes.map((e) => (
            <section
              key={e.label}
              className="relative overflow-hidden rounded-lg border border-thought/40 bg-thought-soft p-3.5"
            >
              <span className="absolute left-4 top-0 h-1 w-10 bg-thought" aria-hidden="true" />
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-thought">
                그때의 나 · {e.label}
              </p>
              <ul className="mt-2 space-y-2">
                {e.items.map((t) => (
                  <ThoughtCard key={t.id} t={t} onTopic={setQuery} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {query.trim() ? (
        results?.q !== query.trim() ? (
          <p className="mt-14 text-center text-sm text-faint">검색 중…</p>
        ) : results.list.length === 0 ? (
          <p className="mt-14 text-center text-sm text-faint">검색 결과가 없어요</p>
        ) : (
          <div className="mt-7 space-y-7">
            {groupByDay(results.list).map((g) => (
              <section key={g.day}>
                <h2 className="mb-2.5 flex items-baseline gap-2">
                  <span className="font-display font-bold">{dayLabel(g.day)}</span>
                  <span className="font-mono text-[11px] text-faint">{g.items.length}개</span>
                </h2>
                <ul className="space-y-2">
                  {g.items.map((t) => (
                    <ThoughtCard key={t.id} t={t} onTopic={setQuery} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : thoughts === null ? (
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
                          <button
                            key={topic}
                            onClick={() => setQuery(topic)}
                            className="rounded-full border border-thought/40 bg-card px-2.5 py-0.5 font-mono text-[11px] text-thought"
                          >
                            {topic}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <ul className="space-y-2">
                  {g.items.map((t) => (
                    <ThoughtCard key={t.id} t={t} onTopic={setQuery} />
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

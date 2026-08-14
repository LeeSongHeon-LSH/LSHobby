"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard, signOut } from "@/modules/shared/auth";
import { getFeed, type FeedItem } from "@/modules/shared/activity";
import { countWords, esConfig } from "@/modules/language";

// §11.3 홈(허브) — 세션 카드 + 도메인 횡단 타임라인. 탭바 없음 (§11.1)
const relTime = (iso: string): string => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "오늘";
  if (d === 1) return "어제";
  return `${d}일 전`;
};

function Hub() {
  const router = useRouter();
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    countWords(esConfig).then(setWordCount).catch(() => setWordCount(null));
    getFeed(30).then(setFeed).catch(() => setFeed([]));
  }, []);

  const logout = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">LSHobby</h1>
        <button onClick={logout} aria-label="로그아웃" className="rounded p-2 text-neutral-500">
          ⚙
        </button>
      </header>

      <nav className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5 opacity-50">
          <span className="text-lg font-semibold">📚 책</span>
          <span className="text-sm text-neutral-500">준비 중</span>
        </div>
        <Link
          href="/language"
          className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <span className="text-lg font-semibold">🗣 언어</span>
          <span className="text-sm text-neutral-500">
            {wordCount === null ? "" : `단어 ${wordCount}개`}
          </span>
        </Link>
        <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5 opacity-50">
          <span className="text-lg font-semibold">💻 CS</span>
          <span className="text-sm text-neutral-500">준비 중</span>
        </div>
      </nav>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-neutral-500">최근 기록</h2>
        {feed.length === 0 ? (
          <p className="text-sm text-neutral-400">아직 기록이 없습니다</p>
        ) : (
          <ul className="space-y-2">
            {feed.map((f) => (
              <li key={f.id} className="flex gap-3 text-sm">
                <span className="w-14 shrink-0 text-neutral-400">{relTime(f.occurred_at)}</span>
                <span>{f.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <Hub />
    </AuthGuard>
  );
}

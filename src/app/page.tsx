"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard, signOut, updatePassword } from "@/modules/shared/auth";
import { getFeed, type FeedItem } from "@/modules/shared/activity";
import { countWords, esConfig } from "@/modules/language";
import { countBooks } from "@/modules/library";
import { countConcepts } from "@/modules/knowledge";

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
  const [bookCount, setBookCount] = useState<number | null>(null);
  const [conceptCount, setConceptCount] = useState<number | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    countWords(esConfig).then(setWordCount).catch(() => setWordCount(null));
    countBooks().then(setBookCount).catch(() => setBookCount(null));
    countConcepts().then(setConceptCount).catch(() => setConceptCount(null));
    getFeed(30).then(setFeed).catch(() => setFeed([]));
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    await signOut();
    router.replace("/login");
  };

  const changePassword = async () => {
    if (pw1.length < 8) {
      setPwMsg("8자 이상으로 입력하세요");
      return;
    }
    if (pw1 !== pw2) {
      setPwMsg("두 입력이 다릅니다");
      return;
    }
    setBusy(true);
    setPwMsg(null);
    const err = await updatePassword(pw1);
    setBusy(false);
    if (err) {
      setPwMsg("변경 실패 — 잠시 후 다시 시도하세요");
    } else {
      setPw1("");
      setPw2("");
      setPwOpen(false);
      setMenuOpen(false);
      alert("비밀번호가 변경되었습니다. 비밀번호 관리자에 저장해 두세요.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">LSHobby</h1>
        <button onClick={() => setMenuOpen(true)} aria-label="설정" className="rounded p-2 text-neutral-500">
          ⚙
        </button>
      </header>

      <nav className="space-y-3">
        <Link
          href="/library"
          className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <span className="text-lg font-semibold">📚 책</span>
          <span className="text-sm text-neutral-500">
            {bookCount === null ? "" : `완독 ${bookCount}권`}
          </span>
        </Link>
        <Link
          href="/language"
          className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <span className="text-lg font-semibold">🗣 언어</span>
          <span className="text-sm text-neutral-500">
            {wordCount === null ? "" : `단어 ${wordCount}개`}
          </span>
        </Link>
        <Link
          href="/knowledge"
          className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <span className="text-lg font-semibold">💻 CS</span>
          <span className="text-sm text-neutral-500">
            {conceptCount === null ? "" : `개념 ${conceptCount}개`}
          </span>
        </Link>
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

      {menuOpen && (
        <div className="fixed inset-0 z-10 flex items-end bg-black/30" onClick={() => setMenuOpen(false)}>
          <div
            className="mx-auto w-full max-w-md space-y-2 rounded-t-2xl bg-white p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            {!pwOpen ? (
              <>
                <button
                  onClick={() => setPwOpen(true)}
                  className="w-full rounded-lg border border-neutral-300 py-3 text-sm"
                >
                  비밀번호 변경
                </button>
                <button
                  onClick={logout}
                  className="w-full rounded-lg border border-neutral-300 py-3 text-sm text-red-600"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">비밀번호 변경</p>
                <input
                  type="password"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  placeholder="새 비밀번호 (8자 이상)"
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
                  autoComplete="new-password"
                  autoFocus
                />
                <input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="새 비밀번호 확인"
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
                  autoComplete="new-password"
                />
                {pwMsg && <p className="text-sm text-red-600">{pwMsg}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      setPwOpen(false);
                      setPwMsg(null);
                    }}
                    className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
                  >
                    취소
                  </button>
                  <button
                    onClick={changePassword}
                    disabled={busy || !pw1 || !pw2}
                    className="flex-1 rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    변경
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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

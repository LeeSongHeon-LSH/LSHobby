"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard, signOut, updatePassword } from "@/modules/shared/auth";
import { countWords, languageConfigs } from "@/modules/language";
import { countBooks } from "@/modules/library";
import { countThoughts } from "@/modules/thought";
import {
  PixelMascot,
  PixelPenguinBook,
  PixelPenguinBubble,
  PixelPenguinThink,
  PixelPenguinTiny,
  PixelTracks,
} from "../ui/pixel";

// #57·#60 홈(허브) — 쌓인 네 서랍(책·언어·CV·생각), 서랍마다 도메인 펭귄. 탭바 없음
function Hub() {
  const router = useRouter();
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [bookCount, setBookCount] = useState<number | null>(null);
  const [thoughtCount, setThoughtCount] = useState<number | null>(null);

  useEffect(() => {
    Promise.all(Object.values(languageConfigs).map((c) => countWords(c)))
      .then((counts) => setWordCount(counts.reduce((a, b) => a + b, 0)))
      .catch(() => setWordCount(null));
    countBooks().then(setBookCount).catch(() => setBookCount(null));
    countThoughts().then(setThoughtCount).catch(() => setThoughtCount(null));
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

  const drawers = [
    {
      href: "/library",
      name: "책",
      count: bookCount === null ? "" : `완독 ${bookCount}권`,
      icon: <PixelPenguinBook size={48} />,
      tab: "bg-lib",
      card: "border-lib/40 bg-lib-soft",
    },
    {
      href: "/language",
      name: "언어",
      count: wordCount === null ? "" : `단어 ${wordCount}개`,
      icon: <PixelPenguinBubble size={48} />,
      tab: "bg-lang",
      card: "border-lang/40 bg-lang-soft",
    },
    {
      href: "/cv/edit",
      name: "CV",
      count: "공개 이력서",
      icon: <PixelMascot size={48} />,
      tab: "bg-cv",
      card: "border-cv/40 bg-cv-soft",
    },
    {
      href: "/thoughts",
      name: "생각",
      count: thoughtCount === null ? "" : `기록 ${thoughtCount}개`,
      icon: <PixelPenguinThink size={48} />,
      tab: "bg-thought",
      card: "border-thought/40 bg-thought-soft",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col p-4 pb-6 md:max-w-4xl md:p-8">
      <header className="mb-4 flex items-center justify-between md:mb-6">
        <div className="flex items-end gap-2.5">
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">LSHobby</h1>
          <span className="hidden md:block"><PixelMascot size={30} /></span>
        </div>
        <button onClick={() => setMenuOpen(true)} aria-label="설정" className="rounded p-2 text-faint">
          ⚙
        </button>
      </header>

      <nav className="grid min-h-0 flex-1 grid-cols-1 grid-rows-4 gap-3 md:grid-cols-2 md:grid-rows-2 md:gap-5">
        {drawers.map((d, i) => (
          <Link
            key={d.href}
            href={d.href}
            className={`anim-rise pg-host relative flex flex-col items-center justify-center gap-2.5 overflow-hidden rounded-md border ${d.card}`}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className={`absolute left-4 top-0 h-1 w-10 ${d.tab}`} aria-hidden="true" />
            <span className="pg-waddle">{d.icon}</span>
            <span className="font-display text-lg font-bold">{d.name}</span>
            <span className="min-h-4 font-mono text-xs text-faint">{d.count}</span>
          </Link>
        ))}
      </nav>

      <div aria-hidden="true" className="mt-3 flex items-end justify-end gap-1.5 pr-1 opacity-80">
        <PixelTracks size={88} />
        <PixelPenguinTiny size={20} />
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-10 flex items-end bg-black/30" onClick={() => setMenuOpen(false)}>
          <div
            className="mx-auto w-full max-w-md space-y-2 rounded-t-xl bg-card p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            {!pwOpen ? (
              <>
                <button
                  onClick={() => setPwOpen(true)}
                  className="w-full rounded-md border border-line py-3 text-sm"
                >
                  비밀번호 변경
                </button>
                <button
                  onClick={logout}
                  className="w-full rounded-md border border-line py-3 text-sm text-err"
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
                  className="w-full rounded-md border border-line px-4 py-2.5 text-sm"
                  autoComplete="new-password"
                  autoFocus
                />
                <input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="새 비밀번호 확인"
                  className="w-full rounded-md border border-line px-4 py-2.5 text-sm"
                  autoComplete="new-password"
                />
                {pwMsg && <p className="text-sm text-err">{pwMsg}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      setPwOpen(false);
                      setPwMsg(null);
                    }}
                    className="rounded-md border border-line px-4 py-2.5 text-sm"
                  >
                    취소
                  </button>
                  <button
                    onClick={changePassword}
                    disabled={busy || !pw1 || !pw2}
                    className="flex-1 rounded-md bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-40"
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

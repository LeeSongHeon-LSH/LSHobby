"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard, signOut, updatePassword } from "@/modules/shared/auth";
import { countWords, languageConfigs } from "@/modules/language";
import { countBooks } from "@/modules/library";
import { countConcepts } from "@/modules/knowledge";
import { PixelBooks, PixelCat, PixelSpeech, PixelTerminal } from "../ui/pixel";

// #48·#53 홈(허브) — 화면을 4등분하는 "네 서랍": 책·언어·CS·CV. 타임라인 제거, 탭바 없음 (§11.1)
function Hub() {
  const router = useRouter();
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [bookCount, setBookCount] = useState<number | null>(null);
  const [conceptCount, setConceptCount] = useState<number | null>(null);

  useEffect(() => {
    Promise.all(Object.values(languageConfigs).map((c) => countWords(c)))
      .then((counts) => setWordCount(counts.reduce((a, b) => a + b, 0)))
      .catch(() => setWordCount(null));
    countBooks().then(setBookCount).catch(() => setBookCount(null));
    countConcepts().then(setConceptCount).catch(() => setConceptCount(null));
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
      icon: <PixelBooks size={44} />,
      tab: "bg-lib",
    },
    {
      href: "/language",
      name: "언어",
      count: wordCount === null ? "" : `단어 ${wordCount}개`,
      icon: <PixelSpeech size={44} />,
      tab: "bg-lang",
    },
    {
      href: "/knowledge",
      name: "CS",
      count: conceptCount === null ? "" : `개념 ${conceptCount}개`,
      icon: <PixelTerminal size={44} />,
      tab: "bg-cs",
    },
    {
      href: "/cv/edit",
      name: "CV",
      count: "공개 이력서",
      icon: <PixelCat size={44} />,
      tab: "bg-cv",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col p-4 pb-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">LSHobby</h1>
        <button onClick={() => setMenuOpen(true)} aria-label="설정" className="rounded p-2 text-faint">
          ⚙
        </button>
      </header>

      <nav className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3">
        {drawers.map((d, i) => (
          <Link
            key={d.href}
            href={d.href}
            className="anim-rise relative flex flex-col items-center justify-center gap-2.5 overflow-hidden rounded-md border border-line bg-card"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className={`absolute left-4 top-0 h-1 w-10 ${d.tab}`} aria-hidden="true" />
            {d.icon}
            <span className="font-display text-lg font-bold">{d.name}</span>
            <span className="min-h-4 font-mono text-xs text-faint">{d.count}</span>
          </Link>
        ))}
      </nav>

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

"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard, signOut, updatePassword } from "@/modules/shared/auth";
import { countWords, languageConfigs } from "@/modules/language";
import { countBooks } from "@/modules/library";
import { countThoughts } from "@/modules/thought";
import {
  PixelMascot,
  PixelMoon,
  PixelPenguinBook,
  PixelPenguinBubble,
  PixelPenguinThink,
  PixelSun,
  PixelTracks,
} from "../ui/pixel";
import { IceScene } from "../ui/scene";

// #69 — 서랍 = 각 세션 장면을 들여다보는 창: 배경은 세션 하늘·시그니처, 내용은 흰 테두리 + 소프트색 판.
// 모듈 스코프에 둔다 — 컴포넌트 안이면 설정 시트 입력 한 글자마다 장면 JSX 수백 개가 새로 만들어진다
const DRAWERS: {
  href: string;
  name: string;
  icon: ReactNode;
  tab: string;
  card: string;
  plate: string;
  scene: ReactNode;
}[] = [
  {
    href: "/library",
    name: "책",
    icon: <PixelPenguinBook size={48} />,
    tab: "bg-lib",
    card: "border-lib/40 igloo-sky",
    plate: "bg-lib-soft/95",
    scene: (
      <span
        className="shelf-wall"
        style={{ "--shelf-h": "28px", "--shelf-tile": "48px", "--shelf-lip": "3px" } as CSSProperties}
      />
    ),
  },
  {
    href: "/language",
    name: "언어",
    icon: <PixelPenguinBubble size={48} />,
    tab: "bg-lang",
    card: "border-lang/40 sky-chat",
    plate: "bg-lang-soft/95",
    scene: (
      <>
        <span className="absolute right-3 top-3"><PixelSun size={22} /></span>
        <span className="igloo-floor" />
        <span className="absolute bottom-2.5 left-3 opacity-70"><PixelTracks size={56} /></span>
      </>
    ),
  },
  {
    href: "/thoughts",
    name: "생각",
    icon: <PixelPenguinThink size={48} />,
    tab: "bg-thought",
    card: "border-thought/40 sky-night",
    plate: "bg-thought-soft/95",
    scene: (
      <>
        {[
          { left: "12%", top: "22%" },
          { left: "30%", top: "62%" },
          { left: "58%", top: "14%" },
          { left: "82%", top: "55%" },
          { left: "92%", top: "26%" },
        ].map((s) => (
          <span
            key={s.left}
            className="absolute h-0.5 w-0.5 bg-night-dot"
            style={{ left: s.left, top: s.top }}
          />
        ))}
        <span className="absolute right-3 top-2.5"><PixelMoon size={16} /></span>
      </>
    ),
  },
];

// #57·#60 홈(허브) — 쌓인 세 서랍(책·언어·생각), 서랍마다 도메인 펭귄. 탭바 없음
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

  const counts: Record<string, string> = {
    "/library": bookCount === null ? "" : `완독 ${bookCount}권`,
    "/language": wordCount === null ? "" : `단어 ${wordCount}개`,
    "/thoughts": thoughtCount === null ? "" : `기록 ${thoughtCount}개`,
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col p-4 pb-16 md:max-w-5xl md:p-8 md:pb-16">
      <IceScene />
      <header className="mb-4 flex items-center justify-between md:mb-6">
        <div className="flex items-end gap-2.5">
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">LSHobby</h1>
          <span className="hidden md:block"><PixelMascot size={30} /></span>
        </div>
        <button onClick={() => setMenuOpen(true)} aria-label="설정" className="rounded p-2 text-faint">
          ⚙
        </button>
      </header>

      <nav className="grid min-h-0 flex-1 grid-cols-1 grid-rows-3 gap-3 md:my-auto md:max-h-[600px] md:grid-cols-3 md:grid-rows-1 md:gap-5">
        {DRAWERS.map((d, i) => (
          <Link
            key={d.href}
            href={d.href}
            className={`anim-rise pg-host relative flex flex-col items-center justify-center overflow-hidden rounded-md border ${d.card}`}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span aria-hidden="true">{d.scene}</span>
            <span className={`absolute left-4 top-0 z-[1] h-1 w-10 ${d.tab}`} aria-hidden="true" />
            <span
              className={`z-[1] flex flex-col items-center gap-2.5 rounded-lg border-2 border-white/85 px-7 py-3.5 ${d.plate}`}
            >
              <span className="pg-waddle">{d.icon}</span>
              <span className="font-display text-lg font-bold">{d.name}</span>
              <span className="min-h-4 font-mono text-xs text-ink/70">{counts[d.href]}</span>
            </span>
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

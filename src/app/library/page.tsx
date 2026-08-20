"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listBooks, type BookListItem } from "@/modules/library";
import { HomeButton } from "../ui/home-button";
import { PixelPenguinBook } from "../ui/pixel";
import { BookSheet } from "./book-sheet";

// #58 서재 = 독서 여정 책장 — 완독 20권 = 한 보(步) = 책등 하나.
// 책등을 펼치면 목차 2쪽 + 권당 속표지 1쪽(한 쪽 넘김), 자세히보기는 바텀시트.

const VOL_CAP = 20;
const PER_ROW = 5;

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

type Page =
  | { t: "toc"; half: 0 | 1 }
  | { t: "rec"; item: BookListItem; no: number }
  | { t: "empty"; next: number };

type View = { t: "shelf" } | { t: "book"; vol: number; p: number; dir: "next" | "prev" | null };

function Ornament() {
  return (
    <div className="my-4 flex items-center justify-center gap-2.5" aria-hidden="true">
      <span className="w-9 border-t border-line" />
      <span className="h-[5px] w-[5px] rotate-45 bg-lib/70" />
      <span className="w-9 border-t border-line" />
    </div>
  );
}

function ShelfBoard() {
  return (
    <>
      <div
        className="h-3.5 rounded-[3px] shadow-[0_8px_16px_rgba(34,38,43,0.25)]"
        style={{ background: "linear-gradient(#a08355, #8b6f47)" }}
      />
      <div className="mx-3 h-2 rounded-b-[4px] bg-[#7a6140]" />
    </>
  );
}

export default function LibraryJourneyPage() {
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>({ t: "shelf" });
  const [sheet, setSheet] = useState<{ item: BookListItem; no: number } | null>(null);

  const reload = () =>
    listBooks()
      .then(setBooks)
      .catch(() => setBooks([]))
      .finally(() => setLoaded(true));

  // 초기 로드 + 완독 기록 직후 딥링크(/library?open={bookId} → 해당 여정 자세히보기)
  useEffect(() => {
    listBooks()
      .then((bs) => {
        setBooks(bs);
        const id = Number(new URLSearchParams(window.location.search).get("open"));
        if (id) {
          const j = [...bs].sort((a, b) =>
            (a.firstFinishedOn ?? "9999").localeCompare(b.firstFinishedOn ?? "9999"),
          );
          const idx = j.findIndex((b) => b.id === id);
          if (idx >= 0) {
            window.history.replaceState(null, "", "/library");
            setView({ t: "book", vol: Math.floor(idx / VOL_CAP), p: (idx % VOL_CAP) + 2, dir: null });
            setSheet({ item: j[idx], no: (idx % VOL_CAP) + 1 });
          }
        }
      })
      .catch(() => setBooks([]))
      .finally(() => setLoaded(true));
  }, []);

  // 여정 순서 = 최초 완독 오름차순 (완독 기록 없는 책은 끝에)
  const journey = useMemo(
    () =>
      [...books].sort((a, b) =>
        (a.firstFinishedOn ?? "9999").localeCompare(b.firstFinishedOn ?? "9999"),
      ),
    [books],
  );
  const vols = useMemo(() => {
    const out: BookListItem[][] = [];
    for (let i = 0; i < journey.length; i += VOL_CAP) out.push(journey.slice(i, i + VOL_CAP));
    return out;
  }, [journey]);

  // ── 펼친 책 ──
  if (view.t === "book") {
    const vol = Math.min(view.vol, Math.max(0, vols.length - 1));
    const items = vols[vol] ?? [];
    const pages: Page[] = [
      { t: "toc", half: 0 },
      { t: "toc", half: 1 },
      ...items.map((item, i) => ({ t: "rec", item, no: i + 1 }) as Page),
    ];
    if (items.length < VOL_CAP) pages.push({ t: "empty", next: items.length + 1 });
    const p = Math.min(view.p, pages.length - 1);
    const dispP = view.dir === "next" ? p + 1 : view.dir === "prev" ? p - 1 : p;
    const cur = pages[dispP];
    const hasPrev = !view.dir && dispP > 0;
    const hasNext = !view.dir && dispP < pages.length - 1;

    const flip = (dir: "next" | "prev") => {
      setView({ t: "book", vol, p, dir });
      setTimeout(() => setView({ t: "book", vol, p: dir === "next" ? p + 1 : p - 1, dir: null }), 620);
    };
    const jump = (idx: number) => {
      if (!view.dir) setView({ t: "book", vol, p: idx, dir: null });
    };

    const navBtn = "inline-flex min-h-11 w-[76px] items-center justify-center rounded-lg border border-line bg-card font-mono text-xs text-lib";

    return (
      <main className="flex flex-1 flex-col p-4">
        <header className="mb-3 flex items-center gap-2">
          <button onClick={() => setView({ t: "shelf" })} className={navBtn}>← 책장</button>
          <div className="flex-1 text-center">
            <p className="font-display text-lg font-bold leading-snug">제{vol + 1}보</p>
            <p className="font-mono text-[10px] tracking-[0.08em] text-faint">
              {items.length} / {VOL_CAP}{items.length >= VOL_CAP ? " · 완결" : " · 진행중"}
            </p>
          </div>
          <button onClick={() => jump(0)} className={navBtn}>목차</button>
        </header>

        <div className="relative flex-1" style={{ perspective: "1600px" }}>
          <div className="absolute inset-0 overflow-hidden rounded-lg border border-line bg-sheet p-6 shadow-[0_10px_30px_rgba(34,38,43,0.08)]">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 w-5 rounded-l-lg"
              style={{ background: "linear-gradient(90deg, rgba(34,38,43,0.1), transparent)" }}
              aria-hidden="true"
            />
            {cur.t === "toc" && (
              <div>
                <p className="text-center font-mono text-[11px] tracking-[0.2em] text-lib">CONTENTS</p>
                <p className="mt-0.5 text-center font-display text-xl font-bold">목차</p>
                <p className="mb-3 mt-0.5 text-center font-mono text-[11px] tracking-[0.08em] text-faint">
                  여정 {cur.half === 0 ? "1–10" : "11–20"}
                </p>
                {Array.from({ length: 10 }, (_, i) => {
                  const no = cur.half * 10 + i + 1;
                  const item = items[no - 1];
                  return (
                    <button
                      key={no}
                      onClick={() => item && jump(no + 1)}
                      disabled={!item}
                      className="relative z-[1] flex w-full items-baseline gap-2 border-b border-dotted border-line px-0.5 py-2.5 text-left text-[13px] disabled:text-line"
                    >
                      <span className={`w-5 shrink-0 font-mono text-[10px] ${item ? "text-lib" : "text-line"}`}>
                        {String(no).padStart(2, "0")}
                      </span>
                      <span className="truncate font-display">{item?.title ?? ""}</span>
                      <span className="min-w-3.5 flex-1 -translate-y-[3px] border-b border-dotted border-line/80" />
                      <span className="shrink-0 font-mono text-[10px] text-faint">{item ? `p.${no}` : ""}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {cur.t === "rec" && (
              <div className="flex h-full flex-col items-center justify-center pb-4 text-center">
                <p className="font-mono text-[11px] tracking-[0.18em] text-lib">여정 {cur.no} / {VOL_CAP}</p>
                <h2 className="mt-4 max-w-[262px] font-display text-[26px] font-bold leading-snug">
                  {cur.item.title}
                </h2>
                <p className="mt-1.5 text-[13px] text-faint">{cur.item.author}</p>
                <Ornament />
                {cur.item.tags.length > 0 && (
                  <p className="font-mono text-xs text-lib">{cur.item.tags.map((t) => `#${t}`).join(" ")}</p>
                )}
                <p className="mt-3.5 font-mono text-[11px] text-faint">
                  완독 {fmtDate(cur.item.firstFinishedOn)} · {cur.item.readCount}회독
                </p>
                <button
                  onClick={() => setSheet({ item: cur.item, no: cur.no })}
                  className="relative z-[1] mt-4 inline-flex min-h-11 items-center rounded-md border border-lib px-4 text-[13px] font-medium text-lib"
                >
                  자세히보기 →
                </button>
              </div>
            )}
            {cur.t === "empty" && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-line">
                <span className="text-2xl">✳</span>
                <span className="font-mono text-xs">{cur.next}번째 여정을 기다리는 중</span>
              </div>
            )}
            <p className="absolute inset-x-0 bottom-3 text-center font-mono text-[11px] text-faint">
              {cur.t === "rec" ? `p.${cur.no}` : cur.t === "toc" ? (cur.half === 0 ? "목차 i" : "목차 ii") : ""}
            </p>
            {hasPrev && (
              <>
                <button onClick={() => flip("prev")} aria-label="이전 쪽" className="absolute bottom-16 left-0 top-0 w-16" />
                <button onClick={() => flip("prev")} aria-label="이전 쪽" className="jr-corner-l" />
              </>
            )}
            {hasNext && (
              <>
                <button onClick={() => flip("next")} aria-label="다음 쪽" className="absolute bottom-16 right-0 top-0 w-16" />
                <button onClick={() => flip("next")} aria-label="다음 쪽" className="jr-corner-r" />
              </>
            )}
          </div>
          {view.dir && (
            <div
              className={`absolute inset-0 origin-left rounded-lg border border-line bg-sheet shadow-[0_10px_30px_rgba(34,38,43,0.12)] ${
                view.dir === "next" ? "jr-flip-out" : "jr-flip-in"
              }`}
              aria-hidden="true"
            />
          )}
        </div>

        <p className="mt-2.5 text-center font-mono text-[11px] text-faint">
          {dispP + 1} / {pages.length} 쪽 · 좌우 가장자리 탭 = 넘김
        </p>

        {sheet && (
          <BookSheet
            item={sheet.item}
            journeyNo={sheet.no}
            onClose={() => setSheet(null)}
            onChanged={() => void reload()}
          />
        )}
      </main>
    );
  }

  // ── 책장 ──
  const rows: BookListItem[][][] = [];
  for (let i = 0; i < vols.length; i += PER_ROW) rows.push(vols.slice(i, i + PER_ROW));
  if (rows.length === 0) rows.push([]);
  const spineColor = (v: number) =>
    vols[v].length < VOL_CAP ? "#6b93b8" : v % 2 === 0 ? "#39536b" : "#4d7fa3";
  const spineHeight = (v: number) => 142 + ((v * 29) % 15);
  // 제(N+1)보는 N*20+1번째 기록에서 태어난다
  const nextNo = vols.length * VOL_CAP + 1;

  return (
    <main className="flex flex-1 flex-col p-4">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lib">Library</p>
          <h1 className="font-display text-2xl font-bold">서재 — 독서 여정</h1>
        </div>
        <HomeButton accent="lib" />
      </header>

      <div className="space-y-0">
        {rows.map((row, ri) => (
          <div key={ri} className={ri > 0 ? "mt-8" : ""}>
            <div className="flex min-h-[168px] items-end gap-2.5 px-1">
              {row.map((v, ci) => {
                const vi = ri * PER_ROW + ci;
                return (
                  <button
                    key={vi}
                    onClick={() => setView({ t: "book", vol: vi, p: 0, dir: null })}
                    className="jr-vol"
                    style={{ height: spineHeight(vi), background: spineColor(vi) }}
                  >
                    <span className="jr-band" aria-hidden="true" />
                    <span className="jr-vol-label">
                      제<span className="num">{vi + 1}</span>보
                    </span>
                    <span className="z-[1] flex flex-col items-center gap-1">
                      <PixelPenguinBook size={30} />
                      <span className="rounded-full bg-sheet/95 px-1.5 py-0.5 font-mono text-[9px]">
                        {v.length}/{VOL_CAP}
                      </span>
                    </span>
                  </button>
                );
              })}
              {ri === rows.length - 1 && (
                <div className="flex h-[132px] w-[62px] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line text-center">
                  <span className="font-mono text-[10px] tracking-[0.12em] text-faint [writing-mode:vertical-rl]">
                    제{vols.length + 1}보
                  </span>
                  <span className="font-mono text-[8px] leading-relaxed text-line">
                    {nextNo}번째
                    <br />
                    기록에서
                    <br />
                    태어납니다
                  </span>
                </div>
              )}
            </div>
            <ShelfBoard />
          </div>
        ))}
      </div>

      {loaded && books.length === 0 && (
        <p className="mt-8 text-center text-sm text-faint">완독한 책을 기록해 보세요 — 20권이 모이면 한 보(步)가 됩니다</p>
      )}

      <div className="flex-1" />
      <Link
        href="/library/record"
        className="mt-6 block w-full rounded-md bg-lib py-3 text-center font-medium text-white"
      >
        ＋ 완독 기록
      </Link>

      {sheet && (
        <BookSheet
          item={sheet.item}
          journeyNo={sheet.no}
          onClose={() => setSheet(null)}
          onChanged={() => void reload()}
        />
      )}
    </main>
  );
}

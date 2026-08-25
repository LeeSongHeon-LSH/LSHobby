"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  VOL_CAP,
  bookNav,
  chunkVolumes,
  listBooks,
  sortJourney,
  type BookListItem,
} from "@/modules/library";
import { HomeButton } from "../ui/home-button";
import { PixelPenguinBook } from "../ui/pixel";
import { IglooScene } from "../ui/scene";
import { BookSheet } from "./book-sheet";

// #58 서재 = 독서 여정 책장 — 완독 20권 = 한 보(步) = 책등 하나.
// 모바일: 한 쪽 넘김 / 데스크톱(md~): 양면 스프레드 (목업 데스크톱 페이지). 자세히보기는 시트.

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

type Page =
  | { t: "toc"; half: 0 | 1 }
  | { t: "rec"; item: BookListItem; no: number }
  | { t: "empty"; next: number }
  | { t: "pad" };

type View = { t: "shelf" } | { t: "book"; vol: number; p: number; dir: "next" | "prev" | null };

// md 브레이크포인트 — 스프레드/한 쪽 전환 (setState-in-effect 없이 구독으로)
const MD = "(min-width: 768px)";
const subscribeMd = (cb: () => void) => {
  const mq = window.matchMedia(MD);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getMd = () => window.matchMedia(MD).matches;

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

const pageNo = (page: Page) =>
  page.t === "rec" ? `p.${page.no}` : page.t === "toc" ? (page.half === 0 ? "목차 i" : "목차 ii") : "";

export default function LibraryJourneyPage() {
  const wide = useSyncExternalStore(subscribeMd, getMd, () => false);
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
          const j = sortJourney(bs);
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

  // 여정 순서·보 분할 규칙은 modules/library/journey.ts가 원본
  const journey = useMemo(() => sortJourney(books), [books]);
  const vols = useMemo(() => chunkVolumes(journey), [journey]);

  // ── 펼친 책 ──
  if (view.t === "book") {
    const vol = Math.min(view.vol, Math.max(0, vols.length - 1));
    const items = vols[vol] ?? [];
    const basePages: Page[] = [
      { t: "toc", half: 0 },
      { t: "toc", half: 1 },
      ...items.map((item, i) => ({ t: "rec", item, no: i + 1 }) as Page),
    ];
    if (items.length < VOL_CAP) basePages.push({ t: "empty", next: items.length + 1 });

    // 넘김 산술(±1/±2·홀수 쪽 패딩·경계)의 원본은 modules/library/journey.ts bookNav
    const step = wide ? 2 : 1;
    const p = Math.min(view.p, basePages.length - 1);
    const dispP = view.dir === "next" ? p + step : view.dir === "prev" ? p - step : p;
    const nav = bookNav(basePages.length, dispP, wide);
    const pages: Page[] = nav.total > basePages.length ? [...basePages, { t: "pad" }] : basePages;
    const base = nav.base;
    const hasPrev = !view.dir && nav.hasPrev;
    const hasNext = !view.dir && nav.hasNext;

    const flip = (dir: "next" | "prev") => {
      // 모션 축소 환경에선 애니메이션 오버레이가 정지 판이 되므로 즉시 점프
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setView({ t: "book", vol, p: dir === "next" ? p + step : p - step, dir: null });
        return;
      }
      setView({ t: "book", vol, p, dir });
    };
    // 넘김 커밋은 오버레이의 animationend에서 — CSS 시간과 JS 상수의 이중 관리 제거
    const commitFlip = () => {
      if (!view.dir) return;
      setView({ t: "book", vol, p: view.dir === "next" ? p + step : p - step, dir: null });
    };
    const jump = (idx: number) => {
      if (!view.dir) setView({ t: "book", vol, p: idx, dir: null });
    };

    const face = (page: Page | undefined) => {
      if (!page || page.t === "pad") return null;
      if (page.t === "toc")
        return (
          <div>
            <p className="text-center font-mono text-[11px] tracking-[0.2em] text-lib">CONTENTS</p>
            <p className="mt-0.5 text-center font-display text-xl font-bold">목차</p>
            <p className="mb-3 mt-0.5 text-center font-mono text-[11px] tracking-[0.08em] text-faint">
              여정 {page.half === 0 ? "1–10" : "11–20"}
            </p>
            {Array.from({ length: 10 }, (_, i) => {
              const no = page.half * 10 + i + 1;
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
        );
      if (page.t === "rec")
        return (
          <div className="flex h-full flex-col items-center justify-center pb-4 text-center">
            <p className="font-mono text-[11px] tracking-[0.18em] text-lib">여정 {page.no} / {VOL_CAP}</p>
            <h2 className="mt-4 max-w-[262px] font-display text-[26px] font-bold leading-snug md:text-2xl">
              {page.item.title}
            </h2>
            <p className="mt-1.5 text-[13px] text-faint">{page.item.author}</p>
            <Ornament />
            {page.item.tags.length > 0 && (
              <p className="font-mono text-xs text-lib">{page.item.tags.map((t) => `#${t}`).join(" ")}</p>
            )}
            <p className="mt-3.5 font-mono text-[11px] text-faint">
              {fmtDate(page.item.firstFinishedOn)} · {page.item.readCount}회독
            </p>
            <button
              onClick={() => setSheet({ item: page.item, no: page.no })}
              className="relative z-[1] mt-4 inline-flex min-h-11 items-center rounded-md border border-lib/50 bg-lib-soft px-4 text-[13px] font-medium text-lib"
            >
              자세히보기 →
            </button>
          </div>
        );
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-line">
          <span className="text-2xl">✳</span>
          <span className="font-mono text-xs">{page.next}번째 여정을 기다리는 중</span>
        </div>
      );
    };

    const navBtn =
      "inline-flex min-h-11 w-[76px] items-center justify-center rounded-lg border border-lib/40 bg-lib-soft font-mono text-xs text-lib";

    return (
      <main className="flex flex-1 flex-col p-4 md:p-6">
        <IglooScene />
        <header className="mb-3 flex items-center gap-2 md:mb-4">
          <button onClick={() => setView({ t: "shelf" })} className={navBtn}>← 책장</button>
          <div className="flex-1 text-center">
            <p className="font-display text-lg font-bold leading-snug">제{vol + 1}보</p>
            <p className="font-mono text-[10px] tracking-[0.08em] text-faint">
              {items.length} / {VOL_CAP}{items.length >= VOL_CAP ? " · 완결" : " · 진행중"}
            </p>
          </div>
          <button onClick={() => jump(0)} className={navBtn}>목차</button>
        </header>

        <div className="relative flex-1 md:mx-auto md:h-[560px] md:w-full md:flex-none" style={{ perspective: "1600px" }}>
          {wide ? (
            // ── 양면 스프레드 ──
            <div className="flex h-full">
              {[pages[base], pages[base + 1]].map((pg, side) => (
                <div
                  key={side}
                  className={`relative h-full w-1/2 overflow-hidden border border-line bg-sheet p-7 shadow-[0_10px_30px_rgba(34,38,43,0.08)] ${
                    side === 0 ? "rounded-l-lg border-r-0" : "rounded-r-lg"
                  }`}
                >
                  <span
                    className={`pointer-events-none absolute inset-y-0 w-6 ${side === 0 ? "right-0" : "left-0"}`}
                    style={{
                      background: `linear-gradient(${side === 0 ? "270deg" : "90deg"}, rgba(34,38,43,0.1), transparent)`,
                    }}
                    aria-hidden="true"
                  />
                  {face(pg)}
                  <p className="absolute inset-x-0 bottom-3 text-center font-mono text-[11px] text-faint">
                    {pg ? pageNo(pg) : ""}
                  </p>
                  {side === 0 && hasPrev && (
                    <button onClick={() => flip("prev")} aria-label="이전 펼침" className="jr-corner-l" />
                  )}
                  {side === 1 && hasNext && (
                    <button onClick={() => flip("next")} aria-label="다음 펼침" className="jr-corner-r" />
                  )}
                </div>
              ))}
              {view.dir && (
                <div
                  onAnimationEnd={commitFlip}
                  className={`absolute bottom-0 right-0 top-0 w-1/2 origin-left rounded-r-lg border border-line bg-sheet shadow-[0_10px_30px_rgba(34,38,43,0.12)] ${
                    view.dir === "next" ? "jr-flip-out" : "jr-flip-in"
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
          ) : (
            // ── 한 쪽 넘김 ──
            <>
              <div className="absolute inset-0 overflow-hidden rounded-lg border border-line bg-sheet p-6 shadow-[0_10px_30px_rgba(34,38,43,0.08)]">
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 w-5 rounded-l-lg"
                  style={{ background: "linear-gradient(90deg, rgba(34,38,43,0.1), transparent)" }}
                  aria-hidden="true"
                />
                {face(pages[dispP])}
                <p className="absolute inset-x-0 bottom-3 text-center font-mono text-[11px] text-faint">
                  {pages[dispP] ? pageNo(pages[dispP]) : ""}
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
                  onAnimationEnd={commitFlip}
                  className={`absolute inset-0 origin-left rounded-lg border border-line bg-sheet shadow-[0_10px_30px_rgba(34,38,43,0.12)] ${
                    view.dir === "next" ? "jr-flip-out" : "jr-flip-in"
                  }`}
                  aria-hidden="true"
                />
              )}
            </>
          )}
        </div>

        <p className="mt-2.5 text-center font-mono text-[11px] text-faint">
          {wide
            ? `${base / 2 + 1} / ${nav.total / 2} 펼침 · 접힌 모서리 = 넘김`
            : `${dispP + 1} / ${nav.total} 쪽 · 좌우 가장자리 탭 = 넘김`}
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
  const perRow = wide ? 10 : 5;
  const rows: BookListItem[][][] = [];
  for (let i = 0; i < vols.length; i += perRow) rows.push(vols.slice(i, i + perRow));
  if (rows.length === 0) rows.push([]);
  const spineColor = (v: number) =>
    vols[v].length < VOL_CAP ? "#6b93b8" : v % 2 === 0 ? "#39536b" : "#4d7fa3";
  const spineHeight = (v: number) => 142 + ((v * 29) % 15);
  return (
    <main className="flex flex-1 flex-col p-4 md:p-6">
      <IglooScene />
      <header className="mb-5 flex items-start justify-between gap-3 md:mb-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lib">Library</p>
          <h1 className="font-display text-2xl font-bold">서재 — 독서 여정</h1>
        </div>
        <HomeButton accent="lib" />
      </header>

      {!loaded ? (
        <div className="md:mx-auto md:w-full md:max-w-[740px]">
          <div className="flex min-h-[168px] items-end gap-2.5 px-1">
            {[152, 144, 148].map((h, i) => (
              <div key={i} className="w-[62px] animate-pulse rounded-md bg-line/60" style={{ height: h }} />
            ))}
          </div>
          <ShelfBoard />
        </div>
      ) : (
      <div className="space-y-0 md:mx-auto md:w-full md:max-w-[740px]">
        {rows.map((row, ri) => (
          <div key={ri} className={ri > 0 ? "mt-8" : ""}>
            <div className="flex min-h-[168px] items-end gap-2.5 px-1">
              {row.map((v, ci) => {
                const vi = ri * perRow + ci;
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
                <div className="flex h-[132px] w-[62px] flex-col items-center justify-center rounded-md border-2 border-dashed border-line text-center">
                  <span className="font-mono text-[10px] tracking-[0.12em] text-faint [writing-mode:vertical-rl]">
                    제{vols.length + 1}보
                  </span>
                </div>
              )}
            </div>
            <ShelfBoard />
          </div>
        ))}
      </div>
      )}

      {loaded && books.length === 0 && (
        <p className="mt-8 text-center text-sm text-faint">완독한 책을 기록해 보세요 — 20권이 모이면 한 보(步)가 됩니다</p>
      )}

      <div className="flex-1" />
      <Link
        href="/library/record"
        className="mt-6 block w-full rounded-md bg-lib py-3 text-center font-medium text-white md:mx-auto md:w-72"
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

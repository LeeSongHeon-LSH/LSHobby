import { supabase } from "../shared/auth";
import type { LanguageConfig } from "./types";

export interface WordStat {
  reviews: number;
  correct: number;
  /** 최초 복습 시각 — "오늘 신규 시작" 판정용 (퀴즈의 로컬 갱신 객체엔 없음) */
  firstReviewedAt?: string | null;
}

/** PostgREST max_rows (supabase/config.toml:18) */
const PAGE = 1000;

/**
 * 단어별 복습 횟수·정답 수 — review_log 파생 (결정 #36), 집계는 DB RPC.
 * rating≥2 = 정답(Good) 판정은 RPC 안에 동일하게 산다.
 *
 * max_rows는 집합 반환 함수에도 걸리므로 RPC로 옮겨도 상한은 그대로다 — 단어별 행은
 * 전부 필요하니 페이지로 끝까지 읽는다(scripts의 selectAll과 같은 모양).
 * `*_word_stats`에는 order by가 없어 페이지 경계가 흔들리므로 word_id로 먼저 고정한다.
 */
export async function reviewStats(config: LanguageConfig): Promise<Map<number, WordStat>> {
  const out = new Map<number, WordStat>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .rpc(config.wordStatsFn)
      .order("word_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const r of data) {
      out.set(r.word_id, { reviews: r.reviews, correct: r.correct, firstReviewedAt: r.first_reviewed_at });
    }
    if (data.length < PAGE) return out;
  }
}

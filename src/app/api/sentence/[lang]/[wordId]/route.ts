import { NextRequest, NextResponse } from "next/server";
import { serverClientWithToken } from "@/modules/shared/auth";
import { configFor } from "@/modules/language";
import { fetchFromTatoeba } from "@/modules/language/tatoeba";

// 예문 확보 API (구 /api/sentence/<word> 이식) — 캐시 우선, 미수집이면 Tatoeba 수집 후 저장.
// 호출자 JWT로 DB에 접근하므로 RLS가 그대로 적용된다 (service_role 미사용).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ lang: string; wordId: string }> },
) {
  const { lang, wordId } = await params;
  const config = configFor(lang);
  const id = Number(wordId);
  if (!config || !Number.isInteger(id)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = serverClientWithToken(token);

  const { data: fetched, error: fErr } = await db
    .from(config.sentenceFetchTable)
    .select("word_id")
    .eq("word_id", id)
    .maybeSingle();
  if (fErr) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!fetched) {
    const { data: word, error: wErr } = await db
      .from(config.wordTable)
      .select("word")
      .eq("id", id)
      .maybeSingle();
    if (wErr || !word) return NextResponse.json({ error: "not found" }, { status: 404 });

    const drafts = await fetchFromTatoeba(word.word, config.tatoebaLang, config.transLangs);
    if (drafts.length > 0) {
      const { error } = await db
        .from(config.sentenceTable)
        .insert(drafts.map((d) => ({ ...d, word_id: id })));
      if (error) return NextResponse.json({ error: "db error" }, { status: 500 });
    }
    // 빈 결과도 기록해 재시도 방지 (구 ensure_sentences)
    const { error: markErr } = await db.from(config.sentenceFetchTable).insert({ word_id: id });
    if (markErr) return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  const { data } = await db.from(config.sentenceTable).select("*").eq("word_id", id);
  return NextResponse.json(data ?? []);
}

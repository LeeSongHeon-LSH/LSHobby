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
  // 토큰 문제(PGRST30x — 만료·서명 불량)만 401. 그 외 DB 오류를 401로 덮으면 클라이언트는
  // 조용히 []로 넘어가고 원인은 어디에도 안 남는다
  if (fErr) {
    const unauthorized = fErr.code?.startsWith("PGRST30");
    return NextResponse.json(
      { error: unauthorized ? "unauthorized" : "db error" },
      { status: unauthorized ? 401 : 500 },
    );
  }

  if (!fetched) {
    const { data: word, error: wErr } = await db
      .from(config.wordTable)
      .select("word")
      .eq("id", id)
      .maybeSingle();
    if (wErr || !word) return NextResponse.json({ error: "not found" }, { status: 404 });

    const { drafts, complete } = await fetchFromTatoeba(word.word, config.tatoebaLang, config.transLangs);
    // Tatoeba가 답하지 않았으면 아무것도 남기지 않는다 — 마커를 찍으면 일시적 장애 한 번으로
    // 그 단어의 예문이 영구히 비고 cloze가 안 나온다. 저장도 같이 미룬다(마커 없이 넣으면
    // 다음 호출이 같은 문장을 또 넣는다 — 유일 키가 없다). 다음 호출에서 다시 묻는다 (#94)
    if (complete) {
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
  }

  const { data, error } = await db.from(config.sentenceTable).select("*").eq("word_id", id);
  // 실패를 []로 바꾸면 예문 있는 단어가 "없음"으로 보인다 — 200 대신 500으로 말한다
  if (error) return NextResponse.json({ error: "db error" }, { status: 500 });
  return NextResponse.json(data);
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard, supabase } from "@/modules/shared/auth";
import { getCv, saveCv } from "@/modules/cv";
import { HomeButton } from "../../ui/home-button";
import { IceScene } from "../../ui/scene";

// §17.5 CV 편집 — textarea + 저장, 저장 후 /cv로 확인 (#52). 홈 복귀는 우상단 버튼 (#59)
function CvEdit() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCv()
      .then((cv) => setContent(cv?.content ?? ""))
      .finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await saveCv(content);
      // 정적 공개 페이지 캐시 무효화 — "수정 즉시 반영" 유지 (#51 개정, 성능 리뷰 P2)
      const { data } = await supabase.auth.getSession();
      await fetch("/api/revalidate-cv", {
        method: "POST",
        headers: { authorization: `Bearer ${data.session?.access_token ?? ""}` },
      }).catch(() => {});
      router.replace("/cv");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <main className="p-4" />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-1 flex-col p-4">
      <IceScene />
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cv">CV</p>
          <h1 className="font-display text-2xl font-bold">CV 수정</h1>
        </div>
        <HomeButton accent="cv" />
      </header>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={(e) => setContent(e.target.value)}
        placeholder="CV 전문 마크다운 — 이름·이메일·학위 등 기본 정보 포함 (§17.1)"
        className="w-full flex-1 rounded-md border border-line bg-card px-3 py-2 font-mono text-sm"
      />
      <button
        onClick={save}
        disabled={busy}
        className="mt-3 w-full rounded-md bg-cv py-3 font-medium text-white disabled:opacity-40"
      >
        저장
      </button>
      <p className="mt-2.5 text-center font-mono text-[11px] text-faint">
        저장하면 공개 페이지에 바로 반영됩니다
      </p>
    </main>
  );
}

export default function CvEditPage() {
  return (
    <AuthGuard>
      <CvEdit />
    </AuthGuard>
  );
}

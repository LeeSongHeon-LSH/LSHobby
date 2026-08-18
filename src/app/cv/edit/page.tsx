"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/modules/shared/auth";
import { getCv, saveCv } from "@/modules/cv";

// §17.5 CV 편집 — CS 편집 패턴 재사용(textarea + 저장), 저장 후 /cv로 확인 (#52)
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
      router.replace("/cv");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <main className="p-4" />;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm text-faint">← 취소</button>
        <button
          onClick={save}
          disabled={busy}
          className="rounded-md bg-cv px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          저장
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={24}
        placeholder="CV 전문 마크다운 — 이름·이메일·학위 등 기본 정보 포함 (§17.1)"
        className="w-full rounded-md border border-line bg-card px-3 py-2 font-mono text-sm"
      />
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

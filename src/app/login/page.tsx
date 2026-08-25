"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/modules/shared/auth";
import { PixelMascot } from "../ui/pixel";
import { IceScene } from "../ui/scene";

// §11.2 — 이메일 로그인. 회원가입·비밀번호 찾기 UI 없음 (SEC-01·SEC-08)
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    if (err) {
      setError("로그인에 실패했습니다");
      setBusy(false);
    } else {
      router.replace("/home");
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <IceScene />
      <form onSubmit={submit} className="w-full max-w-xs space-y-4">
        <div className="flex justify-center">
          <PixelMascot size={48} />
        </div>
        <h1 className="text-center font-display text-3xl font-bold tracking-tight">LSHobby</h1>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="w-full rounded-md border border-line bg-card px-4 py-3"
          autoComplete="email"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-full rounded-md border border-line bg-card px-4 py-3"
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-ink py-3 font-medium text-white disabled:opacity-50"
        >
          로그인
        </button>
        {error && <p className="text-center text-sm text-err">{error}</p>}
      </form>
    </main>
  );
}

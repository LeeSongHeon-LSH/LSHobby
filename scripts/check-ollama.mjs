// Ollama 연결 점검 — 로컬 LLM이 앱·배치 양쪽에서 실제로 닿는지 확인 (2026-08-24 tailnet 전환)
// 실행: node --env-file=.env scripts/check-ollama.mjs
//
// 왜 vitest가 아닌가: 검사 대상이 코드가 아니라 이 PC의 인프라(systemd 드롭인·tailscale serve·.env)다.
// npm test는 다른 환경에서도 돌아야 하므로, 네트워크·환경 의존 점검은 별도 스크립트로 뺐다.
//
// 배경: Ollama를 tailscale IP에만 바인딩(OLLAMA_HOST)하면서 loopback이 끊겼다.
// .env의 OLLAMA_URL이 없으면 코드 기본값 http://localhost:11434로 조용히 떨어져 배치가 실패한다.

const DEAD_DEFAULT = "http://localhost:11434";
const DIGEST_MODEL = process.env.DIGEST_MODEL ?? "exaone3.5:7.8b";
const PHILOSOPHY_MODEL =
  process.env.NEXT_PUBLIC_PHILOSOPHY_MODEL ??
  "hf.co/mradermacher/Llama3-stanford-encyclopedia-philosophy-QA-GGUF:Q4_K_M";
const CORS_ORIGINS = ["http://localhost:3000", "https://lshobby.vercel.app"];
const TIMEOUT = 10000;

const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ ok: true, name, detail });
  } catch (e) {
    results.push({ ok: false, name, detail: e.message });
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const get = (url, init) => fetch(url, { signal: AbortSignal.timeout(TIMEOUT), ...init });

const batchUrl = process.env.OLLAMA_URL;
const appUrl = process.env.NEXT_PUBLIC_OLLAMA_URL;

// 1) 설정 — 없으면 죽은 기본값으로 떨어진다 (이번 전환이 만든 무증상 실패 모드)
await check("설정: OLLAMA_URL (배치용)", async () => {
  assert(batchUrl, "OLLAMA_URL이 .env에 없습니다 — 배치가 localhost로 떨어져 실패합니다");
  assert(batchUrl !== DEAD_DEFAULT, `${DEAD_DEFAULT}는 더 이상 리스닝하지 않습니다`);
  return batchUrl;
});
await check("설정: NEXT_PUBLIC_OLLAMA_URL (앱용)", async () => {
  assert(appUrl, "NEXT_PUBLIC_OLLAMA_URL이 .env에 없습니다 — 브라우저에서 요약·문답이 실패합니다");
  assert(appUrl !== DEAD_DEFAULT, `${DEAD_DEFAULT}는 더 이상 리스닝하지 않습니다`);
  assert(appUrl.startsWith("https://"), "앱은 HTTPS 페이지에서 호출하므로 http면 혼합 콘텐츠로 차단됩니다");
  return appUrl;
});

// 2) 도달성 — 배치 경로(직결)와 앱 경로(tailscale serve 경유)를 따로 본다
let installed = null; // null = 도달 실패로 목록을 못 받음
await check("도달: 배치 경로 → /api/tags", async () => {
  assert(batchUrl, "설정 없음 — 건너뜀");
  const res = await get(`${batchUrl}/api/tags`);
  assert(res.ok, `HTTP ${res.status}`);
  installed = (await res.json()).models.map((m) => m.name);
  return `모델 ${installed.length}개`;
});
await check("도달: 앱 경로(serve 경유) → /api/tags", async () => {
  assert(appUrl, "설정 없음 — 건너뜀");
  const res = await get(`${appUrl}/api/tags`);
  assert(res.ok, `HTTP ${res.status} — 403이면 Ollama의 Host 검사(OLLAMA_HOST 확인)`);
  return "200";
});

// 3) 모델 — 있어야 배치·문답이 실제로 돈다
for (const [label, model] of [["다이제스트", DIGEST_MODEL], ["철학 정보", PHILOSOPHY_MODEL]]) {
  await check(`모델: ${label}`, async () => {
    assert(installed, "배치 경로 도달 실패로 확인 불가 — 위 항목을 먼저 보세요");
    assert(installed.includes(model), `설치되지 않음 — ollama pull ${model}`);
    return "설치됨";
  });
}

// 4) CORS — 브라우저에서 부르므로 페이지 출처가 허용돼야 한다
for (const origin of CORS_ORIGINS) {
  await check(`CORS: ${origin}`, async () => {
    assert(appUrl, "설정 없음 — 건너뜀");
    const res = await get(`${appUrl}/api/generate`, {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
    });
    assert(res.headers.get("access-control-allow-origin"), `허용되지 않음 (HTTP ${res.status}) — OLLAMA_ORIGINS 확인`);
    return "허용";
  });
}

// 5) 격리 — tailnet 밖(loopback·LAN)에서는 닿으면 안 된다. Ollama에는 인증이 없다.
const { networkInterfaces } = await import("node:os");
const outside = ["127.0.0.1"];
for (const addrs of Object.values(networkInterfaces())) {
  for (const a of addrs ?? []) {
    if (a.family === "IPv4" && !a.internal && !a.address.startsWith("100.")) outside.push(a.address);
  }
}
for (const ip of outside) {
  await check(`격리: ${ip}:11434 차단`, async () => {
    let reachable = false;
    try {
      reachable = (await fetch(`http://${ip}:11434/api/tags`, { signal: AbortSignal.timeout(3000) })).ok;
    } catch {
      return "닿지 않음 (정상)";
    }
    assert(!reachable, "인증 없는 Ollama가 노출됐습니다 — OLLAMA_HOST가 0.0.0.0인지 확인");
    return "닿지 않음 (정상)";
  });
}

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name} — ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} 통과`);
process.exit(failed ? 1 : 0);

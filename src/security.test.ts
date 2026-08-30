import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

const ROOT = process.cwd();

/** src/ 아래 소스 파일 전체 (테스트 파일 제외) */
const srcFiles = (() => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(p);
    }
  };
  walk(join(ROOT, "src"));
  return out;
})();

describe("키 관리 (SEC-03)", () => {
  it(".env 파일은 gitignore 대상이다", () => {
    const gitignore = readFileSync(join(ROOT, ".gitignore"), "utf8");
    expect(gitignore).toContain(".env");
  });

  it("클라이언트 코드(src)에서 service_role 키를 참조하지 않는다", () => {
    const offenders = srcFiles.filter((f) => /SERVICE_ROLE/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("src에 하드코딩된 JWT형 시크릿이 없다", () => {
    const offenders = srcFiles.filter((f) =>
      /eyJ[A-Za-z0-9_-]{60,}/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

describe("가입 차단 (FR-01·SEC-01 — 회원가입 UI 없음)", () => {
  it("src 어디에도 signUp 호출이 없다", () => {
    const offenders = srcFiles.filter((f) => /signUp/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("최소 보안 헤더 (SEC-06 · 결정 #56·#72)", () => {
  it("전 경로에 nosniff·Referrer-Policy·X-Frame-Options가 걸린다", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/(.*)");
    expect(all).toBeDefined();
    expect(all!.headers).toContainEqual({ key: "X-Content-Type-Options", value: "nosniff" });
    expect(all!.headers).toContainEqual({
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    });
    expect(all!.headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
  });
});

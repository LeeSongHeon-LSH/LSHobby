import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

/** 마크다운 렌더 (책 노트 §7.1 · CS 본문 §8.1 공용) — sanitize는 SEC-05 */
export function Markdown({
  children,
  components,
}: {
  children: string;
  /** 요소 렌더 오버라이드 — CS의 위키링크 스타일링 등 */
  components?: Components;
}) {
  return (
    <div className="prose-sm max-w-none space-y-2 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-paper [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-4 [&_li]:list-disc [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-paper [&_pre]:p-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

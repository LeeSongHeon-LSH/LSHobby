import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

/** 마크다운 렌더 (책 노트 §7.1 · CS 본문 §8.1 공용) — sanitize는 SEC-05 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-sm max-w-none space-y-2 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-100 [&_pre]:p-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

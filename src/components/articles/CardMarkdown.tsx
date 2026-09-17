/* Módulo Editorial — markdown enriquecido dos artigos. Antes de passar pro react-markdown,
 * converte a sintaxe custom [[GD01-001]] / [[Nome da Carta]] num link markdown de esquema
 * próprio (card://) que o renderer de <a> intercepta e troca por CardHoverLink. */
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { CardHoverLink } from "@/components/articles/CardHoverLink";

const CARD_REF_PATTERN = /\[\[([^[\]]+)\]\]/g;
const CARD_SCHEME = "card://";

export function injectCardLinks(markdown: string): string {
  return markdown.replace(CARD_REF_PATTERN, (_match, inner: string) => `[${inner}](${CARD_SCHEME}${encodeURIComponent(inner.trim())})`);
}

const components: Components = {
  a({ href, children, ...props }) {
    if (href?.startsWith(CARD_SCHEME)) {
      const query = decodeURIComponent(href.slice(CARD_SCHEME.length));
      const label = typeof children === "string" ? children : query;
      return <CardHoverLink query={query} label={label} />;
    }
    return (
      <a href={href} target="_blank" rel="noreferrer" className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary" {...props}>
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    return <img src={src} alt={alt || ""} className="my-4 w-full border border-white/10 object-cover" loading="lazy" />;
  },
  h1: ({ children }) => <h2 className="mt-8 font-heading text-3xl uppercase tracking-wide text-white first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="mt-7 font-heading text-2xl uppercase tracking-wide text-white">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-6 font-heading text-xl uppercase tracking-wide text-white">{children}</h4>,
  p: ({ children }) => <p className="mt-4 text-sm leading-7 text-slate-300 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-7 text-slate-300">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm leading-7 text-slate-300">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="mt-4 border-l-2 border-primary/50 bg-white/[0.03] py-2 pl-4 text-sm italic text-slate-400">{children}</blockquote>,
  code: ({ children }) => <code className="rounded-none border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[0.85em] text-accent">{children}</code>,
  hr: () => <hr className="my-8 border-white/10" />,
  table: ({ children }) => <div className="mt-4 overflow-x-auto"><table className="w-full border border-white/10 text-sm">{children}</table></div>,
  th: ({ children }) => <th className="border border-white/10 bg-white/5 px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-300">{children}</th>,
  td: ({ children }) => <td className="border border-white/10 px-3 py-2 text-slate-300">{children}</td>,
};

export function CardMarkdown({ content }: { content: string }) {
  return (
    <div className="max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {injectCardLinks(content)}
      </ReactMarkdown>
    </div>
  );
}

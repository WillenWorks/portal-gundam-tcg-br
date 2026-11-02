import { Link } from "wouter";

/** Selos de hashtag do artigo: cada um abre a página de artigos já filtrada. */
export function PostTagLinks({ tags, tabIndex }: { tags?: string[] | null; tabIndex?: number }) {
  if (!tags?.length) return null;
  return (
    <>
      {tags.map((tag) => (
        <Link
          key={tag}
          href={`/articles?tag=${encodeURIComponent(tag)}`}
          tabIndex={tabIndex}
          className="rounded-xs border border-white/20 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-200 transition hover:border-primary/60 hover:text-primary light:border-slate-300 light:text-slate-700"
        >
          #{tag}
        </Link>
      ))}
    </>
  );
}

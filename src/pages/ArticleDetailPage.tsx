/* Módulo Editorial (Content Hub) v1 — leitor público de um artigo (GET /api/posts/slug/:slug).
 * Markdown renderizado via CardMarkdown (hovercard em [[GD01-001]] / [[Nome da Carta]]). */
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { PlayCircle } from "lucide-react";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CardMarkdown } from "@/components/articles/CardMarkdown";
import { api, type ApiPost, type PostType } from "@/lib/api";

const POST_TYPE_LABEL: Record<PostType, string> = {
  NEWS: "Notícia",
  PREVIEW: "Preview",
  REVIEW: "Análise",
  GUIDE: "Guia",
};

function toYoutubeEmbed(url: string) {
  const match = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export default function ArticleDetailPage() {
  const [, params] = useRoute<{ slug: string }>("/articles/:slug");
  const [post, setPost] = useState<ApiPost | null | undefined>(undefined);

  useEffect(() => {
    if (!params?.slug) return;
    api.getPostBySlug(params.slug).then(setPost).catch(() => setPost(null));
  }, [params?.slug]);

  const publishedAt = post?.publishedAt ? new Date(post.publishedAt) : null;
  const embedUrl = post?.youtubeUrl ? toYoutubeEmbed(post.youtubeUrl) : null;

  return (
    <PublicShell breadcrumbs={[{ label: "Artigos", href: "/articles" }, { label: post?.title || params?.slug || "Artigo" }]}>
      <div className="mx-auto max-w-4xl space-y-6">
        {post === null ? (
          <Card className="panel-cut rounded-none border-primary/30 hero-surface">
            <CardContent className="p-6">
              <p className="text-sm text-red-300">Artigo não encontrado.</p>
            </CardContent>
          </Card>
        ) : !post ? (
          <p className="text-sm text-slate-300">Carregando artigo...</p>
        ) : (
          <>
            {post.coverImage ? (
              <div className="overflow-hidden border border-white/10 bg-slate-950/60 aspect-[21/9]">
                <img src={post.coverImage} alt={post.title} className="h-full w-full object-cover" />
              </div>
            ) : null}

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{POST_TYPE_LABEL[post.postType]}</Badge>
                {publishedAt ? (
                  <Badge variant="outline" className="rounded-none border-white/15 bg-white/5 text-slate-300">{publishedAt.toLocaleDateString("pt-BR")}</Badge>
                ) : null}
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Por {post.author?.displayName || "Anaheim Hub"}</span>
              </div>
              <h1 className="mt-3 font-heading text-4xl uppercase leading-tight text-white sm:text-5xl">{post.title}</h1>
              {post.excerpt ? <p className="mt-4 text-base leading-8 text-slate-300">{post.excerpt}</p> : null}
            </div>

            {embedUrl ? (
              <div className="overflow-hidden border border-white/10 bg-black aspect-video">
                <iframe src={embedUrl} title={post.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            ) : post.youtubeUrl ? (
              <a href={post.youtubeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft">
                <PlayCircle className="size-4" />Assistir no YouTube
              </a>
            ) : null}

            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6 sm:p-8">
                <CardMarkdown content={post.contentMd} />
              </CardContent>
            </Card>

            <div>
              <Link href="/articles" className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft">
                Voltar para Artigos
              </Link>
            </div>
          </>
        )}
      </div>
    </PublicShell>
  );
}

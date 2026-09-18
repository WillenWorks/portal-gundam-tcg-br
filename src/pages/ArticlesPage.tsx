/* Módulo Editorial (Content Hub) v1 — vitrine pública de artigos publicados (model Post,
 * status=PUBLISHED). Mesmo esqueleto de CollectionsPage (capa 16:8 + badges + CTA). */
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ParallaxHeroBanner } from "@/components/catalog/ParallaxHeroBanner";
import { api, type ApiPost, type PostType } from "@/lib/api";

const POST_TYPE_LABEL: Record<PostType, string> = {
  NEWS: "Notícia",
  PREVIEW: "Preview",
  REVIEW: "Análise",
  GUIDE: "Guia",
};

const PAGE_SIZE = 9;

export default function ArticlesPage() {
  const [location] = useLocation();
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(() => Number(new URLSearchParams(window.location.search).get("page")) || 1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.listPostsPage("PUBLISHED", { page, pageSize: PAGE_SIZE })
      .then((result) => {
        setPosts(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      })
      .catch(() => {
        setPosts([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [page, location]);

  return (
    <PublicShell
      breadcrumbs={[{ label: "Artigos" }]}
      heroBanner={
        <ParallaxHeroBanner
          image="/images/gundam_hangar_deploy_banner.png"
          eyebrow="Content Hub"
          title="Artigos"
          badge={`${total} artigos publicados`}
        />
      }
    >
      <div className="space-y-6">
        {loading ? (
          <p className="text-sm text-slate-400">Carregando artigos...</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum artigo publicado ainda.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => {
              const publishedAt = post.publishedAt ? new Date(post.publishedAt) : null;
              return (
                <Card key={post.id} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
                  <CardContent className="space-y-4 p-4">
                    <div className="overflow-hidden border border-white/10 bg-slate-950/60 aspect-[16/9] dark:bg-slate-950/60 light:bg-slate-100">
                      {post.coverImage ? (
                        <img src={post.coverImage} alt={post.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-4">
                          <span className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Sem capa</span>
                          <span className="font-heading text-xl uppercase text-slate-300">{POST_TYPE_LABEL[post.postType]}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{POST_TYPE_LABEL[post.postType]}</Badge>
                      {publishedAt ? (
                        <Badge variant="outline" className="rounded-none border-white/15 bg-white/5 text-slate-300 dark:text-slate-300 light:text-slate-700">{publishedAt.toLocaleDateString("pt-BR")}</Badge>
                      ) : null}
                    </div>

                    <h3 className="line-clamp-2 font-heading text-2xl uppercase leading-tight">{post.title}</h3>
                    <p className="line-clamp-3 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
                      {post.excerpt || "Sem resumo cadastrado."}
                    </p>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Por {post.author?.displayName || "Anaheim Hub"}</p>

                    <Link href={`/articles/${post.slug}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">
                      Ler artigo
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 light:border-slate-300/60">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Página {page} de {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-none border-white/20 light:border-slate-400/90" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
              <Button variant="outline" size="sm" className="rounded-none border-white/20 light:border-slate-400/90" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Próxima</Button>
            </div>
          </div>
        ) : null}
      </div>
    </PublicShell>
  );
}

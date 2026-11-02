/* Módulo Editorial (Content Hub) v1 — vitrine pública de artigos publicados (model Post,
 * status=PUBLISHED). Os filtros ficam no endereço: dá para compartilhar e o voltar do navegador funciona. */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";

import { ArticleImageFrame } from "@/components/articles/ArticleImageFrame";
import { PostTagLinks } from "@/components/articles/PostTagLinks";
import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ParallaxHeroBanner } from "@/components/catalog/ParallaxHeroBanner";
import { api, type ApiPost, type PostListSort, type PostType } from "@/lib/api";
import { cn } from "@/lib/utils";

const POST_TYPE_LABEL: Record<PostType, string> = {
  NEWS: "Notícia",
  PREVIEW: "Preview",
  REVIEW: "Análise",
  GUIDE: "Guia",
};

const SORT_LABEL: Record<PostListSort, string> = {
  recent: "Mais recentes",
  oldest: "Mais antigos",
  popular: "Mais curtidos",
};

const PAGE_SIZE = 9;
const SEARCH_DEBOUNCE_MS = 300;
const SELECT_CLASS = "h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white light:border-slate-300/80 light:bg-white light:text-slate-900";

type ArticleFilters = {
  q: string;
  type?: PostType;
  tag: string;
  sort: PostListSort;
  page: number;
};

function parseFilters(search: string): ArticleFilters {
  const params = new URLSearchParams(search);
  const type = params.get("type");
  const sort = params.get("sort");
  return {
    q: params.get("q") ?? "",
    type: type && type in POST_TYPE_LABEL ? (type as PostType) : undefined,
    tag: params.get("tag") ?? "",
    sort: sort && sort in SORT_LABEL ? (sort as PostListSort) : "recent",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

function articlesLabel(total: number, hasFilters: boolean) {
  const noun = total === 1 ? "artigo" : "artigos";
  if (hasFilters) return `${total} ${noun} ${total === 1 ? "encontrado" : "encontrados"}`;
  return `${total} ${noun} ${total === 1 ? "publicado" : "publicados"}`;
}

export default function ArticlesPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const filters = useMemo(() => parseFilters(search), [search]);
  const hasFilters = Boolean(filters.q || filters.type || filters.tag);

  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [searchText, setSearchText] = useState(filters.q);

  // qualquer mudança de filtro volta para a primeira página
  const updateFilters = (changes: Partial<ArticleFilters>, options?: { replace?: boolean }) => {
    const next = { ...filters, page: 1, ...changes };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.type) params.set("type", next.type);
    if (next.tag) params.set("tag", next.tag);
    if (next.sort !== "recent") params.set("sort", next.sort);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    navigate(`/articles${query ? `?${query}` : ""}`, { replace: options?.replace });
  };

  useEffect(() => {
    api.listPostTags().then((result) => setTags(result ?? [])).catch(() => setTags([]));
  }, []);

  // o endereço manda: voltar no navegador ou limpar os filtros atualiza o campo de busca
  useEffect(() => setSearchText(filters.q), [filters.q]);

  useEffect(() => {
    const text = searchText.trim();
    if (text === filters.q) return;
    const timer = setTimeout(() => updateFilters({ q: text }, { replace: true }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só o texto digitado dispara a busca
  }, [searchText]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    api.listPostsPage("PUBLISHED", { page: filters.page, pageSize: PAGE_SIZE }, {
      q: filters.q || undefined,
      type: filters.type,
      tag: filters.tag || undefined,
      sort: filters.sort === "recent" ? undefined : filters.sort,
    })
      .then((result) => {
        if (!active) return;
        setPosts(result?.items ?? []);
        setTotal(result?.total ?? 0);
        setTotalPages(result?.totalPages ?? 1);
      })
      .catch(() => {
        if (!active) return;
        setPosts([]);
        setTotal(0);
        setTotalPages(1);
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters]);

  const goToPage = (next: number) => {
    updateFilters({ page: Math.min(Math.max(1, next), totalPages) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const tagOptions = filters.tag && !tags.some((item) => item.tag === filters.tag) ? [...tags, { tag: filters.tag, count: 0 }] : tags;

  return (
    <PublicShell ad
      breadcrumbs={[{ label: "Artigos" }]}
      heroBanner={
        <ParallaxHeroBanner
          image="/images/gundam_hangar_deploy_banner.webp"
          eyebrow="Content Hub"
          title="Artigos"
          badge={articlesLabel(total, hasFilters)}
        />
      }
    >
      <div className="space-y-6">
        <div className="space-y-3 border-b border-white/10 pb-4 light:border-slate-300/60">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar por título ou resumo"
              aria-label="Buscar artigos"
              className="h-10 rounded-none sm:flex-1"
            />
            <select aria-label="Tipo de artigo" value={filters.type ?? ""} onChange={(event) => updateFilters({ type: (event.target.value || undefined) as PostType | undefined })} className={SELECT_CLASS}>
              <option value="">Todos os tipos</option>
              {(Object.keys(POST_TYPE_LABEL) as PostType[]).map((type) => (
                <option key={type} value={type}>{POST_TYPE_LABEL[type]}</option>
              ))}
            </select>
            <select aria-label="Ordenar artigos" value={filters.sort} onChange={(event) => updateFilters({ sort: event.target.value as PostListSort })} className={SELECT_CLASS}>
              {(Object.keys(SORT_LABEL) as PostListSort[]).map((sort) => (
                <option key={sort} value={sort}>{SORT_LABEL[sort]}</option>
              ))}
            </select>
          </div>
          {tagOptions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {tagOptions.map(({ tag, count }) => {
                const active = filters.tag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateFilters({ tag: active ? "" : tag })}
                    className={cn(
                      "rounded-xs border px-2.5 py-1 font-mono text-xs transition",
                      active ? "border-primary bg-primary/20 text-primary" : "border-white/15 bg-white/5 text-slate-300 hover:border-primary/60 hover:text-primary light:border-slate-300 light:text-slate-700",
                    )}
                  >
                    #{tag}{count ? <span className="ml-1.5 text-slate-500">{count}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Carregando artigos...</p>
        ) : failed ? (
          <p className="text-sm text-slate-400">Não foi possível carregar os artigos agora. Tente de novo em instantes.</p>
        ) : posts.length === 0 ? (
          hasFilters ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Nenhum artigo com esses filtros.</p>
              <Button variant="outline" size="sm" className="rounded-none border-white/20 light:border-slate-400/90" onClick={() => updateFilters({ q: "", type: undefined, tag: "" })}>Limpar filtros</Button>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Nenhum artigo publicado ainda.</p>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => {
              const publishedAt = post.publishedAt ? new Date(post.publishedAt) : null;
              return (
                <Card key={post.id} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
                  <CardContent className="space-y-4 p-4">
                    {post.coverImage ? (
                      <ArticleImageFrame src={post.coverImage} className="aspect-[16/9] border border-white/10" />
                    ) : (
                      <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 border border-white/10 bg-slate-950/60 px-4 text-center dark:bg-slate-950/60 light:bg-slate-100">
                        <span className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Sem capa</span>
                        <span className="font-heading text-xl uppercase text-slate-300">{POST_TYPE_LABEL[post.postType]}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{POST_TYPE_LABEL[post.postType]}</Badge>
                      <PostTagLinks tags={post.tags} />
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
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Página {filters.page} de {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-none border-white/20 light:border-slate-400/90" disabled={filters.page <= 1} onClick={() => goToPage(filters.page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" className="rounded-none border-white/20 light:border-slate-400/90" disabled={filters.page >= totalPages} onClick={() => goToPage(filters.page + 1)}>Próxima</Button>
            </div>
          </div>
        ) : null}
      </div>
    </PublicShell>
  );
}

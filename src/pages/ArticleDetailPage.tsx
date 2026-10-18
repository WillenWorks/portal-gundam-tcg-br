/* Módulo Editorial (Content Hub) — leitor público de um artigo (GET /api/posts/slug/:slug).
 * Integração social completa: Curtidas, Compartilhamento, Discussão Tática / Comentários em Árvore
 * (respostas aninhadas), Moderação pelo autor ou equipe administrativa (ADMIN/EDITOR).
 * Markdown renderizado via CardMarkdown (hovercard em [[GD01-001]] / [[Nome da Carta]]). */
import { useEffect, useState, useCallback } from "react";
import { Link, useRoute } from "wouter";
import {
  PlayCircle,
  Heart,
  MessageSquare,
  Share2,
  Reply,
  Trash2,
  ShieldAlert,
  Send,
  Copy,
  Check,
  Sparkles,
  ArrowLeft,
  MessageCircle,
  ExternalLink,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CardMarkdown } from "@/components/articles/CardMarkdown";
import { useAuth } from "@/contexts/AuthContext";
import { api, type ApiPost, type ApiComment, type PostType } from "@/lib/api";
import { usePageMeta } from "@/lib/pageMeta";

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

function formatCommentDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "agora há pouco";
    if (diffMin < 60) return `há ${diffMin} min`;
    if (diffHours < 24) return `há ${diffHours} h`;
    if (diffDays < 7) return `há ${diffDays} d`;
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function ArticleDetailPage() {
  const [, params] = useRoute<{ slug: string }>("/articles/:slug");
  const { user: currentUser, isAuthenticated } = useAuth();

  const [post, setPost] = useState<ApiPost | null | undefined>(undefined);
  usePageMeta(post === undefined ? null : post === null ? { title: "Artigo não encontrado", noindex: true } : {
    title: post.title,
    description: post.excerpt || `${post.title} — artigo do Anaheim Hub sobre Gundam Card Game.`,
    image: post.coverImage || null,
  });

  // Social: Curtidas do artigo
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likingArticle, setLikingArticle] = useState(false);

  // Social: Compartilhamento
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Social: Comentários
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Resposta inline a um comentário
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  // Moderação
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const isStaff = currentUser?.role === "ADMIN" || currentUser?.role === "EDITOR";

  // Carrega o artigo
  useEffect(() => {
    if (!params?.slug) return;
    setPost(undefined);
    api.getPostBySlug(params.slug)
      .then((p) => {
        setPost(p);
        setLikeCount(p.likeCount || 0);
      })
      .catch(() => setPost(null));
  }, [params?.slug]);

  // Carrega status de curtida e comentários
  const loadCommentsAndLikes = useCallback(async (slugOrId: string) => {
    try {
      setLoadingComments(true);
      const [likeRes, commentsRes] = await Promise.all([
        api.getPostLikeStatus(slugOrId).catch(() => ({ liked: false, likeCount: 0 })),
        api.getPostComments(slugOrId).catch(() => ({ comments: [], totalCount: 0 })),
      ]);
      setLiked(likeRes.liked);
      setLikeCount(likeRes.likeCount);
      setComments(commentsRes.comments);
      setTotalComments(commentsRes.totalCount);
    } catch {
      // Falha silenciosa ou fallback
    } finally {
      setLoadingComments(false);
    }
  }, []);

  useEffect(() => {
    if (post?.id) {
      loadCommentsAndLikes(post.id);
    }
  }, [post?.id, loadCommentsAndLikes]);

  // Curtir Artigo
  const handleToggleArticleLike = async () => {
    if (!isAuthenticated) {
      toast.error("Identifique-se com sua conta de piloto para curtir este artigo.");
      return;
    }
    if (!post?.id || likingArticle) return;

    const previousLiked = liked;
    const previousCount = likeCount;

    // Atualização otimista
    setLiked(!previousLiked);
    setLikeCount(previousLiked ? Math.max(0, previousCount - 1) : previousCount + 1);
    setLikingArticle(true);

    try {
      const res = await api.togglePostLike(post.id);
      setLiked(res.liked);
      setLikeCount(res.likeCount);
      toast.success(res.liked ? "Artigo curtido!" : "Curtida removida.");
    } catch (err: any) {
      // Reverte em caso de erro
      setLiked(previousLiked);
      setLikeCount(previousCount);
      toast.error(err?.message || "Erro ao curtir artigo.");
    } finally {
      setLikingArticle(false);
    }
  };

  // Copiar link de compartilhamento
  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedLink(true);
        toast.success("Link do artigo copiado com sucesso!");
        setTimeout(() => setCopiedLink(false), 2500);
      })
      .catch(() => {
        toast.error("Não foi possível copiar o link.");
      });
  };

  // Compartilhamento nativo do navegador
  const handleNativeShare = () => {
    if (navigator.share && post) {
      navigator.share({
        title: post.title,
        text: post.excerpt || `Confira este artigo no Anaheim Hub: ${post.title}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  // Criar comentário raiz
  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error("Você precisa estar logado para comentar.");
      return;
    }
    const content = newCommentText.trim();
    if (!content) {
      toast.error("Digite o texto do seu comentário.");
      return;
    }
    if (!post?.id || submittingComment) return;

    setSubmittingComment(true);
    try {
      const created = await api.createPostComment(post.id, { content });
      setComments((prev) => [created, ...prev]);
      setTotalComments((prev) => prev + 1);
      setNewCommentText("");
      toast.success("Comentário transmitido com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao publicar comentário.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // Responder a um comentário
  const handleCreateReply = async (parentId: string) => {
    if (!isAuthenticated) {
      toast.error("Você precisa estar logado para responder.");
      return;
    }
    const content = replyText.trim();
    if (!content) {
      toast.error("Digite sua resposta.");
      return;
    }
    if (!post?.id || submittingReply) return;

    setSubmittingReply(true);
    try {
      const created = await api.createPostComment(post.id, { content, parentId });
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === parentId) {
            return {
              ...c,
              replies: [...(c.replies || []), created],
            };
          }
          return c;
        })
      );
      setTotalComments((prev) => prev + 1);
      setReplyText("");
      setReplyingToId(null);
      toast.success("Resposta enviada com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao responder comentário.");
    } finally {
      setSubmittingReply(false);
    }
  };

  // Curtir um comentário ou resposta
  const handleToggleCommentLike = async (commentId: string, parentId?: string | null) => {
    if (!isAuthenticated) {
      toast.error("Entre na sua conta para curtir comentários.");
      return;
    }

    try {
      const res = await api.togglePostCommentLike(commentId);

      setComments((prev) =>
        prev.map((c) => {
          // Se for o próprio comentário raiz
          if (c.id === commentId) {
            return { ...c, hasLiked: res.liked, likeCount: res.likeCount };
          }
          // Se for uma resposta dentro deste comentário raiz
          if (parentId && c.id === parentId && c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId ? { ...r, hasLiked: res.liked, likeCount: res.likeCount } : r
              ),
            };
          }
          // Se não sabemos o parentId, procura nas respostas de todos
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId ? { ...r, hasLiked: res.liked, likeCount: res.likeCount } : r
              ),
            };
          }
          return c;
        })
      );
    } catch (err: any) {
      toast.error(err?.message || "Erro ao curtir comentário.");
    }
  };

  // Excluir / Moderar comentário ou resposta
  const handleDeleteComment = async (commentId: string, parentId?: string | null) => {
    const confirmMsg = isStaff
      ? "Confirma a moderação/exclusão deste comentário?"
      : "Tem certeza que deseja apagar seu comentário?";

    if (!window.confirm(confirmMsg)) return;

    setDeletingCommentId(commentId);
    try {
      await api.deletePostComment(commentId);

      setComments((prev) => {
        // Se for uma resposta aninhada
        if (parentId) {
          return prev.map((c) => {
            if (c.id === parentId && c.replies) {
              return {
                ...c,
                replies: c.replies.filter((r) => r.id !== commentId),
              };
            }
            return c;
          });
        }

        // Se for um comentário raiz
        return prev
          .map((c) => {
            if (c.id === commentId) {
              // Se tiver respostas, mantemos marcado como removido para não quebrar a árvore
              if (c.replies && c.replies.length > 0) {
                return {
                  ...c,
                  isDeleted: true,
                  content: "[Comentário removido pela moderação]",
                };
              }
              return null; // Será filtrado
            }
            return c;
          })
          .filter(Boolean) as ApiComment[];
      });

      setTotalComments((prev) => Math.max(0, prev - 1));
      toast.success(isStaff ? "Comentário moderado com sucesso." : "Comentário excluído.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover comentário.");
    } finally {
      setDeletingCommentId(null);
    }
  };

  const publishedAt = post?.publishedAt ? new Date(post.publishedAt) : null;
  const embedUrl = post?.youtubeUrl ? toYoutubeEmbed(post.youtubeUrl) : null;
  const articleShareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <PublicShell
      breadcrumbs={[
        { label: "Artigos", href: "/articles" },
        { label: post?.title || params?.slug || "Artigo" },
      ]}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {post === null ? (
          <Card className="panel-cut rounded-none border-primary/30 hero-surface">
            <CardContent className="p-6">
              <p className="text-sm text-red-300">Artigo não encontrado.</p>
              <Link
                href="/articles"
                className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-wider text-primary hover:underline"
              >
                <ArrowLeft className="size-3.5" /> Voltar para Artigos
              </Link>
            </CardContent>
          </Card>
        ) : !post ? (
          <div className="flex items-center gap-3 py-12 text-sm text-slate-300">
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Sintonizando transmissão do artigo...</span>
          </div>
        ) : (
          <>
            {/* Imagem de Capa */}
            {post.coverImage ? (
              <div className="overflow-hidden border border-white/10 bg-slate-950/60 aspect-[21/9]">
                <img
                  loading="lazy"
                  decoding="async"
                  src={post.coverImage}
                  alt={post.title}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}

            {/* Cabeçalho do Artigo */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">
                  {POST_TYPE_LABEL[post.postType]}
                </Badge>
                {publishedAt ? (
                  <Badge
                    variant="outline"
                    className="rounded-none border-white/15 bg-white/5 text-slate-300"
                  >
                    {publishedAt.toLocaleDateString("pt-BR")}
                  </Badge>
                ) : null}
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Por{" "}
                  {post.author ? (
                    <Link
                      href={`/u/${post.author.username}`}
                      className="text-white hover:text-primary transition underline decoration-dotted"
                    >
                      {post.author.displayName}
                    </Link>
                  ) : (
                    "Anaheim Hub Staff"
                  )}
                </span>
              </div>

              <h1 className="mt-3 font-heading text-4xl uppercase leading-tight text-white sm:text-5xl">
                {post.title}
              </h1>

              {post.excerpt ? (
                <p className="mt-4 text-base leading-8 text-slate-300">{post.excerpt}</p>
              ) : null}

              {/* Barra Social de Ações Rápidas */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Botão de Curtir Artigo */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleArticleLike}
                    disabled={likingArticle}
                    className={`rounded-none border transition ${
                      liked
                        ? "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "border-white/15 bg-white/5 text-slate-300 hover:border-red-500/30 hover:text-red-300"
                    }`}
                  >
                    <Heart
                      className={`size-4 mr-1.5 transition ${
                        liked ? "fill-red-500 text-red-500" : "text-slate-400"
                      }`}
                    />
                    <span className="font-mono text-xs font-semibold">{likeCount}</span>
                    <span className="ml-1 hidden text-xs uppercase tracking-wider sm:inline">
                      {liked ? "Curtido" : "Curtir"}
                    </span>
                  </Button>

                  {/* Atalho para Comentários */}
                  <a
                    href="#comments-section"
                    className="inline-flex items-center gap-1.5 rounded-none border border-white/15 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-wider text-slate-300 hover:bg-white/10 transition"
                  >
                    <MessageSquare className="size-4 text-primary" />
                    <span className="font-mono font-semibold">{totalComments}</span>
                    <span className="hidden sm:inline">Comentários</span>
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  {/* Botão de Compartilhar */}
                  <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-none border-white/15 bg-white/5 text-slate-300 hover:border-primary/40 hover:text-white"
                      >
                        <Share2 className="size-4 mr-1.5 text-primary" />
                        <span className="text-xs uppercase tracking-wider">Compartilhar</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md rounded-none border-white/15 bg-slate-950 text-white">
                      <DialogHeader>
                        <DialogTitle className="font-heading text-xl uppercase tracking-wider text-primary flex items-center gap-2">
                          <Share2 className="size-5" /> Compartilhar Artigo
                        </DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4 pt-3">
                        <p className="text-sm text-slate-300">
                          Dissemine esta análise tática entre sua guarnição e redes aliadas.
                        </p>

                        {/* Copiar Link Direto */}
                        <div className="flex items-center gap-2 border border-white/15 bg-slate-900/80 p-2">
                          <input
                            type="text"
                            readOnly
                            value={articleShareUrl}
                            className="w-full bg-transparent text-xs text-slate-300 outline-none select-all font-mono"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleCopyLink}
                            className="rounded-none shrink-0"
                          >
                            {copiedLink ? (
                              <>
                                <Check className="size-3.5 mr-1 text-emerald-400" /> Copiado!
                              </>
                            ) : (
                              <>
                                <Copy className="size-3.5 mr-1" /> Copiar
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Botões Rápidos de Redes Sociais */}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 pt-2">
                          <a
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                              `${post.title}\n${articleShareUrl}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 rounded-none border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/20 transition"
                          >
                            <MessageCircle className="size-3.5" /> WhatsApp
                          </a>

                          <a
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                              post.title
                            )}&url=${encodeURIComponent(articleShareUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 rounded-none border border-sky-500/30 bg-sky-500/10 p-2 text-xs uppercase tracking-wider text-sky-300 hover:bg-sky-500/20 transition"
                          >
                            <ExternalLink className="size-3.5" /> X / Twitter
                          </a>

                          <a
                            href={`https://t.me/share/url?url=${encodeURIComponent(
                              articleShareUrl
                            )}&text=${encodeURIComponent(post.title)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 rounded-none border border-blue-500/30 bg-blue-500/10 p-2 text-xs uppercase tracking-wider text-blue-300 hover:bg-blue-500/20 transition"
                          >
                            <Send className="size-3.5" /> Telegram
                          </a>
                        </div>

                        {/* Compartilhamento Nativo se suportado */}
                        {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNativeShare}
                            className="w-full rounded-none border-white/20 text-xs uppercase tracking-wider"
                          >
                            Compartilhar pelo Dispositivo
                          </Button>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            {/* Embed de Vídeo se houver */}
            {embedUrl ? (
              <div className="overflow-hidden border border-white/10 bg-black aspect-video">
                <iframe
                  src={embedUrl}
                  title={post.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : post.youtubeUrl ? (
              <a
                href={post.youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft"
              >
                <PlayCircle className="size-4" />
                Assistir no YouTube
              </a>
            ) : null}

            {/* Conteúdo Markdown Principal */}
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6 sm:p-8">
                <CardMarkdown content={post.contentMd} />
              </CardContent>
            </Card>

            {/* Rodapé da Matéria com Ações */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
              <Link
                href="/articles"
                className="inline-flex items-center gap-2 rounded-none border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white nav-hover-soft transition"
              >
                <ArrowLeft className="size-3.5" /> Voltar para Artigos
              </Link>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleArticleLike}
                  disabled={likingArticle}
                  className={`rounded-none border ${
                    liked
                      ? "border-red-500/50 bg-red-500/10 text-red-400"
                      : "border-white/15 bg-white/5 text-slate-300"
                  }`}
                >
                  <Heart
                    className={`size-3.5 mr-1.5 ${liked ? "fill-red-500 text-red-500" : ""}`}
                  />
                  <span>{liked ? "Curtido" : "Gostei"} ({likeCount})</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShareDialogOpen(true)}
                  className="rounded-none border-white/15 bg-white/5 text-slate-300"
                >
                  <Share2 className="size-3.5 mr-1.5 text-primary" />
                  Compartilhar
                </Button>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SEÇÃO DE COMENTÁRIOS, RESPOSTAS E MODERAÇÃO */}
            {/* ========================================================= */}
            <section id="comments-section" className="mt-12 space-y-6 pt-6 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center bg-primary/10 border border-primary/30 text-primary">
                    <MessageSquare className="size-4" />
                  </div>
                  <div>
                    <h2 className="font-heading text-xl uppercase tracking-wider text-white">
                      Discussão Tática & Comentários
                    </h2>
                    <p className="text-xs text-slate-400">
                      Transmissões abertas da comunidade Anaheim Hub
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className="rounded-none border-primary/30 bg-primary/5 text-primary font-mono text-xs px-2.5 py-1"
                >
                  {totalComments} {totalComments === 1 ? "Comentário" : "Comentários"}
                </Badge>
              </div>

              {/* Caixa de Criação de Comentário */}
              <Card className="panel-cut rounded-none surface-panel border-white/10">
                <CardContent className="p-4 sm:p-5">
                  {isAuthenticated ? (
                    <form onSubmit={handleCreateComment} className="space-y-3">
                      <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <Avatar className="size-6 border border-white/10">
                          <AvatarImage src={currentUser?.avatarUrl || undefined} />
                          <AvatarFallback className="text-[10px] bg-slate-800 text-white font-mono">
                            {currentUser?.displayName?.slice(0, 2).toUpperCase() || "PL"}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          Transmitindo como{" "}
                          <strong className="text-white">{currentUser?.displayName}</strong>{" "}
                          <span className="text-slate-500">(@{currentUser?.username})</span>
                        </span>
                        {isStaff && (
                          <Badge className="rounded-none border border-red-500/40 bg-red-500/10 text-red-400 text-[9px] uppercase px-1 py-0">
                            Moderação Ativa
                          </Badge>
                        )}
                      </div>

                      <Textarea
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        placeholder="Compartilhe suas percepções sobre este artigo, estratégias de combate ou sugestões..."
                        rows={3}
                        maxLength={2000}
                        className="rounded-none border-white/15 bg-slate-950/80 text-sm text-white placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-0"
                      />

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-mono text-slate-500">
                          {newCommentText.length} / 2000 caracteres
                        </span>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={submittingComment || !newCommentText.trim()}
                          className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs uppercase tracking-wider font-semibold"
                        >
                          <Send className="size-3.5 mr-1.5" />
                          {submittingComment ? "Transmitindo..." : "Publicar Comentário"}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border border-white/10 bg-slate-950/40">
                      <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <Lock className="size-4 text-primary shrink-0" />
                        <span>
                          Identificação de piloto necessária para participar do debate tático.
                        </span>
                      </div>
                      <Link
                        href="/login"
                        className="inline-flex items-center rounded-none border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs uppercase tracking-wider text-primary hover:bg-primary/20 transition font-semibold shrink-0"
                      >
                        Entrar ou Cadastrar
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Lista de Comentários */}
              <div className="space-y-4">
                {loadingComments ? (
                  <div className="py-8 text-center text-xs uppercase tracking-widest text-slate-500">
                    Sincronizando frequências de comentários...
                  </div>
                ) : comments.length === 0 ? (
                  <Card className="panel-cut rounded-none border-dashed border-white/10 bg-slate-950/30 p-8 text-center">
                    <p className="text-sm text-slate-400">
                      Nenhum comentário transmitido ainda para este artigo.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Seja o primeiro piloto a registrar sua análise ou feedback!
                    </p>
                  </Card>
                ) : (
                  comments.map((comment) => {
                    const isAuthor = currentUser?.id === comment.authorId;
                    const canModerate = isStaff || isAuthor;
                    const isDeleted = comment.isDeleted;

                    return (
                      <Card
                        key={comment.id}
                        className={`panel-cut rounded-none border-white/10 bg-slate-950/50 transition ${
                          isDeleted ? "opacity-75" : ""
                        }`}
                      >
                        <CardContent className="p-4 sm:p-5 space-y-3">
                          {/* Cabeçalho do Autor */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-8 border border-white/15">
                                <AvatarImage src={comment.author?.avatarUrl || undefined} />
                                <AvatarFallback className="text-xs bg-slate-800 text-white font-mono">
                                  {comment.author?.displayName?.slice(0, 2).toUpperCase() || "PL"}
                                </AvatarFallback>
                              </Avatar>

                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Link
                                    href={`/u/${comment.author?.username}`}
                                    className="font-medium text-sm text-white hover:text-primary transition"
                                  >
                                    {comment.author?.displayName}
                                  </Link>
                                  <span className="text-xs text-slate-500">
                                    @{comment.author?.username}
                                  </span>

                                  {/* Badges especiais */}
                                  {comment.author?.role === "ADMIN" && (
                                    <Badge className="rounded-none border border-red-500/40 bg-red-500/10 text-red-400 text-[9px] uppercase px-1 py-0">
                                      Comando
                                    </Badge>
                                  )}
                                  {comment.author?.role === "EDITOR" && (
                                    <Badge className="rounded-none border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[9px] uppercase px-1 py-0">
                                      Editor
                                    </Badge>
                                  )}
                                  {comment.author?.isSupporter && (
                                    <Badge className="rounded-none border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[9px] uppercase px-1 py-0 flex items-center gap-0.5">
                                      <Sparkles className="size-2.5" /> Apoiador
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {formatCommentDate(comment.createdAt)}
                                </span>
                              </div>
                            </div>

                            {/* Botão de Moderação / Exclusão */}
                            {canModerate && !isDeleted && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={deletingCommentId === comment.id}
                                className="h-7 px-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-none text-xs"
                                title={isStaff && !isAuthor ? "Moderar comentário (Staff)" : "Excluir comentário"}
                              >
                                {isStaff && !isAuthor ? (
                                  <>
                                    <ShieldAlert className="size-3.5 mr-1 text-red-400" />
                                    <span className="hidden sm:inline">Moderar</span>
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="size-3.5 mr-1" />
                                    <span className="hidden sm:inline">Excluir</span>
                                  </>
                                )}
                              </Button>
                            )}
                          </div>

                          {/* Conteúdo do Comentário */}
                          <div className="pl-10 text-sm leading-relaxed text-slate-200">
                            {isDeleted ? (
                              <div className="flex items-center gap-1.5 italic text-slate-500 text-xs py-1 border-l-2 border-slate-700 pl-2">
                                <ShieldAlert className="size-3.5" />
                                [Comentário removido pela moderação]
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{comment.content}</p>
                            )}
                          </div>

                          {/* Barra de Ações do Comentário */}
                          {!isDeleted && (
                            <div className="pl-10 flex items-center gap-3 pt-1">
                              {/* Curtir Comentário */}
                              <button
                                type="button"
                                onClick={() => handleToggleCommentLike(comment.id)}
                                className={`inline-flex items-center gap-1 text-xs transition ${
                                  comment.hasLiked
                                    ? "text-red-400 font-medium"
                                    : "text-slate-400 hover:text-white"
                                }`}
                              >
                                <Heart
                                  className={`size-3.5 ${
                                    comment.hasLiked ? "fill-red-500 text-red-500" : ""
                                  }`}
                                />
                                <span className="font-mono">{comment.likeCount}</span>
                              </button>

                              {/* Responder */}
                              <button
                                type="button"
                                onClick={() =>
                                  setReplyingToId(
                                    replyingToId === comment.id ? null : comment.id
                                  )
                                }
                                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition"
                              >
                                <Reply className="size-3.5" />
                                <span>Responder</span>
                              </button>
                            </div>
                          )}

                          {/* Caixa Inline de Resposta */}
                          {replyingToId === comment.id && (
                            <div className="pl-10 mt-3 pt-3 border-t border-white/5 space-y-2">
                              <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>
                                  Respondendo a{" "}
                                  <strong className="text-white">
                                    @{comment.author?.username}
                                  </strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingToId(null);
                                    setReplyText("");
                                  }}
                                  className="text-slate-500 hover:text-white"
                                >
                                  Cancelar
                                </button>
                              </div>

                              <Textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Digite sua resposta tática..."
                                rows={2}
                                maxLength={2000}
                                className="rounded-none border-white/15 bg-slate-900/90 text-sm text-white placeholder:text-slate-500 focus-visible:border-primary"
                              />

                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setReplyingToId(null);
                                    setReplyText("");
                                  }}
                                  className="rounded-none text-xs text-slate-400"
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleCreateReply(comment.id)}
                                  disabled={submittingReply || !replyText.trim()}
                                  className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
                                >
                                  <Send className="size-3 mr-1" />
                                  {submittingReply ? "Transmitindo..." : "Responder"}
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* =================================================== */}
                          {/* RESPOSTAS ANINHADAS (THREADED REPLIES) */}
                          {/* =================================================== */}
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="mt-3 pl-6 sm:pl-8 border-l-2 border-primary/20 space-y-3">
                              {comment.replies.map((reply) => {
                                const isReplyAuthor = currentUser?.id === reply.authorId;
                                const canModerateReply = isStaff || isReplyAuthor;
                                const isReplyDeleted = reply.isDeleted;

                                return (
                                  <div
                                    key={reply.id}
                                    className={`p-3 bg-slate-900/60 border border-white/5 space-y-2 ${
                                      isReplyDeleted ? "opacity-75" : ""
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="size-6 border border-white/10">
                                          <AvatarImage src={reply.author?.avatarUrl || undefined} />
                                          <AvatarFallback className="text-[10px] bg-slate-800 text-white font-mono">
                                            {reply.author?.displayName?.slice(0, 2).toUpperCase() || "PL"}
                                          </AvatarFallback>
                                        </Avatar>

                                        <div>
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <Link
                                              href={`/u/${reply.author?.username}`}
                                              className="font-medium text-xs text-white hover:text-primary transition"
                                            >
                                              {reply.author?.displayName}
                                            </Link>
                                            <span className="text-[11px] text-slate-500">
                                              @{reply.author?.username}
                                            </span>

                                            {reply.author?.role === "ADMIN" && (
                                              <Badge className="rounded-none border border-red-500/40 bg-red-500/10 text-red-400 text-[8px] uppercase px-1 py-0">
                                                Comando
                                              </Badge>
                                            )}
                                            {reply.author?.role === "EDITOR" && (
                                              <Badge className="rounded-none border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[8px] uppercase px-1 py-0">
                                                Editor
                                              </Badge>
                                            )}
                                            {reply.author?.isSupporter && (
                                              <Badge className="rounded-none border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[8px] uppercase px-1 py-0 flex items-center gap-0.5">
                                                <Sparkles className="size-2" /> Apoiador
                                              </Badge>
                                            )}
                                          </div>
                                          <span className="text-[10px] text-slate-500 font-mono">
                                            {formatCommentDate(reply.createdAt)}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Excluir/Moderar Resposta */}
                                      {canModerateReply && !isReplyDeleted && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteComment(reply.id, comment.id)}
                                          disabled={deletingCommentId === reply.id}
                                          className="text-slate-500 hover:text-red-400 transition p-1"
                                          title={
                                            isStaff && !isReplyAuthor
                                              ? "Moderar resposta (Staff)"
                                              : "Excluir resposta"
                                          }
                                        >
                                          <Trash2 className="size-3" />
                                        </button>
                                      )}
                                    </div>

                                    {/* Texto da Resposta */}
                                    <div className="text-xs text-slate-200 leading-relaxed pl-8">
                                      {isReplyDeleted ? (
                                        <div className="flex items-center gap-1.5 italic text-slate-500 text-[11px] py-0.5">
                                          <ShieldAlert className="size-3" />
                                          [Resposta removida pela moderação]
                                        </div>
                                      ) : (
                                        <p className="whitespace-pre-wrap">{reply.content}</p>
                                      )}
                                    </div>

                                    {/* Like na Resposta */}
                                    {!isReplyDeleted && (
                                      <div className="pl-8 pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleToggleCommentLike(reply.id, comment.id)
                                          }
                                          className={`inline-flex items-center gap-1 text-[11px] transition ${
                                            reply.hasLiked
                                              ? "text-red-400 font-medium"
                                              : "text-slate-500 hover:text-white"
                                          }`}
                                        >
                                          <Heart
                                            className={`size-3 ${
                                              reply.hasLiked ? "fill-red-500 text-red-500" : ""
                                            }`}
                                          />
                                          <span className="font-mono">{reply.likeCount}</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </PublicShell>
  );
}

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Trash2,
  Save,
  Bot,
  MessageSquare,
  Eye,
  Send,
  CalendarClock,
  ExternalLink,
  Film,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ApiError, apiFetch } from "@/lib/api";

function InstagramIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export interface SocialMediaPost {
  id: string;
  type: "CARD_SPOTLIGHT" | "DECK_FEATURE" | "META_INSIGHT" | "PRODUCT_AFFILIATE" | "TOURNAMENT_REPORT" | "ARTICLE";
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PUBLISHING" | "PUBLISHED" | "REJECTED" | "FAILED";
  title: string | null;
  caption: string;
  cardCode: string | null;
  deckId: string | null;
  imageUrl: string | null;
  /** imagens do carrossel, na ordem, ou o vídeo MP4 do Reel (vazio = imagem única em imageUrl) */
  mediaUrls?: string[];
  metadata?: string | null;
  discordMessageId: string | null;
  instagramPostId: string | null;
  instagramPermalink: string | null;
  scheduledFor: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  publishError: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const POST_TYPE_LABEL: Record<SocialMediaPost["type"], string> = {
  TOURNAMENT_REPORT: "Torneios",
  CARD_SPOTLIGHT: "Carta",
  DECK_FEATURE: "Deck",
  META_INSIGHT: "Meta",
  PRODUCT_AFFILIATE: "Afiliado",
  ARTICLE: "Artigo",
};

type GenerateFormat = SocialMediaPost["type"] | "CARD_SPOILER" | "CARD_REEL";

/** Formatos da agenda (segunda, quarta, sexta) + Spoiler da semana + Reel da carta, na ordem em que aparecem no gerador. */
const GENERATE_TYPES: { value: GenerateFormat; label: string; hint: string }[] = [
  { value: "TOURNAMENT_REPORT", label: "Torneios da semana", hint: "Carrossel com os torneios do Brasil da semana passada (segunda)." },
  { value: "CARD_SPOTLIGHT", label: "Carta da semana", hint: "Escolhe entre as cartas mais usadas nos últimos torneios filtradas por raridade (LR → R → U → C); gera Post Carrossel + Story companheiro (quarta)." },
  { value: "CARD_SPOILER", label: "Spoiler da semana", hint: "Avaliação manual de carta recém-revelada (ex.: novas expansões como GD07), mesmo com imagem de preview; gera Post + Story companheiro." },
  { value: "CARD_REEL", label: "Reel da carta", hint: "Animação MP4 9:16 separada revelando a Carta/Spoiler da Semana e direcionando para o post completo do feed." },
  { value: "DECK_FEATURE", label: "Deck em destaque", hint: "Arquétipo de melhor desempenho nos últimos 30 dias, com a lista (sexta)." },
  { value: "ARTICLE", label: "Artigo", hint: "Capa do artigo e um resumo do texto. Sai sozinho ao publicar um artigo; aqui dá para gerar de novo." },
];

type PublishedArticle = { id: string; title: string; publishedAt: string | null };

/** Estado da geração em segundo plano (GET /admin/social/generation). */
type GenerationState = { running: boolean; postId: string | null; error: string | null };
const GENERATION_POLL_MS = 5000;
const GENERATION_WATCH_MS = 8 * 60_000;

type PostMetaInfo = {
  storyVideoUrl: string | null;
  storyEnabled: boolean;
  storyTitle: string;
  storyPostId: string | null;
  storyError: string | null;
  isSpoiler: boolean;
  cardUrl: string | null;
};

function parsePostMeta(post: SocialMediaPost | null): PostMetaInfo {
  if (!post?.metadata) {
    return { storyVideoUrl: null, storyEnabled: false, storyTitle: "CARTA DA SEMANA", storyPostId: null, storyError: null, isSpoiler: false, cardUrl: null };
  }
  try {
    const parsed = JSON.parse(post.metadata) as Record<string, unknown>;
    const isSpoiler = parsed.isSpoiler === true;
    const defaultTitle = isSpoiler ? "SPOILER DA SEMANA" : "CARTA DA SEMANA";
    const storyVideoUrl = typeof parsed.storyVideoUrl === "string" && /\.mp4$/i.test(parsed.storyVideoUrl) ? parsed.storyVideoUrl : null;
    const storyEnabled = typeof parsed.storyEnabled === "boolean" ? parsed.storyEnabled : Boolean(storyVideoUrl);
    const storyTitle = typeof parsed.storyTitle === "string" && parsed.storyTitle.trim() ? parsed.storyTitle.trim() : defaultTitle;
    const storyPostId = typeof parsed.storyPostId === "string" && parsed.storyPostId ? parsed.storyPostId : null;
    const storyError = typeof parsed.storyError === "string" && parsed.storyError ? parsed.storyError : null;
    const cardUrl = typeof parsed.cardUrl === "string" && parsed.cardUrl ? parsed.cardUrl : null;
    return { storyVideoUrl, storyEnabled, storyTitle, storyPostId, storyError, isSpoiler, cardUrl };
  } catch {
    return { storyVideoUrl: null, storyEnabled: false, storyTitle: "CARTA DA SEMANA", storyPostId: null, storyError: null, isSpoiler: false, cardUrl: null };
  }
}

const reelUrlOf = (post: SocialMediaPost) => (post.mediaUrls ?? []).find((u) => /\.mp4$/i.test(u)) || null;
const slidesOf = (post: SocialMediaPost) => {
  if (reelUrlOf(post)) return post.imageUrl ? [post.imageUrl] : [];
  return post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : [];
};

interface SocialStatus {
  gemini: boolean;
  discord: boolean;
  discordButtons?: boolean;
  instagram: boolean;
  renderer: boolean;
  scheduler: boolean;
  instagramTokenExpiresAt: string | null;
  schedule: { days: number[]; hour: number; minute: number; leadHours: number; next: string | null };
}

const CAPTION_MAX = 2200;
// o mesmo limite do servidor (`INSTAGRAM_HASHTAG_MAX`): 5 por post, regra do Instagram desde dez/2025
const HASHTAG_MAX = 5;
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const countHashtags = (text: string) => (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []).length;
const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function IntegrationRow({ label, ok, okText, offText }: { label: string; ok: boolean; okText: string; offText: string }) {
  return (
    <div className="flex items-center justify-between gap-2 p-2.5 bg-white/[0.02] border border-white/10">
      <span className="text-slate-200 font-semibold">{label}</span>
      <Badge variant="outline" className={ok ? "border-emerald-400/40 text-emerald-300" : "border-amber-400/40 text-amber-300"}>
        {ok ? okText : offText}
      </Badge>
    </div>
  );
}

export function AdminSocialTab() {
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [cardCodeInput, setCardCodeInput] = useState("");
  const [postTypeInput, setPostTypeInput] = useState<GenerateFormat>("CARD_SPOTLIGHT");
  const [articles, setArticles] = useState<PublishedArticle[] | null>(null);
  const [articleIdInput, setArticleIdInput] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [customTopicInput, setCustomTopicInput] = useState("");
  const [selectedPost, setSelectedPost] = useState<SocialMediaPost | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editStoryEnabled, setEditStoryEnabled] = useState(true);
  const [editStoryTitle, setEditStoryTitle] = useState("CARTA DA SEMANA");
  const [regeneratingStory, setRegeneratingStory] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<SocialStatus | null>(null);

  // Travas síncronas para evitar cliques duplos em botões de ação e publicação
  const actionLockRef = useRef<Set<string>>(new Set());
  const isGeneratingRef = useRef<boolean>(false);
  const [actionLocks, setActionLocks] = useState<Record<string, boolean>>({});

  const acquireLock = (key: string): boolean => {
    if (actionLockRef.current.has(key)) return false;
    actionLockRef.current.add(key);
    setActionLocks((prev) => ({ ...prev, [key]: true }));
    return true;
  };

  const releaseLock = (key: string) => {
    actionLockRef.current.delete(key);
    setActionLocks((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  useEffect(() => {
    apiFetch<SocialStatus>("/admin/social/status")
      .then(setIntegrations)
      .catch(() => setIntegrations(null));
  }, []);

  // artigos publicados só carregam quando o formato "Artigo" é escolhido
  useEffect(() => {
    if (postTypeInput !== "ARTICLE" || articles) return;
    apiFetch<{ items?: PublishedArticle[] }>("/posts?status=PUBLISHED&page=1&pageSize=20")
      .then((result) => {
        const items = result?.items ?? [];
        setArticles(items);
        setArticleIdInput((current) => current || items[0]?.id || "");
      })
      .catch(() => setArticles([]));
  }, [postTypeInput, articles]);

  const selectPost = (post: SocialMediaPost) => {
    setSelectedPost(post);
    setSlideIndex(0);
    setEditTitle(post.title || "");
    setEditCaption(post.caption || "");
    const meta = parsePostMeta(post);
    setEditStoryEnabled(meta.storyEnabled);
    setEditStoryTitle(meta.storyTitle);
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const url = statusFilter !== "ALL" ? `/admin/social/posts?status=${statusFilter}` : "/admin/social/posts";
      const res = await apiFetch<SocialMediaPost[]>(url);
      setPosts(res);
      if (res.length > 0 && !selectedPost) {
        selectPost(res[0]);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao carregar postagens sociais.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [statusFilter]);

  // a geração roda em segundo plano no servidor (leva de 20 s a alguns minutos); o painel acompanha pelo estado
  useEffect(() => {
    apiFetch<GenerationState>("/admin/social/generation")
      .then((state) => {
        if (state?.running) setGenerating(true);
      })
      .catch(() => {});
  }, []);

  // monitora posts que estão sendo publicados em segundo plano na Meta e atualiza a tela automaticamente
  const hasPublishingPost = posts.some((p) => p.status === "PUBLISHING");

  useEffect(() => {
    if (!hasPublishingPost) return;
    const interval = window.setInterval(async () => {
      try {
        const url = statusFilter !== "ALL" ? `/admin/social/posts?status=${statusFilter}` : "/admin/social/posts";
        const refreshed = await apiFetch<SocialMediaPost[]>(url);
        if (!refreshed) return;

        for (const prevPost of posts) {
          if (prevPost.status === "PUBLISHING") {
            const next = refreshed.find((p) => p.id === prevPost.id);
            if (next && next.status !== "PUBLISHING") {
              if (next.status === "PUBLISHED") {
                const meta = parsePostMeta(next);
                toast.success(
                  meta.storyPostId
                    ? "Post e Story publicados simultaneamente no Instagram!"
                    : "Post publicado no Instagram com sucesso!",
                );
              } else if (next.status === "FAILED") {
                toast.error(next.publishError || "A publicação no Instagram falhou.");
              }
            }
          }
        }

        setPosts(refreshed);
        setSelectedPost((current) => {
          if (!current) return null;
          return refreshed.find((p) => p.id === current.id) || current;
        });
      } catch {
        // falha passageira de rede
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [hasPublishingPost, posts, statusFilter]);

  useEffect(() => {
    if (!generating) return;
    const startedAt = Date.now();
    const timer = window.setInterval(async () => {
      try {
        const state = await apiFetch<GenerationState>("/admin/social/generation");
        if (state?.running) {
          if (Date.now() - startedAt > GENERATION_WATCH_MS) {
            window.clearInterval(timer);
            isGeneratingRef.current = false;
            setGenerating(false);
            toast.info("A geração está demorando; o rascunho aparece aqui e no Discord quando terminar.");
          }
          return;
        }
        window.clearInterval(timer);
        isGeneratingRef.current = false;
        setGenerating(false);
        if (state?.error) {
          toast.error(`Falha ao gerar o post: ${state.error}`);
          return;
        }
        const list = await apiFetch<SocialMediaPost[]>("/admin/social/posts");
        const created = list?.find((p) => p.id === state?.postId);
        setPosts(list ?? []);
        if (created) selectPost(created);
        toast.success("Rascunho criado e enviado ao Discord para aprovação!");
      } catch {
        // falha passageira de rede: tenta de novo no próximo ciclo
      }
    }, GENERATION_POLL_MS);
    return () => window.clearInterval(timer);
  }, [generating]);

  const handleGenerate = async () => {
    if (isGeneratingRef.current || generating) return;
    isGeneratingRef.current = true;
    setGenerating(true);
    try {
      const isReel = postTypeInput === "CARD_REEL";
      const isSpoiler = postTypeInput === "CARD_SPOILER";
      const isCard = postTypeInput === "CARD_SPOTLIGHT" || isSpoiler || isReel;
      await apiFetch<GenerationState>("/admin/social/generate", {
        method: "POST",
        body: JSON.stringify({
          cardCode: isCard ? cardCodeInput.trim() || undefined : undefined,
          customTopic: customTopicInput.trim() || undefined,
          type: isReel || isSpoiler ? "CARD_SPOTLIGHT" : postTypeInput,
          reel: isReel,
          spoiler: isSpoiler,
          articleId: postTypeInput === "ARTICLE" ? articleIdInput || undefined : undefined,
        }),
      });
      toast.info(
        isReel
          ? "Gerando a animação MP4 do Reel e a legenda. Aparece aqui e no Discord em 1 a 3 minutos."
          : isCard
            ? "Gerando o carrossel do post, o vídeo MP4 do Story companheiro e a legenda…"
            : "Gerando o texto e as imagens. O rascunho aparece aqui e no Discord em 1 a 3 minutos.",
      );
      setCardCodeInput("");
      setCustomTopicInput("");
    } catch (err: any) {
      // 409: já tem uma geração em andamento — segue acompanhando essa, sem criar outra
      if (err instanceof ApiError && err.status === 409) {
        toast.info(err.message);
        return;
      }
      isGeneratingRef.current = false;
      setGenerating(false);
      toast.error(err?.message || "Falha ao gerar post com IA.");
    }
  };

  const handleGenerateReelForCard = async (cardCode: string, isSpoiler = false) => {
    if (isGeneratingRef.current || generating) return;
    isGeneratingRef.current = true;
    setGenerating(true);
    try {
      await apiFetch<GenerationState>("/admin/social/generate", {
        method: "POST",
        body: JSON.stringify({
          cardCode,
          type: "CARD_SPOTLIGHT",
          reel: true,
          spoiler: isSpoiler,
        }),
      });
      toast.info(`Gerando o Reel de revelação para ${cardCode}…`);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        toast.info(err.message);
        return;
      }
      isGeneratingRef.current = false;
      setGenerating(false);
      toast.error(err?.message || "Falha ao gerar o Reel da carta.");
    }
  };

  const handleUpdateStory = async (post: SocialMediaPost, regenerate = false) => {
    const lockKey = `story-${post.id}`;
    if (!acquireLock(lockKey) || regeneratingStory) return;
    try {
      setRegeneratingStory(true);
      const updated = await apiFetch<SocialMediaPost>(`/admin/social/posts/${post.id}/story`, {
        method: "POST",
        body: JSON.stringify({
          storyEnabled: editStoryEnabled,
          storyTitle: editStoryTitle,
          regenerate,
        }),
      });
      toast.success(regenerate ? "Vídeo do Story regerado com sucesso!" : "Configuração do Story atualizada!");
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
      selectPost(updated);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar o Story.");
    } finally {
      releaseLock(lockKey);
      setRegeneratingStory(false);
    }
  };

  const handleSaveEdit = async (post: SocialMediaPost) => {
    const lockKey = `save-${post.id}`;
    if (!acquireLock(lockKey) || savingId === post.id) return;
    try {
      setSavingId(post.id);
      const isCardFeed = post.type === "CARD_SPOTLIGHT" && !reelUrlOf(post);
      const updated = await apiFetch<SocialMediaPost>(`/admin/social/posts/${post.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editTitle,
          caption: editCaption,
          ...(isCardFeed ? { storyEnabled: editStoryEnabled, storyTitle: editStoryTitle } : {}),
        }),
      });
      toast.success("Alterações salvas com sucesso!");
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
      selectPost(updated);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar alterações.");
    } finally {
      releaseLock(lockKey);
      setSavingId(null);
    }
  };

  const handleApprove = async (post: SocialMediaPost) => {
    const lockKey = post.id;
    if (!acquireLock(lockKey)) return;
    try {
      setSavingId(post.id);
      // Feedback otimista imediato: atualiza o status na tela para PUBLICANDO para evitar duplo clique
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, status: "PUBLISHING" as const, publishError: null } : p)),
      );
      if (selectedPost?.id === post.id) {
        setSelectedPost((prev) => (prev ? { ...prev, status: "PUBLISHING" as const, publishError: null } : null));
      }

      // Envia título, legenda e configurações do Story atomicamente na mesma requisição de aprovar
      const res = await apiFetch<{ ok: boolean; post: SocialMediaPost; publishing?: boolean }>(
        `/admin/social/posts/${post.id}/approve`,
        {
          method: "POST",
          body: JSON.stringify({
            title: editTitle,
            caption: editCaption,
            storyEnabled: editStoryEnabled,
            storyTitle: editStoryTitle,
          }),
        },
      );

      const returnedPost = res?.post || post;
      setPosts((prev) => prev.map((p) => (p.id === post.id ? returnedPost : p)));
      if (selectedPost?.id === post.id) selectPost(returnedPost);

      if (res?.publishing || returnedPost.status === "PUBLISHING") {
        toast.info("Publicando no Instagram em segundo plano… Acompanhe o status nesta tela.");
      } else if (returnedPost.status === "PUBLISHED") {
        const publishedMeta = parsePostMeta(returnedPost);
        toast.success(
          publishedMeta.storyPostId
            ? "Post e Story publicados simultaneamente no Instagram!"
            : "Aprovado e publicado no Instagram!",
        );
      } else if (returnedPost.status === "FAILED") {
        toast.error(returnedPost.publishError || "Aprovado, mas a publicação falhou.");
      } else if (returnedPost.scheduledFor && new Date(returnedPost.scheduledFor).getTime() > Date.now()) {
        toast.success(`Aprovado. Sai ${formatWhen(returnedPost.scheduledFor)}.`);
      } else {
        toast.success("Aprovado. Configure o Instagram no servidor para publicar automaticamente.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao aprovar post.");
      fetchPosts();
    } finally {
      releaseLock(lockKey);
      setSavingId(null);
    }
  };

  const handlePublishNow = async (post: SocialMediaPost) => {
    const lockKey = post.id;
    if (!acquireLock(lockKey)) return;
    try {
      setSavingId(post.id);
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, status: "PUBLISHING" as const, publishError: null } : p)),
      );
      if (selectedPost?.id === post.id) {
        setSelectedPost((prev) => (prev ? { ...prev, status: "PUBLISHING" as const, publishError: null } : null));
      }

      const res = await apiFetch<{ ok: boolean; post: SocialMediaPost; publishing?: boolean }>(
        `/admin/social/posts/${post.id}/publish`,
        { method: "POST" },
      );
      const returnedPost = res?.post || post;
      setPosts((prev) => prev.map((p) => (p.id === post.id ? returnedPost : p)));
      if (selectedPost?.id === post.id) setSelectedPost(returnedPost);

      if (res?.publishing || returnedPost.status === "PUBLISHING") {
        toast.info("Publicando no Instagram em segundo plano… Acompanhe o status nesta tela.");
      } else if (returnedPost.status === "PUBLISHED") {
        toast.success("Publicado no Instagram!");
      } else {
        toast.error(returnedPost.publishError || "A publicação falhou.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao publicar.");
      fetchPosts();
    } finally {
      releaseLock(lockKey);
      setSavingId(null);
    }
  };

  const handleReject = async (post: SocialMediaPost) => {
    const lockKey = `reject-${post.id}`;
    if (!acquireLock(lockKey) || savingId === post.id) return;
    try {
      setSavingId(post.id);
      const res = await apiFetch<{ ok: boolean; post: SocialMediaPost }>(`/admin/social/posts/${post.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "Descartado pelo administrador" }),
      });
      toast.warning("Post descartado.");
      setPosts((prev) => prev.map((p) => (p.id === post.id ? res.post : p)));
      if (selectedPost?.id === post.id) setSelectedPost(res.post);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao descartar post.");
    } finally {
      releaseLock(lockKey);
      setSavingId(null);
    }
  };

  const handleDelete = async (post: SocialMediaPost) => {
    const lockKey = `delete-${post.id}`;
    if (!acquireLock(lockKey)) return;
    if (!confirm("Tem certeza que deseja excluir permanentemente este rascunho?")) {
      releaseLock(lockKey);
      return;
    }
    try {
      await apiFetch(`/admin/social/posts/${post.id}`, { method: "DELETE" });
      toast.success("Post removido.");
      const remaining = posts.filter((p) => p.id !== post.id);
      setPosts(remaining);
      if (selectedPost?.id === post.id) {
        setSelectedPost(remaining[0] || null);
        if (remaining[0]) selectPost(remaining[0]);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir post.");
    } finally {
      releaseLock(lockKey);
    }
  };

  const getStatusBadge = (status: SocialMediaPost["status"]) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">Aguardando Aprovação</Badge>;
      case "APPROVED":
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40">Aprovado</Badge>;
      case "PUBLISHED":
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">Publicado</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/40">Descartado</Badge>;
      case "PUBLISHING":
        return <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40">Publicando…</Badge>;
      case "FAILED":
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/40">Falhou</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-300">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Superior com Explicação e Ação Rápida */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Card 1: Criador de Post com IA */}
        <Card className="panel-cut rounded-none surface-panel border-white/10 lg:col-span-2">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-heading text-lg uppercase text-white flex items-center gap-2">
                  <Bot className="size-5 text-sky-400" />
                  Agente IA de Automação Social (Instagram / Discord)
                </h3>
                <p className="text-xs text-slate-400">
                  Gere rascunhos com arte 1080x1350, Reels 9:16 animados, alt_text de SEO e notificação no Discord
                </p>
              </div>
            </div>

            <div>
              <span className="text-xs uppercase font-mono text-slate-300 block mb-1">Formato do post</span>
              <div role="radiogroup" aria-label="Formato do post" className="flex flex-wrap gap-2">
                {GENERATE_TYPES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={postTypeInput === option.value}
                    onClick={() => setPostTypeInput(option.value)}
                    className={`px-3 py-2 text-xs font-bold uppercase tracking-wider border transition ${
                      postTypeInput === option.value
                        ? "border-sky-400 bg-sky-500/15 text-sky-300"
                        : "border-white/10 text-slate-400 hover:border-white/25"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {GENERATE_TYPES.find((option) => option.value === postTypeInput)?.hint}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {(postTypeInput === "CARD_SPOTLIGHT" || postTypeInput === "CARD_SPOILER" || postTypeInput === "CARD_REEL") && (
              <div>
                <label className="text-xs uppercase font-mono text-slate-300 block mb-1">
                  Código da Carta (Opcional)
                </label>
                <Input
                  placeholder={postTypeInput === "CARD_SPOILER" ? "Ex: GD07-001 (vazio para carta da última expansão)" : "Ex: GD01-010 (vazio para mais usadas em torneios)"}
                  value={cardCodeInput}
                  onChange={(e) => setCardCodeInput(e.target.value.toUpperCase())}
                  className="rounded-none font-mono text-sm bg-slate-950/60"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {postTypeInput === "CARD_REEL"
                    ? "Se vazio, usa a carta do último post Carta/Spoiler da Semana para revelar no Reel e direcionar ao post."
                    : postTypeInput === "CARD_SPOILER"
                      ? "Informe o código da carta revelada (ou deixe vazio para escolher da expansão mais recente cadastrada)."
                      : "Se vazio, escolhe entre as cartas mais usadas nos últimos torneios filtradas pela raridade da vez (LR → R → U → C), sem repetir as últimas."}
                </span>
              </div>
              )}

              {postTypeInput === "ARTICLE" && (
              <div>
                <label htmlFor="social-article" className="text-xs uppercase font-mono text-slate-300 block mb-1">
                  Artigo
                </label>
                <select
                  id="social-article"
                  value={articleIdInput}
                  onChange={(e) => setArticleIdInput(e.target.value)}
                  disabled={!articles?.length}
                  className="w-full h-9 rounded-none border border-input bg-slate-950/60 px-3 text-sm text-slate-200"
                >
                  {articles === null && <option value="">Carregando artigos...</option>}
                  {articles?.length === 0 && <option value="">Nenhum artigo publicado</option>}
                  {articles?.map((article) => (
                    <option key={article.id} value={article.id}>
                      {article.title}
                      {article.publishedAt ? ` (${new Date(article.publishedAt).toLocaleDateString("pt-BR")})` : ""}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Os 20 artigos publicados mais recentes. A legenda resume o texto do artigo.
                </span>
              </div>
              )}

              <div>
                <label className="text-xs uppercase font-mono text-slate-300 block mb-1">
                  Contexto ou Instrução Adicional (Opcional)
                </label>
                <Input
                  placeholder="Ex: Foque no combo com Amuro Ray e deck azul"
                  value={customTopicInput}
                  onChange={(e) => setCustomTopicInput(e.target.value)}
                  className="rounded-none text-sm bg-slate-950/60"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Direcionamento para a IA destacar pontos estratégicos ou afiliados.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="inline-block size-2 rounded-full bg-emerald-400" />
                Legenda: {integrations?.gemini ? "Gemini" : "modelo fixo (sem GEMINI_API_KEY)"} · Arte: {integrations?.renderer ? "JPEG 1080x1350 & Reel MP4" : "navegador não instalado no servidor"}
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generating || (postTypeInput === "ARTICLE" && !articleIdInput)}
                className="rounded-none bg-sky-500 hover:bg-sky-600 text-slate-950 font-bold uppercase tracking-wider text-xs px-5"
              >
                {generating ? (
                  <>
                    <RefreshCw className="size-4 mr-2 animate-spin" />
                    Gerando Post & Arte...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Gerar Novo Post com IA
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Status das Integrações */}
        <Card className="panel-cut rounded-none surface-panel border-white/10">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-heading text-lg uppercase text-white flex items-center gap-2 border-b border-white/10 pb-3">
              <MessageSquare className="size-5 text-indigo-400" />
              Canais Conectados
            </h3>

            {integrations ? (
              <div className="space-y-2 text-xs">
                <IntegrationRow label="Discord (avisos)" ok={integrations.discord} okText="Configurado" offText="Sem DISCORD_WEBHOOK_URL" />
                <IntegrationRow label="Discord (botões)" ok={Boolean(integrations.discordButtons)} okText="Aprovar pelo Discord" offText="Só aviso (sem bot)" />
                <IntegrationRow label="Gemini (legenda)" ok={integrations.gemini} okText="Configurado" offText="Usando modelo fixo" />
                <IntegrationRow label="Navegador (arte)" ok={integrations.renderer} okText="Instalado" offText="Não instalado" />
                <div className="flex items-center justify-between gap-2 p-2.5 bg-white/[0.02] border border-white/10">
                  <span className="flex items-center gap-2 text-slate-200 font-semibold">
                    <InstagramIcon className="size-4 text-pink-400" /> Instagram
                  </span>
                  <Badge variant="outline" className={integrations.instagram ? "border-emerald-400/40 text-emerald-300" : "border-amber-400/40 text-amber-300"}>
                    {integrations.instagram ? "Publicação ligada" : "Não configurado"}
                  </Badge>
                </div>
                {integrations.instagramTokenExpiresAt && (
                  <p className="text-[11px] text-slate-400">Token renovado; vale até {formatWhen(integrations.instagramTokenExpiresAt)}.</p>
                )}
                <div className="p-3 bg-sky-500/10 border-l-2 border-sky-400 text-[11px] text-sky-200 leading-relaxed flex gap-2">
                  <CalendarClock className="size-4 shrink-0" />
                  <span>
                    {integrations.scheduler
                      ? `Agenda ligada: ${integrations.schedule.days.map((d) => WEEKDAYS[d]).join(", ")} às ${String(integrations.schedule.hour).padStart(2, "0")}:${String(integrations.schedule.minute).padStart(2, "0")} (Brasília). O rascunho chega ${integrations.schedule.leadHours} h antes.${integrations.schedule.next ? ` Próximo: ${formatWhen(integrations.schedule.next)}.` : ""}`
                      : "Agenda desligada (SOCIAL_SCHEDULER_ENABLED). Os rascunhos só são gerados pelo botão."}{" "}
                    Nada vai ao ar sem a sua aprovação.
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Carregando situação das integrações…</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção Principal: Lista de Rascunhos e Painel de Edição */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Coluna da Esquerda: Lista de Rascunhos (5 colunas) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-heading text-sm uppercase text-slate-300">
              Fila de Rascunhos ({posts.length})
            </h4>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-white/15 text-xs text-slate-300 p-1 rounded-none font-mono"
              >
                <option value="ALL">Todos os Status</option>
                <option value="PENDING_APPROVAL">Aguardando Aprovação</option>
                <option value="APPROVED">Aprovados</option>
                <option value="PUBLISHED">Publicados</option>
                <option value="FAILED">Com falha</option>
                <option value="REJECTED">Descartados</option>
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchPosts}
                disabled={loading}
                className="h-7 px-2 rounded-none"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {posts.length === 0 ? (
              <div className="p-8 text-center border border-white/10 bg-white/[0.02] text-slate-400 text-xs">
                Nenhuma postagem encontrada neste filtro. Clique em "Gerar Novo Post com IA" acima para criar a primeira!
              </div>
            ) : (
              posts.map((post) => {
                const isSelected = selectedPost?.id === post.id;
                const isReel = Boolean(reelUrlOf(post));
                const meta = parsePostMeta(post);
                return (
                  <div
                    key={post.id}
                    onClick={() => selectPost(post)}
                    className={`p-3.5 border transition cursor-pointer flex gap-3 items-center ${
                      isSelected
                        ? "border-sky-400 bg-sky-950/20"
                        : "border-white/10 bg-slate-900/40 hover:border-white/25"
                    }`}
                  >
                    {/* Miniatura da Imagem */}
                    <div className="size-16 shrink-0 bg-slate-950 border border-white/10 overflow-hidden relative group">
                      {post.imageUrl ? (
                        <img
                          src={post.imageUrl}
                          alt={post.title || "Post"}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="size-full flex items-center justify-center text-slate-600 text-xs">
                          Sem img
                        </div>
                      )}
                    </div>

                    {/* Informações Resumidas */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-sky-400 truncate">
                          {isReel ? "Reel" : meta.isSpoiler ? "Spoiler" : POST_TYPE_LABEL[post.type] ?? post.type}
                          {post.cardCode ? ` · ${post.cardCode}` : ""}
                          {isReel ? " · MP4" : (post.mediaUrls?.length ?? 0) > 1 ? ` · ${post.mediaUrls?.length} imagens` : ""}
                          {!isReel && meta.storyEnabled && meta.storyVideoUrl ? " · +Story" : ""}
                        </span>
                        {getStatusBadge(post.status)}
                      </div>
                      <p className="text-xs text-white font-medium truncate">
                        {post.title || "Sem título"}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {new Date(post.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Coluna da Direita: Editor e Prévia Detalhada (7 colunas) */}
        <div className="lg:col-span-7">
          {selectedPost ? (
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(selectedPost.status)}
                      <span className="text-xs font-mono text-slate-400">ID: {selectedPost.id}</span>
                    </div>
                    <h4 className="text-base font-bold text-white uppercase">
                      Revisão & Edição do Post
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedPost.type === "CARD_SPOTLIGHT" && selectedPost.cardCode && !reelUrlOf(selectedPost) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={generating}
                        onClick={() => handleGenerateReelForCard(selectedPost.cardCode!, parsePostMeta(selectedPost).isSpoiler)}
                        className="rounded-none border-sky-500/40 text-sky-300 hover:bg-sky-500/10 text-xs"
                      >
                        <Film className="size-3.5 mr-1" />
                        Gerar Reel desta carta
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(selectedPost)}
                      className="rounded-none border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-12 gap-5">
                  {/* Prévia Visual da Imagem ou Reel */}
                  <div className="md:col-span-5 space-y-2">
                    {(() => {
                      const reelVideo = reelUrlOf(selectedPost);
                      if (reelVideo) {
                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs uppercase font-mono text-sky-300 flex items-center gap-1.5">
                                <Film className="size-3.5" /> Reel 1080x1920 (MP4)
                              </span>
                              <a
                                href={reelVideo}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-slate-400 hover:text-white underline"
                              >
                                Abrir MP4
                              </a>
                            </div>
                            <div className="border border-white/15 bg-slate-950 aspect-[9/16] relative overflow-hidden flex items-center justify-center">
                              <video
                                key={reelVideo}
                                src={reelVideo}
                                poster={selectedPost.imageUrl || undefined}
                                controls
                                playsInline
                                loop
                                className="size-full object-contain"
                              />
                            </div>
                          </>
                        );
                      }

                      const slides = slidesOf(selectedPost);
                      const current = slides[Math.min(slideIndex, slides.length - 1)];
                      const meta = parsePostMeta(selectedPost);
                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-xs uppercase font-mono text-slate-300">
                              {slides.length > 1 ? "Carrossel" : "Arte"} 1080x1350 (Instagram)
                            </span>
                            {slides.length > 1 && (
                              <span className="text-[11px] font-mono text-slate-400">
                                {Math.min(slideIndex, slides.length - 1) + 1}/{slides.length}
                              </span>
                            )}
                          </div>
                          <div className="border border-white/15 bg-slate-950 aspect-[4/5] relative overflow-hidden flex items-center justify-center group">
                            {current ? (
                              <>
                                <img src={current} alt="Arte do post" className="size-full object-contain" />
                                <a
                                  href={current}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white text-xs font-semibold"
                                >
                                  <Eye className="size-4" /> Ver em Alta Definição
                                </a>
                              </>
                            ) : (
                              <span className="text-xs text-slate-500">Imagem não disponível</span>
                            )}
                          </div>
                          {slides.length > 1 && (
                            <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Imagens do carrossel">
                              {slides.map((url, i) => (
                                <button
                                  key={url}
                                  type="button"
                                  onClick={() => setSlideIndex(i)}
                                  aria-label={`Imagem ${i + 1} de ${slides.length}`}
                                  aria-current={i === slideIndex}
                                  className={`shrink-0 w-12 aspect-[4/5] border overflow-hidden ${i === slideIndex ? "border-sky-400" : "border-white/10 opacity-70 hover:opacity-100"}`}
                                >
                                  <img src={url} alt="" className="size-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Story Companheiro (9:16) para Posts de Carta */}
                          {selectedPost.type === "CARD_SPOTLIGHT" && (
                            <div className="mt-4 pt-3 border-t border-white/10 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs uppercase font-mono text-sky-300 flex items-center gap-1.5">
                                  <Film className="size-3.5" /> Story Companheiro (9:16)
                                </span>
                                {meta.storyVideoUrl && (
                                  <a
                                    href={meta.storyVideoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-mono text-slate-400 hover:text-white underline"
                                  >
                                    Abrir MP4
                                  </a>
                                )}
                              </div>

                              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editStoryEnabled}
                                  onChange={(e) => setEditStoryEnabled(e.target.checked)}
                                  disabled={selectedPost.status === "PUBLISHED" || selectedPost.status === "PUBLISHING"}
                                  className="accent-sky-400"
                                />
                                <span>Publicar Story junto ao aprovar o post</span>
                              </label>

                              <div className="space-y-1">
                                <label className="text-[11px] uppercase font-mono text-slate-400 block">
                                  Texto Central do Story
                                </label>
                                <div className="flex gap-1.5">
                                  <Input
                                    value={editStoryTitle}
                                    onChange={(e) => setEditStoryTitle(e.target.value)}
                                    disabled={selectedPost.status === "PUBLISHED" || selectedPost.status === "PUBLISHING"}
                                    className="h-8 rounded-none text-xs font-mono bg-slate-950/60"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={regeneratingStory || Boolean(actionLocks[`story-${selectedPost.id}`]) || selectedPost.status === "PUBLISHED" || selectedPost.status === "PUBLISHING"}
                                    onClick={() => handleUpdateStory(selectedPost, true)}
                                    className="h-8 px-2.5 rounded-none border-sky-500/40 text-sky-300 hover:bg-sky-500/10 text-[11px] shrink-0"
                                    title="Renderizar novamente o vídeo MP4 do Story com o texto acima"
                                  >
                                    <RefreshCw className={`size-3 mr-1 ${regeneratingStory ? "animate-spin" : ""}`} />
                                    {meta.storyVideoUrl ? "Regerar" : "Gerar"}
                                  </Button>
                                </div>
                              </div>

                              {meta.storyVideoUrl ? (
                                <div className="border border-white/15 bg-slate-950 aspect-[9/16] max-h-72 mx-auto relative overflow-hidden flex items-center justify-center">
                                  <video
                                    key={meta.storyVideoUrl}
                                    src={meta.storyVideoUrl}
                                    controls
                                    playsInline
                                    loop
                                    className="size-full object-contain"
                                  />
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-500">
                                  Nenhum vídeo de Story gerado ainda. Clique em &quot;Gerar&quot; para criar a animação 9:16 da carta sendo revelada.
                                </p>
                              )}

                              {meta.storyPostId && (
                                <p className="text-[11px] text-emerald-300 font-mono">
                                  ✓ Story publicado junto com o post (ID: {meta.storyPostId})
                                </p>
                              )}
                              {meta.storyError && (
                                <p className="text-[11px] text-amber-300">
                                  Aviso do Story: {meta.storyError}
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Campos Editáveis */}
                  <div className="md:col-span-7 space-y-4">
                    <div>
                      <label className="text-xs uppercase font-mono text-slate-300 block mb-1">
                        Título do Post
                      </label>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="rounded-none text-sm bg-slate-950/60 font-semibold"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs uppercase font-mono text-slate-300">
                          Legenda Completa (com Hashtags)
                        </label>
                        <span className={`text-[11px] font-mono ${editCaption.length > CAPTION_MAX || countHashtags(editCaption) > HASHTAG_MAX ? "text-red-400" : "text-slate-400"}`}>
                          {editCaption.length}/{CAPTION_MAX} caracteres · {countHashtags(editCaption)}/{HASHTAG_MAX} hashtags
                        </span>
                      </div>
                      <Textarea
                        rows={14}
                        value={editCaption}
                        onChange={(e) => setEditCaption(e.target.value)}
                        className="rounded-none text-xs font-mono leading-relaxed bg-slate-950/60 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Auditoria do Prompt e Geração com IA */}
                {(() => {
                  if (!selectedPost.metadata) return null;
                  try {
                    const postMeta = JSON.parse(selectedPost.metadata) as { provider?: "gemini" | "claude" | "fallback"; model?: string | null; prompt?: string; customTopic?: string } | null;
                    if (!postMeta || (!postMeta.provider && !postMeta.customTopic && !postMeta.prompt)) return null;
                    return (
                      <div className="rounded border border-white/10 bg-white/[0.02] p-3 text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <Bot className="size-3.5 text-cyan-400" />
                            Origem da Legenda:
                          </span>
                          {postMeta.provider === "gemini" && (
                            <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/10 text-emerald-300 font-mono text-[11px]">
                              Gemini ({postMeta.model || "Flash"})
                            </Badge>
                          )}
                          {postMeta.provider === "claude" && (
                            <Badge variant="outline" className="border-purple-400/40 bg-purple-400/10 text-purple-300 font-mono text-[11px]">
                              Claude ({postMeta.model || "Opus"})
                            </Badge>
                          )}
                          {postMeta.provider === "fallback" && (
                            <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-300 font-mono text-[11px]">
                              ⚠️ Modelo Fixo (Fallback - sem IA)
                            </Badge>
                          )}
                        </div>

                        {postMeta.customTopic && (
                          <div className="text-slate-300 bg-slate-950/40 p-2 border border-white/5 font-mono text-[11px]">
                            <span className="text-slate-400 font-sans block mb-0.5 text-[10px] uppercase tracking-wider">Instrução solicitada (Prompt do editor):</span>
                            "{postMeta.customTopic}"
                          </div>
                        )}

                        {postMeta.prompt && (
                          <details className="group">
                            <summary className="cursor-pointer text-[11px] text-cyan-400 hover:text-cyan-300 font-mono select-none">
                              ▶ Ver prompt completo enviado à IA
                            </summary>
                            <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-300 bg-slate-950/80 p-2.5 border border-white/10 max-h-48 overflow-y-auto">
                              {postMeta.prompt}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}

                {(selectedPost.scheduledFor || selectedPost.publishError || selectedPost.instagramPermalink) && (
                  <div className="space-y-2 text-xs">
                    {selectedPost.scheduledFor && selectedPost.status !== "PUBLISHED" && (
                      <p className="flex items-center gap-2 text-slate-300">
                        <CalendarClock className="size-3.5 text-sky-400" /> Horário marcado: {formatWhen(selectedPost.scheduledFor)} (Brasília)
                      </p>
                    )}
                    {selectedPost.publishError && selectedPost.status === "FAILED" && (
                      <p className="border-l-2 border-red-400 bg-red-500/10 p-2 text-red-200">{selectedPost.publishError}</p>
                    )}
                    {selectedPost.instagramPermalink && (
                      <a href={selectedPost.instagramPermalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-pink-300 hover:text-pink-200">
                        <ExternalLink className="size-3.5" /> Ver no Instagram
                      </a>
                    )}
                  </div>
                )}

                {/* Barra de Ações Inferior */}
                <div className="border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveEdit(selectedPost)}
                    disabled={savingId === selectedPost.id || Boolean(actionLocks[selectedPost.id]) || Boolean(actionLocks[`save-${selectedPost.id}`]) || selectedPost.status === "PUBLISHED" || selectedPost.status === "PUBLISHING"}
                    className="rounded-none text-xs"
                  >
                    <Save className="size-3.5 mr-1.5" />
                    Salvar Alterações
                  </Button>

                  <div className="flex items-center gap-2">
                    {(selectedPost.status === "APPROVED" || selectedPost.status === "FAILED") && integrations?.instagram && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePublishNow(selectedPost)}
                        disabled={savingId === selectedPost.id || Boolean(actionLocks[selectedPost.id])}
                        className="rounded-none border-pink-500/40 text-pink-300 hover:bg-pink-500/10 text-xs"
                      >
                        <Send className="size-3.5 mr-1.5" />
                        {selectedPost.status === "FAILED" ? "Tentar de novo" : "Publicar agora"}
                      </Button>
                    )}

                    {selectedPost.status !== "REJECTED" && selectedPost.status !== "PUBLISHED" && selectedPost.status !== "PUBLISHING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(selectedPost)}
                        disabled={savingId === selectedPost.id || Boolean(actionLocks[selectedPost.id]) || Boolean(actionLocks[`reject-${selectedPost.id}`])}
                        className="rounded-none border-red-500/40 text-red-300 hover:bg-red-500/10 text-xs"
                      >
                        <XCircle className="size-3.5 mr-1.5" />
                        Descartar
                      </Button>
                    )}

                    {selectedPost.status !== "APPROVED" && selectedPost.status !== "PUBLISHED" && selectedPost.status !== "PUBLISHING" && selectedPost.status !== "FAILED" && (
                      <Button
                        size="sm"
                        onClick={() => handleApprove(selectedPost)}
                        disabled={savingId === selectedPost.id || Boolean(actionLocks[selectedPost.id])}
                        className="rounded-none bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold uppercase tracking-wider text-xs px-4"
                      >
                        <CheckCircle2 className="size-3.5 mr-1.5" />
                        {(() => {
                          const hasStory = selectedPost.type === "CARD_SPOTLIGHT" && !reelUrlOf(selectedPost) && editStoryEnabled && Boolean(parsePostMeta(selectedPost).storyVideoUrl);
                          const targetLabel = hasStory ? "Post + Story" : "Post";
                          if (selectedPost.scheduledFor && new Date(selectedPost.scheduledFor).getTime() > Date.now()) {
                            return `Aprovar ${targetLabel} (sai ${formatWhen(selectedPost.scheduledFor)})`;
                          }
                          return integrations?.instagram ? `Aprovar e publicar ${targetLabel}` : `Aprovar ${targetLabel}`;
                        })()}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="p-12 text-center border border-white/10 bg-slate-900/30 text-slate-400 text-xs">
              Selecione um rascunho na lista ao lado para editar o texto e visualizar a arte.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

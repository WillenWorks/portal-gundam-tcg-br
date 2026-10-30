/* Módulo Editorial (Content Hub) — CMS administrativo de artigos (model Post). Lista +
 * editor com preview split-screen (CardMarkdown, mesmo renderer do leitor público) e um
 * gerador de prompt de capa temática + gerador completo de artigos com Agente de IA
 * especializado + fluxo de aprovação com post e Story simultâneos no Instagram. */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardCopy,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { AdminShell } from "@/components/layout/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CardMarkdown } from "@/components/articles/CardMarkdown";
import { useAuth } from "@/contexts/AuthContext";
import { api, type ApiPost, type PostStatus, type PostType, type TaxonomyEntry } from "@/lib/api";

const POST_TYPE_LABEL: Record<PostType, string> = {
  NEWS: "Notícia",
  PREVIEW: "Preview",
  REVIEW: "Análise",
  GUIDE: "Guia",
};

const POST_STATUS_LABEL: Record<PostStatus, string> = {
  DRAFT: "Rascunho",
  REVIEW: "Aguardando Aprovação",
  PUBLISHED: "Publicado",
};

const STATUS_BADGE_CLASS: Record<PostStatus, string> = {
  DRAFT: "border-white/20 bg-white/5 text-slate-300",
  REVIEW: "border-amber-400/50 bg-amber-400/15 text-amber-300 font-semibold",
  PUBLISHED: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
};

const MOOD_OPTIONS = ["Dramático e sombrio", "Épico de batalha", "Minimalista técnico", "Retrô anime 90s", "Cinemático noturno"] as const;
const ASPECT_OPTIONS = [
  { value: "16:9", label: "16:9 · capa de artigo" },
  { value: "21:9", label: "21:9 · banner ultrawide" },
  { value: "1:1", label: "1:1 · destaque quadrado" },
] as const;

function slugifyClient(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

type FormState = {
  id: string | null;
  title: string;
  slug: string;
  slugTouched: boolean;
  excerpt: string;
  contentMd: string;
  coverImage: string;
  youtubeUrl: string;
  postType: PostType;
  status: PostStatus;
  generationMeta?: {
    provider: "gemini" | "claude" | "fallback";
    model: string | null;
    prompt: string;
  } | null;
};

const emptyForm: FormState = {
  id: null,
  title: "",
  slug: "",
  slugTouched: false,
  excerpt: "",
  contentMd: "",
  coverImage: "",
  youtubeUrl: "",
  postType: "NEWS",
  status: "REVIEW",
  generationMeta: null,
};

type AiDialogState = {
  topic: string;
  category: PostType;
  context: string;
  rules: string;
  cardReferences: string;
  imageMode: "CARD_ART" | "CUSTOM_URL" | "AI_PROMPT";
  customImageUrl: string;
};

const defaultAiState: AiDialogState = {
  topic: "",
  category: "REVIEW",
  context: "",
  rules: "",
  cardReferences: "",
  imageMode: "CARD_ART",
  customImageUrl: "",
};

function CoverPromptGenerator({
  title,
  postType,
  coverImage,
  onApplyImage,
}: {
  title: string;
  postType: PostType;
  coverImage: string;
  onApplyImage: (url: string) => void;
}) {
  const [series, setSeries] = useState<TaxonomyEntry[]>([]);
  const [seriesRef, setSeriesRef] = useState("");
  const [mood, setMood] = useState<(typeof MOOD_OPTIONS)[number]>(MOOD_OPTIONS[0]);
  const [aspect, setAspect] = useState<(typeof ASPECT_OPTIONS)[number]["value"]>("16:9");
  const [cardQuery, setCardQuery] = useState("");
  const [cardResults, setCardResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api.listTaxonomies("SOURCE_TITLE").then(setSeries).catch(() => undefined);
  }, []);

  useEffect(() => {
    const term = cardQuery.trim();
    if (term.length < 2) return;
    setSearching(true);
    const timeout = setTimeout(() => {
      api.listCards({ q: term })
        .then((results) => setCardResults(results.slice(0, 8)))
        .catch(() => setCardResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [cardQuery]);

  const visibleCardResults = cardQuery.trim().length >= 2 ? cardResults : [];

  const prompt = useMemo(() => {
    const subject = title.trim() || "artigo do Anaheim Hub";
    const kind = POST_TYPE_LABEL[postType];
    const lines = [
      `Key visual illustration for a Mobile Suit Gundam Card Game article ("${subject}", category: ${kind}).`,
      seriesRef ? `Visual reference / universe: ${seriesRef}.` : null,
      `Mood: ${mood}.`,
      "Style: official Gundam anime key visual, cel-shaded mecha illustration, dramatic lighting, dynamic camera angle, highly detailed mobile suit armor.",
      `Aspect ratio: ${aspect}. No text, no logos, no watermarks.`,
    ].filter(Boolean);
    return lines.join("\n");
  }, [title, postType, seriesRef, mood, aspect]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copiado — cole na ferramenta de imagem de sua preferência.");
    } catch {
      toast.error("Não deu pra copiar automaticamente. Selecione o texto manualmente.");
    }
  };

  return (
    <Card className="panel-cut rounded-none surface-panel">
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Gerador de capa temática</p>
          <p className="mt-1 text-sm text-slate-400">
            Monta um prompt em inglês para colar numa ferramenta de imagem (Gemini, etc.) — ou escolha direto uma arte oficial de carta abaixo.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <select value={seriesRef} onChange={(e) => setSeriesRef(e.target.value)} className="field-shell h-10 px-3 text-sm">
            <option value="">Sem referência de série</option>
            {series.map((entry) => (
              <option key={entry.id} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
          <select value={mood} onChange={(e) => setMood(e.target.value as (typeof MOOD_OPTIONS)[number])} className="field-shell h-10 px-3 text-sm">
            {MOOD_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value as (typeof ASPECT_OPTIONS)[number]["value"])}
            className="field-shell h-10 px-3 text-sm sm:col-span-2"
          >
            {ASPECT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Textarea readOnly value={prompt} rows={5} className="rounded-none font-mono text-xs text-slate-300" />
        <Button type="button" variant="outline" className="rounded-none" onClick={copyPrompt}>
          <ClipboardCopy className="mr-2 size-4" />
          Copiar prompt
        </Button>

        <div className="border-t border-white/10 pt-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Ou usar arte oficial de carta como capa</p>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={cardQuery}
              onChange={(e) => setCardQuery(e.target.value)}
              placeholder="Buscar carta por nome ou código..."
              className="rounded-none pl-9"
            />
          </div>
          {searching ? <p className="mt-2 text-xs text-slate-500">Buscando...</p> : null}
          {visibleCardResults.length ? (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
              {visibleCardResults.map((card) => {
                const image = card.imageLargeUrl || card.imageMediumUrl || card.imageSmallUrl || card.imageUrl;
                const active = coverImage === image;
                return (
                  <button
                    key={card.id}
                    type="button"
                    title={card.namePt || card.nameEn}
                    onClick={() => image && onApplyImage(image)}
                    className={`aspect-[3/4] overflow-hidden border transition ${active ? "border-primary" : "border-white/10 hover:border-white/30"}`}
                  >
                    {image ? <img loading="lazy" decoding="async" src={image} alt={card.namePt || card.nameEn} className="h-full w-full object-cover" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminArticlesPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"ALL" | PostStatus>("ALL");
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Modal de geração com Agente de IA
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiState, setAiState] = useState<AiDialogState>(defaultAiState);
  const [generatingAi, setGeneratingAi] = useState(false);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const loadPosts = () => {
    setLoading(true);
    api.listPosts()
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const counts = useMemo(() => {
    const total = posts.length;
    const review = posts.filter((p) => p.status === "REVIEW").length;
    const published = posts.filter((p) => p.status === "PUBLISHED").length;
    const draft = posts.filter((p) => p.status === "DRAFT").length;
    return { total, review, published, draft };
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (statusFilter === "ALL") return posts;
    return posts.filter((p) => p.status === statusFilter);
  }, [posts, statusFilter]);

  const openNew = () => setEditing({ ...emptyForm, status: "REVIEW" });

  const openEdit = (post: ApiPost) =>
    setEditing({
      id: post.id,
      title: post.title,
      slug: post.slug,
      slugTouched: true,
      excerpt: post.excerpt || "",
      contentMd: post.contentMd,
      coverImage: post.coverImage || "",
      youtubeUrl: post.youtubeUrl || "",
      postType: post.postType,
      status: post.status,
    });

  const updateTitle = (title: string) =>
    setEditing((current) => current && { ...current, title, slug: current.slugTouched ? current.slug : slugifyClient(title) });

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editing) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.uploadAssetImage(formData);
      setEditing((current) => current && { ...current, coverImage: result.imageUrl });
      toast.success("Capa enviada.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar capa.");
    } finally {
      setSaving(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleGenerateAi = async () => {
    if (!aiState.topic.trim()) {
      toast.error("Informe o tema ou pauta do artigo.");
      return;
    }
    setGeneratingAi(true);
    try {
      const cardRefs = aiState.cardReferences
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await api.generateArticleWithAi({
        topic: aiState.topic.trim(),
        category: aiState.category,
        context: aiState.context.trim() || undefined,
        rules: aiState.rules.trim() || undefined,
        cardReferences: cardRefs,
        imageMode: aiState.imageMode,
        customImageUrl: aiState.customImageUrl.trim() || undefined,
      });

      if (!res.ok || !res.article) {
        throw new Error("Resposta inválida da IA ao gerar artigo.");
      }

      setEditing({
        id: null,
        title: res.article.title,
        slug: res.article.slug || slugifyClient(res.article.title),
        slugTouched: true,
        excerpt: res.article.excerpt || "",
        contentMd: res.article.contentMd || "",
        coverImage: res.article.coverImage || "",
        youtubeUrl: "",
        postType: res.article.postType || aiState.category,
        status: "REVIEW", // Criado para aprovação prévia
        generationMeta: res.article.generationMeta || null,
      });

      setIsAiDialogOpen(false);
      if (res.article.generationMeta?.provider === "fallback") {
        toast.warning("Atenção: Nenhuma IA conectada respondeu. O artigo foi estruturado pelo modelo fixo de contingência.");
      } else {
        const provName = res.article.generationMeta?.provider === "gemini" ? "Gemini" : "Claude";
        toast.success(`Artigo gerado com sucesso via ${provName} (${res.article.generationMeta?.model || ""})!`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar artigo com IA.");
    } finally {
      setGeneratingAi(false);
    }
  };

  const savePost = async (targetStatus?: PostStatus) => {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast.error("Título é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const statusToSave = targetStatus || editing.status;
      const payload = {
        title: editing.title.trim(),
        slug: editing.slug.trim() || slugifyClient(editing.title),
        excerpt: editing.excerpt.trim() || null,
        contentMd: editing.contentMd,
        coverImage: editing.coverImage.trim() || null,
        youtubeUrl: editing.youtubeUrl.trim() || null,
        postType: editing.postType,
        status: statusToSave,
      };

      let savedPost: ApiPost;
      if (editing.id) {
        savedPost = await api.updatePost(editing.id, payload);
      } else {
        savedPost = await api.createPost(payload);
      }

      setEditing(null);
      loadPosts();

      if (statusToSave === "REVIEW") {
        toast.success("Artigo salvo em revisão (aguardando aprovação).");
      } else if (statusToSave === "PUBLISHED") {
        toast.success("Artigo salvo e publicado! Rascunho para Instagram enfileirado.");
      } else {
        toast.success(editing.id ? "Artigo atualizado." : "Artigo salvo como rascunho.");
      }
      return savedPost;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar artigo.");
    } finally {
      setSaving(false);
    }
  };

  const handleApproveArticle = async (post: ApiPost) => {
    if (!window.confirm(`Aprovar e publicar o artigo "${post.title}"?\n\nEle será publicado no site e disparará automaticamente a postagem e o Story de notificação no Instagram.`)) {
      return;
    }
    setApprovingId(post.id);
    try {
      const res = await api.approveArticle(post.id, { publishSocialNow: true });
      if (res.ok) {
        toast.success("Artigo aprovado e publicado! Post e Story do Instagram foram acionados simultaneamente.");
        loadPosts();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao aprovar artigo.");
    } finally {
      setApprovingId(null);
    }
  };

  const approveAndPublishFromEditor = async () => {
    if (!editing) return;
    const saved = await savePost("PUBLISHED");
    if (saved && saved.id) {
      try {
        await api.approveArticle(saved.id, { publishSocialNow: true });
        toast.success("Artigo aprovado e publicado com sucesso no site e no Instagram!");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Artigo salvo, mas houve aviso na publicação social.");
      }
    }
  };

  const deletePost = async (post: ApiPost) => {
    if (!window.confirm(`Excluir "${post.title}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await api.deletePost(post.id);
      loadPosts();
      toast.success("Artigo excluído.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir artigo.");
    }
  };

  if (user?.role !== "ADMIN" && user?.role !== "EDITOR") {
    return (
      <AdminShell breadcrumbs={[{ label: "Artigos" }]}>
        <Card className="panel-cut rounded-none surface-panel">
          <CardContent className="p-6">Essa área é exclusiva para administradores e editores.</CardContent>
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell breadcrumbs={[{ label: "Artigos" }]}>
      <div className="space-y-6">
        {!editing ? (
          <>
            <Card className="panel-cut rounded-none border-primary/30 hero-surface">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Módulo Editorial & Anaheim Media</p>
                  <h2 className="mt-2 font-heading text-4xl uppercase leading-none">Artigos & Conteúdo</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Artigos manuais e gerados com IA. Ao aprovar, o artigo é publicado no portal e transmitido simultaneamente via Feed + Story no Instagram.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-none border-primary/50 text-primary hover:bg-primary/10"
                    onClick={() => {
                      setAiState(defaultAiState);
                      setIsAiDialogOpen(true);
                    }}
                  >
                    <Sparkles className="mr-2 size-4 text-primary" />
                    Gerar Artigo com IA
                  </Button>
                  <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={openNew}>
                    <Plus className="mr-2 size-4" />
                    Novo artigo
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Abas de filtragem por status */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
              <Button
                type="button"
                size="sm"
                variant={statusFilter === "ALL" ? "default" : "outline"}
                className="rounded-none text-xs uppercase"
                onClick={() => setStatusFilter("ALL")}
              >
                Todos ({counts.total})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === "REVIEW" ? "default" : "outline"}
                className={`rounded-none text-xs uppercase ${
                  statusFilter === "REVIEW" ? "bg-amber-500 text-black hover:bg-amber-400" : "border-amber-400/40 text-amber-300"
                }`}
                onClick={() => setStatusFilter("REVIEW")}
              >
                Aguardando Aprovação ({counts.review})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === "PUBLISHED" ? "default" : "outline"}
                className={`rounded-none text-xs uppercase ${
                  statusFilter === "PUBLISHED" ? "bg-emerald-600 text-white hover:bg-emerald-500" : "border-emerald-400/40 text-emerald-300"
                }`}
                onClick={() => setStatusFilter("PUBLISHED")}
              >
                Publicados ({counts.published})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === "DRAFT" ? "default" : "outline"}
                className="rounded-none text-xs uppercase"
                onClick={() => setStatusFilter("DRAFT")}
              >
                Rascunhos ({counts.draft})
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Carregando artigos...</p>
            ) : filteredPosts.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum artigo encontrado nesta categoria.</p>
            ) : (
              <div className="space-y-2">
                {filteredPosts.map((post) => {
                  const isAwaitingApproval = post.status === "REVIEW";
                  return (
                    <Card
                      key={post.id}
                      className={`panel-cut rounded-none surface-panel transition ${
                        isAwaitingApproval ? "border-amber-400/40 bg-amber-950/10" : ""
                      }`}
                    >
                      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`rounded-none border ${STATUS_BADGE_CLASS[post.status]}`}>
                              {POST_STATUS_LABEL[post.status]}
                            </Badge>
                            <Badge variant="outline" className="rounded-none border-white/15 bg-white/5 text-slate-300">
                              {POST_TYPE_LABEL[post.postType]}
                            </Badge>
                            <span className="text-xs text-slate-500">/articles/{post.slug}</span>
                          </div>
                          <h3 className="mt-1 truncate font-heading text-xl uppercase text-white">{post.title}</h3>
                          {post.excerpt ? (
                            <p className="mt-1 line-clamp-1 text-xs text-slate-400">{post.excerpt}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {isAwaitingApproval ? (
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-none bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                              disabled={approvingId === post.id}
                              onClick={() => handleApproveArticle(post)}
                              title="Publica no site e transmite Post + Story simultaneamente no Instagram"
                            >
                              <CheckCircle2 className="mr-1.5 size-3.5" />
                              {approvingId === post.id ? "Aprovando..." : "Aprovar & Publicar"}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-none"
                            onClick={() => openEdit(post)}
                          >
                            <Pencil className="mr-1.5 size-3.5" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-none border-red-500/30 text-red-300 hover:bg-red-500/10"
                            onClick={() => deletePost(post)}
                          >
                            <Trash2 className="mr-1.5 size-3.5" />
                            Excluir
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h2 className="font-heading text-3xl uppercase">{editing.id ? "Editar artigo" : "Novo artigo"}</h2>
                <p className="text-xs text-slate-400">
                  {editing.status === "REVIEW"
                    ? "Status atual: Aguardando Aprovação (não visível publicamente)."
                    : editing.status === "PUBLISHED"
                      ? "Status atual: Publicado no site."
                      : "Status atual: Rascunho interno."}
                </p>
              </div>

              {editing.generationMeta && (
                <div className="w-full rounded border border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-primary" />
                      Origem da Geração:
                    </span>
                    {editing.generationMeta.provider === "gemini" && (
                      <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/10 text-emerald-300 font-mono text-[11px]">
                        Gemini ({editing.generationMeta.model || "3.8 Flash"})
                      </Badge>
                    )}
                    {editing.generationMeta.provider === "claude" && (
                      <Badge variant="outline" className="border-purple-400/40 bg-purple-400/10 text-purple-300 font-mono text-[11px]">
                        Claude ({editing.generationMeta.model})
                      </Badge>
                    )}
                    {editing.generationMeta.provider === "fallback" && (
                      <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-300 font-mono text-[11px]">
                        ⚠️ Modelo Fixo (Fallback - sem IA)
                      </Badge>
                    )}
                  </div>
                  {editing.generationMeta.prompt && (
                    <details className="group">
                      <summary className="cursor-pointer text-[11px] text-primary hover:underline font-mono select-none">
                        ▶ Ver prompt completo usado para gerar este artigo
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-300 bg-slate-950/80 p-2.5 border border-white/10 max-h-48 overflow-y-auto">
                        {editing.generationMeta.prompt}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="rounded-none" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none border-white/20 text-slate-200"
                  disabled={saving}
                  onClick={() => savePost("DRAFT")}
                >
                  Salvar Rascunho
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none border-amber-400/50 text-amber-300 hover:bg-amber-400/10"
                  disabled={saving}
                  onClick={() => savePost("REVIEW")}
                >
                  Salvar p/ Aprovação
                </Button>
                <Button
                  type="button"
                  className="rounded-none bg-emerald-600 text-white hover:bg-emerald-500"
                  disabled={saving}
                  onClick={approveAndPublishFromEditor}
                  title="Publica no site e envia post + story para o Instagram"
                >
                  <CheckCircle2 className="mr-1.5 size-4" />
                  {saving ? "Salvando..." : "Aprovar & Publicar"}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-4">
                <Card className="panel-cut rounded-none surface-panel">
                  <CardContent className="space-y-4 p-5">
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Título</label>
                      <Input value={editing.title} onChange={(e) => updateTitle(e.target.value)} className="mt-1.5 rounded-none" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Slug (URL)</label>
                      <Input
                        value={editing.slug}
                        onChange={(e) => setEditing((c) => c && { ...c, slug: slugifyClient(e.target.value), slugTouched: true })}
                        className="mt-1.5 rounded-none font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Resumo / Subtítulo</label>
                      <Textarea value={editing.excerpt} onChange={(e) => setEditing((c) => c && { ...c, excerpt: e.target.value })} rows={2} className="mt-1.5 rounded-none" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Tipo de Conteúdo</label>
                        <select
                          value={editing.postType}
                          onChange={(e) => setEditing((c) => c && { ...c, postType: e.target.value as PostType })}
                          className="field-shell mt-1.5 h-10 w-full px-3 text-sm"
                        >
                          {(Object.keys(POST_TYPE_LABEL) as PostType[]).map((type) => (
                            <option key={type} value={type}>
                              {POST_TYPE_LABEL[type]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Status Editorial</label>
                        <select
                          value={editing.status}
                          onChange={(e) => setEditing((c) => c && { ...c, status: e.target.value as PostStatus })}
                          className="field-shell mt-1.5 h-10 w-full px-3 text-sm"
                        >
                          {(Object.keys(POST_STATUS_LABEL) as PostStatus[]).map((status) => (
                            <option key={status} value={status}>
                              {POST_STATUS_LABEL[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">URL do YouTube (opcional)</label>
                      <Input
                        value={editing.youtubeUrl}
                        onChange={(e) => setEditing((c) => c && { ...c, youtubeUrl: e.target.value })}
                        placeholder="https://youtube.com/watch?v=..."
                        className="mt-1.5 rounded-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Imagem de Capa (Feed / Banner / Story)</label>
                      <div className="mt-1.5 flex items-center gap-3">
                        <Input
                          value={editing.coverImage}
                          onChange={(e) => setEditing((c) => c && { ...c, coverImage: e.target.value })}
                          placeholder="URL da imagem de capa"
                          className="rounded-none"
                        />
                        <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 rounded-none"
                          disabled={saving}
                          onClick={() => uploadInputRef.current?.click()}
                        >
                          <Upload className="mr-2 size-4" />
                          Enviar
                        </Button>
                      </div>
                      {editing.coverImage ? (
                        <div className="mt-2 aspect-[16/9] w-full max-w-sm overflow-hidden border border-white/10">
                          <img loading="lazy" decoding="async" src={editing.coverImage} alt="Capa" className="h-full w-full object-cover" />
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Conteúdo (Markdown — use [[GD01-001]] ou [[Nome da Carta]] para citar uma carta com hovercard)
                      </label>
                      <Textarea
                        value={editing.contentMd}
                        onChange={(e) => setEditing((c) => c && { ...c, contentMd: e.target.value })}
                        rows={18}
                        className="mt-1.5 rounded-none font-mono text-xs"
                      />
                    </div>
                  </CardContent>
                </Card>

                <CoverPromptGenerator
                  title={editing.title}
                  postType={editing.postType}
                  coverImage={editing.coverImage}
                  onApplyImage={(url) => setEditing((c) => c && { ...c, coverImage: url })}
                />
              </div>

              <div className="xl:sticky xl:top-20 xl:self-start">
                <Card className="panel-cut rounded-none surface-panel">
                  <CardContent className="max-h-[calc(100vh-8rem)] overflow-y-auto p-6 sm:p-8">
                    <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-2">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Pré-visualização em tempo real</p>
                      <Badge className={`rounded-none border ${STATUS_BADGE_CLASS[editing.status]}`}>
                        {POST_STATUS_LABEL[editing.status]}
                      </Badge>
                    </div>
                    <h1 className="font-heading text-3xl uppercase leading-tight text-white">{editing.title || "Título do artigo"}</h1>
                    {editing.excerpt ? <p className="mt-3 text-sm leading-7 text-slate-300">{editing.excerpt}</p> : null}
                    {editing.coverImage ? (
                      <div className="my-4 aspect-[16/9] w-full overflow-hidden border border-white/10">
                        <img loading="lazy" decoding="async" src={editing.coverImage} alt="Capa do artigo" className="h-full w-full object-cover" />
                      </div>
                    ) : null}
                    <div className="mt-4">
                      <CardMarkdown content={editing.contentMd || "_Comece a escrever no editor à esquerda ou use o Agente de IA para gerar uma base analítica..._"} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Gerar Artigo com Agente de IA */}
        <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
          <DialogContent className="max-w-2xl border-primary/40 bg-slate-950 p-6 text-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading text-2xl uppercase tracking-wide text-white">
                <Sparkles className="size-5 text-primary" />
                Agente Editorial de IA (Gundam TCG)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Persona especializada: jornalista de games e big tech com perfil analítico de card games (ChannelFireball / IGN). O artigo será criado no estado
                "Aguardando Aprovação", permitindo revisar texto, citações de cartas [[CODIGO]], capas e aprovar com post + Story simultâneos no Instagram.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Pauta / Assunto Principal *</label>
                <Input
                  value={aiState.topic}
                  onChange={(e) => setAiState((s) => ({ ...s, topic: e.target.value }))}
                  placeholder="Ex: Impacto das cartas Secret Rare de GD06 no metagame competitivo"
                  className="mt-1.5 rounded-none bg-slate-900"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Categoria</label>
                  <select
                    value={aiState.category}
                    onChange={(e) => setAiState((s) => ({ ...s, category: e.target.value as PostType }))}
                    className="field-shell mt-1.5 h-10 w-full px-3 text-sm bg-slate-900"
                  >
                    {(Object.keys(POST_TYPE_LABEL) as PostType[]).map((t) => (
                      <option key={t} value={t}>
                        {POST_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Modo de Capa</label>
                  <select
                    value={aiState.imageMode}
                    onChange={(e) => setAiState((s) => ({ ...s, imageMode: e.target.value as any }))}
                    className="field-shell mt-1.5 h-10 w-full px-3 text-sm bg-slate-900"
                  >
                    <option value="CARD_ART">Arte Oficial do Catálogo Anaheim</option>
                    <option value="CUSTOM_URL">URL de imagem personalizada</option>
                    <option value="AI_PROMPT">Gerar Prompt descritivo de Capa</option>
                  </select>
                </div>
              </div>

              {aiState.imageMode === "CUSTOM_URL" ? (
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400">URL da Imagem de Capa</label>
                  <Input
                    value={aiState.customImageUrl}
                    onChange={(e) => setAiState((s) => ({ ...s, customImageUrl: e.target.value }))}
                    placeholder="https://exemplo.com/imagem-artigo.jpg"
                    className="mt-1.5 rounded-none bg-slate-900"
                  />
                </div>
              ) : null}

              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Cartas de Foco ou Códigos (separadas por vírgula)</label>
                <Input
                  value={aiState.cardReferences}
                  onChange={(e) => setAiState((s) => ({ ...s, cardReferences: e.target.value }))}
                  placeholder="Ex: GD01-010, ST01-001, Gundam Aerial, Unicorn Gundam"
                  className="mt-1.5 rounded-none bg-slate-900"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  A IA pesquisa dados oficiais destas cartas no banco para fundamentar estatísticas e citar com hovercard.
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Contexto, Regras e Dados do Evento / Torneio</label>
                <Textarea
                  value={aiState.context}
                  onChange={(e) => setAiState((s) => ({ ...s, context: e.target.value }))}
                  rows={3}
                  placeholder="Ex: Torneio nacional de 64 jogadores, decks Green Ramp e Red Aggro no Top 8, destaque para viradas no turno 4..."
                  className="mt-1.5 rounded-none bg-slate-900 font-sans text-xs"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Regras Editoriais ou Restrições Especiais</label>
                <Input
                  value={aiState.rules}
                  onChange={(e) => setAiState((s) => ({ ...s, rules: e.target.value }))}
                  placeholder="Ex: Focar em dicas para jogadores iniciantes; não antecipar erratas não confirmadas"
                  className="mt-1.5 rounded-none bg-slate-900 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between border-t border-white/10 pt-4">
              <Button type="button" variant="ghost" className="rounded-none" onClick={() => setIsAiDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="rounded-none bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                disabled={generatingAi || !aiState.topic.trim()}
                onClick={handleGenerateAi}
              >
                <Sparkles className="mr-2 size-4" />
                {generatingAi ? "Pesquisando e Escrevendo..." : "Gerar Artigo Completo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminShell>
  );
}

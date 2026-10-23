import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

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
  type: "CARD_SPOTLIGHT" | "DECK_FEATURE" | "META_INSIGHT" | "PRODUCT_AFFILIATE";
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PUBLISHING" | "PUBLISHED" | "REJECTED" | "FAILED";
  title: string | null;
  caption: string;
  cardCode: string | null;
  deckId: string | null;
  imageUrl: string | null;
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

interface SocialStatus {
  gemini: boolean;
  discord: boolean;
  instagram: boolean;
  renderer: boolean;
  scheduler: boolean;
  instagramTokenExpiresAt: string | null;
  schedule: { days: number[]; hour: number; minute: number; leadHours: number; next: string | null };
}

const CAPTION_MAX = 2200;
const HASHTAG_MAX = 30;
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
  const [customTopicInput, setCustomTopicInput] = useState("");
  const [selectedPost, setSelectedPost] = useState<SocialMediaPost | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<SocialStatus | null>(null);

  useEffect(() => {
    apiFetch<SocialStatus>("/admin/social/status")
      .then(setIntegrations)
      .catch(() => setIntegrations(null));
  }, []);

  const selectPost = (post: SocialMediaPost) => {
    setSelectedPost(post);
    setEditTitle(post.title || "");
    setEditCaption(post.caption || "");
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

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      toast.info("O Agente IA está gerando o texto e a arte em 1080x1350...");
      const newPost = await apiFetch<SocialMediaPost>("/admin/social/generate", {
        method: "POST",
        body: JSON.stringify({
          cardCode: cardCodeInput.trim() || undefined,
          customTopic: customTopicInput.trim() || undefined,
          type: "CARD_SPOTLIGHT",
        }),
      });
      toast.success("Rascunho criado com sucesso e notificado no Discord!");
      setCardCodeInput("");
      setCustomTopicInput("");
      setPosts((prev) => [newPost, ...prev]);
      selectPost(newPost);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao gerar post com IA.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveEdit = async (post: SocialMediaPost) => {
    try {
      setSavingId(post.id);
      const updated = await apiFetch<SocialMediaPost>(`/admin/social/posts/${post.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editTitle,
          caption: editCaption,
        }),
      });
      toast.success("Alterações salvas com sucesso!");
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
      setSelectedPost(updated);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar alterações.");
    } finally {
      setSavingId(null);
    }
  };

  const handleApprove = async (post: SocialMediaPost) => {
    try {
      setSavingId(post.id);
      const res = await apiFetch<{ ok: boolean; post: SocialMediaPost }>(`/admin/social/posts/${post.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ title: editTitle, caption: editCaption }),
      });
      if (res.post.status === "PUBLISHED") toast.success("Aprovado e publicado no Instagram!");
      else if (res.post.status === "FAILED") toast.error(res.post.publishError || "Aprovado, mas a publicação falhou.");
      else if (res.post.scheduledFor && new Date(res.post.scheduledFor).getTime() > Date.now()) toast.success(`Aprovado. Sai ${formatWhen(res.post.scheduledFor)}.`);
      else toast.success("Aprovado. Configure o Instagram no servidor para publicar automaticamente.");
      setPosts((prev) => prev.map((p) => (p.id === post.id ? res.post : p)));
      if (selectedPost?.id === post.id) setSelectedPost(res.post);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao aprovar post.");
    } finally {
      setSavingId(null);
    }
  };

  const handlePublishNow = async (post: SocialMediaPost) => {
    try {
      setSavingId(post.id);
      const res = await apiFetch<{ ok: boolean; post: SocialMediaPost }>(`/admin/social/posts/${post.id}/publish`, { method: "POST" });
      if (res.ok) toast.success("Publicado no Instagram!");
      else toast.error(res.post.publishError || "A publicação falhou.");
      setPosts((prev) => prev.map((p) => (p.id === post.id ? res.post : p)));
      if (selectedPost?.id === post.id) setSelectedPost(res.post);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao publicar.");
    } finally {
      setSavingId(null);
    }
  };

  const handleReject = async (post: SocialMediaPost) => {
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
      setSavingId(null);
    }
  };

  const handleDelete = async (post: SocialMediaPost) => {
    if (!confirm("Tem certeza que deseja excluir permanentemente este rascunho?")) return;
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
                  Gere rascunhos com arte 1080x1350 automática, legenda técnica e notificação instantânea no Discord
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase font-mono text-slate-300 block mb-1">
                  Código da Carta (Opcional)
                </label>
                <Input
                  placeholder="Ex: ST01-001 (vazio para carta aleatória)"
                  value={cardCodeInput}
                  onChange={(e) => setCardCodeInput(e.target.value.toUpperCase())}
                  className="rounded-none font-mono text-sm bg-slate-950/60"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Se vazio, o agente sorteia uma carta (impressão principal, com imagem) que não saiu nos últimos 60 posts.
                </span>
              </div>

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
                Legenda: {integrations?.gemini ? "Gemini" : "modelo fixo (sem GEMINI_API_KEY)"} · Arte: {integrations?.renderer ? "JPEG 1080x1350" : "navegador não instalado no servidor"}
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generating}
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
                          {post.cardCode || post.type}
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
                  {/* Prévia Visual da Imagem */}
                  <div className="md:col-span-5 space-y-2">
                    <label className="text-xs uppercase font-mono text-slate-300 block">
                      Arte 1080x1350 (Instagram)
                    </label>
                    <div className="border border-white/15 bg-slate-950 aspect-[4/5] relative overflow-hidden flex items-center justify-center group">
                      {selectedPost.imageUrl ? (
                        <>
                          <img
                            src={selectedPost.imageUrl}
                            alt="Arte do post"
                            className="size-full object-contain"
                          />
                          <a
                            href={selectedPost.imageUrl}
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
                    disabled={savingId === selectedPost.id || selectedPost.status === "PUBLISHED" || selectedPost.status === "PUBLISHING"}
                    className="rounded-none text-xs"
                  >
                    <Save className="size-3.5 mr-1.5" />
                    Salvar Alterações de Texto
                  </Button>

                  <div className="flex items-center gap-2">
                    {(selectedPost.status === "APPROVED" || selectedPost.status === "FAILED") && integrations?.instagram && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePublishNow(selectedPost)}
                        disabled={savingId === selectedPost.id}
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
                        disabled={savingId === selectedPost.id}
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
                        disabled={savingId === selectedPost.id}
                        className="rounded-none bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold uppercase tracking-wider text-xs px-4"
                      >
                        <CheckCircle2 className="size-3.5 mr-1.5" />
                        {selectedPost.scheduledFor && new Date(selectedPost.scheduledFor).getTime() > Date.now()
                          ? `Aprovar (sai ${formatWhen(selectedPost.scheduledFor)})`
                          : integrations?.instagram
                            ? "Aprovar e publicar agora"
                            : "Aprovar"}
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

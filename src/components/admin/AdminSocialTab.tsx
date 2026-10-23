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
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PUBLISHED" | "REJECTED" | "FAILED";
  title: string | null;
  caption: string;
  cardCode: string | null;
  deckId: string | null;
  imageUrl: string | null;
  discordMessageId: string | null;
  instagramPostId: string | null;
  publishedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
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
      });
      toast.success("Post aprovado e agendado com sucesso!");
      setPosts((prev) => prev.map((p) => (p.id === post.id ? res.post : p)));
      if (selectedPost?.id === post.id) setSelectedPost(res.post);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao aprovar post.");
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
                  Se vazio, o agente escolhe uma carta relevante que não foi postada nos últimos 30 dias.
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
                Motor: Gemini 3.8 Flash + Playwright Headless (1080x1350)
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

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-white/[0.02] border border-white/10">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-indigo-400" />
                  <span className="text-slate-200 font-semibold">Discord Webhook</span>
                </div>
                <Badge variant="outline" className="border-indigo-400/40 text-indigo-300">
                  Notificações Ativas
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white/[0.02] border border-white/10">
                <div className="flex items-center gap-2">
                  <InstagramIcon className="size-4 text-pink-400" />
                  <span className="text-slate-200 font-semibold">Instagram Graph API</span>
                </div>
                <Badge variant="outline" className="border-slate-500 text-slate-400">
                  Pronto para Vincular
                </Badge>
              </div>

              <div className="p-3 bg-sky-500/10 border-l-2 border-sky-400 text-[11px] text-sky-200 leading-relaxed">
                Quando um post é gerado, o Discord recebe uma prévia imediata com link direto para aprovar ou editar por aqui.
              </div>
            </div>
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
                        <span className="text-[11px] font-mono text-slate-400">
                          {editCaption.length} caracteres
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

                {/* Barra de Ações Inferior */}
                <div className="border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveEdit(selectedPost)}
                    disabled={savingId === selectedPost.id}
                    className="rounded-none text-xs"
                  >
                    <Save className="size-3.5 mr-1.5" />
                    Salvar Alterações de Texto
                  </Button>

                  <div className="flex items-center gap-2">
                    {selectedPost.status !== "REJECTED" && (
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

                    {selectedPost.status !== "APPROVED" && selectedPost.status !== "PUBLISHED" && (
                      <Button
                        size="sm"
                        onClick={() => handleApprove(selectedPost)}
                        disabled={savingId === selectedPost.id}
                        className="rounded-none bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold uppercase tracking-wider text-xs px-4"
                      >
                        <CheckCircle2 className="size-3.5 mr-1.5" />
                        Aprovar e Agendar Publicação
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

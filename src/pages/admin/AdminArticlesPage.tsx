/* Módulo Editorial (Content Hub) — CMS administrativo de artigos (model Post). Lista +
 * editor com preview split-screen (CardMarkdown, mesmo renderer do leitor público) e um
 * gerador de prompt de capa temática (texto pronto pra colar em Nano Banana/Gemini/etc,
 * já que este projeto não tem uma chave de geração de imagem integrada) + busca de arte
 * oficial de cartas pra usar direto como capa. */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardCopy, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";

import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CardMarkdown } from "@/components/articles/CardMarkdown";
import { useAuth } from "@/contexts/AuthContext";
import { api, type ApiPost, type PostStatus, type PostType, type TaxonomyEntry } from "@/lib/api";

const POST_TYPE_LABEL: Record<PostType, string> = { NEWS: "Notícia", PREVIEW: "Preview", REVIEW: "Análise", GUIDE: "Guia" };
const POST_STATUS_LABEL: Record<PostStatus, string> = { DRAFT: "Rascunho", REVIEW: "Em revisão", PUBLISHED: "Publicado" };
const STATUS_BADGE_CLASS: Record<PostStatus, string> = {
  DRAFT: "border-white/20 bg-white/5 text-slate-300",
  REVIEW: "border-amber-400/40 bg-amber-400/10 text-amber-300",
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
};

const emptyForm: FormState = { id: null, title: "", slug: "", slugTouched: false, excerpt: "", contentMd: "", coverImage: "", youtubeUrl: "", postType: "NEWS", status: "DRAFT" };

function CoverPromptGenerator({ title, postType, coverImage, onApplyImage }: { title: string; postType: PostType; coverImage: string; onApplyImage: (url: string) => void }) {
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
      api.listCards({ q: term }).then((results) => setCardResults(results.slice(0, 8))).catch(() => setCardResults([])).finally(() => setSearching(false));
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
      toast.success("Prompt copiado — cole no Nano Banana / Gemini / ferramenta de imagem de sua preferência.");
    } catch {
      toast.error("Não deu pra copiar automaticamente. Selecione o texto manualmente.");
    }
  };

  return (
    <Card className="panel-cut rounded-none surface-panel">
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Gerador de capa temática</p>
          <p className="mt-1 text-sm text-slate-400">Monta um prompt em inglês pra colar numa ferramenta de imagem (Nano Banana, Gemini, etc.) — ou escolha direto uma arte oficial de carta abaixo.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <select value={seriesRef} onChange={(e) => setSeriesRef(e.target.value)} className="field-shell h-10 px-3 text-sm">
            <option value="">Sem referência de série</option>
            {series.map((entry) => <option key={entry.id} value={entry.name}>{entry.name}</option>)}
          </select>
          <select value={mood} onChange={(e) => setMood(e.target.value as (typeof MOOD_OPTIONS)[number])} className="field-shell h-10 px-3 text-sm">
            {MOOD_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={aspect} onChange={(e) => setAspect(e.target.value as (typeof ASPECT_OPTIONS)[number]["value"])} className="field-shell h-10 px-3 text-sm sm:col-span-2">
            {ASPECT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <Textarea readOnly value={prompt} rows={5} className="rounded-none font-mono text-xs text-slate-300" />
        <Button type="button" variant="outline" className="rounded-none" onClick={copyPrompt}><ClipboardCopy className="mr-2 size-4" />Copiar prompt</Button>

        <div className="border-t border-white/10 pt-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Ou usar arte oficial de carta como capa</p>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input value={cardQuery} onChange={(e) => setCardQuery(e.target.value)} placeholder="Buscar carta por nome ou código..." className="rounded-none pl-9" />
          </div>
          {searching ? <p className="mt-2 text-xs text-slate-500">Buscando...</p> : null}
          {visibleCardResults.length ? (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
              {visibleCardResults.map((card) => {
                const image = card.imageLargeUrl || card.imageMediumUrl || card.imageSmallUrl || card.imageUrl;
                const active = coverImage === image;
                return (
                  <button key={card.id} type="button" title={card.namePt || card.nameEn} onClick={() => image && onApplyImage(image)} className={`aspect-[3/4] overflow-hidden border transition ${active ? "border-primary" : "border-white/10 hover:border-white/30"}`}>
                    {image ? <img src={image} alt={card.namePt || card.nameEn} className="h-full w-full object-cover" /> : null}
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
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const loadPosts = () => {
    setLoading(true);
    api.listPosts().then(setPosts).catch(() => setPosts([])).finally(() => setLoading(false));
  };

  useEffect(() => { loadPosts(); }, []);

  const openNew = () => setEditing({ ...emptyForm });
  const openEdit = (post: ApiPost) => setEditing({
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

  const updateTitle = (title: string) => setEditing((current) => current && ({ ...current, title, slug: current.slugTouched ? current.slug : slugifyClient(title) }));

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editing) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.uploadAssetImage(formData);
      setEditing((current) => current && ({ ...current, coverImage: result.imageUrl }));
      toast.success("Capa enviada.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar capa.");
    } finally {
      setSaving(false);
      if (event.target) event.target.value = "";
    }
  };

  const savePost = async () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast.error("Título é obrigatório."); return; }
    setSaving(true);
    try {
      const payload = {
        title: editing.title.trim(),
        slug: editing.slug.trim() || slugifyClient(editing.title),
        excerpt: editing.excerpt.trim() || null,
        contentMd: editing.contentMd,
        coverImage: editing.coverImage.trim() || null,
        youtubeUrl: editing.youtubeUrl.trim() || null,
        postType: editing.postType,
        status: editing.status,
      };
      if (editing.id) await api.updatePost(editing.id, payload); else await api.createPost(payload);
      setEditing(null);
      loadPosts();
      toast.success(editing.id ? "Artigo atualizado." : "Artigo criado.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar artigo.");
    } finally {
      setSaving(false);
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

  if (user?.role !== "ADMIN") {
    return <PortalShell breadcrumbs={[{ label: "Artigos" }]}><Card className="panel-cut rounded-none surface-panel"><CardContent className="p-6">Essa área é exclusiva para administradores.</CardContent></Card></PortalShell>;
  }

  return (
    <PortalShell breadcrumbs={[{ label: "Artigos" }]}>
      <div className="space-y-6">
        {!editing ? (
          <>
            <Card className="panel-cut rounded-none border-primary/30 hero-surface">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Módulo Editorial</p>
                  <h2 className="mt-2 font-heading text-4xl uppercase leading-none">Artigos</h2>
                </div>
                <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={openNew}><Plus className="mr-2 size-4" />Novo artigo</Button>
              </CardContent>
            </Card>

            {loading ? (
              <p className="text-sm text-slate-400">Carregando artigos...</p>
            ) : posts.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum artigo cadastrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {posts.map((post) => (
                  <Card key={post.id} className="panel-cut rounded-none surface-panel">
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={`rounded-none border ${STATUS_BADGE_CLASS[post.status]}`}>{POST_STATUS_LABEL[post.status]}</Badge>
                          <Badge variant="outline" className="rounded-none border-white/15 bg-white/5 text-slate-300">{POST_TYPE_LABEL[post.postType]}</Badge>
                          <span className="text-xs text-slate-500">/articles/{post.slug}</span>
                        </div>
                        <h3 className="mt-1 truncate font-heading text-xl uppercase">{post.title}</h3>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button type="button" variant="outline" size="sm" className="rounded-none" onClick={() => openEdit(post)}><Pencil className="mr-1.5 size-3.5" />Editar</Button>
                        <Button type="button" variant="outline" size="sm" className="rounded-none border-red-500/30 text-red-300 hover:bg-red-500/10" onClick={() => deletePost(post)}><Trash2 className="mr-1.5 size-3.5" />Excluir</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-heading text-3xl uppercase">{editing.id ? "Editar artigo" : "Novo artigo"}</h2>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="rounded-none" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button type="button" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving} onClick={savePost}>{saving ? "Salvando..." : "Salvar"}</Button>
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
                      <Input value={editing.slug} onChange={(e) => setEditing((c) => c && ({ ...c, slug: slugifyClient(e.target.value), slugTouched: true }))} className="mt-1.5 rounded-none font-mono text-sm" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Resumo</label>
                      <Textarea value={editing.excerpt} onChange={(e) => setEditing((c) => c && ({ ...c, excerpt: e.target.value }))} rows={2} className="mt-1.5 rounded-none" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Tipo</label>
                        <select value={editing.postType} onChange={(e) => setEditing((c) => c && ({ ...c, postType: e.target.value as PostType }))} className="field-shell mt-1.5 h-10 w-full px-3 text-sm">
                          {(Object.keys(POST_TYPE_LABEL) as PostType[]).map((type) => <option key={type} value={type}>{POST_TYPE_LABEL[type]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</label>
                        <select value={editing.status} onChange={(e) => setEditing((c) => c && ({ ...c, status: e.target.value as PostStatus }))} className="field-shell mt-1.5 h-10 w-full px-3 text-sm">
                          {(Object.keys(POST_STATUS_LABEL) as PostStatus[]).map((status) => <option key={status} value={status}>{POST_STATUS_LABEL[status]}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">URL do YouTube (opcional)</label>
                      <Input value={editing.youtubeUrl} onChange={(e) => setEditing((c) => c && ({ ...c, youtubeUrl: e.target.value }))} placeholder="https://youtube.com/watch?v=..." className="mt-1.5 rounded-none" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Capa</label>
                      <div className="mt-1.5 flex items-center gap-3">
                        <Input value={editing.coverImage} onChange={(e) => setEditing((c) => c && ({ ...c, coverImage: e.target.value }))} placeholder="URL da imagem de capa" className="rounded-none" />
                        <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                        <Button type="button" variant="outline" className="shrink-0 rounded-none" disabled={saving} onClick={() => uploadInputRef.current?.click()}><Upload className="mr-2 size-4" />Enviar</Button>
                      </div>
                      {editing.coverImage ? <div className="mt-2 aspect-[16/9] w-full max-w-sm overflow-hidden border border-white/10"><img src={editing.coverImage} alt="Capa" className="h-full w-full object-cover" /></div> : null}
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Conteúdo (Markdown — use [[GD01-001]] ou [[Nome da Carta]] pra citar uma carta com hovercard)</label>
                      <Textarea value={editing.contentMd} onChange={(e) => setEditing((c) => c && ({ ...c, contentMd: e.target.value }))} rows={18} className="mt-1.5 rounded-none font-mono text-xs" />
                    </div>
                  </CardContent>
                </Card>

                <CoverPromptGenerator title={editing.title} postType={editing.postType} coverImage={editing.coverImage} onApplyImage={(url) => setEditing((c) => c && ({ ...c, coverImage: url }))} />
              </div>

              <div className="xl:sticky xl:top-20 xl:self-start">
                <Card className="panel-cut rounded-none surface-panel">
                  <CardContent className="max-h-[calc(100vh-8rem)] overflow-y-auto p-6 sm:p-8">
                    <p className="mb-4 text-xs uppercase tracking-[0.22em] text-slate-500">Preview</p>
                    <h1 className="font-heading text-3xl uppercase leading-tight text-white">{editing.title || "Título do artigo"}</h1>
                    {editing.excerpt ? <p className="mt-3 text-sm leading-7 text-slate-300">{editing.excerpt}</p> : null}
                    <div className="mt-4">
                      <CardMarkdown content={editing.contentMd || "_Comece a escrever no editor à esquerda..._"} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}

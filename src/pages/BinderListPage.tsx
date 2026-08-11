/* Lista de binders do usuário — mesmo padrão do DeckListPage. Agora que binder
 * suporta múltiplos por tipo, essa tela é necessária (antes ia direto pro editor
 * fixo de WISHLIST/OWNED). */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, type ApiBinder } from "@/lib/api";

export default function BinderListPage() {
  const [, navigate] = useLocation();
  const [binders, setBinders] = useState<ApiBinder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const load = async (options?: { bypassCache?: boolean }) => {
    setLoading(true);
    try {
      const result = await api.listMyBinders(options);
      setBinders(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load().catch(() => undefined); }, []);

  const openCreateModal = () => {
    setNewName("");
    setModalOpen(true);
  };

  const confirmCreate = async () => {
    if (!newName.trim()) { toast.error("Dá um nome pra pasta."); return; }
    setCreating(true);
    try {
      const created = await api.createBinder({ name: newName.trim(), isPublic: true });
      setModalOpen(false);
      navigate(`/binders/${created.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar binder.");
    } finally {
      setCreating(false);
    }
  };

  const removeBinder = async (id: string, name: string) => {
    if (!window.confirm(`Excluir "${name}"? Não tem como desfazer.`)) return;
    try {
      await api.deleteBinder(id);
      setBinders((current) => current.filter((b) => b.id !== id));
      toast.success("Binder excluído.");
      await load({ bypassCache: true });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir binder.");
    }
  };

  return (
    <PortalShell breadcrumbs={[{ label: "Binders" }]}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Binders</p>
          <h2 className="mt-2 font-heading text-4xl uppercase heading-portal">Meus binders</h2>
          <p className="mt-2 max-w-2xl text-sm text-soft">Organize cartas em quantos binders quiser — lista de desejos, coleção completa, o que tem pra trocar. Compartilhe pelo link se a pasta for pública; se for privada, só você acessa.</p>
        </div>
        <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={openCreateModal}><Plus className="mr-2 size-4" />Nova pasta</Button>
      </div>

      {loading ? <p className="text-sm text-muted-portal">Carregando...</p> : !binders.length ? (
        <Card className="panel-cut rounded-none surface-panel"><CardContent className="p-8 text-center text-sm text-muted-portal">Nenhum binder ainda — cria um acima pra começar a organizar suas cartas.</CardContent></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {binders.map((binder) => (
            <Card key={binder.id} className="panel-cut overflow-hidden rounded-none surface-panel">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => navigate(`/binders/${binder.id}`)} className="text-left text-lg heading-portal hover:text-primary">{binder.name}</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-none border border-white/15 bg-white/5">{binder.isPublic ? "Público" : "Privado"}</Badge>
                  <Badge variant="outline" className="rounded-none border-white/20 text-soft">{binder._count?.items ?? binder.items?.length ?? 0} cartas</Badge>
                </div>
                {binder.description ? <p className="line-clamp-2 text-sm text-muted-portal">{binder.description}</p> : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => navigate(`/binders/${binder.id}`)}>Abrir</Button>
                  <Button size="sm" variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => removeBinder(binder.id, binder.name)}><Trash2 className="size-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-sm border-white/10 bg-slate-950 text-white">
          <div className="border-b border-white/10 pb-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Nova pasta</p>
            <h3 className="font-heading text-2xl uppercase heading-portal">Dá um nome</h3>
          </div>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Cartas competitivas, Pra trocar..." className="field-shell" onKeyDown={(e) => e.key === "Enter" && confirmCreate()} autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:text-white" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={creating} onClick={confirmCreate}>{creating ? "Criando…" : "Criar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PortalShell>
  );
}

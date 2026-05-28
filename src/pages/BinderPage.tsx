/* Binder page v8 — pasta compartilhável para wishlist e coleção possuída do usuário. */
import { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { api, type ApiBinder } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function BinderPage({ kind }: { kind: "WISHLIST" | "OWNED" }) {
  const { isAuthenticated } = useAuth();
  const [binders, setBinders] = useState<ApiBinder[]>([]);
  const [name, setName] = useState(kind === "WISHLIST" ? "Lista de Desejos" : "Cartas Possuídas");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [search, setSearch] = useState("");
  const [quantityMap, setQuantityMap] = useState<Record<string, number>>({});
  const [cards, setCards] = useState<any[]>([]);

  const binder = useMemo(() => binders.find((item) => item.kind === kind) || null, [binders, kind]);
  const pageTitle = kind === "WISHLIST" ? "Lista de desejos" : "Cartas possuídas";

  useEffect(() => {
    if (!isAuthenticated) return;
    api.listMyBinders().then((result) => {
      setBinders(result);
      const current = result.find((item) => item.kind === kind);
      if (current) {
        setName(current.name);
        setDescription(current.description || "");
        setIsPublic(current.isPublic);
        setQuantityMap(Object.fromEntries(current.items.map((item) => [item.cardId, item.quantity])));
      }
    }).catch(() => undefined);
  }, [isAuthenticated, kind]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.listCardsPage({ q: search, sort: "code_asc" }, { page: 1, pageSize: 12 }).then((result) => setCards(result.items)).catch(() => undefined);
  }, [isAuthenticated, search]);

  const saveBinder = async () => {
    const items = Object.entries(quantityMap).filter(([, quantity]) => quantity > 0).map(([cardId, quantity]) => ({ cardId, quantity }));
    const updated = await api.updateMyBinder(kind, { name, description, isPublic, items });
    setBinders((current) => {
      const next = current.filter((item) => item.kind !== kind);
      return [...next, updated];
    });
    toast.success(`${pageTitle} salva.`);
  };

  const copyShareLink = async () => {
    if (!binder?.shareId) return;
    const url = `${window.location.origin}${window.location.pathname}#/binder/${binder.shareId}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link compartilhável copiado.");
  };

  return (
    <PortalShell breadcrumbs={[{ label: pageTitle }]}>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
          <CardContent className="space-y-4 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Pasta compartilhável</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-none" />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-28 rounded-none" placeholder="Descrição pública opcional" />
            <label className="flex items-center gap-3 text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Compartilhar publicamente
            </label>
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveBinder}>Salvar pasta</Button>
              <Button variant="outline" className="rounded-none" onClick={copyShareLink} disabled={!binder?.shareId}><Copy className="mr-2 size-4" />Copiar link</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="panel-cut border surface-strong p-4 dark:bg-slate-950/60 light:bg-slate-50"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Itens</p><p className="mt-2 font-heading text-4xl">{Object.values(quantityMap).filter((value) => value > 0).length}</p></div>
              <div className="panel-cut border surface-strong p-4 dark:bg-slate-950/60 light:bg-slate-50"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Quantidade</p><p className="mt-2 font-heading text-4xl">{Object.values(quantityMap).reduce((sum, value) => sum + value, 0)}</p></div>
              <div className="panel-cut border surface-strong p-4 dark:bg-slate-950/60 light:bg-slate-50"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Visibilidade</p><p className="mt-2 font-heading text-4xl">{isPublic ? "ON" : "OFF"}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Base do sistema</p>
                <h3 className="font-heading text-3xl uppercase">Adicionar cartas</h3>
              </div>
              <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">12 por vez</Badge>
            </div>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar carta por nome ou código" className="rounded-none" />
            <div className="space-y-3">
              {cards.map((card) => {
                const quantity = quantityMap[card.id] || 0;
                return (
                  <div key={card.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p>
                      <p className="mt-1 text-lg">{card.namePt || card.nameEn}</p>
                      <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{card.set?.code || "sem coleção"} · {card.cardType} · {card.color || "sem cor"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="rounded-none" onClick={() => setQuantityMap((current) => ({ ...current, [card.id]: Math.max(0, (current[card.id] || 0) - 1) }))}>-</Button>
                      <div className="min-w-8 text-center text-lg">{quantity}</div>
                      <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setQuantityMap((current) => ({ ...current, [card.id]: (current[card.id] || 0) + 1 }))}>+</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}

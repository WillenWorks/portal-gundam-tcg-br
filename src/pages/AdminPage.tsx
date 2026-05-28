/* Admin v8 — foco em cartas, usuários e coleções para liberar o MVP para testes públicos. */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export default function AdminPage() {
  const { user } = useAuth();
  const [location] = useLocation();
  const query = new URLSearchParams(location.split("?")[1] || "");
  const defaultTab = query.get("tab") || "dashboard";

  const [users, setUsers] = useState<any[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [cardForm, setCardForm] = useState({ code: "", nameEn: "", namePt: "", cardType: "Unit", color: "Blue", cost: 1, level: 1, ap: 1, hp: 1, trait: "", series: "", effectPt: "", keywordTags: "", imageUrl: "", setId: "" });
  const [setForm, setSetForm] = useState({ code: "", nameEn: "", namePt: "", officialUrl: "", coverImage: "", releaseDate: "", shortDescription: "", setType: "BOOSTER" });
  const [ruleForm, setRuleForm] = useState({ title: "", sourceType: "OFFICIAL_RULES", questionPt: "", answerPt: "", questionEn: "", answerEn: "", relatedKeyword: "", originalUrl: "", cardId: "" });

  const loadAll = async () => {
    const [userRows, setRows, cardRows, ruleRows] = await Promise.all([api.listAdminUsers(), api.listSets(), api.listCards(), api.listRulings()]);
    setUsers(userRows);
    setSets(setRows);
    setCards(cardRows);
    setRules(ruleRows);
  };

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    loadAll().catch(() => undefined);
  }, [user?.role]);

  const saveSet = async () => {
    await api.createSet({ ...setForm, releaseDate: setForm.releaseDate ? new Date(`${setForm.releaseDate}T00:00:00.000Z`).toISOString() : null });
    setSetForm({ code: "", nameEn: "", namePt: "", officialUrl: "", coverImage: "", releaseDate: "", shortDescription: "", setType: "BOOSTER" });
    await loadAll();
    toast.success("Coleção cadastrada.");
  };

  const saveCard = async () => {
    await api.createCard({
      code: cardForm.code,
      nameEn: cardForm.nameEn,
      namePt: cardForm.namePt || null,
      cardType: cardForm.cardType,
      color: cardForm.color,
      cost: Number(cardForm.cost),
      level: Number(cardForm.level),
      ap: Number(cardForm.ap),
      hp: Number(cardForm.hp),
      trait: cardForm.trait || null,
      series: cardForm.series || null,
      effectPt: cardForm.effectPt || null,
      effectEn: cardForm.effectPt || null,
      keywordTags: cardForm.keywordTags.split(",").map((item) => item.trim()).filter(Boolean),
      imageUrl: cardForm.imageUrl || null,
      setId: cardForm.setId || null,
    });
    setCardForm({ code: "", nameEn: "", namePt: "", cardType: "Unit", color: "Blue", cost: 1, level: 1, ap: 1, hp: 1, trait: "", series: "", effectPt: "", keywordTags: "", imageUrl: "", setId: "" });
    await loadAll();
    toast.success("Carta criada.");
  };

  const saveRule = async () => {
    await api.createRuling({ ...ruleForm, relatedKeyword: ruleForm.relatedKeyword || null, originalUrl: ruleForm.originalUrl || null, cardId: ruleForm.cardId || null });
    setRuleForm({ title: "", sourceType: "OFFICIAL_RULES", questionPt: "", answerPt: "", questionEn: "", answerEn: "", relatedKeyword: "", originalUrl: "", cardId: "" });
    await loadAll();
    toast.success("Ruling criada.");
  };

  if (user?.role !== "ADMIN") {
    return (
      <PortalShell breadcrumbs={[{ label: "Admin" }]}> 
        <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900"><CardContent className="p-6">Essa área é exclusiva para administradores.</CardContent></Card>
      </PortalShell>
    );
  }

  return (
    <PortalShell breadcrumbs={[{ label: "Admin" }]}> 
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white dark:text-white light:text-slate-900">
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Admin via flag</p>
            <h2 className="mt-2 font-heading text-5xl uppercase leading-none">Centro administrativo</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">O foco da v8 é liberar cartas, usuários, coleções e regras com fluxo sólido para testes públicos. Estatísticas e campeonatos ficam escondidos por enquanto.</p>
          </CardContent>
        </Card>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="h-auto flex-wrap rounded-none border border-white/10 bg-white/5 p-1">
            <TabsTrigger value="dashboard" className="rounded-none uppercase tracking-[0.18em]">Dashboard</TabsTrigger>
            <TabsTrigger value="cards" className="rounded-none uppercase tracking-[0.18em]">Cartas</TabsTrigger>
            <TabsTrigger value="users" className="rounded-none uppercase tracking-[0.18em]">Usuários</TabsTrigger>
            <TabsTrigger value="sets" className="rounded-none uppercase tracking-[0.18em]">Coleções</TabsTrigger>
            <TabsTrigger value="rules" className="rounded-none uppercase tracking-[0.18em]">Regras</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[["Usuários", users.length],["Coleções", sets.length],["Cartas", cards.length],["Rulings", rules.length]].map(([label, value]) => (
                <Card key={String(label)} className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">{String(label)}</p><p className="mt-4 font-heading text-5xl leading-none">{String(value)}</p></CardContent></Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="cards">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900"><CardContent className="space-y-4 p-5"><h3 className="font-heading text-3xl uppercase">Nova carta</h3><div className="grid gap-4 md:grid-cols-2"><Input value={cardForm.code} onChange={(e) => setCardForm((s) => ({ ...s, code: e.target.value }))} placeholder="Código" className="rounded-none" /><Input value={cardForm.nameEn} onChange={(e) => setCardForm((s) => ({ ...s, nameEn: e.target.value }))} placeholder="Nome EN" className="rounded-none" /><Input value={cardForm.namePt} onChange={(e) => setCardForm((s) => ({ ...s, namePt: e.target.value }))} placeholder="Nome PT" className="rounded-none" /><select value={cardForm.setId} onChange={(e) => setCardForm((s) => ({ ...s, setId: e.target.value }))} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm dark:text-white light:bg-white light:text-slate-900"><option value="">Coleção</option>{sets.map((set) => <option key={set.id} value={set.id}>{set.code} · {set.namePt || set.nameEn}</option>)}</select></div><div className="grid gap-4 md:grid-cols-4"><Input value={cardForm.cardType} onChange={(e) => setCardForm((s) => ({ ...s, cardType: e.target.value }))} placeholder="Tipo" className="rounded-none" /><Input value={cardForm.color} onChange={(e) => setCardForm((s) => ({ ...s, color: e.target.value }))} placeholder="Cor" className="rounded-none" /><Input type="number" value={cardForm.cost} onChange={(e) => setCardForm((s) => ({ ...s, cost: Number(e.target.value) }))} placeholder="Custo" className="rounded-none" /><Input type="number" value={cardForm.level} onChange={(e) => setCardForm((s) => ({ ...s, level: Number(e.target.value) }))} placeholder="Nível" className="rounded-none" /></div><div className="grid gap-4 md:grid-cols-2"><Input value={cardForm.trait} onChange={(e) => setCardForm((s) => ({ ...s, trait: e.target.value }))} placeholder="Trait" className="rounded-none" /><Input value={cardForm.series} onChange={(e) => setCardForm((s) => ({ ...s, series: e.target.value }))} placeholder="Série" className="rounded-none" /></div><Input value={cardForm.keywordTags} onChange={(e) => setCardForm((s) => ({ ...s, keywordTags: e.target.value }))} placeholder="Keywords separadas por vírgula" className="rounded-none" /><Textarea value={cardForm.effectPt} onChange={(e) => setCardForm((s) => ({ ...s, effectPt: e.target.value }))} placeholder="Texto da carta" className="min-h-32 rounded-none" /><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveCard}>Salvar carta</Button></CardContent></Card>
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900"><CardContent className="space-y-3 p-5"><h3 className="font-heading text-3xl uppercase">Cartas cadastradas</h3>{cards.slice(0, 24).map((card) => <div key={card.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p><p className="mt-1 text-lg">{card.namePt || card.nameEn}</p><p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{card.set?.code || "sem set"} · {card.cardType}</p></div>)}</CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900"><CardContent className="space-y-3 p-5"><h3 className="font-heading text-3xl uppercase">Usuários</h3>{users.map((entry) => <div key={entry.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50"><div><p className="text-lg">{entry.displayName}</p><p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{entry.email} · {entry.role} · {entry.isActive ? "ativo" : "bloqueado"}</p></div><Button variant="outline" className="rounded-none" onClick={async () => { await api.updateAdminUser(entry.id, { isActive: !entry.isActive }); await loadAll(); toast.success(entry.isActive ? "Usuário bloqueado." : "Usuário reativado."); }}>{entry.isActive ? "Bloquear" : "Reativar"}</Button></div>)}</CardContent></Card>
          </TabsContent>

          <TabsContent value="sets">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900"><CardContent className="space-y-4 p-5"><h3 className="font-heading text-3xl uppercase">Nova coleção</h3><div className="grid gap-4 md:grid-cols-2"><Input value={setForm.code} onChange={(e) => setSetForm((s) => ({ ...s, code: e.target.value }))} placeholder="Código" className="rounded-none" /><Input value={setForm.nameEn} onChange={(e) => setSetForm((s) => ({ ...s, nameEn: e.target.value }))} placeholder="Nome EN" className="rounded-none" /><Input value={setForm.namePt} onChange={(e) => setSetForm((s) => ({ ...s, namePt: e.target.value }))} placeholder="Nome PT" className="rounded-none" /><Input type="date" value={setForm.releaseDate} onChange={(e) => setSetForm((s) => ({ ...s, releaseDate: e.target.value }))} className="rounded-none" /></div><div className="grid gap-4 md:grid-cols-2"><Input value={setForm.officialUrl} onChange={(e) => setSetForm((s) => ({ ...s, officialUrl: e.target.value }))} placeholder="URL oficial" className="rounded-none" /><Input value={setForm.coverImage} onChange={(e) => setSetForm((s) => ({ ...s, coverImage: e.target.value }))} placeholder="URL da capa" className="rounded-none" /></div><select value={setForm.setType} onChange={(e) => setSetForm((s) => ({ ...s, setType: e.target.value }))} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm dark:text-white light:bg-white light:text-slate-900"><option value="BOOSTER">Booster</option><option value="STARTER">Starter Deck</option><option value="PROMO">Promo</option><option value="OTHER">Outro</option></select><Textarea value={setForm.shortDescription} onChange={(e) => setSetForm((s) => ({ ...s, shortDescription: e.target.value }))} placeholder="Descrição curta" className="min-h-28 rounded-none" /><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveSet}>Salvar coleção</Button></CardContent></Card>
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900"><CardContent className="space-y-3 p-5"><h3 className="font-heading text-3xl uppercase">Coleções cadastradas</h3>{sets.map((set) => <div key={set.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{set.code} · {set.setType}</p><p className="mt-1 text-lg">{set.namePt || set.nameEn}</p><p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{set.releaseDate ? new Date(set.releaseDate).toLocaleDateString("pt-BR") : "sem data"}</p></div>)}</CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="rules">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900"><CardContent className="space-y-4 p-5"><h3 className="font-heading text-3xl uppercase">Nova ruling</h3><Input value={ruleForm.title} onChange={(e) => setRuleForm((s) => ({ ...s, title: e.target.value }))} placeholder="Título" className="rounded-none" /><div className="grid gap-4 md:grid-cols-2"><Textarea value={ruleForm.questionPt} onChange={(e) => setRuleForm((s) => ({ ...s, questionPt: e.target.value }))} placeholder="Pergunta PT-BR" className="min-h-24 rounded-none" /><Textarea value={ruleForm.answerPt} onChange={(e) => setRuleForm((s) => ({ ...s, answerPt: e.target.value }))} placeholder="Resposta PT-BR" className="min-h-24 rounded-none" /><Textarea value={ruleForm.questionEn} onChange={(e) => setRuleForm((s) => ({ ...s, questionEn: e.target.value }))} placeholder="Question EN" className="min-h-24 rounded-none" /><Textarea value={ruleForm.answerEn} onChange={(e) => setRuleForm((s) => ({ ...s, answerEn: e.target.value }))} placeholder="Answer EN" className="min-h-24 rounded-none" /></div><div className="grid gap-4 md:grid-cols-2"><Input value={ruleForm.relatedKeyword} onChange={(e) => setRuleForm((s) => ({ ...s, relatedKeyword: e.target.value }))} placeholder="Keyword relacionada" className="rounded-none" /><Input value={ruleForm.originalUrl} onChange={(e) => setRuleForm((s) => ({ ...s, originalUrl: e.target.value }))} placeholder="URL da fonte" className="rounded-none" /></div><select value={ruleForm.cardId} onChange={(e) => setRuleForm((s) => ({ ...s, cardId: e.target.value }))} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm dark:text-white light:bg-white light:text-slate-900"><option value="">Carta vinculada</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.code} · {card.namePt || card.nameEn}</option>)}</select><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveRule}>Salvar ruling</Button></CardContent></Card>
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900"><CardContent className="space-y-3 p-5"><h3 className="font-heading text-3xl uppercase">Base atual</h3>{rules.map((rule) => <div key={rule.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{rule.sourceType} · {rule.relatedKeyword || "sem keyword"}</p><p className="mt-1 text-lg">{rule.title}</p><p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{rule.originalUrl || "sem fonte externa"}</p></div>)}</CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PortalShell>
  );
}

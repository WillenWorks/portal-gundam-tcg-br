/* Admin tático — dashboard, gestão por domínio, vínculo carta↔ruling e operações principais do sistema. */
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const chartConfig = {
  value: { label: "Quantidade", color: "#47a0ff" },
} satisfies ChartConfig;

const sampleCardsImport = JSON.stringify({
  set: { code: "ST02", nameEn: "Zeon Assault", namePt: "Zeon Assault" },
  cards: [{ code: "ST02-001", nameEn: "Zaku II Commander", namePt: "Zaku II Commander", cardType: "Unit", color: "Red", cost: 2, level: 3, ap: 3, hp: 2, series: "Mobile Suit Gundam", trait: "Zeon", keywordTags: ["Raid"], effectPt: "Recebe +1 AP ao atacar sozinho." }],
}, null, 2);

const sampleRulingsImport = JSON.stringify({
  rulings: [{ title: "Timing de Deploy", sourceType: "OFFICIAL_FAQ", questionPt: "Quando um efeito de deploy resolve?", answerPt: "Após a carta entrar em jogo e antes da próxima ação do jogador ativo." }],
}, null, 2);

export default function AdminPage() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const [email, setEmail] = useState(import.meta.env.DEV ? "admin@gundambr.local" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "admin123" : "");

  const [sets, setSets] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [cardsImportText, setCardsImportText] = useState(sampleCardsImport);
  const [rulingsImportText, setRulingsImportText] = useState(sampleRulingsImport);
  const [uploading, setUploading] = useState(false);

  const [setForm, setSetForm] = useState({ code: "", nameEn: "", namePt: "", officialUrl: "" });
  const [cardForm, setCardForm] = useState({ id: "", code: "", nameEn: "", namePt: "", cardType: "Unit", color: "Blue", cost: 1, level: 1, ap: 1, hp: 1, trait: "", series: "", effectPt: "", keywordTags: "", imageUrl: "", setId: "" });
  const [ruleForm, setRuleForm] = useState({ id: "", title: "", sourceType: "OFFICIAL_RULES", answerPt: "", relatedKeyword: "", originalUrl: "", cardId: "" });
  const [eventForm, setEventForm] = useState({ id: "", name: "", season: "GD02", format: "constructed", participantCount: 16, dateStart: new Date().toISOString().slice(0, 10) });

  const loadAll = async () => {
    const [setsRes, cardsRes, rulesRes, eventsRes] = await Promise.all([api.listSets(), api.listCards(), api.listRulings(), api.listTournaments()]);
    setSets(setsRes);
    setCards(cardsRes);
    setRules(rulesRes);
    setTournaments(eventsRes);
  };

  useEffect(() => {
    loadAll().catch(() => undefined);
  }, []);

  const ensureAdmin = () => {
    if (!isAuthenticated || user?.role !== "ADMIN") {
      toast.error("Faça login como admin para operar esta área.");
      return false;
    }
    return true;
  };

  const operations = useMemo(() => {
    const rows = [
      ...cards.map((item) => ({ type: "Carta", title: item.namePt || item.nameEn, updatedAt: item.updatedAt })),
      ...rules.map((item) => ({ type: "Ruling", title: item.title, updatedAt: item.updatedAt })),
      ...tournaments.map((item) => ({ type: "Evento", title: item.name, updatedAt: item.updatedAt })),
    ];
    return rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 6);
  }, [cards, rules, tournaments]);

  const overviewChart = [
    { name: "Sets", value: sets.length },
    { name: "Cartas", value: cards.length },
    { name: "Rulings", value: rules.length },
    { name: "Eventos", value: tournaments.length },
  ];

  const handleImageUpload = async (file?: File) => {
    if (!ensureAdmin() || !file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const result = await api.uploadCardImage(formData);
      setCardForm((state) => ({ ...state, imageUrl: result.imageUrl }));
      toast.success("Imagem enviada e aplicada ao formulário.");
    } finally {
      setUploading(false);
    }
  };

  const saveSet = async () => {
    if (!ensureAdmin()) return;
    await api.createSet({ code: setForm.code, nameEn: setForm.nameEn, namePt: setForm.namePt || null, officialUrl: setForm.officialUrl || null });
    setSetForm({ code: "", nameEn: "", namePt: "", officialUrl: "" });
    await loadAll();
    toast.success("Coleção cadastrada.");
  };

  const saveCard = async () => {
    if (!ensureAdmin()) return;
    const payload = {
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
    };
    if (cardForm.id) await api.updateCard(cardForm.id, payload); else await api.createCard(payload);
    setCardForm({ id: "", code: "", nameEn: "", namePt: "", cardType: "Unit", color: "Blue", cost: 1, level: 1, ap: 1, hp: 1, trait: "", series: "", effectPt: "", keywordTags: "", imageUrl: "", setId: "" });
    await loadAll();
    toast.success(cardForm.id ? "Carta atualizada." : "Carta criada.");
  };

  const saveRule = async () => {
    if (!ensureAdmin()) return;
    const payload = {
      title: ruleForm.title,
      sourceType: ruleForm.sourceType,
      questionPt: ruleForm.title,
      answerPt: ruleForm.answerPt,
      questionEn: ruleForm.title,
      answerEn: ruleForm.answerPt,
      originalUrl: ruleForm.originalUrl || null,
      relatedKeyword: ruleForm.relatedKeyword || null,
      cardId: ruleForm.cardId || null,
    };
    if (ruleForm.id) await api.updateRuling(ruleForm.id, payload); else await api.createRuling(payload);
    setRuleForm({ id: "", title: "", sourceType: "OFFICIAL_RULES", answerPt: "", relatedKeyword: "", originalUrl: "", cardId: "" });
    await loadAll();
    toast.success(ruleForm.id ? "Ruling atualizada." : "Ruling criada.");
  };

  const saveEvent = async () => {
    if (!ensureAdmin()) return;
    const payload = {
      name: eventForm.name,
      season: eventForm.season,
      format: eventForm.format,
      participantCount: Number(eventForm.participantCount),
      dateStart: new Date(`${eventForm.dateStart}T00:00:00.000Z`).toISOString(),
    };
    if (eventForm.id) await api.updateTournament(eventForm.id, payload); else await api.createTournament(payload);
    setEventForm({ id: "", name: "", season: "GD02", format: "constructed", participantCount: 16, dateStart: new Date().toISOString().slice(0, 10) });
    await loadAll();
    toast.success(eventForm.id ? "Evento atualizado." : "Evento criado.");
  };

  const importCardsJson = async () => {
    if (!ensureAdmin()) return;
    const payload = JSON.parse(cardsImportText);
    const result = await api.importCards(payload);
    await loadAll();
    toast.success(`${result.imported} cartas importadas.`);
  };

  const importRulingsJson = async () => {
    if (!ensureAdmin()) return;
    const payload = JSON.parse(rulingsImportText);
    const result = await api.importRulings(payload);
    await loadAll();
    toast.success(`${result.imported} rulings importadas.`);
  };

  return (
    <PortalShell breadcrumbs={[{ label: "Admin" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
          <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Admin via API</p>
              <h2 className="mt-2 font-heading text-5xl uppercase leading-none">Dashboard e gestão do sistema</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Agora o admin tem leitura de resumo, operações recentes, gráficos e menus separados para coleções, cartas, rulings, eventos e importação.</p>
            </div>
            <div className="min-w-[320px] max-w-md space-y-3">
              {isAuthenticated ? (
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-sm text-slate-300">Logado como <span className="text-white">{user?.displayName}</span> · {user?.role}</p>
                  <Button className="mt-3 rounded-none bg-white/10 text-white hover:bg-white/20" onClick={logout}>Sair</Button>
                </div>
              ) : (
                <>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email admin" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Button className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => login(email, password)}>Entrar no admin</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="h-auto flex-wrap rounded-none border border-white/10 bg-white/5 p-1">
            <TabsTrigger value="dashboard" className="rounded-none uppercase tracking-[0.18em]">Dashboard</TabsTrigger>
            <TabsTrigger value="sets" className="rounded-none uppercase tracking-[0.18em]">Coleções</TabsTrigger>
            <TabsTrigger value="cards" className="rounded-none uppercase tracking-[0.18em]">Cartas</TabsTrigger>
            <TabsTrigger value="rules" className="rounded-none uppercase tracking-[0.18em]">Rulings</TabsTrigger>
            <TabsTrigger value="events" className="rounded-none uppercase tracking-[0.18em]">Eventos</TabsTrigger>
            <TabsTrigger value="imports" className="rounded-none uppercase tracking-[0.18em]">Importador</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="p-6"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[["Sets", sets.length],["Cartas", cards.length],["Rulings", rules.length],["Eventos", tournaments.length]].map(([label, value]) => <div key={String(label)} className="panel-cut border border-white/10 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p><p className="mt-2 font-heading text-4xl text-white">{String(value)}</p></div>)}</div><div className="mt-6 h-[320px]"><ChartContainer config={chartConfig} className="h-full w-full"><BarChart data={overviewChart}><CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="value" fill="var(--color-value)" radius={0} /></BarChart></ChartContainer></div></CardContent></Card>
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="p-6"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Logs operacionais</p><div className="mt-5 space-y-4">{operations.map((item, index) => <div key={`${item.type}-${item.title}-${index}`} className="panel-cut border border-white/10 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.type}</p><p className="mt-2 text-lg text-white">{item.title}</p><p className="mt-2 text-sm text-slate-400">Atualizado em {new Date(item.updatedAt).toLocaleString("pt-BR")}</p></div>)}</div></CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="sets">
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-4 p-5"><h3 className="font-heading text-3xl uppercase">Cadastro de coleção</h3><Input value={setForm.code} onChange={(e) => setSetForm((s) => ({ ...s, code: e.target.value }))} placeholder="Código" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={setForm.nameEn} onChange={(e) => setSetForm((s) => ({ ...s, nameEn: e.target.value }))} placeholder="Nome EN" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={setForm.namePt} onChange={(e) => setSetForm((s) => ({ ...s, namePt: e.target.value }))} placeholder="Nome PT" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={setForm.officialUrl} onChange={(e) => setSetForm((s) => ({ ...s, officialUrl: e.target.value }))} placeholder="URL oficial" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveSet}>Salvar coleção</Button></CardContent></Card>
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-3 p-5"><h3 className="font-heading text-3xl uppercase">Coleções cadastradas</h3>{sets.map((set) => <div key={set.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{set.code}</p><p className="mt-2 text-lg text-white">{set.namePt || set.nameEn}</p><p className="mt-2 text-sm text-slate-400">{set._count?.cards ?? 0} cartas</p></div>)}</CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="cards">
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-4 p-5"><h3 className="font-heading text-3xl uppercase">Formulário de carta</h3><div className="grid gap-4 md:grid-cols-2"><Input value={cardForm.code} onChange={(e) => setCardForm((s) => ({ ...s, code: e.target.value }))} placeholder="Código" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={cardForm.nameEn} onChange={(e) => setCardForm((s) => ({ ...s, nameEn: e.target.value }))} placeholder="Nome EN" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={cardForm.namePt} onChange={(e) => setCardForm((s) => ({ ...s, namePt: e.target.value }))} placeholder="Nome PT" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><select value={cardForm.setId} onChange={(e) => setCardForm((s) => ({ ...s, setId: e.target.value }))} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white"><option value="">Sem coleção</option>{sets.map((set) => <option key={set.id} value={set.id}>{set.code} · {set.namePt || set.nameEn}</option>)}</select><Input value={cardForm.series} onChange={(e) => setCardForm((s) => ({ ...s, series: e.target.value }))} placeholder="Série" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={cardForm.trait} onChange={(e) => setCardForm((s) => ({ ...s, trait: e.target.value }))} placeholder="Trait" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={cardForm.color} onChange={(e) => setCardForm((s) => ({ ...s, color: e.target.value }))} placeholder="Cor" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={cardForm.cardType} onChange={(e) => setCardForm((s) => ({ ...s, cardType: e.target.value }))} placeholder="Tipo" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input type="number" value={cardForm.cost} onChange={(e) => setCardForm((s) => ({ ...s, cost: Number(e.target.value) }))} placeholder="Custo" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input type="number" value={cardForm.level} onChange={(e) => setCardForm((s) => ({ ...s, level: Number(e.target.value) }))} placeholder="Level" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input type="number" value={cardForm.ap} onChange={(e) => setCardForm((s) => ({ ...s, ap: Number(e.target.value) }))} placeholder="AP" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input type="number" value={cardForm.hp} onChange={(e) => setCardForm((s) => ({ ...s, hp: Number(e.target.value) }))} placeholder="HP" className="rounded-none border-white/15 bg-slate-950/70 text-white" /></div><Input value={cardForm.imageUrl} onChange={(e) => setCardForm((s) => ({ ...s, imageUrl: e.target.value }))} placeholder="URL da imagem" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><label className="flex cursor-pointer items-center gap-3 rounded-none border border-dashed border-white/15 bg-slate-950/50 px-4 py-3 text-sm text-slate-300 hover:bg-white/5"><Upload className="size-4" /> {uploading ? "Enviando..." : "Enviar imagem local"}<input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0])} /></label><Input value={cardForm.keywordTags} onChange={(e) => setCardForm((s) => ({ ...s, keywordTags: e.target.value }))} placeholder="Keywords separadas por vírgula" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Textarea value={cardForm.effectPt} onChange={(e) => setCardForm((s) => ({ ...s, effectPt: e.target.value }))} placeholder="Efeito PT-BR" className="min-h-28 rounded-none border-white/15 bg-slate-950/70 text-white" /><div className="flex flex-wrap gap-3"><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveCard}>{cardForm.id ? "Salvar carta" : "Criar carta"}</Button><Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setCardForm({ id: "", code: "", nameEn: "", namePt: "", cardType: "Unit", color: "Blue", cost: 1, level: 1, ap: 1, hp: 1, trait: "", series: "", effectPt: "", keywordTags: "", imageUrl: "", setId: "" })}>Novo</Button></div></CardContent></Card>
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-3 p-5"><h3 className="font-heading text-3xl uppercase">Cartas do banco</h3>{cards.map((card) => <div key={card.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4"><div><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p><p className="mt-1 text-lg text-white">{card.namePt || card.nameEn}</p><p className="text-sm text-slate-400">{card.color} · {card.cardType} · {card.set?.code || "sem set"} · {card.rulings?.length ?? 0} rulings</p></div><div className="flex gap-2"><Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setCardForm({ id: card.id, code: card.code, nameEn: card.nameEn, namePt: card.namePt || "", cardType: card.cardType, color: card.color || "Blue", cost: card.cost || 1, level: card.level || 1, ap: card.ap || 1, hp: card.hp || 1, trait: card.trait || "", series: card.series || "", effectPt: card.effectPt || card.effectEn || "", keywordTags: (card.keywordTags || []).join(", "), imageUrl: card.imageUrl || "", setId: card.setId || "" })}>Editar</Button><Button variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={async () => { if (!ensureAdmin()) return; await api.deleteCard(card.id); await loadAll(); toast.success("Carta removida."); }}><Trash2 className="size-4" /></Button></div></div>)}</CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="rules">
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-4 p-5"><h3 className="font-heading text-3xl uppercase">Formulário de ruling</h3><Input value={ruleForm.title} onChange={(e) => setRuleForm((s) => ({ ...s, title: e.target.value }))} placeholder="Título" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><select value={ruleForm.sourceType} onChange={(e) => setRuleForm((s) => ({ ...s, sourceType: e.target.value }))} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white"><option value="OFFICIAL_RULES">Official Rules</option><option value="OFFICIAL_FAQ">Official FAQ</option><option value="COMMUNITY_EXPLAINER">Community Explainer</option></select><select value={ruleForm.cardId} onChange={(e) => setRuleForm((s) => ({ ...s, cardId: e.target.value }))} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white"><option value="">Sem carta vinculada</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.code} · {card.namePt || card.nameEn}</option>)}</select><Input value={ruleForm.relatedKeyword} onChange={(e) => setRuleForm((s) => ({ ...s, relatedKeyword: e.target.value }))} placeholder="Keyword relacionada" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={ruleForm.originalUrl} onChange={(e) => setRuleForm((s) => ({ ...s, originalUrl: e.target.value }))} placeholder="URL original" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Textarea value={ruleForm.answerPt} onChange={(e) => setRuleForm((s) => ({ ...s, answerPt: e.target.value }))} placeholder="Resposta PT-BR" className="min-h-32 rounded-none border-white/15 bg-slate-950/70 text-white" /><div className="flex flex-wrap gap-3"><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveRule}>{ruleForm.id ? "Salvar ruling" : "Criar ruling"}</Button><Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setRuleForm({ id: "", title: "", sourceType: "OFFICIAL_RULES", answerPt: "", relatedKeyword: "", originalUrl: "", cardId: "" })}>Novo</Button></div></CardContent></Card>
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-3 p-5"><h3 className="font-heading text-3xl uppercase">Rulings do banco</h3>{rules.map((rule) => <div key={rule.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4"><div><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{rule.sourceType} · {rule.relatedKeyword || "sem keyword"}</p><p className="mt-1 text-lg text-white">{rule.title}</p><p className="text-sm text-slate-400">{rule.card ? `${rule.card.code} · ${rule.card.namePt || rule.card.nameEn}` : "sem carta vinculada"}</p></div><div className="flex gap-2"><Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setRuleForm({ id: rule.id, title: rule.title, sourceType: rule.sourceType, answerPt: rule.answerPt || rule.answerEn || "", relatedKeyword: rule.relatedKeyword || "", originalUrl: rule.originalUrl || "", cardId: rule.cardId || "" })}>Editar</Button><Button variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={async () => { if (!ensureAdmin()) return; await api.deleteRuling(rule.id); await loadAll(); toast.success("Ruling removida."); }}><Trash2 className="size-4" /></Button></div></div>)}</CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="events">
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-4 p-5"><h3 className="font-heading text-3xl uppercase">Formulário de evento</h3><Input value={eventForm.name} onChange={(e) => setEventForm((s) => ({ ...s, name: e.target.value }))} placeholder="Nome do evento" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><div className="grid gap-4 md:grid-cols-2"><Input value={eventForm.season} onChange={(e) => setEventForm((s) => ({ ...s, season: e.target.value }))} placeholder="Season" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={eventForm.format} onChange={(e) => setEventForm((s) => ({ ...s, format: e.target.value }))} placeholder="Formato" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input type="date" value={eventForm.dateStart} onChange={(e) => setEventForm((s) => ({ ...s, dateStart: e.target.value }))} className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input type="number" value={eventForm.participantCount} onChange={(e) => setEventForm((s) => ({ ...s, participantCount: Number(e.target.value) }))} placeholder="Participantes" className="rounded-none border-white/15 bg-slate-950/70 text-white" /></div><div className="flex flex-wrap gap-3"><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveEvent}>{eventForm.id ? "Salvar evento" : "Criar evento"}</Button><Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setEventForm({ id: "", name: "", season: "GD02", format: "constructed", participantCount: 16, dateStart: new Date().toISOString().slice(0, 10) })}>Novo</Button></div></CardContent></Card>
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-3 p-5"><h3 className="font-heading text-3xl uppercase">Eventos do banco</h3>{tournaments.map((event) => <div key={event.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4"><div><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{event.season} · {event.format}</p><p className="mt-1 text-lg text-white">{event.name}</p><p className="text-sm text-slate-400">{event.participantCount || 0} jogadores</p></div><div className="flex gap-2"><Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setEventForm({ id: event.id, name: event.name, season: event.season || "", format: event.format || "constructed", participantCount: event.participantCount || 16, dateStart: event.dateStart ? new Date(event.dateStart).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10) })}>Editar</Button><Button variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={async () => { if (!ensureAdmin()) return; await api.deleteTournament(event.id); await loadAll(); toast.success("Evento removido."); }}><Trash2 className="size-4" /></Button></div></div>)}</CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="imports">
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between"><h3 className="font-heading text-3xl uppercase">Importador de sets/cartas</h3><Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">JSON</Badge></div><Textarea value={cardsImportText} onChange={(e) => setCardsImportText(e.target.value)} className="min-h-[420px] rounded-none border-white/15 bg-slate-950/70 font-mono text-xs text-white" /><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={importCardsJson}>Importar cartas</Button></CardContent></Card>
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between"><h3 className="font-heading text-3xl uppercase">Importador de rulings</h3><Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">JSON</Badge></div><Textarea value={rulingsImportText} onChange={(e) => setRulingsImportText(e.target.value)} className="min-h-[420px] rounded-none border-white/15 bg-slate-950/70 font-mono text-xs text-white" /><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={importRulingsJson}>Importar rulings</Button></CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PortalShell>
  );
}

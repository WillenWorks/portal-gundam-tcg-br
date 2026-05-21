/* Admin tático — CRUD remoto, upload de imagem e importador JSON para cartas/rulings. */
import { useEffect, useMemo, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { api, mapApiCard, mapApiRule, mapApiTournament } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { CardRecord, RuleEntry, TournamentRecord } from "@/modules/core/types";

const emptyCardForm: Omit<CardRecord, "id"> = {
  code: "",
  name: "",
  namePt: "",
  color: "Blue",
  type: "Unit",
  cost: 1,
  level: 1,
  ap: 1,
  hp: 1,
  series: "",
  trait: "",
  keywords: [],
  effect: "",
  imageUrl: "",
};

const emptyRuleForm: Omit<RuleEntry, "id"> = {
  title: "",
  category: "Detailed Rules",
  source: "Official Rules",
  summaryPt: "",
  originalRef: "",
  relatedCards: [],
  relatedKeyword: "",
};

const emptyTournamentForm: Omit<TournamentRecord, "id"> = {
  name: "",
  season: "GD02",
  format: "Constructed",
  date: new Date().toISOString().slice(0, 10),
  players: 16,
  winner: "",
  decks: [],
};

const sampleCardsImport = JSON.stringify({
  set: { code: "ST02", nameEn: "Zeon Assault", namePt: "Zeon Assault" },
  cards: [
    {
      code: "ST02-001",
      nameEn: "Zaku II Commander",
      namePt: "Zaku II Commander",
      cardType: "Unit",
      color: "Red",
      cost: 2,
      level: 3,
      ap: 3,
      hp: 2,
      series: "Mobile Suit Gundam",
      trait: "Zeon",
      keywordTags: ["Raid"],
      effectPt: "Recebe +1 AP ao atacar sozinho.",
    },
  ],
}, null, 2);

const sampleRulingsImport = JSON.stringify({
  rulings: [
    {
      title: "Timing de Deploy",
      sourceType: "OFFICIAL_FAQ",
      questionPt: "Quando um efeito de deploy resolve?",
      answerPt: "Após a carta entrar em jogo e antes da próxima ação do jogador ativo.",
    },
  ],
}, null, 2);

export default function AdminPage() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const [email, setEmail] = useState(import.meta.env.DEV ? "admin@gundambr.local" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "admin123" : "");

  const [cards, setCards] = useState<CardRecord[]>([]);
  const [rules, setRules] = useState<RuleEntry[]>([]);
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([]);

  const [selectedCardId, setSelectedCardId] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [selectedTournamentId, setSelectedTournamentId] = useState("");

  const [cardForm, setCardForm] = useState<Omit<CardRecord, "id">>(emptyCardForm);
  const [ruleForm, setRuleForm] = useState<Omit<RuleEntry, "id">>(emptyRuleForm);
  const [tournamentForm, setTournamentForm] = useState<Omit<TournamentRecord, "id">>(emptyTournamentForm);

  const [cardsImportText, setCardsImportText] = useState(sampleCardsImport);
  const [rulingsImportText, setRulingsImportText] = useState(sampleRulingsImport);
  const [uploading, setUploading] = useState(false);

  const loadAll = async () => {
    const [cardsRes, rulesRes, tournamentsRes] = await Promise.all([api.listCards(), api.listRulings(), api.listTournaments()]);
    setCards(cardsRes.map(mapApiCard));
    setRules(rulesRes.map(mapApiRule));
    setTournaments(tournamentsRes.map(mapApiTournament));
  };

  useEffect(() => {
    loadAll().catch(() => undefined);
  }, []);

  const selectedCard = useMemo(() => cards.find((item) => item.id === selectedCardId), [cards, selectedCardId]);
  const selectedRule = useMemo(() => rules.find((item) => item.id === selectedRuleId), [rules, selectedRuleId]);
  const selectedTournament = useMemo(() => tournaments.find((item) => item.id === selectedTournamentId), [tournaments, selectedTournamentId]);

  useEffect(() => { setCardForm(selectedCard ? { ...selectedCard } : emptyCardForm); }, [selectedCard]);
  useEffect(() => { setRuleForm(selectedRule ? { ...selectedRule, relatedCards: selectedRule.relatedCards ?? [] } : emptyRuleForm); }, [selectedRule]);
  useEffect(() => { setTournamentForm(selectedTournament ? { ...selectedTournament } : emptyTournamentForm); }, [selectedTournament]);

  const ensureAdmin = () => {
    if (!isAuthenticated) {
      toast.error("Faça login para operar o admin.");
      return false;
    }
    return true;
  };

  const submitCard = async () => {
    if (!ensureAdmin()) return;
    const payload = {
      code: cardForm.code,
      nameEn: cardForm.name,
      namePt: cardForm.namePt,
      cardType: cardForm.type,
      color: cardForm.color,
      cost: cardForm.cost,
      level: cardForm.level,
      ap: cardForm.ap,
      hp: cardForm.hp,
      trait: cardForm.trait,
      series: cardForm.series,
      effectPt: cardForm.effect,
      effectEn: cardForm.effect,
      keywordTags: cardForm.keywords,
      imageUrl: cardForm.imageUrl || null,
    };
    if (selectedCardId) await api.updateCard(selectedCardId, payload); else await api.createCard(payload);
    await loadAll();
    setSelectedCardId("");
    setCardForm(emptyCardForm);
    toast.success(selectedCardId ? "Carta atualizada." : "Carta criada.");
  };

  const submitRule = async () => {
    if (!ensureAdmin()) return;
    const payload = {
      title: ruleForm.title,
      sourceType: ruleForm.source === "Official FAQ" ? "OFFICIAL_FAQ" : ruleForm.source === "Community Explainer" ? "COMMUNITY_EXPLAINER" : "OFFICIAL_RULES",
      questionPt: ruleForm.title,
      answerPt: ruleForm.summaryPt,
      questionEn: ruleForm.title,
      answerEn: ruleForm.summaryPt,
      examplePlayPt: ruleForm.originalRef,
      relatedKeyword: ruleForm.relatedKeyword || null,
    };
    if (selectedRuleId) await api.updateRuling(selectedRuleId, payload); else await api.createRuling(payload);
    await loadAll();
    setSelectedRuleId("");
    setRuleForm(emptyRuleForm);
    toast.success(selectedRuleId ? "Ruling atualizada." : "Ruling criada.");
  };

  const submitTournament = async () => {
    if (!ensureAdmin()) return;
    const payload = {
      name: tournamentForm.name,
      season: tournamentForm.season,
      format: tournamentForm.format.toLowerCase().replaceAll(" ", "_"),
      participantCount: tournamentForm.players,
      dateStart: new Date(`${tournamentForm.date}T00:00:00.000Z`).toISOString(),
    };
    if (selectedTournamentId) await api.updateTournament(selectedTournamentId, payload); else await api.createTournament(payload);
    await loadAll();
    setSelectedTournamentId("");
    setTournamentForm(emptyTournamentForm);
    toast.success(selectedTournamentId ? "Evento atualizado." : "Evento criado.");
  };

  const handleImageUpload = async (file?: File) => {
    if (!ensureAdmin() || !file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.uploadCardImage(formData);
      setCardForm((state) => ({ ...state, imageUrl: result.imageUrl }));
      toast.success("Imagem enviada e URL aplicada ao formulário.");
    } finally {
      setUploading(false);
    }
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
    <PortalShell>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
          <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Admin via API</p>
              <h2 className="mt-2 font-heading text-5xl uppercase leading-none">CRUD remoto com importação</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Operação manual para cartas, rulings e eventos, com upload de imagem e importador JSON para acelerar alimentação do banco.</p>
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

        <Tabs defaultValue="cards" className="space-y-6">
          <TabsList className="h-auto flex-wrap rounded-none border border-white/10 bg-white/5 p-1">
            <TabsTrigger value="cards" className="rounded-none uppercase tracking-[0.18em]">Cartas</TabsTrigger>
            <TabsTrigger value="imports" className="rounded-none uppercase tracking-[0.18em]">Importador</TabsTrigger>
            <TabsTrigger value="rules" className="rounded-none uppercase tracking-[0.18em]">Rulings</TabsTrigger>
            <TabsTrigger value="events" className="rounded-none uppercase tracking-[0.18em]">Eventos</TabsTrigger>
          </TabsList>

          <TabsContent value="cards">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between"><h3 className="font-heading text-3xl uppercase">Formulário de carta</h3><Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{selectedCardId ? "Edição" : "Criação"}</Badge></div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input value={cardForm.code} onChange={(e) => setCardForm((s) => ({ ...s, code: e.target.value }))} placeholder="Código" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Input value={cardForm.name} onChange={(e) => setCardForm((s) => ({ ...s, name: e.target.value }))} placeholder="Nome EN" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Input value={cardForm.namePt ?? ""} onChange={(e) => setCardForm((s) => ({ ...s, namePt: e.target.value }))} placeholder="Nome PT" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Input value={cardForm.series} onChange={(e) => setCardForm((s) => ({ ...s, series: e.target.value }))} placeholder="Série" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Input value={cardForm.trait} onChange={(e) => setCardForm((s) => ({ ...s, trait: e.target.value }))} placeholder="Trait" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Input value={cardForm.color} onChange={(e) => setCardForm((s) => ({ ...s, color: e.target.value as CardRecord["color"] }))} placeholder="Cor" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Input type="number" value={cardForm.cost} onChange={(e) => setCardForm((s) => ({ ...s, cost: Number(e.target.value) }))} placeholder="Custo" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Input value={cardForm.type} onChange={(e) => setCardForm((s) => ({ ...s, type: e.target.value as CardRecord["type"] }))} placeholder="Tipo" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                </div>
                <Input value={cardForm.imageUrl ?? ""} onChange={(e) => setCardForm((s) => ({ ...s, imageUrl: e.target.value }))} placeholder="URL da imagem" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                <label className="flex cursor-pointer items-center gap-3 rounded-none border border-dashed border-white/15 bg-slate-950/50 px-4 py-3 text-sm text-slate-300 hover:bg-white/5">
                  <Upload className="size-4" /> {uploading ? "Enviando..." : "Enviar imagem local da carta"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0])} />
                </label>
                <Input value={cardForm.keywords.join(", ")} onChange={(e) => setCardForm((s) => ({ ...s, keywords: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))} placeholder="Keywords separadas por vírgula" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                <Textarea value={cardForm.effect} onChange={(e) => setCardForm((s) => ({ ...s, effect: e.target.value }))} placeholder="Efeito" className="min-h-28 rounded-none border-white/15 bg-slate-950/70 text-white" />
                <div className="flex flex-wrap gap-3"><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={submitCard}>{selectedCardId ? "Salvar carta" : "Criar carta"}</Button><Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => { setSelectedCardId(""); setCardForm(emptyCardForm); }}>Novo</Button></div>
              </CardContent></Card>
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-3 p-5"><h3 className="font-heading text-3xl uppercase">Cartas do banco</h3>{cards.map((card) => <div key={card.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4"><div><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p><p className="mt-1 text-lg text-white">{card.namePt || card.name}</p><p className="text-sm text-slate-400">{card.color} · {card.type} · {card.series}</p></div><div className="flex gap-2"><Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setSelectedCardId(card.id)}>Editar</Button><Button variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={async () => { if (!ensureAdmin()) return; await api.deleteCard(card.id); await loadAll(); toast.success("Carta removida."); }}><Trash2 className="size-4" /></Button></div></div>)}</CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="imports">
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between"><h3 className="font-heading text-3xl uppercase">Importador de sets/cartas</h3><Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">JSON</Badge></div><p className="text-sm leading-7 text-slate-300">Aceita um objeto com `set` e `cards`. Ideal para importar coleções completas de uma vez.</p><Textarea value={cardsImportText} onChange={(e) => setCardsImportText(e.target.value)} className="min-h-[420px] rounded-none border-white/15 bg-slate-950/70 font-mono text-xs text-white" /><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={importCardsJson}>Importar cartas</Button></CardContent></Card>
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between"><h3 className="font-heading text-3xl uppercase">Importador de rulings</h3><Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">JSON</Badge></div><p className="text-sm leading-7 text-slate-300">Aceita um objeto com `rulings`. Útil para FAQs oficiais, rulings traduzidas e lotes de revisão.</p><Textarea value={rulingsImportText} onChange={(e) => setRulingsImportText(e.target.value)} className="min-h-[420px] rounded-none border-white/15 bg-slate-950/70 font-mono text-xs text-white" /><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={importRulingsJson}>Importar rulings</Button></CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="rules">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between"><h3 className="font-heading text-3xl uppercase">Formulário de ruling</h3><Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{selectedRuleId ? "Edição" : "Criação"}</Badge></div><Input value={ruleForm.title} onChange={(e) => setRuleForm((s) => ({ ...s, title: e.target.value }))} placeholder="Título" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={ruleForm.source} onChange={(e) => setRuleForm((s) => ({ ...s, source: e.target.value as RuleEntry["source"] }))} placeholder="Fonte" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={ruleForm.relatedKeyword ?? ""} onChange={(e) => setRuleForm((s) => ({ ...s, relatedKeyword: e.target.value }))} placeholder="Keyword relacionada" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Textarea value={ruleForm.summaryPt} onChange={(e) => setRuleForm((s) => ({ ...s, summaryPt: e.target.value }))} placeholder="Resumo PT-BR" className="min-h-32 rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={ruleForm.originalRef} onChange={(e) => setRuleForm((s) => ({ ...s, originalRef: e.target.value }))} placeholder="Referência original" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><div className="flex flex-wrap gap-3"><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={submitRule}>{selectedRuleId ? "Salvar ruling" : "Criar ruling"}</Button><Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => { setSelectedRuleId(""); setRuleForm(emptyRuleForm); }}>Novo</Button></div></CardContent></Card>
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-3 p-5"><h3 className="font-heading text-3xl uppercase">Rulings do banco</h3>{rules.map((rule) => <div key={rule.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4"><div><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{rule.category} · {rule.source}</p><p className="mt-1 text-lg text-white">{rule.title}</p></div><div className="flex gap-2"><Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setSelectedRuleId(rule.id)}>Editar</Button><Button variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={async () => { if (!ensureAdmin()) return; await api.deleteRuling(rule.id); await loadAll(); toast.success("Ruling removida."); }}><Trash2 className="size-4" /></Button></div></div>)}</CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="events">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between"><h3 className="font-heading text-3xl uppercase">Formulário de evento</h3><Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{selectedTournamentId ? "Edição" : "Criação"}</Badge></div><Input value={tournamentForm.name} onChange={(e) => setTournamentForm((s) => ({ ...s, name: e.target.value }))} placeholder="Nome do evento" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><div className="grid gap-4 md:grid-cols-2"><Input value={tournamentForm.season} onChange={(e) => setTournamentForm((s) => ({ ...s, season: e.target.value }))} placeholder="Season" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input value={tournamentForm.format} onChange={(e) => setTournamentForm((s) => ({ ...s, format: e.target.value as TournamentRecord["format"] }))} placeholder="Formato" className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input type="date" value={tournamentForm.date} onChange={(e) => setTournamentForm((s) => ({ ...s, date: e.target.value }))} className="rounded-none border-white/15 bg-slate-950/70 text-white" /><Input type="number" value={tournamentForm.players} onChange={(e) => setTournamentForm((s) => ({ ...s, players: Number(e.target.value) }))} placeholder="Players" className="rounded-none border-white/15 bg-slate-950/70 text-white" /></div><div className="flex flex-wrap gap-3"><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={submitTournament}>{selectedTournamentId ? "Salvar evento" : "Criar evento"}</Button><Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => { setSelectedTournamentId(""); setTournamentForm(emptyTournamentForm); }}>Novo</Button></div></CardContent></Card>
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="space-y-3 p-5"><h3 className="font-heading text-3xl uppercase">Eventos do banco</h3>{tournaments.map((event) => <div key={event.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4"><div><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{event.season} · {event.format} · {event.date}</p><p className="mt-1 text-lg text-white">{event.name}</p><p className="text-sm text-slate-400">{event.players} jogadores</p></div><div className="flex gap-2"><Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setSelectedTournamentId(event.id)}>Editar</Button><Button variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={async () => { if (!ensureAdmin()) return; await api.deleteTournament(event.id); await loadAll(); toast.success("Evento removido."); }}><Trash2 className="size-4" /></Button></div></div>)}</CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PortalShell>
  );
}

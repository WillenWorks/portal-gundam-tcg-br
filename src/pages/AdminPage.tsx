import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { usePortalDb } from "@/hooks/use-portal-db";
import {
  createCard,
  createRule,
  createTournament,
  deleteCard,
  deleteRule,
  deleteTournament,
  resetPortalDb,
  updateCard,
  updateRule,
  updateTournament,
} from "@/lib/portal-db";
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
  category: "Basic Rules",
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

export default function AdminPage() {
  const { cards, rules, tournaments } = usePortalDb();

  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [selectedRuleId, setSelectedRuleId] = useState<string>("");
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");

  const [cardForm, setCardForm] = useState<Omit<CardRecord, "id">>(emptyCardForm);
  const [ruleForm, setRuleForm] = useState<Omit<RuleEntry, "id">>(emptyRuleForm);
  const [tournamentForm, setTournamentForm] = useState<Omit<TournamentRecord, "id">>(emptyTournamentForm);

  const selectedCard = useMemo(() => cards.find((item) => item.id === selectedCardId), [cards, selectedCardId]);
  const selectedRule = useMemo(() => rules.find((item) => item.id === selectedRuleId), [rules, selectedRuleId]);
  const selectedTournament = useMemo(
    () => tournaments.find((item) => item.id === selectedTournamentId),
    [tournaments, selectedTournamentId],
  );

  useEffect(() => {
    setCardForm(
      selectedCard
        ? { ...selectedCard, keywords: selectedCard.keywords }
        : emptyCardForm,
    );
  }, [selectedCard]);

  useEffect(() => {
    setRuleForm(selectedRule ? { ...selectedRule, relatedCards: selectedRule.relatedCards ?? [] } : emptyRuleForm);
  }, [selectedRule]);

  useEffect(() => {
    setTournamentForm(selectedTournament ? { ...selectedTournament } : emptyTournamentForm);
  }, [selectedTournament]);

  const submitCard = () => {
    if (!cardForm.code || !cardForm.name || !cardForm.series) {
      toast.error("Preencha código, nome e série da carta.");
      return;
    }

    const payload = {
      ...cardForm,
      keywords: cardForm.keywords.filter(Boolean),
    };

    if (selectedCardId) {
      updateCard(selectedCardId, payload);
      toast.success("Carta atualizada.");
    } else {
      createCard(payload);
      toast.success("Carta criada.");
    }

    setSelectedCardId("");
    setCardForm(emptyCardForm);
  };

  const submitRule = () => {
    if (!ruleForm.title || !ruleForm.summaryPt || !ruleForm.originalRef) {
      toast.error("Preencha título, resumo e referência original.");
      return;
    }

    const payload = {
      ...ruleForm,
      relatedCards: ruleForm.relatedCards?.filter(Boolean) ?? [],
    };

    if (selectedRuleId) {
      updateRule(selectedRuleId, payload);
      toast.success("Ruling atualizada.");
    } else {
      createRule(payload);
      toast.success("Ruling criada.");
    }

    setSelectedRuleId("");
    setRuleForm(emptyRuleForm);
  };

  const submitTournament = () => {
    if (!tournamentForm.name || !tournamentForm.winner) {
      toast.error("Preencha nome do evento e deck vencedor.");
      return;
    }

    const payload = {
      ...tournamentForm,
      players: Number(tournamentForm.players) || 0,
      decks: tournamentForm.decks ?? [],
    };

    if (selectedTournamentId) {
      updateTournament(selectedTournamentId, payload);
      toast.success("Evento atualizado.");
    } else {
      createTournament(payload);
      toast.success("Evento criado.");
    }

    setSelectedTournamentId("");
    setTournamentForm(emptyTournamentForm);
  };

  return (
    <PortalShell>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
          <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Admin CRUD</p>
              <h2 className="mt-2 font-heading text-5xl uppercase leading-none">Operação persistente com formulários</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                O admin agora permite criar, editar e excluir dados persistidos no store atual. A estrutura já espelha os
                domínios que serão ligados ao Prisma real quando a API/backend entrar.
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-none border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
              onClick={() => {
                resetPortalDb();
                setSelectedCardId("");
                setSelectedRuleId("");
                setSelectedTournamentId("");
                toast.success("Base local resetada para o seed inicial.");
              }}
            >
              Resetar base local
            </Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="cards" className="space-y-6">
          <TabsList className="h-auto flex-wrap rounded-none border border-white/10 bg-white/5 p-1">
            <TabsTrigger value="cards" className="rounded-none uppercase tracking-[0.18em]">Cartas</TabsTrigger>
            <TabsTrigger value="rules" className="rounded-none uppercase tracking-[0.18em]">Rulings</TabsTrigger>
            <TabsTrigger value="events" className="rounded-none uppercase tracking-[0.18em]">Eventos</TabsTrigger>
          </TabsList>

          <TabsContent value="cards">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-3xl uppercase">Formulário de carta</h3>
                    <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{selectedCardId ? "Edição" : "Criação"}</Badge>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input value={cardForm.code} onChange={(e) => setCardForm((s) => ({ ...s, code: e.target.value }))} placeholder="Código" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input value={cardForm.name} onChange={(e) => setCardForm((s) => ({ ...s, name: e.target.value }))} placeholder="Nome EN" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input value={cardForm.namePt ?? ""} onChange={(e) => setCardForm((s) => ({ ...s, namePt: e.target.value }))} placeholder="Nome PT" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input value={cardForm.series} onChange={(e) => setCardForm((s) => ({ ...s, series: e.target.value }))} placeholder="Série" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input value={cardForm.trait} onChange={(e) => setCardForm((s) => ({ ...s, trait: e.target.value }))} placeholder="Trait" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input value={cardForm.color} onChange={(e) => setCardForm((s) => ({ ...s, color: e.target.value as CardRecord["color"] }))} placeholder="Cor" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input type="number" value={cardForm.cost} onChange={(e) => setCardForm((s) => ({ ...s, cost: Number(e.target.value) }))} placeholder="Custo" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input value={cardForm.type} onChange={(e) => setCardForm((s) => ({ ...s, type: e.target.value as CardRecord["type"] }))} placeholder="Tipo" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input type="number" value={cardForm.level ?? 0} onChange={(e) => setCardForm((s) => ({ ...s, level: Number(e.target.value) }))} placeholder="Level" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input type="number" value={cardForm.ap ?? 0} onChange={(e) => setCardForm((s) => ({ ...s, ap: Number(e.target.value) }))} placeholder="AP" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input type="number" value={cardForm.hp ?? 0} onChange={(e) => setCardForm((s) => ({ ...s, hp: Number(e.target.value) }))} placeholder="HP" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input value={cardForm.imageUrl ?? ""} onChange={(e) => setCardForm((s) => ({ ...s, imageUrl: e.target.value }))} placeholder="Image URL" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  </div>

                  <Input
                    value={cardForm.keywords.join(", ")}
                    onChange={(e) => setCardForm((s) => ({ ...s, keywords: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))}
                    placeholder="Keywords separadas por vírgula"
                    className="rounded-none border-white/15 bg-slate-950/70 text-white"
                  />
                  <Textarea value={cardForm.effect} onChange={(e) => setCardForm((s) => ({ ...s, effect: e.target.value }))} placeholder="Efeito" className="min-h-28 rounded-none border-white/15 bg-slate-950/70 text-white" />

                  <div className="flex flex-wrap gap-3">
                    <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={submitCard}>{selectedCardId ? "Salvar carta" : "Criar carta"}</Button>
                    <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => { setSelectedCardId(""); setCardForm(emptyCardForm); }}>Novo</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-3 p-5">
                  <h3 className="font-heading text-3xl uppercase">Cartas persistidas</h3>
                  {cards.map((card) => (
                    <div key={card.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p>
                        <p className="mt-1 text-lg text-white">{card.namePt || card.name}</p>
                        <p className="text-sm text-slate-400">{card.color} · {card.type} · {card.series}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setSelectedCardId(card.id)}>Editar</Button>
                        <Button variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => { deleteCard(card.id); toast.success("Carta removida."); }}><Trash2 className="size-4" /></Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rules">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-3xl uppercase">Formulário de ruling</h3>
                    <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{selectedRuleId ? "Edição" : "Criação"}</Badge>
                  </div>

                  <Input value={ruleForm.title} onChange={(e) => setRuleForm((s) => ({ ...s, title: e.target.value }))} placeholder="Título" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input value={ruleForm.category} onChange={(e) => setRuleForm((s) => ({ ...s, category: e.target.value as RuleEntry["category"] }))} placeholder="Categoria" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input value={ruleForm.source} onChange={(e) => setRuleForm((s) => ({ ...s, source: e.target.value as RuleEntry["source"] }))} placeholder="Fonte" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  </div>
                  <Input value={ruleForm.originalRef} onChange={(e) => setRuleForm((s) => ({ ...s, originalRef: e.target.value }))} placeholder="Referência original" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Input value={ruleForm.relatedKeyword ?? ""} onChange={(e) => setRuleForm((s) => ({ ...s, relatedKeyword: e.target.value }))} placeholder="Keyword relacionada" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Textarea value={ruleForm.summaryPt} onChange={(e) => setRuleForm((s) => ({ ...s, summaryPt: e.target.value }))} placeholder="Resumo PT-BR" className="min-h-32 rounded-none border-white/15 bg-slate-950/70 text-white" />

                  <div className="flex flex-wrap gap-3">
                    <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={submitRule}>{selectedRuleId ? "Salvar ruling" : "Criar ruling"}</Button>
                    <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => { setSelectedRuleId(""); setRuleForm(emptyRuleForm); }}>Novo</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-3 p-5">
                  <h3 className="font-heading text-3xl uppercase">Rulings persistidas</h3>
                  {rules.map((rule) => (
                    <div key={rule.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{rule.category} · {rule.source}</p>
                        <p className="mt-1 text-lg text-white">{rule.title}</p>
                        <p className="text-sm text-slate-400">{rule.originalRef}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setSelectedRuleId(rule.id)}>Editar</Button>
                        <Button variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => { deleteRule(rule.id); toast.success("Ruling removida."); }}><Trash2 className="size-4" /></Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="events">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-3xl uppercase">Formulário de evento</h3>
                    <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{selectedTournamentId ? "Edição" : "Criação"}</Badge>
                  </div>

                  <Input value={tournamentForm.name} onChange={(e) => setTournamentForm((s) => ({ ...s, name: e.target.value }))} placeholder="Nome do evento" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input value={tournamentForm.season} onChange={(e) => setTournamentForm((s) => ({ ...s, season: e.target.value }))} placeholder="Season" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input value={tournamentForm.format} onChange={(e) => setTournamentForm((s) => ({ ...s, format: e.target.value as TournamentRecord["format"] }))} placeholder="Formato" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input type="date" value={tournamentForm.date} onChange={(e) => setTournamentForm((s) => ({ ...s, date: e.target.value }))} className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                    <Input type="number" value={tournamentForm.players} onChange={(e) => setTournamentForm((s) => ({ ...s, players: Number(e.target.value) }))} placeholder="Players" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  </div>
                  <Input value={tournamentForm.winner} onChange={(e) => setTournamentForm((s) => ({ ...s, winner: e.target.value }))} placeholder="Deck vencedor" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Textarea
                    value={tournamentForm.decks.map((deck) => `${deck.archetype}|${deck.share}|${deck.topCutConversion}|${deck.stapleCards.join(";")}`).join("\n")}
                    onChange={(e) =>
                      setTournamentForm((s) => ({
                        ...s,
                        decks: e.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((line) => {
                            const [archetype, share, topCutConversion, staples] = line.split("|");
                            return {
                              archetype: archetype ?? "Arquétipo",
                              share: Number(share ?? 0),
                              topCutConversion: Number(topCutConversion ?? 0),
                              stapleCards: (staples ?? "").split(";").map((item) => item.trim()).filter(Boolean),
                            };
                          }),
                      }))
                    }
                    placeholder="Uma linha por deck: Arquétipo|Share|TopCut|Staple1;Staple2"
                    className="min-h-32 rounded-none border-white/15 bg-slate-950/70 text-white"
                  />

                  <div className="flex flex-wrap gap-3">
                    <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={submitTournament}>{selectedTournamentId ? "Salvar evento" : "Criar evento"}</Button>
                    <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => { setSelectedTournamentId(""); setTournamentForm(emptyTournamentForm); }}>Novo</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-3 p-5">
                  <h3 className="font-heading text-3xl uppercase">Eventos persistidos</h3>
                  {tournaments.map((event) => (
                    <div key={event.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{event.season} · {event.format} · {event.date}</p>
                        <p className="mt-1 text-lg text-white">{event.name}</p>
                        <p className="text-sm text-slate-400">{event.players} jogadores · vencedor {event.winner}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setSelectedTournamentId(event.id)}>Editar</Button>
                        <Button variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => { deleteTournament(event.id); toast.success("Evento removido."); }}><Trash2 className="size-4" /></Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PortalShell>
  );
}

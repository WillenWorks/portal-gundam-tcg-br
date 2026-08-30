/* Simulador — UI mínima de sandbox (docs/18, passo 4). Decisões do Willen que
 * moldam este arquivo: (1) testar com 2 ABAS REAIS logadas em 2 contas
 * diferentes, validando que a redação de informação oculta por jogador
 * (viewStateFor, server/matchStore.ts) roda de verdade no servidor -- por
 * isso a lista de partidas abaixo mostra TODAS as partidas em memória (não só
 * as do usuário logado): é assim que a 2ª conta, numa 2ª aba, acha e entra na
 * MESMA partida sem precisar de um link com matchId; (2) restrito a
 * admin/hoster; (3) sincronização por SSE (EventSource nativo, sem lib), 1
 * conexão por assento -- ver buildSimulatorStreamUrl em @/lib/api.
 *
 * Escopo reduzido de propósito (mesma convenção do resto do docs/18, "não
 * fingir" cobertura que não existe):
 * - Seleção de alvo é por clique (não drag-and-drop) e genérica: qualquer
 *   carta clicada durante um deploy/Command vira alvo candidato, mandado pro
 *   servidor sob os 2 nomes de grupo usados pelos EffectSpec de ST01/ST02
 *   (`target` e `shield`, ver content/st01.ts e content/st02.ts) -- nenhum
 *   efeito das 2 decks de teste precisa dos 2 grupos ao mesmo tempo, então
 *   isso é seguro aqui, mas não é um seletor de alvo genérico de verdade.
 * - Pareamento de Pilot reusa a MESMA seleção: a 1ª Unit própria elegível
 *   marcada vira `pairWithUnitId`.
 * - 【Burst】 de shield é sempre recusado automaticamente pelo motor
 *   (applyPlayerAction, passAction) -- não tem passo de decisão na UI ainda.
 * - Gatilhos que não são Deploy/When Paired/Main/Action básicos (ex.:
 *   <Attack>, <Activate·Main>) não têm PlayerAction própria ainda, então não
 *   aparecem como ação jogável aqui (ver actions.ts pro detalhe completo).
 * - Sem rota de apagar partida (não existe no servidor) -- partidas somem só
 *   quando o processo reinicia (sem persistência, decisão já tomada).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogOut, Plus, RefreshCw, Shield, Swords, Users } from "lucide-react";

import { api, buildSimulatorStreamUrl, type SimulatorMatchSummary } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { effectiveAp, effectiveHp, hasKeyword, otherPlayer, type AttackTarget, type CardInstance, type PlayerId } from "@/modules/simulator/engine/types";
import type { PlayerAction } from "@/modules/simulator/engine/actions";
import type { HiddenCard, ViewCardInstance, ViewGameState } from "@/modules/simulator/engine/viewState";

const PHASE_LABEL: Record<string, string> = { start: "Start", draw: "Draw", resource: "Resource", main: "Main", end: "End" };
const DECK_OPTIONS = ["ST01", "ST02"];

function isHidden(card: ViewCardInstance): card is HiddenCard {
  return "hidden" in card && (card as HiddenCard).hidden === true;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// -----------------------------------------------------------------------------
// Lobby -- lista de partidas em memória + criação de partida nova.
// -----------------------------------------------------------------------------

export default function SimulatorSandboxPage() {
  const [matches, setMatches] = useState<SimulatorMatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ deckA: "ST01", deckB: "ST02", firstPlayer: "A" as PlayerId, seed: "" });
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    try {
      const result = await api.listSimulatorMatches();
      setMatches(result);
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao carregar partidas."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
    if (activeMatchId) return; // dentro de uma partida, quem atualiza a tela é o SSE, não o polling da lista
    const interval = setInterval(loadMatches, 6000);
    return () => clearInterval(interval);
  }, [loadMatches, activeMatchId]);

  const createMatch = async () => {
    setCreating(true);
    try {
      const seed = createForm.seed.trim() ? Number(createForm.seed.trim()) : undefined;
      const match = await api.createSimulatorMatch({ deckA: createForm.deckA, deckB: createForm.deckB, firstPlayer: createForm.firstPlayer, seed });
      setCreateOpen(false);
      setCreateForm({ deckA: "ST01", deckB: "ST02", firstPlayer: "A", seed: "" });
      await loadMatches();
      setActiveMatchId(match.id);
      toast.success("Partida criada.");
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao criar partida."));
    } finally {
      setCreating(false);
    }
  };

  if (activeMatchId) {
    return (
      <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador (sandbox)" }]}>
        <MatchBoard matchId={activeMatchId} onExit={() => setActiveMatchId(null)} />
      </PortalShell>
    );
  }

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador (sandbox)" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Simulador</p>
              <h1 className="mt-2 font-heading text-4xl uppercase heading-portal">Sandbox de partida</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-soft">
                Ferramenta de teste interno (admin/hoster) do motor de regras. Abra esta página em 2 abas, logado em 2 contas diferentes, e entre nos
                assentos A e B da mesma partida abaixo -- cada lado só vê a própria mão e o próprio deck/shields, exatamente como no jogo real.
              </p>
            </div>
            <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Nova partida
            </Button>
          </CardContent>
        </Card>

        {loading ? <p className="text-sm text-muted-portal">Carregando partidas...</p> : null}

        {!loading && !matches.length ? (
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-10 text-center">
              <p className="text-lg heading-portal">Nenhuma partida em andamento</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-portal">
                Crie uma partida de teste (ST01 vs ST02 por padrão) e entre num dos 2 assentos.
              </p>
              <Button className="mt-5 rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 size-4" />
                Criar partida
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {matches.map((match) => (
            <Card key={match.id} className="panel-cut rounded-none surface-panel">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-muted-portal">Partida {match.id.slice(0, 8)}</p>
                  {match.gameOver ? (
                    <Badge variant="outline" className="rounded-none border-primary/40 text-primary">
                      Encerrada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-none border-primary/40 text-primary">
                      {PHASE_LABEL[match.phase]} · T{match.turnNumber}
                    </Badge>
                  )}
                </div>
                <p className="flex items-center gap-2 text-sm text-soft">
                  <Users className="size-4" />
                  A: {match.seats.A?.displayName ?? "— vazio —"} · B: {match.seats.B?.displayName ?? "— vazio —"}
                </p>
                {match.gameOver ? (
                  <p className="text-xs text-muted-portal">Vitória do jogador {match.gameOver.winner} ({match.gameOver.reason}).</p>
                ) : (
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Vez de {match.activePlayer}</p>
                )}
                <Button variant="outline" className="rounded-none" onClick={() => setActiveMatchId(match.id)}>
                  <Swords className="mr-2 size-4" />
                  Abrir
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent aria-describedby={undefined} className="panel-cut max-w-lg rounded-none border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Nova partida de teste</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Deck do jogador A</span>
              <select value={createForm.deckA} onChange={(e) => setCreateForm((s) => ({ ...s, deckA: e.target.value }))} className="field-shell h-10 w-full px-3 text-sm">
                {DECK_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Deck do jogador B</span>
              <select value={createForm.deckB} onChange={(e) => setCreateForm((s) => ({ ...s, deckB: e.target.value }))} className="field-shell h-10 w-full px-3 text-sm">
                {DECK_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Quem começa</span>
              <select value={createForm.firstPlayer} onChange={(e) => setCreateForm((s) => ({ ...s, firstPlayer: e.target.value as PlayerId }))} className="field-shell h-10 w-full px-3 text-sm">
                <option value="A">Jogador A</option>
                <option value="B">Jogador B</option>
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Seed (opcional, pra reproduzir)</span>
              <input
                value={createForm.seed}
                onChange={(e) => setCreateForm((s) => ({ ...s, seed: e.target.value }))}
                className="field-shell h-10 w-full px-3 text-sm"
                placeholder="aleatória"
              />
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={creating} onClick={createMatch}>
              {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
              Criar
            </Button>
            <Button variant="outline" className="rounded-none" onClick={() => setCreateOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PortalShell>
  );
}

// -----------------------------------------------------------------------------
// Tabuleiro de uma partida -- entra num assento, conecta o SSE, joga.
// -----------------------------------------------------------------------------

type PendingAction = { kind: "deploy" | "command"; cardInstanceId: string; trigger?: "Main" | "Action" };

function findPublicCard(view: ViewGameState, instanceId: string): CardInstance | null {
  for (const pid of ["A", "B"] as PlayerId[]) {
    const player = view.players[pid];
    for (const zone of ["battleArea", "baseSection", "resourceArea", "trash"] as const) {
      const found = player[zone].find((c) => c.instanceId === instanceId);
      if (found && !isHidden(found)) return found as CardInstance;
    }
  }
  return null;
}

function MatchBoard({ matchId, onExit }: { matchId: string; onExit: () => void }) {
  const { user } = useAuth();
  const [seat, setSeat] = useState<PlayerId | null>(null);
  const [view, setView] = useState<ViewGameState | null>(null);
  const [checkingSeat, setCheckingSeat] = useState(true);
  const [joining, setJoining] = useState<PlayerId | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [attackerId, setAttackerId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCheckingSeat(true);
    api
      .getSimulatorMatch(matchId)
      .then((result) => {
        if (cancelled) return;
        if (result.seated) setSeat(result.seat);
      })
      .catch((err) => toast.error(errorMessage(err, "Erro ao abrir a partida.")))
      .finally(() => !cancelled && setCheckingSeat(false));
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useEffect(() => {
    if (!seat) return;
    const url = buildSimulatorStreamUrl(matchId);
    if (!url) {
      toast.error("Sessão inválida -- faça login de novo.");
      return;
    }
    const source = new EventSource(url);
    eventSourceRef.current = source;
    source.addEventListener("state", (event: MessageEvent) => {
      setConnected(true);
      setView(JSON.parse(event.data) as ViewGameState);
    });
    source.onerror = () => setConnected(false);
    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, [matchId, seat]);

  const clearSelection = () => {
    setPending(null);
    setSelected([]);
    setAttackerId(null);
  };

  const runAction = useCallback(
    async (action: PlayerAction) => {
      setBusy(true);
      try {
        const res = await api.sendSimulatorAction(matchId, action);
        setView(res.view);
        clearSelection();
      } catch (err) {
        toast.error(errorMessage(err, "Ação inválida."));
      } finally {
        setBusy(false);
      }
    },
    [matchId],
  );

  const join = async (seatToJoin: PlayerId) => {
    setJoining(seatToJoin);
    try {
      const res = await api.joinSimulatorMatch(matchId, seatToJoin);
      setSeat(res.seat);
      setView(res.view);
      toast.success(`Você entrou no assento ${res.seat}.`);
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao entrar na partida."));
    } finally {
      setJoining(null);
    }
  };

  if (checkingSeat) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-portal">
        <Loader2 className="size-4 animate-spin" />
        Abrindo partida...
      </div>
    );
  }

  if (!seat) {
    return (
      <div className="space-y-4">
        <Button variant="outline" className="rounded-none" onClick={onExit}>
          <LogOut className="mr-2 size-4" />
          Voltar pra lista
        </Button>
        <Card className="panel-cut rounded-none surface-panel">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-soft">
              Escolha um assento pra {user?.displayName ?? "você"}. Pra testar a separação de informação de verdade, use uma 2ª aba (logada com outra
              conta) e entre no assento oposto.
            </p>
            <div className="flex gap-3">
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={joining !== null} onClick={() => join("A")}>
                {joining === "A" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Entrar como Jogador A
              </Button>
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={joining !== null} onClick={() => join("B")}>
                {joining === "B" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Entrar como Jogador B
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-portal">
        <Loader2 className="size-4 animate-spin" />
        Conectando ao stream da partida...
      </div>
    );
  }

  const opponentSeat = otherPlayer(seat);
  const combat = view.combat;
  const myTurnMain = !combat && view.phase === "main" && view.activePlayer === seat;
  const commandTrigger: "Main" | "Action" | null = combat?.step === "action" && combat.actionPriority === seat ? "Action" : myTurnMain ? "Main" : null;
  const iAmDefending = combat?.step === "block" && combat.defendingPlayer === seat;
  const iHavePriority = combat?.step === "action" && combat.actionPriority === seat;

  const toggleSelect = (instanceId: string) => {
    if (!pending) return;
    setSelected((current) => (current.includes(instanceId) ? current.filter((id) => id !== instanceId) : [...current, instanceId]));
  };

  const startDeploy = (card: CardInstance) => setPending({ kind: "deploy", cardInstanceId: card.instanceId });
  const startCommand = (card: CardInstance) => {
    if (!commandTrigger) return;
    setPending({ kind: "command", cardInstanceId: card.instanceId, trigger: commandTrigger });
  };

  const confirmPending = () => {
    if (!pending || !view) return;
    const myBattleArea = view.players[seat].battleArea.filter((c) => !isHidden(c)) as CardInstance[];
    if (pending.kind === "deploy") {
      const card = view.players[seat].hand.find((c) => !isHidden(c) && c.instanceId === pending.cardInstanceId) as CardInstance | undefined;
      let pairWithUnitId: string | undefined;
      if (card?.def.cardType === "PILOT") {
        pairWithUnitId = selected.find((id) => myBattleArea.some((u) => u.instanceId === id && u.def.cardType === "UNIT" && !u.pairedPilotId));
        if (!pairWithUnitId) {
          toast.error("Selecione (clicando na Battle Area) a Unit própria pra parear com este Pilot.");
          return;
        }
      }
      const targetIds = selected.filter((id) => id !== pairWithUnitId);
      const targets = targetIds.length ? { target: targetIds, shield: targetIds } : undefined;
      runAction({ kind: "deployCard", cardInstanceId: pending.cardInstanceId, pairWithUnitId, targets });
    } else {
      const targets = selected.length ? { target: selected, shield: selected } : undefined;
      runAction({ kind: "playCommand", cardInstanceId: pending.cardInstanceId, trigger: pending.trigger ?? "Main", targets });
    }
  };

  const declareAttack = (target: AttackTarget) => {
    if (!attackerId) return;
    runAction({ kind: "declareAttack", attackerId, target });
  };

  function renderCard(card: ViewCardInstance, opts: { selectableAsTarget?: boolean; showAttack?: boolean; showAttackTarget?: boolean; showBlocker?: boolean }) {
    const key = card.instanceId;
    const selectable = Boolean(pending) && opts.selectableAsTarget;
    const isSelected = selected.includes(key);

    if (isHidden(card)) {
      return (
        <button
          key={key}
          type="button"
          disabled={!selectable}
          onClick={() => toggleSelect(key)}
          className={`panel-cut border px-2 py-1.5 text-left text-[11px] leading-tight transition-colors ${isSelected ? "border-primary bg-primary/20 text-primary" : "border-white/10 bg-black/30 text-muted-portal"} ${selectable ? "cursor-pointer hover:border-primary/50" : "cursor-default"}`}
        >
          Carta oculta
        </button>
      );
    }

    const c = card as CardInstance;
    const isAttacker = attackerId === c.instanceId;
    return (
      <div
        key={key}
        className={`panel-cut border px-2 py-1.5 text-[11px] leading-tight ${isSelected || isAttacker ? "border-primary bg-primary/20 text-primary" : "border-white/10 bg-black/20 text-soft"} ${c.rested ? "opacity-60" : ""}`}
      >
        <button type="button" disabled={!selectable} onClick={() => toggleSelect(c.instanceId)} className={`block w-full text-left ${selectable ? "cursor-pointer" : "cursor-default"}`}>
          <p className="font-semibold">{c.def.nameEn}</p>
          <p className="text-muted-portal">
            {c.def.code}
            {c.def.cardType === "UNIT" ? ` · AP${effectiveAp(c)}/HP${Math.max(0, effectiveHp(c) - c.damage)}` : ""}
            {c.rested ? " · rested" : " · active"}
            {c.pairedPilotId ? " · pareada" : ""}
          </p>
        </button>
        <div className="mt-1 flex flex-wrap gap-1">
          {opts.showAttack && !c.rested && c.def.cardType === "UNIT" ? (
            <Button size="sm" variant="outline" className="h-6 rounded-none px-2 text-[10px]" disabled={busy} onClick={() => setAttackerId(c.instanceId)}>
              Atacar
            </Button>
          ) : null}
          {opts.showAttackTarget && c.rested && c.def.cardType === "UNIT" ? (
            <Button size="sm" variant="outline" className="h-6 rounded-none px-2 text-[10px]" disabled={busy} onClick={() => declareAttack({ unitId: c.instanceId })}>
              Alvo do ataque
            </Button>
          ) : null}
          {opts.showBlocker && !c.rested && hasKeyword(c, "Blocker") ? (
            <Button size="sm" variant="outline" className="h-6 rounded-none px-2 text-[10px]" disabled={busy} onClick={() => runAction({ kind: "activateBlocker", blockerId: c.instanceId })}>
              Ativar Blocker
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  function renderPlayerBoard(pid: PlayerId, isSelf: boolean) {
    const player = view!.players[pid];
    const showAttack = isSelf && myTurnMain && !attackerId;
    const showAttackTarget = !isSelf && attackerId !== null && combat === null;
    const showBlocker = isSelf && iAmDefending;

    return (
      <Card className="panel-cut rounded-none surface-panel">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-soft">
              {isSelf ? "Você" : "Oponente"} ({pid}) {view!.activePlayer === pid ? <Badge variant="outline" className="ml-1 rounded-none border-primary/40 text-primary">Ativo</Badge> : null}
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Deck {player.counts.deck} · Recursos {player.counts.resourceDeck} · Shields {player.counts.shields}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Battle Area</p>
            {!player.battleArea.length ? (
              <p className="text-xs text-muted-portal">Vazia.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {player.battleArea.map((card) => renderCard(card, { selectableAsTarget: true, showAttack, showAttackTarget, showBlocker }))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Base</p>
            {!player.baseSection.length ? <p className="text-xs text-muted-portal">Nenhuma.</p> : <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">{player.baseSection.map((card) => renderCard(card, { selectableAsTarget: true }))}</div>}
          </div>

          {isSelf ? (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Shields ({player.counts.shields})</p>
              <div className="flex flex-wrap gap-1.5">{player.shields.map((card) => renderCard(card, { selectableAsTarget: true }))}</div>
            </div>
          ) : null}

          <p className="text-xs text-muted-portal">
            Resource Area: {player.resourceArea.filter((c) => !isHidden(c) && !(c as CardInstance).rested).length} active / {player.counts.resourceArea} total · Trash: {player.counts.trash}
          </p>

          {isSelf ? (
            <div className="space-y-1 border-t border-primary/10 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Mão ({player.hand.length})</p>
              {!player.hand.length ? (
                <p className="text-xs text-muted-portal">Vazia.</p>
              ) : (
                <div className="space-y-1.5">
                  {(player.hand as CardInstance[]).map((card) => {
                    const isCommand = card.def.cardType === "COMMAND";
                    const canPlay = isCommand ? Boolean(commandTrigger) && (card.def.triggerKeywords?.includes(commandTrigger!) ?? false) : myTurnMain;
                    return (
                      <div key={card.instanceId} className="panel-cut flex items-center justify-between gap-2 border border-primary/10 bg-black/10 px-3 py-2">
                        <div>
                          <p className="text-xs font-semibold text-soft">{card.def.nameEn}</p>
                          <p className="text-[10px] text-muted-portal">
                            {card.def.code} · custo {card.def.cost ?? 0} · nível {card.def.level ?? 0}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-none px-2 text-[10px]"
                          disabled={!canPlay || busy}
                          onClick={() => (isCommand ? startCommand(card) : startDeploy(card))}
                        >
                          Jogar
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const attacker = attackerId ? findPublicCard(view, attackerId) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" className="rounded-none" onClick={onExit}>
          <LogOut className="mr-2 size-4" />
          Voltar pra lista
        </Button>
        <p className="flex items-center gap-2 text-xs text-muted-portal">
          <RefreshCw className={`size-3.5 ${connected ? "text-primary" : "animate-pulse text-slate-500"}`} />
          {connected ? "Sincronizado (SSE)" : "Conectando..."} · assento {seat}
        </p>
      </div>

      <Card className="panel-cut rounded-none border-primary/30 hero-surface">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Turno {view.turnNumber}</p>
            <p className="mt-1 text-lg heading-portal">
              {PHASE_LABEL[view.phase]} Phase · Vez de {view.activePlayer}
              {combat ? ` · Combate (${combat.step})` : ""}
            </p>
          </div>
          {view.gameOver ? (
            <Badge variant="outline" className="rounded-none border-primary/40 text-primary">
              Fim de jogo -- vitória de {view.gameOver.winner} ({view.gameOver.reason})
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      {attackerId ? (
        <Card className="panel-cut rounded-none border-primary/30 surface-panel">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm text-soft">
            <Swords className="size-4 text-primary" />
            Atacando com {attacker?.def.nameEn ?? attackerId}. Escolha o alvo:
            <Button size="sm" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={() => declareAttack("player")}>
              Atacar o jogador
            </Button>
            <span className="text-xs text-muted-portal">ou clique em "Alvo do ataque" numa Unit rested do oponente abaixo.</span>
            <Button size="sm" variant="outline" className="rounded-none" onClick={() => setAttackerId(null)}>
              Cancelar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {pending ? (
        <Card className="panel-cut rounded-none border-primary/30 surface-panel">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm text-soft">
            <Shield className="size-4 text-primary" />
            {pending.kind === "deploy" ? "Jogando carta." : `Jogando Command (${pending.trigger}).`} Se o efeito pedir alvo (ou se for um Pilot, a Unit pra
            parear), clique nas cartas do tabuleiro antes de confirmar -- {selected.length} selecionada(s).
            <Button size="sm" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={confirmPending}>
              Confirmar
            </Button>
            <Button size="sm" variant="outline" className="rounded-none" onClick={clearSelection}>
              Cancelar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {iAmDefending ? (
        <Card className="panel-cut rounded-none border-primary/30 surface-panel">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm text-soft">
            Você está defendendo. Ative um <strong>&lt;Blocker&gt;</strong> (botão na Unit, abaixo) ou:
            <Button size="sm" variant="outline" className="rounded-none" disabled={busy} onClick={() => runAction({ kind: "skipBlock" })}>
              Não bloquear
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {iHavePriority ? (
        <Card className="panel-cut rounded-none border-primary/30 surface-panel">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm text-soft">
            Action Step -- sua prioridade. Jogue uma Command 【Action】 da mão ou:
            <Button size="sm" variant="outline" className="rounded-none" disabled={busy} onClick={() => runAction({ kind: "passAction" })}>
              Passar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {myTurnMain ? (
        <Card className="panel-cut rounded-none border-primary/30 surface-panel">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm text-soft">
            Sua Main Phase.
            <Button size="sm" variant="outline" className="rounded-none" disabled={busy} onClick={() => runAction({ kind: "finishTurn" })}>
              Encerrar turno
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {renderPlayerBoard(opponentSeat, false)}
        {renderPlayerBoard(seat, true)}
      </div>
    </div>
  );
}

/* Simulador Beta (docs/18, passo 4 + expansão 2026-08-30). Decisões do Willen
 * que moldam este arquivo:
 * - 1 botão só ("Simulador Beta"). Sem escolher assento ou adversário --
 *   entra na fila, escolhe o deck, e a sincronização com o próximo jogador
 *   (sempre outra conta) resolve sozinha e abre o tabuleiro direto.
 * - Antes da fila, cada jogador escolhe o próprio deck (ST01/ST02, qualquer
 *   combinação, incluindo os dois lados com o mesmo deck).
 * - Timer de 90s por decisão (não por turno inteiro) -- estourou, o servidor
 *   age sozinho (passa a vez/pula bloqueio/encerra turno). Mostrado aqui só
 *   como contagem regressiva informativa; quem decide de verdade é sempre o
 *   servidor (matchStore.ts).
 * - W.O. por abandono depois de 3min sem nenhum sinal de vida do oponente
 *   (ping do cliente enquanto a aba está visível OU qualquer ação real) --
 *   NUNCA automático, só destrava um botão pro lado presente clicar.
 * - Aberto a qualquer usuário logado (não mais restrito a admin/hoster).
 *
 * Referências visuais pedidas (Wing Table, Mobile Suit Arena): não foi
 * possível carregar o conteúdo detalhado dos 2 sites neste ambiente (SPAs
 * pesadas em JS, sem navegador conectado) -- a composição visual abaixo
 * segue a linguagem já estabelecida no resto do Portal (panel-cut,
 * hero-surface) em vez de replicar pixel a pixel essas referências. Se o
 * Willen quiser aproximar mais, capturas de tela das 2 referências ajudam.
 *
 * Escopo reduzido de propósito, herdado do passo 4 (mesma convenção do
 * resto do docs/18, "não fingir" cobertura que não existe):
 * - Seleção de alvo é por clique (não drag-and-drop) e genérica: qualquer
 *   carta clicada durante um deploy/Command vira alvo candidato, mandado pro
 *   servidor sob os 2 nomes de grupo usados pelos EffectSpec de ST01/ST02
 *   (`target` e `shield`, ver content/st01.ts e content/st02.ts).
 * - Pareamento de Pilot reusa a MESMA seleção: a 1ª Unit própria elegível
 *   marcada vira `pairWithUnitId`.
 * - 【Burst】 de shield é sempre recusado automaticamente pelo motor
 *   (applyPlayerAction, passAction) -- não tem passo de decisão na UI ainda.
 * - Gatilhos que não são Deploy/When Paired/Main/Action básicos não têm
 *   PlayerAction própria ainda, então não aparecem como ação jogável aqui.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Clock, Loader2, LogOut, RefreshCw, Shield, Swords } from "lucide-react";

import { api, buildSimulatorStreamUrl, type SimulatorMatchView } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { effectiveAp, effectiveHp, hasKeyword, otherPlayer, type AttackTarget, type CardInstance, type PlayerId } from "@/modules/simulator/engine/types";
import type { PlayerAction } from "@/modules/simulator/engine/actions";
import type { HiddenCard, ViewCardInstance, ViewGameState } from "@/modules/simulator/engine/viewState";

const PHASE_LABEL: Record<string, string> = { start: "Start", draw: "Draw", resource: "Resource", main: "Main", end: "End" };
const DECK_OPTIONS = ["ST01", "ST02"];
/** Espelha `ABANDON_THRESHOLD_MS` do servidor (matchStore.ts) -- só usado aqui pra habilitar o botão na hora certa; quem decide de verdade é sempre o servidor. */
const ABANDON_THRESHOLD_MS = 180_000;
/** Intervalo do heartbeat de presença do cliente -- bem menor que os 3min do W.O., só pra manter `lastSeenAt` fresco. */
const PRESENCE_PING_MS = 15_000;

function isHidden(card: ViewCardInstance): card is HiddenCard {
  return "hidden" in card && (card as HiddenCard).hidden === true;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// -----------------------------------------------------------------------------
// Tela de entrada -- escolher deck, entrar na fila, aguardar pareamento, jogar.
// -----------------------------------------------------------------------------

type Screen = "checking" | "lobby" | "queued" | "match";

export default function SimulatorSandboxPage() {
  const [screen, setScreen] = useState<Screen>("checking");
  const [deckKey, setDeckKey] = useState<string>("ST01");
  const [joining, setJoining] = useState(false);
  const [leavingQueue, setLeavingQueue] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [seat, setSeat] = useState<PlayerId | null>(null);

  const enterMatch = (id: string, s: PlayerId) => {
    setMatchId(id);
    setSeat(s);
    setScreen("match");
  };

  // Ao abrir a página (inclusive recarregar), descobre se o usuário já está numa partida ativa
  // (reconexão) ou já esperando na fila -- pra não obrigar a passar pelo botão de novo à toa.
  useEffect(() => {
    let cancelled = false;
    api
      .getSimulatorQueueStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.matched && status.matchId && status.seat) enterMatch(status.matchId, status.seat);
        else setScreen(status.queued ? "queued" : "lobby");
      })
      .catch(() => !cancelled && setScreen("lobby"));
    return () => {
      cancelled = true;
    };
  }, []);

  // Enquanto espera na fila, faz polling do status -- assim que outro jogador entrar, o
  // pareamento já aconteceu no servidor e este polling só precisa descobrir e abrir o tabuleiro.
  useEffect(() => {
    if (screen !== "queued") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await api.getSimulatorQueueStatus();
        if (cancelled) return;
        if (status.matched && status.matchId && status.seat) enterMatch(status.matchId, status.seat);
      } catch {
        // erro de rede pontual no polling não deve derrubar a tela de espera -- só tenta de novo no próximo tick
      }
    };
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [screen]);

  const enterQueue = async () => {
    setJoining(true);
    try {
      const status = await api.joinSimulatorQueue(deckKey);
      // Se este clique foi o 2º jogador a entrar, o pareamento já aconteceu na mesma chamada --
      // vai direto pro tabuleiro sem passar pela tela de espera.
      if (status.matched && status.matchId && status.seat) enterMatch(status.matchId, status.seat);
      else setScreen("queued");
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao entrar na fila."));
    } finally {
      setJoining(false);
    }
  };

  const cancelQueue = async () => {
    setLeavingQueue(true);
    try {
      await api.leaveSimulatorQueue();
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao sair da fila."));
    } finally {
      setLeavingQueue(false);
      setScreen("lobby");
    }
  };

  const exitMatch = () => {
    setMatchId(null);
    setSeat(null);
    setScreen("lobby");
  };

  if (screen === "checking") {
    return (
      <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador Beta" }]}>
        <div className="flex items-center gap-2 text-sm text-muted-portal">
          <Loader2 className="size-4 animate-spin" />
          Verificando sessão do simulador...
        </div>
      </PortalShell>
    );
  }

  if (screen === "match" && matchId && seat) {
    return (
      <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador Beta" }]}>
        <MatchBoard matchId={matchId} seat={seat} onExit={exitMatch} />
      </PortalShell>
    );
  }

  if (screen === "queued") {
    return (
      <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador Beta" }]}>
        <div className="mx-auto max-w-xl">
          <Card className="panel-cut rounded-none border-primary/30 hero-surface">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Simulador Beta</p>
                <h1 className="mt-2 font-heading text-3xl uppercase heading-portal">Aguardando oponente</h1>
                <p className="mt-3 text-sm leading-7 text-soft">
                  Deck escolhido: <strong>{deckKey}</strong>. Assim que outro jogador (outra conta) entrar na fila, a partida começa sozinha -- sem
                  precisar escolher assento ou adversário.
                </p>
              </div>
              <Button variant="outline" className="rounded-none" disabled={leavingQueue} onClick={cancelQueue}>
                {leavingQueue ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador Beta" }]}>
      <div className="mx-auto max-w-xl">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="space-y-6 p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Simulador</p>
              <h1 className="mt-2 font-heading text-4xl uppercase heading-portal">Simulador Beta</h1>
              <p className="mt-3 text-sm leading-7 text-soft">
                Escolha seu deck e entre na fila. Você é pareado automaticamente com o próximo jogador -- sempre outra conta -- e a partida abre direto pros
                dois, já sincronizada.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Seu deck</p>
              <div className="grid grid-cols-2 gap-2">
                {DECK_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDeckKey(option)}
                    className={`panel-cut border px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] transition-colors ${
                      deckKey === option ? "border-primary bg-primary/20 text-primary" : "border-white/10 bg-black/20 text-soft hover:border-primary/40"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-portal">Qualquer combinação é válida -- inclusive os dois lados com o mesmo deck.</p>
            </div>

            <Button className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={joining} onClick={enterQueue}>
              {joining ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Swords className="mr-2 size-4" />}
              Simulador Beta
            </Button>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}

// -----------------------------------------------------------------------------
// Tabuleiro de uma partida já pareada -- conecta o SSE, mostra timer/presença, joga.
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

function MatchBoard({ matchId, seat, onExit }: { matchId: string; seat: PlayerId; onExit: () => void }) {
  const [matchView, setMatchView] = useState<SimulatorMatchView | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [attackerId, setAttackerId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = buildSimulatorStreamUrl(matchId);
    if (!url) {
      toast.error("Sessão inválida -- faça login de novo.");
      return;
    }
    const source = new EventSource(url);
    eventSourceRef.current = source;
    source.addEventListener("state", (event: MessageEvent) => {
      setConnected(true);
      setMatchView(JSON.parse(event.data) as SimulatorMatchView);
    });
    source.onerror = () => setConnected(false);
    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, [matchId]);

  // Relógio local pro countdown do timer de turno e pro "há quanto tempo o oponente sumiu" --
  // só exibição/UX; a decisão real (agir sozinho no timeout, liberar o W.O.) é sempre do servidor.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Heartbeat de presença -- só dispara enquanto a aba está visível, de propósito: é exatamente o
  // sinal "o jogador está no navegador" que o Willen pediu, e alimenta o W.O. por abandono (matchStore.touchPresence).
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible") api.pingSimulatorMatch(matchId).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, PRESENCE_PING_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [matchId]);

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
        setMatchView(res);
        clearSelection();
      } catch (err) {
        toast.error(errorMessage(err, "Ação inválida."));
      } finally {
        setBusy(false);
      }
    },
    [matchId],
  );

  const claimAbandon = async () => {
    setBusy(true);
    try {
      const res = await api.claimSimulatorAbandonWin(matchId);
      setMatchView(res);
      toast.success("W.O. declarado -- vitória por abandono.");
    } catch (err) {
      toast.error(errorMessage(err, "Ainda não dá pra declarar W.O."));
    } finally {
      setBusy(false);
    }
  };

  if (!matchView) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-portal">
        <Loader2 className="size-4 animate-spin" />
        Conectando ao stream da partida...
      </div>
    );
  }

  const view = matchView.view;
  const opponentSeat = otherPlayer(seat);
  const combat = view.combat;
  const myTurnMain = !combat && view.phase === "main" && view.activePlayer === seat;
  const commandTrigger: "Main" | "Action" | null = combat?.step === "action" && combat.actionPriority === seat ? "Action" : myTurnMain ? "Main" : null;
  const iAmDefending = combat?.step === "block" && combat.defendingPlayer === seat;
  const iHavePriority = combat?.step === "action" && combat.actionPriority === seat;

  const turnSecondsLeft = matchView.turnDeadlineAt !== null ? Math.max(0, Math.ceil((matchView.turnDeadlineAt - now) / 1000)) : null;
  const itsMyDecision = !view.gameOver && (myTurnMain || iAmDefending || iHavePriority);

  const opponentLastSeen = matchView.lastSeenAt[opponentSeat];
  const opponentIdleMs = opponentLastSeen ? Math.max(0, now - opponentLastSeen) : null;
  const opponentIdleSeconds = opponentIdleMs !== null ? Math.floor(opponentIdleMs / 1000) : null;
  const canClaimAbandon = !view.gameOver && opponentIdleMs !== null && opponentIdleMs >= ABANDON_THRESHOLD_MS;

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
    if (!pending) return;
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
    const player = view.players[pid];
    const showAttack = isSelf && myTurnMain && !attackerId;
    const showAttackTarget = !isSelf && attackerId !== null && combat === null;
    const showBlocker = isSelf && iAmDefending;
    const deckLabel = matchView!.deckKeys[pid];

    return (
      <Card className="panel-cut rounded-none surface-panel">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-soft">
              {isSelf ? "Você" : "Oponente"} ({pid}){deckLabel ? ` · ${deckLabel}` : ""}{" "}
              {view.activePlayer === pid ? (
                <Badge variant="outline" className="ml-1 rounded-none border-primary/40 text-primary">
                  Ativo
                </Badge>
              ) : null}
            </p>
            {!isSelf ? (
              <p className={`text-[10px] uppercase tracking-[0.2em] ${canClaimAbandon ? "text-amber-400" : "text-slate-500"}`}>
                {opponentIdleSeconds === null
                  ? "presença desconhecida"
                  : opponentIdleSeconds < 10
                    ? "presente"
                    : `inativo há ${opponentIdleSeconds}s`}
              </p>
            ) : (
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Deck {player.counts.deck} · Recursos {player.counts.resourceDeck} · Shields {player.counts.shields}
              </p>
            )}
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
          Sair da partida
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
          <div className="flex items-center gap-2">
            {view.gameOver ? (
              <Badge variant="outline" className="rounded-none border-primary/40 text-primary">
                Fim de jogo -- vitória de {view.gameOver.winner} ({view.gameOver.reason})
              </Badge>
            ) : turnSecondsLeft !== null ? (
              <Badge
                variant="outline"
                className={`rounded-none ${itsMyDecision && turnSecondsLeft <= 15 ? "border-red-500/60 text-red-400" : "border-primary/40 text-primary"}`}
              >
                <Clock className="mr-1.5 size-3.5" />
                {itsMyDecision ? "Sua decisão" : "Vez do oponente"} · {turnSecondsLeft}s
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {canClaimAbandon ? (
        <Card className="panel-cut rounded-none border-amber-500/40 surface-panel">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm text-soft">
            <AlertTriangle className="size-4 text-amber-400" />
            O oponente está sem responder há {opponentIdleSeconds}s (mais de 3min sem nenhuma ação ou ping).
            <Button size="sm" variant="outline" className="rounded-none border-amber-500/50 text-amber-400 hover:bg-amber-500/10" disabled={busy} onClick={claimAbandon}>
              Declarar vitória por abandono
            </Button>
          </CardContent>
        </Card>
      ) : null}

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

/* Simulador Beta -- Tela de Partida (docs/18, rodada 2 do pedido do Willen,
 * 2026-08-31: "quando o jogo for marcado entre dois players logados, a tela
 * tem que ser uma nova, por causa da UI e HUD [...] com informações reais de
 * identidade visual fica mais fácil testar e validar. Sugiro partirmos pro
 * simulador com visual propício"). Esta tela SUBSTITUI o antigo `MatchBoard`
 * (texto puro) só para partidas reais pareadas pela fila -- o sandbox de
 * depuração continua em SimulatorSandboxPage.tsx (fila, escolha de deck,
 * tela de espera) exatamente como estava; ela só passa a navegar pra cá
 * (`/simulador/partida/:matchId`) assim que os 2 jogadores são pareados, em
 * vez de renderizar o antigo tabuleiro embutido.
 *
 * Escopo desta rodada ("Funcional com arte real", decisão do Willen via
 * AskUserQuestion): reaproveita a MESMA lógica de estado/ações do antigo
 * MatchBoard (idênticas regras de UI documentadas no topo de
 * SimulatorSandboxPage.tsx -- seleção por clique, Pilot pareado pela 1ª Unit
 * marcada, Burst sempre recusado, gatilhos não-Deploy/Paired/Main/Action
 * ainda sem PlayerAction própria) -- só troca a composição visual: arte real
 * das cartas (`Card.imageMediumUrl`/`imageSmallUrl`, buscada por `code` via
 * `GET /api/cards?setCode=`, já pública e não paginada quando chamada sem
 * page/pageSize), layout por zona empilhado (oponente em cima, você embaixo,
 * as duas Battle Areas se encostando no meio -- como um tabuleiro de mesa de
 * verdade) e um HUD dedicado pro turno/fase/timer/W.O. SEM animações ainda
 * (fica pra uma próxima wave, ver docs/18).
 *
 * Rota: só o matchId (`/simulador/partida/:matchId`) -- o assento (`seat`)
 * não precisa vir na URL: é resolvido no servidor a partir do usuário
 * logado (`seatFor()`, server/index.ts) e já chega embutido em
 * `SimulatorMatchView.seat` a cada evento do stream SSE.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
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
/** Espelha `DECK_OPTIONS` de SimulatorSandboxPage.tsx -- os únicos sets jogáveis hoje, usados pra buscar a arte real de cada carta por `code`. Se um novo set entrar no simulador, precisa entrar aqui também. */
const ART_SET_CODES = ["ST01", "ST02"];
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

// -----------------------------------------------------------------------------
// Arte real das cartas -- lookup code -> imagem, buscado uma vez por partida.
// -----------------------------------------------------------------------------

type CardArt = { imageUrl?: string; imageSmallUrl?: string };

/** Formato cru devolvido por `GET /api/cards` (flattenModel, server/index.ts) -- só os campos que interessam aqui. */
type RawApiCard = { code?: string; imageUrl?: string; imageSmallUrl?: string; imageMediumUrl?: string };

function useCardArtLookup(): { art: Record<string, CardArt>; artLoading: boolean } {
  const [art, setArt] = useState<Record<string, CardArt>>({});
  const [artLoading, setArtLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(ART_SET_CODES.map((setCode) => api.listCards({ setCode })))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, CardArt> = {};
        for (const list of results as RawApiCard[][]) {
          for (const raw of list) {
            if (raw?.code) map[raw.code] = { imageUrl: raw.imageMediumUrl ?? raw.imageUrl, imageSmallUrl: raw.imageSmallUrl ?? raw.imageMediumUrl ?? raw.imageUrl };
          }
        }
        setArt(map);
      })
      .catch(() => {
        // Sem arte não impede a partida -- os cards caem no fallback "sem arte" abaixo.
      })
      .finally(() => !cancelled && setArtLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { art, artLoading };
}

// -----------------------------------------------------------------------------
// Tela de partida -- conecta o SSE, mostra timer/presença/HUD, joga.
// -----------------------------------------------------------------------------

type PendingAction = { kind: "deploy" | "command"; cardInstanceId: string; trigger?: "Main" | "Action" };

export default function SimulatorMatchPage({ matchId }: { matchId: string }) {
  const [, setLocation] = useLocation();
  const [matchView, setMatchView] = useState<SimulatorMatchView | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [attackerId, setAttackerId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const { art, artLoading } = useCardArtLookup();

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

  const exitToLobby = () => setLocation("/simulador");

  if (!matchView || artLoading) {
    return (
      <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador Beta", href: "/simulador" }, { label: "Partida" }]}>
        <div className="flex items-center gap-2 text-sm text-muted-portal">
          <Loader2 className="size-4 animate-spin" />
          {!matchView ? "Conectando ao stream da partida..." : "Carregando arte das cartas..."}
        </div>
      </PortalShell>
    );
  }

  const view = matchView.view;
  const seat = matchView.seat;
  const opponentSeat = otherPlayer(seat);
  const combat = view.combat;
  const endPhaseAction = view.endPhaseAction;
  const myTurnMain = !combat && view.phase === "main" && view.activePlayer === seat;
  const iAmDefending = combat?.step === "block" && combat.defendingPlayer === seat;
  const iHavePriority = combat?.step === "action" && combat.actionPriority === seat;
  // Action Step da End Phase (Comprehensive Rules 7-6) -- mesma mecânica do Action
  // Step de combate, só que ao encerrar o turno em vez de durante uma batalha.
  const iHaveEndPhasePriority = endPhaseAction !== null && endPhaseAction.priority === seat;
  const commandTrigger: "Main" | "Action" | null = iHavePriority || iHaveEndPhasePriority ? "Action" : myTurnMain ? "Main" : null;

  const turnSecondsLeft = matchView.turnDeadlineAt !== null ? Math.max(0, Math.ceil((matchView.turnDeadlineAt - now) / 1000)) : null;
  const itsMyDecision = !view.gameOver && (myTurnMain || iAmDefending || iHavePriority || iHaveEndPhasePriority);

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

  // ---------------------------------------------------------------------------
  // Uma carta desenhada com arte real (ou fallback "sem arte") -- substitui o
  // antigo cartão de texto puro. `size` controla a largura da miniatura;
  // "hand" é maior porque é a zona que o jogador mais precisa ler de perto.
  // ---------------------------------------------------------------------------
  function renderCard(
    card: ViewCardInstance,
    opts: { selectableAsTarget?: boolean; showAttack?: boolean; showAttackTarget?: boolean; showBlocker?: boolean; showPlay?: boolean; onPlay?: () => void; canPlay?: boolean; size?: "sm" | "md" | "lg" },
  ) {
    const key = card.instanceId;
    const selectable = Boolean(pending) && opts.selectableAsTarget;
    const isSelected = selected.includes(key);
    const size = opts.size ?? "md";
    const widthClass = size === "lg" ? "w-24" : size === "sm" ? "w-14" : "w-20";

    if (isHidden(card)) {
      return (
        <button
          key={key}
          type="button"
          disabled={!selectable}
          onClick={() => toggleSelect(key)}
          className={`group relative ${widthClass} shrink-0 overflow-hidden panel-cut border transition-colors ${
            isSelected ? "border-primary ring-2 ring-primary/60" : "border-white/10"
          } ${selectable ? "cursor-pointer hover:border-primary/50" : "cursor-default"}`}
        >
          <div className="flex aspect-[63/88] w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black">
            <Shield className="size-1/3 text-primary/25" />
          </div>
        </button>
      );
    }

    const c = card as CardInstance;
    const isAttacker = attackerId === c.instanceId;
    const cardArt = art[c.def.code];
    const imgSrc = size === "sm" ? (cardArt?.imageSmallUrl ?? cardArt?.imageUrl) : (cardArt?.imageUrl ?? cardArt?.imageSmallUrl);

    return (
      <div
        key={key}
        className={`relative ${widthClass} shrink-0 overflow-hidden panel-cut border transition-colors ${
          isSelected || isAttacker ? "border-primary ring-2 ring-primary/60" : "border-white/10"
        } ${c.rested ? "opacity-55" : ""}`}
      >
        <button type="button" disabled={!selectable} onClick={() => toggleSelect(c.instanceId)} className={`block w-full ${selectable ? "cursor-pointer" : "cursor-default"}`}>
          <div className="aspect-[63/88] w-full bg-black/40">
            {imgSrc ? (
              <img src={imgSrc} alt={c.def.nameEn} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 bg-slate-950/70 px-1 text-center">
                <p className="text-[9px] font-semibold uppercase leading-tight text-slate-300">{c.def.nameEn}</p>
                <p className="text-[7px] uppercase tracking-wide text-slate-600">sem arte</p>
              </div>
            )}
          </div>
          {c.def.cardType === "UNIT" ? (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-1 py-0.5 text-[9px] font-semibold text-white">
              <span>AP{effectiveAp(c)}</span>
              <span>HP{Math.max(0, effectiveHp(c) - c.damage)}</span>
            </div>
          ) : null}
          {c.pairedPilotId ? <span className="absolute right-0.5 top-0.5 rounded-none bg-primary/80 px-1 text-[8px] font-bold text-black">P</span> : null}
          {c.rested ? <span className="absolute left-0.5 top-0.5 rounded-none bg-black/70 px-1 text-[8px] uppercase text-slate-300">rest</span> : null}
        </button>
        <p className="truncate bg-black/50 px-1 py-0.5 text-[8px] text-muted-portal">{c.def.code}</p>
        <div className="flex flex-wrap gap-0.5 p-0.5">
          {opts.showAttack && !c.rested && c.def.cardType === "UNIT" ? (
            <Button size="sm" variant="outline" className="h-5 rounded-none px-1 text-[8px]" disabled={busy} onClick={() => setAttackerId(c.instanceId)}>
              Atacar
            </Button>
          ) : null}
          {opts.showAttackTarget && c.rested && c.def.cardType === "UNIT" ? (
            <Button size="sm" variant="outline" className="h-5 rounded-none px-1 text-[8px]" disabled={busy} onClick={() => declareAttack({ unitId: c.instanceId })}>
              Alvo
            </Button>
          ) : null}
          {opts.showBlocker && !c.rested && hasKeyword(c, "Blocker") ? (
            <Button size="sm" variant="outline" className="h-5 rounded-none px-1 text-[8px]" disabled={busy} onClick={() => runAction({ kind: "activateBlocker", blockerId: c.instanceId })}>
              Blocker
            </Button>
          ) : null}
          {opts.showPlay ? (
            <Button size="sm" variant="outline" className="h-5 w-full rounded-none px-1 text-[8px]" disabled={!opts.canPlay || busy} onClick={opts.onPlay}>
              Jogar
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  function renderZone(label: string, cards: ViewCardInstance[], opts: Parameters<typeof renderCard>[1], emptyLabel = "Vazia.") {
    return (
      <div className="space-y-1">
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
        {!cards.length ? <p className="text-[10px] text-muted-portal">{emptyLabel}</p> : <div className="flex flex-wrap gap-1.5">{cards.map((card) => renderCard(card, opts))}</div>}
      </div>
    );
  }

  function renderPlayerPanel(pid: PlayerId, isSelf: boolean) {
    const player = view.players[pid];
    const showAttack = isSelf && myTurnMain && !attackerId;
    const showAttackTarget = !isSelf && attackerId !== null && combat === null;
    const showBlocker = isSelf && iAmDefending;
    const deckLabel = matchView!.deckKeys[pid];

    return (
      <Card className={`panel-cut rounded-none ${isSelf ? "hero-surface border-primary/30" : "surface-panel border-white/10"}`}>
        <CardContent className="space-y-2.5 p-3">
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
                {opponentIdleSeconds === null ? "presença desconhecida" : opponentIdleSeconds < 10 ? "presente" : `inativo há ${opponentIdleSeconds}s`}
              </p>
            ) : (
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Deck {player.counts.deck} · Recursos {player.counts.resourceDeck}
              </p>
            )}
          </div>

          {renderZone("Battle Area", player.battleArea, { selectableAsTarget: true, showAttack, showAttackTarget, showBlocker }, "Vazia.")}
          <div className="grid grid-cols-2 gap-3">
            {renderZone("Base", player.baseSection, { selectableAsTarget: true }, "Nenhuma.")}
            <div className="space-y-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Shields ({player.counts.shields})</p>
              {!player.shields.length ? (
                <p className="text-[10px] text-muted-portal">Nenhum.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">{player.shields.map((card) => renderCard(card, { selectableAsTarget: true, size: "sm" }))}</div>
              )}
            </div>
          </div>

          {renderZone(
            "Resource Area",
            player.resourceArea,
            { size: "sm" },
            "Vazia.",
          )}

          <div className="space-y-1 border-t border-primary/10 pt-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Mão ({player.hand.length}){!isSelf ? " · cartas viradas" : ""}
            </p>
            {!player.hand.length ? (
              <p className="text-[10px] text-muted-portal">Vazia.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(player.hand as ViewCardInstance[]).map((card) => {
                  if (!isSelf || isHidden(card)) return renderCard(card, { size: "lg" });
                  const c = card as CardInstance;
                  const isCommand = c.def.cardType === "COMMAND";
                  const canPlay = isCommand ? Boolean(commandTrigger) && (c.def.triggerKeywords?.includes(commandTrigger!) ?? false) : myTurnMain;
                  return renderCard(c, { size: "lg", showPlay: true, canPlay, onPlay: () => (isCommand ? startCommand(c) : startDeploy(c)) });
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const attacker = attackerId ? findPublicCard(view, attackerId) : null;

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador Beta", href: "/simulador" }, { label: "Partida" }]}>
      <div className="space-y-3">
        {/* HUD */}
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
            <Button variant="outline" className="rounded-none" onClick={exitToLobby}>
              <LogOut className="mr-2 size-4" />
              Sair
            </Button>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-portal">Turno {view.turnNumber}</p>
              <p className="mt-0.5 text-base heading-portal">
                {PHASE_LABEL[view.phase]} Phase · Vez de {view.activePlayer}
                {combat ? ` · Combate (${combat.step})` : ""}
                {endPhaseAction ? ` · Action Step (prioridade: ${endPhaseAction.priority})` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {view.gameOver ? (
                <Badge variant="outline" className="rounded-none border-primary/40 text-primary">
                  Fim de jogo -- vitória de {view.gameOver.winner} ({view.gameOver.reason})
                </Badge>
              ) : turnSecondsLeft !== null ? (
                <Badge variant="outline" className={`rounded-none ${itsMyDecision && turnSecondsLeft <= 15 ? "border-red-500/60 text-red-400" : "border-primary/40 text-primary"}`}>
                  <Clock className="mr-1.5 size-3.5" />
                  {itsMyDecision ? "Sua decisão" : "Vez do oponente"} · {turnSecondsLeft}s
                </Badge>
              ) : null}
              <p className="flex items-center gap-1.5 text-[10px] text-muted-portal">
                <RefreshCw className={`size-3 ${connected ? "text-primary" : "animate-pulse text-slate-500"}`} />
                {connected ? "sincronizado" : "conectando"} · assento {seat}
              </p>
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
              <span className="text-xs text-muted-portal">ou clique em "Alvo" numa Unit rested do oponente abaixo.</span>
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

        {iHaveEndPhasePriority ? (
          <Card className="panel-cut rounded-none border-primary/30 surface-panel">
            <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm text-soft">
              Action Step do fim de turno -- sua prioridade. Jogue uma Command 【Action】 da mão ou:
              <Button size="sm" variant="outline" className="rounded-none" disabled={busy} onClick={() => runAction({ kind: "passEndPhaseAction" })}>
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

        {/* Tabuleiro -- oponente em cima, você embaixo, as Battle Areas se encostando no meio. */}
        <div className="space-y-1.5">
          {renderPlayerPanel(opponentSeat, false)}
          <div className="mx-auto h-px w-full max-w-3xl bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          {renderPlayerPanel(seat, true)}
        </div>
      </div>
    </PortalShell>
  );
}

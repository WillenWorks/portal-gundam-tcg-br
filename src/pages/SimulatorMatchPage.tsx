/* Simulador Beta -- Tela de Partida (docs/18).
 *
 * Rodada 2 (2026-08-31): esta tela SUBSTITUI o antigo `MatchBoard` (texto
 * puro) só para partidas reais pareadas pela fila -- o sandbox de depuração
 * continua em SimulatorSandboxPage.tsx (fila, escolha de deck, tela de
 * espera); ela só passa a navegar pra cá (`/simulador/partida/:matchId`)
 * assim que os 2 jogadores são pareados.
 *
 * Rodada 5 (2026-08-31, "Fase 1" do plano de redesenho em docs/18 -- pedido
 * do Willen após reportar o botão "Jogar" minúsculo/difícil de acertar em
 * teste real): reescrita da camada visual, mesma lógica de estado/ações de
 * antes (seleção por clique, Pilot pareado pela 1ª Unit marcada, Burst
 * sempre recusado, gatilhos não-Deploy/Paired/Main/Action ainda sem
 * PlayerAction própria). O que mudou:
 *  - Tela cheia, sem `PortalShell` (o HUD usa o viewport inteiro; a rota já
 *    é protegida por `RequireAuth` no App.tsx, então tirar o Shell não abre
 *    brecha de autenticação).
 *  - Playmat com posições oficiais por jogador: Base + Shields + Resource
 *    Deck na coluna esquerda, Battle Area (6 slots) no centro, Exílio +
 *    Trash + Deck na coluna direita, Resource Area numa faixa abaixo da
 *    Battle Area, mão na faixa mais externa (embaixo pra você, em cima —
 *    espelhado — pro oponente, que aparece menor e com a mão virada).
 *  - Cartas da mão não têm mais um botão "Jogar" minúsculo: a carta
 *    jogável fica em cores normais, a não-jogável fica com máscara
 *    (grayscale + ícone de bloqueio); clicar em qualquer uma abre um
 *    preview compacto com "Fechar"/"Jogar" (ou o motivo de não poder).
 *  - Toast/flash de fase ao trocar de turno (sequência simulada
 *    Manutenção → Compra → Recurso → Main, já que o servidor roda essas 3
 *    fases automáticas numa só transição -- não existe, hoje, um estado de
 *    rede intermediário real pra "Draw Phase" isolada; ver docs/18 pra um
 *    possível Fase 2/3 de fases realmente sequenciais).
 *  - Auto-rotação em celular na vertical (CSS transform, sem depender de
 *    Screen Orientation API que exige fullscreen em vários browsers).
 *  - Zona `exile` nova do motor (cartas removidas do jogo, ex. EX Resource
 *    usado) aparece de verdade no tabuleiro em vez de só sumir.
 *
 * Fora do escopo desta rodada (Fase 2/3 do plano, ver docs/18): modos de
 * automação (manual/semi/total, estilo Master Duel), arte genérica de
 * recursos/bases compartilhada por set, seleção explícita de modalidade em
 * cartas modais/piloto-ou-comando além do fluxo já existente.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { AlertTriangle, Ban, Clock, LogOut, RefreshCw, Shield, Swords } from "lucide-react";

import { api, buildSimulatorStreamUrl, type SimulatorMatchView } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { effectiveAp, effectiveHp, hasKeyword, otherPlayer, type AttackTarget, type CardInstance, type PlayerId } from "@/modules/simulator/engine/types";
import type { PlayerAction } from "@/modules/simulator/engine/actions";
import type { HiddenCard, ViewCardInstance, ViewGameState, ViewPlayerState } from "@/modules/simulator/engine/viewState";

const PHASE_LABEL: Record<string, string> = { start: "Manutenção", draw: "Compra", resource: "Recurso", main: "Main", end: "Final" };
/** Sequência simulada mostrada ao começar um turno novo -- ver comentário no topo do arquivo. */
const PHASE_FLASH_SEQUENCE = ["Fase de Manutenção", "Fase de Compra", "Fase de Recurso", "Main Phase"];
const PHASE_FLASH_STEP_MS = 550;
/** Espelha `DECK_OPTIONS` de SimulatorSandboxPage.tsx -- os únicos sets jogáveis hoje, usados pra buscar a arte real de cada carta por `code`. Se um novo set entrar no simulador, precisa entrar aqui também. */
const ART_SET_CODES = ["ST01", "ST02"];
/** Espelha `ABANDON_THRESHOLD_MS` do servidor (matchStore.ts) -- só usado aqui pra habilitar o botão na hora certa; quem decide de verdade é sempre o servidor. */
const ABANDON_THRESHOLD_MS = 180_000;
/** Intervalo do heartbeat de presença do cliente -- bem menor que os 3min do W.O., só pra manter `lastSeenAt` fresco. */
const PRESENCE_PING_MS = 15_000;
/** Abaixo disso (e retrato), a tela gira 90° via CSS -- ver `useIsPortraitMobile`. */
const MOBILE_ROTATE_QUERY = "(max-width: 900px) and (orientation: portrait)";

function isHidden(card: ViewCardInstance): card is HiddenCard {
  return "hidden" in card && (card as HiddenCard).hidden === true;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function findPublicCard(view: ViewGameState, instanceId: string): CardInstance | null {
  for (const pid of ["A", "B"] as PlayerId[]) {
    const player = view.players[pid];
    for (const zone of ["battleArea", "baseSection", "resourceArea", "trash", "exile"] as const) {
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

/** Detecta celular em retrato pra girar a tela via CSS (ver `MOBILE_ROTATE_QUERY`). */
function useIsPortraitMobile(): boolean {
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(MOBILE_ROTATE_QUERY);
    const update = () => setIsPortraitMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isPortraitMobile;
}

// -----------------------------------------------------------------------------
// Tela de partida -- conecta o SSE, mostra timer/presença/HUD, joga.
// -----------------------------------------------------------------------------

type PendingAction = { kind: "deploy" | "command"; cardInstanceId: string; trigger?: "Main" | "Action" };
/** Preview compacto aberto ao clicar numa carta da mão -- substitui o antigo botão "Jogar" minúsculo. */
type HandPreview = { card: CardInstance; canPlay: boolean; blockedReason?: string; onPlay: () => void };

export default function SimulatorMatchPage({ matchId }: { matchId: string }) {
  const [, setLocation] = useLocation();
  const [matchView, setMatchView] = useState<SimulatorMatchView | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [preview, setPreview] = useState<HandPreview | null>(null);
  const [phaseFlash, setPhaseFlash] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const lastTurnRef = useRef<number | null>(null);
  const flashTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { art, artLoading } = useCardArtLookup();
  const isPortraitMobile = useIsPortraitMobile();

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

  // Flash de fase ao começar um turno novo -- ver comentário no topo do arquivo sobre por que é
  // uma sequência simulada (Start/Draw/Resource rodam no servidor numa transição só).
  const turnNumberForFlash = matchView?.view.turnNumber ?? null;
  useEffect(() => {
    if (turnNumberForFlash === null) return;
    if (lastTurnRef.current !== null && lastTurnRef.current !== turnNumberForFlash) {
      for (const t of flashTimersRef.current) clearTimeout(t);
      flashTimersRef.current = PHASE_FLASH_SEQUENCE.map((label, i) => setTimeout(() => setPhaseFlash(label), i * PHASE_FLASH_STEP_MS));
      flashTimersRef.current.push(setTimeout(() => setPhaseFlash(null), PHASE_FLASH_SEQUENCE.length * PHASE_FLASH_STEP_MS + 900));
    }
    lastTurnRef.current = turnNumberForFlash;
  }, [turnNumberForFlash]);
  useEffect(() => () => { for (const t of flashTimersRef.current) clearTimeout(t); }, []);

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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-muted-portal">
        {!matchView ? "Conectando ao stream da partida..." : "Carregando arte das cartas..."}
      </div>
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
  const inActionStep = iHavePriority || iHaveEndPhasePriority;
  const commandTrigger: "Main" | "Action" | null = inActionStep ? "Action" : myTurnMain ? "Main" : null;
  // Motivo (curto, mostrado no preview da carta) de por que uma Unit/Pilot/Base não pode ser jogada
  // agora -- só entra em jogo quando `myTurnMain` é falso (rodada 5: antes o botão só ficava cinza
  // sem explicar nada, e foi exatamente essa falta de explicação que gerou o relato de "botão
  // bloqueado" quando na verdade era Action Step de fim de turno, ver docs/18).
  const notMainPhaseReason: string | undefined = combat
    ? "Combate em andamento -- só dá pra jogar Command 【Action】 agora."
    : endPhaseAction
      ? "Action Step de fim de turno -- só dá pra jogar Command 【Action】 agora."
      : view.activePlayer !== seat
        ? "Não é sua vez."
        : view.phase !== "main"
          ? "Fora da sua Main Phase."
          : undefined;

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

  const playFromPreview = (card: CardInstance, isCommand: boolean) => {
    setPreview(null);
    if (isCommand) startCommand(card);
    else startDeploy(card);
  };

  // ---------------------------------------------------------------------------
  // Uma carta de zona de tabuleiro (Battle Area/Base/Shields/Resource/Trash/Exílio)
  // desenhada com arte real. A mão usa `renderHandCard` (máscara + preview), não esta.
  // ---------------------------------------------------------------------------
  function renderCard(
    card: ViewCardInstance,
    opts: { selectableAsTarget?: boolean; showAttack?: boolean; showAttackTarget?: boolean; showBlocker?: boolean; size?: "xs" | "sm" | "md" },
  ) {
    const key = card.instanceId;
    const selectable = Boolean(pending) && opts.selectableAsTarget;
    const isSelected = selected.includes(key);
    const size = opts.size ?? "md";
    const widthClass = size === "xs" ? "w-10" : size === "sm" ? "w-14" : "w-20";

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
    const imgSrc = size === "md" ? (cardArt?.imageUrl ?? cardArt?.imageSmallUrl) : (cardArt?.imageSmallUrl ?? cardArt?.imageUrl);

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
                <p className="text-[8px] font-semibold uppercase leading-tight text-slate-300">{c.def.nameEn}</p>
              </div>
            )}
          </div>
          {c.def.cardType === "UNIT" ? (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-1 py-0.5 text-[8px] font-semibold text-white">
              <span>AP{effectiveAp(c)}</span>
              <span>HP{Math.max(0, effectiveHp(c) - c.damage)}</span>
            </div>
          ) : null}
          {c.pairedPilotId ? <span className="absolute right-0.5 top-0.5 rounded-none bg-primary/80 px-1 text-[7px] font-bold text-black">P</span> : null}
          {c.rested ? <span className="absolute left-0.5 top-0.5 rounded-none bg-black/70 px-1 text-[7px] uppercase text-slate-300">rest</span> : null}
        </button>
        {(opts.showAttack || opts.showAttackTarget || opts.showBlocker) ? (
          <div className="flex flex-wrap gap-0.5 p-0.5">
            {opts.showAttack && !c.rested && c.def.cardType === "UNIT" ? (
              <Button size="sm" variant="outline" className="h-5 w-full rounded-none px-1 text-[8px]" disabled={busy} onClick={() => setAttackerId(c.instanceId)}>
                Atacar
              </Button>
            ) : null}
            {opts.showAttackTarget && c.rested && c.def.cardType === "UNIT" ? (
              <Button size="sm" variant="outline" className="h-5 w-full rounded-none px-1 text-[8px]" disabled={busy} onClick={() => declareAttack({ unitId: c.instanceId })}>
                Alvo
              </Button>
            ) : null}
            {opts.showBlocker && !c.rested && hasKeyword(c, "Blocker") ? (
              <Button size="sm" variant="outline" className="h-5 w-full rounded-none px-1 text-[8px]" disabled={busy} onClick={() => runAction({ kind: "activateBlocker", blockerId: c.instanceId })}>
                Blocker
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  /** Uma carta da MÃO própria -- máscara quando não-jogável, sem botão embutido; clique abre o preview compacto (`HandPreview`). */
  function renderHandCard(c: CardInstance) {
    const isCommand = c.def.cardType === "COMMAND";
    const canPlay = isCommand ? Boolean(commandTrigger) && (c.def.triggerKeywords?.includes(commandTrigger!) ?? false) : myTurnMain;
    const blockedReason = canPlay ? undefined : isCommand ? "Esta Command não tem gatilho disponível agora." : notMainPhaseReason;
    const cardArt = art[c.def.code];
    const imgSrc = cardArt?.imageUrl ?? cardArt?.imageSmallUrl;

    return (
      <button
        key={c.instanceId}
        type="button"
        onClick={() => setPreview({ card: c, canPlay, blockedReason, onPlay: () => playFromPreview(c, isCommand) })}
        className={`relative w-[4.5rem] shrink-0 overflow-hidden panel-cut border transition-all sm:w-24 ${
          canPlay ? "border-primary/50 hover:border-primary hover:-translate-y-1" : "border-white/10"
        }`}
      >
        <div className={`aspect-[63/88] w-full bg-black/40 ${canPlay ? "" : "grayscale"}`}>
          {imgSrc ? (
            <img src={imgSrc} alt={c.def.nameEn} className={`h-full w-full object-cover ${canPlay ? "" : "opacity-45"}`} loading="lazy" />
          ) : (
            <div className={`flex h-full flex-col items-center justify-center gap-1 bg-slate-950/70 px-1 text-center ${canPlay ? "" : "opacity-45"}`}>
              <p className="text-[9px] font-semibold uppercase leading-tight text-slate-300">{c.def.nameEn}</p>
            </div>
          )}
        </div>
        {c.def.cardType === "UNIT" ? (
          <div className="absolute inset-x-0 bottom-5 flex items-center justify-between bg-black/70 px-1 py-0.5 text-[9px] font-semibold text-white">
            <span>AP{c.def.ap ?? 0}</span>
            <span>HP{c.def.hp ?? 0}</span>
          </div>
        ) : null}
        {!canPlay ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Ban className="size-5 text-slate-300/80" />
          </div>
        ) : null}
        <p className="truncate bg-black/60 px-1 py-0.5 text-[8px] text-muted-portal">{c.def.code}</p>
      </button>
    );
  }

  /** Coluna esquerda/direita compacta: Base ou Exílio/Trash -- rótulo + contagem + até 3 miniaturas. */
  function renderMiniZone(label: string, cards: ViewCardInstance[], opts: Parameters<typeof renderCard>[1]) {
    return (
      <div>
        <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label} ({cards.length})
        </p>
        {!cards.length ? (
          <div className="aspect-[63/88] w-10 border border-dashed border-white/10" />
        ) : (
          <div className="flex flex-wrap gap-1">{cards.slice(0, 3).map((card) => renderCard(card, { ...opts, size: "xs" }))}</div>
        )}
      </div>
    );
  }

  /** Deck/Resource Deck -- só a contagem, carta virada pra baixo (nunca mostramos identidade). */
  function renderDeckTile(label: string, count: number) {
    return (
      <div>
        <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <div className="flex aspect-[63/88] w-10 items-center justify-center border border-white/15 bg-gradient-to-br from-slate-900 to-black text-xs font-bold text-slate-300">
          {count}
        </div>
      </div>
    );
  }

  function renderShieldsCompact(shields: ViewCardInstance[]) {
    return (
      <div>
        <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">Shields ({shields.length})</p>
        <div className="grid grid-cols-3 gap-0.5">
          {shields.slice(0, 6).map((card) => renderCard(card, { selectableAsTarget: true, size: "xs" }))}
        </div>
      </div>
    );
  }

  /** Faixa de zonas em posição oficial: esquerda (Base/Shields/Resource Deck) — Battle Area — direita (Exílio/Trash/Deck). */
  function renderZoneRow(player: ViewPlayerState, opts: { showAttack: boolean; showAttackTarget: boolean; showBlocker: boolean }) {
    return (
      <div className="grid grid-cols-[minmax(2.75rem,3.5rem)_1fr_minmax(2.75rem,3.5rem)] gap-1.5 sm:gap-2">
        <div className="space-y-1.5">
          {renderMiniZone("Base", player.baseSection, { selectableAsTarget: true })}
          {renderShieldsCompact(player.shields)}
          {renderDeckTile("Recurso", player.counts.resourceDeck)}
        </div>
        <div className="space-y-0.5">
          <p className="text-center text-[8px] uppercase tracking-[0.2em] text-slate-500">Battle Area</p>
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: 6 }).map((_, i) =>
              player.battleArea[i] ? (
                renderCard(player.battleArea[i], { selectableAsTarget: true, size: "sm", ...opts })
              ) : (
                <div key={i} className="aspect-[63/88] w-full border border-dashed border-white/10" />
              ),
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          {renderMiniZone("Exílio", player.exile, {})}
          {renderMiniZone("Trash", player.trash, {})}
          {renderDeckTile("Deck", player.counts.deck)}
        </div>
      </div>
    );
  }

  function renderResourceRow(player: ViewPlayerState) {
    return (
      <div className="space-y-0.5">
        <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Recursos em campo ({player.counts.resourceArea}) · Nível {player.counts.resourceArea}
        </p>
        {!player.resourceArea.length ? (
          <p className="text-[10px] text-muted-portal">Nenhum.</p>
        ) : (
          <div className="flex flex-wrap gap-1">{player.resourceArea.map((card) => renderCard(card, { size: "xs" }))}</div>
        )}
      </div>
    );
  }

  function renderOpponentHandBacks(count: number) {
    return (
      <div className="flex items-center gap-2">
        <p className="shrink-0 text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">Mão ({count})</p>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: Math.min(count, 10) }).map((_, i) => (
            <div key={i} className="aspect-[63/88] w-8 border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black" />
          ))}
        </div>
      </div>
    );
  }

  function renderMyHand(player: ViewPlayerState) {
    return (
      <div className="space-y-1">
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Sua mão ({player.hand.length})</p>
        {!player.hand.length ? (
          <p className="text-[10px] text-muted-portal">Vazia.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(player.hand as ViewCardInstance[]).map((card) => (isHidden(card) ? null : renderHandCard(card as CardInstance)))}
          </div>
        )}
      </div>
    );
  }

  /** Um lado inteiro do tabuleiro. `mirrored` (oponente) inverte a ordem: mão(virada)/recursos/zonas de cima pra baixo, com a Battle Area sempre encostando na divisória do meio. */
  function renderPlaymat(pid: PlayerId, isSelf: boolean, mirrored: boolean) {
    const player = view.players[pid];
    const zoneRow = renderZoneRow(player, {
      showAttack: isSelf && myTurnMain && !attackerId,
      showAttackTarget: !isSelf && attackerId !== null && combat === null,
      showBlocker: isSelf && iAmDefending,
    });
    const resourceRow = renderResourceRow(player);
    const handRow = isSelf ? renderMyHand(player) : renderOpponentHandBacks(player.hand.length);

    return (
      <div className={`panel-cut border p-2 sm:p-3 ${isSelf ? "hero-surface border-primary/30" : "surface-panel border-white/10"}`}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-soft sm:text-sm">
            {isSelf ? "Você" : "Oponente"} ({pid}){matchView!.deckKeys[pid] ? ` · ${matchView!.deckKeys[pid]}` : ""}{" "}
            {view.activePlayer === pid ? (
              <Badge variant="outline" className="ml-1 rounded-none border-primary/40 text-primary">
                Ativo
              </Badge>
            ) : null}
          </p>
          {!isSelf ? (
            <p className={`text-[9px] uppercase tracking-[0.18em] ${canClaimAbandon ? "text-amber-400" : "text-slate-500"}`}>
              {opponentIdleSeconds === null ? "presença desconhecida" : opponentIdleSeconds < 10 ? "presente" : `inativo há ${opponentIdleSeconds}s`}
            </p>
          ) : (
            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Deck {player.counts.deck}</p>
          )}
        </div>
        {mirrored ? (
          <div className="space-y-1.5">
            {handRow}
            {resourceRow}
            {zoneRow}
          </div>
        ) : (
          <div className="space-y-1.5">
            {zoneRow}
            {resourceRow}
            {handRow}
          </div>
        )}
      </div>
    );
  }

  const attacker = attackerId ? findPublicCard(view, attackerId) : null;

  const content = (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 text-soft">
      {/* HUD -- sem PortalShell nesta tela (rodada 5): usa o viewport inteiro. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-primary/20 hero-surface px-3 py-2">
        <Button variant="outline" size="sm" className="rounded-none" onClick={exitToLobby}>
          <LogOut className="mr-1.5 size-3.5" />
          Sair
        </Button>
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-[0.24em] text-muted-portal">Turno {view.turnNumber}</p>
          <p className="mt-0.5 text-sm heading-portal sm:text-base">
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
          <p className="hidden items-center gap-1.5 text-[10px] text-muted-portal sm:flex">
            <RefreshCw className={`size-3 ${connected ? "text-primary" : "animate-pulse text-slate-500"}`} />
            {connected ? "sincronizado" : "conectando"} · assento {seat}
          </p>
        </div>
      </div>

      {/* Flash de fase -- ver comentário no topo do arquivo. */}
      {phaseFlash ? (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-40 flex justify-center">
          <p className="animate-in fade-in slide-in-from-top-2 panel-cut border border-primary/40 bg-slate-950/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {phaseFlash}
          </p>
        </div>
      ) : null}

      {/* Avisos de decisão -- Action Step (combate ou fim de turno) é a causa nº1 de confusão
          reportada em teste real ("botão bloqueado" quando na verdade Units não podem ser jogadas
          fora da Main Phase, rodada 4): por isso o destaque forte (âmbar, pulsante) em vez de um
          card discreto igual aos outros avisos. */}
      <div className="shrink-0 space-y-1.5 overflow-y-auto px-2 py-1.5 sm:px-3">
        {canClaimAbandon ? (
          <div className="panel-cut flex flex-wrap items-center gap-2 border border-amber-500/40 surface-panel px-3 py-2 text-xs text-soft">
            <AlertTriangle className="size-4 text-amber-400" />
            Oponente sem responder há {opponentIdleSeconds}s.
            <Button size="sm" variant="outline" className="rounded-none border-amber-500/50 text-amber-400 hover:bg-amber-500/10" disabled={busy} onClick={claimAbandon}>
              Declarar vitória por abandono
            </Button>
          </div>
        ) : null}

        {inActionStep ? (
          <div className="panel-cut animate-pulse border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
            {iHavePriority ? "Action Step de combate" : "Action Step de fim de turno"} -- sua prioridade. Não dá pra jogar
            Units/Pilots/Bases agora, só Command 【Action】.{" "}
            <Button
              size="sm"
              variant="outline"
              className="ml-2 rounded-none border-amber-500/60 text-amber-300 hover:bg-amber-500/20"
              disabled={busy}
              onClick={() => runAction(iHavePriority ? { kind: "passAction" } : { kind: "passEndPhaseAction" })}
            >
              Passar
            </Button>
          </div>
        ) : null}

        {attackerId ? (
          <div className="panel-cut flex flex-wrap items-center gap-2 border border-primary/30 surface-panel px-3 py-2 text-xs text-soft">
            <Swords className="size-4 text-primary" />
            Atacando com {attacker?.def.nameEn ?? attackerId}.
            <Button size="sm" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={() => declareAttack("player")}>
              Atacar o jogador
            </Button>
            <span className="text-[10px] text-muted-portal">ou clique em "Alvo" numa Unit rested do oponente.</span>
            <Button size="sm" variant="outline" className="rounded-none" onClick={() => setAttackerId(null)}>
              Cancelar
            </Button>
          </div>
        ) : null}

        {pending ? (
          <div className="panel-cut flex flex-wrap items-center gap-2 border border-primary/30 surface-panel px-3 py-2 text-xs text-soft">
            <Shield className="size-4 text-primary" />
            {pending.kind === "deploy" ? "Jogando carta." : `Jogando Command (${pending.trigger}).`} Se pedir alvo (ou pareamento de Pilot), clique nas cartas
            do tabuleiro -- {selected.length} selecionada(s).
            <Button size="sm" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={confirmPending}>
              Confirmar
            </Button>
            <Button size="sm" variant="outline" className="rounded-none" onClick={clearSelection}>
              Cancelar
            </Button>
          </div>
        ) : null}

        {iAmDefending ? (
          <div className="panel-cut flex flex-wrap items-center gap-2 border border-primary/30 surface-panel px-3 py-2 text-xs text-soft">
            Defendendo. Ative um <strong>&lt;Blocker&gt;</strong> (botão na Unit) ou:
            <Button size="sm" variant="outline" className="rounded-none" disabled={busy} onClick={() => runAction({ kind: "skipBlock" })}>
              Não bloquear
            </Button>
          </div>
        ) : null}

        {myTurnMain ? (
          <div className="panel-cut flex flex-wrap items-center gap-2 border border-primary/30 surface-panel px-3 py-2 text-xs text-soft">
            Sua Main Phase.
            <Button size="sm" variant="outline" className="rounded-none" disabled={busy} onClick={() => runAction({ kind: "finishTurn" })}>
              Encerrar turno
            </Button>
          </div>
        ) : null}
      </div>

      {/* Tabuleiro -- oponente em cima (menor, mão virada), você embaixo, as Battle Areas se encostando no meio. */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 pb-3 sm:px-3">
        <div className="scale-[0.92] opacity-90">{renderPlaymat(opponentSeat, false, true)}</div>
        <div className="mx-auto h-px w-full max-w-3xl bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        {renderPlaymat(seat, true, false)}
      </div>

      {/* Preview compacto de uma carta da mão -- "Ver" (é o próprio preview) + "Jogar"/motivo. */}
      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="panel-cut hero-surface w-full max-w-[15rem] border border-primary/30 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 w-32 overflow-hidden panel-cut border border-white/10">
              <div className="aspect-[63/88] w-full bg-black/40">
                {art[preview.card.def.code]?.imageUrl ? (
                  <img src={art[preview.card.def.code]!.imageUrl} alt={preview.card.def.nameEn} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center px-2 text-center text-[10px] uppercase text-slate-400">{preview.card.def.nameEn}</div>
                )}
              </div>
            </div>
            <p className="text-center text-sm font-semibold text-soft">{preview.card.def.nameEn}</p>
            <p className="text-center text-[10px] text-muted-portal">
              {preview.card.def.code}
              {preview.card.def.level !== undefined ? ` · Nível ${preview.card.def.level}` : ""}
              {preview.card.def.cost !== undefined ? ` · Custo ${preview.card.def.cost}` : ""}
            </p>
            {!preview.canPlay && preview.blockedReason ? <p className="mt-2 text-center text-xs text-amber-400">{preview.blockedReason}</p> : null}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1 rounded-none" onClick={() => setPreview(null)}>
                Fechar
              </Button>
              {preview.canPlay ? (
                <Button className="flex-1 rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={preview.onPlay}>
                  Jogar
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (!isPortraitMobile) {
    return <div className="fixed inset-0">{content}</div>;
  }

  // Celular em retrato -- gira 90° via CSS (a Screen Orientation API real exige fullscreen em
  // vários browsers, então preferimos o truque de transform, que funciona sempre).
  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-950">
      <div className="absolute left-1/2 top-1/2" style={{ width: "100vh", height: "100vw", transform: "translate(-50%, -50%) rotate(90deg)" }}>
        {content}
      </div>
    </div>
  );
}

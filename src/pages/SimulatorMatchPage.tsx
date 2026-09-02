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
 *
 * docs/19, Sessão 3 (2026-09-01) — layout "nível arena": a camada visual
 * agora é montada a partir de componentes dedicados em
 * `src/modules/simulator/ui/` (BattleSlot com 6 slots fixos + Piloto
 * acoplado + badge LINK, ShieldStack, ResourceTray com ativo/rested/EX,
 * BaseCardGauge com barra de HP, CardInspectorModal, BurstModal,
 * TriggerOrderModal, CombatLane, HandDrawer). Esta página ficou só
 * como orquestrador de estado/ações — decide quem é alvo legal do quê e
 * encaminha os cliques. Regressão corrigida de passagem: a Battle Area
 * agora filtra só Units pros 6 slots (Pilots pareados aparecem acoplados,
 * não ocupam slot próprio — antes `battleArea[i]` interleava os dois).
 * Polimento da Sessão 3 (2026-09-01): `CombatLane` agora desenha a LINHA DE
 * MIRA ponto-a-ponto (SVG `fixed` que liga o card atacante ao alvo real,
 * medido via `useBoardElements` + `getBoundingClientRect`, re-medido no
 * scroll/resize com throttle de rAF), e a `HandDrawer` abre/fecha por
 * SWIPE vertical na aba além do toque.
 *
 * docs/19, Sessão 4 (2026-09-01) — telemetria/QA: feed de log de batalha
 * (`BattleLogDrawer` + `battleLog.ts` traduz `GameEvent` → PT), botão
 * "Reportar bug/dúvida de regra" no HUD (`api.reportSimulatorSituation` —
 * o servidor loga o `GameState` real + histórico). O `eventLog` que vai pra
 * rede agora é janelado (últimos 150, `viewState.ts`) e o match store do
 * servidor faz GC oportunista de partidas terminadas.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { AlertTriangle, Bug, Clock, LogOut, RefreshCw, Shield, Sparkles, Swords, Zap } from "lucide-react";

import { api, buildSimulatorStreamUrl, type SimulatorMatchView } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { otherPlayer, type AttackTarget, type CardInstance, type PlayerId } from "@/modules/simulator/engine/types";
import type { PlayerAction } from "@/modules/simulator/engine/actions";
import type { HiddenCard, ViewCardInstance, ViewGameState, ViewPlayerState } from "@/modules/simulator/engine/viewState";
import {
  BaseCardGauge,
  BattleLogDrawer,
  BattleSlot,
  buildBattleLog,
  BurstModal,
  CardFace,
  CardInspectorModal,
  CombatLane,
  HandDrawer,
  playerAreaKey,
  ResourceTray,
  ShieldStack,
  TriggerOrderModal,
  useBoardElements,
} from "@/modules/simulator/ui";

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
/** Rota pra onde "Sair"/fim de jogo devolvem o jogador (a "Minha Área" do portal, com o shell/nav normal). */
const EXIT_ROUTE = "/portal";
/** Ao encerrar a partida (fim de jogo por qualquer motivo), o jogador é levado de volta ao site depois disso. */
const GAME_OVER_REDIRECT_MS = 8_000;

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
/** Um jeito de jogar a carta em preview. Cards Command/Pilot (`def.pilotMode`) têm 2 modos ("Jogar como Comando" / "Parear como Piloto"); o resto tem 1. */
type HandPlayMode = { label: string; run: () => void };
/** Preview compacto aberto ao clicar numa carta da mão -- substitui o antigo botão "Jogar" minúsculo. */
type HandPreview = { card: CardInstance; blockedReason?: string; modes: HandPlayMode[] };

export default function SimulatorMatchPage({ matchId }: { matchId: string }) {
  const [, setLocation] = useLocation();
  const [matchView, setMatchView] = useState<SimulatorMatchView | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  /** instanceIds dos Recursos ativos escolhidos pra restar/pagar o custo da carta em `pending` (seleção manual — 2026-09-01). */
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [preview, setPreview] = useState<HandPreview | null>(null);
  /** carta de tabuleiro aberta no inspetor (zoom) — docs/19, Sessão 3. */
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  const [handOpen, setHandOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [phaseFlash, setPhaseFlash] = useState<string | null>(null);
  /** instante em que o redirecionamento pós-fim-de-jogo dispara (pra mostrar a contagem regressiva). */
  const [redirectAt, setRedirectAt] = useState<number | null>(null);

  const board = useBoardElements(); // docs/19, Sessão 3 — refs de tabuleiro pra linha de mira do CombatLane

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
    setSelectedResources([]);
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

  const toggleAutoPass = async (value: boolean) => {
    try {
      const res = await api.setSimulatorAutoPass(matchId, value);
      setMatchView(res);
    } catch (err) {
      toast.error(errorMessage(err, "Não deu pra mudar o auto-pass."));
    }
  };

  const reportSituation = async () => {
    const note = window.prompt("Descreva rapidamente a dúvida/bug de regra (opcional):") ?? undefined;
    try {
      const { reportId } = await api.reportSimulatorSituation(matchId, note);
      // fallback local: também copia a visão redigida + id pro clipboard, caso o dev precise.
      try {
        await navigator.clipboard.writeText(JSON.stringify({ reportId, matchView }, null, 2));
      } catch {
        /* clipboard pode falhar sem HTTPS/foco — o log do servidor já basta */
      }
      toast.success(`Relatório enviado (#${reportId}). O dev vê o estado completo nos logs.`);
    } catch (err) {
      toast.error(errorMessage(err, "Não deu pra enviar o relatório."));
    }
  };

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

  const leaveMatchScreen = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setLocation(EXIT_ROUTE);
  }, [setLocation]);

  const exitToLobby = async () => {
    // "Sair" = desistir da partida: encerra o duelo e concede a vitória a quem
    // ficou. Se a partida já acabou (ou nunca teve oponente), só navega embora.
    if (!matchView?.view.gameOver) {
      const ok = window.confirm(
        "Sair agora encerra o duelo e concede a vitória ao oponente (abandono). Sair mesmo assim?",
      );
      if (!ok) return;
      try {
        await api.resignSimulatorMatch(matchId);
      } catch {
        /* já acabou / sem oponente — navega mesmo assim */
      }
    }
    leaveMatchScreen();
  };

  // Fim de jogo (por qualquer motivo: vitória normal, abandono, W.O.) -> encerra o
  // stream e devolve o jogador ao site depois de GAME_OVER_REDIRECT_MS (com botão
  // pra voltar na hora). Sem isso o jogador ficava preso na tela de "Fim de jogo".
  const gameOver = matchView?.view.gameOver ?? null;
  useEffect(() => {
    if (!gameOver) {
      setRedirectAt(null);
      return;
    }
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setRedirectAt(Date.now() + GAME_OVER_REDIRECT_MS);
    const timer = setTimeout(() => setLocation(EXIT_ROUTE), GAME_OVER_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [gameOver, setLocation]);

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
  const battleLog = buildBattleLog(view); // docs/19, Sessão 4 — feed traduzido; barato (eventLog é janelado no servidor)
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

  // Decisão interativa pendente (docs/19, Sessão 2) — Burst de shield quebrada, sobretudo.
  const myPendingDecision = view.pendingDecision[seat];
  const oppPendingDecision = view.pendingDecision[opponentSeat];
  const myBurstDecision = myPendingDecision?.kind === "burst" ? myPendingDecision : null;

  const turnSecondsLeft = matchView.turnDeadlineAt !== null ? Math.max(0, Math.ceil((matchView.turnDeadlineAt - now) / 1000)) : null;
  const itsMyDecision =
    !view.gameOver && (myTurnMain || iAmDefending || iHavePriority || iHaveEndPhasePriority || myPendingDecision !== null);
  const redirectSecondsLeft = redirectAt !== null ? Math.max(0, Math.ceil((redirectAt - now) / 1000)) : null;
  const gameOverResult = view.gameOver
    ? {
        won: view.gameOver.winner === seat,
        reasonLabel:
          { deckOut: "deck vazio", noShieldsBattleDamage: "dano de batalha sem shields", abandonment: "abandono" }[
            view.gameOver.reason
          ] ?? view.gameOver.reason,
      }
    : null;

  const opponentLastSeen = matchView.lastSeenAt[opponentSeat];
  const opponentIdleMs = opponentLastSeen ? Math.max(0, now - opponentLastSeen) : null;
  const opponentIdleSeconds = opponentIdleMs !== null ? Math.floor(opponentIdleMs / 1000) : null;
  const canClaimAbandon = !view.gameOver && opponentIdleMs !== null && opponentIdleMs >= ABANDON_THRESHOLD_MS;

  const toggleSelect = (instanceId: string) => {
    if (!pending) return;
    setSelected((current) => (current.includes(instanceId) ? current.filter((id) => id !== instanceId) : [...current, instanceId]));
  };

  /** clique num Recurso ativo pra incluí-lo/tirá-lo do pagamento manual do custo. */
  const toggleResource = (instanceId: string) => {
    if (!pending) return;
    setSelectedResources((current) =>
      current.includes(instanceId) ? current.filter((id) => id !== instanceId) : [...current, instanceId],
    );
  };

  // carta em `pending` (ainda na mão) + custo dela — pra saber quantos Recursos pedir.
  const pendingCard: CardInstance | undefined = pending
    ? (view.players[seat].hand.find((c) => !isHidden(c) && c.instanceId === pending.cardInstanceId) as CardInstance | undefined)
    : undefined;
  const pendingCost = pendingCard?.def.cost ?? 0;
  const resourcesReady = selectedResources.length === pendingCost;

  // Ao começar a jogar uma carta, recolhe a mão: a gaveta cobre a base do board
  // (Recursos/Base/Shields) e é justo isso que o jogador precisa ver pra pagar
  // custo / escolher alvo.
  const startDeploy = (card: CardInstance) => {
    setHandOpen(false);
    setPending({ kind: "deploy", cardInstanceId: card.instanceId });
  };
  const startCommand = (card: CardInstance) => {
    if (!commandTrigger) return;
    setHandOpen(false);
    setPending({ kind: "command", cardInstanceId: card.instanceId, trigger: commandTrigger });
  };

  const confirmPending = () => {
    if (!pending) return;
    // Pagamento manual do custo: o jogador escolhe exatamente `cost` Recursos ativos
    // pra restar. Sem isso o motor pegava os N primeiros do array — e o EX Resource,
    // que fica sempre no índice 0, era gasto (e SAI DO JOGO) sem o jogador querer.
    if (pendingCost > 0 && selectedResources.length !== pendingCost) {
      toast.error(`Selecione exatamente ${pendingCost} recurso(s) ativo(s) para pagar o custo (clique na sua bandeja de Recursos).`);
      return;
    }
    const resourceInstanceIds = pendingCost > 0 ? selectedResources : undefined;
    const myBattleArea = view.players[seat].battleArea.filter((c) => !isHidden(c)) as CardInstance[];
    if (pending.kind === "deploy") {
      const card = pendingCard;
      let pairWithUnitId: string | undefined;
      // Pilot nativo OU card Command/Pilot jogado no modo Piloto (def.pilotMode).
      if (card?.def.cardType === "PILOT" || !!card?.def.pilotMode) {
        pairWithUnitId = selected.find((id) => myBattleArea.some((u) => u.instanceId === id && u.def.cardType === "UNIT" && !u.pairedPilotId));
        if (!pairWithUnitId) {
          toast.error("Selecione (clicando na Battle Area) a Unit própria pra parear com este Pilot.");
          return;
        }
      }
      const targetIds = selected.filter((id) => id !== pairWithUnitId);
      const targets = targetIds.length ? { target: targetIds, shield: targetIds } : undefined;
      runAction({ kind: "deployCard", cardInstanceId: pending.cardInstanceId, pairWithUnitId, targets, resourceInstanceIds });
    } else {
      const targets = selected.length ? { target: selected, shield: selected } : undefined;
      runAction({
        kind: "playCommand",
        cardInstanceId: pending.cardInstanceId,
        trigger: pending.trigger ?? "Main",
        targets,
        resourceInstanceIds,
      });
    }
  };

  const declareAttack = (target: AttackTarget) => {
    if (!attackerId) return;
    runAction({ kind: "declareAttack", attackerId, target });
  };

  /** Modos de jogo de uma carta da mão (1, ou 2 pra Command/Pilot). Vazio = injogável agora. */
  const handPlayModes = (c: CardInstance): HandPlayMode[] => {
    const isCommandType = c.def.cardType === "COMMAND";
    const isDual = isCommandType && !!c.def.pilotMode;
    const canCommand = Boolean(commandTrigger) && (c.def.triggerKeywords?.includes(commandTrigger!) ?? false);
    const canPair = myTurnMain; // o motor valida se há Unit amiga sem Piloto ao confirmar
    const asCommand: HandPlayMode = { label: `Jogar como Comando (${commandTrigger ?? "Main"})`, run: () => { setPreview(null); startCommand(c); } };
    const asPilot: HandPlayMode = { label: "Parear como Piloto", run: () => { setPreview(null); startDeploy(c); } };
    const plain = (fn: (card: CardInstance) => void): HandPlayMode => ({ label: "Jogar", run: () => { setPreview(null); fn(c); } });

    if (isDual) {
      const modes: HandPlayMode[] = [];
      if (canCommand) modes.push(asCommand);
      if (canPair) modes.push(asPilot);
      return modes;
    }
    if (isCommandType) return canCommand ? [plain(startCommand)] : [];
    return canPair ? [plain(startDeploy)] : [];
  };

  // ---------------------------------------------------------------------------
  // docs/19, Sessão 3 — o tabuleiro "nível arena" é montado a partir dos
  // componentes de `modules/simulator/ui/`. Esta página só decide QUEM é
  // alvo legal do quê e encaminha os cliques pras ações do motor.
  // ---------------------------------------------------------------------------
  const selecting = Boolean(pending);

  /** Pilot pareado com `unit` (mesma Battle Area, achado por `pairedPilotId`). */
  function pairedPilotOf(player: ViewPlayerState, unit: CardInstance): CardInstance | null {
    if (!unit.pairedPilotId) return null;
    const found = player.battleArea.find((c) => !isHidden(c) && c.instanceId === unit.pairedPilotId);
    return found && !isHidden(found) ? (found as CardInstance) : null;
  }

  const publicUnits = (player: ViewPlayerState): CardInstance[] =>
    player.battleArea.filter((c) => !isHidden(c) && (c as CardInstance).def.cardType === "UNIT") as CardInstance[];

  /** Battle Area: 6 slots fixos, só Units (Pilots pareados aparecem acoplados via DockedPilot). */
  function renderBattleArea(player: ViewPlayerState, isSelf: boolean) {
    const units = publicUnits(player);
    const canAttackFrom = isSelf && myTurnMain && !attackerId && !selecting;
    const canBeTargeted = !isSelf && attackerId !== null && combat === null;
    const canBlockWith = isSelf && iAmDefending;

    return (
      <div className="grid justify-center gap-1" style={{ gridTemplateColumns: "repeat(6, var(--card, 3.5rem))" }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const unit = units[i] ?? null;
          const actions =
            unit && (canAttackFrom || (canBeTargeted && unit.rested) || canBlockWith)
              ? {
                  onAttack: canAttackFrom ? (u: CardInstance) => setAttackerId(u.instanceId) : undefined,
                  onDeclareTarget: canBeTargeted && unit.rested ? (u: CardInstance) => declareAttack({ unitId: u.instanceId }) : undefined,
                  onBlocker: canBlockWith ? (u: CardInstance) => runAction({ kind: "activateBlocker", blockerId: u.instanceId }) : undefined,
                }
              : undefined;
          return (
            <BattleSlot
              key={unit?.instanceId ?? `empty-${i}`}
              unit={unit}
              pilot={unit ? pairedPilotOf(player, unit) : null}
              art={art}
              legalTarget={Boolean(unit && selecting)}
              selected={Boolean(unit && selected.includes(unit.instanceId))}
              isAttacker={Boolean(unit && attackerId === unit.instanceId)}
              busy={busy}
              onSelect={(u) => toggleSelect(u.instanceId)}
              onInspect={setInspect}
              actions={actions}
              registerRef={unit ? board.register(unit.instanceId) : undefined}
            />
          );
        })}
      </div>
    );
  }

  /** Pilha compacta de trash/exílio: contagem + até 3 miniaturas, clique inspeciona. */
  function renderPile(label: string, cards: ViewCardInstance[]) {
    const publics = cards.filter((c) => !isHidden(c)) as CardInstance[];
    return (
      <div>
        <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label} ({cards.length})
        </p>
        {publics.length === 0 ? (
          <div className="aspect-[63/88] w-9 border border-dashed border-white/10" />
        ) : (
          <div className="flex -space-x-4">
            {publics.slice(-3).map((c) => (
              <button key={c.instanceId} type="button" onClick={() => setInspect(c)} className="border border-white/10">
                <CardFace nameEn={c.def.nameEn} code={c.def.code} art={art} size="xs" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderDeckTile(label: string, count: number) {
    return (
      <div>
        <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <div className="flex aspect-[63/88] w-9 items-center justify-center border border-white/15 bg-gradient-to-br from-slate-900 to-black text-xs font-bold text-slate-300">
          {count}
        </div>
      </div>
    );
  }

  /** Uma carta da MÃO própria -- máscara quando não-jogável; clique abre o inspetor (com botão "Jogar"). */
  function renderHandCard(c: CardInstance) {
    const isCommand = c.def.cardType === "COMMAND";
    const isDual = isCommand && !!c.def.pilotMode;
    const modes = handPlayModes(c);
    const canPlay = modes.length > 0;
    const blockedReason = canPlay
      ? undefined
      : isDual
        ? "Nem o modo Comando nem o modo Piloto estão disponíveis agora."
        : isCommand
          ? "Esta Command não tem gatilho disponível agora."
          : notMainPhaseReason;

    return (
      <button
        key={c.instanceId}
        type="button"
        onClick={() => setPreview({ card: c, blockedReason, modes })}
        className={`relative shrink-0 border transition-all ${
          canPlay ? "border-primary/60 hover:-translate-y-1.5 hover:border-primary" : "border-white/10"
        }`}
      >
        <CardFace nameEn={c.def.nameEn} code={c.def.code} art={art} size="md" dimmed={!canPlay}>
          {c.def.cardType === "UNIT" ? (
            <div className="absolute inset-x-0 bottom-0 flex text-[9px] font-black">
              <span className="flex-1 bg-cyan-600/90 py-0.5 text-center text-white">{c.def.ap ?? 0}</span>
              <span className="flex-1 bg-slate-700/90 py-0.5 text-center text-white">{c.def.hp ?? 0}</span>
            </div>
          ) : null}
          {c.def.cost !== undefined ? (
            <span className="absolute left-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-black">
              {c.def.cost}
            </span>
          ) : null}
        </CardFace>
      </button>
    );
  }

  /** Coluna lateral: Base (com gauge de HP), pilha de Shields, Resource Deck.
   *  Fase A: horizontal — entra na "front strip" de cada lado. */
  function renderLeftColumn(player: ViewPlayerState) {
    const base = (player.baseSection.find((c) => !isHidden(c)) as CardInstance | undefined) ?? null;
    return (
      <div className="flex flex-row items-end gap-2">
        <BaseCardGauge
          base={base}
          art={art}
          legalTarget={selecting && Boolean(base)}
          selected={Boolean(base && selected.includes(base.instanceId))}
          onSelect={(b) => toggleSelect(b.instanceId)}
          onInspect={setInspect}
        />
        <ShieldStack
          shields={player.shields}
          selectable={selecting}
          selectedIds={selected}
          onSelect={toggleSelect}
        />
        {renderDeckTile("Recurso", player.counts.resourceDeck)}
      </div>
    );
  }

  function renderRightColumn(player: ViewPlayerState) {
    return (
      <div className="flex flex-row items-end gap-2">
        {renderPile("Trash", player.trash)}
        {renderPile("Exílio", player.exile)}
        {renderDeckTile("Deck", player.counts.deck)}
      </div>
    );
  }

  function renderOpponentHandBacks(count: number) {
    return (
      <div className="flex items-center gap-2">
        <p className="shrink-0 text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">Mão ({count})</p>
        <div className="flex">
          {Array.from({ length: Math.min(count, 10) }).map((_, i) => (
            <div key={i} className="-ml-3 aspect-[63/88] w-7 border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black first:ml-0" />
          ))}
        </div>
      </div>
    );
  }

  function renderMyHandCards(cards: CardInstance[]) {
    if (!cards.length) return <p className="text-[10px] text-muted-portal">Mão vazia.</p>;
    return cards.map((c) => renderHandCard(c));
  }

  /** Um lado inteiro do board (Fase A — plano visual §02). Cada lado é uma faixa
   *  `flex-1` do grid de 5 faixas; a Battle Area encosta na seam central
   *  (oponente: base do bloco dele; você: topo do seu). Sem rolagem — o board
   *  cresce/encolhe com o viewport, `--card` dá a escala. */
  function renderSide(pid: PlayerId, isSelf: boolean) {
    const player = view.players[pid];

    const sideHeader = (
      <div className="flex shrink-0 items-center justify-between gap-2 px-1">
        <p className="text-xs font-semibold text-soft">
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
    );

    // Faixa horizontal com Base / Shields / Resource Deck / Trash / Exílio / Deck e a
    // bandeja de Recursos. No oponente entra também a mão virada. (Fase C troca isto
    // por shield rail + medidor + chips.)
    const frontStrip = (
      <div className="flex shrink-0 flex-wrap items-end justify-center gap-x-3 gap-y-1 px-1">
        {!isSelf ? renderOpponentHandBacks(player.hand.length) : null}
        {renderLeftColumn(player)}
        {renderRightColumn(player)}
        <ResourceTray
          player={player}
          compact={!isSelf}
          selectable={isSelf && Boolean(pending) && pendingCost > 0}
          selectedIds={isSelf ? selectedResources : undefined}
          onSelect={isSelf ? toggleResource : undefined}
        />
      </div>
    );

    // ref pro CombatLane mirar a Battle Area quando o ataque é "no jogador".
    const battle = (
      <div
        ref={board.register(playerAreaKey(pid))}
        className={`flex min-h-0 flex-1 justify-center overflow-hidden py-1 ${isSelf ? "items-start" : "items-end"}`}
      >
        <div className="flex flex-col gap-0.5">
          <p className="text-center text-[8px] uppercase tracking-[0.24em] text-cyan-500/70">Battle Area</p>
          {renderBattleArea(player, isSelf)}
        </div>
      </div>
    );

    // A mão NÃO fica numa faixa do board (espremeria a Battle Area — bug do QA da
    // Fase A): fica recolhida na `HandDrawer` na base da tela e sobe por cima do
    // board sob demanda, pros dois lados do board terem altura cheia.
    return (
      <div
        className={`flex min-h-0 flex-1 flex-col gap-1 border p-1.5 sm:p-2 ${
          isSelf ? "border-primary/25 bg-primary/[0.04]" : "border-white/10 bg-white/[0.02]"
        }`}
      >
        {isSelf ? (
          <>
            {battle}
            {frontStrip}
            {sideHeader}
          </>
        ) : (
          <>
            {sideHeader}
            {frontStrip}
            {battle}
          </>
        )}
      </div>
    );
  }

  // Mão própria (sem cartas ocultas) + quantas dão pra jogar agora — alimenta a
  // aba da HandDrawer ("N jogáveis").
  const myHandCards = (view.players[seat].hand as ViewCardInstance[]).filter((c) => !isHidden(c)) as CardInstance[];
  const myPlayableCount = myHandCards.filter((c) => handPlayModes(c).length > 0).length;

  const attacker = attackerId
    ? findPublicCard(view, attackerId)
    : combat
      ? findPublicCard(view, combat.attackerId)
      : null;
  const combatTargetUnit =
    combat && typeof combat.currentTarget === "object" ? findPublicCard(view, combat.currentTarget.unitId) : null;

  const content = (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 text-soft">
      {/* HUD -- sem PortalShell nesta tela (rodada 5): usa o viewport inteiro. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-primary/20 hero-surface px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="rounded-none"
            disabled={busy}
            onClick={exitToLobby}
            title={
              matchView?.view.gameOver
                ? "Voltar ao lobby do simulador"
                : "Sair e desistir do duelo (concede a vitória ao oponente)"
            }
          >
            <LogOut className="mr-1.5 size-3.5" />
            Sair
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-none border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            onClick={reportSituation}
            title="Reportar bug ou dúvida de regra — envia o estado da partida pro dev"
          >
            <Bug className="size-3.5" />
          </Button>
        </div>
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-[0.24em] text-muted-portal">Turno {view.turnNumber}</p>
          <p className="mt-0.5 text-sm heading-portal sm:text-base">
            {PHASE_LABEL[view.phase]} Phase · Vez de {view.activePlayer}
            {combat ? ` · Combate (${combat.step})` : ""}
            {endPhaseAction ? ` · Action Step (prioridade: ${endPhaseAction.priority})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {gameOverResult ? (
            <Badge
              variant="outline"
              className={`rounded-none ${gameOverResult.won ? "border-emerald-500/50 text-emerald-400" : "border-red-500/50 text-red-400"}`}
            >
              {gameOverResult.won ? "Você venceu" : "Você perdeu"} · {gameOverResult.reasonLabel}
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

      {/* Avisos de decisão / informação -- 2026-09-01: movidos pro CENTRO da tela
          (antes ficavam numa faixa no topo, fácil de não notar). Wrapper sem
          pointer-events pra o tabuleiro continuar clicável atrás; cada card
          reativa os próprios cliques. */}
      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-4">
        <div className="flex w-full max-w-sm flex-col items-stretch gap-2 text-center">
          {gameOverResult ? (
            <div
              className={`pointer-events-auto panel-cut border bg-slate-950/97 px-4 py-4 text-soft shadow-2xl ${
                gameOverResult.won ? "border-emerald-500/60" : "border-red-500/60"
              }`}
            >
              <p className={`text-lg font-black ${gameOverResult.won ? "text-emerald-400" : "text-red-400"}`}>
                {gameOverResult.won ? "Você venceu!" : "Você perdeu"}
              </p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-muted-portal">
                Fim de jogo · {gameOverResult.reasonLabel}
              </p>
              <Button
                size="sm"
                className="mt-3 rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={leaveMatchScreen}
              >
                Voltar ao site {redirectSecondsLeft !== null ? `(${redirectSecondsLeft}s)` : ""}
              </Button>
            </div>
          ) : null}

          {!gameOverResult && canClaimAbandon ? (
            <div className="pointer-events-auto panel-cut border border-amber-500/50 bg-slate-950/95 px-3 py-2.5 text-xs text-soft shadow-2xl">
              <p className="flex items-center justify-center gap-1.5 font-semibold text-amber-300">
                <AlertTriangle className="size-4" /> Oponente sem responder há {opponentIdleSeconds}s
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 rounded-none border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                disabled={busy}
                onClick={claimAbandon}
              >
                Declarar vitória por abandono
              </Button>
            </div>
          ) : null}

          {!gameOverResult && oppPendingDecision ? (
            <div className="pointer-events-auto panel-cut flex items-center justify-center gap-2 border border-primary/40 bg-slate-950/95 px-3 py-2.5 text-xs text-soft shadow-2xl">
              <Sparkles className="size-4 text-primary" />
              Aguardando o oponente resolver {oppPendingDecision.kind === "burst" ? "um 【Burst】" : "uma decisão"}...
            </div>
          ) : null}

          {!gameOverResult && inActionStep ? (
            <div className="pointer-events-auto panel-cut animate-pulse border border-amber-500/70 bg-slate-950/95 px-3 py-2.5 text-xs font-semibold text-amber-300 shadow-2xl">
              <p>
                {iHavePriority ? "Action Step de combate" : "Action Step de fim de turno"} — sua prioridade. Só Command
                【Action】 pode ser jogada agora.
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-none border-amber-500/60 text-amber-300 hover:bg-amber-500/20"
                  disabled={busy}
                  onClick={() => runAction(iHavePriority ? { kind: "passAction" } : { kind: "passEndPhaseAction" })}
                >
                  Passar
                </Button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[10px] font-normal text-amber-300/80 underline decoration-dotted hover:text-amber-200"
                  onClick={() => toggleAutoPass(!matchView.autoPassActionStep)}
                >
                  <Zap className="size-3" />
                  {matchView.autoPassActionStep ? "auto-pass: LIGADO" : "auto-passar sem jogada"}
                </button>
              </div>
            </div>
          ) : null}

          {!gameOverResult && attackerId ? (
            <div className="pointer-events-auto panel-cut border border-primary/40 bg-slate-950/95 px-3 py-2.5 text-xs text-soft shadow-2xl">
              <p className="flex items-center justify-center gap-1.5 font-semibold text-primary">
                <Swords className="size-4" /> Atacando com {attacker?.def.nameEn ?? attackerId}
              </p>
              <p className="mt-1 text-[10px] text-muted-portal">ou clique em "Alvo" numa Unit rested do oponente.</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={busy}
                  onClick={() => declareAttack("player")}
                >
                  Atacar o jogador
                </Button>
                <Button size="sm" variant="outline" className="rounded-none" onClick={() => setAttackerId(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

          {!gameOverResult && pending ? (
            <div className="pointer-events-auto panel-cut border border-primary/40 bg-slate-950/95 px-3 py-2.5 text-xs text-soft shadow-2xl">
              <p className="flex items-center justify-center gap-1.5 font-semibold text-primary">
                <Shield className="size-4" />
                {pending.kind === "deploy" ? "Jogando carta" : `Jogando Command (${pending.trigger})`}
                {pendingCard ? ` — ${pendingCard.def.nameEn}` : ""}
              </p>
              <p className="mt-1 text-[11px] text-muted-portal">
                Se pedir alvo/pareamento, clique nas cartas do tabuleiro — {selected.length} selecionada(s).
              </p>
              {pendingCost > 0 ? (
                <p className={cn("mt-1 text-[11px] font-semibold", resourcesReady ? "text-emerald-300" : "text-amber-300")}>
                  Recursos p/ pagar o custo: {selectedResources.length}/{pendingCost} — clique nos seus Recursos ativos.
                </p>
              ) : null}
              <div className="mt-2 flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={busy || (pendingCost > 0 && !resourcesReady)}
                  onClick={confirmPending}
                >
                  Confirmar
                </Button>
                <Button size="sm" variant="outline" className="rounded-none" onClick={clearSelection}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

          {!gameOverResult && iAmDefending ? (
            <div className="pointer-events-auto panel-cut border border-primary/40 bg-slate-950/95 px-3 py-2.5 text-xs text-soft shadow-2xl">
              <p>
                Defendendo. Ative um <strong>&lt;Blocker&gt;</strong> (botão na Unit) ou:
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 rounded-none"
                disabled={busy}
                onClick={() => runAction({ kind: "skipBlock" })}
              >
                Não bloquear
              </Button>
            </div>
          ) : null}

          {!gameOverResult && myTurnMain ? (
            <div className="pointer-events-auto panel-cut flex items-center justify-center gap-3 border border-primary/30 bg-slate-950/90 px-3 py-2 text-xs text-soft shadow-xl">
              Sua Main Phase.
              <Button
                size="sm"
                variant="outline"
                className="rounded-none"
                disabled={busy}
                onClick={() => runAction({ kind: "finishTurn" })}
              >
                Encerrar turno
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Board -- grid de 5 faixas, SEM rolagem (Fase A, plano visual §02): as duas
          Battle Areas dividem 1fr 1fr e se encontram na seam central. `--card` dá a
          escala de toda carta a partir do viewport; largura-teto 1400px, centrado. */}
      <div className="relative min-h-0 flex-1 overflow-hidden px-1 sm:px-2">
        <div
          className="mx-auto flex h-full w-full max-w-[1400px] flex-col gap-1 overflow-hidden"
          style={{ "--card": "clamp(2.75rem, 7.5vw, 6.5rem)", paddingBottom: "3.25rem" } as CSSProperties}
        >
          {renderSide(opponentSeat, false)}
          <div className="mx-auto h-0.5 w-full shrink-0 bg-gradient-to-r from-transparent via-red-500/45 to-transparent" />
          {renderSide(seat, true)}
        </div>
      </div>

      {/* Linha de mira + badge de combate (docs/19, Sessão 3) — overlay `fixed`, FORA do
          container que rola/escala, pra o `fixed` cobrir o viewport inteiro. */}
      {combat ? (
        <CombatLane
          combat={combat}
          attacker={attacker}
          targetUnit={combatTargetUnit}
          viewerSeat={seat}
          rectOf={board.rectOf}
        />
      ) : null}

      {/* Inspetor de carta (zoom) -- da mão (com botão "Jogar") ou de qualquer carta pública do tabuleiro. */}
      {preview ? (
        <CardInspectorModal
          card={preview.card}
          art={art}
          blockedReason={preview.blockedReason}
          onClose={() => setPreview(null)}
          footer={
            preview.modes.length > 0 ? (
              <div className="flex flex-1 flex-col gap-1.5">
                {preview.modes.map((m) => (
                  <Button
                    key={m.label}
                    className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={busy}
                    onClick={m.run}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
            ) : undefined
          }
        />
      ) : inspect ? (
        <CardInspectorModal card={inspect} art={art} inPlay onClose={() => setInspect(null)} />
      ) : null}

      {/* docs/19, Sessão 2/3 — decisões interativas. */}
      {myBurstDecision ? (
        <BurstModal
          decision={myBurstDecision}
          art={art}
          busy={busy}
          onResolve={(activate) => runAction({ kind: "resolveBurstDecision", activate })}
        />
      ) : null}
      {myPendingDecision?.kind === "triggerOrder" ? (
        <TriggerOrderModal
          decision={myPendingDecision}
          busy={busy}
          onResolve={(orderedSpecIds) => runAction({ kind: "resolveTriggerOrder", orderedSpecIds })}
        />
      ) : null}

      {/* docs/19, Sessão 4 — feed de log de batalha (painel lateral / gaveta). */}
      <BattleLogDrawer entries={battleLog} open={logOpen} onToggle={() => setLogOpen((o) => !o)} />

      {/* Fase A: a mão fica na gaveta da base em TODA tela (no board em grid ela não
          cabe numa faixa sem espremer a Battle Area). */}
      <HandDrawer
        count={myHandCards.length}
        subtitle={myPlayableCount > 0 ? `${myPlayableCount} ${myPlayableCount === 1 ? "jogável" : "jogáveis"}` : "nada jogável agora"}
        open={handOpen}
        onToggle={() => setHandOpen((o) => !o)}
      >
        {renderMyHandCards(myHandCards)}
      </HandDrawer>
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

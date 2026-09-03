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
 * acoplado + badge LINK, ShieldStack/ResourceTray — trocados nas Fases C/D
 * por ShieldRail/ResourceMeter/PileTray/CounterChip/HandFan, ver bloco no fim
 * deste cabeçalho —, BaseCardGauge com barra de HP, CardInspectorModal,
 * BurstModal, TriggerOrderModal, CombatLane, HandDrawer). Esta página ficou só
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
 *
 * Fase B do redesenho visual (2026-09-02, plano visual §03) — os ~7 cards de
 * decisão centralizados (`absolute inset-0 z-30`, que cobriam o board) + o
 * flash de fase que atravessava a tela viraram UM `ActionDock` (`ui/`) fixo no
 * canto. `computeDockState()` mapeia a situação → um `ActionDockState` (8
 * `kind`s, por precedência). Sem mudança funcional: mesmas ações, mesmos gates
 * (`busy`, custo), só num lugar previsível que nunca cobre o centro do board.
 * O cue de troca de turno via flash saiu (era 1 das 3 camadas de mensagem que
 * colidiam) — a troca já aparece no HUD e no dock `idle`.
 *
 * Fases C + D do redesenho visual (2026-09-02, plano visual §03) — as zonas que
 * carregavam estado escondido à vista viraram componentes dedicados de `ui/`:
 * `ShieldStack` → `ShieldRail` (trilha de pips), `ResourceTray` → `ResourceMeter`
 * (medidor `◆◆◆◇`), `renderPile`/`renderDeckTile` → `PileTray` (chip → bandeja
 * overlay) / `CounterChip`. A mão virou `HandFan` (leque com lift em foco) dentro
 * da `HandDrawer`. `describeHandCard()` centraliza "jogável? por quê não?". Sem
 * mudança funcional. Diferido: opp shields no HUD e inspetor no painel do XL.
 *
 * Sprint 4 do redesenho visual "Nível Arena" (2026-09-02) — o board disperso em
 * 5 faixas (`renderSide`/`renderLeftColumn`/`renderRightColumn` + `flex-wrap`)
 * virou UM `<ArenaPlaymat>` de proporção travada 16:9. A página só monta o
 * `ArenaSide` de cada jogador (`arenaSide()`) e segue decidindo QUEM é alvo
 * legal do quê. A `HandDrawer` saiu: a mão é o `HandFan anchored` no rodapé da
 * arena. O truque de `rotate(90deg)` no mobile retrato saiu: agora é o
 * `RotateDevicePrompt`. Em telas > 1400px a asa esquerda mostra o
 * `CardInspectorPanel` seguindo o hover (`onHoverCard`), sem modal. Sem
 * mudança de lógica de estado/ações. Redução líquida de ~75 linhas.
 *
 * Sprint 5 do redesenho visual "Nível Arena" (2026-09-02) — refinamento pós
 * teste real: clique em carta da mão de modo único joga DIRETO (sem o modal
 * burocrático); modal só pra carta dual (Comando vs Piloto); injogável só dá um
 * toast com o motivo. Deck/pilhas agora são visuais (`CounterChip
 * variant="stack"`), com o deck do oponente escondendo a contagem
 * (`hideCount`). Layout 3D + espelhamento do oponente moram no `ArenaPlaymat`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Bug, Clock, LogOut, RefreshCw } from "lucide-react";

import { api, buildSimulatorStreamUrl, type SimulatorMatchView } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { otherPlayer, type AttackTarget, type CardDef, type CardInstance, type PlayerId } from "@/modules/simulator/engine/types";
import type { PlayerAction } from "@/modules/simulator/engine/actions";
import type { HiddenCard, ViewCardInstance, ViewGameState, ViewPlayerState } from "@/modules/simulator/engine/viewState";
import { pairingNeedsExtraTarget, resolveDeploySelection } from "@/modules/simulator/ui/deployIntent";
import { fieldAbilityFor, type FieldAbility } from "@/modules/simulator/ui/abilityIntent";
import { playableModes, type PlayabilityContext } from "@/modules/simulator/ui/handPlayability";
import {
  ActionDock,
  type ActionDockState,
  ArenaPlaymat,
  type ArenaSide,
  BaseCardGauge,
  BattleLogDrawer,
  BattleSlot,
  buildBattleLog,
  BurstModal,
  cardBackUrl,
  CardInspectorModal,
  CardInspectorPanel,
  type LinkedPilot,
  CombatLane,
  CounterChip,
  HandFan,
  PileTray,
  playerAreaKey,
  ResourceMeter,
  RotateDevicePrompt,
  ShieldRail,
  TriggerOrderModal,
  useBoardElements,
  AbilityResolutionModal,
} from "@/modules/simulator/ui";

const PHASE_LABEL: Record<string, string> = { start: "Manutenção", draw: "Compra", resource: "Recurso", main: "Main", end: "Final" };
/** Espelha `DECK_OPTIONS` de SimulatorSandboxPage.tsx -- os únicos sets jogáveis hoje, usados pra buscar a arte real de cada carta por `code`. Se um novo set entrar no simulador, precisa entrar aqui também. */
const ART_SET_CODES = ["ST01", "ST02"];
/** Só pra resolver a arte de recursos/EX/tokens genéricos: o motor usa códigos
 *  (`ST01-RESOURCE`, `TOKEN-EX-BASE`, ...) que não existem em ST01/ST02 — a arte
 *  canônica vive em GD01. Ver PLANO_CORRECAO_ARTE_EFEITOS.md §1.3. */
const GENERIC_ART_SET_CODES = ["GD01"];
/** Código do motor -> código do catálogo (arte canônica). */
const ART_CODE_ALIASES: Record<string, string> = {
  "ST01-RESOURCE": "R-001",
  "ST02-RESOURCE": "R-001",
  "TOKEN-EX-BASE": "EXB-001",
  "TOKEN-EX-RESOURCE": "EXR-001",
};
/** Espelha `ABANDON_THRESHOLD_MS` do servidor (matchStore.ts) -- só usado aqui pra habilitar o botão na hora certa; quem decide de verdade é sempre o servidor. */
const ABANDON_THRESHOLD_MS = 180_000;
/** Intervalo do heartbeat de presença do cliente -- bem menor que os 3min do W.O., só pra manter `lastSeenAt` fresco. */
const PRESENCE_PING_MS = 15_000;
/** Retrato + tela pequena: em vez de girar o board via CSS (bugava toque/overflow),
 *  mostramos o `RotateDevicePrompt` pedindo o modo paisagem (Sprint 4). */
const PORTRAIT_QUERY = "(max-width: 900px) and (orientation: portrait)";
/** A partir daqui há folga lateral pras asas (inspetor de carta + log). */
const WIDE_QUERY = "(min-width: 1400px)";
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
type RawApiCard = {
  code?: string;
  nameEn?: string;
  imageUrl?: string;
  imageSmallUrl?: string;
  imageMediumUrl?: string;
  effectPt?: string | null;
  effectEn?: string | null;
};

interface CardArtLookup {
  art: Record<string, CardArt>;
  artLoading: boolean;
  /** code -> texto de efeito (PT preferido) — o CardDef do motor não carrega isso. */
  cardText: Record<string, string>;
  /** nameEn minúsculo -> { code, art } — pra resolver o piloto de um link `pilotName`. */
  cardByName: Record<string, { code: string; art: CardArt }>;
}

function useCardArtLookup(): CardArtLookup {
  const [state, setState] = useState<Omit<CardArtLookup, "artLoading">>({ art: {}, cardText: {}, cardByName: {} });
  const [artLoading, setArtLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([...ART_SET_CODES, ...GENERIC_ART_SET_CODES].map((setCode) => api.listCards({ setCode })))
      .then((results) => {
        if (cancelled) return;
        const art: Record<string, CardArt> = {};
        const cardText: Record<string, string> = {};
        const cardByName: Record<string, { code: string; art: CardArt }> = {};
        for (const list of results as RawApiCard[][]) {
          for (const raw of list) {
            if (!raw?.code) continue;
            const entry: CardArt = {
              imageUrl: raw.imageMediumUrl ?? raw.imageUrl,
              imageSmallUrl: raw.imageSmallUrl ?? raw.imageMediumUrl ?? raw.imageUrl,
            };
            art[raw.code] = entry;
            const effect = raw.effectPt || raw.effectEn;
            if (effect) cardText[raw.code] = effect;
            if (raw.nameEn) cardByName[raw.nameEn.trim().toLowerCase()] = { code: raw.code, art: entry };
          }
        }
        // aliases: código do motor (ST01-RESOURCE, TOKEN-EX-BASE, ...) -> arte canônica do catálogo.
        for (const [alias, real] of Object.entries(ART_CODE_ALIASES)) {
          if (art[real] && !art[alias]) art[alias] = art[real];
          if (cardText[real] && !cardText[alias]) cardText[alias] = cardText[real];
        }
        setState({ art, cardText, cardByName });
      })
      .catch(() => {
        // Sem arte não impede a partida -- os cards caem no fallback "sem arte" abaixo.
      })
      .finally(() => !cancelled && setArtLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, artLoading };
}

/** Acompanha uma media query (retrato pequeno / tela larga). */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

// -----------------------------------------------------------------------------
// Tela de partida -- conecta o SSE, mostra timer/presença/HUD, joga.
// -----------------------------------------------------------------------------

type PendingAction =
  | { kind: "deploy" | "command"; cardInstanceId: string; trigger?: "Main" | "Action" }
  /** 【Activate·Main】 de carta em campo (Etapa 3) — `cardInstanceId` = a carta em campo. */
  | { kind: "activateAbility"; cardInstanceId: string; abilityCost: number; abilityNeedsTarget: boolean; cardName: string };
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
  /** carta de tabuleiro aberta no inspetor (zoom, modal) — clique explícito. */
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  /** carta sob o cursor/foco — alimenta o `CardInspectorPanel` das asas largas (Sprint 3/4). */
  const [hoveredCard, setHoveredCard] = useState<CardInstance | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  /** instante em que o redirecionamento pós-fim-de-jogo dispara (pra mostrar a contagem regressiva). */
  const [redirectAt, setRedirectAt] = useState<number | null>(null);

  const board = useBoardElements(); // docs/19, Sessão 3 — refs de tabuleiro pra linha de mira do CombatLane

  const eventSourceRef = useRef<EventSource | null>(null);
  const { art, artLoading, cardText, cardByName } = useCardArtLookup();
  const isPortrait = useMediaQuery(PORTRAIT_QUERY);
  const isWide = useMediaQuery(WIDE_QUERY);

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

  // carta em `pending` — na mão (deploy/command) ou em campo (activateAbility) — + custo.
  const pendingCard: CardInstance | undefined = pending
    ? ((pending.kind === "activateAbility"
        ? findPublicCard(view, pending.cardInstanceId)
        : view.players[seat].hand.find((c) => !isHidden(c) && c.instanceId === pending.cardInstanceId)) as
        | CardInstance
        | undefined)
    : undefined;
  const pendingCost =
    pending?.kind === "activateAbility" ? pending.abilityCost : (pendingCard?.def.cost ?? 0);
  const resourcesReady = selectedResources.length === pendingCost;

  const startDeploy = (card: CardInstance) => {
    setPending({ kind: "deploy", cardInstanceId: card.instanceId });
  };
  const startCommand = (card: CardInstance) => {
    if (!commandTrigger) return;
    setPending({ kind: "command", cardInstanceId: card.instanceId, trigger: commandTrigger });
  };
  /** 【Activate·Main】 de carta em campo (Etapa 3) — abre o fluxo de custo/alvo (mesmo do deploy). */
  const startActivateAbility = (card: CardInstance, ability: FieldAbility) => {
    setPending({
      kind: "activateAbility",
      cardInstanceId: card.instanceId,
      abilityCost: ability.cost,
      abilityNeedsTarget: ability.needsTarget,
      cardName: card.def.nameEn,
    });
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
      const ownBattleUnits = myBattleArea
        .filter((c) => c.def.cardType === "UNIT")
        .map((u) => ({ instanceId: u.instanceId, code: u.def.code, paired: !!u.pairedPilotId }));
      const sel = resolveDeploySelection({ card: pendingCard, selected, ownBattleUnits });
      if (sel.error) {
        toast.error(sel.error);
        return;
      }
      // Etapa 4 — o 【When Paired】 direcionado é resolvido depois, no WhenPairedModal;
      // aqui não mandamos `targets` (o motor pausa sozinho se precisar de interação).
      runAction({
        kind: "deployCard",
        cardInstanceId: pending.cardInstanceId,
        pairWithUnitId: sel.pairWithUnitId,
        resourceInstanceIds,
      });
    } else if (pending.kind === "activateAbility") {
      if (pending.abilityNeedsTarget && selected.length === 0) {
        toast.error("Esta habilidade precisa de um alvo — clique numa carta do tabuleiro.");
        return;
      }
      const targets = selected.length ? { target: selected, shield: selected } : undefined;
      runAction({
        kind: "activateAbility",
        sourceInstanceId: pending.cardInstanceId,
        targets,
        resourceInstanceIds,
      });
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

  // P3 — contexto de jogabilidade: recursos, fase, Unit livre pra parear, alvos.
  const playabilityCtx = (): PlayabilityContext => {
    const mine = view.players[seat];
    const myUnits = mine.battleArea.filter((c) => !isHidden(c)) as CardInstance[];
    const oppUnits = (view.players[opponentSeat].battleArea.filter((c) => !isHidden(c)) as CardInstance[]).filter(
      (u) => u.def.cardType === "UNIT",
    );
    return {
      myTurnMain,
      inActionStep,
      activeResources: (mine.resourceArea.filter((c) => !isHidden(c)) as CardInstance[]).filter((r) => !r.rested).length,
      totalResources: mine.counts.resourceArea,
      hasUnpairedFriendlyUnit: myUnits.some((u) => u.def.cardType === "UNIT" && !u.pairedPilotId),
      targetCounts: {
        enemyUnit: oppUnits.length,
        friendlyUnit: myUnits.filter((u) => u.def.cardType === "UNIT").length,
        ownResource: (mine.resourceArea.filter((c) => !isHidden(c)) as CardInstance[]).length,
      },
    };
  };

  /** Modos de jogo de uma carta da mão AGORA (considerando custo/nível/fase/alvo). Vazio = injogável. */
  const handPlayModes = (c: CardInstance): HandPlayMode[] => {
    const modes = playableModes(c.def, playabilityCtx());
    const asCommand: HandPlayMode = { label: `Jogar como Comando (${commandTrigger ?? "Main"})`, run: () => { setPreview(null); startCommand(c); } };
    const asPilot: HandPlayMode = { label: "Parear como Piloto", run: () => { setPreview(null); startDeploy(c); } };
    const plain = (label: string, fn: (card: CardInstance) => void): HandPlayMode => ({ label, run: () => { setPreview(null); fn(c); } });
    const isDual = c.def.cardType === "COMMAND" && !!c.def.pilotMode;

    if (isDual) {
      const out: HandPlayMode[] = [];
      if (modes.includes("commandMain") || modes.includes("commandAction")) out.push(asCommand);
      if (modes.includes("deploy")) out.push(asPilot);
      return out;
    }
    if (c.def.cardType === "COMMAND") return modes.length ? [plain("Jogar", startCommand)] : [];
    return modes.includes("deploy") ? [plain("Jogar", startDeploy)] : [];
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

  /** Pilotos que satisfazem o link `pilotName` desta Unit — resolve arte via catálogo
   *  e marca (best-effort) se a carta está visível nas tuas zonas (Sprint 5.3). */
  function resolveLinkedPilots(def: CardDef): LinkedPilot[] {
    if (def.link?.kind !== "pilotName") return [];
    const mine = view.players[seat];
    const ownVisible: Array<{ zone: string; label: string }> = [
      { zone: "hand", label: "na sua mão" },
      { zone: "battleArea", label: "no seu campo" },
      { zone: "trash", label: "no seu descarte" },
      { zone: "exile", label: "no seu exílio" },
    ];
    return def.link.values.map((raw) => {
      const name = raw.trim();
      const key = name.toLowerCase();
      const hit =
        cardByName[key] ??
        Object.entries(cardByName).find(([k]) => k.includes(key) || key.includes(k))?.[1];
      const where = ownVisible.find(({ zone }) =>
        (mine[zone as keyof typeof mine] as ViewCardInstance[] | undefined)?.some(
          (c) => !isHidden(c) && (c as CardInstance).def.nameEn.toLowerCase().includes(key),
        ),
      );
      return { name, art: hit?.art, note: where?.label ? `Disponível ${where.label}` : undefined };
    });
  }

  /** Os 6 slots fixos de uma Battle Area (fragmento — o `ArenaPlaymat` monta o grid).
   *  Só Units; Pilots pareados aparecem acoplados via `DockedPilot`. */
  function renderBattleSlots(player: ViewPlayerState, isSelf: boolean) {
    const units = publicUnits(player);
    const canAttackFrom = isSelf && myTurnMain && !attackerId && !selecting;
    const canBeTargeted = !isSelf && attackerId !== null && combat === null;
    const canBlockWith = isSelf && iAmDefending;
    // 【Activate·Main】 de carta em campo (Etapa 3) — só na Main Phase própria, sem combate.
    const canActivateHere = isSelf && myTurnMain && !attackerId && !selecting;
    const myActiveResources = player.resourceArea.filter(
      (r) => !isHidden(r) && !(r as CardInstance).rested,
    ).length;

    return Array.from({ length: 6 }).map((_, i) => {
      const unit = units[i] ?? null;
      const ability = unit && canActivateHere ? fieldAbilityFor(unit) : null;
      const canActivate = Boolean(ability && myActiveResources >= ability!.cost);
      const actions =
        unit && (canAttackFrom || (canBeTargeted && unit.rested) || canBlockWith || canActivate)
          ? {
              onAttack: canAttackFrom ? (u: CardInstance) => setAttackerId(u.instanceId) : undefined,
              onDeclareTarget: canBeTargeted && unit.rested ? (u: CardInstance) => declareAttack({ unitId: u.instanceId }) : undefined,
              onBlocker: canBlockWith ? (u: CardInstance) => runAction({ kind: "activateBlocker", blockerId: u.instanceId }) : undefined,
              onActivate: canActivate && ability ? (u: CardInstance) => startActivateAbility(u, ability) : undefined,
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
          onHoverCard={isWide ? setHoveredCard : undefined}
          actions={actions}
          registerRef={unit ? board.register(unit.instanceId) : undefined}
        />
      );
    });
  }

  /** Classifica uma carta da mão: jogável? por quê não? quais modos de jogo?
   *  Usado tanto pra montar o `HandFan` quanto no `onPeek` dele (Fase D). */
  function describeHandCard(c: CardInstance) {
    const isCommand = c.def.cardType === "COMMAND";
    const isDual = isCommand && !!c.def.pilotMode;
    const modes = handPlayModes(c);
    const playable = modes.length > 0;
    const ctx = playabilityCtx();
    const shortOnResources = ctx.activeResources < (c.def.cost ?? 0);
    const shortOnLevel = ctx.totalResources < (c.def.level ?? 0);
    const blockedReason = playable
      ? undefined
      : shortOnLevel
        ? `Nível insuficiente — precisa de ${c.def.level} recursos em campo.`
        : shortOnResources
          ? `Recursos insuficientes — custo ${c.def.cost}, você tem ${ctx.activeResources} ativos.`
          : isDual
            ? "Nem o modo Comando nem o modo Piloto estão disponíveis agora."
            : isCommand
              ? "Esta Command não tem gatilho disponível agora."
              : c.def.cardType === "PILOT" || c.def.pilotMode
                ? (ctx.myTurnMain ? "Nenhuma Unit amiga sem Piloto pra parear." : notMainPhaseReason)
                : notMainPhaseReason;
    return { modes, playable, blockedReason };
  }

  /** Índices dos shields de `player` que estão na seleção atual (adapter: a página
   *  seleciona por instanceId, o `ShieldRail` é index-based). */
  function selectedShieldIndexes(player: ViewPlayerState): number[] {
    return player.shields
      .map((s, i) => (selected.includes(s.instanceId) ? i : -1))
      .filter((i) => i >= 0);
  }

  /** Versos da mão do oponente (leitura de contagem, no topo da zona dele). */
  function opponentHandBacks(count: number) {
    return (
      <div className="flex items-center gap-2">
        <p className="shrink-0 text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">Mão ({count})</p>
        <div className="flex">
          {Array.from({ length: Math.min(count, 10) }).map((_, i) => (
            <img
              key={i}
              src={cardBackUrl}
              alt=""
              loading="lazy"
              className="-ml-3 aspect-[63/88] w-7 border border-white/10 object-cover first:ml-0"
            />
          ))}
        </div>
      </div>
    );
  }

  /** Monta o `ArenaSide` de um jogador pro `ArenaPlaymat` (Sprint 4). A página segue
   *  só decidindo QUEM é alvo legal do quê; o layout é do `ArenaPlaymat`. */
  function arenaSide(pid: PlayerId, isSelf: boolean): ArenaSide {
    const player = view.players[pid];
    const base = (player.baseSection.find((c) => !isHidden(c)) as CardInstance | undefined) ?? null;
    const deckCount = player.counts.deck;
    const resources = (player.resourceArea.filter((c) => !isHidden(c)) as CardInstance[]).map((r) => ({
      instanceId: r.instanceId,
      rested: r.rested,
      isEx: r.def.isToken ?? false,
      code: r.def.code,
    }));

    return {
      shields: (
        <ShieldRail
          orientation="vertical"
          count={player.counts.shields}
          selectable={selecting}
          selectedIndexes={selectedShieldIndexes(player)}
          onSelectIndex={(i) => {
            const s = player.shields[i];
            if (s) toggleSelect(s.instanceId);
          }}
        />
      ),
      base: (
        <BaseCardGauge
          base={base}
          art={art}
          legalTarget={selecting && Boolean(base)}
          selected={Boolean(base && selected.includes(base.instanceId))}
          onSelect={(b) => toggleSelect(b.instanceId)}
          onInspect={setInspect}
          onHoverCard={isWide ? setHoveredCard : undefined}
        />
      ),
      // Deck de Recursos + a linha de recursos, juntos e centrados abaixo/acima
      // da Battle Area (o `ArenaPlaymat` centraliza este bloco no teatro).
      resources: (
        <div className="flex items-end justify-center gap-2">
          <CounterChip variant="stack" label="Deck de Recursos" count={player.counts.resourceDeck} hideCount={!isSelf} />
          <ResourceMeter
            resources={resources}
            level={player.counts.resourceArea}
            art={art}
            readOnly={!isSelf}
            selectable={isSelf && Boolean(pending) && pendingCost > 0}
            selectedIds={isSelf ? selectedResources : undefined}
            onSelect={isSelf ? toggleResource : undefined}
            costProgress={
              isSelf && pending && pendingCost > 0 ? { paid: selectedResources.length, total: pendingCost } : undefined
            }
          />
        </div>
      ),
      deck: (
        <CounterChip
          variant="stack"
          label="Deck"
          count={deckCount}
          hideCount={!isSelf}
          tone={deckCount <= 2 ? "crit" : deckCount <= 5 ? "warn" : "normal"}
        />
      ),
      trash: (
        <PileTray
          label="Trash"
          count={player.trash.length}
          cards={player.trash.filter((c) => !isHidden(c)) as CardInstance[]}
          art={art}
          onInspect={setInspect}
        />
      ),
      exile: (
        <PileTray
          label="Exílio"
          count={player.exile.length}
          cards={player.exile.filter((c) => !isHidden(c)) as CardInstance[]}
          art={art}
          onInspect={setInspect}
        />
      ),
      battleRow: renderBattleSlots(player, isSelf),
      battleAreaRef: board.register(playerAreaKey(pid)),
      handSummary: isSelf ? undefined : opponentHandBacks(player.hand.length),
    };
  }

  // Mão própria (sem cartas ocultas) — alimenta o `HandFan` ancorado no rodapé da arena.
  const myHandCards = (view.players[seat].hand as ViewCardInstance[]).filter((c) => !isHidden(c)) as CardInstance[];

  const attacker = attackerId
    ? findPublicCard(view, attackerId)
    : combat
      ? findPublicCard(view, combat.attackerId)
      : null;
  const combatTargetUnit =
    combat && typeof combat.currentTarget === "object" ? findPublicCard(view, combat.currentTarget.unitId) : null;

  // Fase B (plano visual §03) — os ~7 cards de decisão centralizados + o flash de fase
  // viram UM `ActionDock` fixo no canto. Precedência: o 1º que casar vence (1 state por vez).
  // `matchView` já foi estreitado pelo guard de loading acima, mas o narrowing não
  // atravessa pra dentro da função aninhada — daí a leitura hoistada.
  const dockAutoPass = matchView.autoPassActionStep;

  // Sprint 6 · PROMPT 1 — dica dinâmica: parear um Piloto cujo 【When Paired】
  // (ou o da Unit escolhida) exige alvo pede um 2º clique numa Unit inimiga.
  const pendingDeployHint: string | undefined = (() => {
    if (pending?.kind !== "deploy" || !pendingCard) return undefined;
    const isPilot = pendingCard.def.cardType === "PILOT" || !!pendingCard.def.pilotMode;
    if (!isPilot) return undefined;
    const selectedOwnUnitCodes = (view.players[seat].battleArea.filter((c) => !isHidden(c)) as CardInstance[])
      .filter((u) => u.def.cardType === "UNIT" && selected.includes(u.instanceId))
      .map((u) => u.def.code);
    const needs =
      pairingNeedsExtraTarget(pendingCard.def.code) ||
      selectedOwnUnitCodes.some((code) => pairingNeedsExtraTarget(undefined, code));
    return needs
      ? "Escolha a Unit pra parear e confirme — o 【When Paired】 (alvo) é resolvido logo depois do vínculo."
      : undefined;
  })();

  function computeDockState(): ActionDockState {
    if (gameOverResult) {
      return { kind: "gameOver", won: gameOverResult.won, reasonLabel: gameOverResult.reasonLabel, redirectSeconds: redirectSecondsLeft };
    }
    if (pending) {
      const verb =
        pending.kind === "deploy"
          ? "Jogando"
          : pending.kind === "activateAbility"
            ? "Ativando habilidade"
            : `Jogando Command (${pending.trigger})`;
      const hint =
        pending.kind === "activateAbility"
          ? pending.abilityNeedsTarget
            ? "Escolha o alvo da habilidade e os recursos pra pagar o custo."
            : "Escolha os recursos pra pagar o custo e confirme."
          : (pendingDeployHint ?? "Se pedir alvo/pareamento, clique nas cartas do tabuleiro.");
      return {
        kind: "pending",
        verb,
        cardName: pending.kind === "activateAbility" ? pending.cardName : pendingCard?.def.nameEn,
        selectedCount: selected.length,
        hint,
        cost: pendingCost > 0 ? { paid: selectedResources.length, total: pendingCost } : null,
        canConfirm: !(pendingCost > 0 && !resourcesReady),
      };
    }
    if (attackerId) return { kind: "attacking", attackerName: attacker?.def.nameEn ?? attackerId };
    if (iAmDefending) return { kind: "defending" };
    if (inActionStep) {
      const ctx = playabilityCtx();
      const hasPlay = myHandCards.some((c) => playableModes(c.def, ctx).includes("commandAction"));
      return { kind: "actionStep", scope: iHavePriority ? "combat" : "endPhase", autoPass: dockAutoPass, hasPlay };
    }
    // Só domina o dock quando você NÃO é quem deve agir — na sua Main Phase o dock
    // mostra "Encerrar turno" (o servidor cuida do oponente ausente sozinho).
    if (canClaimAbandon && !myTurnMain) return { kind: "abandonAvailable", idleSeconds: opponentIdleSeconds ?? 0 };
    if (oppPendingDecision) {
      return {
        kind: "oppDecision",
        label: `Aguardando o oponente resolver ${oppPendingDecision.kind === "burst" ? "um 【Burst】" : "uma decisão"}...`,
      };
    }
    return {
      kind: "idle",
      yourTurn: myTurnMain,
      phaseLabel: PHASE_LABEL[view.phase] ?? view.phase,
      timerSeconds: turnSecondsLeft,
    };
  }

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

      {/* Sprint 4/6 (redesenho "Nível Arena") — o board é UM `ArenaPlaymat`
          travado em 16:9. Em telas largas (> 1400px) o espaço lateral que sobra
          vira asa: o inspetor de carta CRESCE (`flex-1`) pra preencher a
          esquerda, e um espelho `flex-1` invisível à direita mantém a arena
          centrada. */}
      <div className="relative flex min-h-0 flex-1 items-stretch justify-center gap-3 overflow-hidden px-1 sm:px-3 py-2">
        {isWide ? (
          <CardInspectorPanel
            card={hoveredCard}
            art={art}
            inPlay
            className="min-w-0 max-w-[22rem] flex-1 self-center max-h-full overflow-hidden"
          />
        ) : null}
        <div className="flex min-w-0 shrink-0 justify-center">
          <ArenaPlaymat
            opponent={arenaSide(opponentSeat, false)}
            self={arenaSide(seat, true)}
            hand={
              <HandFan
                anchored
                cards={myHandCards.map((c) => {
                  const { playable, blockedReason } = describeHandCard(c);
                  return { card: c, playable, blockedReason };
                })}
                art={art}
                onPeek={(c) => {
                  const { modes, blockedReason } = describeHandCard(c);
                  // "Jogar" (Sprint 5) — modo único: joga direto (o ActionDock guia alvo/custo).
                  if (modes.length === 1) {
                    modes[0].run();
                    return;
                  }
                  // Injogável: só avisa o motivo (use "Ver" pra abrir a arte).
                  if (modes.length === 0) {
                    toast(blockedReason ?? "Carta indisponível agora.");
                    return;
                  }
                  // Carta dual (Comando vs Piloto): modal só pra escolher o modo.
                  setPreview({ card: c, blockedReason, modes });
                }}
                onViewCard={(c) => {
                  // "Ver" (Sprint 6 · P3) — abre a modal de zoom pra leitura; se
                  // a carta for jogável, o footer de ação continua disponível.
                  const { modes, blockedReason } = describeHandCard(c);
                  setPreview({ card: c, blockedReason, modes });
                }}
                onHoverCard={isWide ? setHoveredCard : undefined}
              />
            }
          />
        </div>
        {/* espelho da asa esquerda — mantém a arena centrada quando o inspetor cresce */}
        {isWide ? <div className="min-w-0 max-w-[22rem] flex-1" aria-hidden /> : null}
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

      {/* Inspetor de carta (zoom) -- da mão (modal só pra carta dual) ou de qualquer carta pública do tabuleiro. */}
      {preview ? (
        <CardInspectorModal
          card={preview.card}
          art={art}
          blockedReason={preview.blockedReason}
          effectText={cardText[preview.card.def.code]}
          linkedPilots={resolveLinkedPilots(preview.card.def)}
          onClose={() => setPreview(null)}
          footer={
            preview.modes.length > 0 ? (
              <>
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
              </>
            ) : undefined
          }
        />
      ) : inspect ? (
        <CardInspectorModal
          card={inspect}
          art={art}
          inPlay
          effectText={cardText[inspect.def.code]}
          linkedPilots={resolveLinkedPilots(inspect.def)}
          onClose={() => setInspect(null)}
        />
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
      {myPendingDecision?.kind === "abilityResolution" ? (
        <AbilityResolutionModal
          decision={myPendingDecision}
          targetsByScope={{
            enemyUnit: publicUnits(view.players[opponentSeat]).map((u) => ({ instanceId: u.instanceId, label: u.def.nameEn })),
            friendlyUnit: publicUnits(view.players[seat]).map((u) => ({ instanceId: u.instanceId, label: u.def.nameEn })),
            ownResource: (view.players[seat].resourceArea.filter((c) => !isHidden(c)) as CardInstance[])
              .filter((r) => r.rested)
              .map((r, i) => ({ instanceId: r.instanceId, label: `Recurso ${i + 1} (gasto)` })),
          }}
          busy={busy}
          onResolve={(resolutions) => runAction({ kind: "resolveAbility", resolutions })}
        />
      ) : null}

      {/* docs/19, Sessão 4 — feed de log de batalha (painel lateral retrátil / gaveta). */}
      <BattleLogDrawer entries={battleLog} open={logOpen} onToggle={() => setLogOpen((o) => !o)} />

      {/* Fase B (plano visual §03) — superfície ÚNICA de "o que faço agora?": substitui
          os cards de decisão centralizados + o flash de fase. Fixo no canto, nunca cobre o board. */}
      <ActionDock
        state={computeDockState()}
        busy={busy}
        logTail={battleLog[battleLog.length - 1]?.text}
        onConfirm={confirmPending}
        onCancel={clearSelection}
        onEndTurn={() => runAction({ kind: "finishTurn" })}
        onDeclareAttackPlayer={() => declareAttack("player")}
        onCancelAttack={() => setAttackerId(null)}
        onSkipBlock={() => runAction({ kind: "skipBlock" })}
        onPass={() => runAction(iHavePriority ? { kind: "passAction" } : { kind: "passEndPhaseAction" })}
        onToggleAutoPass={(next) => toggleAutoPass(next)}
        onClaimAbandon={() => claimAbandon()}
        onLeaveAfterGameOver={leaveMatchScreen}
      />
    </div>
  );

  return (
    <div className="fixed inset-0">
      {content}
      {/* Sprint 4 — celular em retrato: em vez de girar o board via CSS (bugava
          toque/overflow), pede o modo paisagem. */}
      {isPortrait ? <RotateDevicePrompt /> : null}
    </div>
  );
}

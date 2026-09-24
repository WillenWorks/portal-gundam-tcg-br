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
import { AlertTriangle, BrainCircuit, Bug, Maximize2, Minimize2, RefreshCw } from "lucide-react";

import { api, getStoredAuth, type SimulatorMatchView } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useMatchTransport } from "@/modules/simulator/network/useMatchTransport";
import { sfx } from "@/modules/simulator/audio/soundEffects";

import { otherPlayer, hasKeyword, effectiveCost, effectiveLevel, effectivePilotDef, satisfiesLinkCondition, type AttackTarget, type CardDef, type CardInstance, type GameState, type PlayerId, type CombatState } from "@/modules/simulator/engine/types";
import type { PlayerAction } from "@/modules/simulator/engine/actions";
import { playerHasActionStepPlay } from "@/modules/simulator/engine/actions";
import type { HiddenCard, ViewCardInstance, ViewGameState, ViewPlayerState } from "@/modules/simulator/engine/viewState";
import { pairingNeedsExtraTarget, resolveDeploySelection } from "@/modules/simulator/ui/deployIntent";
import { fieldAbilityFor, type FieldAbility } from "@/modules/simulator/ui/abilityIntent";
import { findEligibleSacrifices, playableModes, type PlayabilityContext } from "@/modules/simulator/ui/handPlayability";
import { getScaledDuration } from "@/modules/simulator/ui/animationSettings";
import {
  handleOpponentCommandCast,
  shouldAnimateAttackStrike,
  shouldWaitForBurstReveal,
} from "@/modules/simulator/ui/viewAnimationQueue";
import { ALL_EFFECT_SPECS, defaultTargetFilterResolver } from "@/modules/simulator/content";
import { computeLegalTargets, specNeedsNamedTarget } from "@/modules/simulator/engine/effectSpec";
import { findTriggerSpecs } from "@/modules/simulator/engine/dispatcher";
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
  BurstRevealStage,
  cardBackUrl,
  CardDepartureAnimation,
  type DepartingCard,
  CardInspectorModal,
  CardInspectorPanel,
  CenterDecisionModal,
  type LinkedPilot,
  CombatLane,
  CommandCastAnimation,
  CounterChip,
  DeckDealAnimation,
  type DeckDealMode,
  HandFan,
  PhaseAnnouncementBanner,
  PileTray,
  playerAreaKey,
  playerShieldKey,
  ResourceMeter,
  RotateDevicePrompt,
  ShieldRail,
  TriggerOrderModal,
  useBoardElements,
  AbilityResolutionModal,
  pickSingleTarget,
  pickSecondaryTarget,
  toggleMultiTarget,
  usesBoardTargetingForPrimary,
  usesBoardTargetingForSecondary,
  ZoneOverflowModal,
  BugReportModal,
  GameOverOverlay,
  gameOverReasonLabel,
  MatchPrompt,
  SettingsMenu,
  MulliganModal,
  FirstPlayerReveal,
  SideboardModal,
  ZeroCoachHud,
} from "@/modules/simulator/ui";

const PHASE_LABEL: Record<string, string> = { start: "Manutenção", draw: "Compra", resource: "Recurso", main: "Principal", end: "Final" };
const ART_SET_CODES = ["ST01", "ST02", "ST03", "ST04", "ST05", "GD01"];
/** Só pra resolver a arte de recursos/EX/tokens genéricos que não estejam em ART_SET_CODES. */
const GENERIC_ART_SET_CODES: string[] = [];
/** Código do motor -> código do catálogo (arte canônica). */
const ART_CODE_ALIASES: Record<string, string> = {
  "ST01-RESOURCE": "R-001",
  "ST02-RESOURCE": "R-001",
  "ST03-RESOURCE": "R-001",
  "ST04-RESOURCE": "R-001",
  "ST05-RESOURCE": "R-001",
  "RESOURCE-01": "R-001",
  "TOKEN-EX-BASE": "EXB-001",
  "TOKEN-EX-RESOURCE": "EXR-001",
};
/** Espelha `ABANDON_THRESHOLD_MS` do servidor (matchStore.ts) -- só usado aqui pra habilitar o botão na hora certa; quem decide de verdade é sempre o servidor. */
const ABANDON_THRESHOLD_MS = 180_000;
/** Retrato + tela pequena: em vez de girar o board via CSS (bugava toque/overflow),
 *  mostramos o `RotateDevicePrompt` pedindo o modo paisagem (Sprint 4). */
const PORTRAIT_QUERY = "(max-width: 900px) and (orientation: portrait)";
/** A partir daqui há folga lateral pras asas (inspetor de carta + log). */
const WIDE_QUERY = "(min-width: 1400px)";
/** faixa "mobile" — solta a trava de 16:9 do canvas (o tabuleiro usa toda a
 *  área entre o topo e o `ActionDock` em vez de sobrar espaço e encolher). */
const MOBILE_QUERY = "(max-width: 1023px)";
/** Rota pra onde "Sair"/fim de jogo devolvem o jogador (a "Minha Área" do portal, com o shell/nav normal). */
const EXIT_ROUTE = "/portal";
/** Ao encerrar a partida (fim de jogo por qualquer motivo), o jogador é levado de volta ao site depois disso. */
const GAME_OVER_REDIRECT_MS = 8_000;
/** "Nova leva de correções" (item 3, plano v2) — rede de segurança da fila de
 *  reprodução de views: se uma animação (lunge de ataque, revelação de Burst)
 *  nunca chamar seu callback de conclusão por causa de algum bug, a fila força
 *  o avanço pro próximo item em vez de travar a partida pra sempre. NÃO é
 *  escalada por `getScaledDuration` — é uma rede de segurança contra bug, não
 *  uma duração de animação de verdade (não deve variar com a velocidade
 *  escolhida pelo jogador). */
const VIEW_QUEUE_ITEM_TIMEOUT_MS = 5_000;

function isHidden(card: ViewCardInstance): card is HiddenCard {
  return "hidden" in card && (card as HiddenCard).hidden === true;
}

/** Frente 4 (feedback Willen 4ª rodada) — rótulos da `DeckDealAnimation` ligada
 *  ao fluxo real (compra inicial / mulligan / montagem de escudos). */
const SETUP_ANIM_LABEL: Record<DeckDealMode, string> = {
  shuffle: "Embaralhando…",
  "deal-hand": "Comprando a mão inicial…",
  mulligan: "Refazendo a mão (Mulligan)…",
  "deal-shields": "Montando os escudos…",
  "single-draw": "Comprando…",
};

/** centro (viewport px) de um `DOMRect`, ou `null`. */
function rectCenter(r: DOMRect | null): { x: number; y: number } | null {
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

function deckCenter(r: DOMRect | null, mirrored = false): { x: number; y: number } | null {
  if (!r) return null;
  const x = r.left + r.width / 2;
  const y = mirrored ? r.top + r.height * 0.2 : r.bottom - r.height * 0.2;
  return { x, y };
}

/** centro da primeira carta de escudo dentro da trilha ShieldRail */
function shieldRailCenter(r: DOMRect | null): { x: number; y: number } | null {
  if (!r) return null;
  const cardH = Math.round(r.width * (88 / 63));
  return {
    x: r.left + r.width / 2,
    y: r.top + cardH / 2,
  };
}

/** centro da carta central da mão dentro da prateleira HandFan */
function handCenter(r: DOMRect | null, cardW?: number | null): { x: number; y: number } | null {
  if (!r) return null;
  const w = cardW && cardW > 0 ? cardW : 84;
  const cardH = Math.round(w * (88 / 63));
  return {
    x: r.left + r.width / 2,
    y: r.bottom - 4 - cardH / 2,
  };
}

/**
 * View já saiu da preparação (mulligan). `Phase` não tem valor "setup" — a
 * preparação é só o período com mulligan pendente em algum assento.
 */
function isPostSetupView(view: ViewGameState): boolean {
  return view.pendingDecision.A?.kind !== "mulligan" && view.pendingDecision.B?.kind !== "mulligan";
}

/**
 * Banners de encerramento do turno anterior, mostrados na virada de turno. O
 * turno só muda depois que o Action Step da End Phase terminou com os dois
 * jogadores passando (`passEndPhaseAction` -> `END_END_PHASE_ACTION_STEP` ->
 * `finishEndPhaseAndAdvance`), então "FIM DE TURNO" aqui é fato público — o
 * cliente não precisa (nem pode) saber se o oponente tinha jogada. Se a view
 * anterior já estava na End Phase, "FASE DE AÇÕES" já foi anunciada pelo
 * efeito da End Phase; senão (auto-pass dos dois resolvido inteiro no
 * servidor numa resposta só) ela é anunciada aqui, antes do fim.
 */
export function endOfTurnBanners(prevView: ViewGameState): string[] {
  const actionStepAlreadyAnnounced = prevView.phase === "end" || prevView.endPhaseAction !== null;
  return actionStepAlreadyAnnounced ? ["FIM DE TURNO"] : ["FASE DE AÇÕES", "FIM DE TURNO"];
}

export function buildTurnStagedViews(
  prevView: ViewGameState,
  incoming: SimulatorMatchView,
): {
  viewAnnounced: SimulatorMatchView;
  viewRecovery: SimulatorMatchView;
  viewDraw: SimulatorMatchView;
  viewMain: SimulatorMatchView;
} {
  const active = incoming.view.activePlayer;
  const prevActivePlayer = prevView.players[active];
  const incomingActivePlayer = incoming.view.players[active];

  // 1. viewAnnounced: mantém as unidades descansadas (rested) e mão/deck do turno anterior
  const viewAnnounced: SimulatorMatchView = {
    ...incoming,
    view: {
      ...incoming.view,
      phase: "start",
      players: {
        ...incoming.view.players,
        [active]: {
          ...incomingActivePlayer,
          battleArea: prevActivePlayer.battleArea,
          baseSection: prevActivePlayer.baseSection,
          resourceArea: prevActivePlayer.resourceArea,
          hand: prevActivePlayer.hand,
          deck: prevActivePlayer.deck,
          counts: {
            ...incomingActivePlayer.counts,
            hand: prevActivePlayer.counts.hand,
            deck: prevActivePlayer.counts.deck,
          },
        },
      },
    },
  };

  // 2. viewRecovery: unidades destombam (rested: false), mas a mão/deck continuam antes da compra
  const viewRecovery: SimulatorMatchView = {
    ...incoming,
    view: {
      ...incoming.view,
      phase: "start",
      players: {
        ...incoming.view.players,
        [active]: {
          ...incomingActivePlayer,
          battleArea: prevActivePlayer.battleArea.map((c) => (isHidden(c) ? c : { ...c, rested: false })),
          baseSection: prevActivePlayer.baseSection.map((c) => (isHidden(c) ? c : { ...c, rested: false })),
          resourceArea: prevActivePlayer.resourceArea.map((c) => (isHidden(c) ? c : { ...c, rested: false })),
          hand: prevActivePlayer.hand,
          deck: prevActivePlayer.deck,
          counts: {
            ...incomingActivePlayer.counts,
            hand: prevActivePlayer.counts.hand,
            deck: prevActivePlayer.counts.deck,
          },
        },
      },
    },
  };

  // 3. viewDraw: mão recebe a carta recém-comprada de incomingView, deck decrementa
  const viewDraw: SimulatorMatchView = {
    ...incoming,
    view: {
      ...incoming.view,
      phase: "draw",
      players: {
        ...incoming.view.players,
        [active]: {
          ...incomingActivePlayer,
          battleArea: prevActivePlayer.battleArea.map((c) => (isHidden(c) ? c : { ...c, rested: false })),
          baseSection: prevActivePlayer.baseSection.map((c) => (isHidden(c) ? c : { ...c, rested: false })),
          resourceArea: prevActivePlayer.resourceArea.map((c) => (isHidden(c) ? c : { ...c, rested: false })),
          hand: incomingActivePlayer.hand,
          deck: incomingActivePlayer.deck,
          counts: incomingActivePlayer.counts,
        },
      },
    },
  };

  // 4. viewMain: visão completa pós-recursos e Main Phase
  const viewMain = incoming;

  return { viewAnnounced, viewRecovery, viewDraw, viewMain };
}

export function buildTurn1StagedViews(current: SimulatorMatchView): {
  viewAnnounced: SimulatorMatchView;
  viewRecovery: SimulatorMatchView;
  viewDraw: SimulatorMatchView;
  viewMain: SimulatorMatchView;
} {
  const active = current.view.activePlayer;
  const pState = current.view.players[active];
  const handBeforeDraw = pState.hand.slice(0, 5);
  const countsBeforeDraw = {
    ...pState.counts,
    hand: Math.min(5, pState.counts.hand),
    deck: pState.counts.deck + (pState.hand.length > 5 ? 1 : 0),
  };

  const viewBeforeDraw: SimulatorMatchView = {
    ...current,
    view: {
      ...current.view,
      phase: "start",
      players: {
        ...current.view.players,
        [active]: {
          ...pState,
          hand: handBeforeDraw,
          counts: countsBeforeDraw,
        },
      },
    },
  };

  const viewDraw: SimulatorMatchView = {
    ...current,
    view: {
      ...current.view,
      phase: "draw",
    },
  };

  return {
    viewAnnounced: viewBeforeDraw,
    viewRecovery: viewBeforeDraw,
    viewDraw,
    viewMain: current,
  };
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
  /** code -> { pt, en } do efeito — o CardDef do motor não carrega isso. O inspetor
   *  mostra PT por padrão e um toggle PT/EN quando os dois vêm e diferem. */
  cardText: Record<string, { pt?: string; en?: string }>;
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
        const cardText: Record<string, { pt?: string; en?: string }> = {};
        const cardByName: Record<string, { code: string; art: CardArt }> = {};
        for (const list of results as RawApiCard[][]) {
          for (const raw of list) {
            if (!raw?.code) continue;
            const entry: CardArt = {
              imageUrl: raw.imageMediumUrl ?? raw.imageUrl,
              imageSmallUrl: raw.imageSmallUrl ?? raw.imageMediumUrl ?? raw.imageUrl,
            };
            art[raw.code] = entry;
            if (raw.effectPt || raw.effectEn) {
              cardText[raw.code] = { pt: raw.effectPt || undefined, en: raw.effectEn || undefined };
            }
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
  | { kind: "deploy" | "command"; cardInstanceId: string; trigger?: "Main" | "Action"; sacrificeInstanceId?: string }
  /** 【Activate·Main】 de carta em campo (Etapa 3) — `cardInstanceId` = a carta em campo. */
  | { kind: "activateAbility"; cardInstanceId: string; abilityCost: number; abilityNeedsTarget: boolean; cardName: string };
/** Um jeito de jogar a carta em preview. Cards Command/Pilot (`def.pilotMode`) têm 2 modos ("Jogar como Comando" / "Jogar como Piloto"); o resto tem 1. */
type HandPlayMode = { label: string; run: () => void };
/** Preview compacto aberto ao clicar numa carta da mão -- substitui o antigo botão "Jogar" minúsculo. */
type HandPreview = { card: CardInstance; blockedReason?: string; modes: HandPlayMode[] };

export default function SimulatorMatchPage({ matchId }: { matchId: string }) {
  const [, setLocation] = useLocation();
  const [matchView, setMatchView] = useState<SimulatorMatchView | null>(null);
  /** offset de relógio servidor↔cliente (`serverNow - Date.now()`) — corrige skew no countdown/idle. */
  const clockOffsetRef = useRef(0);
  /** limiares de aviso do timer de turno já disparados NESTE prazo (reseta quando `turnDeadlineAt` muda). */
  const turnWarningsRef = useRef<{ deadline: number | null; fired: Set<number> }>({ deadline: null, fired: new Set() });
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  /** "Nova leva de correções" (item 4, plano v2) — alvo(s) de uma decisão
   *  `abilityResolution` em andamento (ex.: ST05-010 Mikazuki Augus), agora
   *  controlado aqui (não mais dentro do `AbilityResolutionModal`) porque o
   *  clique direto na Unit no tabuleiro (glow inline) precisa escrever no
   *  MESMO estado que o modal lê — se cada um tivesse sua própria cópia,
   *  clicar no tabuleiro não refletiria no modal (e vice-versa). specId →
   *  lista de instanceIds selecionados; `abilityActivate` é o toggle
   *  Ativar/Pular de cada item da fila (default `true`, só relevante pra
   *  efeitos `optional`). */
  const [abilityTargets, setAbilityTargets] = useState<Record<string, string[]>>({});
  const [abilitySecondaryTargets, setAbilitySecondaryTargets] = useState<Record<string, string[]>>({});
  const [abilityActivate, setAbilityActivate] = useState<Record<string, boolean>>({});
  /** assinatura (specIds concatenados) da última decisão `abilityResolution`
   *  vista — só reseta os 3 estados acima quando essa assinatura MUDA (nova
   *  decisão), não a cada `matchView` novo (ping/relógio geram views novas
   *  sem trocar de decisão, e resetar ali apagaria a seleção no meio do clique). */
  const abilityDecisionSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    const decision = matchView?.view.pendingDecision[matchView.seat];
    const signature = decision?.kind === "abilityResolution" ? decision.queue.map((q) => q.specId).join(",") : null;
    if (signature === abilityDecisionSignatureRef.current) return;
    abilityDecisionSignatureRef.current = signature;
    setAbilityTargets({});
    setAbilitySecondaryTargets({});
    setAbilityActivate(
      signature && decision?.kind === "abilityResolution"
        ? Object.fromEntries(decision.queue.map((q) => [q.specId, true]))
        : {},
    );
  }, [matchView]);
  /** instanceIds dos Recursos ativos escolhidos pra restar/pagar o custo da carta em `pending` (seleção manual — 2026-09-01). */
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [preview, setPreview] = useState<HandPreview | null>(null);
  /** docs/54 tarefa 5 — carta híbrida (Piloto/Comando) clicada em "Jogar": em vez do
   *  modal de inspeção inteiro, um seletor compacto no topo pergunta o modo. */
  const [handModeChoice, setHandModeChoice] = useState<{ card: CardInstance; modes: HandPlayMode[] } | null>(null);
  /** carta de tabuleiro aberta no inspetor (zoom, modal) — clique explícito. */
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  /** carta sob o cursor/foco — alimenta o `CardInspectorPanel` das asas largas (Sprint 3/4). */
  const [hoveredCard, setHoveredCard] = useState<CardInstance | null>(null);
  /** V6.1 (docs/32) — botão "Expandir tabuleiro" no widescreen: esconde o
   *  Detalhes da Carta (asas laterais) e deixa a arena usar a largura toda,
   *  com --card-w mais generoso. Só faz sentido quando `isWide` já mostra as
   *  asas — reseta sozinho se a tela deixar de ser wide (guard no render). */
  const [boardExpanded, setBoardExpanded] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  /** ZERO SYSTEM — Assistente Tático In-Game (Atalho 'Z'). */
  const [zeroCoachOpen, setZeroCoachOpen] = useState(false);
  /** docs/44 Fase 3 §5.1 — modal de bug report ("Reportar situação"). `code` != null = já enviado, mostra o BUG-XXXXXX. */
  const [bugReport, setBugReport] = useState<{ open: boolean; busy: boolean; code: string | null }>({ open: false, busy: false, code: null });

  // Atalho de teclado 'Z' para alternar o Zero Coach HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        setZeroCoachOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  /** Feedback.pdf §5 — erro de JOGADA (jogada ilegal, custo/alvo faltando) numa
   *  faixa própria no topo-centro, FORA da área do log e do `ActionDock`. Some
   *  sozinho. Erros de SISTEMA (conexão, W.O., auto-pass) seguem em `toast`. */
  const [actionError, setActionError] = useState<string | null>(null);
  const actionErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** instante em que o redirecionamento pós-fim-de-jogo dispara (pra mostrar a contagem regressiva). */
  const [redirectAt, setRedirectAt] = useState<number | null>(null);
  /** Frente 4 (feedback Willen 4ª rodada) — animação de setup em curso. `null` = nenhuma. */
  const [setupAnim, setSetupAnim] = useState<DeckDealMode | null>(null);
  /** snapshot da rodada anterior pra detectar "o que aconteceu neste tick" e tocar efeitos. */
  const setupSnapshotRef = useRef<{
    turnNumber: number;
    activePlayer: PlayerId;
    handLen: number;
    shields: number;
    oppShields: number;
    mulliganPending: boolean;
  } | null>(null);
  /** instanceIds de Unit que JÁ tocaram a animação de deploy — flag transiente */
  const deployedSeenRef = useRef<Set<string>>(new Set());

  const board = useBoardElements(); // refs de tabuleiro pra linha de mira e vetores de ataque

  const { art, artLoading, cardText, cardByName } = useCardArtLookup();
  const isPortrait = useMediaQuery(PORTRAIT_QUERY);
  const isWide = useMediaQuery(WIDE_QUERY);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  // Estados do Sequenciador de Abertura Tática
  const [introStage, setIntroStage] = useState<
    | "field-ready"
    | "player-choice"
    | "field-highlight"
    | "deck-appear"
    | "deck-shuffle"
    | "deal-hand"
    | "hand-revealed"
    | "mulligan-decision"
    | "waiting-opponent-mulligan"
    | "mulligan-anim"
    | "deal-shields"
    | "phase-banner"
    | "complete"
  >("field-ready");
  const introInitializedRef = useRef(false);
  const mulliganDidMulliganRef = useRef(false);
  const introStageRef = useRef(introStage);
  introStageRef.current = introStage;
  const introStageResolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (introStage === "complete") {
      introStageResolveRef.current?.();
      introStageResolveRef.current = null;
    }
  }, [introStage]);

  const [phaseBannerQueue, setPhaseBannerQueue] = useState<string[]>([]);
  const phaseBannerQueueRef = useRef<string[]>([]);
  phaseBannerQueueRef.current = phaseBannerQueue;
  const phaseBannerResolveRef = useRef<(() => void) | null>(null);

  const enqueuePhaseBanners = useCallback((banners: string[]) => {
    setPhaseBannerQueue((prev) => {
      const next = [...prev, ...banners];
      phaseBannerQueueRef.current = next;
      return next;
    });
  }, []);

  const waitForPhaseBanners = useCallback(() => {
    if (phaseBannerQueueRef.current.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const prev = phaseBannerResolveRef.current;
      phaseBannerResolveRef.current = () => {
        prev?.();
        resolve();
      };
      // Timeout de segurança proporcional à fila pra nunca travar
      const safetyMs = Math.max(3500, phaseBannerQueueRef.current.length * 1200);
      setTimeout(resolve, safetyMs);
    });
  }, []);

  interface TurnStagedViews {
    actingPlayer: PlayerId;
    viewRecovery: SimulatorMatchView;
    viewDraw: SimulatorMatchView;
    viewMain: SimulatorMatchView;
  }
  const turnStagedViewsRef = useRef<TurnStagedViews | null>(null);

  // Confirmação explícita de encerramento de turno sob demanda (não trava a tela no idle)
  const [showEndTurnConfirm, setShowEndTurnConfirm] = useState(false);

  // docs/56 tarefa 1 — clones voando pro Trash/Exílio (detectados por diff em
  // `applyIncomingView`, autolimpos via `onDone`). `prevDepartureViewRef`
  // guarda a ÚLTIMA view aplicada só pra esse diff (independente do
  // `prevCombatRef`, que serve à coreografia de ataque).
  const [departures, setDepartures] = useState<DepartingCard[]>([]);
  const prevDepartureViewRef = useRef<ViewGameState | null>(null);

  // Combate tático sequencial pós-fase de ação: avanço -> som/impacto -> retorno -> dano
  const [activeStrike, setActiveStrike] = useState<{
    attackerId: string;
    towardX: number;
    towardY: number;
    phase: "advance" | "strike" | "return";
    /** docs/55 tarefa 5 — quando o alvo é o jogador, qual lado treme/pisca no impacto (fase "strike"). */
    shieldsOf?: PlayerId;
  } | null>(null);
  const prevCombatRef = useRef<CombatState | null>(null);

  // "Nova leva de correções" — revelação cinemática do 【Burst】: guarda o
  // `cardInstanceId` da última decisão de Burst cuja animação de revelação já
  // rodou. Enquanto `myBurstDecision.cardInstanceId` (calculado mais abaixo)
  // for diferente disto, mostramos o `BurstRevealStage` em vez do `BurstModal`.
  const [burstRevealedId, setBurstRevealedId] = useState<string | null>(null);
  // Espelha `burstRevealedId` num ref (lido de dentro de `processIncomingView`,
  // que não pode depender do valor de state "congelado" do fechamento do
  // `useCallback` — precisa do valor mais recente a cada view processada).
  const burstRevealedIdRef = useRef<string | null>(null);
  useEffect(() => {
    burstRevealedIdRef.current = burstRevealedId;
  }, [burstRevealedId]);
  // "Nova leva de correções" (item 3, plano v2) — ponte entre a fila de views
  // (assíncrona, dentro de `processIncomingView`) e o `BurstRevealStage`
  // (disparado pelo RENDER, não por essa função): quando a view processada
  // introduz um Burst ainda não revelado, a fila registra aqui um resolver e
  // ESPERA — o efeito abaixo dispara esse resolver assim que `burstRevealedId`
  // alcançar o `cardInstanceId` esperado (ou o timeout de segurança estoura).
  const burstRevealWaiterRef = useRef<{ cardInstanceId: string; resolve: () => void } | null>(null);
  useEffect(() => {
    const waiter = burstRevealWaiterRef.current;
    if (waiter && waiter.cardInstanceId === burstRevealedId) {
      burstRevealWaiterRef.current = null;
      waiter.resolve();
    }
  }, [burstRevealedId]);
  const waitForBurstReveal = useCallback((cardInstanceId: string): Promise<void> => {
    return new Promise((resolve) => {
      burstRevealWaiterRef.current = { cardInstanceId, resolve };
      // Rede de segurança (docs/plano v2, item 3): se o `BurstRevealStage` nunca
      // chamar `onDone` por algum bug, a fila não pode travar pra sempre.
      setTimeout(() => {
        if (burstRevealWaiterRef.current?.cardInstanceId === cardInstanceId) {
          console.warn(`[simulador] BurstRevealStage de ${cardInstanceId} não terminou a tempo — liberando a fila.`);
          burstRevealWaiterRef.current = null;
          resolve();
        }
      }, VIEW_QUEUE_ITEM_TIMEOUT_MS);
    });
  }, []);

  // Resolver para pausar a drenagem de views enquanto o jogador decide o Burst
  const burstDecisionResolveRef = useRef<(() => void) | null>(null);

  // Se a decisão de burst for resolvida ou sumir do matchView, garante que a fila desocupe
  useEffect(() => {
    const decision = matchView?.view.pendingDecision[matchView.seat];
    if (decision?.kind !== "burst") {
      burstDecisionResolveRef.current?.();
      burstDecisionResolveRef.current = null;
    }
  }, [matchView]);

  // "Nova leva de correções" — lançamento e revelação de Comandos: enquanto
  // não-nulo, `CommandCastAnimation` é renderizado; `commandCastResolveRef`
  // permite ao `runAction` (definido mais abaixo) esperar a animação terminar
  // antes de seguir com o dispatch real, sem precisar transformar isto num
  // `useEffect` separado.
  const [commandCast, setCommandCast] = useState<{
    cardDef: CardDef;
    origin: { x: number; y: number } | null;
    dest: { x: number; y: number } | null;
  } | null>(null);
  const commandCastResolveRef = useRef<(() => void) | null>(null);

  const executeAttackStrike = useCallback(
    async (attackerId: string, currentTarget: AttackTarget, defendingPlayer: PlayerId) => {
      const reduced =
        typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
      const a = board.rectOf(attackerId);
      const tKey = currentTarget === "player" ? playerShieldKey(defendingPlayer) : currentTarget.unitId;
      const t = board.rectOf(tKey) ?? board.rectOf(playerAreaKey(defendingPlayer));
      if (!a || !t || reduced) {
        sfx.playAttackBeam();
        if (currentTarget === "player") sfx.playShieldBurst();
        return;
      }
      const towardX = t.left + t.width / 2 - (a.left + a.width / 2);
      const towardY = t.top + t.height / 2 - (a.top + a.height / 2);

      // 1. Avanço/lunge tático contra o alvo inimigo
      setActiveStrike({ attackerId, towardX, towardY, phase: "advance" });
      await new Promise((r) => setTimeout(r, getScaledDuration(260)));

      // 2. Disparo de feixe / impacto no alvo — ataque direto (jogador) ganha
      // tremor visual na trilha de shields do lado atingido (docs/55 tarefa 5).
      sfx.playAttackBeam();
      if (currentTarget === "player") {
        sfx.playShieldBurst();
      }
      setActiveStrike({
        attackerId,
        towardX,
        towardY,
        phase: "strike",
        shieldsOf: currentTarget === "player" ? defendingPlayer : undefined,
      });
      await new Promise((r) => setTimeout(r, getScaledDuration(220)));

      // 3. Recuo suave de volta para a sua área
      setActiveStrike({ attackerId, towardX, towardY, phase: "return" });
      await new Promise((r) => setTimeout(r, getScaledDuration(280)));

      // 4. Conclui animação
      setActiveStrike(null);
    },
    [board],
  );

  // docs/56 tarefa 1 — detecta cartas que saíram de campo/mão/base DIRETO pro
  // Trash/Exílio nesta atualização. Roda ANTES de qualquer `setMatchView`
  // (inclusive o caminho que atrasa a view pra coreografia de ataque) — a
  // captura de posição (`board.rectOf`) precisa acontecer enquanto o DOM
  // ainda reflete a view ANTERIOR, senão o elemento já sumiu.
  const detectDepartures = useCallback(
    (incoming: SimulatorMatchView) => {
      const prevView = prevDepartureViewRef.current;
      prevDepartureViewRef.current = incoming.view;
      const reduced =
        typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
      if (!prevView || reduced) return;

      const newGhosts: DepartingCard[] = [];
      for (const pid of ["A", "B"] as PlayerId[]) {
        const prevPlayer = prevView.players[pid];
        const curPlayer = incoming.view.players[pid];
        const prevGoneIds = new Set([...prevPlayer.trash, ...prevPlayer.exile].map((c) => c.instanceId));
        const isExileMove = new Set(curPlayer.exile.map((c) => c.instanceId));
        for (const departed of [...curPlayer.trash, ...curPlayer.exile]) {
          if (prevGoneIds.has(departed.instanceId)) continue; // já estava lá antes — não é uma saída nova
          const id = departed.instanceId;
          const wasUnit = prevPlayer.battleArea.some((c) => c.instanceId === id);
          const wasBase = !wasUnit && prevPlayer.baseSection.some((c) => c.instanceId === id);
          const wasOwnHand =
            !wasUnit && !wasBase && pid === incoming.seat && prevPlayer.hand.some((c) => !isHidden(c) && c.instanceId === id);
          // Frente "Nova leva" — shield quebrado indo pro Trash/Exílio (dano de batalha
          // sem Burst, ou Burst recusado): `shields` é sempre `HiddenCard[]` (ver
          // `viewState.ts`), mas o `instanceId` sobrevive à redação, então dá pra casar
          // mesmo sem saber a identidade da carta antes dela virar pública no trash.
          const wasShield = !wasUnit && !wasBase && !wasOwnHand && prevPlayer.shields.some((c) => c.instanceId === id);
          if (!wasUnit && !wasBase && !wasOwnHand && !wasShield) continue; // sem origem conhecida — nada pra animar
          const originKey = wasUnit ? id : wasBase ? playerAreaKey(pid) : wasShield ? `shieldRail:${pid}` : "hand:self";
          const originRect = board.rectOf(originKey);
          if (!originRect) continue;
          const destKey = isExileMove.has(id) ? `exileStation:${pid}` : `trashStation:${pid}`;
          const originCenter = rectCenter(originRect);
          if (!originCenter) continue;
          newGhosts.push({
            id: `${id}-${incoming.version}`,
            origin: originCenter,
            dest: rectCenter(board.rectOf(destKey)),
            cardW: originRect.width,
            kind: wasUnit ? "destroyed" : "discarded",
            code: !isHidden(departed) && (departed as CardInstance).def ? (departed as CardInstance).def.code : undefined,
            nameEn: !isHidden(departed) && (departed as CardInstance).def ? (departed as CardInstance).def.nameEn : undefined,
            cardType: !isHidden(departed) && (departed as CardInstance).def ? (departed as CardInstance).def.cardType : undefined,
            isToken: !isHidden(departed) && (departed as CardInstance).def ? (departed as CardInstance).def.isToken : undefined,
          });
        }
      }
      if (newGhosts.length > 0) {
        setDepartures((cur) => [...cur, ...newGhosts]);
      }
    },
    [board],
  );

  // "Nova leva de correções" (item 3, plano v2) — fila de reprodução
  // serializada. Causa raiz do bot "atropelando" as próprias animações: em
  // modo treino, `settleAutoPasses` (`matchStore.ts`) resolve várias ações do
  // bot de forma síncrona no servidor, e o cliente pode receber várias
  // `match:view_update` quase juntas — sem fila, cada uma processava por
  // conta própria (correndo em paralelo com a animação da anterior), e só a
  // que por acaso encontrava uma promise pendente esperava. Agora TODA view
  // recebida entra numa fila; um único "drenador" processa uma de cada vez,
  // esperando a coreografia INTEIRA daquela transição (lunge de ataque,
  // revelação de Burst) terminar antes de aplicar a próxima.
  //
  // `detectDepartures` (clones voando pro Trash/Exílio) fica DE FORA da
  // espera de propósito: cada ghost já é autocontido (array que cresce,
  // cada item com seu próprio `onDone` que só remove a si mesmo), então pode
  // sobrepor com o próximo item da fila sem corromper nenhum estado
  // compartilhado — travar a fila por causa dele só atrasaria sem necessidade.
  const viewQueueRef = useRef<SimulatorMatchView[]>([]);
  const isDrainingViewQueueRef = useRef(false);
  const hasAppliedFirstViewRef = useRef(false);
  const prevViewForQueueRef = useRef<ViewGameState | null>(null);

  const processIncomingView = useCallback(
    async (incoming: SimulatorMatchView) => {
      if (typeof incoming.serverNow === "number") {
        clockOffsetRef.current = incoming.serverNow - Date.now();
      }

      detectDepartures(incoming);

      // Animação de Comando jogado pelo oponente/bot: deve rodar e esperar antes
      // de setMatchView para que o efeito do Comando na arena só apareça resolvido após o onDone.
      const fallbackCenter = {
        x: typeof window !== "undefined" && window.innerWidth ? window.innerWidth / 2 : 500,
        y: typeof window !== "undefined" && window.innerHeight ? window.innerHeight / 2 : 350,
      };
      const prevView = prevViewForQueueRef.current;
      prevViewForQueueRef.current = incoming.view;

      await handleOpponentCommandCast({
        prevView,
        incomingView: incoming.view,
        viewerSeat: incoming.seat,
        board,
        fallbackCenter,
        animateCommand: ({ cardDef, origin, dest }) =>
          new Promise<void>((resolve) => {
            let timer: ReturnType<typeof setTimeout> | null = null;
            const finish = () => {
              if (timer) clearTimeout(timer);
              setCommandCast(null);
              commandCastResolveRef.current = null;
              resolve();
            };
            commandCastResolveRef.current = finish;
            timer = setTimeout(finish, VIEW_QUEUE_ITEM_TIMEOUT_MS);
            setCommandCast({ cardDef, origin, dest });
          }),
      });

      const prevCombat = prevCombatRef.current;
      prevCombatRef.current = incoming.view.combat;

      // Nova leva de correções — causa raiz real do lunge nunca disparar contra o
      // Bot: em modo treino tanto o assento humano quanto o bot têm
      // `autoPassActionStep: true` (`trainingMatch.ts`), e `settleAutoPasses`
      // (`matchStore.ts`) resolve o Action Step dos DOIS lados de forma síncrona no
      // servidor antes de qualquer resposta chegar aqui — o cliente nunca observa
      // `combat.step === "action"`. Por isso o gatilho não pode depender de um
      // `step` intermediário específico: dispara sempre que o combate do MESMO
      // atacante (attackerId/currentTarget/defendingPlayer já existem desde o
      // passo "attack") deixou de existir, ou terminou em "battleEnd", ou um novo
      // combate com atacante diferente já começou no lugar dele.
      if (prevCombat && shouldAnimateAttackStrike(prevCombat, incoming.view.combat)) {
        await Promise.race([
          executeAttackStrike(prevCombat.attackerId, prevCombat.currentTarget, prevCombat.defendingPlayer),
          new Promise<void>((resolve) => setTimeout(resolve, VIEW_QUEUE_ITEM_TIMEOUT_MS)),
        ]);
      }

      const isTurnChange =
        prevView !== null &&
        !incoming.view.gameOver &&
        (incoming.view.turnNumber > prevView.turnNumber || incoming.view.activePlayer !== prevView.activePlayer);

      if (isTurnChange) {
        const staged = buildTurnStagedViews(prevView, incoming);
        turnStagedViewsRef.current = {
          actingPlayer: incoming.view.activePlayer,
          viewRecovery: staged.viewRecovery,
          viewDraw: staged.viewDraw,
          viewMain: staged.viewMain,
        };
        // Fecha o turno anterior ANTES de mostrar a mesa do novo turno.
        enqueuePhaseBanners(endOfTurnBanners(prevView));
        await waitForPhaseBanners();
        setMatchView(staged.viewAnnounced);
        const isMyTurn = incoming.view.activePlayer === incoming.seat;
        if (isMyTurn) sfx.playNewtypeFlash();
        enqueuePhaseBanners([
          isMyTurn ? "SEU TURNO" : "TURNO DO OPONENTE",
          "FASE DE RECUPERAÇÃO",
          "FASE DE COMPRA",
          "FASE PRINCIPAL",
        ]);
        await waitForPhaseBanners();
      } else {
        setMatchView((prev) => {
          if (prev && prev.matchId === incoming.matchId && incoming.version < prev.version) return prev;
          return incoming;
        });
      }

      // Só DEPOIS de aplicar a view é que `myBurstDecision` (derivado dela)
      // passa a existir pro render — por isso a espera do reveal vem depois do
      // `setMatchView`, nunca antes (não tem o que esperar até a view aplicar).
      const myDecision = incoming.view.pendingDecision[incoming.seat];
      if (myDecision?.kind === "burst") {
        if (shouldWaitForBurstReveal(myDecision, burstRevealedIdRef.current)) {
          await waitForBurstReveal(myDecision.cardInstanceId);
        }
        // Trava a drenagem de views subsequentes enquanto o jogador decide o Burst
        await new Promise<void>((resolve) => {
          burstDecisionResolveRef.current = resolve;
          setTimeout(resolve, 30_000);
        });
      }
    },
    [executeAttackStrike, detectDepartures, waitForBurstReveal, board, enqueuePhaseBanners, waitForPhaseBanners],
  );

  const drainViewQueue = useCallback(async () => {
    if (isDrainingViewQueueRef.current) return;
    isDrainingViewQueueRef.current = true;
    try {
      while (viewQueueRef.current.length > 0) {
        const peekNext = viewQueueRef.current[0];
        // Se a próxima view já é pós-setup (Fase Principal, jogadas de turno 1, ou bot agindo),
        // mas a abertura inicial ainda não foi concluída (mulligan, deal-shields, phase-banner),
        // aguarda a abertura cinematográfica terminar para não atropelar a distribuição de shields!
        if (isPostSetupView(peekNext.view) && introStageRef.current !== "complete") {
          await Promise.race([
            new Promise<void>((resolve) => {
              const prev = introStageResolveRef.current;
              introStageResolveRef.current = () => {
                prev?.();
                resolve();
              };
            }),
            new Promise<void>((resolve) => setTimeout(resolve, 15_000)),
          ]);
        }

        if (phaseBannerQueueRef.current.length > 0) {
          await waitForPhaseBanners();
        }
        const next = viewQueueRef.current.shift()!;
        try {
          await processIncomingView(next);
        } catch (err) {
          console.error("[ViewQueue] processIncomingView falhou", err, next);
          setMatchView(next);
        }
        // Fim de jogo: não faz sentido continuar animando um backlog de
        // eventos de uma partida que já acabou — descarta o resto da fila.
        if (next.view.gameOver) {
          viewQueueRef.current = [];
          break;
        }
      }
    } finally {
      isDrainingViewQueueRef.current = false;
    }
  }, [processIncomingView, waitForPhaseBanners]);

  const applyIncomingView = useCallback(
    (incoming: SimulatorMatchView) => {
      // A 1ª view de todas (entrada na partida) não tem um "antes" coerente
      // pra animar a transição — aplica direto, sem passar pela fila. Ainda
      // assim chama `detectDepartures` (ela mesma não faz nada sem uma view
      // anterior pra comparar) só pra plantar a referência corretamente —
      // senão a 2ª view (já pela fila) achava que também era "a primeira".
      if (!hasAppliedFirstViewRef.current) {
        hasAppliedFirstViewRef.current = true;
        prevViewForQueueRef.current = incoming.view;
        detectDepartures(incoming);
        prevCombatRef.current = incoming.view.combat;
        setMatchView(incoming);
        return;
      }
      viewQueueRef.current.push(incoming);
      void drainViewQueue();
    },
    [drainViewQueue, detectDepartures],
  );

  // Frente 5 (docs/39) — transporte da partida: `simulatorSocket` como caminho
  // PRIMÁRIO (`match:view_update`/`match:action`/`match:ping`), com FALLBACK
  // automático pro laço SSE + POST antigo se o socket não conectar / ficar `dead`
  // (o servidor mantém `/stream` e as rotas POST intactos — só o cliente muda o
  // caminho preferido). Toda a máquina de conexão/reconexão vive no hook.
  const onTransportExpired = useCallback(
    ({ reason, toLobby }: { reason: string; toLobby: boolean }) => {
      toast.error(reason);
      if (toLobby) setLocation("/simulador");
    },
    [setLocation],
  );
  const onTransportMatchError = useCallback((message: string) => toast.error(message), []);
  const {
    connState,
    transport: transportKind,
    deadReason,
    reconnectAttempt,
    lastPingMs,
    opponentOnline,
    sendAction,
    teardown: teardownTransport,
  } = useMatchTransport({
    matchId,
    applyIncomingView,
    onExpired: onTransportExpired,
    onMatchError: onTransportMatchError,
  });
  const connected = connState === "live";

  // Relógio local pro countdown do timer de turno e pro "há quanto tempo o oponente sumiu" --
  // só exibição/UX; a decisão real (agir sozinho no timeout, liberar o W.O.) é sempre do servidor.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Heartbeat de presença (`matchStore.touchPresence`, alimenta o W.O. por
  // abandono): agora vive dentro do `useMatchTransport` — `simulatorSocket.ping()`
  // no modo socket, `api.pingSimulatorMatch` no modo SSE, só com a aba visível.

  const clearSelection = () => {
    setPending(null);
    setSelected([]);
    setSelectedResources([]);
    setAttackerId(null);
  };

  // docs/54 tarefa 5/6 — `Esc` também fecha o seletor compacto de modo (Piloto
  // vs Comando) de uma carta híbrida, antes mesmo de qualquer `pending` existir.
  // O `MatchPrompt` (TopTacticalHUD) já cobre `Esc` pra `pending`/`attackerId`.
  useEffect(() => {
    if (!handModeChoice) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setHandModeChoice(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handModeChoice]);

  /** Erro de jogada — faixa própria no topo, auto-some em 4s. */
  const showActionError = useCallback((message: string) => {
    setActionError(message);
    if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
    actionErrorTimerRef.current = setTimeout(() => setActionError(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
    };
  }, []);

  const runAction = useCallback(
    async (action: PlayerAction) => {
      setBusy(true);
      try {
        // Áudio e feedback sensorial Gundam com micro-delays antes do despacho
        if (action.kind === "declareAttack") {
          // O feixe de ataque e o impacto sonoro acontecem no strike pós-passo de ação
          sfx.playClick();
          await new Promise((r) => setTimeout(r, getScaledDuration(60)));
        } else if (action.kind === "activateBlocker") {
          // docs/55 tarefa 3 — 300ms de confirmação visual (a seta de combate
          // já redireciona pro blocker assim que a nova view chegar) antes de
          // avançar pro Passo de Ação.
          sfx.playShieldBlock();
          await new Promise((r) => setTimeout(r, getScaledDuration(300)));
        } else if (action.kind === "playCommand") {
          // "Nova leva de correções" — revelação da carta de Comando antes do
          // descarte (era só um `setTimeout(120)` sem nenhum feedback visual).
          const currentView = matchView;
          const cardInHand = currentView?.view.players[currentView.seat].hand.find(
            (c) => !isHidden(c) && c.instanceId === action.cardInstanceId,
          ) as CardInstance | undefined;
          if (currentView && cardInHand) {
            const origin = rectCenter(board.rectOf("hand:self"));
            const dest = rectCenter(board.rectOf(`trashStation:${currentView.seat}`));
            await new Promise<void>((resolve) => {
              commandCastResolveRef.current = resolve;
              setCommandCast({ cardDef: cardInHand.def, origin, dest });
            });
          } else {
            sfx.playNewtypeFlash();
            await new Promise((r) => setTimeout(r, getScaledDuration(120)));
          }
        } else if (action.kind === "finishTurn") {
          sfx.playTurnStartAlert();
          await new Promise((r) => setTimeout(r, getScaledDuration(100)));
        } else if (action.kind === "deployCard") {
          sfx.playDeploy();
          await new Promise((r) => setTimeout(r, getScaledDuration(100)));
        } else {
          sfx.playClick();
        }

        if (action.kind === "resolveBurstDecision") {
          burstDecisionResolveRef.current?.();
          burstDecisionResolveRef.current = null;
        }

        // Modo socket: o eco vem pelo broadcast `match:view_update` (o hook
        // resolve quando chega). Modo SSE: `sendAction` faz o POST e aplica a
        // resposta. Nos dois casos a view já está aplicada quando isto resolve.
        await sendAction(action);
        clearSelection();
      } catch (err) {
        // jogada recusada pelo motor (ex.: atacar com Unit rested) — faixa
        // própria no topo, não `toast` no canto (que tapava o log — Feedback.pdf §5).
        showActionError(errorMessage(err, "Ação inválida."));
      } finally {
        setBusy(false);
      }
    },
    [sendAction, showActionError, matchView, board],
  );

  const handleSideboardSubmit = useCallback(
    async (swaps: { mainOut: string[]; sideIn: string[] }) => {
      setBusy(true);
      try {
        const updated = await api.submitSimulatorSideboard(matchId, swaps);
        applyIncomingView(updated);
        toast.success("Trocas táticas de Sideboard confirmadas!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao submeter sideboard.");
      } finally {
        setBusy(false);
      }
    },
    [matchId, applyIncomingView],
  );

  const toggleAutoPass = async (value: boolean) => {
    try {
      const res = await api.setSimulatorAutoPass(matchId, value);
      setMatchView(res);
    } catch (err) {
      toast.error(errorMessage(err, "Não deu pra mudar o auto-pass."));
    }
  };

  const submitBugReport = async (note: string) => {
    setBugReport((s) => ({ ...s, busy: true }));
    try {
      const { shortCode } = await api.reportSimulatorSituation(matchId, note || undefined);
      setBugReport({ open: true, busy: false, code: shortCode });
    } catch (err) {
      setBugReport((s) => ({ ...s, busy: false }));
      toast.error(errorMessage(err, "Não deu pra registrar o problema."));
    }
  };

  const claimAbandon = async () => {
    setBusy(true);
    try {
      const res = await api.claimSimulatorAbandonWin(matchId);
      setMatchView(res);
      toast.success("W.O. declarado — vitória por abandono.");
    } catch (err) {
      toast.error(errorMessage(err, "Ainda não dá pra declarar W.O."));
    } finally {
      setBusy(false);
    }
  };

  const leaveMatchScreen = useCallback(() => {
    teardownTransport();
    setLocation(EXIT_ROUTE);
  }, [setLocation, teardownTransport]);

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
    teardownTransport();
    setRedirectAt(Date.now() + GAME_OVER_REDIRECT_MS);
    const timer = setTimeout(() => setLocation(EXIT_ROUTE), GAME_OVER_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [gameOver, setLocation, teardownTransport]);

  // Avisos do relógio de turno (pedido do Willen, 2026-09-04): sem isso o turno
  // (300s) podia acabar "sem aviso" e o jogador só percebia quando o servidor já
  // tinha agido sozinho. Só pra quem está decidindo agora (o timer de 30s do
  // Action Step é curto de propósito, não precisa dessa régua). Precisa ficar
  // ANTES do guard `!matchView` abaixo — hook não pode vir depois de early
  // return — então recalcula `myTurnMain`/`turnSecondsLeft` aqui em vez de usar
  // os `const` do corpo do componente (que só existem depois do guard).
  // `turnWarningsRef` some os avisos repetindo a cada render: reseta quando o
  // prazo muda (novo turno/timer rearmado) e só dispara cada limiar 1x por prazo.
  useEffect(() => {
    if (!matchView || matchView.turnDeadlineAt === null) return;
    const v = matchView.view;
    const myTurnMainNow = !v.combat && v.phase === "main" && v.activePlayer === matchView.seat;
    if (!myTurnMainNow) return;
    const secondsLeft = Math.max(0, Math.ceil((matchView.turnDeadlineAt - (now + clockOffsetRef.current)) / 1000));
    const track = turnWarningsRef.current;
    if (track.deadline !== matchView.turnDeadlineAt) {
      track.deadline = matchView.turnDeadlineAt;
      track.fired = new Set();
    }
    const thresholds: Array<{ at: number; fire: () => void }> = [
      { at: 150, fire: () => toast.warning("Metade do tempo do seu turno já passou.") },
      { at: 50, fire: () => toast.warning("Faltam 50s pro seu turno acabar.") },
      { at: 10, fire: () => toast.error("10s! O turno vai encerrar sozinho e entrar no Action Step.") },
    ];
    for (const t of thresholds) {
      if (secondsLeft <= t.at && !track.fired.has(t.at)) {
        track.fired.add(t.at);
        t.fire();
      }
    }
  }, [matchView, now]);

  // Frente 4 (feedback Willen 4ª rodada) — liga a `DeckDealAnimation` no fluxo
  // real. O motor NÃO expõe os `GameEvent` de setup ao cliente de forma
  // utilizável (o `eventLog` da view é janelado e traduzido pra texto), então a
  // detecção é por DIFF de contagem entre o snapshot anterior e o atual:
  //  - escudos 0 → ≥6 no turno 1  ⇒ montagem dos 6 escudos
  //  - decisão de mulligan que sai de pendente ⇒ refação da mão
  //  - mão 0 → ≥5 no turno 1       ⇒ compra inicial
  // Só 1 animação por vez; `prefers-reduced-motion` pula tudo. Precisa vir ANTES
  // do guard de loading (hook não pode ficar depois de early return) — daí ler
  // de `matchView` direto em vez dos `const` do corpo (que só existem depois).
  useEffect(() => {
    if (!matchView) return;
    const v = matchView.view;
    const me = v.players[matchView.seat];
    const oppSeat = otherPlayer(matchView.seat);
    const opp = v.players[oppSeat];
    const cur = {
      turnNumber: v.turnNumber,
      activePlayer: v.activePlayer,
      handLen: (me.hand as ViewCardInstance[]).filter((c) => !isHidden(c)).length,
      shields: me.counts.shields,
      oppShields: opp.counts.shields,
      mulliganPending: v.pendingDecision[matchView.seat]?.kind === "mulligan",
    };
    // marca como "já animadas" as Units recém-postas — no PRÓXIMO render elas
    // não recebem mais `justDeployed` (a animação de pouso já rodou na montagem).
    for (const pid of ["A", "B"] as PlayerId[]) {
      for (const c of v.players[pid].battleArea) {
        if (!isHidden(c) && (c as CardInstance).enteredZoneOnTurn === v.turnNumber) {
          deployedSeenRef.current.add((c as CardInstance).instanceId);
        }
      }
    }

    // Inicialização da máquina de estados de abertura (Intro Sequence)
    if (!introInitializedRef.current) {
      introInitializedRef.current = true;
      const isInitial =
        v.turnNumber === 1 &&
        !v.gameOver &&
        (v.pendingDecision.A?.kind === "mulligan" || v.pendingDecision.B?.kind === "mulligan");
      if (!isInitial) {
        setIntroStage("complete");
      } else {
        setIntroStage("field-ready");
      }
    }

    const prev = setupSnapshotRef.current;
    setupSnapshotRef.current = cur;
    const reduced =
      typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    if (!prev || v.gameOver) {
      if (!prev && !v.gameOver && cur.turnNumber <= 1 && !reduced) {
        if (introStage === "complete") {
          if (cur.shields >= 6) {
            setSetupAnim("deal-shields");
          } else if (cur.handLen >= 5) {
            setSetupAnim("deal-hand");
          }
        }
      }
      return;
    }

    // Disparos sonoros táticos (Asticassia Sound Engine)
    if (prev.activePlayer !== cur.activePlayer && cur.activePlayer === matchView.seat) {
      sfx.playNewtypeFlash();
    }
    if (cur.shields < prev.shields || cur.oppShields < prev.oppShields) {
      sfx.playShieldBurst();
    }

    if (reduced || introStage !== "complete") return;
    if (prev.shields === 0 && cur.shields >= 6 && cur.turnNumber <= 1) {
      setSetupAnim("deal-shields");
    } else if (prev.mulliganPending && !cur.mulliganPending) {
      setSetupAnim("mulligan");
    } else if ((prev.handLen === 0 && cur.handLen >= 5 && cur.turnNumber <= 1) || (prev.handLen < cur.handLen && cur.turnNumber === 1)) {
      setSetupAnim("deal-hand");
    }
  }, [matchView, introStage]);

  // Temporizadores automáticos das etapas sequenciais da abertura
  useEffect(() => {
    if (!matchView || introStage === "complete") return;

    if (introStage === "field-ready") {
      const t = setTimeout(() => {
        setIntroStage("player-choice");
      }, 650);
      return () => clearTimeout(t);
    }

    if (introStage === "field-highlight") {
      sfx.playNewtypeFlash();
      const t = setTimeout(() => {
        setIntroStage("deck-appear");
      }, 1250);
      return () => clearTimeout(t);
    }

    if (introStage === "deck-appear") {
      sfx.playDeploy();
      const t = setTimeout(() => {
        setIntroStage("deck-shuffle");
        setSetupAnim("shuffle");
      }, 650);
      return () => clearTimeout(t);
    }

    if (introStage === "hand-revealed") {
      const t = setTimeout(() => {
        setIntroStage("mulligan-decision");
      }, 550);
      return () => clearTimeout(t);
    }
  }, [introStage, matchView]);

  // Reseta confirmação de fim de turno quando deixa de ser o turno do jogador
  useEffect(() => {
    if (!matchView) return;
    const v = matchView.view;
    const myTurnMainNow = !v.combat && v.phase === "main" && v.activePlayer === matchView.seat;
    if (!myTurnMainNow) {
      setShowEndTurnConfirm(false);
    }
  }, [matchView]);

  // Callback de término de animações de setup/abertura
  const handleSetupAnimDone = useCallback(() => {
    setSetupAnim(null);
    if (introStage === "deck-shuffle") {
      setIntroStage("deal-hand");
      setSetupAnim("deal-hand");
    } else if (introStage === "deal-hand") {
      setIntroStage("hand-revealed");
    } else if (introStage === "mulligan-anim") {
      const v = matchView?.view;
      const oppSeat = matchView ? otherPlayer(matchView.seat) : null;
      const oppHasMulligan = oppSeat && v ? v.pendingDecision[oppSeat]?.kind === "mulligan" : false;
      if (oppHasMulligan) {
        setIntroStage("waiting-opponent-mulligan");
      } else {
        setIntroStage("deal-shields");
        setSetupAnim("deal-shields");
      }
    } else if (introStage === "deal-shields") {
      const postSetupView = viewQueueRef.current.find((item) => isPostSetupView(item.view)) ?? matchView;
      if (postSetupView) {
        const staged = buildTurn1StagedViews(postSetupView);
        turnStagedViewsRef.current = {
          actingPlayer: postSetupView.view.activePlayer,
          viewRecovery: staged.viewRecovery,
          viewDraw: staged.viewDraw,
          viewMain: staged.viewMain,
        };
        setMatchView(staged.viewAnnounced);
      }
      const isMyTurn = (postSetupView?.view ?? matchView?.view)?.activePlayer === matchView?.seat;
      if (isMyTurn) sfx.playNewtypeFlash();
      enqueuePhaseBanners([
        isMyTurn ? "SEU TURNO" : "TURNO DO OPONENTE",
        "FASE DE RECUPERAÇÃO",
        "FASE DE COMPRA",
        "FASE PRINCIPAL",
      ]);
      setIntroStage("phase-banner");
    }
  }, [introStage, matchView, enqueuePhaseBanners]);

  // Callback de término de cada banner de fase
  const handlePhaseBannerDone = useCallback(() => {
    setPhaseBannerQueue((prev) => {
      const next = prev.slice(1);
      phaseBannerQueueRef.current = next;

      if (next.length > 0 && turnStagedViewsRef.current) {
        const nextPhase = next[0];
        if (nextPhase === "FASE DE RECUPERAÇÃO") {
          setMatchView(turnStagedViewsRef.current.viewRecovery);
          sfx.playDeploy();
        } else if (nextPhase === "FASE DE COMPRA") {
          setMatchView(turnStagedViewsRef.current.viewDraw);
          setSetupAnim("single-draw");
          sfx.playCardDraw();
        } else if (nextPhase === "FASE PRINCIPAL") {
          setMatchView(turnStagedViewsRef.current.viewMain);
        }
      }

      if (next.length === 0) {
        turnStagedViewsRef.current = null;
        setIntroStage("complete");
        phaseBannerResolveRef.current?.();
        phaseBannerResolveRef.current = null;
      }
      return next;
    });
  }, []);

  // Sincronização de Mulligan: quando o oponente conclui o mulligan dele,
  // se o jogador local estava em waiting-opponent-mulligan, avança para deal-shields
  useEffect(() => {
    if (introStage !== "waiting-opponent-mulligan" || !matchView) return;
    const v = matchView.view;
    const oppSeat = otherPlayer(matchView.seat);
    const oppHasMulligan = v.pendingDecision[oppSeat]?.kind === "mulligan";
    if (!oppHasMulligan) {
      setIntroStage("deal-shields");
      setSetupAnim("deal-shields");
    }
  }, [introStage, matchView]);

  // Banner da End Phase: o Action Step da End Phase SEMPRE existe pelas regras
  // (CR — End Phase: Action Step → End Step → Hand Step → Cleanup), então o
  // banner anuncia "FASE DE AÇÕES" sempre. Não dá pra decidir "FIM DE TURNO"
  // por "ninguém tem jogada": o cliente só conhece a própria mão (a do
  // oponente chega como `HiddenCard`), e o servidor mandar esse booleano
  // vazaria informação oculta. Quem não tem jogada é passado pelo auto-pass.
  const endPhaseBannerShownTurnRef = useRef<number | null>(null);

  useEffect(() => {
    if (!matchView || introStage !== "complete") return;
    const v = matchView.view;
    if (v.gameOver) return;

    const isEndPhase = v.phase === "end" || v.endPhaseAction !== null;
    if (!isEndPhase) return;

    if (endPhaseBannerShownTurnRef.current === v.turnNumber) return;
    endPhaseBannerShownTurnRef.current = v.turnNumber;

    enqueuePhaseBanners(["FASE DE AÇÕES"]);
  }, [matchView, introStage, enqueuePhaseBanners]);


  // Recuperação de segurança: se a partida já está em andamento avançado (Turno 2+, sem mulligan ativo nem animação em curso),
  // garante que os controles do jogador fiquem liberados caso a máquina de estados tenha ficado desincronizada (ex: reconexão).
  useEffect(() => {
    if (!matchView || introStage === "complete") return;
    const v = matchView.view;
    const hasMulligan = v.pendingDecision.A?.kind === "mulligan" || v.pendingDecision.B?.kind === "mulligan";
    if (!hasMulligan && v.turnNumber > 1 && setupAnim === null && phaseBannerQueue.length === 0) {
      const t = setTimeout(() => {
        setIntroStage("complete");
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [matchView, introStage, setupAnim, phaseBannerQueue]);

  // docs/55 tarefa 4 — Auto-pass do Passo de Ação: se eu tenho prioridade e
  // não tenho NENHUMA jogada real (nem Comando 【Action】 pagável na mão, nem
  // 【Activate·Action】 de campo), passa sozinho — não força um clique vazio
  // num botão que não faria nada mesmo. `playerHasActionStepPlay` é a MESMA
  // função que o servidor usa no auto-pass opcional (`autoPassActionStep`,
  // docs/19 Sessão 2); aqui é INCONDICIONAL — só cobre o caso em que
  // literalmente não há jogada nenhuma, então não tira nenhuma decisão real
  // do jogador (o toggle continua servindo pra quem quer pular Comandos
  // 【Action】 que EXISTEM mas não quer considerar).
  useEffect(() => {
    if (!matchView || introStage !== "complete" || busy) return;
    const v = matchView.view;
    const meSeat = matchView.seat;
    const combatNow = v.combat;
    const iHavePriorityNow = combatNow?.step === "action" && combatNow.actionPriority === meSeat;
    const iHaveEndPhasePriorityNow = v.endPhaseAction !== null && v.endPhaseAction.priority === meSeat;
    if (!iHavePriorityNow && !iHaveEndPhasePriorityNow) return;
    if (playerHasActionStepPlay(v, meSeat, ALL_EFFECT_SPECS)) return;
    if (phaseBannerQueue.length > 0) return;
    runAction(iHavePriorityNow ? { kind: "passAction" } : { kind: "passEndPhaseAction" });
  }, [matchView, introStage, busy, runAction, phaseBannerQueue.length]);

  // docs/55 tarefa 3 — Auto-pass do Passo de Bloqueio: se o defensor não tem
  // NENHUMA Unit ativa com <Blocker>, pula sozinho — não trava o jogo
  // esperando um bloqueio que não existe.
  useEffect(() => {
    if (!matchView || introStage !== "complete" || busy) return;
    const v = matchView.view;
    const meSeat = matchView.seat;
    const combatNow = v.combat;
    if (!(combatNow?.step === "block" && combatNow.defendingPlayer === meSeat)) return;
    const boardNow = v as unknown as GameState;
    const myUnits = v.players[meSeat].battleArea.filter((c) => !isHidden(c)) as CardInstance[];
    const hasActiveBlocker = myUnits.some((u) => !u.rested && hasKeyword(u, "Blocker", boardNow));
    if (hasActiveBlocker) return;
    runAction({ kind: "skipBlock" });
  }, [matchView, introStage, busy, runAction]);

  if (!matchView || artLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-muted-portal">
        {!matchView ? "Conectando à partida…" : "Carregando as cartas…"}
      </div>
    );
  }

  const view = matchView.view;
  const seat = matchView.seat;
  const opponentSeat = otherPlayer(seat);
  // `effectiveAp/Hp` querem um `GameState`, mas só leem `activePlayer` + as
  // Battle Areas (nunca redigidas — ver viewState.ts). O cast é seguro pra os
  // cálculos de stat e deixa os badges incluírem 【During Pair】/【During Link】.
  const boardForStats = view as unknown as GameState;
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
    ? "Combate em andamento — só dá pra jogar Comando 【Action】 agora."
    : endPhaseAction
      ? "Passo de Ação do fim de turno — só dá pra jogar Comando 【Action】 agora."
      : view.activePlayer !== seat
        ? "Não é sua vez."
        : view.phase !== "main"
          ? "Fora da sua Fase Principal."
          : undefined;

  // Decisão interativa pendente (docs/19, Sessão 2) — Burst de shield quebrada, sobretudo.
  const myPendingDecision = view.pendingDecision[seat];
  const oppPendingDecision = view.pendingDecision[opponentSeat];
  const myBurstDecision = myPendingDecision?.kind === "burst" ? myPendingDecision : null;

  // `serverClockNow` = relógio do cliente corrigido pro do servidor — o timer e o
  // "oponente inativo" comparam contra epochs do servidor (`turnDeadlineAt`/`lastSeenAt`).
  const serverClockNow = now + clockOffsetRef.current;
  const turnSecondsLeft =
    matchView.turnDeadlineAt !== null ? Math.max(0, Math.ceil((matchView.turnDeadlineAt - serverClockNow) / 1000)) : null;
  const redirectSecondsLeft = redirectAt !== null ? Math.max(0, Math.ceil((redirectAt - now) / 1000)) : null;
  const gameOverResult = view.gameOver
    ? {
        won: view.gameOver.winner === seat,
        reason: view.gameOver.reason,
        reasonLabel: gameOverReasonLabel(view.gameOver.reason, view.gameOver.winner === seat),
      }
    : null;

  const opponentLastSeen = matchView.lastSeenAt[opponentSeat];
  const opponentIdleMs = opponentLastSeen ? Math.max(0, serverClockNow - opponentLastSeen) : null;
  const opponentIdleSeconds = opponentIdleMs !== null ? Math.floor(opponentIdleMs / 1000) : null;
  const canClaimAbandon = !view.gameOver && opponentIdleMs !== null && opponentIdleMs >= ABANDON_THRESHOLD_MS;

  // carta em `pending` — na mão (deploy/command) ou em campo (activateAbility) — + custo.
  const pendingCard: CardInstance | undefined = pending
    ? ((pending.kind === "activateAbility"
        ? findPublicCard(view, pending.cardInstanceId)
        : view.players[seat].hand.find((c) => !isHidden(c) && c.instanceId === pending.cardInstanceId)) as
        | CardInstance
        | undefined)
    : undefined;
  const pendingCost =
    pending?.kind === "activateAbility"
      ? pending.abilityCost
      : pending?.kind === "deploy" && pending.sacrificeInstanceId
        ? 0
        : pendingCard
          ? effectiveCost(pendingCard.def, view as unknown as GameState, seat)
          : 0;
  const resourcesReady = selectedResources.length === pendingCost;
  /** docs/54 — halo dos Recursos ativos durante o pagamento: ciano pra invocação
   *  direta (Unit/Base, sem alvo), âmbar pra Piloto/Comando/habilidade (fluxo
   *  bidirecional alvo↔recurso). */
  const resourceHighlightTone: "cyan" | "amber" | null = !pending
    ? null
    : pending.kind === "deploy"
      ? (pendingCard?.def?.cardType === "PILOT" || pendingCard?.def?.pilotMode ? "amber" : "cyan")
      : pending.kind === "command" || pending.kind === "activateAbility"
        ? "amber"
        : null;

  /** Alvos legais reais da ação em andamento (`pending`) — evita iluminar todas as
   *  cartas em verde quando a ação não precisa de alvos ou quando só certas cartas são válidas.
   *  `requiredTargetCount` — docs/54: mínimo de alvos que o efeito exige (specs com
   *  `targetCount.min` > 1 existem, ex. GD01) — usado pro auto-disparo bidirecional
   *  não atirar cedo demais assim que 1 alvo é clicado. */
  const { legalTargetInstanceIds, requiredTargetCount } = ((): { legalTargetInstanceIds: Set<string>; requiredTargetCount: number } => {
    const none = { legalTargetInstanceIds: new Set<string>(), requiredTargetCount: 0 };
    if (!pending || !pendingCard || !pendingCard.def) return none;

    if (pending.kind === "deploy") {
      const isPilot = pendingCard.def?.cardType === "PILOT" || Boolean(pendingCard.def?.pilotMode);
      if (isPilot) {
        // Piloto pareia com Unit amiga livre (sem piloto acoplado)
        const myUnits = view.players[seat].battleArea.filter((c) => !isHidden(c)) as CardInstance[];
        return {
          legalTargetInstanceIds: new Set(
            myUnits.filter((u) => u.def?.cardType === "UNIT" && !u.pairedPilotId).map((u) => u.instanceId),
          ),
          requiredTargetCount: 1,
        };
      }
      return none;
    }

    if (pending.kind === "activateAbility") {
      if (!pending.abilityNeedsTarget) return none;

      if (hasKeyword(pendingCard, "Support")) {
        // Support mira em outra Unit amiga
        const myUnits = view.players[seat].battleArea.filter((c) => !isHidden(c)) as CardInstance[];
        return {
          legalTargetInstanceIds: new Set(
            myUnits.filter((u) => u.def?.cardType === "UNIT" && u.instanceId !== pendingCard.instanceId).map((u) => u.instanceId),
          ),
          requiredTargetCount: 1,
        };
      }

      const inAction = view.combat?.step === "action";
      const trigger = inAction ? "Activate·Action" : "Activate·Main";
      const specs = findTriggerSpecs(ALL_EFFECT_SPECS, pendingCard.def.code, trigger);
      const needing = specs.filter((s) => specNeedsNamedTarget(s));
      if (needing.length === 0) return none;

      const ids = new Set<string>();
      let minCount = 1;
      for (const spec of needing) {
        minCount = Math.max(minCount, spec.targetCount?.min ?? 1);
        try {
          for (const id of computeLegalTargets(boardForStats, spec, seat, defaultTargetFilterResolver)) {
            ids.add(id);
          }
        } catch {
          // alvo inválido descartado
        }
      }
      return { legalTargetInstanceIds: ids, requiredTargetCount: minCount };
    }

    if (pending.kind === "command") {
      const trigger = pending.trigger ?? "Main";
      const specs = findTriggerSpecs(ALL_EFFECT_SPECS, pendingCard.def.code, trigger);
      const needing = specs.filter((s) => specNeedsNamedTarget(s));
      if (needing.length === 0) return none;

      const ids = new Set<string>();
      let minCount = 1;
      for (const spec of needing) {
        minCount = Math.max(minCount, spec.targetCount?.min ?? 1);
        try {
          for (const id of computeLegalTargets(boardForStats, spec, seat, defaultTargetFilterResolver)) {
            ids.add(id);
          }
        } catch {
          // alvo inválido descartado
        }
      }
      return { legalTargetInstanceIds: ids, requiredTargetCount: minCount };
    }

    return none;
  })();

  /** docs/54 — depois de QUALQUER clique em alvo ou recurso durante uma seleção
   *  pendente, tenta resolver a jogada sozinha assim que os requisitos batem —
   *  em QUALQUER ordem (alvo primeiro ou recurso primeiro). Sem isso, toda
   *  jogada (Piloto, Comando, Unit, Base) precisava de um clique extra num
   *  botão "Confirmar". Chamado de `toggleSelect` e `toggleResource` com os
   *  arrays JÁ ATUALIZADOS (não espera o próximo render). */
  const tryAutoResolve = (nextSelected: string[], nextResources: string[]) => {
    if (!pending || !pendingCard) return;
    const costMet = pendingCost === 0 || nextResources.length === pendingCost;
    if (!costMet) return;

    if (pending.kind === "deploy") {
      const isPilot = pendingCard?.def?.cardType === "PILOT" || Boolean(pendingCard?.def?.pilotMode);
      if (isPilot) {
        const myBattleArea = view.players[seat].battleArea.filter((c) => !isHidden(c)) as CardInstance[];
        const ownBattleUnits = myBattleArea
          .filter((c) => c.def?.cardType === "UNIT")
          .map((u) => ({ instanceId: u.instanceId, code: u.def?.code, paired: !!u.pairedPilotId }));
        const sel = resolveDeploySelection({ card: pendingCard, selected: nextSelected, ownBattleUnits });
        if (sel.error || !sel.pairWithUnitId) return;
        executeDeploy(pending.cardInstanceId, sel.pairWithUnitId, pending.sacrificeInstanceId, nextResources.length > 0 ? nextResources : undefined);
        return;
      }
      // Unit simples ou Base — sem alvo, só custo (docs/54 tarefas 1 e 4).
      if (!pending.sacrificeInstanceId) {
        executeDeploy(pending.cardInstanceId, undefined, undefined, nextResources.length > 0 ? nextResources : undefined);
      }
      return;
    }

    if (pending.kind === "command") {
      if (requiredTargetCount > 0 && nextSelected.length < requiredTargetCount) return;
      const targets = nextSelected.length ? { target: nextSelected } : undefined;
      sfx.playDeploy();
      runAction({
        kind: "playCommand",
        cardInstanceId: pending.cardInstanceId,
        trigger: pending.trigger ?? "Main",
        targets,
        resourceInstanceIds: nextResources.length > 0 ? nextResources : undefined,
      });
    }
  };

  const toggleSelect = (instanceId: string) => {
    if (!pending || !legalTargetInstanceIds.has(instanceId)) return;
    sfx.playClick();
    const nextSelected = selected.includes(instanceId) ? selected.filter((id) => id !== instanceId) : [...selected, instanceId];
    setSelected(nextSelected);
    tryAutoResolve(nextSelected, selectedResources);
  };

  const executeDeploy = (
    cardInstanceId: string,
    pairWithUnitId?: string,
    sacrificeInstanceId?: string,
    resourceIds?: string[],
  ) => {
    runAction({
      kind: "deployCard",
      cardInstanceId,
      pairWithUnitId,
      sacrificeInstanceId,
      resourceInstanceIds: resourceIds && resourceIds.length > 0 ? resourceIds : undefined,
    });
    clearSelection();
  };

  /** clique num Recurso ativo pra incluí-lo/tirá-lo do pagamento manual do custo.
   *  docs/54 — o auto-disparo (Unit/Base sem alvo, Piloto/Comando com alvo já
   *  escolhido) mora em `tryAutoResolve`, chamado com o array JÁ ATUALIZADO. */
  const toggleResource = (instanceId: string) => {
    if (!pending) return;
    sfx.playClick();
    const nextResources = selectedResources.includes(instanceId)
      ? selectedResources.filter((id) => id !== instanceId)
      : [...selectedResources, instanceId];
    setSelectedResources(nextResources);
    tryAutoResolve(selected, nextResources);
  };

  const startDeploy = (card: CardInstance, sacrificeInstanceId?: string) => {
    // docs/54 tarefa 4 — Base é invocação direta (sem alvo), igual Unit simples:
    // mesma janela de "custo 0 invoca na hora" se aplica às duas.
    const isDirect = (card.def?.cardType === "UNIT" || card.def?.cardType === "BASE") && !card.def?.pilotMode;
    const effCost = sacrificeInstanceId ? 0 : effectiveCost(card.def, view as unknown as GameState, seat);

    // Se for Unit/Base simples de custo 0 (ou com sacrifício já escolhido), invoca na hora
    if (isDirect && effCost === 0) {
      executeDeploy(card.instanceId, undefined, sacrificeInstanceId, undefined);
      return;
    }

    setPending({ kind: "deploy", cardInstanceId: card.instanceId, sacrificeInstanceId });
    setSelected([]);
    setSelectedResources([]);
  };
  const startCommand = (card: CardInstance) => {
    if (!commandTrigger) return;
    // docs/54 tarefa 3 — sem alvo e custo 0: resolve na hora, sem passar pelo
    // estado `pending` (nunca chega a piscar um HUD "escolha o alvo/recurso").
    const effCost = effectiveCost(card.def, view as unknown as GameState, seat);
    const specs = findTriggerSpecs(ALL_EFFECT_SPECS, card.def.code, commandTrigger);
    const needsTarget = specs.some((s) => specNeedsNamedTarget(s));
    if (effCost === 0 && !needsTarget) {
      sfx.playDeploy();
      runAction({ kind: "playCommand", cardInstanceId: card.instanceId, trigger: commandTrigger });
      return;
    }
    setPending({ kind: "command", cardInstanceId: card.instanceId, trigger: commandTrigger });
  };
  /** 【Activate·Main】 de carta em campo (Etapa 3) — abre o fluxo de custo/alvo (mesmo do deploy). */
  const startActivateAbility = (card: CardInstance, ability: FieldAbility) => {
    // Habilidade global/sem custo de recursos nem alvo (ex.: ST01-016 Asticassia "Rest this Base"):
    // sem recursos a pagar e sem alvo no tabuleiro, ativa imediatamente.
    if (ability.cost === 0 && !ability.needsTarget) {
      sfx.playAttackBeam();
      runAction({
        kind: "activateAbility",
        sourceInstanceId: card.instanceId,
      });
      return;
    }
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
      showActionError(`Selecione exatamente ${pendingCost} recurso(s) ativo(s) para pagar o custo (clique na sua bandeja de Recursos).`);
      return;
    }
    const resourceInstanceIds = pendingCost > 0 ? selectedResources : undefined;
    const myBattleArea = view.players[seat].battleArea.filter((c) => !isHidden(c)) as CardInstance[];
    if (pending.kind === "deploy") {
      const ownBattleUnits = myBattleArea
        .filter((c) => c.def?.cardType === "UNIT")
        .map((u) => ({ instanceId: u.instanceId, code: u.def?.code, paired: !!u.pairedPilotId }));
      const sel = resolveDeploySelection({ card: pendingCard, selected, ownBattleUnits });
      if (sel.error) {
        showActionError(sel.error);
        return;
      }
      executeDeploy(pending.cardInstanceId, sel.pairWithUnitId, pending.sacrificeInstanceId, resourceInstanceIds);
    } else if (pending.kind === "activateAbility") {
      if (pending.abilityNeedsTarget && selected.length === 0) {
        showActionError("Esta habilidade precisa de um alvo — clique numa carta do tabuleiro.");
        return;
      }
      // Só `target`. O `addShieldToHand` do motor escolhe o shield sozinho
      // (é face-down, a escolha não carrega informação). Passar o id do ALVO
      // também como shield fazia o efeito devolver a carta-alvo pra mão em vez
      // de um shield (bug do feedback: Rewloola não devolvia shield). Nenhuma
      // 【Activate·Main】 de ST01–04 usa addShieldToHand, mas o alias era latente.
      const targets = selected.length ? { target: selected } : undefined;
      sfx.playAttackBeam();
      runAction({
        kind: "activateAbility",
        sourceInstanceId: pending.cardInstanceId,
        targets,
        resourceInstanceIds,
      });
    } else {
      const targets = selected.length ? { target: selected } : undefined;
      sfx.playDeploy();
      runAction({
        kind: "playCommand",
        cardInstanceId: pending.cardInstanceId,
        trigger: pending.trigger ?? "Main",
        targets,
        resourceInstanceIds,
      });
    }
  };

  const declareAttack = (target: AttackTarget, explicitAttackerId?: string) => {
    const effAttackerId = explicitAttackerId ?? attackerId;
    if (!effAttackerId) return;
    sfx.playAttackBeam();
    setAttackerId(null);
    runAction({ kind: "declareAttack", attackerId: effAttackerId, target });
  };

  // P3 — contexto de jogabilidade: recursos, fase, Unit livre pra parear, alvos.
  const playabilityCtx = (): PlayabilityContext => {
    const mine = view.players[seat];
    const myUnits = mine.battleArea.filter((c) => !isHidden(c)) as CardInstance[];
    return {
      myTurnMain,
      inActionStep,
      activeResources: (mine.resourceArea.filter((c) => !isHidden(c)) as CardInstance[]).filter((r) => !r.rested).length,
      totalResources: mine.counts.resourceArea,
      hasUnpairedFriendlyUnit: myUnits.some((u) => u.def?.cardType === "UNIT" && !u.pairedPilotId),
      state: boardForStats,
      controller: seat,
    };
  };

  /** Modos de jogo de uma carta da mão AGORA (considerando custo/nível/fase/alvo). Vazio = injogável. */
  const handPlayModes = (c: CardInstance): HandPlayMode[] => {
    const ctx = playabilityCtx();
    const modes = playableModes(c.def, ctx);
    const asCommand: HandPlayMode = { label: `Jogar como Comando (${commandTrigger ?? "Main"})`, run: () => { setPreview(null); startCommand(c); } };
    const asPilot: HandPlayMode = { label: "Jogar como Piloto", run: () => { setPreview(null); startDeploy(c); } };
    const plain = (label: string, fn: (card: CardInstance, sacId?: string) => void, sacId?: string): HandPlayMode => ({
      label,
      run: () => {
        setPreview(null);
        fn(c, sacId);
      },
    });
    const isDual = c.def?.cardType === "COMMAND" && !!c.def?.pilotMode;

    if (isDual) {
      const out: HandPlayMode[] = [];
      if (modes.includes("commandMain") || modes.includes("commandAction")) out.push(asCommand);
      if (modes.includes("deploy")) out.push(asPilot);
      return out;
    }
    if (c.def?.cardType === "COMMAND") return modes.length ? [plain("Jogar", startCommand)] : [];

    // Verificação de sacrifício alternativo (GD01-002 Unicorn Gundam, etc.)
    const eligibleSacrifices = findEligibleSacrifices(c.def, ctx);
    const normalCost = effectiveCost(c.def, ctx.state, ctx.controller);
    const normalAffordable = ctx.activeResources >= normalCost && ctx.totalResources >= effectiveLevel(c.def, ctx.state, ctx.controller) && ctx.myTurnMain;

    const out: HandPlayMode[] = [];
    if (normalAffordable && modes.includes("deploy")) {
      out.push(plain(eligibleSacrifices.length > 0 ? `Jogar Normal (Custo ${normalCost})` : "Jogar", startDeploy));
    }
    if (ctx.myTurnMain && eligibleSacrifices.length > 0) {
      for (const sac of eligibleSacrifices) {
        out.push({
          label: `Sacrificar ${sac.def.nameEn} (Custo 0)`,
          run: () => {
            setPreview(null);
            startDeploy(c, sac.instanceId);
          },
        });
      }
    }

    if (out.length > 0) return out;
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

  /** docs/55 — enjôo de invocação (Comprehensive Rules 3-2-4): Unit que entrou
   *  na Battle Area NESTE turno não pode atacar, exceto Link Unit (3-2-6-3) ou
   *  concessão explícita de efeito (`AttackOnDeployTurn`, ex. GD01-066 Justice
   *  Gundam). Espelha a MESMA regra que `combat.ts#declareAttack` já aplica no
   *  servidor — aqui só decide se o botão "Atacar" aparece, pra não deixar o
   *  jogador iniciar uma jogada que o motor recusaria depois. */
  function canUnitAttackNow(unit: CardInstance): boolean {
    if (unit.enteredZoneOnTurn !== view.turnNumber) return true;
    const pilot = unit.pairedPilotId ? findPublicCard(view, unit.pairedPilotId) : null;
    const isLinkUnit = pilot ? satisfiesLinkCondition(effectivePilotDef(pilot), unit.def) : false;
    const hasDeployTurnGrant = hasKeyword(unit, "AttackOnDeployTurn", boardForStats);
    return isLinkUnit || hasDeployTurnGrant;
  }

  const publicUnits = (player: ViewPlayerState): CardInstance[] =>
    player.battleArea.filter((c) => !isHidden(c) && (c as CardInstance).def?.cardType === "UNIT") as CardInstance[];

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

  const targetingActive = Boolean(
    (pending && (legalTargetInstanceIds.size > 0 || pending.kind === "command" || pending.kind === "activateAbility")) ||
    (attackerId !== null && combat === null) ||
    iAmDefending,
  );
  const isPhaseBannerActive = phaseBannerQueue.length > 0;

  /** "Nova leva de correções" (item 4, plano v2) — decisão `abilityResolution`
   *  pendente com alvo em Unit (ex.: ST05-010 Mikazuki Augus): glow inline no
   *  tabuleiro em vez de lista de pills no `AbilityResolutionModal`. Só ativa
   *  quando `targetScope` do item da fila é de Unit (enemyUnit/friendlyUnit/
   *  anyUnit) — Recurso/Base/mão/deck/lixeira continuam só no modal (ver
   *  `usesBoardTargetingForPrimary`/`usesBoardTargetingForSecondary`). */
  const abilityDecision = myPendingDecision?.kind === "abilityResolution" ? myPendingDecision : null;

  function sideOfUnit(instanceId: string): "ally" | "enemy" | null {
    if (publicUnits(view.players[seat]).some((u) => u.instanceId === instanceId)) return "ally";
    if (publicUnits(view.players[opponentSeat]).some((u) => u.instanceId === instanceId)) return "enemy";
    return null;
  }

  /** instanceId → quem pediu esse alvo (specId), se é o pool primário ou
   *  secundário, e `max` (pra saber se é seleção múltipla). Se 2 itens da fila
   *  competirem pelo mesmo alvo (raro — múltiplos gatilhos simultâneos), o
   *  último processado vence; não é um caso coberto nesta 1ª rodada. */
  const abilityUnitTargetsByInstance = new Map<
    string,
    { specId: string; pool: "primary" | "secondary"; side: "ally" | "enemy"; max: number }
  >();
  if (abilityDecision) {
    for (const q of abilityDecision.queue) {
      const isOn = abilityActivate[q.specId] ?? true;
      if (!isOn) continue;
      if (usesBoardTargetingForPrimary(q)) {
        for (const id of q.legalTargets) {
          const side = sideOfUnit(id);
          if (side) abilityUnitTargetsByInstance.set(id, { specId: q.specId, pool: "primary", side, max: q.targetCount?.max ?? 1 });
        }
      }
      if (usesBoardTargetingForSecondary(q)) {
        for (const id of q.secondaryTarget!.legalTargets) {
          const side = sideOfUnit(id);
          if (side) abilityUnitTargetsByInstance.set(id, { specId: q.specId, pool: "secondary", side, max: 1 });
        }
      }
    }
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

    const attackerUnit = attackerId ? publicUnits(view.players[seat]).find((u) => u.instanceId === attackerId) : null;

    const canAttackerTargetEnemyUnit = (attacker: CardInstance, targetUnit: CardInstance): boolean => {
      if (targetUnit.rested) return true;
      const staticRelax = attacker.def?.attackTargetRules?.mayTargetActiveEnemyUnit?.maxLevel ?? -1;
      if (staticRelax >= 0 && (targetUnit.def?.level ?? 999) <= staticRelax) return true;
      const granted =
        attacker.attackTargetRelaxUntilTurn?.turn === view.turnNumber
          ? attacker.attackTargetRelaxUntilTurn
          : undefined;
      if (granted?.maxLevel !== undefined && (targetUnit.def?.level ?? 999) <= granted.maxLevel) return true;
      if (granted?.maxAp !== undefined && (targetUnit.def?.ap ?? 999) <= granted.maxAp) return true;
      return false;
    };

    const isLegalTargetForSlot = (unit: CardInstance | null): boolean => {
      if (!unit) return false;
      if (selecting) {
        return legalTargetInstanceIds.has(unit.instanceId);
      }
      if (canBeTargeted) {
        return attackerUnit ? canAttackerTargetEnemyUnit(attackerUnit, unit) : unit.rested;
      }
      if (canBlockWith) {
        return hasKeyword(unit, "Blocker", boardForStats) && !unit.rested;
      }
      return false;
    };

    return Array.from({ length: 6 }).map((_, i) => {
      const unit = units[i] ?? null;
      // Frente 4 (feedback Willen 4ª rodada) — Unit recém-posta neste turno que
      // ainda não tocou a animação de pouso: `light` até custo 3, `heavy` acima.
      const justDeployed: "light" | "heavy" | undefined =
        unit && unit.enteredZoneOnTurn === view.turnNumber && !deployedSeenRef.current.has(unit.instanceId)
          ? (unit.def?.cost ?? 0) <= 3
            ? "light"
            : "heavy"
          : undefined;
      const ability = unit && canActivateHere ? fieldAbilityFor(unit) : null;
      const canActivate = Boolean(ability && myActiveResources >= ability.cost);
      const isLegal = isLegalTargetForSlot(unit);

      const canAttackThisUnit = canAttackFrom && Boolean(unit) && canUnitAttackNow(unit!);
      const isAttackTarget = canBeTargeted && isLegal;
      const actions =
        unit && (canAttackThisUnit || isAttackTarget || canBlockWith || canActivate)
          ? {
              onAttack: canAttackThisUnit
                ? (u: CardInstance) => {
                    const opponentPid = otherPlayer(seat);
                    const opponent = view.players[opponentPid];
                    const enemyUnits = publicUnits(opponent);
                    const hasLegalEnemyUnit = enemyUnits.some((eu) => canAttackerTargetEnemyUnit(u, eu));
                    const cannotTargetPlayer = Boolean(u.def?.attackTargetRules?.cannotTargetPlayer);

                    // Se não há unidades inimigas que possam ser alvos legais, o único alvo válido é o jogador:
                    if (!hasLegalEnemyUnit && !cannotTargetPlayer) {
                      declareAttack("player", u.instanceId);
                      return;
                    }

                    setAttackerId(u.instanceId);
                  }
                : undefined,
              // docs/55 tarefa 3 — som + delay de confirmação visual (300ms)
              // moram só dentro de `runAction` (evita tocar `playShieldBlock`
              // 2x — o clique disparava o som na hora E de novo lá dentro).
              onBlocker: canBlockWith && isLegal
                ? (u: CardInstance) => runAction({ kind: "activateBlocker", blockerId: u.instanceId })
                : undefined,
              onActivate: canActivate && ability ? (u: CardInstance) => startActivateAbility(u, ability) : undefined,
              // Fix 2 — `<Support>` reusa este botão; rótulo dedicado deixa claro.
              activateLabel: ability?.kind === "support" ? "Support" : undefined,
            }
          : undefined;
      const isDeployingUnit =
        isSelf &&
        !unit &&
        pending?.kind === "deploy" &&
        pendingCard?.def?.cardType === "UNIT" &&
        !pendingCard?.def?.pilotMode;

      const abilityTarget = unit ? abilityUnitTargetsByInstance.get(unit.instanceId) : undefined;
      const isAbilitySelected = Boolean(
        unit &&
          abilityTarget &&
          (abilityTarget.pool === "primary" ? abilityTargets[abilityTarget.specId] : abilitySecondaryTargets[abilityTarget.specId])?.includes(
            unit.instanceId,
          ),
      );

      return (
        <BattleSlot
          key={unit?.instanceId ?? `empty-${i}`}
          unit={unit}
          pilot={unit ? pairedPilotOf(player, unit) : null}
          art={art}
          targetingActive={targetingActive}
          legalTarget={isLegal}
          selected={Boolean(unit && selected.includes(unit.instanceId))}
          isAttacker={Boolean(unit && (attackerId === unit.instanceId || combat?.attackerId === unit.instanceId))}
          isBlocking={Boolean(unit && combat?.blockerUsedBy === unit.instanceId)}
          justDeployed={justDeployed}
          attacking={
            unit && activeStrike?.attackerId === unit.instanceId
              ? { towardX: activeStrike.towardX, towardY: activeStrike.towardY, phase: activeStrike.phase }
              : undefined
          }
          busy={busy || isPhaseBannerActive}
          state={boardForStats}
          abilityTargetPool={abilityTarget?.side ?? null}
          abilitySelected={isAbilitySelected}
          onSelect={(u) => {
            if (isPhaseBannerActive) return;
            // "Nova leva de correções" (item 4) — clique num alvo de habilidade
            // (glow verde/vermelho) tem prioridade sobre qualquer outro modo de
            // seleção: escreve direto no estado controlado que o
            // `AbilityResolutionModal` também lê, igual clicar numa pill lá dentro.
            if (abilityTarget) {
              if (abilityTarget.pool === "secondary") {
                setAbilitySecondaryTargets((s) => pickSecondaryTarget(s, abilityTarget.specId, u.instanceId));
              } else if (abilityTarget.max > 1) {
                setAbilityTargets((s) => toggleMultiTarget(s, abilityTarget.specId, u.instanceId, abilityTarget.max));
              } else {
                setAbilityTargets((s) => pickSingleTarget(s, abilityTarget.specId, u.instanceId));
              }
              return;
            }
            // docs/55 tarefa 2 — clicar direto no corpo da Unit inimiga (halo
            // verde) declara o ataque na hora, sem precisar do corner button.
            if (canBeTargeted && isLegal) {
              declareAttack({ unitId: u.instanceId });
              return;
            }
            toggleSelect(u.instanceId);
          }}
          onInspect={setInspect}
          onHoverCard={isWide ? setHoveredCard : undefined}
          actions={actions}
          registerRef={unit ? board.register(unit.instanceId) : undefined}
          emptySlotActive={isDeployingUnit}
          onEmptySlotClick={
            isDeployingUnit
              ? () => {
                  if (pendingCost > 0 && selectedResources.length !== pendingCost) {
                    showActionError(`Selecione ${pendingCost} recurso(s) ativo(s) para pagar o custo antes de invocar.`);
                    return;
                  }
                  executeDeploy(
                    pending!.cardInstanceId,
                    undefined,
                    pending!.sacrificeInstanceId,
                    selectedResources.length > 0 ? selectedResources : undefined,
                  );
                }
              : undefined
          }
        />
      );
    });
  }

  /** Classifica uma carta da mão: jogável? por quê não? quais modos de jogo?
   *  Usado tanto pra montar o `HandFan` quanto no `onPeek` dele (Fase D). */
  function describeHandCard(c: CardInstance) {
    const isCommand = c.def?.cardType === "COMMAND";
    const isDual = isCommand && !!c.def?.pilotMode;
    const modes = handPlayModes(c);
    const playable = modes.length > 0;
    const ctx = playabilityCtx();
    const effCost = effectiveCost(c.def, ctx.state, ctx.controller);
    const shortOnResources = ctx.activeResources < effCost;
    const effLevel = effectiveLevel(c.def, ctx.state, ctx.controller);
    const shortOnLevel = ctx.totalResources < effLevel;
    const blockedReason = playable
      ? undefined
      : shortOnLevel
        ? `Nível insuficiente — precisa de ${effLevel} recursos em campo.`
        : shortOnResources
          ? `Recursos insuficientes — custo ${effCost}, você tem ${ctx.activeResources} ativos.`
          : isDual
            ? "Nem o modo Comando nem o modo Piloto estão disponíveis agora."
            : isCommand
              ? "Este Comando não tem gatilho disponível agora."
              : c.def?.cardType === "PILOT" || c.def?.pilotMode
                ? (ctx.myTurnMain ? "Nenhuma Unit amiga sem Piloto pra parear." : notMainPhaseReason)
                : notMainPhaseReason;
    return { modes, playable, blockedReason, effectiveCost: effCost };
  }

  /** Índices dos shields de `player` que estão na seleção atual (adapter: a página
   *  seleciona por instanceId, o `ShieldRail` é index-based). */
  function selectedShieldIndexes(player: ViewPlayerState): number[] {
    return player.shields
      .map((s, i) => (selected.includes(s.instanceId) ? i : -1))
      .filter((i) => i >= 0);
  }

  /** Versos da mão do oponente (leitura de contagem, no topo da zona dele).
   *  V6.2 (docs/33): tamanho fixo (`text-[8px]`/`w-7`) nunca escalava com o
   *  resto da arena — sempre pequeno demais, e ficou pior ainda no modo
   *  expandido (tudo cresce, MENOS isto). Proporcional a `--card-w` agora,
   *  como toda outra peça da arena. */
  function opponentHandBacks(count: number, pid?: PlayerId) {
    return (
      <div
        ref={(el) => {
          board.register("hand:opponent")(el);
          if (pid) board.register(`hand:${pid}`)(el);
        }}
        className="flex items-center gap-1.5"
      >
        <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Mão ({count})</p>
        <div className="flex">
          {Array.from({ length: Math.min(count, 10) }).map((_, i) => (
            <img
              key={i}
              src={cardBackUrl}
              alt=""
              loading="lazy"
              className="-ml-3 aspect-[63/88] w-[calc(var(--card-w,3.5rem)*0.42)] border border-white/10 object-cover first:ml-0"
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
    const deckVisible = introStage === "complete" || !["field-ready", "player-choice", "field-highlight"].includes(introStage);
    const deckCount = deckVisible ? player.counts.deck : 0;
    const shieldsVisible = introStage === "complete" || introStage === "phase-banner";
    const shieldsCount = (!shieldsVisible || (setupAnim === "deal-shields" && isSelf)) ? 0 : player.counts.shields;
    // 【Activate·Main】 da Base (ex.: ST01-015 White Base "②", ST01-016
    // Asticassia "Rest this Base") — bug real: a Base nunca tinha esse botão,
    // só os Units da Battle Area (mesmo guard de `renderBattleSlots`).
    const canActivateBaseHere = isSelf && myTurnMain && !attackerId && !selecting;
    const myActiveResourcesForBase = player.resourceArea.filter((r) => !isHidden(r) && !(r as CardInstance).rested).length;
    const baseAbility = base && canActivateBaseHere ? fieldAbilityFor(base) : null;
    const canActivateBase = Boolean(baseAbility && myActiveResourcesForBase >= baseAbility.cost);
    const resources = (player.resourceArea.filter((c) => !isHidden(c)) as CardInstance[]).map((r) => ({
      instanceId: r.instanceId,
      rested: r.rested,
      isEx: r.def.isToken ?? false,
      code: r.def.code,
    }));

    // docs/55 tarefa 2 — clicar na trilha de Shields inimiga (igual clicar na
    // Base) declara o ataque direto na hora, sem modal intermediária.
    const isDirectAttackTarget = !isSelf && attackerId !== null && combat === null;
    return {
      shields: (
        <ShieldRail
          orientation="vertical"
          count={shieldsCount}
          underAim={Boolean(combat && combat.currentTarget === "player" && combat.defendingPlayer === pid)}
          legalTarget={isDirectAttackTarget}
          selectable={isDirectAttackTarget}
          selectedIndexes={selectedShieldIndexes(player)}
          onSelectArea={isDirectAttackTarget ? () => declareAttack("player") : undefined}
          onSelectIndex={(i) => {
            if (isDirectAttackTarget) {
              declareAttack("player");
              return;
            }
            const s = player.shields[i];
            if (s) toggleSelect(s.instanceId);
          }}
        />
      ),
      base: (
        <BaseCardGauge
          base={base}
          art={art}
          targetingActive={targetingActive}
          legalTarget={Boolean(
            (base && legalTargetInstanceIds.has(base.instanceId)) ||
            (!isSelf && attackerId !== null && combat === null),
          )}
          selected={Boolean(base && selected.includes(base.instanceId))}
          onSelect={
            !isSelf && attackerId !== null && combat === null
              ? () => declareAttack("player")
              : (b) => toggleSelect(b.instanceId)
          }
          onInspect={setInspect}
          onHoverCard={isWide ? setHoveredCard : undefined}
          onActivate={canActivateBase && baseAbility ? (b) => startActivateAbility(b, baseAbility) : undefined}
          busy={busy}
          struck={Boolean(activeStrike?.phase === "strike" && activeStrike.shieldsOf === pid)}
        />
      ),
      // Deck de Recursos + a linha de recursos, alinhados à esquerda na largura
      // da Battle Area para permitir que 7+ recursos se expandam sem quebrar linha.
      resources: (
        <div className="flex items-end justify-start gap-2">
          {/* deck de recursos / deck: contagem visível dos 2 lados (decisão do
              Willen 2026-09-03 — sim de teste, não PvP com info oculta). */}
          <CounterChip variant="stack" label="Deck de Recursos" count={player.counts.resourceDeck} />
          <ResourceMeter
            resources={resources}
            level={player.counts.resourceArea}
            art={art}
            readOnly={!isSelf}
            selectable={isSelf && Boolean(pending) && pendingCost > 0}
            selectedIds={isSelf ? selectedResources : undefined}
            onSelect={isSelf ? toggleResource : undefined}
            highlightTone={isSelf ? resourceHighlightTone : undefined}
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
          tone={deckCount <= 2 ? "crit" : deckCount <= 5 ? "warn" : "normal"}
        />
      ),
      trash: (
        <div ref={board.register(`trashStation:${pid}`)}>
          <PileTray
            label="Trash"
            count={player.trash.length}
            cards={player.trash.filter((c) => !isHidden(c)) as CardInstance[]}
            art={art}
            onInspect={setInspect}
          />
        </div>
      ),
      exile: (
        <div ref={board.register(`exileStation:${pid}`)}>
          <PileTray
            label="Exílio"
            count={player.exile.length}
            cards={player.exile.filter((c) => !isHidden(c)) as CardInstance[]}
            art={art}
            onInspect={setInspect}
          />
        </div>
      ),
      battleRow: renderBattleSlots(player, isSelf),
      battleAreaRef: board.register(playerAreaKey(pid)),
      shieldStationRef: board.register(playerShieldKey(pid)),
      shieldRailRef: board.register(`shieldRail:${pid}`),
      deckStationRef: board.register(`deckStation:${pid}`),
      handRef: isSelf ? board.register("hand:self") : undefined,
      handSummary: isSelf ? undefined : opponentHandBacks(player.hand.length, pid),
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
    if (pending?.kind !== "deploy" || !pendingCard || !pendingCard.def) return undefined;
    const isPilot = pendingCard.def?.cardType === "PILOT" || !!pendingCard.def?.pilotMode;
    if (!isPilot) return undefined;
    const selectedOwnUnitCodes = (view.players[seat].battleArea.filter((c) => !isHidden(c)) as CardInstance[])
      .filter((u) => u.def?.cardType === "UNIT" && selected.includes(u.instanceId))
      .map((u) => u.def?.code);
    const needs =
      pairingNeedsExtraTarget(pendingCard.def.code) ||
      selectedOwnUnitCodes.some((code) => pairingNeedsExtraTarget(undefined, code));
    return needs
      ? "Escolha a Unit pra parear e confirme — o 【When Paired】 (alvo) é resolvido logo depois do vínculo."
      : undefined;
  })();

  // Aviso da partida (capturas 4) — a MESMA intenção que o `ActionDock` resume
  // no canto, ecoada num painel no topo-centro. `null` nos momentos "sem
  // pendência" (a arena fala por si).
  const matchPrompt: string | null = (() => {
    if (gameOverResult) return null; // o GameOverOverlay assume
    if (myPendingDecision?.kind === "mulligan") return "Decida sua mão inicial (Mulligan)";
    if (oppPendingDecision?.kind === "mulligan") return "Oponente decidindo a mão inicial (Mulligan)…";
    if (myBurstDecision) return "Shield quebrada — resolva o 【Burst】";
    if (myPendingDecision?.kind === "triggerOrder") return "Ordene os gatilhos que vão resolver";
    if (myPendingDecision?.kind === "abilityResolution") return "Resolva o efeito ativado";
    if (myPendingDecision?.kind === "zoneOverflow") return "Battle Area cheia — escolha 1 Unit pra descartar";
    if (oppPendingDecision?.kind === "zoneOverflow") return "Oponente escolhendo qual Unit descartar (Battle Area cheia)…";
    if (pending?.kind === "activateAbility") {
      return pending.abilityNeedsTarget ? "Escolha o alvo e os recursos pra pagar o custo" : "Escolha os recursos pra pagar o custo";
    }
    if (pending) {
      const isUnit = pendingCard?.def?.cardType === "UNIT" && !pendingCard?.def?.pilotMode;
      const isPilot = pendingCard?.def?.cardType === "PILOT" || !!pendingCard?.def?.pilotMode;
      if (isPilot) {
        if (pendingCost > 0 && !resourcesReady) {
          return `Pague o custo: ${selectedResources.length}/${pendingCost} recurso(s) e escolha a Unit para parear`;
        }
        return pendingDeployHint ?? "Escolha a Unit para parear no tabuleiro e confirme";
      }
      if (isUnit) {
        if (pendingCost > 0 && !resourcesReady) {
          return `Pague o custo: ${selectedResources.length}/${pendingCost} recurso(s) (clique nos seus recursos)`;
        }
        return "Recurso pago! Posicionando Unit no campo…";
      }
      if (pendingDeployHint) return "Escolha a Unit pra parear e confirme";
      if (pendingCost > 0 && !resourcesReady) return `Pague o custo: ${selectedResources.length}/${pendingCost} recursos`;
      return "Escolha o alvo no tabuleiro e confirme";
    }
    if (attackerId) return "Escolha o alvo do ataque (Unit ou jogador)";
    if (iAmDefending) return "Defenda: ative um <Blocker> ou não bloqueie";
    if (inActionStep) {
      return iHaveEndPhasePriority
        ? "Fim de Turno — jogue um Comando 【Action】 ou passe"
        : "Passo de Ação — jogue um Comando 【Action】 ou passe";
    }
    return null;
  })();

  // TopTacticalHUD (docs/52) — ações contextuais inline embutidas no
  // `MatchPrompt`, no lugar dos antigos modais centrais bloqueantes.
  // Mutuamente exclusivos na prática (só 1 estado de decisão de cada vez):
  // `pending` (alvo/custo) manda em `onConfirm`/`onCancel`; sem `pending`,
  // `attackerId` (ataque declarado) assume `onCancel` sozinho — o alvo em si
  // já é escolhido clicando no tabuleiro (Unit ou área do jogador).
  const hudCancel = pending ? clearSelection : attackerId ? () => setAttackerId(null) : undefined;
  const hudConfirm = pending ? confirmPending : undefined;
  const hudCanConfirm = pending ? !(pendingCost > 0 && !resourcesReady) : true;
  const hudSkipBlock = iAmDefending ? () => runAction({ kind: "skipBlock" }) : undefined;
  const hudPassAction = inActionStep
    ? () => runAction(iHavePriority ? { kind: "passAction" } : { kind: "passEndPhaseAction" })
    : undefined;

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
            : `Jogando Comando (${pending.trigger === "Main" ? "Principal" : "Action"})`;
      const hint =
        pending.kind === "activateAbility"
          ? pending.abilityNeedsTarget
            ? (pendingCost > 0 ? "Escolha o alvo da habilidade e os recursos pra pagar o custo." : "Escolha o alvo da habilidade e confirme.")
            : (pendingCost > 0 ? "Escolha os recursos pra pagar o custo e confirme." : "Confirme para ativar a habilidade.")
          : pending.sacrificeInstanceId
            ? "Invocação por sacrifício pronta. Confirme para invocar."
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
      const what =
        oppPendingDecision.kind === "burst"
          ? "um 【Burst】"
          : oppPendingDecision.kind === "mulligan"
            ? "a mão inicial (Mulligan)"
            : oppPendingDecision.kind === "zoneOverflow"
              ? "qual Unit descartar (Battle Area cheia)"
              : "uma decisão";
      return {
        kind: "oppDecision",
        label: `Aguardando o oponente resolver ${what}…`,
      };
    }
    return {
      kind: "idle",
      yourTurn: myTurnMain,
      phaseLabel: PHASE_LABEL[view.phase] ?? view.phase,
      timerSeconds: turnSecondsLeft,
      turnNumber: view.turnNumber,
    };
  }

  const content = (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-slate-950 text-soft">
      {/* Header enxuto (capturas 3): sem barra — só ⚙ Config + 🐞 Bug flutuando
          no canto, liberando o topo pro tabuleiro. */}
      <div className="pointer-events-none absolute left-2 top-2 z-40 flex items-center gap-1.5">
        <div className="pointer-events-auto">
          <SettingsMenu
            autoPass={dockAutoPass}
            onToggleAutoPass={(v) => toggleAutoPass(v)}
            onLeave={exitToLobby}
            gameOver={Boolean(matchView?.view.gameOver)}
            busy={busy}
          />
        </div>
        {/* ZERO SYSTEM — Zero Coach HUD (Atalho 'Z') */}
        <Button
          variant="outline"
          size="icon"
          data-testid="zero-coach-dock-btn"
          className={`pointer-events-auto size-8 rounded-arena border-cyan-500/40 bg-slate-950/80 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all ${
            zeroCoachOpen ? "bg-cyan-500/30 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]" : ""
          }`}
          onClick={() => setZeroCoachOpen((v) => !v)}
          title="Abrir Zero Coach HUD (Atalho: Z)"
          aria-label="Abrir Zero Coach HUD"
          aria-pressed={zeroCoachOpen}
        >
          <BrainCircuit className="size-4" />
        </Button>
        {/* docs/44 Fase 3 §5.1 — bug report só pra jogador logado (guest do desafio
            por link não tem token; o servidor também recusa com 403). */}
        {getStoredAuth().token ? (
          <Button
            variant="outline"
            size="icon"
            className="pointer-events-auto size-8 rounded-arena border-amber-500/40 bg-slate-950/70 text-amber-400 hover:bg-amber-500/10"
            onClick={() => setBugReport({ open: true, busy: false, code: null })}
            title="Relatar um problema com esta partida"
            aria-label="Relatar um problema com esta partida"
          >
            <Bug className="size-4" />
          </Button>
        ) : null}
        {/* V6.1 (docs/32) — só faz sentido quando as asas laterais existem (isWide). */}
        {isWide ? (
          <Button
            variant="outline"
            size="icon"
            className="pointer-events-auto size-8 rounded-arena border-primary/40 bg-slate-950/70 text-primary hover:bg-primary/10"
            onClick={() => setBoardExpanded((v) => !v)}
            title={boardExpanded ? "Restaurar Detalhes da Carta" : "Expandir tabuleiro (esconde Detalhes da Carta)"}
            aria-label={boardExpanded ? "Restaurar Detalhes da Carta" : "Expandir tabuleiro"}
            aria-pressed={boardExpanded}
          >
            {boardExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        ) : null}
      </div>

      {/* Info de SISTEMA (não de jogo): status de conexão + transporte/RTT — chip
          minúsculo e discreto no canto inferior esquerdo (Frente 5, telemetria). */}
      <p className="pointer-events-none absolute bottom-1.5 left-2 z-30 flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] text-slate-600">
        <RefreshCw className={`size-2.5 ${connected ? "text-primary/70" : "animate-pulse text-slate-500"}`} />
        {connState === "live"
          ? `conectado · ${
              transportKind === "socket"
                ? lastPingMs !== null
                  ? `ws ${lastPingMs}ms`
                  : "ws"
                : "sse"
            }`
          : connState === "dead"
            ? "desconectado"
            : "conectando…"}
        {connected && transportKind === "socket" && opponentOnline === false ? (
          <span className="text-amber-500/70">· oponente ausente</span>
        ) : null}
      </p>

      {/* Banner de reconexão — só quando o SSE caiu e está tentando voltar. */}
      {connState === "reconnecting" || connState === "dead" ? (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[45] flex justify-center px-3">
          <div className="panel-cut flex items-center gap-2 border border-amber-400/60 bg-slate-950/95 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.06em] text-amber-200 shadow-2xl">
            <RefreshCw className={connState === "dead" ? "size-4" : "size-4 animate-spin"} />
            {connState === "dead"
              ? (deadReason ?? "Conexão perdida — recarregue a página")
              : `Reconectando…${reconnectAttempt > 1 ? ` (tentativa ${reconnectAttempt})` : ""}`}
          </div>
        </div>
      ) : null}

      {/* Sprint 4/6 (redesenho "Nível Arena") — o board é UM `ArenaPlaymat`
          travado em 16:9. Em telas largas (> 1400px) o espaço lateral que sobra
          vira asa: o inspetor de carta CRESCE (`flex-1`) pra preencher a
          esquerda, e um espelho `flex-1` invisível à direita mantém a arena
          centrada. */}
      <div
        className={
          "relative flex min-h-0 flex-1 items-stretch justify-center gap-3 overflow-hidden px-1 sm:px-3 py-2" +
          // V6.3 (docs/34): o cluster ⚙/🐞/expandir é `absolute` (não empurra
          // ninguém) — sem isso, o `CardInspectorPanel` (só existe com
          // `isWide`) começa no topo da linha e fica ATRÁS dos botões (fundo
          // transparente, print do Willen). Respiro só quando a asa existe.
          (isWide ? " pt-10" : "")
        }
      >
        {/* V6.1 (docs/32): `self-center` fazia a asa encolher pro tamanho do
            CONTEÚDO em vez de esticar pela altura da linha — por isso o
            painel "Nenhuma carta selecionada" ficava pequeno e colado no
            topo, com muito vazio embaixo (print do Willen). Removido: agora
            estica junto com a arena (`items-stretch` do pai), e o
            centralizar/preencher interno de `CardInspectorPanel` passa a
            valer de verdade. Também some quando `boardExpanded`. */}
        {isWide && !boardExpanded ? (
          <CardInspectorPanel
            card={hoveredCard}
            art={art}
            inPlay
            state={boardForStats}
            // Demanda 1 — o painel lateral (widescreen) também recebe PT/EN
            // separados pra o toggle de idioma aparecer aqui, não só no modal.
            effectPt={hoveredCard ? cardText[hoveredCard.def.code]?.pt : undefined}
            effectEn={hoveredCard ? cardText[hoveredCard.def.code]?.en : undefined}
            className="min-w-0 max-w-[28rem] flex-1 max-h-full overflow-hidden"
          />
        ) : null}
        {/* V6.2 (docs/33): `shrink-0` fazia esta caixa ignorar o espaço
            disponível de vez — sempre do tamanho que o canvas 16:9 "queria"
            (derivado só da ALTURA), nunca sabia que sobrava largura depois
            das asas. `flex-1` faz ela disputar a linha de verdade com as
            asas (que têm `max-w-[28rem]` — o excesso além disso já
            redistribui pra cá sozinho, é o próprio algoritmo de flexbox) —
            o canvas (`max-w-full` dele) agora enxerga a largura REAL
            sobrando, em vez de nunca crescer além do que a altura sozinha
            permitiria. Pré-requisito pro `useArenaScale` medir uma caixa
            que não é mais circular (antes: caixa media o canvas, canvas
            media a caixa). */}
        <div className="flex min-w-0 flex-1 justify-center">
          <ArenaPlaymat
            // No mobile (< 1024px) solta a trava de 16:9 — a proporção fixa
            // sobrava altura/largura sem uso e forçava o `useArenaScale` a
            // encolher o tabuleiro demais / cortá-lo (feedback Willen, celular).
            // Sem asas laterais nessa faixa, o canvas já ocupa a largura toda.
            expanded={(isWide && boardExpanded) || isMobile}
            highlightSide={
              introStage === "field-highlight"
                ? view.activePlayer === seat
                  ? "self"
                  : "opponent"
                : null
            }
            opponent={arenaSide(opponentSeat, false)}
            self={arenaSide(seat, true)}
            hand={
              <HandFan
                anchored
                cards={
                  introStage !== "complete" &&
                  ["field-ready", "player-choice", "field-highlight", "deck-appear", "deck-shuffle", "deal-hand", "mulligan-anim"].includes(introStage)
                    ? []
                    : setupAnim === "deal-hand" || setupAnim === "mulligan"
                    ? []
                    : myHandCards.map((c) => {
                        const { playable, blockedReason, effectiveCost: effCost } = describeHandCard(c);
                        const actionStepPlayable = Boolean(
                          inActionStep && playable && playableModes(c.def, playabilityCtx()).includes("commandAction"),
                        );
                        return { card: c, playable, blockedReason, effectiveCost: effCost, actionStepPlayable };
                      })
                }
                art={art}
                onPeek={(c) => {
                  if (busy || isPhaseBannerActive) return;
                  const { modes, blockedReason } = describeHandCard(c);
                  // "Jogar" (Sprint 5) — modo único: joga direto (o TopTacticalHUD guia alvo/custo).
                  if (modes.length === 1) {
                    modes[0].run();
                    return;
                  }
                  // Injogável: só avisa o motivo (use "Ver" pra abrir a arte).
                  if (modes.length === 0) {
                    toast(blockedReason ?? "Carta indisponível agora.");
                    return;
                  }
                  // docs/54 tarefa 5 — carta híbrida (Piloto vs Comando): seletor
                  // compacto no topo, SEM abrir o modal grande de inspeção.
                  setHandModeChoice({ card: c, modes });
                }}
                onInspect={(c) => {
                  if (isPhaseBannerActive) return;
                  // clicar no corpo da carta abre a modal de zoom pra leitura; se
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
        {/* V6.4 (docs/36) — 22rem → 28rem (pedido do Willen: "a carta na
            lateral e as informações textuais podem ser aumentadas ainda"),
            espelho em sincronia com o `max-w` do `CardInspectorPanel` acima
            pra arena continuar centrada. */}
        {isWide && !boardExpanded ? <div className="min-w-0 max-w-[28rem] flex-1" aria-hidden /> : null}
      </div>

      {/* Linha de mira + badge de combate (docs/19, Sessão 3) — overlay `fixed`, FORA do
          container que rola/escala, pra o `fixed` cobrir o viewport inteiro. */}
      {combat ? (
        <CombatLane
          combat={combat}
          attacker={attacker}
          targetUnit={combatTargetUnit}
          viewerSeat={seat}
          state={boardForStats}
          rectOf={board.rectOf}
        />
      ) : null}

      {/* Inspetor de carta (zoom) -- da mão (modal só pra carta dual) ou de qualquer carta pública do tabuleiro. */}
      {preview ? (
        <CardInspectorModal
          card={preview.card}
          art={art}
          blockedReason={preview.blockedReason}
          effectPt={cardText[preview.card.def.code]?.pt}
          effectEn={cardText[preview.card.def.code]?.en}
          linkedPilots={resolveLinkedPilots(preview.card.def)}
          onClose={() => setPreview(null)}
          footer={
            preview.modes.length > 0 ? (
              <>
                {preview.modes.map((m) => (
                  <Button
                    key={m.label}
                    className="w-full rounded-arena bg-primary text-primary-foreground hover:bg-primary/90"
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
          state={boardForStats}
          effectPt={cardText[inspect.def.code]?.pt}
          effectEn={cardText[inspect.def.code]?.en}
          linkedPilots={resolveLinkedPilots(inspect.def)}
          onClose={() => setInspect(null)}
        />
      ) : null}

      {/* Início de partida: revelação de iniciativa, depois o Mulligan sequenciado. */}
      {introStage === "player-choice" ? (
        <FirstPlayerReveal
          goesFirst={view.activePlayer === seat}
          onDismiss={() => {
            setIntroStage("field-highlight");
          }}
        />
      ) : null}
      {introStage === "mulligan-decision" && myPendingDecision?.kind === "mulligan" ? (
        <MulliganModal
          hand={myHandCards}
          art={art}
          busy={busy}
          cardW={board.rectOf(`deckStation:${seat}`)?.width ?? 60}
          onResolve={(keep) => {
            const oppSeat = otherPlayer(seat);
            const oppHasMulligan = view.pendingDecision[oppSeat]?.kind === "mulligan";
            if (keep) {
              mulliganDidMulliganRef.current = false;
              if (oppHasMulligan) {
                setIntroStage("waiting-opponent-mulligan");
              } else {
                setIntroStage("deal-shields");
                setSetupAnim("deal-shields");
              }
              runAction({ kind: "resolveMulligan", keep: true });
            } else {
              mulliganDidMulliganRef.current = true;
              setIntroStage("mulligan-anim");
              setSetupAnim("mulligan");
              runAction({ kind: "resolveMulligan", keep: false });
            }
          }}
        />
      ) : null}

      {/* Indicador de espera: quando o oponente está decidindo o Mulligan */}
      {introStage === "waiting-opponent-mulligan" ||
      (introStage === "mulligan-decision" && myPendingDecision?.kind !== "mulligan" && view.pendingDecision[opponentSeat]?.kind === "mulligan") ? (
        <div className="fixed inset-x-0 top-20 z-[48] flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 rounded-arena border border-cyan-400/40 bg-slate-950/90 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] backdrop-blur-md animate-pulse">
            <span className="size-2 rounded-full bg-cyan-400 animate-ping" />
            Aguardando decisão de Mulligan do oponente...
          </div>
        </div>
      ) : null}
      {/* docs/56 (revisão do plano de polimento) — desacoplado de `introStage`:
          essa era uma máquina de estados ONE-SHOT da abertura (turno 1) que,
          ao chegar em "complete", nunca mais volta a "phase-banner" sozinha.
          Renderizar só por `phaseBannerQueue.length > 0` deixa o banner
          reaparecer nos turnos seguintes, alimentado pelo efeito abaixo. */}
      {phaseBannerQueue.length > 0 ? (
        <PhaseAnnouncementBanner
          key={phaseBannerQueue[0]}
          phase={phaseBannerQueue[0]}
          onDone={handlePhaseBannerDone}
        />
      ) : null}

      {/* docs/19, Sessão 2/3 — decisões interativas. */}
      {commandCast ? (
        <CommandCastAnimation
          cardDef={commandCast.cardDef}
          art={art}
          origin={commandCast.origin}
          dest={commandCast.dest}
          cardW={board.rectOf(`deckStation:${seat}`)?.width ?? 60}
          onDone={() => {
            setCommandCast(null);
            commandCastResolveRef.current?.();
            commandCastResolveRef.current = null;
          }}
        />
      ) : null}
      {myBurstDecision && myBurstDecision.cardInstanceId !== burstRevealedId ? (
        <BurstRevealStage
          key={myBurstDecision.cardInstanceId}
          cardDef={myBurstDecision.cardDef}
          art={art}
          origin={shieldRailCenter(board.rectOf(`shieldRail:${seat}`))}
          cardW={board.rectOf(`deckStation:${seat}`)?.width ?? 60}
          onDone={() => setBurstRevealedId(myBurstDecision.cardInstanceId)}
        />
      ) : myBurstDecision ? (
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
          // V0 (docs/25): a lista de opções (já filtrada por HP/nível/descansada/
          // etc.) vem pronta em `decision.queue[i].legalTargets`, calculada no
          // servidor — aqui só resolve o RÓTULO pra mostrar, nunca decide quem
          // é legal (enemyUnit/friendlyUnit são sempre públicas na view; os
          // Recursos próprios rested também).
          resolveLabel={(instanceId) => {
            const enemyUnit = publicUnits(view.players[opponentSeat]).find((u) => u.instanceId === instanceId);
            if (enemyUnit) return enemyUnit.def.nameEn;
            const friendlyUnit = publicUnits(view.players[seat]).find((u) => u.instanceId === instanceId);
            if (friendlyUnit) return friendlyUnit.def.nameEn;
            const myTrashCard = view.players[seat].trash.find((c) => !isHidden(c) && c.instanceId === instanceId);
            if (myTrashCard && !isHidden(myTrashCard)) return myTrashCard.def.nameEn;
            const oppTrashCard = view.players[opponentSeat].trash.find((c) => !isHidden(c) && c.instanceId === instanceId);
            if (oppTrashCard && !isHidden(oppTrashCard)) return oppTrashCard.def.nameEn;
            const myRestedResources = (view.players[seat].resourceArea.filter((c) => !isHidden(c)) as CardInstance[]).filter(
              (r) => r.rested,
            );
            const resourceIndex = myRestedResources.findIndex((r) => r.instanceId === instanceId);
            if (resourceIndex >= 0) return `Recurso ${resourceIndex + 1} (gasto)`;
            return "Carta";
          }}
          // ST03-010 Full Frontal 【When Paired】 / ST04-002 Strike Gundam 【Deploy】
          // — resolve a carta da mão ou a recém-comprada do deck informada em `handDiscard.cards`.
          resolveHandLabel={(instanceId) => {
            const card = view.players[seat].hand.find((c) => !isHidden(c) && c.instanceId === instanceId);
            if (card && !isHidden(card)) return card.def.nameEn;
            if (myPendingDecision?.kind === "abilityResolution") {
              for (const q of myPendingDecision.queue) {
                const candidate = q.handDiscard?.cards?.find((c) => c.instanceId === instanceId);
                if (candidate) {
                  const isFromDeck = !view.players[seat].hand.some((h) => h.instanceId === instanceId);
                  const name = candidate.def.nameEn;
                  return isFromDeck ? `${name} (Comprada)` : name;
                }
              }
            }
            return "Carta";
          }}
          busy={busy}
          targets={abilityTargets}
          setTargets={setAbilityTargets}
          secondaryTargets={abilitySecondaryTargets}
          setSecondaryTargets={setAbilitySecondaryTargets}
          activate={abilityActivate}
          setActivate={setAbilityActivate}
          onResolve={(resolutions) => runAction({ kind: "resolveAbility", resolutions })}
        />
      ) : null}
      {myPendingDecision?.kind === "zoneOverflow" ? (
        <ZoneOverflowModal
          // V2 (docs/27): `legalTargets` são sempre as próprias Units — sempre
          // públicas na view (nunca precisa de resolveLabel/lookup escondido).
          units={publicUnits(view.players[seat]).filter((u) => myPendingDecision.legalTargets.includes(u.instanceId))}
          busy={busy}
          onResolve={(instanceId) => runAction({ kind: "resolveZoneOverflow", instanceId })}
        />
      ) : null}

      {/* Fase de Sideboard Bo3 (docs/54, docs/55) */}
      {matchView?.matchStatus === "SIDEBOARDING" ? (
        <SideboardModal
          matchId={matchId}
          seat={seat}
          initialDeck={matchView.sideboardDeck}
          sideboardDeadlineAt={matchView.sideboardDeadlineAt}
          sideboardConfirmed={matchView.sideboardConfirmed}
          bo3Score={matchView.bo3Score}
          currentGameIndex={matchView.currentGameIndex}
          art={art}
          busy={busy}
          onConfirmSwaps={handleSideboardSubmit}
          onInspectCard={(code) => {
            const foundDef =
              matchView.sideboardDeck?.main.find((c) => c.code === code) ??
              matchView.sideboardDeck?.sideboard.find((c) => c.code === code);
            if (foundDef) {
              setInspect({
                instanceId: `sideboard-inspect-${foundDef.code}`,
                def: foundDef,
                owner: seat,
                zone: "hand",
                rested: false,
                damage: 0,
                statModifiers: [],
                keywordGrants: [],
                usedKeywordsThisTurn: [],
                enteredZoneOnTurn: 0,
              });
            }
          }}
        />
      ) : null}

      {bugReport.open ? (
        <BugReportModal
          busy={bugReport.busy}
          shortCode={bugReport.code}
          onSubmit={submitBugReport}
          onClose={() => setBugReport({ open: false, busy: false, code: null })}
        />
      ) : null}

      {/* docs/19, Sessão 4 — feed de log de batalha (painel lateral retrátil / gaveta). */}
      <BattleLogDrawer entries={battleLog} open={logOpen} onToggle={() => setLogOpen((o) => !o)} />

      {/* ZERO SYSTEM — Zero Coach HUD (Atalho 'Z') */}
      <ZeroCoachHud
        open={zeroCoachOpen}
        onToggle={() => setZeroCoachOpen((o) => !o)}
        matchId={matchId}
        turnNumber={view?.turnNumber}
        activePlayer={view?.activePlayer}
        seat={seat}
        view={view}
      />

      {/* TopTacticalHUD (docs/52) — painel no topo-centro, fora do caminho do
          tabuleiro, nunca bloqueia clique/hover. Carrega os botões contextuais
          da jogada em andamento (confirmar/cancelar, não bloquear, passar
          ação) — substitui os antigos modais centrais bloqueantes. */}
      <MatchPrompt
        message={matchPrompt}
        tone={combat || iAmDefending || inActionStep ? "warn" : "info"}
        busy={busy || isPhaseBannerActive}
        onConfirm={hudConfirm}
        canConfirm={hudCanConfirm}
        onCancel={hudCancel}
        onSkipBlock={hudSkipBlock}
        onPassAction={hudPassAction}
      />

      {/* Feedback.pdf §5 — erro de JOGADA numa faixa própria (topo-centro, logo
          abaixo do `MatchPrompt`), longe do log (direita) e do `ActionDock`
          (canto). Some sozinho em 4s; clique fecha na hora. */}
      {actionError ? (
        <div className="fixed inset-x-0 top-16 z-[46] flex justify-center px-3">
          <button
            type="button"
            onClick={() => setActionError(null)}
            role="alert"
            className="panel-cut flex max-w-[min(34rem,calc(100vw-1.5rem))] items-center gap-2 border border-red-500/60 bg-slate-950/97 px-3.5 py-2 text-left text-xs font-semibold leading-snug text-red-200 shadow-2xl"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {actionError}
          </button>
        </div>
      ) : null}

      {/* docs/54 tarefa 5 — carta híbrida (Piloto vs Comando): seletor suspenso
          compacto no topo, no lugar do modal grande de inspeção. `Esc` ou o
          botão Cancelar fecham sem escolher nada. */}
      {handModeChoice ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[46] flex justify-center px-3">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-arena border border-primary/45 bg-slate-950/95 px-3.5 py-2 text-primary shadow-2xl backdrop-blur-sm">
            <p className="text-xs font-bold uppercase leading-snug tracking-[0.04em] sm:text-sm">
              {handModeChoice.card.def.nameEn} — escolha como jogar:
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {handModeChoice.modes.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const run = m.run;
                    setHandModeChoice(null);
                    run();
                  }}
                  className="rounded-arena border border-primary/50 bg-primary/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {m.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setHandModeChoice(null)}
                className="rounded-arena border border-white/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300 hover:bg-white/10"
              >
                Cancelar <span className="opacity-60">(Esc)</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Animação de setup ancorada nas zonas reais:
          Na abertura (shuffle, deal-hand, deal-shields), roda simultaneamente no jogador local e no oponente */}
      {setupAnim ? (
        <>
          {setupAnim === "single-draw" ? (
            view.activePlayer === seat ? (
              <DeckDealAnimation
                key="self-single-draw"
                mode="single-draw"
                label={SETUP_ANIM_LABEL["single-draw"]}
                origin={deckCenter(board.rectOf(`deckStation:${seat}`), false)}
                cardW={board.rectOf(`deckStation:${seat}`)?.width}
                dest={handCenter(board.rectOf("hand:self"), board.rectOf(`deckStation:${seat}`)?.width)}
                cards={(() => {
                  const visible = view.players[seat].hand.filter((c) => !isHidden(c)) as CardInstance[];
                  const last = visible[visible.length - 1];
                  return last ? [last] : undefined;
                })()}
                art={art}
                onDone={handleSetupAnimDone}
              />
            ) : (
              <DeckDealAnimation
                key="opp-single-draw"
                mode="single-draw"
                label="Oponente comprando…"
                origin={deckCenter(board.rectOf(`deckStation:${opponentSeat}`), true)}
                cardW={board.rectOf(`deckStation:${opponentSeat}`)?.width}
                dest={handCenter(
                  board.rectOf("hand:opponent") ?? board.rectOf(`hand:${opponentSeat}`),
                  board.rectOf(`deckStation:${opponentSeat}`)?.width,
                )}
                onDone={handleSetupAnimDone}
              />
            )
          ) : (
            <>
              <DeckDealAnimation
                key={`self-${setupAnim}`}
                mode={setupAnim}
                label={SETUP_ANIM_LABEL[setupAnim]}
                origin={deckCenter(board.rectOf(`deckStation:${seat}`), false)}
                cardW={board.rectOf(`deckStation:${seat}`)?.width}
                dest={
                  setupAnim === "deal-shields"
                    ? shieldRailCenter(board.rectOf(`shieldRail:${seat}`))
                    : handCenter(board.rectOf("hand:self"), board.rectOf(`deckStation:${seat}`)?.width)
                }
                cards={
                  setupAnim === "deal-hand" || setupAnim === "mulligan"
                    ? (view.players[seat].hand.filter((c) => !isHidden(c)) as CardInstance[])
                    : undefined
                }
                art={art}
                onDone={handleSetupAnimDone}
              />

              {setupAnim === "shuffle" || setupAnim === "deal-hand" || setupAnim === "deal-shields" ? (
                <DeckDealAnimation
                  key={`opp-${setupAnim}`}
                  mode={setupAnim}
                  origin={deckCenter(board.rectOf(`deckStation:${opponentSeat}`), true)}
                  cardW={board.rectOf(`deckStation:${opponentSeat}`)?.width}
                  dest={
                    setupAnim === "deal-shields"
                      ? shieldRailCenter(board.rectOf(`shieldRail:${opponentSeat}`))
                      : handCenter(
                          board.rectOf("hand:opponent") ?? board.rectOf(`hand:${opponentSeat}`),
                          board.rectOf(`deckStation:${opponentSeat}`)?.width,
                        )
                  }
                  onDone={() => {}}
                />
              ) : null}
            </>
          )}
        </>
      ) : null}

      {/* docs/56 tarefa 1 — clones voando pro Trash/Exílio (Unit destruída,
          descarte). Overlay independente do `DeckDealAnimation`: várias
          saídas podem coexistir e se autolimpam sozinhas. */}
      <CardDepartureAnimation
        cards={departures}
        art={art}
        onDone={(id) => setDepartures((cur) => cur.filter((g) => g.id !== id))}
      />

      {/* Slim Floating Action Ribbon (docs/52) — canto: fase/turno/timer,
          Passar turno, toggle de log e indicador discreto de ping/auto-pass.
          As decisões de jogada regular vivem no TopTacticalHUD acima. */}
      {!gameOverResult && introStage === "complete" ? (
        <ActionDock
          yourTurn={myTurnMain}
          inActionStep={inActionStep}
          phaseLabel={
            inActionStep
              ? iHaveEndPhasePriority
                ? "Fim de Turno"
                : "Passo de Ação"
              : (PHASE_LABEL[view.phase] ?? view.phase)
          }
          timerSeconds={turnSecondsLeft}
          turnNumber={view.turnNumber}
          busy={busy || isPhaseBannerActive}
          autoPass={dockAutoPass}
          pingMs={transportKind === "socket" ? lastPingMs : null}
          logOpen={logOpen}
          logCount={battleLog.length}
          onEndTurn={() => setShowEndTurnConfirm(true)}
          onPassAction={hudPassAction}
          onToggleLog={() => setLogOpen((o) => !o)}
          onToggleAutoPass={(next) => toggleAutoPass(next)}
        />
      ) : null}

      {/* Modal central reservado a decisões raras (confirmação explícita de
          encerrar turno, W.O. por abandono) — nunca cobre jogada regular. */}
      {!gameOverResult && introStage === "complete" ? (
        <CenterDecisionModal
          state={computeDockState()}
          busy={busy}
          confirmEndTurnOpen={showEndTurnConfirm}
          onEndTurn={() => {
            setShowEndTurnConfirm(false);
            runAction({ kind: "finishTurn" });
          }}
          onCancelEndTurn={() => setShowEndTurnConfirm(false)}
          onClaimAbandon={() => claimAbandon()}
        />
      ) : null}

      {gameOverResult ? (
        <GameOverOverlay
          won={gameOverResult.won}
          reason={gameOverResult.reason}
          redirectSeconds={redirectSecondsLeft}
          onLeave={leaveMatchScreen}
        />
      ) : null}
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

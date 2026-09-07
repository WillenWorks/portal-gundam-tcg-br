import type { CardInstance, GameState, PlayerId } from "../types";
import { effectiveAp, effectiveHp, hasKeyword, otherPlayer } from "../types";
import type { ViewCardInstance, ViewGameState, ViewPlayerState } from "../viewState";
import type { LegalAction } from "../legalActions";
import type { Rng } from "../rng";

/**
 * Featurização determinística do estado para a policy-value net (docs/50,
 * Fase 0 §2). `extractFeatures(view, seat)` devolve um `Float32Array` de
 * tamanho FIXO (`FEATURE_SIZE`) — mesmo `view` ⇒ mesmo vetor, sempre. Só lê o
 * que a VIEW do assento expõe (zonas ocultas do oponente entram como
 * contagem, nunca como identidade de carta) — mesma postura honesta de
 * `heuristicPolicy`.
 *
 * Também define o ESPAÇO DE AÇÃO discretizado (docs/50, Fase 0 §3):
 * `encodeAction` mapeia uma `LegalAction` num índice fixo `[0, ACTION_SPACE)`
 * de forma pura; `decodeActionIndex` faz o caminho de volta (índice + lista de
 * ações legais ⇒ uma `LegalAction` legal, com desempate determinístico + rng).
 */

// --- Featurização de estado -------------------------------------------------

/** Tamanho fixo do vetor de `extractFeatures`. Mudou o layout? Atualize aqui e o teste pega. */
export const FEATURE_SIZE = 72;

const PHASES = ["start", "draw", "resource", "main", "end"] as const;
const COMBAT_STEPS = ["attack", "block", "action", "damage", "battleEnd"] as const;
const PENDING_KINDS = ["mulligan", "zoneOverflow", "triggerOrder", "burst", "abilityResolution"] as const;

function isReal(card: ViewCardInstance): card is CardInstance {
  return !("hidden" in card);
}

function realCards(list: ViewCardInstance[]): CardInstance[] {
  return list.filter(isReal);
}

function asEngineState(view: ViewGameState): GameState {
  return view as unknown as GameState;
}

function remainingHp(card: CardInstance, state: GameState): number {
  return Math.max(0, effectiveHp(card, state) - card.damage);
}

/** 18 features por jogador — só zonas públicas + contagens (`counts`), nunca identidade oculta. */
function perPlayerFeatures(player: ViewPlayerState, state: GameState): number[] {
  const units = realCards(player.battleArea).filter((c) => c.def.cardType === "UNIT");
  const base = realCards(player.baseSection)[0] ?? null;

  const totalAp = units.reduce((sum, u) => sum + effectiveAp(u, state), 0);
  const totalHp = units.reduce((sum, u) => sum + effectiveHp(u, state), 0);
  const remHp = units.reduce((sum, u) => sum + remainingHp(u, state), 0);
  const activeResources = realCards(player.resourceArea).filter((r) => !r.rested).length;

  return [
    player.counts.hand / 10,
    player.counts.deck / 50,
    player.counts.resourceDeck / 10,
    player.counts.shields / 6,
    player.counts.trash / 30,
    player.counts.exile / 10,
    player.counts.resourceArea / 12,
    activeResources / 12,
    units.length / 6,
    totalAp / 40,
    totalHp / 40,
    units.filter((u) => u.rested).length / 6,
    units.filter((u) => hasKeyword(u, "Blocker")).length / 6,
    units.filter((u) => u.damage > 0).length / 6,
    remHp / 40,
    base ? 1 : 0,
    base ? remainingHp(base, state) / 10 : 0,
    base ? effectiveAp(base, state) / 10 : 0,
  ];
}

/** 11 features da própria mão do assento (visível pra ele). */
function viewerHandFeatures(hand: ViewCardInstance[]): number[] {
  const cards = realCards(hand);
  const costBuckets = [0, 0, 0, 0, 0, 0];
  const typeCounts: Record<string, number> = { UNIT: 0, PILOT: 0, COMMAND: 0, BASE: 0, RESOURCE: 0 };
  for (const card of cards) {
    const cost = Math.min(5, Math.max(0, card.def.cost ?? 0));
    costBuckets[cost] += 1;
    if (card.def.cardType in typeCounts) {
      typeCounts[card.def.cardType] += 1;
    }
  }
  return [
    ...costBuckets.map((n) => n / 10),
    typeCounts.UNIT / 10,
    typeCounts.PILOT / 10,
    typeCounts.COMMAND / 10,
    typeCounts.BASE / 10,
    typeCounts.RESOURCE / 10,
  ];
}

/** 25 features globais (fase, turno, combate, decisão pendente). */
function globalFeatures(view: ViewGameState, seat: PlayerId): number[] {
  const combat = view.combat;
  const pending = view.pendingDecision[seat];
  const endPhase = view.endPhaseAction;
  return [
    view.turnNumber / 20,
    view.activePlayer === seat ? 1 : 0,
    ...PHASES.map((p) => (view.phase === p ? 1 : 0)),
    combat ? 1 : 0,
    combat && combat.attackingPlayer === seat ? 1 : 0,
    combat && combat.defendingPlayer === seat ? 1 : 0,
    combat && combat.currentTarget === "player" ? 1 : 0,
    ...COMBAT_STEPS.map((s) => (combat && combat.step === s ? 1 : 0)),
    endPhase ? 1 : 0,
    endPhase && endPhase.priority === seat ? 1 : 0,
    pending ? 0 : 1,
    ...PENDING_KINDS.map((k) => (pending && pending.kind === k ? 1 : 0)),
    view.gameOver ? 1 : 0,
  ];
}

export function extractFeatures(view: ViewGameState, seat: PlayerId): Float32Array {
  const state = asEngineState(view);
  const opp = otherPlayer(seat);
  const values = [
    ...perPlayerFeatures(view.players[seat], state),
    ...perPlayerFeatures(view.players[opp], state),
    ...viewerHandFeatures(view.players[seat].hand),
    ...globalFeatures(view, seat),
  ];
  if (values.length !== FEATURE_SIZE) {
    throw new Error(`extractFeatures: vetor tem ${values.length} valores, esperado ${FEATURE_SIZE}`);
  }
  return Float32Array.from(values);
}

// --- Espaço de ação discretizado ------------------------------------------

const OFFSET = {
  pass: 0,
  skipBlock: 1,
  mulligan: 2, // keep=false -> 2, keep=true -> 3
  triggerOrder: 4,
  zoneOverflow: 5,
  burst: 6, // decline -> 6, activate -> 7
  resolveAbility: 8, // decline -> 8, activate -> 9
  block: 10,
  attackPlayer: 11, // + slot do atacante (0..5)
  attackUnit: 17, // + slot do atacante (0..5)
  deploy: 23, // + slot da mão (0..9)
  pairPilot: 33, // + slot da mão (0..9)
  playCommand: 43, // + slot da mão (0..9)
  activateAbility: 53, // + slot em battleArea+baseSection (0..8)
} as const;

const MAX_HAND_SLOT = 9;
const MAX_UNIT_SLOT = 5;
const MAX_ABILITY_SLOT = 8;

/** Total do espaço de ação. */
export const ACTION_SPACE = 62;

function clampSlot(index: number, max: number): number {
  if (index < 0) return max;
  return Math.min(index, max);
}

function handSlot(view: ViewGameState, instanceId: string): number {
  const hand = view.players[view.viewer].hand;
  return clampSlot(
    hand.findIndex((c) => c.instanceId === instanceId),
    MAX_HAND_SLOT,
  );
}

function unitSlot(view: ViewGameState, instanceId: string): number {
  const units = view.players[view.viewer].battleArea.filter(
    (c) => isReal(c) && c.def.cardType === "UNIT",
  );
  return clampSlot(
    units.findIndex((c) => c.instanceId === instanceId),
    MAX_UNIT_SLOT,
  );
}

function abilitySlot(view: ViewGameState, instanceId: string): number {
  const sources = [...view.players[view.viewer].battleArea, ...view.players[view.viewer].baseSection];
  return clampSlot(
    sources.findIndex((c) => c.instanceId === instanceId),
    MAX_ABILITY_SLOT,
  );
}

/** Índice fixo `[0, ACTION_SPACE)` de uma `LegalAction`. Pura em `(action, view)`. */
export function encodeAction(action: LegalAction, view: ViewGameState): number {
  switch (action.kind) {
    case "finishTurn":
    case "passAction":
    case "passEndPhaseAction":
      return OFFSET.pass;
    case "skipBlock":
      return OFFSET.skipBlock;
    case "resolveMulligan":
      return OFFSET.mulligan + (action.keep ? 1 : 0);
    case "resolveTriggerOrder":
      return OFFSET.triggerOrder;
    case "resolveZoneOverflow":
      return OFFSET.zoneOverflow;
    case "resolveBurstDecision":
      return OFFSET.burst + (action.activate ? 1 : 0);
    case "resolveAbility":
      return OFFSET.resolveAbility + (action.resolutions.some((r) => r.activate) ? 1 : 0);
    case "activateBlocker":
      return OFFSET.block;
    case "declareAttack":
      return action.target === "player"
        ? OFFSET.attackPlayer + unitSlot(view, action.attackerId)
        : OFFSET.attackUnit + unitSlot(view, action.attackerId);
    case "deployCard":
      return action.pairWithUnitId
        ? OFFSET.pairPilot + handSlot(view, action.cardInstanceId)
        : OFFSET.deploy + handSlot(view, action.cardInstanceId);
    case "playCommand":
      return OFFSET.playCommand + handSlot(view, action.cardInstanceId);
    case "activateAbility":
      return OFFSET.activateAbility + abilitySlot(view, action.sourceInstanceId);
    default:
      return OFFSET.pass;
  }
}

/** Máscara de ações legais: `1` nos índices ocupados por alguma ação de `legal`, `0` no resto. */
export function legalActionMask(legal: LegalAction[], view: ViewGameState): Float32Array {
  const mask = new Float32Array(ACTION_SPACE);
  for (const action of legal) {
    mask[encodeAction(action, view)] = 1;
  }
  return mask;
}

function enemyUnitValue(view: ViewGameState, unitId: string): number {
  const opp = otherPlayer(view.viewer);
  const unit = view.players[opp].battleArea.find((c) => c.instanceId === unitId);
  if (!unit || !isReal(unit)) return 0;
  const state = asEngineState(view);
  return effectiveAp(unit, state) + effectiveHp(unit, state);
}

/** Chave estável pra ordenar ações do mesmo bucket antes do desempate por rng. */
function stableKey(action: LegalAction, view: ViewGameState): string {
  if (action.kind === "declareAttack" && action.target !== "player") {
    return `z${(999 - enemyUnitValue(view, action.target.unitId)).toString().padStart(4, "0")}`;
  }
  return JSON.stringify(action);
}

/**
 * Volta de um índice do espaço de ação pra uma `LegalAction` legal. Filtra
 * `legal` pelas ações que codificam para `index`; se >1, ordena por
 * `stableKey` (determinístico — mais forte primeiro nos ataques) e sorteia
 * com `rng`. Devolve `null` se nenhuma ação legal cai nesse bucket.
 */
export function decodeActionIndex(
  index: number,
  legal: LegalAction[],
  view: ViewGameState,
  rng: Rng,
): LegalAction | null {
  const matches = legal.filter((a) => encodeAction(a, view) === index);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  matches.sort((a, b) => stableKey(a, view).localeCompare(stableKey(b, view)));
  return matches[Math.floor(rng() * matches.length)];
}

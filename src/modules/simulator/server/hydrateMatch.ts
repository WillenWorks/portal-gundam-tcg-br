import { PHASE_ORDER, type GameState, type PlayerId, type PlayerState, type CardInstance } from "../engine/types";

/**
 * docs/44 Fase 3 §5.1 — re-hidratação de um `GameState` vindo de JSON (linha
 * `SimulatorMatch.state`, ou o `gameState` de um `SimulatorBugReport`) num
 * `GameState` pronto pra `applyPlayerAction`. O servidor já fazia isso com um
 * cast cru (`row.state as unknown as GameState`); aqui a mesma re-hidratação
 * passa a VALIDAR o formato antes — um blob corrompido/adulterado é rejeitado
 * com `HydrateMatchError` em vez de explodir lá dentro do motor.
 *
 * Não transforma nada: valida e devolve o MESMO objeto tipado, pra o
 * round-trip `createGame → JSON → hydrateMatch` bater campo a campo.
 */
export class HydrateMatchError extends Error {
  constructor(message: string) {
    super(`GameState inválido: ${message}`);
    this.name = "HydrateMatchError";
  }
}

const PLAYER_IDS: PlayerId[] = ["A", "B"];

const ZONE_KEYS: Array<keyof PlayerState> = [
  "deck",
  "resourceDeck",
  "shields",
  "resourceArea",
  "battleArea",
  "baseSection",
  "trash",
  "exile",
  "hand",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new HydrateMatchError(message);
}

function validateCard(card: unknown, where: string): asserts card is CardInstance {
  assert(isPlainObject(card), `${where} não é um objeto`);
  assert(typeof card.instanceId === "string" && card.instanceId.length > 0, `${where}.instanceId ausente`);
  assert(isPlainObject(card.def), `${where}.def ausente`);
  assert(typeof card.def.code === "string" && card.def.code.length > 0, `${where}.def.code ausente`);
  assert(card.owner === "A" || card.owner === "B", `${where}.owner inválido`);
  assert(typeof card.zone === "string", `${where}.zone ausente`);
  assert(isFiniteNumber(card.damage), `${where}.damage não é número`);
  assert(typeof card.rested === "boolean", `${where}.rested não é booleano`);
  assert(Array.isArray(card.statModifiers), `${where}.statModifiers não é lista`);
  assert(Array.isArray(card.keywordGrants), `${where}.keywordGrants não é lista`);
  assert(Array.isArray(card.usedKeywordsThisTurn), `${where}.usedKeywordsThisTurn não é lista`);
}

function validatePlayerState(state: unknown, player: PlayerId): asserts state is PlayerState {
  assert(isPlainObject(state), `players.${player} não é um objeto`);
  assert(state.id === player, `players.${player}.id inconsistente`);
  for (const zone of ZONE_KEYS) {
    const cards = state[zone];
    assert(Array.isArray(cards), `players.${player}.${zone} não é lista`);
    cards.forEach((card, index) => validateCard(card, `players.${player}.${zone}[${index}]`));
  }
}

export function hydrateMatch(gameStateJson: unknown): GameState {
  assert(isPlainObject(gameStateJson), "não é um objeto");

  assert(isFiniteNumber(gameStateJson.turnNumber), "turnNumber não é número");
  assert(isFiniteNumber(gameStateJson.nextInstanceSeq), "nextInstanceSeq não é número");
  assert(isFiniteNumber(gameStateJson.seed), "seed não é número");
  assert(gameStateJson.activePlayer === "A" || gameStateJson.activePlayer === "B", "activePlayer inválido");
  assert(
    typeof gameStateJson.phase === "string" && (PHASE_ORDER as string[]).includes(gameStateJson.phase),
    "phase inválida",
  );

  assert(gameStateJson.combat === null || isPlainObject(gameStateJson.combat), "combat precisa ser objeto ou null");
  assert(
    gameStateJson.endPhaseAction === null || isPlainObject(gameStateJson.endPhaseAction),
    "endPhaseAction precisa ser objeto ou null",
  );
  assert(gameStateJson.gameOver === null || isPlainObject(gameStateJson.gameOver), "gameOver precisa ser objeto ou null");

  assert(isPlainObject(gameStateJson.pendingDecision), "pendingDecision ausente");
  for (const player of PLAYER_IDS) {
    const decision = gameStateJson.pendingDecision[player];
    assert(decision === null || isPlainObject(decision), `pendingDecision.${player} precisa ser objeto ou null`);
  }

  assert(Array.isArray(gameStateJson.eventLog), "eventLog não é lista");

  assert(isPlainObject(gameStateJson.players), "players ausente");
  for (const player of PLAYER_IDS) {
    validatePlayerState(gameStateJson.players[player], player);
  }

  if (gameStateJson.engineVersion !== undefined) {
    assert(typeof gameStateJson.engineVersion === "string", "engineVersion precisa ser string");
  }

  return gameStateJson as unknown as GameState;
}

import type { GameOverInfo, GameState, PlayerId } from "./types";
import type { DeckList } from "./setup";
import { createGame } from "./setup";
import type { EffectSpec, PredicateResolver, TargetFilterResolver } from "./effectSpec";
import { applyPlayerAction } from "./actions";
import { viewStateFor, type ViewGameState } from "./viewState";
import { createRng, type Rng } from "./rng";
import { actionOwner, enumerateLegalActions, type LegalAction } from "./legalActions";

/**
 * Motor de self-play (docs/44, Fase 1 — §3.4). Roda uma partida bot-vs-bot
 * usando o motor puro direto (nunca `matchStore`), guiada por uma `Policy` por
 * assento. A `policy` padrão (`randomLegal`) escolhe uniformemente entre as
 * ações que `enumerateLegalActions` devolve — é o que alimenta o fuzzing de
 * regressão (`scripts/gundam-fuzz.mjs`).
 *
 * Detecta:
 * - exceção do motor ao aplicar uma ação (`crashed`);
 * - exceção ao ENUMERAR ações legais (bug em `computeLegalTargets`/predicado — também `crashed`);
 * - estado onde ninguém pode agir mas o jogo não acabou, ou `pendingDecision`
 *   sem nenhuma resolução legal (`illegalState`);
 * - invariante de estado violada depois de uma ação (`illegalState`);
 * - partida que não termina em `maxTurns` (retorna `winner: null`, `reason: null`).
 */

export interface SelfPlayPolicy {
  (view: ViewGameState, legalActions: LegalAction[], rng: Rng): LegalAction;
}

/** Escolhe uniformemente entre as ações legais. */
export const randomLegal: SelfPlayPolicy = (_view, legalActions, rng) => {
  return legalActions[Math.floor(rng() * legalActions.length)];
};

export interface SelfPlayInput {
  deckA: DeckList;
  deckB: DeckList;
  seed: number;
  policyA?: SelfPlayPolicy;
  policyB?: SelfPlayPolicy;
  /** limite de turnos antes de declarar "não terminou" — default 200 */
  maxTurns?: number;
  specs?: EffectSpec[];
  predicateResolver?: PredicateResolver;
  targetFilterResolver?: TargetFilterResolver;
}

export interface SelfPlayResult {
  winner: PlayerId | null;
  reason: GameOverInfo["reason"] | null;
  turns: number;
  actionsPlayed: number;
  crashed?: { turn: number; action: LegalAction | null; error: string; stack?: string };
  illegalState?: string;
  /** estado final — útil pra debug/golden-master (Fase 2). */
  finalState: GameState;
}

/** Invariantes baratas checadas depois de cada ação. Devolve a descrição da 1ª violação, ou `null`. */
export function checkStateInvariants(state: GameState): string | null {
  if (state.pendingDecision.A && state.pendingDecision.B) {
    return "pendingDecision nos dois lados ao mesmo tempo";
  }
  const seen = new Map<string, string>();
  const zones = ["deck", "resourceDeck", "shields", "resourceArea", "battleArea", "baseSection", "trash", "exile", "hand"] as const;
  for (const pid of ["A", "B"] as PlayerId[]) {
    for (const zone of zones) {
      for (const card of state.players[pid][zone]) {
        const key = card.instanceId;
        const where = `${pid}.${zone}`;
        const prev = seen.get(key);
        if (prev) return `carta ${key} em duas zonas ao mesmo tempo (${prev} e ${where})`;
        seen.set(key, where);
        if (card.zone !== zone) return `carta ${key} em ${where} mas card.zone="${card.zone}"`;
      }
    }
    const unitCount = state.players[pid].battleArea.filter((c) => c.def.cardType === "UNIT").length;
    if (unitCount > 6 && !state.pendingDecision[pid]) {
      return `${pid} com ${unitCount} Units na Battle Area (>6) sem zoneOverflow pendente`;
    }
  }
  return null;
}

const POLICY_RNG_NONCE = 0x1a2b3c4d;

export function runSelfPlay(input: SelfPlayInput): SelfPlayResult {
  const maxTurns = input.maxTurns ?? 200;
  const specs = input.specs ?? [];
  const policyA = input.policyA ?? randomLegal;
  const policyB = input.policyB ?? randomLegal;
  const rng = createRng((input.seed ^ POLICY_RNG_NONCE) >>> 0);

  let state = createGame(input.deckA, input.deckB, { seed: input.seed, firstPlayer: "A", interactiveMulligan: true });
  let actionsPlayed = 0;
  // guarda de segurança: cada ação avança o estado por um passo lógico; um jogo
  // real termina bem antes disso (deckOut). Muito acima disso = loop de motor.
  const maxSteps = maxTurns * 400;

  for (let step = 0; step < maxSteps; step++) {
    if (state.gameOver) {
      return {
        winner: state.gameOver.winner,
        reason: state.gameOver.reason,
        turns: state.turnNumber,
        actionsPlayed,
        finalState: state,
      };
    }
    if (state.turnNumber > maxTurns) {
      return { winner: null, reason: null, turns: state.turnNumber, actionsPlayed, finalState: state };
    }

    const owner = actionOwner(state);
    if (!owner) {
      return {
        winner: null,
        reason: null,
        turns: state.turnNumber,
        actionsPlayed,
        illegalState: `nenhum jogador pode agir mas o jogo não acabou (phase=${state.phase}, combat=${state.combat?.step ?? "-"})`,
        finalState: state,
      };
    }

    let legal: LegalAction[];
    try {
      legal = enumerateLegalActions(state, owner, specs, {
        predicateResolver: input.predicateResolver,
        targetFilterResolver: input.targetFilterResolver,
      });
    } catch (err) {
      return {
        winner: null,
        reason: null,
        turns: state.turnNumber,
        actionsPlayed,
        crashed: { turn: state.turnNumber, action: null, error: errString(err), stack: errStack(err) },
        finalState: state,
      };
    }

    if (legal.length === 0) {
      const pending = state.pendingDecision[owner]?.kind ?? "-";
      return {
        winner: null,
        reason: null,
        turns: state.turnNumber,
        actionsPlayed,
        illegalState: `nenhuma ação legal para ${owner} (phase=${state.phase}, combat=${state.combat?.step ?? "-"}, pending=${pending})`,
        finalState: state,
      };
    }

    const policy = owner === "A" ? policyA : policyB;
    const action = policy(viewStateFor(state, owner), legal, rng);

    try {
      state = applyPlayerAction(state, owner, action, specs, input.predicateResolver, input.targetFilterResolver);
    } catch (err) {
      return {
        winner: null,
        reason: null,
        turns: state.turnNumber,
        actionsPlayed,
        crashed: { turn: state.turnNumber, action, error: errString(err), stack: errStack(err) },
        finalState: state,
      };
    }
    actionsPlayed++;

    const violation = checkStateInvariants(state);
    if (violation) {
      return {
        winner: null,
        reason: null,
        turns: state.turnNumber,
        actionsPlayed,
        illegalState: violation,
        finalState: state,
      };
    }
  }

  return { winner: null, reason: null, turns: state.turnNumber, actionsPlayed, finalState: state };
}

function errString(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

function errStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined;
}

/**
 * Golden-master do motor (docs/44, Fase 2 — §4.3). Roda uma partida
 * `randomLegal` vs `randomLegal` até o fim, para cada par de decks ST01–ST04
 * (incluindo espelhos), com um seed FIXO por par, e reduz o `GameState` final
 * a um hash SHA-256 estável. Um PR que muda qualquer resultado de regra do
 * motor muda o hash — e falha no CI se não for acompanhado de `--update` com
 * justificativa.
 *
 * O motor é 100% determinístico dado o seed (ver `engine/rng.ts` — mulberry32,
 * sem `Date`/`Math.random`), então o hash de uma partida é reprodutível.
 *
 * Compartilhado entre `scripts/gundam-golden.mjs` (CLI de check/update) e
 * `engine/goldenMaster.test.ts` (mesma checagem dentro do `pnpm test`).
 */

import type { GameState } from "../types";
import { runSelfPlay } from "../selfPlay";
import type { DeckList } from "../setup";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../../content";
import { buildSt01DeckList } from "../../fixtures/st01Deck";
import { buildSt02DeckList } from "../../fixtures/st02Deck";
import { buildSt03DeckList } from "../../fixtures/st03Deck";
import { buildSt04DeckList } from "../../fixtures/st04Deck";

export type DeckKey = "ST01" | "ST02" | "ST03" | "ST04";

const DECK_BUILDERS: Record<DeckKey, () => DeckList> = {
  ST01: buildSt01DeckList,
  ST02: buildSt02DeckList,
  ST03: buildSt03DeckList,
  ST04: buildSt04DeckList,
};

/** limite de turnos da partida golden — fixado aqui pra não depender do default de `runSelfPlay`. */
export const GOLDEN_MAX_TURNS = 200;

export interface GoldenPair {
  key: string;
  a: DeckKey;
  b: DeckKey;
  seed: number;
}

/**
 * Os 10 pares ST01–ST04 (i <= j, espelhos incluídos), cada um com um seed
 * fixo (1..10). Mudar um seed aqui = regravar o golden (`--update`) com
 * justificativa: o hash antigo deixa de valer.
 */
export const GOLDEN_PAIRS: GoldenPair[] = (() => {
  const keys: DeckKey[] = ["ST01", "ST02", "ST03", "ST04"];
  const pairs: GoldenPair[] = [];
  let seed = 1;
  for (let i = 0; i < keys.length; i++) {
    for (let j = i; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      pairs.push({ key: `${a}_vs_${b}_seed${seed}`, a, b, seed });
      seed++;
    }
  }
  return pairs;
})();

/**
 * Campos do `GameState` que NÃO fazem parte da lógica de regras e precisam
 * sair antes do hash:
 * - `engineVersion`: git sha / `"dev"` — muda a cada build, não é resultado de regra.
 * - `seed`: entrada da partida, não saída. Fixo por par (está na própria chave
 *   do golden), redundante dentro do estado.
 *
 * Tudo o mais é mantido — zonas, `damage`, `statModifiers`, `keywordGrants`,
 * `combat`, `pendingDecision`, `gameOver`, `turnNumber`, `nextInstanceSeq` e o
 * `eventLog` inteiro (histórico determinístico, o sinal de regressão mais rico).
 * `instanceId` é determinístico (`${owner}-${seq}`), não precisa normalização.
 */
export function normalizeGoldenState(state: GameState): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  delete clone.engineVersion;
  delete clone.seed;
  return clone;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      out[key] = sortKeysDeep(source[key]);
    }
    return out;
  }
  return value;
}

/** JSON com chaves ordenadas recursivamente — serialização canônica pro hash. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

/** SHA-256 hex via Web Crypto (disponível em Node >= 19 e no ambiente de teste). */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Roda a partida golden de um par e devolve o `GameState` final (bruto). */
export function runGoldenGame(pair: GoldenPair): GameState {
  const result = runSelfPlay({
    deckA: DECK_BUILDERS[pair.a](),
    deckB: DECK_BUILDERS[pair.b](),
    seed: pair.seed,
    maxTurns: GOLDEN_MAX_TURNS,
    specs: ALL_EFFECT_SPECS,
    predicateResolver: defaultPredicateResolver,
    targetFilterResolver: defaultTargetFilterResolver,
  });
  return result.finalState;
}

export interface GoldenOutcome {
  pair: GoldenPair;
  hash: string;
  normalized: Record<string, unknown>;
  /** resumo legível pro relatório do CLI (não entra no hash). */
  summary: { winner: string | null; reason: string | null; turns: number; events: number };
}

/** Computa o hash canônico da partida golden de um par. */
export async function computeGoldenOutcome(pair: GoldenPair): Promise<GoldenOutcome> {
  const finalState = runGoldenGame(pair);
  const normalized = normalizeGoldenState(finalState);
  const hash = await sha256Hex(canonicalJson(normalized));
  return {
    pair,
    hash,
    normalized,
    summary: {
      winner: finalState.gameOver?.winner ?? null,
      reason: finalState.gameOver?.reason ?? null,
      turns: finalState.turnNumber,
      events: finalState.eventLog.length,
    },
  };
}

/** Todos os 10 pares, na ordem de `GOLDEN_PAIRS`. */
export async function computeAllGoldenOutcomes(): Promise<GoldenOutcome[]> {
  const outcomes: GoldenOutcome[] = [];
  for (const pair of GOLDEN_PAIRS) {
    outcomes.push(await computeGoldenOutcome(pair));
  }
  return outcomes;
}

/** Pares cujo estado final normalizado é salvo por inteiro em `canonical/` pra debug de diff. */
export const CANONICAL_PAIR_KEYS: string[] = ["ST01_vs_ST01_seed1", "ST02_vs_ST03_seed6", "ST03_vs_ST04_seed9"];

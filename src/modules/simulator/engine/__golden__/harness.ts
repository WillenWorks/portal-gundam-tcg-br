/**
 * Golden-master do motor (docs/44, Fase 2 — §4.3; wave GD01, Fase 3B; wave
 * ST05). Roda uma partida `randomLegal` vs `randomLegal` até o fim, para cada
 * par de decks em `GOLDEN_PAIRS` (10 pares ST01–ST04 + 5 pares GD01 + 6 pares
 * ST05, incluindo espelhos), com um seed FIXO por par, e reduz o `GameState` final a um hash
 * SHA-256 estável. Um PR que muda qualquer resultado de regra do motor muda o
 * hash — e falha no CI se não for acompanhado de `--update` com justificativa.
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
import { buildSt05DeckList } from "../../fixtures/st05Deck";
import { buildGd01DeckList } from "../../fixtures/gd01Deck";
import { buildSt06DeckList } from "../../fixtures/st06Deck";
import { buildSt07DeckList } from "../../fixtures/st07Deck";
import { buildSt08DeckList } from "../../fixtures/st08Deck";
import { META_DECKS_GD02_ERA } from "../../fixtures/metaDecksGd02Era";
import { GD03_TEST_DECKS } from "../../fixtures/gd03Decks";
import { GD04_TEST_DECKS } from "../../fixtures/gd04Decks";
import { ST09_DECKS } from "../../fixtures/st09Decks";
import { GD05_DECKS } from "../../fixtures/gd05Decks";
import { ST10_TEST_DECKS } from "../../fixtures/st10Decks";
import { EB01_TEST_DECKS } from "../../fixtures/eb01Decks";

export type DeckKey =
  | "ST01" | "ST02" | "ST03" | "ST04" | "ST05" | "GD01"
  | "ST06" | "ST07" | "ST08"
  | "GD02-AEUG-EA" | "GD02-TEKKADAN-VAGAN" | "GD02-QUBELEY" | "GD02-AGE-WING" | "GD02-TITANS" | "ST06-GQUUUUUUX"
  | "GD03-CYCLOPS" | "GD03-TITANS-VAGAN"
  | "GD04-ACADEMY-CB" | "GD04-VULTURE-MILITIA"
  | "ST09-PURPLE-WHITE" | "ST09-RED-PURPLE"
  | "GD05-G-GUNDAM" | "GD05-NEO-ZEON"
  | "ST10-G-GENERATION" | "GD05-ORB"
  | "EB01-AZUL-BRANCO" | "EB01-VERDE-BRANCO";

const DECK_BUILDERS: Record<DeckKey, () => DeckList> = {
  ST01: buildSt01DeckList,
  ST02: buildSt02DeckList,
  ST03: buildSt03DeckList,
  ST04: buildSt04DeckList,
  ST05: buildSt05DeckList,
  GD01: buildGd01DeckList,
  ST06: buildSt06DeckList,
  ST07: buildSt07DeckList,
  ST08: buildSt08DeckList,
  "GD02-AEUG-EA": META_DECKS_GD02_ERA["META-GD02-AEUG-EA"].build,
  "GD02-TEKKADAN-VAGAN": META_DECKS_GD02_ERA["META-GD02-TEKKADAN-VAGAN"].build,
  "GD02-QUBELEY": META_DECKS_GD02_ERA["META-GD02-QUBELEY"].build,
  "GD02-AGE-WING": META_DECKS_GD02_ERA["META-GD02-AGE-WING"].build,
  "GD02-TITANS": META_DECKS_GD02_ERA["META-GD02-TITANS"].build,
  "ST06-GQUUUUUUX": META_DECKS_GD02_ERA["META-ST06-GQUUUUUUX"].build,
  "GD03-CYCLOPS": GD03_TEST_DECKS["GD03-CYCLOPS"].build,
  "GD03-TITANS-VAGAN": GD03_TEST_DECKS["GD03-TITANS-VAGAN"].build,
  "GD04-ACADEMY-CB": GD04_TEST_DECKS["GD04-ACADEMY-CB"].build,
  "GD04-VULTURE-MILITIA": GD04_TEST_DECKS["GD04-VULTURE-MILITIA"].build,
  "ST09-PURPLE-WHITE": ST09_DECKS["ST09-PURPLE-WHITE"].build,
  "ST09-RED-PURPLE": ST09_DECKS["ST09-RED-PURPLE"].build,
  "GD05-G-GUNDAM": GD05_DECKS["GD05-G-GUNDAM"].build,
  "GD05-NEO-ZEON": GD05_DECKS["GD05-NEO-ZEON"].build,
  "ST10-G-GENERATION": ST10_TEST_DECKS["ST10-G-GENERATION"].build,
  "GD05-ORB": GD05_DECKS["GD05-ORB"].build,
  "EB01-AZUL-BRANCO": EB01_TEST_DECKS["EB01-AZUL-BRANCO"].build,
  "EB01-VERDE-BRANCO": EB01_TEST_DECKS["EB01-VERDE-BRANCO"].build,
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
 *
 * NUNCA insira uma wave nova DENTRO deste loop (isso desloca os seeds 1..10
 * dos pares ST01-04 já gravados, mudando o replay e o hash de todos eles —
 * achado ao ligar a wave GD01, docs/47 §4.1B). Toda wave nova entra como um
 * bloco SEPARADO, abaixo, com seeds que continuam a partir do maior já usado.
 */
const ST01_04_PAIRS: GoldenPair[] = (() => {
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
 * Wave GD01 (Fase 3B) — 5 pares novos (GD01 contra cada starter + espelho),
 * seeds 11..15 (continuação de ST01-04, nunca reaproveitados). Deck de teste:
 * `fixtures/gd01Deck.ts` (mono-color, só cartas `implementada`/`vanilla` —
 * nenhuma `deferida`, ver docs/44 §6.3 / `content/validatedDecks.ts`).
 */
const GD01_PAIRS: GoldenPair[] = (() => {
  const others: DeckKey[] = ["ST01", "ST02", "ST03", "ST04"];
  const pairs: GoldenPair[] = [];
  let seed = ST01_04_PAIRS.length + 1;
  for (const other of others) {
    pairs.push({ key: `${other}_vs_GD01_seed${seed}`, a: other, b: "GD01", seed });
    seed++;
  }
  pairs.push({ key: `GD01_vs_GD01_seed${seed}`, a: "GD01", b: "GD01", seed });
  return pairs;
})();

/**
 * Wave ST05 (Iron-Blooded Struggle) — 6 pares novos (ST05 contra cada deck já
 * golden + espelho), seeds 16..21 (continuação de GD01_PAIRS, nunca
 * reaproveitados — mesma regra do bloco acima).
 */
const ST05_PAIRS: GoldenPair[] = (() => {
  const others: DeckKey[] = ["ST01", "ST02", "ST03", "ST04", "GD01"];
  const pairs: GoldenPair[] = [];
  let seed = ST01_04_PAIRS.length + GD01_PAIRS.length + 1;
  for (const other of others) {
    pairs.push({ key: `${other}_vs_ST05_seed${seed}`, a: other, b: "ST05", seed });
    seed++;
  }
  pairs.push({ key: `ST05_vs_ST05_seed${seed}`, a: "ST05", b: "ST05", seed });
  return pairs;
})();

/**
 * W0.4 — ST06–08 e os decks meta da era GD02 (GD02 + ST06), seeds 22..27 (continuação,
 * nunca reaproveitados — mesma regra dos blocos acima).
 */
const GD02_ERA_PAIRS: GoldenPair[] = (() => {
  const matchups: Array<[DeckKey, DeckKey]> = [
    ["ST06", "ST07"],
    ["ST07", "ST08"],
    ["ST08", "ST06"],
    ["GD02-AEUG-EA", "GD02-TEKKADAN-VAGAN"],
    ["GD02-QUBELEY", "GD02-TITANS"],
    ["GD02-AGE-WING", "ST06-GQUUUUUUX"],
  ];
  let seed = ST01_04_PAIRS.length + GD01_PAIRS.length + ST05_PAIRS.length + 1;
  return matchups.map(([a, b]) => {
    const pair = { key: `${a}_vs_${b}_seed${seed}`, a, b, seed };
    seed++;
    return pair;
  });
})();

/** W2c — GD03 fechado: 1 par dos decks de teste, seed 28 (continuação). */
const GD03_PAIRS: GoldenPair[] = [
  {
    key: `GD03-CYCLOPS_vs_GD03-TITANS-VAGAN_seed${ST01_04_PAIRS.length + GD01_PAIRS.length + ST05_PAIRS.length + GD02_ERA_PAIRS.length + 1}`,
    a: "GD03-CYCLOPS",
    b: "GD03-TITANS-VAGAN",
    seed: ST01_04_PAIRS.length + GD01_PAIRS.length + ST05_PAIRS.length + GD02_ERA_PAIRS.length + 1,
  },
];

/** W5 — GD04 fechado: 1 par dos decks de teste, seed 29 (continuação). */
const GD04_SEED = ST01_04_PAIRS.length + GD01_PAIRS.length + ST05_PAIRS.length + GD02_ERA_PAIRS.length + GD03_PAIRS.length + 1;
const GD04_PAIRS: GoldenPair[] = [
  { key: `GD04-ACADEMY-CB_vs_GD04-VULTURE-MILITIA_seed${GD04_SEED}`, a: "GD04-ACADEMY-CB", b: "GD04-VULTURE-MILITIA", seed: GD04_SEED },
];

/** W6 — ST09 fechado: 1 par das receitas oficiais, seed 30 (continuação). */
const ST09_SEED = GD04_SEED + GD04_PAIRS.length;
const ST09_PAIRS: GoldenPair[] = [
  { key: `ST09-PURPLE-WHITE_vs_ST09-RED-PURPLE_seed${ST09_SEED}`, a: "ST09-PURPLE-WHITE", b: "ST09-RED-PURPLE", seed: ST09_SEED },
];

/** W8 — GD05 fechado: 1 par das receitas oficiais (G Gundam × Neo Zeon — Special Move, ativar 【Main】 pareado, destruir as próprias Units), seed 31. */
const GD05_SEED = ST09_SEED + ST09_PAIRS.length;
const GD05_PAIRS: GoldenPair[] = [
  { key: `GD05-G-GUNDAM_vs_GD05-NEO-ZEON_seed${GD05_SEED}`, a: "GD05-G-GUNDAM", b: "GD05-NEO-ZEON", seed: GD05_SEED },
];

/** W9 — ST10 fechado: 1 par (ST10 puro × Orb do GD05 — Development N com escolha no exílio, custo alternativo), seed 32. */
const ST10_SEED = GD05_SEED + GD05_PAIRS.length;
const ST10_PAIRS: GoldenPair[] = [
  { key: `ST10-G-GENERATION_vs_GD05-ORB_seed${ST10_SEED}`, a: "ST10-G-GENERATION", b: "GD05-ORB", seed: ST10_SEED },
];

/** W11 — EB01 fechado: 1 par dos decks de teste (escopo "all Units", "all players look", Development 2), seed 33. */
const EB01_SEED = ST10_SEED + ST10_PAIRS.length;
const EB01_PAIRS: GoldenPair[] = [
  { key: `EB01-VERDE-BRANCO_vs_EB01-AZUL-BRANCO_seed${EB01_SEED}`, a: "EB01-VERDE-BRANCO", b: "EB01-AZUL-BRANCO", seed: EB01_SEED },
];

export const GOLDEN_PAIRS: GoldenPair[] = [
  ...ST01_04_PAIRS,
  ...GD01_PAIRS,
  ...ST05_PAIRS,
  ...GD02_ERA_PAIRS,
  ...GD03_PAIRS,
  ...GD04_PAIRS,
  ...ST09_PAIRS,
  ...GD05_PAIRS,
  ...ST10_PAIRS,
  ...EB01_PAIRS,
];

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
export const CANONICAL_PAIR_KEYS: string[] = [
  "ST01_vs_ST01_seed1",
  "ST02_vs_ST03_seed6",
  "ST03_vs_ST04_seed9",
  "GD01_vs_GD01_seed15",
];

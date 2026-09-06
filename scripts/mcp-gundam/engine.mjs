/*
 * Ponte do MCP `gundam` pro motor do simulador (docs/44, Fase 1 — grupo `sim`).
 *
 * Carrega o motor TS (`src/modules/simulator/`) por `import()` dinâmico — o
 * `server.mjs` registra o loader `tsx/esm` antes de importar este arquivo.
 * As partidas do MCP são EFÊMERAS (Map em memória + TTL), nunca tocam o
 * `SimulatorMatch` do Postgres.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "../..");
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;

const [
  { createGame },
  { advanceToMainPhase },
  { applyPlayerAction },
  { viewStateFor },
  { enumerateLegalActions },
  { runSelfPlay, randomLegal },
  { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver },
  st01,
  st02,
  st03,
  st04,
] = await Promise.all([
  import(sim("engine/setup.ts")),
  import(sim("engine/phases.ts")),
  import(sim("engine/actions.ts")),
  import(sim("engine/viewState.ts")),
  import(sim("engine/legalActions.ts")),
  import(sim("engine/selfPlay.ts")),
  import(sim("content/index.ts")),
  import(sim("fixtures/st01Deck.ts")),
  import(sim("fixtures/st02Deck.ts")),
  import(sim("fixtures/st03Deck.ts")),
  import(sim("fixtures/st04Deck.ts")),
]);

export const DECK_BUILDERS = {
  ST01: st01.buildSt01DeckList,
  ST02: st02.buildSt02DeckList,
  ST03: st03.buildSt03DeckList,
  ST04: st04.buildSt04DeckList,
};

export const DECK_KEYS = Object.keys(DECK_BUILDERS);

const RESOLVERS = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

function deckList(key) {
  const builder = DECK_BUILDERS[String(key).toUpperCase()];
  if (!builder) throw new Error(`Deck desconhecido "${key}". Válidos: ${DECK_KEYS.join(", ")}`);
  return builder();
}

// ---------------------------------------------------------------------------
// Store efêmero de partidas (Map + TTL)
// ---------------------------------------------------------------------------

const MATCH_TTL_MS = 30 * 60_000;
const matches = new Map();

function sweep() {
  const now = Date.now();
  for (const [id, m] of matches) {
    if (now - m.touchedAt > MATCH_TTL_MS) matches.delete(id);
  }
}

function requireMatch(matchId) {
  sweep();
  const m = matches.get(matchId);
  if (!m) throw new Error(`Partida efêmera "${matchId}" não existe (ou expirou após ${MATCH_TTL_MS / 60000}min).`);
  m.touchedAt = Date.now();
  return m;
}

export function simNew({ deckA, deckB, seed }) {
  sweep();
  const resolvedSeed = Number.isFinite(seed) ? Number(seed) : Math.floor(Math.random() * 2 ** 31);
  const state = advanceToMainPhase(
    createGame(deckList(deckA), deckList(deckB), { seed: resolvedSeed, firstPlayer: "A" }),
  );
  const matchId = `mcp-${resolvedSeed}-${Math.random().toString(36).slice(2, 8)}`;
  matches.set(matchId, {
    state,
    deckKeys: { A: String(deckA).toUpperCase(), B: String(deckB).toUpperCase() },
    seed: resolvedSeed,
    createdAt: Date.now(),
    touchedAt: Date.now(),
  });
  return { matchId, seed: resolvedSeed, deckKeys: matches.get(matchId).deckKeys, phase: state.phase, activePlayer: state.activePlayer };
}

export function simView({ matchId, seat }) {
  const m = requireMatch(matchId);
  return { matchId, seat, deckKeys: m.deckKeys, view: viewStateFor(m.state, seat) };
}

export function simLegal({ matchId, seat }) {
  const m = requireMatch(matchId);
  const actions = enumerateLegalActions(m.state, seat, ALL_EFFECT_SPECS, RESOLVERS);
  return { matchId, seat, count: actions.length, actions };
}

export function simAct({ matchId, seat, action }) {
  const m = requireMatch(matchId);
  const before = m.state.eventLog.length;
  m.state = applyPlayerAction(m.state, seat, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
  m.touchedAt = Date.now();
  const newEvents = m.state.eventLog.slice(before);
  return {
    matchId,
    seat,
    applied: action,
    newEvents,
    gameOver: m.state.gameOver,
    view: viewStateFor(m.state, seat),
  };
}

export function simSelfplay({ deckA, deckB, games = 20, seed = 1, maxTurns = 200 }) {
  const out = {
    deckA: String(deckA).toUpperCase(),
    deckB: String(deckB).toUpperCase(),
    games,
    crashes: [],
    illegalStates: [],
    unfinished: [],
    winA: 0,
    winB: 0,
    avgTurns: 0,
  };
  let turnSum = 0;
  for (let g = 0; g < games; g++) {
    const s = Number(seed) + g;
    const r = runSelfPlay({
      deckA: DECK_BUILDERS[out.deckA](),
      deckB: DECK_BUILDERS[out.deckB](),
      seed: s,
      maxTurns,
      specs: ALL_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
      policyA: randomLegal,
      policyB: randomLegal,
    });
    turnSum += r.turns;
    if (r.crashed) out.crashes.push({ seed: s, ...r.crashed });
    else if (r.illegalState) out.illegalStates.push({ seed: s, detail: r.illegalState });
    else if (r.winner === null) out.unfinished.push({ seed: s, turns: r.turns });
    else if (r.winner === "A") out.winA++;
    else out.winB++;
  }
  out.avgTurns = Number((turnSum / games).toFixed(1));
  return out;
}

export function activeMatchIds() {
  sweep();
  return [...matches.keys()];
}

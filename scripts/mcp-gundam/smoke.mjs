/*
 * Smoke test do MCP `gundam` (docs/44, Fase 1): chama cada tool uma vez, sem
 * subir o transporte MCP — exercita `catalog.mjs` + `engine.mjs` direto.
 * Sai com código != 0 se alguma chamada lançar.
 *
 *   node scripts/mcp-gundam/smoke.mjs
 */

import { register } from "tsx/esm/api";
import process from "node:process";

register();

const catalog = await import("./catalog.mjs");
const engine = await import("./engine.mjs");
const { TOOL_NAMES, buildServer } = await import("./mcp.mjs");

const failures = [];
function check(name, fn) {
  try {
    const out = fn();
    const summary = JSON.stringify(out).slice(0, 160);
    console.log(`ok   ${name}  ${summary}`);
  } catch (err) {
    failures.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    console.error(`FAIL ${name}: ${err instanceof Error ? err.stack : String(err)}`);
  }
}
async function checkAsync(name, fn) {
  try {
    const out = await fn();
    console.log(`ok   ${name}  ${JSON.stringify(out).slice(0, 160)}`);
  } catch (err) {
    failures.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    console.error(`FAIL ${name}: ${err instanceof Error ? err.stack : String(err)}`);
  }
}

// buildServer não deve lançar e deve registrar as 8 tools
check("buildServer", () => {
  const s = buildServer();
  if (!s) throw new Error("buildServer devolveu vazio");
  return { tools: TOOL_NAMES.length };
});

check("gundam_get_card(ST01-001)", () => {
  const r = catalog.getCard("ST01-001");
  if (!r.found) throw new Error("não achou ST01-001");
  return { coverage: r.coverage, specs: r.effectSpecs.length };
});
check("gundam_get_card(ST03-006)", () => catalog.getCard("ST03-006").coverage);
check("gundam_search_glossary(Breach)", () => {
  const r = catalog.searchGlossary("Breach");
  if (r.count === 0) throw new Error("glossário sem 'Breach'");
  return { count: r.count };
});
check("gundam_coverage()", () => catalog.coverage().summary);
check("gundam_coverage(ST01)", () => {
  const r = catalog.coverage("ST01");
  if (!r.cards || r.cards.length === 0) throw new Error("ST01 sem cartas");
  return r.summary;
});
check("gundam_similar_specs(deal damage)", () => {
  const r = catalog.similarSpecs("Choose 1 enemy Unit. Deal 2 damage to it.", 3);
  if (r.results.length === 0 || r.results.length > 3) throw new Error(`esperava 1..3 resultados, veio ${r.results.length}`);
  const scores = r.results.map((x) => x.score);
  if (scores.some((s, i) => i > 0 && s > scores[i - 1])) throw new Error("resultados fora de ordem (score desc)");
  const top3 = r.results.map((x) => x.cardCode);
  if (!top3.includes("ST03-013") || !top3.includes("ST03-015")) {
    throw new Error(`esperava Close Combat (ST03-013) e Rewloola (ST03-015) no top 3, veio ${top3.join(", ")}`);
  }
  return { top: r.results.map((x) => `${x.id}=${x.score}`) };
});
check("gundam_similar_specs(look at top)", () => {
  const r = catalog.similarSpecs("Look at the top 3 cards of your deck...", 3);
  if (r.results[0]?.cardCode !== "ST03-006") throw new Error(`esperava Char's Zaku II (ST03-006) no topo, veio ${r.results[0]?.cardCode}`);
  return { top: r.results[0].id };
});
await checkAsync("gundam_get_card postgres branch", () => catalog.getCardFromPostgres("ST01-001"));

// sim
let matchId;
check("sim_new(ST01,ST02)", () => {
  const r = engine.simNew({ deckA: "ST01", deckB: "ST02", seed: 42 });
  matchId = r.matchId;
  return r;
});
check("sim_view", () => {
  const r = engine.simView({ matchId, seat: "A" });
  return { phase: r.view.phase, turn: r.view.turnNumber };
});
check("sim_legal", () => {
  const r = engine.simLegal({ matchId, seat: "A" });
  if (r.count === 0) throw new Error("sem ações legais na Main Phase inicial");
  return { count: r.count };
});
check("sim_act(finishTurn)", () => {
  const r = engine.simAct({ matchId, seat: "A", action: { kind: "finishTurn" } });
  return { events: r.newEvents.length };
});
check("sim_selfplay(ST01,ST02,x5)", () => {
  const r = engine.simSelfplay({ deckA: "ST01", deckB: "ST02", games: 5, seed: 1 });
  if (r.crashes.length || r.illegalStates.length) throw new Error(`selfplay achou ${r.crashes.length} crash / ${r.illegalStates.length} ilegal`);
  return { winA: r.winA, winB: r.winB, avgTurns: r.avgTurns };
});

if (failures.length > 0) {
  console.error(`\n${failures.length} FALHA(S):\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("\nsmoke ok — todas as tools do mcp-gundam responderam");

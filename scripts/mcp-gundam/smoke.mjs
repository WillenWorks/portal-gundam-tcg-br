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

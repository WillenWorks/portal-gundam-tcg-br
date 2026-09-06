/*
 * Servidor MCP `gundam` (docs/44, Fase 1 — §3).
 *
 * Dois transportes:
 *   - stdio  — pro Claude Code (`.mcp.json` na raiz). Ver `server.mjs`.
 *   - HTTP   — `attachMcpHttp(app)` monta `POST /mcp` (stateless) num Express
 *              existente. NÃO está plugado no `server/index.ts` ainda (decisão
 *              docs/44: só plugar se não houver risco) — ver `docs/46`.
 *
 * Grupos de tool:
 *   catalog — gundam_get_card, gundam_search_glossary, gundam_coverage
 *   sim     — sim_new, sim_view, sim_legal, sim_act, sim_selfplay
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import * as catalog from "./catalog.mjs";
import * as engine from "./engine.mjs";

function jsonResult(payload) {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function wrap(fn) {
  return async (args) => {
    try {
      return jsonResult(await fn(args));
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `Erro: ${err instanceof Error ? err.message : String(err)}` }] };
    }
  };
}

const DECK_ENUM = z.enum(["ST01", "ST02", "ST03", "ST04"]);
const SEAT_ENUM = z.enum(["A", "B"]);

export function buildServer() {
  const server = new McpServer({ name: "gundam", version: "0.1.0" });

  // -- catalog -------------------------------------------------------------
  server.registerTool(
    "gundam_get_card",
    {
      description:
        "Junta tudo que se sabe de uma carta: texto oficial EN + stats (dataset), CardDef do motor (fixture ST01-04 se houver), EffectSpecs autorados, status de cobertura e, se o Postgres estiver disponível, o CardModel.",
      inputSchema: { code: z.string().describe("código da carta, ex. ST01-001 / GD01-010") },
    },
    wrap(async ({ code }) => {
      const base = catalog.getCard(code);
      const postgres = await catalog.getCardFromPostgres(code);
      return { ...base, postgres };
    }),
  );

  server.registerTool(
    "gundam_search_glossary",
    {
      description: "Busca um termo no glossário de tradução (docs/17-glossario-traducao.md) e devolve as linhas com contexto.",
      inputSchema: { term: z.string().describe("termo a buscar, ex. Breach, Link, escudo") },
    },
    wrap(async ({ term }) => catalog.searchGlossary(term)),
  );

  server.registerTool(
    "gundam_coverage",
    {
      description:
        "Tabela de cobertura de EffectSpec por set (carta / effectSpec / vanilla / faltando), computada de ALL_EFFECT_SPECS + fixtures + gcg-official-cards.json. Sem `set`: só o resumo por set. Com `set`: também a lista carta a carta.",
      inputSchema: { set: z.string().optional().describe("filtra por set, ex. ST03, GD01") },
    },
    wrap(async ({ set }) => catalog.coverage(set)),
  );

  // -- sim ---------------------------------------------------------------
  server.registerTool(
    "sim_new",
    {
      description:
        "Cria uma partida EFÊMERA (memória + TTL 30min, não toca o Postgres) já na Main Phase do turno 1 (mulligan pulado). Devolve o matchId.",
      inputSchema: {
        deckA: DECK_ENUM,
        deckB: DECK_ENUM,
        seed: z.number().int().optional().describe("seed determinístico; omitido = aleatório"),
      },
    },
    wrap(async ({ deckA, deckB, seed }) => engine.simNew({ deckA, deckB, seed })),
  );

  server.registerTool(
    "sim_view",
    {
      description: "Visão redigida (mesmo `viewStateFor` do servidor) da partida efêmera para um dos assentos.",
      inputSchema: { matchId: z.string(), seat: SEAT_ENUM },
    },
    wrap(async ({ matchId, seat }) => engine.simView({ matchId, seat })),
  );

  server.registerTool(
    "sim_legal",
    {
      description: "Enumera todas as ações legais (PlayerAction) do assento agora, via `enumerateLegalActions`.",
      inputSchema: { matchId: z.string(), seat: SEAT_ENUM },
    },
    wrap(async ({ matchId, seat }) => engine.simLegal({ matchId, seat })),
  );

  server.registerTool(
    "sim_act",
    {
      description:
        "Aplica uma PlayerAction do assento (mesma borda `applyPlayerAction` do servidor). Devolve os novos eventos + a visão atualizada. Pegue a `action` de `sim_legal`.",
      inputSchema: {
        matchId: z.string(),
        seat: SEAT_ENUM,
        action: z.record(z.string(), z.any()).describe("um objeto PlayerAction, ex. { kind: \"finishTurn\" }"),
      },
    },
    wrap(async ({ matchId, seat, action }) => engine.simAct({ matchId, seat, action })),
  );

  server.registerTool(
    "sim_selfplay",
    {
      description:
        "Roda N partidas randomLegal-vs-randomLegal (via `runSelfPlay`) e agrega { crashes, illegalStates, unfinished, winA, winB, avgTurns }.",
      inputSchema: {
        deckA: DECK_ENUM,
        deckB: DECK_ENUM,
        games: z.number().int().min(1).max(500).default(20),
        seed: z.number().int().default(1),
        policyA: z.literal("randomLegal").optional(),
        policyB: z.literal("randomLegal").optional(),
      },
    },
    wrap(async ({ deckA, deckB, games, seed }) => engine.simSelfplay({ deckA, deckB, games, seed })),
  );

  return server;
}

export const TOOL_NAMES = [
  "gundam_get_card",
  "gundam_search_glossary",
  "gundam_coverage",
  "sim_new",
  "sim_view",
  "sim_legal",
  "sim_act",
  "sim_selfplay",
];

/**
 * Monta `POST /mcp` num Express existente, em modo STATELESS (uma instância de
 * server + transport por request). Espera que quem chama já tenha aplicado
 * `express.json()` e o middleware de auth desejado (ex. `authRequired`).
 *
 * NÃO é chamado pelo `server/index.ts` nesta fase — ver `docs/46`. Pra plugar:
 *   import { attachMcpHttp } from "../scripts/mcp-gundam/mcp.mjs";
 *   attachMcpHttp(app); // atrás de authRequired
 */
export async function attachMcpHttp(app, { route = "/mcp", middleware = [] } = {}) {
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");

  app.post(route, ...middleware, async (req, res) => {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
      }
    }
  });

  return app;
}

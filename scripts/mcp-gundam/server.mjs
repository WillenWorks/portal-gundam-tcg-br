/*
 * Entry-point do servidor MCP `gundam` no transporte stdio (docs/44, Fase 1).
 * Registrado em `.mcp.json` na raiz do repo pro Claude Code.
 *
 *   node scripts/mcp-gundam/server.mjs
 *
 * Registra o loader `tsx/esm` ANTES de importar qualquer módulo que puxe o
 * motor TS (`src/modules/simulator/`), depois sobe o servidor no stdio.
 */

import { register } from "tsx/esm/api";

register();

const { buildServer } = await import("./mcp.mjs");
const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");

const server = buildServer();
const transport = new StdioServerTransport();
await server.connect(transport);

// stderr, nunca stdout — stdout é o canal do protocolo MCP.
console.error("[mcp-gundam] servidor MCP no stdio pronto");

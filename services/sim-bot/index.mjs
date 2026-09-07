import "dotenv/config";

import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { hydrateMatch } from "../../src/modules/simulator/server/hydrateMatch.ts";
import { botSeatFromSeats } from "../../src/modules/simulator/server/trainingMatch.ts";
import { driveBotTurn } from "./driveBotTurn.mjs";

/**
 * Worker do bot de treino (docs/44 Fase 2 §10.2). Faz polling da tabela
 * `SimulatorBotTurn`, e para cada linha `pending` (mais antiga primeiro):
 *   1. marca `processing` (com guarda otimista — outra instância não rouba);
 *   2. carrega a `SimulatorMatch`, hidrata o `GameState`, descobre o assento
 *      do bot e a dificuldade;
 *   3. roda `driveBotTurn` — heurística em loop até o turno acabar, aplicando
 *      cada ação de volta pela API autoritativa (`POST /matches/:id/actions`),
 *      autenticado como conta de serviço (`SIM_BOT_TOKEN`);
 *   4. marca `done`, ou `failed` + `error` (`attempts++`; 3 falhas = `failed`
 *      definitivo).
 *
 * O worker NUNCA escreve `GameState` direto no banco — o web server é o único
 * dono do `matchStore`. Aqui a leitura do `state` é só pra DECIDIR; toda
 * mutação passa pela API.
 *
 * Deploy: Railway service dedicado (fora do escopo desta entrega — só deixar
 * pronto). Rodar local: `SIM_BOT_TOKEN=... node --import tsx services/sim-bot/index.mjs`.
 */

const API_URL = (process.env.SIM_BOT_API_URL ?? "http://localhost:8787").replace(/\/$/, "");
const TOKEN = process.env.SIM_BOT_TOKEN ?? "";
const POLL_MS = Number(process.env.SIM_BOT_POLL_MS ?? 1000);
const MAX_ATTEMPTS = Number(process.env.SIM_BOT_MAX_ATTEMPTS ?? 3);

if (!TOKEN) {
  console.error("[sim-bot] SIM_BOT_TOKEN ausente — abortando. Ver services/sim-bot/README.md.");
  process.exit(1);
}

const prisma = new PrismaClient();

/** Seed determinístico por turno — mesma partida + turno + tentativa => mesma escolha. */
function turnSeed(matchId, turnNumber, attempts) {
  const hex = createHash("sha256").update(`${matchId}:${turnNumber}:${attempts}`).digest("hex").slice(0, 8);
  return parseInt(hex, 16) >>> 0;
}

async function commitAction(matchId, action) {
  const resp = await fetch(`${API_URL}/api/simulator/matches/${matchId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(action),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`POST /matches/${matchId}/actions -> ${resp.status} ${body.slice(0, 300)}`);
  }
}

/** Pega o próximo turno pendente e o reivindica (`processing`). `null` se não há nada. */
async function claimNextTurn() {
  const pending = await prisma.simulatorBotTurn.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });
  if (!pending) return null;
  const claimed = await prisma.simulatorBotTurn.updateMany({
    where: { id: pending.id, status: "pending" },
    data: { status: "processing" },
  });
  if (claimed.count === 0) return null; // outra instância pegou primeiro
  return pending;
}

async function processTurn(turn) {
  const row = await prisma.simulatorMatch.findUnique({ where: { id: turn.matchId } });
  if (!row) throw new Error(`SimulatorMatch ${turn.matchId} não encontrada`);

  const state = hydrateMatch(row.state);
  const botSeat = botSeatFromSeats(row.seats) ?? (turn.seat === "A" || turn.seat === "B" ? turn.seat : null);
  if (!botSeat) throw new Error(`partida ${turn.matchId} não tem assento de bot`);

  const seats = row.seats && typeof row.seats === "object" ? row.seats : {};
  const level = seats?.[botSeat]?.bot?.level === "facil" ? "facil" : "normal";

  if (state.gameOver) {
    console.log(`[sim-bot] turno ${turn.id}: partida ${turn.matchId} já terminou — nada a fazer`);
    return;
  }

  const result = await driveBotTurn({
    initialState: state,
    seat: botSeat,
    level,
    seed: turnSeed(turn.matchId, state.turnNumber, turn.attempts),
    commit: (action) => commitAction(turn.matchId, action),
  });

  console.log(
    `[sim-bot] turno ${turn.id} match=${turn.matchId} seat=${botSeat} nivel=${level} ` +
      `acoes=${result.actionsApplied} done=${result.done}`,
  );
}

async function tick() {
  const turn = await claimNextTurn();
  if (!turn) return;

  try {
    await processTurn(turn);
    await prisma.simulatorBotTurn.update({ where: { id: turn.id }, data: { status: "done", error: null } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const attempts = turn.attempts + 1;
    const failedForGood = attempts >= MAX_ATTEMPTS;
    console.error(`[sim-bot] turno ${turn.id} falhou (tentativa ${attempts}/${MAX_ATTEMPTS}): ${message}`);
    await prisma.simulatorBotTurn.update({
      where: { id: turn.id },
      data: { status: failedForGood ? "failed" : "pending", attempts, error: message.slice(0, 2000) },
    });
  }
}

let running = true;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`[sim-bot] ${signal} recebido — encerrando após o tick atual.`);
    running = false;
  });
}

console.log(`[sim-bot] iniciado. API=${API_URL} poll=${POLL_MS}ms`);
while (running) {
  await tick().catch((err) => console.error("[sim-bot] erro no tick:", err));
  if (!running) break;
  await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}
await prisma.$disconnect();
console.log("[sim-bot] encerrado.");

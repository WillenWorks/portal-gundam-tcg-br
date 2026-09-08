/*
 * train:dataset-from-logs — gera dataset de treino ML a partir de logs reais do Simulador.
 *
 * Consome partidas registradas em `SimulatorMatchLog` (amistosas, rankeadas ou treino)
 * e executa o replay determinístico no motor puro para extrair as amostras:
 *
 *   { features: number[FEATURE_SIZE],
 *     actionIndex: number,            // bucket da ação executada
 *     legalMask: number[ACTION_SPACE],
 *     outcome: -1 | 1 }               // 1 se o jogador da vez venceu a partida, -1 se perdeu
 *
 * Filtra automaticamente partidas incompletas ou com abandono prematuro (< minTurns).
 *
 * Uso:
 *   pnpm train:dataset-from-logs --minTurns=3 --limit=500
 *   pnpm train:dataset-from-logs --mode=ranked --out=services/sim-trainer/data/ranked.jsonl
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import process from "node:process";
import { PrismaClient } from "@prisma/client";

import {
  ENGINE_ROOT,
  createGame,
  actionOwner,
  enumerateLegalActions,
  applyPlayerAction,
  viewStateFor,
  extractFeatures,
  encodeAction,
  legalActionMask,
  ALL_EFFECT_SPECS,
  defaultPredicateResolver,
  defaultTargetFilterResolver,
  VALIDATED_DECKS,
  FEATURE_SIZE,
  ACTION_SPACE,
} from "./engine.mjs";

function parseArgs(argv) {
  const args = {
    limit: 1000,
    minTurns: 3,
    mode: "all",
    out: null,
  };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "limit") args.limit = Number(v);
    else if (k === "minTurns") args.minTurns = Number(v);
    else if (k === "mode") args.mode = v.toLowerCase();
    else if (k === "out") args.out = v;
  }
  return args;
}

function resolveDeckList(deckData, deckKey) {
  if (deckData && typeof deckData === "object" && Array.isArray(deckData.deck)) {
    return deckData;
  }
  const key = typeof deckKey === "string" ? deckKey.toUpperCase() : "";
  if (VALIDATED_DECKS[key]) {
    return VALIDATED_DECKS[key].build();
  }
  return null;
}

export async function generateDatasetFromLogs(options = {}) {
  const prisma = new PrismaClient();
  try {
    const where = {
      turns: { gte: options.minTurns ?? 3 },
      winner: { in: ["A", "B"] },
    };
    if (options.mode && options.mode !== "all") {
      where.mode = options.mode;
    }

    console.log(`[dataset-from-logs] buscando partidas no banco... (modo=${options.mode ?? "all"}, minTurns=${options.minTurns ?? 3}, limit=${options.limit ?? 1000})`);

    const logs = await prisma.simulatorMatchLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 1000,
    });

    console.log(`[dataset-from-logs] ${logs.length} partidas encontradas para replay.`);

    const samples = [];
    let matchesReplayed = 0;
    let failedMatches = 0;

    for (const log of logs) {
      const actions = log.actions;
      if (!Array.isArray(actions) || actions.length === 0) continue;

      const deckA = resolveDeckList(log.deckA, log.deckKeyA);
      const deckB = resolveDeckList(log.deckB, log.deckKeyB);

      if (!deckA || !deckB) {
        failedMatches += 1;
        continue;
      }

      const seed = Number(log.seed);
      let state;
      try {
        state = createGame(deckA, deckB, { seed, firstPlayer: "A", interactiveMulligan: true });
      } catch {
        failedMatches += 1;
        continue;
      }

      let matchSamplesCount = 0;
      let replayError = false;

      for (const action of actions) {
        if (state.gameOver) break;

        const owner = actionOwner(state);
        if (!owner) break;

        let legal;
        try {
          legal = enumerateLegalActions(state, owner, ALL_EFFECT_SPECS, {
            predicateResolver: defaultPredicateResolver,
            targetFilterResolver: defaultTargetFilterResolver,
          });
        } catch {
          replayError = true;
          break;
        }

        if (legal.length === 0) break;

        const view = viewStateFor(state, owner);

        // Apenas pontos de decisão com 2+ escolhas legais entram no dataset
        if (legal.length >= 2) {
          const actionIdx = encodeAction(action, view);
          if (actionIdx >= 0 && actionIdx < ACTION_SPACE) {
            samples.push({
              features: Array.from(extractFeatures(view, owner)),
              actionIndex: actionIdx,
              legalMask: Array.from(legalActionMask(legal, view)),
              outcome: owner === log.winner ? 1 : -1,
            });
            matchSamplesCount += 1;
          }
        }

        try {
          state = applyPlayerAction(
            state,
            owner,
            action,
            ALL_EFFECT_SPECS,
            defaultPredicateResolver,
            defaultTargetFilterResolver,
          );
        } catch {
          replayError = true;
          break;
        }
      }

      if (!replayError && matchSamplesCount > 0) {
        matchesReplayed += 1;
      } else if (replayError) {
        failedMatches += 1;
      }
    }

    return {
      samples,
      matchesFound: logs.length,
      matchesReplayed,
      failedMatches,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let result;
  try {
    result = await generateDatasetFromLogs(args);
  } catch (err) {
    console.error(`[dataset-from-logs] falha ao consultar banco:`, err.message);
    process.exit(1);
  }

  const { samples, matchesFound, matchesReplayed, failedMatches } = result;

  console.log(
    `[dataset-from-logs] processadas ${matchesReplayed}/${matchesFound} partidas com sucesso ` +
      `(${failedMatches} descartadas) -> ${samples.length} amostras de treino geradas.`,
  );

  if (samples.length === 0) {
    console.warn(`[dataset-from-logs] nenhuma amostra gerada.`);
    process.exit(0);
  }

  const outDir = path.resolve(ENGINE_ROOT, "services/sim-trainer/data");
  fs.mkdirSync(outDir, { recursive: true });

  const hash = createHash("sha1")
    .update(JSON.stringify({ count: samples.length, mode: args.mode, date: new Date().toISOString().slice(0, 10) }))
    .digest("hex")
    .slice(0, 10);

  const targetPath = args.out
    ? path.resolve(ENGINE_ROOT, args.out)
    : path.join(outDir, `logs-${args.mode}-${hash}.jsonl`);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  const lines = samples.map((s) => JSON.stringify(s)).join("\n") + "\n";
  fs.writeFileSync(targetPath, lines, "utf8");

  console.log(`[dataset-from-logs] dataset salvo em: ${targetPath}`);
}

if (process.argv[1] && process.argv[1].endsWith("dataset-from-logs.mjs")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

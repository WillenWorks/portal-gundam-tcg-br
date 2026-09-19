/*
 * Zero Foresight — entry point do Worker Thread (docs/debates 2026-09-18 P0-3).
 * Roda `runForesightMonteCarlo` fora do event loop principal do Express, isolando
 * o custo de CPU numa thread dedicada. Só importa o núcleo PURO
 * (zeroForesightMonteCarlo.ts) -- nunca Prisma/DB aqui.
 */
import { parentPort, workerData } from "node:worker_threads";
import { runForesightMonteCarlo, type ForesightSimulationParams } from "./zeroForesightMonteCarlo.ts";

async function main() {
  if (!parentPort) {
    throw new Error("zeroForesightWorker.ts deve rodar dentro de um worker_thread (parentPort ausente)");
  }
  try {
    const result = await runForesightMonteCarlo(workerData as ForesightSimulationParams);
    parentPort.postMessage({ ok: true, result });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}

void main();

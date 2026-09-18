/*
 * Zero Foresight — cliente do Worker Thread (docs/debates 2026-09-18 P0-3).
 * Spawna `zeroForesightWorker.ts` isolado, com um timeout de corte duro: se a
 * simulação não responder a tempo, mata a thread (`worker.terminate()`) e rejeita
 * com `ForesightWorkerTimeoutError` -- quem chama decide o fallback (ver
 * `runMonteCarloSafely` em zeroForesightService.ts).
 *
 * `execArgv: ["--import", "tsx/esm"]` é explícito (não confia em herança do loader
 * do processo pai) porque este código roda tanto sob `tsx server/index.ts`
 * (produção) quanto sob Vitest (testes) -- ambos precisam que o worker recém-criado
 * saiba carregar `.ts` por conta própria.
 */
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import type { ForesightSimulationParams, ForesightSimulationResult } from "./zeroForesightMonteCarlo.ts";

const WORKER_PATH = fileURLToPath(new URL("./zeroForesightWorker.ts", import.meta.url));
export const FORESIGHT_WORKER_TIMEOUT_MS_DEFAULT = 2_000;

export class ForesightWorkerTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Zero Foresight: simulação no worker thread excedeu o timeout de corte de ${timeoutMs}ms`);
    this.name = "ForesightWorkerTimeoutError";
  }
}

type WorkerMessage = { ok: true; result: ForesightSimulationResult } | { ok: false; error: string };

/**
 * Roda o Monte Carlo do Zero Foresight isolado num Worker Thread dedicado -- nunca
 * bloqueia o event loop principal do Express, e corta com `worker.terminate()` se
 * estourar `timeoutMs` (proteção contra parâmetro hostil ou set futuro maior que
 * trave o cálculo).
 */
export function runForesightMonteCarloInWorker(
  params: ForesightSimulationParams,
  timeoutMs: number = FORESIGHT_WORKER_TIMEOUT_MS_DEFAULT,
): Promise<ForesightSimulationResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH, {
      workerData: params,
      execArgv: ["--import", "tsx/esm"],
    });

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate().finally(() => reject(new ForesightWorkerTimeoutError(timeoutMs)));
    }, timeoutMs);

    worker.once("message", (msg: WorkerMessage) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (msg.ok) resolve(msg.result);
      else reject(new Error(msg.error));
    });

    worker.once("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    worker.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Zero Foresight: worker thread encerrou inesperadamente (exit code ${code})`));
    });
  });
}

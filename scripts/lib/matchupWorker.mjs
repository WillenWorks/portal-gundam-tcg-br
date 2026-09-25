/**
 * Worker da matriz de confrontos (spec bot-dados-pool): joga a parte do plano que
 * recebeu e devolve um resultado por partida. Mesma partida (seed, assento, decks)
 * que o modo serial — só muda quem joga.
 */
import { register } from "tsx/esm/api";
import { parentPort, workerData } from "node:worker_threads";

register();
const { runPlannedGames } = await import(workerData.runnerUrl);
runPlannedGames(workerData, (result) => parentPort.postMessage({ type: "result", result }));
parentPort.postMessage({ type: "done" });

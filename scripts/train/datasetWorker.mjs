/**
 * Worker para geração paralela de dataset em threads separadas.
 */
import { register } from "tsx/esm/api";
import os from "node:os";
import { parentPort, workerData } from "node:worker_threads";

register();

const { validatedDeckList } = await import("./engine.mjs");
const { runPlannedDatasetGames } = await import("./datasetCore.mjs");

const { plannedSpecs, outPath, rapido, nice } = workerData;

if (nice) {
  try {
    os.setPriority(0, os.constants.priority.PRIORITY_LOW);
  } catch {
    // Ignore priority errors in worker thread
  }
}

const deckList = validatedDeckList();
const byId = Object.fromEntries(deckList.map((d) => [d.id, d]));

const plannedGames = plannedSpecs.map((spec) => ({
  deckA: byId[spec.deckAId],
  deckB: byId[spec.deckBId],
  seed: spec.seed,
}));

try {
  const stats = await runPlannedDatasetGames(plannedGames, outPath, {
    rapido,
    onProgress: (current, total) => {
      parentPort.postMessage({ type: "progress", current, total });
    },
  });

  parentPort.postMessage({ type: "done", stats });
} catch (err) {
  parentPort.postMessage({
    type: "error",
    error: err instanceof Error ? err.stack ?? err.message : String(err),
  });
}

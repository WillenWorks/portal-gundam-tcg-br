/*
 * Delegador para o pipeline unificado de treino em scripts/train/pipeline.mjs.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "../..");
const target = pathToFileURL(path.join(ROOT, "scripts/train/pipeline.mjs")).href;

await import(target);

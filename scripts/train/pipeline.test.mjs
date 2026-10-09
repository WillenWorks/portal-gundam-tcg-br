import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  parseArgs,
  resolveConfig,
  loadCheckpoint,
  saveCheckpoint,
  clearCheckpoint,
  extractPath,
} from "./pipeline.mjs";

describe("scripts/train/pipeline", () => {
  it("parseArgs: analisa flags e opções padrão", () => {
    const args = parseArgs([
      "--perfil=local-forte",
      "--rapido",
      "--workers=4",
      "--nice",
      "--resume",
      "--games=25",
      "--epochs=5",
      "--evalGames=8",
      "--decks=ST01,ST02",
      "--seed=42",
      "--out=docs/bot/custom.json",
    ]);

    expect(args.perfil).toBe("local-forte");
    expect(args.rapido).toBe(true);
    expect(args.workers).toBe(4);
    expect(args.nice).toBe(true);
    expect(args.resume).toBe(true);
    expect(args.games).toBe(25);
    expect(args.epochs).toBe(5);
    expect(args.evalGames).toBe(8);
    expect(args.decks).toEqual(["ST01", "ST02"]);
    expect(args.seed).toBe(42);
    expect(args.out).toBe("docs/bot/custom.json");
  });

  it("resolveConfig: resolve defaults para perfil local-forte e modo rapido", () => {
    const config = resolveConfig({
      perfil: "local-forte",
      rapido: true,
      workers: null,
      nice: null,
      resume: null,
      clean: false,
      games: null,
      epochs: null,
      evalGames: null,
      decks: null,
      seed: 1,
    });

    expect(config.perfil).toBe("local-forte");
    expect(config.rapido).toBe(true);
    expect(config.workers).toBeGreaterThanOrEqual(1);
    expect(config.nice).toBe(true);
    expect(config.resume).toBe(true);
    expect(config.games).toBe(15);
    expect(config.epochs).toBe(4);
    expect(config.evalGames).toBe(6);
    expect(config.decks).toEqual(["ST01", "ST02"]);
  });

  it("resolveConfig: resolve defaults para perfil online completo", () => {
    const config = resolveConfig({
      perfil: "online",
      rapido: false,
      workers: null,
      nice: null,
      resume: null,
      clean: false,
      games: null,
      epochs: null,
      evalGames: null,
      decks: null,
      seed: 7,
    });

    expect(config.perfil).toBe("online");
    expect(config.rapido).toBe(false);
    expect(config.workers).toBe(2);
    expect(config.nice).toBe(false);
    expect(config.games).toBe(60);
    expect(config.epochs).toBe(15);
    expect(config.evalGames).toBe(30);
    expect(config.decks).toBeNull();
  });

  it("checkpoint: salva, recupera e remove arquivo de checkpoint", () => {
    const tmpFile = path.join(os.tmpdir(), `test-checkpoint-${Date.now()}.json`);
    try {
      expect(loadCheckpoint(tmpFile)).toBeNull();

      const state = {
        runId: "test-run",
        perfil: "local-forte",
        stages: {
          dataset: { completed: true, path: "data/test.jsonl" },
        },
      };

      saveCheckpoint(tmpFile, state);
      const loaded = loadCheckpoint(tmpFile);
      expect(loaded).not.toBeNull();
      expect(loaded.runId).toBe("test-run");
      expect(loaded.stages.dataset.completed).toBe(true);
      expect(loaded.updatedAt).toBeDefined();

      clearCheckpoint(tmpFile);
      expect(fs.existsSync(tmpFile)).toBe(false);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  it("extractPath: extrai caminho da linha '... -> <path>'", () => {
    const output = [
      "[train:dataset] gerando partidas...",
      "[train:dataset] 10 partidas em 1.2s",
      "[train:dataset] -> services/sim-trainer/data/abc123.jsonl",
      "",
    ].join("\n");

    expect(extractPath(output)).toBe("services/sim-trainer/data/abc123.jsonl");
    expect(extractPath("nenhuma linha")).toBeNull();
  });

  it("checkpoint: detecta retomada de etapas anteriores", () => {
    const tmpFile = path.join(os.tmpdir(), `test-resume-${Date.now()}.json`);
    try {
      const state = {
        runId: "resume-run",
        perfil: "local-forte",
        completed: false,
        stages: {
          dataset: { completed: true, path: "services/sim-trainer/data/existing.jsonl" },
          fit: { completed: true, modelDir: "services/sim-trainer/models/existing" },
        },
      };
      saveCheckpoint(tmpFile, state);

      const loaded = loadCheckpoint(tmpFile);
      expect(loaded.completed).toBe(false);
      expect(loaded.stages.dataset.completed).toBe(true);
      expect(loaded.stages.fit.completed).toBe(true);
      expect(loaded.stages.eval).toBeUndefined();
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });
});

describe("pipeline --zero (Fase 4: matriz do Zero System)", () => {
  it("liga a etapa só quando pedido; 2 partidas/par no rápido e 10 no normal", () => {
    expect(resolveConfig(parseArgs([])).zero).toBe(false);
    const rapido = resolveConfig(parseArgs(["--zero", "--rapido"]));
    expect(rapido.zero).toBe(true);
    expect(rapido.zeroGames).toBe(2);
    expect(resolveConfig(parseArgs(["--zero"])).zeroGames).toBe(10);
    expect(resolveConfig(parseArgs(["--zero", "--zeroGames=6"])).zeroGames).toBe(6);
  });
});

import { describe, expect, it } from "vitest";
import { randomLegal } from "../selfPlay";
import { heuristicPolicy } from "./heuristicPolicy";
import { runPuzzle, runPuzzleSuite } from "./puzzleRunner";
import type { Puzzle } from "./puzzles/types";
import { mainBoard, put, DRAW, SELF_BURN, SPECS } from "./lookaheadTestFixtures";

const drawPuzzle: Puzzle = {
  id: "teste-compra",
  title: "Compra com recurso sobrando",
  category: "efeito-util",
  why: "Nada melhor a fazer; compra dá vantagem de cartas.",
  build: () => {
    const state = mainBoard();
    const cmd = put(state, "A", "hand", DRAW);
    return { state, seat: "A", refs: { cmd: cmd.instanceId } };
  },
  accepted: [{ describe: "joga o Comando de compra", match: (a, refs) => a.kind === "playCommand" && a.cardInstanceId === refs.cmd }],
};

const burnPuzzle: Puzzle = {
  id: "teste-autodano",
  title: "Não jogar efeito que prejudica",
  category: "efeito-inutil",
  why: "O Comando só destrói o próprio escudo.",
  build: () => {
    const state = mainBoard();
    put(state, "A", "hand", SELF_BURN);
    return { state, seat: "A", refs: {} };
  },
  accepted: [{ describe: "qualquer coisa menos o Comando", match: (a) => a.kind !== "playCommand" }],
};

const brokenPuzzle: Puzzle = {
  ...drawPuzzle,
  id: "teste-quebrada",
  accepted: [{ describe: "ação que não existe", match: (a) => a.kind === "resolveMulligan" }],
};

const lookaheadBot = () => heuristicPolicy({ level: "normal", lookahead: { specs: SPECS } });

describe("puzzleRunner", () => {
  it("acerto quando a policy escolhe uma ação aceita", () => {
    const r = runPuzzle(drawPuzzle, lookaheadBot(), { specs: SPECS });
    expect(r.status).toBe("acerto");
  });

  it("erro reporta a ação escolhida e as aceitas", () => {
    const r = runPuzzle(drawPuzzle, heuristicPolicy({ level: "facil" }), { specs: SPECS });
    expect(r.status).toBe("erro");
    expect(r.chosen).toBeDefined();
    expect(r.acceptedDescriptions).toEqual(["joga o Comando de compra"]);
  });

  it("quebrada quando nenhuma ação aceita é legal (mudança de motor, não erro do bot)", () => {
    const r = runPuzzle(brokenPuzzle, randomLegal, { specs: SPECS });
    expect(r.status).toBe("quebrada");
  });

  it("suite: % de acerto por nível ignora as quebradas no denominador", () => {
    const summary = runPuzzleSuite([drawPuzzle, burnPuzzle, brokenPuzzle], { normal: lookaheadBot }, { specs: SPECS });
    expect(summary.normal).toMatchObject({ correct: 2, valid: 2, broken: 1 });
    expect(summary.normal.rate).toBe(1);
    expect(summary.normal.chanceRate).toBeGreaterThan(0);
    expect(summary.normal.chanceRate).toBeLessThan(1);
  });
});

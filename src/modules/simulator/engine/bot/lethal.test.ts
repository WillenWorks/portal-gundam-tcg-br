import { describe, expect, it } from "vitest";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../../content";
import { enumerateLegalActions } from "../legalActions";
import { viewStateFor } from "../viewState";
import { hasLethalLine } from "./lethal";
import { policyForLevel, type BotLevel } from "./levelPolicies";
import { runPuzzle } from "./puzzleRunner";
import { ALL_PUZZLES } from "./puzzles";
import { base, board, put, setShields, unit } from "./puzzles/fixtures";

const opts = { specs: ALL_EFFECT_SPECS, predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

function lethalFor(build: () => ReturnType<typeof board>): boolean {
  const state = build();
  const legal = enumerateLegalActions(state, "A", opts.specs, opts);
  return hasLethalLine(viewStateFor(state, "A"), legal);
}

describe("hasLethalLine", () => {
  it("oponente sem escudo e sem Base, um atacante pronto → letal", () => {
    expect(
      lethalFor(() => {
        const s = board("A");
        setShields(s, "B", 0);
        put(s, "A", "battleArea", unit("L-ATK", 3, 3));
        return s;
      }),
    ).toBe(true);
  });

  it("1 escudo e dois atacantes → letal; 1 escudo e um atacante → não", () => {
    const two = () => {
      const s = board("A");
      setShields(s, "B", 1);
      put(s, "A", "battleArea", unit("L-ATK1", 2, 2));
      put(s, "A", "battleArea", unit("L-ATK2", 2, 2));
      return s;
    };
    const one = () => {
      const s = board("A");
      setShields(s, "B", 1);
      put(s, "A", "battleArea", unit("L-ATK1", 2, 2));
      return s;
    };
    expect(lethalFor(two)).toBe(true);
    expect(lethalFor(one)).toBe(false);
  });

  it("cada <Blocker> ativo do oponente exige um atacante a mais", () => {
    expect(
      lethalFor(() => {
        const s = board("A");
        setShields(s, "B", 0);
        put(s, "A", "battleArea", unit("L-ATK", 3, 3));
        put(s, "B", "battleArea", unit("L-BLK", 1, 1, { effectKeywords: ["Blocker"] }));
        return s;
      }),
    ).toBe(false);
    expect(
      lethalFor(() => {
        const s = board("A");
        setShields(s, "B", 0);
        put(s, "A", "battleArea", unit("L-ATK", 3, 3));
        put(s, "B", "battleArea", unit("L-BLK", 1, 1, { effectKeywords: ["Blocker"] }), { rested: true });
        return s;
      }),
    ).toBe(true);
  });

  it("Base do oponente: cada ataque que a destrói conta um passo; ataque fraco não conta", () => {
    // Base 3 HP + 0 escudos: atacante 3 AP destrói a Base, atacante 2 AP bate no jogador
    expect(
      lethalFor(() => {
        const s = board("A");
        setShields(s, "B", 0);
        put(s, "B", "baseSection", base("L-BASE", 3));
        put(s, "A", "battleArea", unit("L-BIG", 3, 3));
        put(s, "A", "battleArea", unit("L-SMALL", 2, 2));
        return s;
      }),
    ).toBe(true);
    // dois atacantes de 1 AP não destroem uma Base de 3 HP
    expect(
      lethalFor(() => {
        const s = board("A");
        setShields(s, "B", 0);
        put(s, "B", "baseSection", base("L-BASE", 3));
        put(s, "A", "battleArea", unit("L-W1", 1, 1));
        put(s, "A", "battleArea", unit("L-W2", 1, 1));
        return s;
      }),
    ).toBe(false);
  });

  it("Unit rested não conta como atacante", () => {
    expect(
      lethalFor(() => {
        const s = board("A");
        setShields(s, "B", 0);
        put(s, "A", "battleArea", unit("L-TIRED", 3, 3), { rested: true });
        return s;
      }),
    ).toBe(false);
  });
});

describe("letal nos níveis do bot (banco de situações)", () => {
  const lethalPuzzles = ALL_PUZZLES.filter((p) => p.category === "letal");
  const levels: BotLevel[] = ["normal", "zero_system", "dificil"];

  it("o banco tem as situações de letal", () => {
    expect(lethalPuzzles.map((p) => p.id)).toEqual(expect.arrayContaining(["letal-direto", "letal-com-dois-atacantes"]));
  });

  for (const level of levels) {
    for (const puzzle of lethalPuzzles) {
      it(`${level} acerta ${puzzle.id}`, () => {
        const policy = policyForLevel(level, { ...opts, mctsRollouts: 4 });
        expect(runPuzzle(puzzle, policy, opts).status).toBe("acerto");
      }, 30_000);
    }
  }
});

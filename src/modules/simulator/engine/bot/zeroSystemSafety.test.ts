import { describe, expect, it } from "vitest";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../../content";
import { act, board, put, setShields, unit } from "./puzzles/fixtures";
import { runPuzzle } from "./puzzleRunner";
import { ALL_PUZZLES } from "./puzzles";
import type { Puzzle } from "./puzzles/types";
import { zeroSystemPolicy, type ZeroSystemPersona } from "./zeroSystemPolicy";

const opts = { specs: ALL_EFFECT_SPECS, predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const PERSONAS: ZeroSystemPersona[] = ["adaptive", "amuro", "char", "heero", "treize"];

const byId = (id: string) => {
  const p = ALL_PUZZLES.find((x) => x.id === id);
  if (!p) throw new Error(`situação ${id} sumiu do banco`);
  return p;
};

/** sem escudo e sem Base: deixar o ataque passar perde a partida */
const blockOrLose: Puzzle = {
  id: "teste-bloqueio-ou-derrota",
  title: "Bloquear o ataque que perde a partida",
  category: "bloqueio",
  why: "Sem escudo e sem Base, o dano no jogador encerra a partida; o <Blocker> 1/1 morre mas salva.",
  build: () => {
    let state = board("B");
    setShields(state, "A", 0);
    const blocker = put(state, "A", "battleArea", unit("Z-CHUMP", 1, 1, { effectKeywords: ["Blocker"] }));
    const attacker = put(state, "B", "battleArea", unit("Z-ATK", 4, 4));
    state = act(state, "B", { kind: "declareAttack", attackerId: attacker, target: "player" });
    return { state, seat: "A", refs: { blocker } };
  },
  accepted: [{ describe: "bloqueia", match: (a, r) => a.kind === "activateBlocker" && a.blockerId === r.blocker }],
};

const SAFETY = [byId("bloqueio-salva-base"), byId("nao-atacar-base-com-blocker-segurando"), blockOrLose];
// as regras de segurança não podem custar as situações que as personas já acertavam
const REGRESSION = ["nao-bloquear-a-toa", "letal-direto", "letal-com-dois-atacantes", "troca-favoravel"].map(byId);

describe("zero_system: regras de segurança valem em toda persona", () => {
  for (const persona of PERSONAS) {
    // Char (agressivo, entra com o oponente em ≤ 2 escudos) prefere pressionar o jogador a
    // trocar Unit: estilo da persona, não regra de segurança
    const regression = persona === "char" ? REGRESSION.filter((p) => p.id !== "troca-favoravel") : REGRESSION;
    for (const puzzle of [...SAFETY, ...regression]) {
      it(`${persona} acerta ${puzzle.id}`, () => {
        expect(runPuzzle(puzzle, zeroSystemPolicy({ persona }), opts).status).toBe("acerto");
      });
    }
  }
});

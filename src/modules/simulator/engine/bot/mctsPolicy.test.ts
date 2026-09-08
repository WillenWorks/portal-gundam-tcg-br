import { describe, expect, it } from "vitest";
import { createGame } from "../setup";
import { createRng } from "../rng";
import { runSelfPlay, randomLegal } from "../selfPlay";
import { applyPlayerAction } from "../actions";
import { viewStateFor } from "../viewState";
import { actionOwner, enumerateLegalActions } from "../legalActions";
import {
  ALL_EFFECT_SPECS,
  defaultPredicateResolver,
  defaultTargetFilterResolver,
  validatedDeckList,
} from "../../content/index";
import { chooseAction, mctsPolicy } from "./mctsPolicy";

const specs = {
  specs: ALL_EFFECT_SPECS,
  predicateResolver: defaultPredicateResolver,
  targetFilterResolver: defaultTargetFilterResolver,
};

const decks = validatedDeckList();
const deckBuild = (id: string) => decks.find((d) => d.id === id)!.build;

/** joga a partida real com `randomLegal` até chegar a um ponto de decisão do assento `seat` com ≥ `minLegal` opções */
function advanceToDecision(seed: number, seat: "A" | "B", minLegal: number) {
  let state = createGame(deckBuild("ST01")(), deckBuild("ST02")(), {
    seed,
    firstPlayer: "A",
    interactiveMulligan: true,
  });
  const rng = createRng(seed ^ 0x55);
  for (let i = 0; i < 4000; i++) {
    if (state.gameOver) break;
    const owner = actionOwner(state);
    if (!owner) break;
    const legal = enumerateLegalActions(state, owner, ALL_EFFECT_SPECS, specs);
    if (owner === seat && legal.length >= minLegal && state.turnNumber >= 3) {
      return { view: viewStateFor(state, seat), legal };
    }
    if (legal.length === 0) break;
    state = applyPlayerAction(
      state,
      owner,
      legal[Math.floor(rng() * legal.length)],
      ALL_EFFECT_SPECS,
      specs.predicateResolver,
      specs.targetFilterResolver,
    );
  }
  throw new Error("não chegou a um ponto de decisão utilizável");
}

describe("mctsPolicy", () => {
  it("é determinística dado o seed: 2 chamadas → mesma ação", () => {
    const { view, legal } = advanceToDecision(4, "A", 3);
    const a = chooseAction(view, legal, createRng(123), { rollouts: 8, ...specs });
    const b = chooseAction(view, legal, createRng(123), { rollouts: 8, ...specs });
    expect(b).toEqual(a);
  });

  it("uma opção legal → devolve ela sem rodar rollout", () => {
    const view = viewStateFor(
      createGame(deckBuild("ST01")(), deckBuild("ST02")(), { seed: 1, firstPlayer: "A", interactiveMulligan: true }),
      "A",
    );
    const only = [{ kind: "resolveMulligan" as const, keep: true }];
    expect(chooseAction(view, only, createRng(1), specs)).toBe(only[0]);
  });

  it("não trava e escolhe uma das ações legais oferecidas", () => {
    const { view, legal } = advanceToDecision(9, "A", 4);
    const chosen = chooseAction(view, legal, createRng(7), { rollouts: 6, ...specs });
    expect(legal).toContainEqual(chosen);
  });
});

/**
 * Sanidade barata dentro do `pnpm test`: o MCTS bate `randomLegal` com folga
 * (sinal robusto de "não está quebrado") e cada decisão fica sob 2s. O número
 * de gate real — MCTS vs heurística normal ≥ 60% em 100 partidas — sai do
 * `pnpm gundam:mcts:bench` (ver `scripts/gundam-mcts-bench.mjs` e o relatório).
 */
describe("mctsPolicy — sanidade (amostra pequena)", () => {
  it(
    "vence randomLegal com folga e decide em < 2s (12 partidas ST01/ST02)",
    () => {
      let mctsWins = 0;
      let decisive = 0;
      let maxDecisionMs = 0;

      for (const [deckA, deckB, mctsSeat] of [
        ["ST01", "ST02", "A"],
        ["ST02", "ST01", "B"],
      ] as Array<[string, string, "A" | "B"]>) {
        for (let g = 0; g < 6; g++) {
          const base = mctsPolicy({ rollouts: 20, depthTurns: 12, ...specs });
          const timed: typeof base = (view, legal, rng) => {
            const t0 = Date.now();
            const out = base(view, legal, rng);
            maxDecisionMs = Math.max(maxDecisionMs, Date.now() - t0);
            return out;
          };
          const result = runSelfPlay({
            deckA: deckBuild(deckA)(),
            deckB: deckBuild(deckB)(),
            seed: 6000 + g,
            maxTurns: 40,
            policyA: mctsSeat === "A" ? timed : randomLegal,
            policyB: mctsSeat === "B" ? timed : randomLegal,
            ...specs,
          });
          expect(result.crashed, `crash: ${result.crashed?.error}`).toBeUndefined();
          expect(result.illegalState, `estado ilegal: ${result.illegalState}`).toBeUndefined();
          if (result.winner === mctsSeat) {
            mctsWins += 1;
            decisive += 1;
          } else if (result.winner !== null) {
            decisive += 1;
          }
        }
      }

      const rate = decisive === 0 ? 0 : mctsWins / decisive;
      console.log(
        `[mcts-sanidade] MCTS vs random ${(rate * 100).toFixed(0)}% (${mctsWins}/${decisive}) | pico ${maxDecisionMs} ms/decisão`,
      );
      expect(rate).toBeGreaterThanOrEqual(0.7);
      expect(maxDecisionMs).toBeLessThan(4000);
    },
    360_000,
  );
});

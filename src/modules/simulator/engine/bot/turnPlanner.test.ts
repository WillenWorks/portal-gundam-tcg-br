import { describe, expect, it } from "vitest";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../../content";
import { enumerateLegalActions } from "../legalActions";
import { createRng } from "../rng";
import { viewStateFor } from "../viewState";
import { heuristicPolicy } from "./heuristicPolicy";
import { runPuzzle } from "./puzzleRunner";
import { ALL_PUZZLES } from "./puzzles";
import { put, real, unit } from "./puzzles/fixtures";
import { planTurn, turnPlannerPolicy } from "./turnPlanner";

const opts = { specs: ALL_EFFECT_SPECS, predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

const byId = (id: string) => {
  const p = ALL_PUZZLES.find((x) => x.id === id);
  if (!p) throw new Error(`situação ${id} sumiu do banco`);
  return p;
};

const planner = () => turnPlannerPolicy(heuristicPolicy({ level: "normal", lookahead: opts }), { ...opts, budgetMs: 5_000 });

describe("planejador de turno — situações de sequência do banco", () => {
  const sequence = ALL_PUZZLES.filter((p) => p.category === "sequencia");

  it("o banco tem as situações de sequência", () => {
    expect(sequence.map((p) => p.id)).toEqual(
      expect.arrayContaining(["rest-e-ataque", "remove-bloqueador-e-letal", "pilot-antes-de-atacar"]),
    );
  });

  for (const puzzle of sequence) {
    it(`acerta ${puzzle.id}`, () => {
      expect(runPuzzle(puzzle, planner(), opts).status).toBe("acerto");
    }, 30_000);
  }
  // não pode custar situações que a base já acertava (letal, combate, efeito inútil)
  for (const id of ["letal-direto", "troca-favoravel", "pump-sem-atacante", "deploy-antes-de-comprar", "nao-atacar-base-com-blocker-segurando"]) {
    it(`segue acertando ${id}`, () => {
      expect(runPuzzle(byId(id), planner(), opts).status).toBe("acerto");
    }, 30_000);
  }
});

describe("planejador de turno — contrato", () => {
  function restAndAttack() {
    const { state, seat } = byId("rest-e-ataque").build();
    return { state, seat };
  }

  it("não vaza informação oculta: mão real do oponente não muda o plano", () => {
    const a = restAndAttack();
    const b = restAndAttack();
    // mesmo tabuleiro e mesmo nº de cartas na mão do oponente (público), conteúdo diferente (oculto)
    put(a.state, "B", "hand", unit("NL-1", 1, 1));
    put(a.state, "B", "hand", unit("NL-2", 1, 1));
    put(b.state, "B", "hand", real("ST03-013"));
    put(b.state, "B", "hand", real("ST02-014"));
    const va = viewStateFor(a.state, a.seat);
    const vb = viewStateFor(b.state, b.seat);
    const la = enumerateLegalActions(a.state, a.seat, opts.specs, opts);
    const lb = enumerateLegalActions(b.state, b.seat, opts.specs, opts);
    const pa = planTurn(va, la, { ...opts, budgetMs: 5_000 });
    const pb = planTurn(vb, lb, { ...opts, budgetMs: 5_000 });
    expect(vb.players.B.hand.every((c) => "hidden" in c)).toBe(true);
    expect(pa?.ranked.map((r) => r.value)).toEqual(pb?.ranked.map((r) => r.value));
  });

  it("determinístico: mesma view e seed → mesmo plano", () => {
    const { state, seat } = restAndAttack();
    const view = viewStateFor(state, seat);
    const legal = enumerateLegalActions(state, seat, opts.specs, opts);
    // relógio fixo: isola o algoritmo do orçamento de tempo (única fonte de não-determinismo)
    const now = () => 0;
    const p1 = planTurn(view, legal, { ...opts, budgetMs: 5_000, seed: 7, now });
    const p2 = planTurn(view, legal, { ...opts, budgetMs: 5_000, seed: 7, now });
    expect(p1?.ranked.map((r) => r.value)).toEqual(p2?.ranked.map((r) => r.value));
  });

  it("sem orçamento cai na policy base", () => {
    const { state, seat } = restAndAttack();
    const view = viewStateFor(state, seat);
    const legal = enumerateLegalActions(state, seat, opts.specs, opts);
    const base = heuristicPolicy({ level: "normal" });
    const noTime = turnPlannerPolicy(base, { ...opts, budgetMs: 0 });
    expect(noTime(view, legal, createRng(1))).toEqual(base(view, legal, createRng(1)));
  });

  it("fora da Main Phase do bot usa a policy base (bloqueio)", () => {
    const { state, seat } = byId("bloqueio-salva-base").build();
    const view = viewStateFor(state, seat);
    const legal = enumerateLegalActions(state, seat, opts.specs, opts);
    expect(planTurn(view, legal, { ...opts, budgetMs: 5_000 })).toBeNull();
  });

  it("onPlan recebe o plano escolhido e as alternativas", () => {
    const { state, seat } = restAndAttack();
    const seen: number[] = [];
    const policy = turnPlannerPolicy(heuristicPolicy({ level: "normal" }), {
      ...opts,
      budgetMs: 5_000,
      onPlan: (plan) => seen.push(plan.ranked.length),
    });
    policy(viewStateFor(state, seat), enumerateLegalActions(state, seat, opts.specs, opts), createRng(1));
    expect(seen.length).toBe(1);
    expect(seen[0]).toBeGreaterThan(1);
  });
});

describe("planejador de turno — pesos", () => {
  it("usa os pesos passados na avaliação final", () => {
    const { state, seat } = byId("rest-e-ataque").build();
    const view = viewStateFor(state, seat);
    const legal = enumerateLegalActions(state, seat, opts.specs, opts);
    const now = () => 0;
    const base = planTurn(view, legal, { ...opts, budgetMs: 5_000, now });
    const doubled = planTurn(view, legal, {
      ...opts,
      budgetMs: 5_000,
      now,
      weights: { shield: 6, baseHp: 2.4, durableBoard: 1, handCard: 0.5, attackReadyAp: 0.8, readyBlockerHp: 0.6 },
    });
    // todos os pesos em dobro → todos os valores em dobro, mesma ordem
    expect(doubled?.ranked.map((r) => r.value)).toEqual(base?.ranked.map((r) => r.value * 2));
  });
});

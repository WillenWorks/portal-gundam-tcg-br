import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { applyPlayerAction } from "./actions";
import { ALL_EFFECT_SPECS, defaultPredicateResolver } from "../content";
import type { GameState, PlayerId } from "./types";

/**
 * Mulligan interativo de início de partida (Comprehensive Rules 6-2 / ruling
 * oficial: "once, starting with Player One"). `createGame({ interactiveMulligan })`
 * deixa a mão comprada e `pendingDecision[firstPlayer] = { kind: "mulligan" }`;
 * `resolveMulligan` encadeia 1º → 2º → setup final → Main Phase.
 */

const SPECS = ALL_EFFECT_SPECS;
const R = defaultPredicateResolver;

function newInteractiveGame(firstPlayer: PlayerId = "A", seed = 42): GameState {
  return createGame(buildSt01DeckList(), buildSt02DeckList(), { seed, firstPlayer, interactiveMulligan: true });
}
const apply = (s: GameState, p: PlayerId, a: Parameters<typeof applyPlayerAction>[2]) => applyPlayerAction(s, p, a, SPECS, R);
const names = (s: GameState, p: PlayerId) => s.players[p].hand.map((c) => c.def.code).sort();
const hasExResource = (s: GameState, p: PlayerId) =>
  s.players[p].resourceArea.some((c) => c.def.code === "TOKEN-EX-RESOURCE");

describe("createGame — modo interativo (Mulligan pendente)", () => {
  it("compra 5 pra cada, NÃO coloca shields/EX ainda, e deixa o 1º jogador com mulligan pendente", () => {
    const s = newInteractiveGame("A");
    expect(s.phase).toBe("start");
    expect(s.players.A.hand).toHaveLength(5);
    expect(s.players.B.hand).toHaveLength(5);
    expect(s.players.A.shields).toHaveLength(0);
    expect(s.players.B.shields).toHaveLength(0);
    expect(s.players.A.baseSection).toHaveLength(0);
    expect(s.players.B.resourceArea).toHaveLength(0); // EX Resource do 2º só depois do mulligan
    expect(s.pendingDecision.A).toEqual({ kind: "mulligan" });
    expect(s.pendingDecision.B).toBeNull();
    expect(s.seed).toBe(42);
  });

  it("firstPlayer B → o mulligan pendente é do B", () => {
    const s = newInteractiveGame("B");
    expect(s.pendingDecision.B).toEqual({ kind: "mulligan" });
    expect(s.pendingDecision.A).toBeNull();
  });
});

describe("resolveMulligan — fluxo sequencial", () => {
  it("1º jogador fica com a mão (keep) → passa o mulligan pro 2º; ninguém mais decide antes", () => {
    let s = newInteractiveGame("A");
    const handA = names(s, "A");
    s = apply(s, "A", { kind: "resolveMulligan", keep: true });
    expect(names(s, "A")).toEqual(handA); // inalterada
    expect(s.pendingDecision.A).toBeNull();
    expect(s.pendingDecision.B).toEqual({ kind: "mulligan" });
    expect(s.phase).toBe("start"); // ainda não avançou
    // B não pode agir com outra coisa
    expect(() => apply(s, "B", { kind: "finishTurn" })).toThrow(/Mulligan/);
    // A não age de novo (o motor bloqueia porque B tem decisão pendente)
    expect(() => apply(s, "A", { kind: "resolveMulligan", keep: true })).toThrow(/Aguardando o oponente|Mulligan/);
  });

  it("mulligan (keep:false) troca a mão de forma determinística e mantém 39 no deck", () => {
    let s = newInteractiveGame("A", 7);
    const original = names(s, "A");
    const deckBefore = s.players.A.deck.length;
    s = apply(s, "A", { kind: "resolveMulligan", keep: false });
    expect(s.players.A.hand).toHaveLength(5);
    expect(s.players.A.deck.length).toBe(deckBefore); // 5 saíram, 5 entraram
    expect(names(s, "A")).not.toEqual(original); // mão nova
    // determinismo: mesma seed + mesma escolha = mesma mão nova
    const s2 = apply(newInteractiveGame("A", 7), "A", { kind: "resolveMulligan", keep: false });
    expect(names(s2, "A")).toEqual(names(s, "A"));
  });

  it("os dois resolvem → setup final (6 shields cada + EX Base + EX Resource do 2º) + Main Phase", () => {
    let s = newInteractiveGame("A");
    s = apply(s, "A", { kind: "resolveMulligan", keep: false });
    s = apply(s, "B", { kind: "resolveMulligan", keep: true });

    expect(s.phase).toBe("main");
    expect(s.activePlayer).toBe("A");
    expect(s.pendingDecision).toEqual({ A: null, B: null });
    for (const p of ["A", "B"] as PlayerId[]) {
      expect(s.players[p].shields).toHaveLength(6);
      expect(s.players[p].baseSection).toHaveLength(1);
      expect(s.players[p].baseSection[0].def.code).toBe("TOKEN-EX-BASE");
    }
    // A é o jogador ativo e `advanceToMainPhase` já rodou a Draw Phase dele -> 6 na mão.
    expect(s.players.A.hand).toHaveLength(6);
    expect(s.players.B.hand).toHaveLength(5);
    // EX Resource ativo só pro 2º jogador (B) — o 1º (A) só tem o recurso da
    // Resource Phase que `advanceToMainPhase` acabou de rodar.
    expect(hasExResource(s, "A")).toBe(false);
    expect(hasExResource(s, "B")).toBe(true);
    const ex = s.players.B.resourceArea.find((c) => c.def.code === "TOKEN-EX-RESOURCE")!;
    expect(ex.rested).toBe(false);
  });

  it("firstPlayer B → B decide primeiro, depois A; EX Resource vai pro A (2º)", () => {
    let s = newInteractiveGame("B");
    expect(() => apply(s, "A", { kind: "resolveMulligan", keep: true })).toThrow(); // A não é o 1º
    s = apply(s, "B", { kind: "resolveMulligan", keep: true });
    expect(s.pendingDecision.A).toEqual({ kind: "mulligan" });
    s = apply(s, "A", { kind: "resolveMulligan", keep: true });
    expect(s.phase).toBe("main");
    expect(s.activePlayer).toBe("B");
    expect(hasExResource(s, "A")).toBe(true); // A é o 2º
    expect(hasExResource(s, "B")).toBe(false);
  });
});

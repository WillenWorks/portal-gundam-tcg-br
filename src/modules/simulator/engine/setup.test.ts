import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildVanillaDeckList } from "../fixtures/vanillaDeck";

describe("createGame (Comprehensive Rules 6-2, setup de partida)", () => {
  it("monta as zonas iniciais corretamente pra ambos os jogadores", () => {
    const deckList = buildVanillaDeckList();
    const state = createGame(deckList, buildVanillaDeckList(), { seed: 1, firstPlayer: "A" });

    for (const id of ["A", "B"] as const) {
      const player = state.players[id];
      expect(player.hand).toHaveLength(5);
      expect(player.shields).toHaveLength(6);
      // 50 no main deck - 5 na mão - 6 nos shields = 39
      expect(player.deck).toHaveLength(39);
      expect(player.resourceDeck).toHaveLength(10);
      expect(player.baseSection).toHaveLength(1);
      expect(player.baseSection[0].def.code).toBe("TOKEN-EX-BASE");
      expect(player.baseSection[0].def.hp).toBe(3);
    }
  });

  it("só o segundo jogador começa com 1 EX Resource ATIVO (Comprehensive Rules 6-2-4)", () => {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 1, firstPlayer: "A" });
    expect(state.players.A.resourceArea).toHaveLength(0);
    expect(state.players.B.resourceArea).toHaveLength(1);
    expect(state.players.B.resourceArea[0].def.code).toBe("TOKEN-EX-RESOURCE");
    expect(state.players.B.resourceArea[0].rested).toBe(false); // entra ativo
    expect(state.players.B.resourceArea[0].owner).toBe("B");
  });

  it("EX Resource vai pro jogador certo quando B começa (firstPlayer: B → A é o 2º)", () => {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 3, firstPlayer: "B" });
    expect(state.players.B.resourceArea).toHaveLength(0);
    expect(state.players.A.resourceArea).toHaveLength(1);
    expect(state.players.A.resourceArea[0].def.code).toBe("TOKEN-EX-RESOURCE");
  });

  it("grava engineVersion no estado (docs/44 §8.4) — 'dev' fora do build", () => {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 1, firstPlayer: "A" });
    expect(state.engineVersion).toBeTruthy();
    expect(typeof state.engineVersion).toBe("string");
  });

  it("é determinístico: mesma seed produz a mesma mão inicial", () => {
    const s1 = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 42, firstPlayer: "A" });
    const s2 = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 42, firstPlayer: "A" });
    expect(s1.players.A.hand.map((c) => c.def.code)).toEqual(s2.players.A.hand.map((c) => c.def.code));
    expect(s1.players.B.deck.map((c) => c.def.code)).toEqual(s2.players.B.deck.map((c) => c.def.code));
  });

  it("seeds diferentes tendem a produzir embaralhadas diferentes", () => {
    const s1 = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 1, firstPlayer: "A" });
    const s2 = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 2, firstPlayer: "A" });
    expect(s1.players.A.deck.map((c) => c.instanceId)).not.toEqual(s2.players.A.deck.map((c) => c.instanceId));
  });

  it("mulligan devolve a mão, compra 5 novas e mantém o tamanho do deck", () => {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), {
      seed: 7,
      firstPlayer: "A",
      mulligan: { A: true },
    });
    expect(state.players.A.hand).toHaveLength(5);
    expect(state.players.A.deck).toHaveLength(39);
  });

  it("rejeita deck principal fora de 50 cartas", () => {
    const bad = buildVanillaDeckList();
    bad.main = bad.main.slice(0, 49);
    expect(() => createGame(bad, buildVanillaDeckList(), { seed: 1, firstPlayer: "A" })).toThrow();
  });

  it("rejeita resource deck fora de 10 cartas", () => {
    const bad = buildVanillaDeckList();
    bad.resources = bad.resources.slice(0, 9);
    expect(() => createGame(bad, buildVanillaDeckList(), { seed: 1, firstPlayer: "A" })).toThrow();
  });

  it("estado inicial começa no turno 1, Start Phase, jogador informado como ativo", () => {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 1, firstPlayer: "B" });
    expect(state.turnNumber).toBe(1);
    expect(state.phase).toBe("start");
    expect(state.activePlayer).toBe("B");
    expect(state.gameOver).toBeNull();
    expect(state.combat).toBeNull();
  });
});

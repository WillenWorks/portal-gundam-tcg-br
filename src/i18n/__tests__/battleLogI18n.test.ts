import { describe, expect, it } from "vitest";
import type { GameEvent } from "@/modules/simulator/engine/types";
import { describeEventI18n } from "../battleLogI18n";

describe("battleLogI18n", () => {
  const nameOf = (id: string) => (id === "unit-1" ? "Gundam" : id === "pilot-1" ? "Amuro Ray" : "Zaku II");

  it("descreve TURN_CHANGE em pt-BR e EN", () => {
    const ev: GameEvent = {
      type: "TURN_CHANGE",
      turnNumber: 3,
      activePlayer: "A",
    };

    const pt = describeEventI18n(ev, 0, nameOf, "PT_BR");
    expect(pt?.text).toBe("— Turno 3 · Jogador A —");

    const en = describeEventI18n(ev, 0, nameOf, "EN");
    expect(en?.text).toBe("— Turn 3 · Player A —");
  });

  it("descreve DRAW_CARD em pt-BR e EN", () => {
    const ev: GameEvent = {
      type: "DRAW_CARD",
      player: "B",
      from: "deck",
      instanceId: "c1",
    };

    expect(describeEventI18n(ev, 0, nameOf, "PT_BR")?.text).toBe("Jogador B comprou 1 carta");
    expect(describeEventI18n(ev, 0, nameOf, "EN")?.text).toBe("Player B drew 1 card");
  });

  it("descreve ATTACK_DECLARED e BLOCK_DECLARED", () => {
    const atk: GameEvent = {
      type: "ATTACK_DECLARED",
      attackerId: "unit-1",
      attackingPlayer: "A",
      defendingPlayer: "B",
      target: "player",
    };

    expect(describeEventI18n(atk, 0, nameOf, "PT_BR")?.text).toBe("Gundam atacou Jogador B");
    expect(describeEventI18n(atk, 0, nameOf, "EN")?.text).toBe("Gundam attacked Player B");

    const blk: GameEvent = {
      type: "BLOCK_DECLARED",
      blockerId: "unit-1",
      newTarget: { unitId: "unit-1" },
    };
    expect(describeEventI18n(blk, 0, nameOf, "PT_BR")?.text).toBe("Gundam ativou <Blocker>");
    expect(describeEventI18n(blk, 0, nameOf, "EN")?.text).toBe("Gundam activated <Blocker>");
  });

  it("descreve danos, cura e destruição", () => {
    const dmgUnit: GameEvent = {
      type: "DAMAGE_UNIT",
      instanceId: "unit-1",
      amount: 3,
    };
    expect(describeEventI18n(dmgUnit, 0, nameOf, "PT_BR")?.text).toBe("Gundam recebeu 3 de dano");
    expect(describeEventI18n(dmgUnit, 0, nameOf, "EN")?.text).toBe("Gundam took 3 damage");

    const dmgBase: GameEvent = {
      type: "DAMAGE_BASE",
      instanceId: "base-1",
      amount: 2,
    };
    expect(describeEventI18n(dmgBase, 0, nameOf, "PT_BR")?.text).toBe("A Base recebeu 2 de dano");
    expect(describeEventI18n(dmgBase, 0, nameOf, "EN")?.text).toBe("The Base took 2 damage");

    const heal: GameEvent = {
      type: "HEAL_UNIT",
      instanceId: "unit-1",
      amount: 2,
    };
    expect(describeEventI18n(heal, 0, nameOf, "PT_BR")?.text).toBe("Gundam recuperou 2 HP");
    expect(describeEventI18n(heal, 0, nameOf, "EN")?.text).toBe("Gundam recovered 2 HP");

    const destroy: GameEvent = {
      type: "DESTROY_CARD",
      instanceId: "unit-1",
    };
    expect(describeEventI18n(destroy, 0, nameOf, "PT_BR")?.text).toBe("Gundam foi destruída");
    expect(describeEventI18n(destroy, 0, nameOf, "EN")?.text).toBe("Gundam was destroyed");
  });

  it("descreve GAME_OVER em pt-BR e EN", () => {
    const go: GameEvent = {
      type: "GAME_OVER",
      winner: "A",
      reason: "noShieldsBattleDamage",
    };

    expect(describeEventI18n(go, 0, nameOf, "PT_BR")?.text).toBe("FIM DE JOGO — vitória de Jogador A (dano sem shields)");
    expect(describeEventI18n(go, 0, nameOf, "EN")?.text).toBe("GAME OVER — Player A won (no shields battle damage)");
  });

  it("GRANT_ATTACK_TARGET_RELAX descreve o critério concedido (antes saía 'Lv.undefined' quando era por AP)", () => {
    const relax = (extra: Partial<Extract<GameEvent, { type: "GRANT_ATTACK_TARGET_RELAX" }>>): GameEvent => ({
      type: "GRANT_ATTACK_TARGET_RELAX",
      instanceId: "unit-1",
      turn: 3,
      ...extra,
    });
    const pt = (e: GameEvent) => describeEventI18n(e, 0, nameOf, "PT_BR")?.text;
    const en = (e: GameEvent) => describeEventI18n(e, 0, nameOf, "EN")?.text;

    expect(pt(relax({ maxLevel: 4 }))).toBe("Gundam pode mirar Unit inimiga ativa Lv.4 ou menos neste turno");
    expect(en(relax({ maxLevel: 4 }))).toBe("Gundam can target active enemy Units Lv.4 or lower this turn");
    expect(pt(relax({ maxAp: 5 }))).toBe("Gundam pode mirar Unit inimiga ativa com AP 5 ou menos neste turno");
    expect(en(relax({ maxAp: 5 }))).toBe("Gundam can target active enemy Units with 5 or less AP this turn");
    expect(pt(relax({ apAtMostSelf: true }))).toBe("Gundam pode mirar Unit inimiga ativa com AP igual ou menor que o dela neste turno");
    expect(pt(relax({ levelAtMostSelf: true }))).toBe("Gundam pode mirar Unit inimiga ativa com Lv. igual ou menor que o dela neste turno");
    expect(pt(relax({ unpairedOnly: true }))).toBe("Gundam pode mirar Unit inimiga ativa sem Piloto pareado neste turno");
    expect(pt(relax({ damagedOnly: true }))).toBe("Gundam pode mirar Unit inimiga ativa com dano neste turno");
    expect(pt(relax({ keyword: "Blocker" }))).toBe("Gundam pode mirar Unit inimiga ativa com <Blocker> neste turno");
    expect(en(relax({ keyword: "Blocker" }))).toBe("Gundam can target active enemy Units with <Blocker> this turn");
    expect(pt(relax({}))).toBe("Gundam pode mirar qualquer Unit inimiga ativa neste turno");
    expect(en(relax({}))).toBe("Gundam can target any active enemy Unit this turn");
  });
});

import { describe, expect, it } from "vitest";
import type { GameEvent } from "../engine/types";
import { planChoreography } from "./choreography";
import {
  bannerSound,
  MAX_EFFECT_SOUNDS,
  announceSound,
  commandSound,
  declareSound,
  departureSound,
  deploySound,
  effectSounds,
  shieldSound,
  strikeSound,
} from "./soundCues";

const noLink = { linked: () => false };

describe("sons da mesa", () => {
  it("golpe e pouso pesados a partir do Lv 5 (a mesma régua do pouso pesado)", () => {
    expect(strikeSound(4)).toBe("attack.low");
    expect(strikeSound(5)).toBe("attack.high");
    expect(strikeSound(undefined)).toBe("attack.low");
    expect(deploySound(2)).toBe("deploy.low");
    expect(deploySound(7)).toBe("deploy.high");
  });

  it("declaração: começo do combate, ou o <High-Maneuver>", () => {
    expect(declareSound(false)).toBe("combat.start");
    expect(declareSound(true)).toBe("highManeuver");
  });

  it("Command pelo gatilho; habilidade pelo selo", () => {
    expect(commandSound("Main")).toBe("command.main");
    expect(commandSound("Action")).toBe("command.action");
    expect(commandSound(undefined)).toBe("command.main");
    expect(announceSound("Activate·Main")).toBe("unit.activate");
    expect(announceSound("Activate·Action")).toBe("unit.activate");
    expect(announceSound("Burst")).toBe("ability.burst");
    expect(announceSound("Deploy")).toBe("ability.announce");
  });

  it("só a carta destruída explode; Base tem o som dela", () => {
    expect(departureSound("destroyed", "UNIT")).toBe("unit.destroyed");
    expect(departureSound("destroyed", "BASE")).toBe("base.destroyed");
    expect(departureSound("discarded", "UNIT")).toBeNull();
    expect(departureSound("exiled")).toBeNull();
  });

  it("shield quebrada no ataque a uma Unit é o <Breach>", () => {
    expect(shieldSound("player")).toBe("shield.destroyed");
    expect(shieldSound(undefined)).toBe("shield.destroyed");
    expect(shieldSound({ unitId: "u9" })).toBe("breach");
  });

  it("dano de batalha × dano de efeito; Base atingida; Link × Pair", () => {
    const damage: GameEvent = { type: "DAMAGE_UNIT", instanceId: "u1", amount: 3 } as GameEvent;
    expect(effectSounds([damage], { combatTarget: { unitId: "u1" }, ...noLink })).toEqual(["blocker.damaged"]);
    expect(effectSounds([damage], noLink)).toEqual(["effect.damage"]);
    const base: GameEvent = { type: "DAMAGE_BASE", instanceId: "b1", amount: 2 } as GameEvent;
    expect(effectSounds([base], { combatTarget: "player", ...noLink })).toEqual(["base.damaged"]);
    expect(effectSounds([base], { combatTarget: { unitId: "u1" }, ...noLink })).toEqual(["breach"]);
    const pair: GameEvent = { type: "PAIR_CARDS", pilotId: "p1", unitId: "u1" };
    expect(effectSounds([pair], noLink)).toEqual(["pair"]);
    expect(effectSounds([pair], { linked: (p, u) => p === "p1" && u === "u1" })).toEqual(["link"]);
  });

  it("dano zero não soa; vários efeitos: no máximo os mais importantes, sem repetir", () => {
    expect(effectSounds([{ type: "DAMAGE_UNIT", instanceId: "u1", amount: 0 } as GameEvent], noLink)).toEqual([]);
    const sounds = effectSounds(
      [
        { type: "SET_ACTIVE", instanceId: "r1" },
        { type: "HEAL_UNIT", instanceId: "u1", amount: 1 },
        { type: "DAMAGE_UNIT", instanceId: "u2", amount: 2 } as GameEvent,
        { type: "DAMAGE_UNIT", instanceId: "u3", amount: 2 } as GameEvent,
      ],
      noLink,
    );
    expect(sounds).toHaveLength(MAX_EFFECT_SOUNDS);
    expect(sounds).toEqual(["effect.damage", "unit.repair"]);
  });
});

describe("banners de fase", () => {
  it("a virada de turno já tem o som do turno; a fase de ações avisa; as outras fases levam o som do painel", () => {
    expect(bannerSound("SEU TURNO")).toBeNull();
    expect(bannerSound("TURNO DO OPONENTE")).toBeNull();
    expect(bannerSound("FASE DE AÇÕES")).toBe("phase.action");
    expect(bannerSound("FASE DE COMPRA")).toBe("phase.banner");
    expect(bannerSound("FIM DE TURNO")).toBe("phase.banner");
  });
});

describe("coreografia leva o que o som precisa", () => {
  it("o dano do combate sai marcado com o alvo do ataque; o <Breach> é dano em shield com alvo Unit", () => {
    const { beats } = planChoreography({
      events: [
        { type: "ATTACK_DECLARED", attackerId: "a1", attackingPlayer: "B", defendingPlayer: "A", target: { unitId: "u1" } },
        { type: "DAMAGE_UNIT", instanceId: "u1", amount: 5 } as GameEvent,
        { type: "DESTROY_CARD", instanceId: "u1" },
        { type: "DAMAGE_SHIELD", player: "A", count: 1 } as GameEvent,
        { type: "COMBAT_ENDED" },
      ],
      viewerSeat: "A",
      pendingAttack: null,
      phase: "main",
    });
    const shield = beats.find((b) => b.kind === "departure" && b.shieldsOf);
    expect(shield?.kind === "departure" && shieldSound(shield.combat)).toBe("breach");
    const damage = beats.find((b) => b.kind === "effects");
    expect(damage?.kind === "effects" && damage.combat).toEqual({ unitId: "u1" });
  });

  it("efeito fora do combate não leva alvo de combate; a Command leva o gatilho", () => {
    const { beats } = planChoreography({
      events: [
        { type: "CARD_PLAYED", player: "A", instanceId: "c1", as: "command", trigger: "Action" },
        { type: "DAMAGE_UNIT", instanceId: "u1", amount: 2 } as GameEvent,
      ],
      viewerSeat: "A",
      pendingAttack: null,
      phase: "main",
    });
    expect(beats[0]).toMatchObject({ kind: "play", trigger: "Action" });
    expect(beats[1]?.kind === "effects" && beats[1].combat).toBeUndefined();
  });
});

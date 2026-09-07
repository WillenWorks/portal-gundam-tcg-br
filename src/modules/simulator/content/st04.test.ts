import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { buildSt04DeckList, ST04_CARD_DEFS } from "../fixtures/st04Deck";
import { buildSt03DeckList } from "../fixtures/st03Deck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "../engine/types";
import type { EffectContext } from "../engine/effectSpec";
import { resolveEffectSpec } from "../engine/effectSpec";
import { applyEvents, findCard } from "../engine/events";
import { declareAttack } from "../engine/combat";
import {
  AEGIS_GUNDAM_ATTACK,
  AILE_STRIKE_WHEN_PAIRED,
  ARCHANGEL_ACTIVATE_MAIN,
  ATHRUN_ZALA_WHEN_LINKED,
  HAWK_OF_ENDYMION_MAIN,
  KIRA_YAMATO_ATTACK,
  MAGIC_BULLET_MAIN,
  MIGUELS_GINN_DESTROYED,
  ST04_EFFECT_SPECS,
  STRIKER_PACK_BURST,
  STRIKER_PACK_MAIN_LAUNCHER,
  STRIKER_PACK_MAIN_SWORD,
  STRIKE_GUNDAM_DEPLOY,
  VESALIUS_ACTIVATE_MAIN,
} from "./st04";
import { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-st04fx-${seq++}`;
  state.players[player][zone].push({
    instanceId,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber - 1,
    ...opts,
  });
  return instanceId;
}
function freshGame(): GameState {
  return createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 41, firstPlayer: "A" });
}
function ctxFor(state: GameState, sourceInstanceId: string, targets: Record<string, string[]> = {}): EffectContext {
  return { state, controller: "A", sourceInstanceId, turnNumber: state.turnNumber, targets };
}
function pair(state: GameState, unitId: string, pilotId: string) {
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
}

describe("ST04 — fixtures e cobertura", () => {
  it("decks montam 50 + 10 e a partida ST04 vs ST03 inicia sem erro", () => {
    expect(() => createGame(buildSt04DeckList(), buildSt03DeckList(), { seed: 2, firstPlayer: "B" })).not.toThrow();
    expect(buildSt04DeckList().main).toHaveLength(50);
    expect(buildSt04DeckList().resources).toHaveLength(10);
  });

  it("21 EffectSpecs cadastrados cobrindo 11 das 16 cartas únicas (resto é vanilla/keyword)", () => {
    const codes = new Set(ST04_EFFECT_SPECS.map((s) => s.cardCode));
    expect(ST04_EFFECT_SPECS).toHaveLength(21); // ST04-012 Striker Pack 【Main】 = 2 specs (guarda de token + escolha Sword/Launcher)
    expect(codes).toEqual(
      new Set(["ST04-001", "ST04-002", "ST04-006", "ST04-009", "ST04-010", "ST04-011", "ST04-012", "ST04-013", "ST04-014", "ST04-015", "ST04-016"]),
    );
  });
});

describe("ST04 — EffectSpecs bespoke", () => {
  it("ST04-001 Aile Strike — 【When Paired･Lv.4+ Pilot】devolve Unit inimiga HP≤4 pra mão", () => {
    const state = freshGame();
    const aileId = place(state, "A", ST04_CARD_DEFS.AILE_STRIKE_GUNDAM, "battleArea");
    const kiraId = place(state, "A", ST04_CARD_DEFS.KIRA_YAMATO, "battleArea"); // Lv.4
    pair(state, aileId, kiraId);
    const enemyId = place(state, "B", ST04_CARD_DEFS.GINN, "battleArea"); // HP2
    const next = applyEvents(state, resolveEffectSpec(AILE_STRIKE_WHEN_PAIRED, ctxFor(state, aileId, { target: [enemyId] }), defaultPredicateResolver));
    expect(next.players.B.hand.some((c) => c.instanceId === enemyId)).toBe(true);
    expect(next.players.B.battleArea.some((c) => c.instanceId === enemyId)).toBe(false);
  });

  it("ST04-001 Aile Strike — sem Pilot Lv.4+ o efeito não dispara", () => {
    const state = freshGame();
    const aileId = place(state, "A", ST04_CARD_DEFS.AILE_STRIKE_GUNDAM, "battleArea");
    const enemyId = place(state, "B", ST04_CARD_DEFS.GINN, "battleArea");
    const events = resolveEffectSpec(AILE_STRIKE_WHEN_PAIRED, ctxFor(state, aileId, { target: [enemyId] }), defaultPredicateResolver);
    expect(events).toHaveLength(0);
  });

  it("ST04-002 Strike Gundam — 【Deploy】compra 1 e descarta 1 escolhida", () => {
    const state = freshGame();
    const strikeId = place(state, "A", ST04_CARD_DEFS.STRIKE_GUNDAM, "battleArea");
    const toDiscard = state.players.A.hand[0].instanceId;
    const next = applyEvents(state, resolveEffectSpec(STRIKE_GUNDAM_DEPLOY, ctxFor(state, strikeId, { discard: [toDiscard] })));
    expect(next.players.A.trash.some((c) => c.instanceId === toDiscard)).toBe(true);
  });

  it("ST04-006 Aegis Gundam — 【Attack】com AP≥5 dá 3 de dano em Unit Lv.5+", () => {
    const state = freshGame();
    const aegisId = place(state, "A", ST04_CARD_DEFS.AEGIS_GUNDAM, "battleArea", {
      statModifiers: [{ stat: "ap", amount: 1, duration: "endOfTurn", appliedOnTurn: state.turnNumber }],
    }); // AP4 + 1 = 5
    const bigEnemyId = place(state, "B", ST04_CARD_DEFS.AILE_STRIKE_GUNDAM, "battleArea"); // Lv.5 HP4
    const next = applyEvents(state, resolveEffectSpec(AEGIS_GUNDAM_ATTACK, ctxFor(state, aegisId, { target: [bigEnemyId] }), defaultPredicateResolver));
    expect(findCard(next, bigEnemyId).damage).toBe(3);
  });

  it("ST04-009 Miguel's Ginn — 【Destroyed】compra 1 se há outra Link Unit amiga", () => {
    const state = freshGame();
    const ginnId = place(state, "A", ST04_CARD_DEFS.MIGUELS_GINN, "trash");
    // outra Link Unit: Strike Gundam (link [Kira Yamato]) pareada com Kira
    const strikeId = place(state, "A", ST04_CARD_DEFS.STRIKE_GUNDAM, "battleArea");
    const kiraId = place(state, "A", ST04_CARD_DEFS.KIRA_YAMATO, "battleArea");
    pair(state, strikeId, kiraId);
    const handBefore = state.players.A.hand.length;
    const next = applyEvents(state, resolveEffectSpec(MIGUELS_GINN_DESTROYED, ctxFor(state, ginnId), defaultPredicateResolver));
    expect(next.players.A.hand).toHaveLength(handBefore + 1);
  });

  it("ST04-010 Kira Yamato — 【Attack】Unit inimiga fica com AP-2 nesta batalha", () => {
    const state = freshGame();
    const kiraId = place(state, "A", ST04_CARD_DEFS.KIRA_YAMATO, "battleArea");
    const enemyId = place(state, "B", ST04_CARD_DEFS.STRIKE_DAGGER, "battleArea");
    const next = applyEvents(state, resolveEffectSpec(KIRA_YAMATO_ATTACK, ctxFor(state, kiraId, { target: [enemyId] })));
    expect(findCard(next, enemyId).statModifiers).toContainEqual(expect.objectContaining({ stat: "ap", amount: -2, duration: "thisBattle" }));
  });

  it("ST04-012 Striker Pack — 【Burst】invoca token Aile Strike se não há token Earth Alliance", () => {
    const state = freshGame();
    const cmdId = place(state, "A", ST04_CARD_DEFS.STRIKER_PACK, "trash");
    const before = state.players.A.battleArea.length;
    const next = applyEvents(state, resolveEffectSpec(STRIKER_PACK_BURST, ctxFor(state, cmdId), defaultPredicateResolver));
    expect(next.players.A.battleArea).toHaveLength(before + 1);
    expect(next.players.A.battleArea[next.players.A.battleArea.length - 1].def.code).toBe("T-008");
  });

  // 2 specs de mesmo (cardCode, trigger): a guarda "no Earth Alliance token" +
  // a escolha Sword/Launcher. Só um dispara — resolvemos os dois e concatenamos.
  function strikerMain(state: GameState, cmdId: string, choice?: "launcher" | "sword"): GameState {
    const targets: Record<string, string[]> = choice ? { strikerChoice: [choice] } : {};
    return applyEvents(state, [
      ...resolveEffectSpec(STRIKER_PACK_MAIN_LAUNCHER, ctxFor(state, cmdId, targets), defaultPredicateResolver),
      ...resolveEffectSpec(STRIKER_PACK_MAIN_SWORD, ctxFor(state, cmdId, targets), defaultPredicateResolver),
    ]);
  }

  it("ST04-012 Striker Pack — 【Main】sem token Earth Alliance: 'launcher' → T-009, senão (sword / sem escolha) → T-010", () => {
    let state = freshGame();
    let cmdId = place(state, "A", ST04_CARD_DEFS.STRIKER_PACK, "trash");
    const launcher = strikerMain(state, cmdId, "launcher");
    expect(launcher.players.A.battleArea[launcher.players.A.battleArea.length - 1].def.code).toBe("T-009");

    state = freshGame();
    cmdId = place(state, "A", ST04_CARD_DEFS.STRIKER_PACK, "trash");
    const sword = strikerMain(state, cmdId, "sword");
    expect(sword.players.A.battleArea[sword.players.A.battleArea.length - 1].def.code).toBe("T-010");

    state = freshGame();
    cmdId = place(state, "A", ST04_CARD_DEFS.STRIKER_PACK, "trash");
    const noChoice = strikerMain(state, cmdId); // default = sword
    expect(noChoice.players.A.battleArea[noChoice.players.A.battleArea.length - 1].def.code).toBe("T-010");
  });

  it("ST04-012 Striker Pack — 【Main】NÃO invoca nada se já há um token (Earth Alliance) em campo", () => {
    const state = freshGame();
    const cmdId = place(state, "A", ST04_CARD_DEFS.STRIKER_PACK, "trash");
    place(state, "A", ST04_CARD_DEFS.TOKEN_AILE_STRIKE, "battleArea"); // já tem token EA
    const before = state.players.A.battleArea.length;
    const next = strikerMain(state, cmdId, "launcher");
    expect(next.players.A.battleArea).toHaveLength(before); // nenhum token novo
  });

  it("ST04-013 Hawk of Endymion — 【Main】devolve Unit inimiga HP≤3 pra mão", () => {
    const state = freshGame();
    const cmdId = place(state, "A", ST04_CARD_DEFS.HAWK_OF_ENDYMION, "trash");
    const enemyId = place(state, "B", ST04_CARD_DEFS.MOEBIUS_ZERO, "battleArea"); // HP4 -> NÃO passa hp<=3
    const strongEnemy = place(state, "B", ST04_CARD_DEFS.GINN, "battleArea"); // HP2 -> passa
    expect(defaultTargetFilterResolver("hp<=3", findCard(state, enemyId), { state })).toBe(false);
    const next = applyEvents(state, resolveEffectSpec(HAWK_OF_ENDYMION_MAIN, ctxFor(state, cmdId, { target: [strongEnemy] })));
    expect(next.players.B.hand.some((c) => c.instanceId === strongEnemy)).toBe(true);
  });

  it("ST04-014 The Magic Bullet of Dusk — 【Main】Unit amiga Lv≤2 ganha <First Strike>", () => {
    const state = freshGame();
    const cmdId = place(state, "A", ST04_CARD_DEFS.THE_MAGIC_BULLET_OF_DUSK, "trash");
    const allyId = place(state, "A", ST04_CARD_DEFS.GINN, "battleArea"); // Lv.2
    const next = applyEvents(state, resolveEffectSpec(MAGIC_BULLET_MAIN, ctxFor(state, cmdId, { target: [allyId] })));
    expect(findCard(next, allyId).keywordGrants.some((g) => g.keyword === "First Strike")).toBe(true);
  });

  it("ST04-015 Archangel — 【Activate･Main】paga 2, seta Unit <Blocker> amiga como active e proíbe ataque no turno", () => {
    const state = freshGame();
    const baseId = place(state, "A", ST04_CARD_DEFS.ARCHANGEL, "baseSection");
    [0, 1, 2].forEach(() => place(state, "A", ST04_CARD_DEFS.RESOURCE, "resourceArea"));
    const blockerId = place(state, "A", ST04_CARD_DEFS.MOEBIUS, "battleArea", { rested: true }); // <Blocker>
    const events = resolveEffectSpec(ARCHANGEL_ACTIVATE_MAIN, ctxFor(state, baseId, { target: [blockerId] }));
    expect(events).toContainEqual({ type: "SET_CANNOT_ATTACK", instanceId: blockerId, turn: state.turnNumber });
    const next = applyEvents(state, events);
    expect(findCard(next, blockerId).rested).toBe(false);
    expect(findCard(next, blockerId).cannotAttackUntilTurn).toBe(next.turnNumber);
  });

  it("ST04-015 Archangel — a Unit setada como active não consegue declarar ataque no mesmo turno", () => {
    const state = { ...freshGame(), phase: "main" as const };
    const baseId = place(state, "A", ST04_CARD_DEFS.ARCHANGEL, "baseSection");
    [0, 1, 2].forEach(() => place(state, "A", ST04_CARD_DEFS.RESOURCE, "resourceArea"));
    const blockerId = place(state, "A", ST04_CARD_DEFS.MOEBIUS, "battleArea", { rested: true });
    const next = applyEvents(state, resolveEffectSpec(ARCHANGEL_ACTIVATE_MAIN, ctxFor(state, baseId, { target: [blockerId] })));
    expect(() => declareAttack(next, blockerId, "player")).toThrow(/não pode atacar neste turno/);
  });

  it("ST04-011 Athrun Zala — 【When Linked】concede attackTargetRelaxUntilTurn à Unit pareada", () => {
    const state = freshGame();
    const aegisId = place(state, "A", ST04_CARD_DEFS.AEGIS_GUNDAM, "battleArea"); // link [Athrun Zala]
    const athrunId = place(state, "A", ST04_CARD_DEFS.ATHRUN_ZALA, "battleArea", { pairedUnitId: aegisId });
    findCard(state, aegisId).pairedPilotId = athrunId;
    const next = applyEvents(state, resolveEffectSpec(ATHRUN_ZALA_WHEN_LINKED, ctxFor(state, athrunId), defaultPredicateResolver));
    expect(findCard(next, aegisId).attackTargetRelaxUntilTurn).toEqual({ maxLevel: 5, turn: next.turnNumber });
  });

  it("ST04-011 Athrun Zala — depois da concessão, a Unit pareada mira Unit inimiga ATIVA Lv<=5", () => {
    const state = { ...freshGame(), phase: "main" as const };
    const aegisId = place(state, "A", ST04_CARD_DEFS.AEGIS_GUNDAM, "battleArea", {
      attackTargetRelaxUntilTurn: { maxLevel: 5, turn: state.turnNumber },
    });
    const activeEnemyId = place(state, "B", ST04_CARD_DEFS.STRIKE_GUNDAM, "battleArea"); // Lv.4, ativa
    const next = declareAttack(state, aegisId, { unitId: activeEnemyId });
    expect(next.combat?.currentTarget).toEqual({ unitId: activeEnemyId });
  });

  it("ST04-016 Vesalius — 【Activate･Main】resta a Base e dá AP+1 numa Unit amiga", () => {
    const state = freshGame();
    const baseId = place(state, "A", ST04_CARD_DEFS.VESALIUS, "baseSection");
    const allyId = place(state, "A", ST04_CARD_DEFS.GINN, "battleArea");
    const next = applyEvents(state, resolveEffectSpec(VESALIUS_ACTIVATE_MAIN, ctxFor(state, baseId, { target: [allyId] })));
    expect(findCard(next, baseId).rested).toBe(true);
    expect(findCard(next, allyId).statModifiers).toContainEqual(expect.objectContaining({ stat: "ap", amount: 1 }));
  });
});

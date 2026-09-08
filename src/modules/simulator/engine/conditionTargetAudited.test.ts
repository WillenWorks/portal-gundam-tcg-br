import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { deployCard, playCommand } from "./deploy";
import { applyEvents } from "./events";
import { buildSt04DeckList, ST04_CARD_DEFS, TOKEN_AILE_STRIKE } from "../fixtures/st04Deck";
import { buildSt03DeckList, ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList, ST02_CARD_DEFS } from "../fixtures/st02Deck";
import {
  ALL_EFFECT_SPECS,
  defaultPredicateResolver,
  defaultTargetFilterResolver,
} from "../content";
import {
  computeLegalTargets,
  resolveEffectSpec,
} from "./effectSpec";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import type { EffectContext } from "./effectSpec";
import { STRIKER_PACK_BURST } from "../content/st04";
import { SIEGE_PLOY_MAIN } from "../content/st02";
import { CLOSE_COMBAT_MAIN } from "../content/st03";
import { HAWK_OF_ENDYMION_MAIN } from "../content/st04";

const dispatchOptions = {
  specs: ALL_EFFECT_SPECS,
  predicateResolver: defaultPredicateResolver,
  targetFilterResolver: defaultTargetFilterResolver,
};

function applyAction(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(
    state,
    player,
    action,
    ALL_EFFECT_SPECS,
    defaultPredicateResolver,
    defaultTargetFilterResolver
  );
}

const TEST_PILOT_LV3: CardDef = {
  code: "TEST-PILOT-01",
  nameEn: "Test Pilot Lv.3",
  cardType: "PILOT",
  color: "white",
  level: 3,
  cost: 1,
  ap: 1,
  hp: 1,
};

let seq = 0;
function placeCard(
  state: GameState,
  player: PlayerId,
  def: CardDef,
  zone: Zone,
  opts: Partial<CardInstance> = {}
): CardInstance {
  const instance: CardInstance = {
    instanceId: `${player}-audit-${seq++}`,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
    ...opts,
  };
  state.players[player][zone].push(instance);
  return instance;
}

function addResources(state: GameState, player: PlayerId, count: number, resourceDef: CardDef) {
  for (let i = 0; i < count; i++) {
    placeCard(state, player, resourceDef, "resourceArea");
  }
}

describe("ST01-ST04 Condition vs Target Selection Audit", () => {
  describe("ST04-006 Aegis Gundam: 【Attack】If this Unit has 5 or more AP, choose 1 enemy Unit Lv.5+", () => {
    it("does NOT prompt for target when AP is 4 (< 5)", () => {
      const state = advanceToMainPhase(
        createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 100, firstPlayer: "A" })
      );
      const aegis = placeCard(state, "A", ST04_CARD_DEFS.AEGIS_GUNDAM, "battleArea"); // AP 4
      placeCard(state, "B", ST04_CARD_DEFS.AILE_STRIKE_GUNDAM, "battleArea"); // Lv.5

      const afterAttack = applyAction(state, "A", {
        kind: "declareAttack",
        attackerId: aegis.instanceId,
        target: "player",
      });

      // Condition selfApAtLeast:5 failed -> no pendingDecision
      expect(afterAttack.pendingDecision.A).toBeNull();
    });

    it("prompts for target when AP is 5 (>= 5) and filters enemy units Lv.5+", () => {
      const state = advanceToMainPhase(
        createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 101, firstPlayer: "A" })
      );
      const aegis = placeCard(state, "A", ST04_CARD_DEFS.AEGIS_GUNDAM, "battleArea", {
        statModifiers: [{ stat: "ap", amount: 1, duration: "endOfTurn", appliedOnTurn: 1 }],
      }); // AP 4 + 1 = 5
      const lv5Enemy = placeCard(state, "B", ST04_CARD_DEFS.AILE_STRIKE_GUNDAM, "battleArea"); // Lv.5
      const lv3Enemy = placeCard(state, "B", ST04_CARD_DEFS.GINN, "battleArea"); // Lv.3

      const afterAttack = applyAction(state, "A", {
        kind: "declareAttack",
        attackerId: aegis.instanceId,
        target: "player",
      });

      // Condition selfApAtLeast:5 passed -> prompts abilityResolution
      expect(afterAttack.pendingDecision.A).not.toBeNull();
      expect(afterAttack.pendingDecision.A?.kind).toBe("abilityResolution");
      if (afterAttack.pendingDecision.A?.kind === "abilityResolution") {
        const item = afterAttack.pendingDecision.A.queue[0];
        expect(item.specId).toBe("ST04-006-Attack");
        expect(item.legalTargets).toContain(lv5Enemy.instanceId);
        expect(item.legalTargets).not.toContain(lv3Enemy.instanceId);
      }
    });

    it("handles ability when AP is 5 but opponent has no Lv.5+ units (legalTargets is empty)", () => {
      const state = advanceToMainPhase(
        createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 102, firstPlayer: "A" })
      );
      const aegis = placeCard(state, "A", ST04_CARD_DEFS.AEGIS_GUNDAM, "battleArea", {
        statModifiers: [{ stat: "ap", amount: 1, duration: "endOfTurn", appliedOnTurn: 1 }],
      }); // AP 5
      placeCard(state, "B", ST04_CARD_DEFS.GINN, "battleArea"); // Lv.3 (no Lv.5 units)

      const afterAttack = applyAction(state, "A", {
        kind: "declareAttack",
        attackerId: aegis.instanceId,
        target: "player",
      });

      // Condition passed -> queue has item with legalTargets: []
      expect(afterAttack.pendingDecision.A?.kind).toBe("abilityResolution");
      if (afterAttack.pendingDecision.A?.kind === "abilityResolution") {
        expect(afterAttack.pendingDecision.A.queue[0].legalTargets).toEqual([]);
      }
    });
  });

  describe("ST04-001 Aile Strike Gundam: 【When Paired･Lv.4 or Higher Pilot】", () => {
    it("does NOT prompt for target when paired with Level 3 pilot", () => {
      const state = advanceToMainPhase(
        createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 103, firstPlayer: "A" })
      );
      const aile = placeCard(state, "A", ST04_CARD_DEFS.AILE_STRIKE_GUNDAM, "battleArea");
      const pilotLv3 = placeCard(state, "A", TEST_PILOT_LV3, "hand"); // Lv.3, Cost 1
      placeCard(state, "B", ST04_CARD_DEFS.GINN, "battleArea"); // HP 2
      addResources(state, "A", 3, ST04_CARD_DEFS.RESOURCE);

      const afterDeploy = deployCard(state, "A", pilotLv3.instanceId, {
        ...dispatchOptions,
        pairWithUnitId: aile.instanceId,
      });

      // Condition pairedPilotLevelAtLeast:4 is false -> no prompt
      expect(afterDeploy.pendingDecision.A).toBeNull();
    });

    it("prompts for target when paired with Level 4 pilot and only targets enemy units with HP <= 4", () => {
      const state = advanceToMainPhase(
        createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 104, firstPlayer: "A" })
      );
      const aile = placeCard(state, "A", ST04_CARD_DEFS.AILE_STRIKE_GUNDAM, "battleArea");
      const pilotLv4 = placeCard(state, "A", ST04_CARD_DEFS.ATHRUN_ZALA, "hand"); // Lv.4, Cost 3
      const enemyLowHp = placeCard(state, "B", ST04_CARD_DEFS.GINN, "battleArea"); // HP 2
      const enemyHighHp = placeCard(state, "B", ST02_CARD_DEFS.WING_GUNDAM, "battleArea"); // HP 5
      addResources(state, "A", 4, ST04_CARD_DEFS.RESOURCE);

      const afterDeploy = deployCard(state, "A", pilotLv4.instanceId, {
        ...dispatchOptions,
        pairWithUnitId: aile.instanceId,
      });

      // Condition pairedPilotLevelAtLeast:4 is true -> prompts abilityResolution
      expect(afterDeploy.pendingDecision.A).not.toBeNull();
      expect(afterDeploy.pendingDecision.A?.kind).toBe("abilityResolution");
      if (afterDeploy.pendingDecision.A?.kind === "abilityResolution") {
        const item = afterDeploy.pendingDecision.A.queue[0];
        expect(item.specId).toBe("ST04-001-WhenPaired");
        expect(item.legalTargets).toContain(enemyLowHp.instanceId);
        expect(item.legalTargets).not.toContain(enemyHighHp.instanceId);
      }
    });
  });

  describe("ST04-012 Striker Pack: 【Main】/【Burst】If you have no (Earth Alliance) Unit tokens in play", () => {
    it("Main: does NOT prompt for choice when player already controls an Earth Alliance token", () => {
      const state = advanceToMainPhase(
        createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 105, firstPlayer: "A" })
      );
      // Place existing Earth Alliance token in battle area
      placeCard(state, "A", TOKEN_AILE_STRIKE, "battleArea");
      const strikerPack = placeCard(state, "A", ST04_CARD_DEFS.STRIKER_PACK, "hand");
      addResources(state, "A", 3, ST04_CARD_DEFS.RESOURCE);

      const afterPlay = playCommand(
        state,
        "A",
        strikerPack.instanceId,
        "Main",
        ALL_EFFECT_SPECS,
        {
          predicateResolver: defaultPredicateResolver,
          targetFilterResolver: defaultTargetFilterResolver,
        }
      );

      // Condition noControllerUnitTokenWithTrait:Earth Alliance failed -> no pendingDecision
      expect(afterPlay.pendingDecision.A).toBeNull();
      // No extra unit was spawned
      expect(afterPlay.players.A.battleArea).toHaveLength(1);
    });

    it("Main: prompts for enumChoice when player controls NO Earth Alliance token", () => {
      const state = advanceToMainPhase(
        createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 106, firstPlayer: "A" })
      );
      const strikerPack = placeCard(state, "A", ST04_CARD_DEFS.STRIKER_PACK, "hand");
      addResources(state, "A", 3, ST04_CARD_DEFS.RESOURCE);

      const afterPlay = playCommand(
        state,
        "A",
        strikerPack.instanceId,
        "Main",
        ALL_EFFECT_SPECS,
        {
          predicateResolver: defaultPredicateResolver,
          targetFilterResolver: defaultTargetFilterResolver,
        }
      );

      // Condition passed -> prompts choice between sword and launcher
      expect(afterPlay.pendingDecision.A).not.toBeNull();
      expect(afterPlay.pendingDecision.A?.kind).toBe("abilityResolution");
      if (afterPlay.pendingDecision.A?.kind === "abilityResolution") {
        const item = afterPlay.pendingDecision.A.queue[0];
        expect(item.enumChoice).toBeDefined();
        expect(item.enumChoice?.key).toBe("strikerChoice");
        expect(item.enumChoice?.options.map((o) => o.value)).toEqual([
          "sword",
          "launcher",
        ]);
      }
    });

    it("Burst: does NOT spawn token when Earth Alliance token already in play", () => {
      const state = createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 107, firstPlayer: "A" });
      placeCard(state, "A", TOKEN_AILE_STRIKE, "battleArea");
      const cmd = placeCard(state, "A", ST04_CARD_DEFS.STRIKER_PACK, "trash");
      const beforeCount = state.players.A.battleArea.length;

      const ctx: EffectContext = {
        state,
        controller: "A",
        sourceInstanceId: cmd.instanceId,
        turnNumber: state.turnNumber,
        targets: {},
      };
      const events = resolveEffectSpec(STRIKER_PACK_BURST, ctx, defaultPredicateResolver);
      const next = applyEvents(state, events);

      expect(next.players.A.battleArea).toHaveLength(beforeCount);
    });
  });

  describe("ST03-015 Rewloola: 【Deploy】Add 1 Shield to hand. Then, choose 1 enemy Unit with AP<=5, deal 1 damage", () => {
    it("adds shield even if enemy has no Units with AP <= 5", () => {
      const state = advanceToMainPhase(
        createGame(buildSt03DeckList(), buildSt03DeckList(), { seed: 108, firstPlayer: "A" })
      );
      const rewloola = placeCard(state, "A", ST03_CARD_DEFS.REWLOOLA, "hand");
      const shieldCard = placeCard(state, "A", ST03_CARD_DEFS.ZAKU_II, "shields");
      // Set shields to only this shield to explicitly track
      state.players.A.shields = [shieldCard];
      // Enemy unit with AP 6 (> 5)
      placeCard(state, "B", ST03_CARD_DEFS.SINANJU, "battleArea", {
        statModifiers: [{ stat: "ap", amount: 1, duration: "endOfTurn", appliedOnTurn: 1 }],
      });
      addResources(state, "A", 3, ST03_CARD_DEFS.RESOURCE);

      const afterDeploy = deployCard(state, "A", rewloola.instanceId, dispatchOptions);

      // Shield should be added to hand
      expect(afterDeploy.players.A.hand.some((c) => c.instanceId === shieldCard.instanceId)).toBe(true);
      // And damage effect queues with 0 legal targets
      expect(afterDeploy.pendingDecision.A?.kind).toBe("abilityResolution");
      if (afterDeploy.pendingDecision.A?.kind === "abilityResolution") {
        expect(afterDeploy.pendingDecision.A.queue[0].specId).toBe("ST03-015-Deploy-Damage");
        expect(afterDeploy.pendingDecision.A.queue[0].legalTargets).toEqual([]);
      }

      // Resolving with targetIds: [] succeeds cleanly
      const afterResolve = applyAction(afterDeploy, "A", {
        kind: "resolveAbility",
        resolutions: [{ specId: "ST03-015-Deploy-Damage", activate: true, targetIds: [] }],
      });
      expect(afterResolve.pendingDecision.A).toBeNull();
    });

    it("deals damage to AP<=5 unit even if player has 0 shields", () => {
      const state = advanceToMainPhase(
        createGame(buildSt03DeckList(), buildSt03DeckList(), { seed: 109, firstPlayer: "A" })
      );
      // Empty shields
      state.players.A.shields = [];
      const rewloola = placeCard(state, "A", ST03_CARD_DEFS.REWLOOLA, "hand");
      const enemyLowAp = placeCard(state, "B", ST03_CARD_DEFS.ZAKU_II, "battleArea"); // AP 2
      const enemyHighAp = placeCard(state, "B", ST03_CARD_DEFS.SINANJU, "battleArea", {
        statModifiers: [{ stat: "ap", amount: 1, duration: "endOfTurn", appliedOnTurn: 1 }],
      }); // AP 6
      addResources(state, "A", 3, ST03_CARD_DEFS.RESOURCE);

      const afterDeploy = deployCard(state, "A", rewloola.instanceId, dispatchOptions);

      // Deploy-Shield safely did nothing (0 shields)
      expect(afterDeploy.players.A.shields).toHaveLength(0);
      // Deploy-Damage prompts for the AP<=5 enemy unit
      expect(afterDeploy.pendingDecision.A).not.toBeNull();
      expect(afterDeploy.pendingDecision.A?.kind).toBe("abilityResolution");
      if (afterDeploy.pendingDecision.A?.kind === "abilityResolution") {
        const item = afterDeploy.pendingDecision.A.queue[0];
        expect(item.specId).toBe("ST03-015-Deploy-Damage");
        expect(item.legalTargets).toContain(enemyLowAp.instanceId);
        expect(item.legalTargets).not.toContain(enemyHighAp.instanceId);
      }
    });
  });

  describe("Target Scope & Filter Auditing across ST01-ST04", () => {
    it("ST01-006 Guntank Deploy only targets enemy units with HP <= 2", () => {
      const state = advanceToMainPhase(
        createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 110, firstPlayer: "A" })
      );
      const guntank = placeCard(state, "A", ST01_CARD_DEFS.GUNTANK, "hand");
      const enemyHp2 = placeCard(state, "B", ST01_CARD_DEFS.DEMI_TRAINER, "battleArea"); // HP 2
      const enemyHp5 = placeCard(state, "B", ST01_CARD_DEFS.GUNDAM, "battleArea"); // HP 4 (actually GUNDAM is HP 4, let's use WING_GUNDAM HP 5)
      const friendlyHp2 = placeCard(state, "A", ST01_CARD_DEFS.DEMI_TRAINER, "battleArea"); // friendly HP 2
      addResources(state, "A", 3, ST01_CARD_DEFS.RESOURCE);

      const afterDeploy = deployCard(state, "A", guntank.instanceId, dispatchOptions);
      expect(afterDeploy.pendingDecision.A?.kind).toBe("abilityResolution");
      if (afterDeploy.pendingDecision.A?.kind === "abilityResolution") {
        const item = afterDeploy.pendingDecision.A.queue[0];
        expect(item.legalTargets).toContain(enemyHp2.instanceId);
        expect(item.legalTargets).not.toContain(enemyHp5.instanceId);
        expect(item.legalTargets).not.toContain(friendlyHp2.instanceId);
      }
    });

    it("ST02-014 Siege Ploy only targets enemy units with HP <= 5", () => {
      const state = advanceToMainPhase(
        createGame(buildSt02DeckList(), buildSt02DeckList(), { seed: 111, firstPlayer: "A" })
      );
      const siegePloy = placeCard(state, "A", ST02_CARD_DEFS.SIEGE_PLOY, "hand");
      const enemyHp2 = placeCard(state, "B", ST02_CARD_DEFS.LEO, "battleArea"); // HP 2 <= 5
      const enemyHp5 = placeCard(state, "B", ST02_CARD_DEFS.WING_GUNDAM, "battleArea"); // HP 5
      const friendlyHp2 = placeCard(state, "A", ST02_CARD_DEFS.LEO, "battleArea"); // friendly
      addResources(state, "A", 3, ST02_CARD_DEFS.RESOURCE);

      const legal = computeLegalTargets(state, SIEGE_PLOY_MAIN, "A", defaultTargetFilterResolver);
      expect(legal).toContain(enemyHp2.instanceId);
      expect(legal).toContain(enemyHp5.instanceId);
      expect(legal).not.toContain(friendlyHp2.instanceId);

      // Verify playCommand validates against legal targets
      expect(() =>
        playCommand(state, "A", siegePloy.instanceId, "Main", ALL_EFFECT_SPECS, {
          targets: { target: [friendlyHp2.instanceId] },
          targetFilterResolver: defaultTargetFilterResolver,
        })
      ).toThrow(/Alvo inválido/);

      expect(() =>
        playCommand(state, "A", siegePloy.instanceId, "Main", ALL_EFFECT_SPECS, {
          targets: { target: [enemyHp2.instanceId] },
          targetFilterResolver: defaultTargetFilterResolver,
        })
      ).not.toThrow();
    });

    it("ST03-013 Close Combat only targets enemy units", () => {
      const state = advanceToMainPhase(
        createGame(buildSt03DeckList(), buildSt03DeckList(), { seed: 112, firstPlayer: "A" })
      );
      const closeCombat = placeCard(state, "A", ST03_CARD_DEFS.CLOSE_COMBAT, "hand");
      const enemy = placeCard(state, "B", ST03_CARD_DEFS.ZAKU_II, "battleArea");
      const friendly = placeCard(state, "A", ST03_CARD_DEFS.ZAKU_II, "battleArea");
      addResources(state, "A", 3, ST03_CARD_DEFS.RESOURCE);

      const legal = computeLegalTargets(state, CLOSE_COMBAT_MAIN, "A", defaultTargetFilterResolver);
      expect(legal).toContain(enemy.instanceId);
      expect(legal).not.toContain(friendly.instanceId);

      expect(() =>
        playCommand(state, "A", closeCombat.instanceId, "Main", ALL_EFFECT_SPECS, {
          targets: { target: [friendly.instanceId] },
          targetFilterResolver: defaultTargetFilterResolver,
        })
      ).toThrow(/Alvo inválido/);

      expect(() =>
        playCommand(state, "A", closeCombat.instanceId, "Main", ALL_EFFECT_SPECS, {
          targets: { target: [enemy.instanceId] },
          targetFilterResolver: defaultTargetFilterResolver,
        })
      ).not.toThrow();
    });

    it("ST04-013 Hawk of Endymion only targets enemy units with HP <= 3", () => {
      const state = advanceToMainPhase(
        createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 113, firstPlayer: "A" })
      );
      const hawk = placeCard(state, "A", ST04_CARD_DEFS.HAWK_OF_ENDYMION, "hand");
      const enemyHp2 = placeCard(state, "B", ST04_CARD_DEFS.GINN, "battleArea"); // HP 2
      const enemyHp5 = placeCard(state, "B", ST02_CARD_DEFS.WING_GUNDAM, "battleArea"); // HP 5
      const friendlyHp2 = placeCard(state, "A", ST04_CARD_DEFS.GINN, "battleArea"); // friendly
      addResources(state, "A", 3, ST04_CARD_DEFS.RESOURCE);

      const legal = computeLegalTargets(state, HAWK_OF_ENDYMION_MAIN, "A", defaultTargetFilterResolver);
      expect(legal).toContain(enemyHp2.instanceId);
      expect(legal).not.toContain(enemyHp5.instanceId);
      expect(legal).not.toContain(friendlyHp2.instanceId);

      expect(() =>
        playCommand(state, "A", hawk.instanceId, "Main", ALL_EFFECT_SPECS, {
          targets: { target: [enemyHp5.instanceId] },
          targetFilterResolver: defaultTargetFilterResolver,
        })
      ).toThrow(/Alvo inválido/);

      expect(() =>
        playCommand(state, "A", hawk.instanceId, "Main", ALL_EFFECT_SPECS, {
          targets: { target: [enemyHp2.instanceId] },
          targetFilterResolver: defaultTargetFilterResolver,
        })
      ).not.toThrow();
    });
  });
});

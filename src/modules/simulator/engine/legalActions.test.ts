import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { declareAttack, proceedToBlockStep } from "./combat";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { actionOwner, enumerateLegalActions } from "./legalActions";

/**
 * Testes isolados do enumerador de ações legais (docs/44, Fase 1 — §3.3).
 * Estados montados à mão via fixture; asserts na lista de `PlayerAction`
 * devolvida. Cada teste usa `ALL_EFFECT_SPECS` + os resolvers reais, igual ao
 * servidor.
 */

const OPTS = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-la-${seq++}`;
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

function giveResources(state: GameState, player: PlayerId, n: number): void {
  for (let i = 0; i < n; i++) {
    place(state, player, { code: "LA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
  }
}

function mainPhaseGame(): GameState {
  return advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 1, firstPlayer: "A" }));
}

describe("enumerateLegalActions", () => {
  it("devolve [] quando não é a vez do assento", () => {
    const state = mainPhaseGame();
    expect(actionOwner(state)).toBe("A");
    expect(enumerateLegalActions(state, "B", ALL_EFFECT_SPECS, OPTS)).toEqual([]);
  });

  it("Main Phase: sempre inclui finishTurn", () => {
    const state = mainPhaseGame();
    const actions = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS);
    expect(actions.some((a) => a.kind === "finishTurn")).toBe(true);
  });

  it("Main Phase: propõe deployCard só pra carta da mão pagável", () => {
    const state = mainPhaseGame();
    state.players.A.hand = [];
    state.players.A.resourceArea = [];
    giveResources(state, "A", 4);
    const gundamId = place(state, "A", ST01_CARD_DEFS.GUNDAM, "hand"); // Lv4/custo3 — pagável
    const aerialId = place(state, "A", ST01_CARD_DEFS.AERIAL_SCORE_SIX, "hand"); // Lv5 — nível insuficiente (4 recursos)

    const actions = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS);
    const deploys = actions.filter((a) => a.kind === "deployCard");
    expect(deploys.map((a) => (a.kind === "deployCard" ? a.cardInstanceId : ""))).toEqual([gundamId]);
    expect(deploys.some((a) => a.kind === "deployCard" && a.cardInstanceId === aerialId)).toBe(false);
  });

  it("Main Phase: Pilot da mão gera 1 deployCard por Unit amiga livre", () => {
    const state = mainPhaseGame();
    state.players.A.hand = [];
    giveResources(state, "A", 4);
    const unitFree = place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const unitPaired = place(state, "A", ST01_CARD_DEFS.GUNCANNON, "battleArea", { pairedPilotId: "x" });
    const amuroId = place(state, "A", ST01_CARD_DEFS.AMURO_RAY, "hand"); // Lv4/custo1

    const pilotDeploys = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter(
      (a) => a.kind === "deployCard" && a.cardInstanceId === amuroId,
    );
    expect(pilotDeploys).toHaveLength(1);
    expect(pilotDeploys[0].kind === "deployCard" && pilotDeploys[0].pairWithUnitId).toBe(unitFree);
    expect(pilotDeploys.some((a) => a.kind === "deployCard" && a.pairWithUnitId === unitPaired)).toBe(false);
  });

  it("Main Phase: Unit active estabelecida pode declarar ataque; rested não", () => {
    const state = mainPhaseGame();
    giveResources(state, "A", 4);
    const active = place(state, "A", ST01_CARD_DEFS.GUNDAM, "battleArea");
    const rested = place(state, "A", ST01_CARD_DEFS.GUNCANNON, "battleArea", { rested: true });
    place(state, "B", ST01_CARD_DEFS.GM, "battleArea", { rested: true }); // alvo rested

    const attacks = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "declareAttack");
    expect(attacks.some((a) => a.kind === "declareAttack" && a.attackerId === active && a.target === "player")).toBe(true);
    expect(attacks.some((a) => a.kind === "declareAttack" && a.attackerId === rested)).toBe(false);
  });

  it("Main Phase: 【Activate·Main】 de White Base entra na lista", () => {
    const state = mainPhaseGame();
    giveResources(state, "A", 4);
    const wbId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "baseSection");
    const actions = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS);
    expect(actions.some((a) => a.kind === "activateAbility" && a.sourceInstanceId === wbId)).toBe(true);
  });

  it("Block Step: skipBlock sempre; activateBlocker só pra Unit com <Blocker> active", () => {
    const state = mainPhaseGame();
    giveResources(state, "A", 6);
    const attackerId = place(state, "A", ST01_CARD_DEFS.GUNDAM, "battleArea");
    const blockerId = place(state, "B", ST01_CARD_DEFS.DEMI_TRAINER, "battleArea"); // <Blocker>
    place(state, "B", ST01_CARD_DEFS.GM, "battleArea"); // sem <Blocker>

    let combatState = declareAttack(state, attackerId, "player");
    combatState = proceedToBlockStep(combatState);
    expect(actionOwner(combatState)).toBe("B");

    const actions = enumerateLegalActions(combatState, "B", ALL_EFFECT_SPECS, OPTS);
    expect(actions.some((a) => a.kind === "skipBlock")).toBe(true);
    const blocks = actions.filter((a) => a.kind === "activateBlocker");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind === "activateBlocker" && blocks[0].blockerId).toBe(blockerId);
  });

  it("pendingDecision mulligan: só resolveMulligan (keep true/false)", () => {
    const state = createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 1, firstPlayer: "A", interactiveMulligan: true });
    expect(state.pendingDecision.A).toEqual({ kind: "mulligan" });
    const actions = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS);
    expect(actions).toEqual([
      { kind: "resolveMulligan", keep: true },
      { kind: "resolveMulligan", keep: false },
    ]);
    expect(enumerateLegalActions(state, "B", ALL_EFFECT_SPECS, OPTS)).toEqual([]);
  });

  it("modo validate:false devolve candidatos crus sem aplicar", () => {
    const state = mainPhaseGame();
    const raw = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, { ...OPTS, validate: false });
    expect(raw.some((a) => a.kind === "finishTurn")).toBe(true);
  });
});

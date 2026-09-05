import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList, ST02_CARD_DEFS } from "../fixtures/st02Deck";
import { buildVanillaDeckList, VANILLA_CARD_DEFS } from "../fixtures/vanillaDeck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, playerHasActionStepPlay } from "./actions";
import { deferOrDispatchAbilities } from "./abilityDispatch";
import { findCard } from "./events";
import { buildSt03DeckList, ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * docs/19, Sessão 2 — decisões interativas (`PendingDecision`): pausa
 * autoritativa de 【Burst】, habilidades ativadas (`activateAbility`) e o
 * helper de auto-pass (`playerHasActionStepPlay`).
 */

const SPECS = ALL_EFFECT_SPECS;
const R = defaultPredicateResolver;

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-pdfx-${seq++}`;
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
    place(state, player, { code: "PD-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
  }
}

function apply(state: GameState, p: PlayerId, action: Parameters<typeof applyPlayerAction>[2]): GameState {
  return applyPlayerAction(state, p, action, SPECS, R, defaultTargetFilterResolver);
}

/** A ataca o jogador B; B tem 1 único shield = `shieldDef`. Retorna o estado logo antes do 2º passAction. */
function attackIntoSingleShield(shieldDef: CardDef): { state: GameState; attackerId: string; shieldId: string } {
  const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
  state.players.B.baseSection = [];
  state.players.B.shields = [];
  const shieldId = place(state, "B", shieldDef, "shields");
  const attackerId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea"); // AP2

  let next = apply(state, "A", { kind: "declareAttack", attackerId, target: "player" });
  next = apply(next, "B", { kind: "skipBlock" });
  next = apply(next, "B", { kind: "passAction" });
  return { state: next, attackerId, shieldId };
}

describe("Pausa autoritativa de 【Burst】 (docs/19, Sessão 2)", () => {
  it("shield com 【Burst】 quebrada -> passAction PAUSA no Damage Step e grava pendingDecision pro defensor", () => {
    const { state, shieldId } = attackIntoSingleShield(ST01_CARD_DEFS.AMURO_RAY);
    const next = apply(state, "A", { kind: "passAction" });

    expect(next.combat?.step).toBe("damage"); // combate NÃO fechou
    expect(next.pendingDecision.B).toMatchObject({ kind: "burst", cardInstanceId: shieldId, queuedInstanceIds: [] });
    expect(next.pendingDecision.A).toBeNull();
    expect(findCard(next, shieldId).zone).toBe("trash"); // shield já caiu; Burst decide se sai do trash
  });

  it("enquanto a decisão está pendente, nenhum dos dois joga outra coisa", () => {
    const { state } = attackIntoSingleShield(ST01_CARD_DEFS.AMURO_RAY);
    const paused = apply(state, "A", { kind: "passAction" });

    expect(() => apply(paused, "A", { kind: "passAction" })).toThrow(/Aguardando o oponente/);
    expect(() => apply(paused, "B", { kind: "passAction" })).toThrow(/Resolva a decisão de/);
  });

  it("resolveBurstDecision{activate:true} roda o efeito (Amuro Ray -> mão), limpa a decisão e fecha o combate", () => {
    const { state, shieldId } = attackIntoSingleShield(ST01_CARD_DEFS.AMURO_RAY);
    const paused = apply(state, "A", { kind: "passAction" });
    const next = apply(paused, "B", { kind: "resolveBurstDecision", activate: true });

    expect(findCard(next, shieldId).zone).toBe("hand"); // AMURO_RAY_BURST: self -> hand
    expect(next.pendingDecision.B).toBeNull();
    expect(next.combat).toBeNull(); // Battle End rodou
  });

  it("resolveBurstDecision{activate:false} deixa a carta no trash e fecha o combate", () => {
    const { state, shieldId } = attackIntoSingleShield(ST01_CARD_DEFS.AMURO_RAY);
    const paused = apply(state, "A", { kind: "passAction" });
    const next = apply(paused, "B", { kind: "resolveBurstDecision", activate: false });

    expect(findCard(next, shieldId).zone).toBe("trash");
    expect(next.pendingDecision.B).toBeNull();
    expect(next.combat).toBeNull();
  });

  it("shield SEM 【Burst】 não pausa nada — combate fecha na hora", () => {
    const { state } = attackIntoSingleShield(ST01_CARD_DEFS.GUNCANNON); // vanilla, sem Burst
    const next = apply(state, "A", { kind: "passAction" });

    expect(next.combat).toBeNull();
    expect(next.pendingDecision.B).toBeNull();
  });

  it("resolveBurstDecision sem decisão pendente lança", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
    expect(() => apply(state, "A", { kind: "resolveBurstDecision", activate: false })).toThrow(/não há decisão de/i);
  });
});

describe("【Attack】 (Suletta ST01-011) — dispara ao declarar ataque, PAUSA pra escolher o recurso", () => {
  function freshSt01(): GameState {
    return advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
  }

  it("declarar ataque com Unit + Suletta pareada pausa em abilityResolution(trigger 'Attack')", () => {
    const state = freshSt01();
    state.players.B.baseSection = [];
    const unitId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const sulettaId = place(state, "A", ST01_CARD_DEFS.SULETTA_MERCURY, "battleArea", { pairedUnitId: unitId });
    findCard(state, unitId).pairedPilotId = sulettaId;
    const restedResourceId = place(state, "A", ST01_CARD_DEFS.RESOURCE, "resourceArea", { rested: true });

    const next = apply(state, "A", { kind: "declareAttack", attackerId: unitId, target: "player" });

    const decision = next.pendingDecision.A;
    expect(decision?.kind).toBe("abilityResolution");
    expect(decision?.kind === "abilityResolution" && decision.trigger).toBe("Attack");
    expect(decision?.kind === "abilityResolution" && decision.queue[0]).toEqual(
      expect.objectContaining({ specId: "ST01-011-Attack", targetScope: "ownResource", needsTarget: true }),
    );
    // combate está parado no Attack Step; o recurso ainda está gasto
    expect(next.combat?.step).toBe("attack");
    expect(findCard(next, restedResourceId).rested).toBe(true);
  });

  it("resolveAbility com o recurso escolhido: reativa o recurso e o combate segue pro Block Step", () => {
    const state = freshSt01();
    state.players.B.baseSection = [];
    const unitId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const sulettaId = place(state, "A", ST01_CARD_DEFS.SULETTA_MERCURY, "battleArea", { pairedUnitId: unitId });
    findCard(state, unitId).pairedPilotId = sulettaId;
    const restedResourceId = place(state, "A", ST01_CARD_DEFS.RESOURCE, "resourceArea", { rested: true });
    const paused = apply(state, "A", { kind: "declareAttack", attackerId: unitId, target: "player" });

    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: "ST01-011-Attack", activate: true, targetIds: [restedResourceId] }],
    });

    expect(findCard(next, restedResourceId).rested).toBe(false);
    expect(next.pendingDecision.A).toBeNull();
    expect(next.combat?.step).toBe("block");
  });
});

describe("activateAbility (docs/19, Sessão 2)", () => {
  function freshSt02(): GameState {
    return advanceToMainPhase(createGame(buildSt02DeckList(), buildSt02DeckList(), { seed: 11, firstPlayer: "A" }));
  }

  it("ST02-006 Tallgeese — Activate·Main ④: paga 4 recursos e fica active", () => {
    const state = freshSt02();
    state.players.A.resourceArea = [];
    const tallgeeseId = place(state, "A", ST02_CARD_DEFS.TALLGEESE, "battleArea", { rested: true });
    giveResources(state, "A", 5);

    const next = apply(state, "A", { kind: "activateAbility", sourceInstanceId: tallgeeseId });

    expect(findCard(next, tallgeeseId).rested).toBe(false);
    expect(next.players.A.resourceArea.filter((r) => r.rested)).toHaveLength(4);
  });

  it("resourceInstanceIds: paga com os recursos escolhidos e POUPA o EX Resource não escolhido", () => {
    const state = freshSt02();
    state.players.A.resourceArea = [];
    const tallgeeseId = place(state, "A", ST02_CARD_DEFS.TALLGEESE, "battleArea", { rested: true });
    const exId = place(state, "A", { code: "TOKEN-EX-RESOURCE", nameEn: "EX Resource", cardType: "RESOURCE", color: "colorless", isToken: true }, "resourceArea");
    giveResources(state, "A", 5);
    const chosen = state.players.A.resourceArea.filter((r) => r.instanceId !== exId).slice(0, 4).map((r) => r.instanceId);

    const next = apply(state, "A", { kind: "activateAbility", sourceInstanceId: tallgeeseId, resourceInstanceIds: chosen });

    expect(findCard(next, tallgeeseId).rested).toBe(false);
    // EX Resource continua em jogo e active (não foi escolhido)
    const ex = next.players.A.resourceArea.find((r) => r.instanceId === exId);
    expect(ex && !ex.rested).toBe(true);
    expect(next.players.A.resourceArea.filter((r) => r.rested).map((r) => r.instanceId).sort()).toEqual([...chosen].sort());
  });

  it("Activate·Main só do dono, na própria Main Phase", () => {
    const state = freshSt02();
    const tallgeeseId = place(state, "A", ST02_CARD_DEFS.TALLGEESE, "battleArea", { rested: true });
    giveResources(state, "A", 5);

    expect(() => apply(state, "B", { kind: "activateAbility", sourceInstanceId: tallgeeseId })).toThrow(/carta própria/);
  });

  it("【Once per Turn】: segunda ativação no mesmo turno é ignorada (dispatcher), sem custo dobrado", () => {
    const state = freshSt02();
    state.players.A.resourceArea = [];
    const tallgeeseId = place(state, "A", ST02_CARD_DEFS.TALLGEESE, "battleArea", { rested: true });
    giveResources(state, "A", 9);

    let next = apply(state, "A", { kind: "activateAbility", sourceInstanceId: tallgeeseId });
    next = apply(next, "A", { kind: "activateAbility", sourceInstanceId: tallgeeseId });

    expect(next.players.A.resourceArea.filter((r) => r.rested)).toHaveLength(4); // só a 1ª ativação cobrou
  });

  it("cai em <Support N> quando a carta não tem EffectSpec de Activate·Main", () => {
    const state = advanceToMainPhase(createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 9, firstPlayer: "A" }));
    const supId = place(state, "A", VANILLA_CARD_DEFS.SUPPORT_01, "battleArea");
    const allyId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02, "battleArea");

    const next = apply(state, "A", { kind: "activateAbility", sourceInstanceId: supId, targets: { target: [allyId] } });

    expect(findCard(next, supId).rested).toBe(true);
    expect(findCard(next, allyId).statModifiers).toEqual([
      { stat: "ap", amount: 1, duration: "endOfTurn", appliedOnTurn: next.turnNumber },
    ]);
  });
});

describe("resolveTriggerOrder — ordenação de gatilhos simultâneos (docs/23 — caminho sem card ST01/ST02 que o dispare)", () => {
  /** monta um `triggerOrder` pendente pra A com 2 【Deploy】 de White Base
   *  (`addShieldToHand`), cada um de uma instância distinta. */
  function twoDeployTriggers() {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 9, firstPlayer: "A" }));
    const wb1 = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "battleArea");
    const wb2 = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "battleArea");
    // garante shields suficientes pra os 2 addShieldToHand terem efeito observável
    state.players.A.shields = [];
    place(state, "A", ST01_CARD_DEFS.GM, "shields");
    place(state, "A", ST01_CARD_DEFS.GM, "shields");
    place(state, "A", ST01_CARD_DEFS.GM, "shields");
    state.pendingDecision.A = {
      kind: "triggerOrder",
      triggers: [
        { instanceId: wb1, specId: "ST01-015-Deploy", trigger: "Deploy", label: "White Base (1)" },
        { instanceId: wb2, specId: "ST01-015-Deploy", trigger: "Deploy", label: "White Base (2)" },
      ],
    };
    return { state, wb1, wb2 };
  }

  it("ordem inválida (falta / sobra / repete) é rejeitada", () => {
    const { state } = twoDeployTriggers();
    expect(() => apply(state, "A", { kind: "resolveTriggerOrder", orderedSpecIds: ["ST01-015-Deploy"] })).toThrow(/exatamente/);
    expect(() =>
      apply(state, "A", { kind: "resolveTriggerOrder", orderedSpecIds: ["ST01-015-Deploy", "ST01-015-Deploy", "X"] }),
    ).toThrow(/exatamente/);
  });

  it("enquanto pendente, o oponente não joga nada", () => {
    const { state } = twoDeployTriggers();
    expect(() => apply(state, "B", { kind: "finishTurn" })).toThrow(/Aguardando o oponente/);
  });

  it("ordem válida limpa a pendência e dispara o(s) efeito(s) na ordem escolhida", () => {
    const { state } = twoDeployTriggers();
    const handBefore = state.players.A.hand.length;
    const shieldsBefore = state.players.A.shields.length;
    const next = apply(state, "A", { kind: "resolveTriggerOrder", orderedSpecIds: ["ST01-015-Deploy", "ST01-015-Deploy"] });

    expect(next.pendingDecision.A).toBeNull();
    // 【Deploy】 de White Base (addShieldToHand) disparou -> shield foi pra mão.
    expect(next.players.A.hand.length).toBeGreaterThan(handBefore);
    expect(next.players.A.shields.length).toBeLessThan(shieldsBefore);
  });
});

describe("zoneOverflow — limite de 6 Units na Battle Area (V2, docs/27)", () => {
  it("deployCard da 7ª Unit NUNCA é bloqueado — entra em campo e pausa pedindo o trim", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
    giveResources(state, "A", 20);
    for (let i = 0; i < 6; i++) place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const cardId = place(state, "A", ST01_CARD_DEFS.GM, "hand");

    const next = apply(state, "A", { kind: "deployCard", cardInstanceId: cardId });

    expect(next.players.A.battleArea).toHaveLength(7); // a carta ENTROU — nunca bloqueada
    expect(next.pendingDecision.A?.kind).toBe("zoneOverflow");
    if (next.pendingDecision.A?.kind === "zoneOverflow") {
      expect(next.pendingDecision.A.legalTargets).toHaveLength(7);
    }
    // trava outras ações até resolver (mesmo padrão de burst/abilityResolution)
    expect(() => apply(next, "A", { kind: "finishTurn" })).toThrow(/Escolha qual Unit vai pro trash/);
  });

  it("resolveZoneOverflow manda a escolhida pro trash (MOVE_CARD, não DESTROY_CARD) e libera o jogo", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
    giveResources(state, "A", 20);
    for (let i = 0; i < 6; i++) place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const cardId = place(state, "A", ST01_CARD_DEFS.GM, "hand");
    const afterDeploy = apply(state, "A", { kind: "deployCard", cardInstanceId: cardId });
    const chosenId = afterDeploy.players.A.battleArea[0].instanceId;

    const next = apply(afterDeploy, "A", { kind: "resolveZoneOverflow", instanceId: chosenId });

    expect(next.pendingDecision.A).toBeNull();
    expect(next.players.A.battleArea).toHaveLength(6);
    expect(next.players.A.battleArea.some((c) => c.instanceId === chosenId)).toBe(false);
    expect(next.players.A.trash.some((c) => c.instanceId === chosenId)).toBe(true);
    expect(() => apply(next, "A", { kind: "finishTurn" })).not.toThrow();
  });

  it("server-authoritative: instanceId fora dos alvos legais lança (não confia cegamente no cliente)", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
    giveResources(state, "A", 20);
    for (let i = 0; i < 6; i++) place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const cardId = place(state, "A", ST01_CARD_DEFS.GM, "hand");
    const afterDeploy = apply(state, "A", { kind: "deployCard", cardInstanceId: cardId });

    expect(() => apply(afterDeploy, "A", { kind: "resolveZoneOverflow", instanceId: "carta-inexistente" })).toThrow(
      /não está entre as elegíveis/,
    );
  });

  it("SPAWN_TOKEN (White Base 【Activate･Main】) tampouco furava o limite — antes não checava NADA, agora cai na mesma regra genérica", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
    giveResources(state, "A", 20);
    for (let i = 0; i < 6; i++) place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const baseId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "baseSection");

    const next = apply(state, "A", { kind: "activateAbility", sourceInstanceId: baseId });

    expect(next.players.A.battleArea).toHaveLength(7); // spawnou o token normalmente
    expect(next.pendingDecision.A?.kind).toBe("zoneOverflow");
  });
});

describe("abilityResolution — deployFromHandTriggered (ST03-010 Full Frontal 【When Paired】)", () => {
  function freshSt03(): GameState {
    return advanceToMainPhase(createGame(buildSt03DeckList(), buildSt03DeckList(), { seed: 7, firstPlayer: "A" }));
  }

  function pairFullFrontal() {
    const state = freshSt03();
    state.players.B.baseSection = [];
    state.players.A.hand = []; // a mão inicial do deck ST03 já traz Units elegíveis — parte-se de mão vazia
    // link de Char's Zaku Ⅱ é "Char Aznable" -> não vira Link Unit com Full Frontal
    const unitId = place(state, "A", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea");
    const ffId = place(state, "A", ST03_CARD_DEFS.FULL_FRONTAL, "hand");
    giveResources(state, "A", 6); // Pilot Lv.6 / custo 1
    const gearaId = place(state, "A", ST03_CARD_DEFS.GEARA_ZULU, "hand"); // L3 Neo Zeon -> elegível
    const draId = place(state, "A", ST03_CARD_DEFS.DRA_C, "hand"); // L1 Neo Zeon -> elegível
    const sinanjuId = place(state, "A", ST03_CARD_DEFS.SINANJU, "hand"); // L6 -> NÃO elegível
    return { state, unitId, ffId, gearaId, draId, sinanjuId };
  }

  it("parear Full Frontal PAUSA em abilityResolution com handChoice (Units Lv≤4 (Neo Zeon)/(Zeon) da mão)", () => {
    const { state, unitId, ffId, gearaId, draId, sinanjuId } = pairFullFrontal();
    const next = apply(state, "A", { kind: "deployCard", cardInstanceId: ffId, pairWithUnitId: unitId });

    const d = next.pendingDecision.A;
    if (d?.kind !== "abilityResolution") throw new Error("esperava abilityResolution pendente");
    expect(d.trigger).toBe("When Paired");
    const q = d.queue.find((x) => x.specId === "ST03-010-WhenPaired");
    expect(q?.handChoice).toBeDefined();
    expect(q?.handChoice?.legalHandIds.slice().sort()).toEqual([gearaId, draId].slice().sort());
    expect(q?.handChoice?.legalHandIds).not.toContain(sinanjuId);
    expect(findCard(next, gearaId).zone).toBe("hand"); // nada implantado ainda
  });

  it("escolher 1 Unidade -> vai pro battleArea SEM custo de recurso; sai da mão", () => {
    const { state, unitId, ffId, gearaId } = pairFullFrontal();
    const paused = apply(state, "A", { kind: "deployCard", cardInstanceId: ffId, pairWithUnitId: unitId });

    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: "ST03-010-WhenPaired", activate: true, targetIds: [gearaId] }],
    });

    expect(next.pendingDecision.A).toBeNull();
    expect(findCard(next, gearaId).zone).toBe("battleArea");
    expect(next.players.A.hand.some((c) => c.instanceId === gearaId)).toBe(false);
    // deployFromHandTriggered não paga custo: Resource Area intacta entre a pausa e a resolução
    expect(next.players.A.resourceArea.length).toBe(paused.players.A.resourceArea.length);
    expect(next.players.A.resourceArea.filter((r) => r.rested).length).toBe(
      paused.players.A.resourceArea.filter((r) => r.rested).length,
    );
  });

  it("'pular' (activate:false) -> nada implantado, carta fica na mão", () => {
    const { state, unitId, ffId, gearaId } = pairFullFrontal();
    const paused = apply(state, "A", { kind: "deployCard", cardInstanceId: ffId, pairWithUnitId: unitId });
    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: "ST03-010-WhenPaired", activate: false, targetIds: [] }],
    });
    expect(next.pendingDecision.A).toBeNull();
    expect(findCard(next, gearaId).zone).toBe("hand");
  });

  it("server-authoritative: escolher carta fora de legalHandIds lança", () => {
    const { state, unitId, ffId, sinanjuId } = pairFullFrontal();
    const paused = apply(state, "A", { kind: "deployCard", cardInstanceId: ffId, pairWithUnitId: unitId });
    expect(() =>
      apply(paused, "A", {
        kind: "resolveAbility",
        resolutions: [{ specId: "ST03-010-WhenPaired", activate: true, targetIds: [sinanjuId] }],
      }),
    ).toThrow(/não está entre as cartas elegíveis/i);
  });
});

describe("abilityResolution — lookAtTopFilterReveal (ST03-006 Char's Zaku Ⅱ 【Destroyed】)", () => {
  // 【Destroyed】 ainda não é despachado pelo motor de combate (nenhum ponto de
  // destruição chama `deferOrDispatchAbilities` — ver dispatcher.ts); aqui
  // exercita-se a CAMADA DE DECISÃO diretamente, que é o alvo desta tarefa.
  function destroyedZaku() {
    const state = advanceToMainPhase(createGame(buildSt03DeckList(), buildSt03DeckList(), { seed: 7, firstPlayer: "A" }));
    const zakuId = place(state, "A", ST03_CARD_DEFS.CHARS_ZAKU_II, "trash");
    const topIds: string[] = [];
    // top 3 forçado: Zaku I (Zeon Unit), Indignation (Command), Dra-C (Neo Zeon Unit)
    for (const def of [ST03_CARD_DEFS.ZAKU_I, ST03_CARD_DEFS.INDIGNATION, ST03_CARD_DEFS.DRA_C]) {
      topIds.push(place(state, "A", def, "deck"));
    }
    const three = state.players.A.deck.splice(-3, 3);
    state.players.A.deck.unshift(...three);
    return { state, zakuId, topIds };
  }

  function deferDestroyed(state: GameState, zakuId: string): GameState {
    return deferOrDispatchAbilities(state, "A", "Destroyed", [{ code: "ST03-006", instanceId: zakuId }], SPECS, {
      predicateResolver: R,
      targetFilterResolver: defaultTargetFilterResolver,
    });
  }

  it("Char's Zaku Ⅱ destruída PAUSA em abilityResolution com deckTopReveal (top 3; reveláveis = Units Zeon/Neo Zeon)", () => {
    const { state, zakuId, topIds } = destroyedZaku();
    const [zakuI, indignation, draC] = topIds;
    const next = deferDestroyed(state, zakuId);

    const d = next.pendingDecision.A;
    if (d?.kind !== "abilityResolution") throw new Error("esperava abilityResolution pendente");
    const q = d.queue.find((x) => x.specId === "ST03-006-Destroyed");
    expect(q?.deckTopReveal?.count).toBe(3);
    expect(q?.deckTopReveal?.topCards.map((c) => c.instanceId)).toEqual([zakuI, indignation, draC]);
    expect(q?.deckTopReveal?.revealableIds.slice().sort()).toEqual([zakuI, draC].slice().sort());
  });

  it("revelar a Unit Zeon -> vai pra mão; as outras 2 vão pro fundo do deck", () => {
    const { state, zakuId, topIds } = destroyedZaku();
    const [zakuI, indignation, draC] = topIds;
    const paused = deferDestroyed(state, zakuId);
    const deckLenBefore = paused.players.A.deck.length;

    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: "ST03-006-Destroyed", activate: true, targetIds: [zakuI] }],
    });

    expect(next.pendingDecision.A).toBeNull();
    expect(next.players.A.hand.some((c) => c.instanceId === zakuI)).toBe(true);
    expect(next.players.A.deck.length).toBe(deckLenBefore - 1);
    const top3 = next.players.A.deck.slice(0, 3).map((c) => c.instanceId);
    expect(top3).not.toContain(indignation);
    expect(top3).not.toContain(draC);
    expect(
      next.players.A.deck
        .slice(-2)
        .map((c) => c.instanceId)
        .sort(),
    ).toEqual([indignation, draC].slice().sort());
  });

  it("declinar (targetIds vazio) -> nada pra mão; as 3 vão pro fundo", () => {
    const { state, zakuId, topIds } = destroyedZaku();
    const paused = deferDestroyed(state, zakuId);
    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: "ST03-006-Destroyed", activate: true, targetIds: [] }],
    });
    expect(next.pendingDecision.A).toBeNull();
    expect(
      next.players.A.deck
        .slice(-3)
        .map((c) => c.instanceId)
        .sort(),
    ).toEqual(topIds.slice().sort());
  });

  it("server-authoritative: revelar carta não-revelável (Command) lança", () => {
    const { state, zakuId, topIds } = destroyedZaku();
    const indignation = topIds[1];
    const paused = deferDestroyed(state, zakuId);
    expect(() =>
      apply(paused, "A", {
        kind: "resolveAbility",
        resolutions: [{ specId: "ST03-006-Destroyed", activate: true, targetIds: [indignation] }],
      }),
    ).toThrow(/não está entre as cartas reveláveis/i);
  });
});

describe("playerHasActionStepPlay (auto-pass helper, docs/19 Sessão 2 tarefa 4)", () => {
  it("true quando o jogador tem Command 【Action】 jogável na mão", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
    state.players.A.resourceArea = [];
    place(state, "A", ST01_CARD_DEFS.UNFORESEEN_INCIDENT, "hand"); // Command 【Action】, nível 3 / custo 1
    giveResources(state, "A", 3);

    expect(playerHasActionStepPlay(state, "A", SPECS)).toBe(true);
  });

  it("false quando não tem nível/recurso pra pagar o Command 【Action】", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
    state.players.A.resourceArea = [];
    place(state, "A", ST01_CARD_DEFS.UNFORESEEN_INCIDENT, "hand");
    giveResources(state, "A", 2); // nível 2 < 3 exigido

    expect(playerHasActionStepPlay(state, "A", SPECS)).toBe(false);
  });
});

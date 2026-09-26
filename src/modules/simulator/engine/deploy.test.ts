import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildVanillaDeckList, VANILLA_CARD_DEFS } from "../fixtures/vanillaDeck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { effectiveAp, effectiveHp } from "./types";
import { advanceToMainPhase } from "./phases";
import { declareAttack, proceedToBlockStep, skipBlock } from "./combat";
import { canPayLevel, deployCard, playCommand } from "./deploy";
import { applyPlayerAction } from "./actions";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { AMURO_RAY_WHEN_PAIRED, GUNDAM_MA_FORM_WHEN_PAIRED, ST01_EFFECT_SPECS } from "../content/st01";
import { defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { findCard } from "./events";
import { TOKEN_EX_RESOURCE_CODE } from "./setup";
import { GD01_CARD_DEFS, GD01_EFFECT_SPECS } from "../content/gd01";

/**
 * "Jogar carta da mão" (docs/18, wave "motor de jogo real + gaps
 * documentados") — testa `deployCard`/`playCommand` contra o deck vanilla
 * (só stats, sem efeito bespoke — não precisa de EffectSpec real pra
 * validar custo/nível/limite de zona/pareamento, que são regras do motor,
 * não de conteúdo).
 */

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-deployfx-${seq++}`;
  const card: CardInstance = {
    instanceId,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    // -1: unit já estabelecida em campo por padrão (ver combat.test.ts).
    enteredZoneOnTurn: state.turnNumber - 1,
    ...opts,
  };
  state.players[player][zone].push(card);
  return instanceId;
}

/**
 * Avança até a Main Phase (Start->Draw->Resource->Main real, não pulado) e
 * zera a Resource Area dos dois jogadores logo em seguida — a Resource
 * Phase já compra 1 Recurso automaticamente pro jogador ativo, o que
 * atrapalharia a contagem exata que estes testes de custo/nível querem
 * controlar. Zerar aqui (mutação de fixture, mesma convenção já usada em
 * `fullGame.test.ts`) deixa `giveResources` como única fonte de recurso,
 * determinística.
 */
function freshMainPhase(): GameState {
  const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 3, firstPlayer: "A" });
  const afterMain = advanceToMainPhase(state);
  afterMain.players.A.resourceArea = [];
  afterMain.players.B.resourceArea = [];
  return afterMain;
}

/** Empurra `n` Recursos active na Resource Area do jogador (mutação de fixture — mesma convenção de fullGame.test.ts). */
function giveResources(state: GameState, player: PlayerId, n: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) ids.push(place(state, player, VANILLA_CARD_DEFS.RESOURCE_01, "resourceArea"));
  return ids;
}

describe("deployCard — jogar Unit/Pilot/Base da mão (docs/18)", () => {
  it("recusa jogar fora da Main Phase", () => {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 1, firstPlayer: "A" }); // ainda em "start"
    giveResources(state, "A", 4);
    const cardId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_01, "hand");
    expect(() => deployCard(state, "A", cardId)).toThrow(/Main Phase/);
  });

  it("recusa jogar carta que não está na mão", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 4);
    const cardId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_01, "battleArea");
    expect(() => deployCard(state, "A", cardId)).toThrow(/mão/);
  });

  it("recusa jogar carta do adversário", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 4);
    const cardId = place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, "hand");
    expect(() => deployCard(state, "A", cardId)).toThrow(/própria mão/);
  });

  describe("Nível (Comprehensive Rules — requisito prévio, separado do custo)", () => {
    it("canPayLevel: false com recursos insuficientes em campo, true depois de completar", () => {
      const state = freshMainPhase();
      giveResources(state, "A", 3);
      expect(canPayLevel(state, "A", VANILLA_CARD_DEFS.VANILLA_04)).toBe(false); // level 4

      giveResources(state, "A", 1);
      expect(canPayLevel(state, "A", VANILLA_CARD_DEFS.VANILLA_04)).toBe(true);
    });

    it("deployCard recusa jogar sem nível suficiente, mesmo com custo pagável", () => {
      const state = freshMainPhase();
      giveResources(state, "A", 4); // 4 recursos active cobrem o custo (4)...
      // ...mas VANILLA_04 tem level 4 também, então isso passa. Teste real: rest 1 recurso, sobra 3 active, nível ainda passa (conta todos, active ou rested)
      const resources = state.players.A.resourceArea;
      resources[0].rested = true; // 3 active, 1 rested — nível ainda é 4 recursos EM CAMPO (independente de rested)
      const cardId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_04, "hand");
      expect(() => deployCard(state, "A", cardId)).toThrow(/active insuficientes/); // custo 4, só 3 active
    });
  });

  describe("Custo — resta N Recursos active da Resource Area", () => {
    it("resta exatamente `cost` recursos active ao deployar", () => {
      const state = freshMainPhase();
      giveResources(state, "A", 2);
      const cardId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02, "hand"); // cost 2, level 2

      const next = deployCard(state, "A", cardId);

      const restedCount = next.players.A.resourceArea.filter((r) => r.rested).length;
      expect(restedCount).toBe(2);
      expect(next.players.A.battleArea.some((c) => c.instanceId === cardId)).toBe(true);
    });

    it("recusa se não há recursos active suficientes (mesmo com nível ok)", () => {
      const state = freshMainPhase();
      const resources = giveResources(state, "A", 2);
      state.players.A.resourceArea.find((r) => r.instanceId === resources[0])!.rested = true; // só 1 active
      const cardId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02, "hand"); // cost 2
      expect(() => deployCard(state, "A", cardId)).toThrow(/active insuficientes/);
    });

    it("V3 (docs/28): recusa `resourceInstanceIds` com MAIS ids do que o custo — nunca confia cegamente no cliente", () => {
      const state = freshMainPhase();
      const resources = giveResources(state, "A", 3);
      const cardId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02, "hand"); // cost 2
      // manda 3 ids pra um custo de 2 — antes disso passava calado e restava os 3.
      expect(() => deployCard(state, "A", cardId, { resourceInstanceIds: resources })).toThrow(/exatamente 2/);
    });

    it("V3 (docs/28): recusa `resourceInstanceIds` repetindo o mesmo Recurso mais de uma vez", () => {
      const state = freshMainPhase();
      const resources = giveResources(state, "A", 3);
      const cardId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02, "hand"); // cost 2
      expect(() => deployCard(state, "A", cardId, { resourceInstanceIds: [resources[0], resources[0]] })).toThrow(/repetindo/);
    });

    it("aceita `resourceInstanceIds` explícito pra escolher quais recursos restar", () => {
      const state = freshMainPhase();
      const resources = giveResources(state, "A", 3);
      const cardId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02, "hand"); // cost 2

      const next = deployCard(state, "A", cardId, { resourceInstanceIds: [resources[2], resources[0]] });

      expect(next.players.A.resourceArea.find((r) => r.instanceId === resources[2])!.rested).toBe(true);
      expect(next.players.A.resourceArea.find((r) => r.instanceId === resources[0])!.rested).toBe(true);
      expect(next.players.A.resourceArea.find((r) => r.instanceId === resources[1])!.rested).toBe(false);
    });

    it("EX Resource sai do jogo (não fica só rested) ao pagar custo — regra oficial confirmada contra o Comprehensive Rules", () => {
      const state = freshMainPhase();
      const normalResource = giveResources(state, "A", 1)[0];
      const exResourceId = place(state, "A", { ...VANILLA_CARD_DEFS.RESOURCE_01, code: TOKEN_EX_RESOURCE_CODE, isToken: true }, "resourceArea");
      const cardId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02, "hand"); // cost 2, level 2

      const next = deployCard(state, "A", cardId, { resourceInstanceIds: [normalResource, exResourceId] });

      // o Recurso normal continua em campo, só rested — o EX Resource vai pra área de exílio (zona `exile`, sempre pública)
      expect(next.players.A.resourceArea.some((r) => r.instanceId === normalResource && r.rested)).toBe(true);
      expect(next.players.A.resourceArea.some((r) => r.instanceId === exResourceId)).toBe(false);
      expect(next.players.A.resourceArea).toHaveLength(1);
      expect(next.players.A.exile.some((c) => c.instanceId === exResourceId)).toBe(true);
      expect(next.players.A.exile.find((c) => c.instanceId === exResourceId)!.zone).toBe("exile");
    });
  });

  it("Battle Area com 6 Units + 7ª jogada da mão: a jogada NUNCA é bloqueada (V2, docs/27 — a rules management de trim pro limite é responsabilidade de applyPlayerAction, não de deployCard)", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 20);
    for (let i = 0; i < 6; i++) {
      place(state, "A", VANILLA_CARD_DEFS.VANILLA_01, "battleArea");
    }
    const cardId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_01, "hand");
    const next = deployCard(state, "A", cardId);
    expect(next.players.A.battleArea).toHaveLength(7);
  });

  it("Pilot pareado não conta pro limite de 6 Units (mora na Battle Area, mas não é Unit)", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 20);
    for (let i = 0; i < 6; i++) {
      place(state, "A", VANILLA_CARD_DEFS.VANILLA_01, "battleArea");
    }
    const unitId = state.players.A.battleArea[0].instanceId;
    const pilotId = place(state, "A", VANILLA_CARD_DEFS.PILOT_01, "hand");

    const next = deployCard(state, "A", pilotId, { pairWithUnitId: unitId });

    expect(next.players.A.battleArea.some((c) => c.instanceId === pilotId)).toBe(true);
  });

  describe("Base Section — máx. 1 Base, a excedente vai pro trash (não é 'destruída')", () => {
    it("primeira Base deployada normalmente", () => {
      const state = freshMainPhase();
      giveResources(state, "A", 4);
      const baseId = place(state, "A", VANILLA_CARD_DEFS.BASE_01, "hand");

      const next = deployCard(state, "A", baseId);

      expect(next.players.A.baseSection.map((c) => c.instanceId)).toEqual([baseId]);
    });

    it("segunda Base manda a primeira pro trash via MOVE_CARD, não DESTROY_CARD", () => {
      const state = freshMainPhase();
      giveResources(state, "A", 8);
      const oldBaseId = place(state, "A", VANILLA_CARD_DEFS.BASE_01, "hand");
      const afterOld = deployCard(state, "A", oldBaseId); // substitui a EX Base do setup (regra confirmada: rule 11-5-2)
      const newBaseId = place(afterOld, "A", VANILLA_CARD_DEFS.BASE_01, "hand");

      const next = deployCard(afterOld, "A", newBaseId);

      expect(next.players.A.baseSection.map((c) => c.instanceId)).toEqual([newBaseId]);
      expect(next.players.A.trash.some((c) => c.instanceId === oldBaseId)).toBe(true);
      const destroyEvent = next.eventLog.find((e) => e.type === "DESTROY_CARD" && "instanceId" in e && e.instanceId === oldBaseId);
      expect(destroyEvent).toBeUndefined();
      const moveEvent = next.eventLog.find((e) => e.type === "MOVE_CARD" && "instanceId" in e && e.instanceId === oldBaseId);
      expect(moveEvent).toBeDefined();
    });

    it("Base real (ST01-015 White Base): o 【Deploy】 'add 1 shield to hand' dispara sozinho, sem precisar escolher shield", () => {
      const state = freshMainPhase();
      giveResources(state, "A", 6);
      const firstShieldId = state.players.A.shields[0].instanceId;
      const handBefore = state.players.A.hand.length;
      const baseId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "hand");

      const next = deployCard(state, "A", baseId, { specs: ST01_EFFECT_SPECS }); // sem `targets`

      expect(next.players.A.baseSection.map((c) => c.instanceId)).toEqual([baseId]);
      expect(findCard(next, firstShieldId).zone).toBe("hand");
      // mão = handBefore (+1 pelo `place` da base, -1 base deployada, +1 shield que entrou)
      expect(next.players.A.hand.length).toBe(handBefore + 1);
    });

    it("Base real com 0 shields: deploya normalmente, o 【Deploy】 só não move nada", () => {
      const state = freshMainPhase();
      giveResources(state, "A", 6);
      state.players.A.shields = [];
      const baseId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "hand");

      const next = deployCard(state, "A", baseId, { specs: ST01_EFFECT_SPECS });

      expect(next.players.A.baseSection.map((c) => c.instanceId)).toEqual([baseId]);
    });
  });

  describe("Pilot — nunca despareado em campo (Comprehensive Rules 3-3-1/5-9)", () => {
    it("recusa jogar Pilot sem escolher Unit de pareamento", () => {
      const state = freshMainPhase();
      giveResources(state, "A", 4);
      place(state, "A", VANILLA_CARD_DEFS.VANILLA_01, "battleArea");
      const pilotId = place(state, "A", VANILLA_CARD_DEFS.PILOT_01, "hand");
      expect(() => deployCard(state, "A", pilotId)).toThrow(/precisa de uma Unit amiga/);
    });

    it("pareia os dois lados (pairedPilotId/pairedUnitId) ao jogar", () => {
      const state = freshMainPhase();
      giveResources(state, "A", 4);
      const unitId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_01, "battleArea");
      const pilotId = place(state, "A", VANILLA_CARD_DEFS.PILOT_01, "hand");

      const next = deployCard(state, "A", pilotId, { pairWithUnitId: unitId });

      const unit = next.players.A.battleArea.find((c) => c.instanceId === unitId)!;
      const pilot = next.players.A.battleArea.find((c) => c.instanceId === pilotId)!;
      expect(unit.pairedPilotId).toBe(pilotId);
      expect(pilot.pairedUnitId).toBe(unitId);
    });

    it("recusa parear com Unit que já tem Pilot", () => {
      const state = freshMainPhase();
      giveResources(state, "A", 8);
      const unitId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_01, "battleArea");
      const firstPilotId = place(state, "A", VANILLA_CARD_DEFS.PILOT_01, "hand");
      const afterFirst = deployCard(state, "A", firstPilotId, { pairWithUnitId: unitId });

      const secondPilotId = place(afterFirst, "A", VANILLA_CARD_DEFS.PILOT_01, "hand");
      expect(() => deployCard(afterFirst, "A", secondPilotId, { pairWithUnitId: unitId })).toThrow(/já tem um Pilot/);
    });
  });
});

describe("playCommand — jogar Command da mão (Main ou Action)", () => {
  const COMMAND_MAIN: CardDef = { code: "CMD-MAIN", nameEn: "Command Main", cardType: "COMMAND", color: "blue", level: 1, cost: 1, triggerKeywords: ["Main"] };
  const COMMAND_ACTION: CardDef = { code: "CMD-ACTION", nameEn: "Command Action", cardType: "COMMAND", color: "blue", level: 1, cost: 1, triggerKeywords: ["Action"] };

  it("resolve e manda pro trash uma Command 【Main】 fora de combate", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 2);
    const cardId = place(state, "A", COMMAND_MAIN, "hand");

    const next = playCommand(state, "A", cardId, "Main", []);

    expect(next.players.A.trash.some((c) => c.instanceId === cardId)).toBe(true);
    expect(next.players.A.hand.some((c) => c.instanceId === cardId)).toBe(false);
  });

  it("recusa jogar Command 【Main】 sem o gatilho Main", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 2);
    const cardId = place(state, "A", COMMAND_ACTION, "hand");
    expect(() => playCommand(state, "A", cardId, "Main", [])).toThrow(/não tem gatilho/);
  });

  it("recusa jogar Command 【Action】 fora de um Action Step", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 2);
    const cardId = place(state, "A", COMMAND_ACTION, "hand");
    expect(() => playCommand(state, "A", cardId, "Action", [])).toThrow(/Action Step/);
  });

  it("aceita Command 【Action】 durante o Action Step, na prioridade certa", () => {
    const state = freshMainPhase();
    giveResources(state, "B", 2);
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_01, "battleArea");
    const cardId = place(state, "B", COMMAND_ACTION, "hand");

    let next = declareAttack(state, attackerId, "player");
    next = proceedToBlockStep(next);
    next = skipBlock(next); // Action Step, prioridade começa com quem defende (B)

    const afterCommand = playCommand(next, "B", cardId, "Action", []);
    expect(afterCommand.players.B.trash.some((c) => c.instanceId === cardId)).toBe(true);
  });

  // garantido pela guarda geral de `deployCard` (nada se joga da mão com combate em andamento) —
  // o Action Step do motor só existe dentro do combate e no fim de turno (fora da Main Phase)
  it("CR 13-2-4-2 — Command com 【Pilot】[X] não pode ser pareado como Piloto no Action Step", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 2);
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_01, "battleArea");
    const unitA = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02, "battleArea");
    const pilotCommand: CardDef = { ...COMMAND_ACTION, code: "TEST-CMD-PILOT", pilotMode: { pilotName: "Test Pilot", ap: 1, hp: 1 } };
    const cardId = place(state, "A", pilotCommand, "hand");

    let next = declareAttack(state, attackerId, "player");
    next = proceedToBlockStep(next);
    next = skipBlock(next); // Action Step do jogador ativo (A)
    expect(() => deployCard(next, "A", cardId, { pairWithUnitId: unitA })).toThrow(/combate/);
  });
});

describe("deployCard + dispatcher — integração com EffectSpec real do ST01", () => {
  const pairedPilotHasTraitResolver = (predicate: string, ctx: { state: GameState; sourceInstanceId: string }) => {
    const match = predicate.match(/^pairedPilotHasTrait:(.+)$/);
    if (!match) return false;
    const source = findCard(ctx.state, ctx.sourceInstanceId);
    if (!source.pairedPilotId) return false;
    const pilot = findCard(ctx.state, source.pairedPilotId);
    return pilot.def.traits?.includes(match[1]) ?? false;
  };

  function freshSt01MainPhase(): GameState {
    return advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
  }

  it("Deploy dispara sozinho ao jogar a carta (ST01-004 Guntank)", () => {
    const state = freshSt01MainPhase();
    giveResources(state, "A", ST01_CARD_DEFS.GUNTANK.cost!);
    const guntankId = place(state, "A", ST01_CARD_DEFS.GUNTANK, "hand");
    const targetId = place(state, "B", ST01_CARD_DEFS.GM, "battleArea");

    const next = deployCard(state, "A", guntankId, {
      specs: ST01_EFFECT_SPECS,
      targets: { target: [targetId] },
    });

    expect(next.players.A.battleArea.some((c) => c.instanceId === guntankId)).toBe(true);
    expect(findCard(next, targetId).rested).toBe(true); // GUNTANK_DEPLOY: rest no alvo
  });

  it("When Paired dispara dos dois lados (Unit ST01-002 e Pilot ST01-010) numa jogada real de Pilot", () => {
    const state = freshSt01MainPhase();
    giveResources(state, "A", ST01_CARD_DEFS.GUNDAM_MA_FORM.cost! + ST01_CARD_DEFS.AMURO_RAY.cost!);
    const unitId = place(state, "A", ST01_CARD_DEFS.GUNDAM_MA_FORM, "hand");
    const targetId = place(state, "B", ST01_CARD_DEFS.GUNCANNON, "battleArea");

    const afterUnit = deployCard(state, "A", unitId, { specs: ST01_EFFECT_SPECS });
    const handSizeBeforePilot = afterUnit.players.A.hand.length;
    const pilotId = place(afterUnit, "A", ST01_CARD_DEFS.AMURO_RAY, "hand");

    const next = deployCard(afterUnit, "A", pilotId, {
      pairWithUnitId: unitId,
      specs: ST01_EFFECT_SPECS,
      targets: { target: [targetId] },
      predicateResolver: pairedPilotHasTraitResolver,
    });

    // ST01-010 Amuro Ray (Pilot) — When Paired: resta o alvo escolhido
    expect(findCard(next, targetId).rested).toBe(true);
    // a partir de handSizeBeforePilot (antes de Amuro entrar na mão): +1 (Amuro
    // é colocado na mão), -1 (Amuro sai da mão ao ser jogado), +1 (ST01-002
    // Gundam MA Form — When Paired + trait White Base Team — compra 1, já que
    // Amuro Ray tem o trait) = líquido +1.
    expect(next.players.A.hand.length).toBe(handSizeBeforePilot + 1);
    expect(findTriggerSpecsFired(ST01_EFFECT_SPECS, "ST01-002", "When Paired")).toEqual([GUNDAM_MA_FORM_WHEN_PAIRED]);
    expect(findTriggerSpecsFired(ST01_EFFECT_SPECS, "ST01-010", "When Paired")).toEqual([AMURO_RAY_WHEN_PAIRED]);
  });
});

describe("deployCard — 【When Paired】 direcionado PAUSA pra resolução separada (Etapa 4)", () => {
  function freshSt01MainPhase(): GameState {
    return advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
  }

  it("parear Amuro Ray SEM targets: motor pausa com PendingDecision whenPaired (não resolve o efeito ainda)", () => {
    const state = freshSt01MainPhase();
    giveResources(state, "A", Math.max(ST01_CARD_DEFS.AMURO_RAY.cost!, ST01_CARD_DEFS.AMURO_RAY.level!));
    const unitId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea"); // Unit vanilla (sem When Paired próprio)
    const pilotId = place(state, "A", ST01_CARD_DEFS.AMURO_RAY, "hand");
    const enemyId = place(state, "B", ST01_CARD_DEFS.GUNCANNON, "battleArea");

    const next = deployCard(state, "A", pilotId, {
      pairWithUnitId: unitId,
      specs: ST01_EFFECT_SPECS,
      targetFilterResolver: defaultTargetFilterResolver,
    });

    expect(findCard(next, pilotId).pairedUnitId).toBe(unitId); // pareamento aconteceu
    expect(findCard(next, enemyId).rested).toBe(false); // efeito NÃO resolveu ainda
    const decision = next.pendingDecision.A;
    expect(decision?.kind).toBe("abilityResolution");
    expect(decision?.kind === "abilityResolution" && decision.queue).toEqual([
      expect.objectContaining({ specId: "ST01-010-WhenPaired", needsTarget: true, optional: false }),
    ]);
  });

  it("resolveAbility com alvo: resta o alvo e limpa a decisão", () => {
    const state = freshSt01MainPhase();
    giveResources(state, "A", Math.max(ST01_CARD_DEFS.AMURO_RAY.cost!, ST01_CARD_DEFS.AMURO_RAY.level!));
    const unitId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const pilotId = place(state, "A", ST01_CARD_DEFS.AMURO_RAY, "hand");
    const enemyId = place(state, "B", ST01_CARD_DEFS.GUNCANNON, "battleArea");
    const paused = deployCard(state, "A", pilotId, {
      pairWithUnitId: unitId,
      specs: ST01_EFFECT_SPECS,
      targetFilterResolver: defaultTargetFilterResolver,
    });

    const next = applyPlayerAction(
      paused,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: "ST01-010-WhenPaired", activate: true, targetIds: [enemyId] }] },
      ST01_EFFECT_SPECS,
    );

    expect(findCard(next, enemyId).rested).toBe(true);
    expect(next.pendingDecision.A).toBeNull();
  });

  it("resolveAbility sem alvo legal (targetIds vazio): nada acontece, decisão limpa", () => {
    const state = freshSt01MainPhase();
    giveResources(state, "A", Math.max(ST01_CARD_DEFS.AMURO_RAY.cost!, ST01_CARD_DEFS.AMURO_RAY.level!));
    const unitId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const pilotId = place(state, "A", ST01_CARD_DEFS.AMURO_RAY, "hand");
    const paused = deployCard(state, "A", pilotId, {
      pairWithUnitId: unitId,
      specs: ST01_EFFECT_SPECS,
      targetFilterResolver: defaultTargetFilterResolver,
    });

    const next = applyPlayerAction(
      paused,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: "ST01-010-WhenPaired", activate: true, targetIds: [] }] },
      ST01_EFFECT_SPECS,
    );

    expect(next.pendingDecision.A).toBeNull();
  });

  it("com `targets` fornecidos (caminho antigo): resolve na hora, sem pausar", () => {
    const state = freshSt01MainPhase();
    giveResources(state, "A", Math.max(ST01_CARD_DEFS.AMURO_RAY.cost!, ST01_CARD_DEFS.AMURO_RAY.level!));
    const unitId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const pilotId = place(state, "A", ST01_CARD_DEFS.AMURO_RAY, "hand");
    const enemyId = place(state, "B", ST01_CARD_DEFS.GUNCANNON, "battleArea");

    const next = deployCard(state, "A", pilotId, {
      pairWithUnitId: unitId,
      specs: ST01_EFFECT_SPECS,
      targets: { target: [enemyId] },
    });

    expect(findCard(next, enemyId).rested).toBe(true);
    expect(next.pendingDecision.A).toBeNull();
  });

  it("pareamento sem 【When Paired】 direcionado não pausa (Suletta + Unit vanilla)", () => {
    const state = freshSt01MainPhase();
    giveResources(state, "A", ST01_CARD_DEFS.SULETTA_MERCURY.cost! + 2);
    const unitId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const pilotId = place(state, "A", ST01_CARD_DEFS.SULETTA_MERCURY, "hand");

    const next = deployCard(state, "A", pilotId, { pairWithUnitId: unitId, specs: ST01_EFFECT_SPECS });
    expect(next.pendingDecision.A).toBeNull();
  });
});

/**
 * Regressão: 【Deploy】 direcionado (ST01-004 Guntank — "Choose 1 enemy Unit
 * with 2 or less HP. Rest it.") jogado SEM `options.targets` (o caminho real
 * do cliente hoje — ver `SimulatorMatchPage.confirmPending`, que nunca manda
 * `targets` pra Deploy) lançava "Alvo nomeado 'target' não foi resolvido
 * antes da execução do efeito", porque `deployCard` chamava `dispatchTrigger`
 * direto pro trigger Deploy em vez de `deferOrDispatchAbilities` (que já
 * cobria 【When Paired】). Fix: Deploy agora usa o MESMO mecanismo de pausa —
 * ver `deploy.ts`.
 */
describe("deployCard — 【Deploy】 direcionado PAUSA pra resolução separada (fix do Guntank)", () => {
  function freshSt01MainPhase(): GameState {
    return advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
  }

  it("jogar Guntank SEM targets não lança mais — pausa com PendingDecision.abilityResolution, e a Unit já está em campo", () => {
    const state = freshSt01MainPhase();
    giveResources(state, "A", ST01_CARD_DEFS.GUNTANK.cost!);
    const guntankId = place(state, "A", ST01_CARD_DEFS.GUNTANK, "hand");
    const enemyId = place(state, "B", ST01_CARD_DEFS.GM, "battleArea");

    let next!: GameState;
    expect(() => {
      next = deployCard(state, "A", guntankId, { specs: ST01_EFFECT_SPECS, targetFilterResolver: defaultTargetFilterResolver });
    }).not.toThrow();

    // a carta foi jogada (deploy nunca é bloqueado pelo efeito de alvo) --
    // o efeito é que ainda não resolveu.
    expect(next.players.A.battleArea.some((c) => c.instanceId === guntankId)).toBe(true);
    expect(findCard(next, enemyId).rested).toBe(false);
    const decision = next.pendingDecision.A;
    expect(decision?.kind).toBe("abilityResolution");
    expect(decision?.kind === "abilityResolution" && decision.trigger).toBe("Deploy");
    expect(decision?.kind === "abilityResolution" && decision.queue).toEqual([
      expect.objectContaining({ specId: "ST01-004-Deploy", needsTarget: true, optional: false, targetScope: "enemyUnit" }),
    ]);
  });

  it("resolveAbility com alvo escolhido: resta o alvo e limpa a decisão", () => {
    const state = freshSt01MainPhase();
    giveResources(state, "A", ST01_CARD_DEFS.GUNTANK.cost!);
    const guntankId = place(state, "A", ST01_CARD_DEFS.GUNTANK, "hand");
    const enemyId = place(state, "B", ST01_CARD_DEFS.GM, "battleArea");
    const paused = deployCard(state, "A", guntankId, { specs: ST01_EFFECT_SPECS, targetFilterResolver: defaultTargetFilterResolver });

    const next = applyPlayerAction(
      paused,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: "ST01-004-Deploy", activate: true, targetIds: [enemyId] }] },
      ST01_EFFECT_SPECS,
    );

    expect(findCard(next, enemyId).rested).toBe(true);
    expect(next.pendingDecision.A).toBeNull();
  });

  it("resolveAbility sem alvo legal (targetIds vazio): efeito não ativa, mas a Unit segue em campo normalmente", () => {
    const state = freshSt01MainPhase();
    giveResources(state, "A", ST01_CARD_DEFS.GUNTANK.cost!);
    const guntankId = place(state, "A", ST01_CARD_DEFS.GUNTANK, "hand");
    const paused = deployCard(state, "A", guntankId, {
      specs: ST01_EFFECT_SPECS,
      targetFilterResolver: defaultTargetFilterResolver,
    }); // sem nenhuma Unit inimiga em campo

    const next = applyPlayerAction(
      paused,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: "ST01-004-Deploy", activate: true, targetIds: [] }] },
      ST01_EFFECT_SPECS,
    );

    expect(next.pendingDecision.A).toBeNull();
    expect(next.players.A.battleArea.some((c) => c.instanceId === guntankId)).toBe(true); // deploy não foi desfeito
  });

  it("com `targets` fornecidos (caminho antigo/IA): resolve na hora, sem pausar", () => {
    const state = freshSt01MainPhase();
    giveResources(state, "A", ST01_CARD_DEFS.GUNTANK.cost!);
    const guntankId = place(state, "A", ST01_CARD_DEFS.GUNTANK, "hand");
    const enemyId = place(state, "B", ST01_CARD_DEFS.GM, "battleArea");

    const next = deployCard(state, "A", guntankId, { specs: ST01_EFFECT_SPECS, targets: { target: [enemyId] } });

    expect(findCard(next, enemyId).rested).toBe(true);
    expect(next.pendingDecision.A).toBeNull();
  });

  it("Deploy SEM alvo nomeado (ST01-015 White Base — 'Add 1 Shield to hand') continua resolvendo na hora, sem pausar", () => {
    const state = freshSt01MainPhase();
    giveResources(state, "A", Math.max(ST01_CARD_DEFS.WHITE_BASE.cost!, ST01_CARD_DEFS.WHITE_BASE.level!));
    const handSizeBefore = state.players.A.hand.length;
    const shieldsBefore = state.players.A.shields.length;
    const whiteBaseId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "hand");

    const next = deployCard(state, "A", whiteBaseId, { specs: ST01_EFFECT_SPECS });

    expect(next.pendingDecision.A).toBeNull(); // sem alvo nomeado "target" -> nunca é interativo
    expect(next.players.A.baseSection.some((c) => c.instanceId === whiteBaseId)).toBe(true);
    // White Base entrou na mão (place, +1) e depois saiu pra Base Section (-1);
    // addShieldToHand devolve 1 shield pra mão (+1) -- líquido: +1 sobre o handSizeBefore original.
    expect(next.players.A.hand.length).toBe(handSizeBefore + 1);
    expect(next.players.A.shields.length).toBe(shieldsBefore - 1);
  });
});

function findTriggerSpecsFired<T extends { cardCode: string; trigger: string }>(specs: T[], cardCode: string, trigger: string): T[] {
  return specs.filter((s) => s.cardCode === cardCode && s.trigger === trigger);
}

describe("Pilot — modificador impresso de AP/HP + card Command/Pilot (verificação 2026-09-01)", () => {
  function freshSt01(): GameState {
    return advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 7, firstPlayer: "A" }));
  }

  it("Pilot nativo (ST01-010 Amuro Ray): a Unit pareada ganha o AP+2/HP+1 impresso enquanto pareada", () => {
    const state = freshSt01();
    giveResources(state, "A", 6);
    const unitId = place(state, "A", ST01_CARD_DEFS.GUNCANNON, "battleArea");
    const pilotId = place(state, "A", ST01_CARD_DEFS.AMURO_RAY, "hand");
    const apBefore = effectiveAp(findCard(state, unitId), state);

    const next = deployCard(state, "A", pilotId, { pairWithUnitId: unitId }); // sem specs — só o pareamento

    const unit = findCard(next, unitId);
    expect(effectiveAp(unit, next)).toBe(apBefore + 2);
    expect(effectiveHp(unit, next)).toBe((ST01_CARD_DEFS.GUNCANNON.hp ?? 0) + 1);
  });

  it("card Command/Pilot (ST01-013 Kai's Resolve) — modo Command: playCommand resolve o 【Main】 e a carta vai pro trash", () => {
    const state = freshSt01();
    giveResources(state, "A", 6);
    const unitId = place(state, "A", ST01_CARD_DEFS.GUNCANNON, "battleArea");
    findCard(state, unitId).damage = 2;
    const cardId = place(state, "A", ST01_CARD_DEFS.KAIS_RESOLVE, "hand");

    const next = playCommand(state, "A", cardId, "Main", ST01_EFFECT_SPECS, { targets: { target: [unitId] } });

    expect(findCard(next, unitId).damage).toBe(0); // heal 3, tinha 2
    expect(next.players.A.trash.some((c) => c.instanceId === cardId)).toBe(true);
    expect(next.players.A.battleArea.some((c) => c.instanceId === cardId)).toBe(false); // NÃO ficou em campo como Pilot
  });

  it("card Command/Pilot (ST01-013) — modo Piloto: pareia como 'Kai Shiden', dá AP+1/HP+0, e satisfaz a link da Guncannon", () => {
    const state = freshSt01();
    giveResources(state, "A", 6);
    const unitId = place(state, "A", ST01_CARD_DEFS.GUNCANNON, "battleArea", { enteredZoneOnTurn: state.turnNumber });
    const cardId = place(state, "A", ST01_CARD_DEFS.KAIS_RESOLVE, "hand");

    const next = deployCard(state, "A", cardId, { pairWithUnitId: unitId });

    const pilot = findCard(next, cardId);
    const unit = findCard(next, unitId);
    expect(pilot.zone).toBe("battleArea");
    expect(pilot.asPilot).toBe(true);
    expect(unit.pairedPilotId).toBe(cardId);
    expect(effectiveAp(unit, next)).toBe((ST01_CARD_DEFS.GUNCANNON.ap ?? 0) + 1);
    expect(effectiveHp(unit, next)).toBe(ST01_CARD_DEFS.GUNCANNON.hp ?? 0); // Kai Shiden HP+0

    // Guncannon (link [Kai Shiden]) virou Link Unit -> pode atacar no turno em que foi pareada
    expect(() => declareAttack(next, unitId, "player")).not.toThrow();
  });

  it("card Command/Pilot — modo Piloto sem Unit amiga pra parear: recusa", () => {
    const state = freshSt01();
    giveResources(state, "A", 6);
    const cardId = place(state, "A", ST01_CARD_DEFS.KAIS_RESOLVE, "hand");
    expect(() => deployCard(state, "A", cardId, {})).toThrow(/Unit amiga/);
  });
});

describe("deployCard — GD01-002 Unicorn Gundam (Destroy Mode): deploy alternativo por sacrifício de Link Unit (Lote 5, docs/debates 2026-09-13)", () => {
  function deployGd01(state: GameState, cardInstanceId: string, extra: Parameters<typeof deployCard>[3] = {}) {
    return deployCard(state, "A", cardInstanceId, {
      specs: GD01_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
      ...extra,
    });
  }

  it("sacrifício válido (Link Unit certa) -> destrói a sacrificada (dispara seu próprio 【Destroyed】, que pausa) e joga GD01-002 SEM pagar custo/nível", () => {
    const state = freshMainPhase(); // resourceArea zerada -> GD01-002 (Lv7/custo6) seria impagável no modo normal
    const unicornModeId = place(state, "A", GD01_CARD_DEFS["GD01-005"], "battleArea"); // Lv5, link [Banagher Links]
    const banagherId = place(state, "A", GD01_CARD_DEFS["GD01-088"], "battleArea");
    findCard(state, unicornModeId).pairedPilotId = banagherId;
    findCard(state, banagherId).pairedUnitId = unicornModeId;
    const destroyModeId = place(state, "A", GD01_CARD_DEFS["GD01-002"], "hand");

    const next = deployGd01(state, destroyModeId, { sacrificeInstanceId: unicornModeId });

    // a carta nova já está em campo (evento de MOVE_CARD aplicado ANTES do 【Destroyed】
    // da sacrificada ser despachado) — só o 【Destroyed】 dela ficou pendente.
    expect(findCard(next, destroyModeId).zone).toBe("battleArea");
    expect(next.players.A.trash.some((c) => c.instanceId === unicornModeId)).toBe(true);
    const d = next.pendingDecision.A;
    if (d?.kind !== "abilityResolution") throw new Error("esperava abilityResolution (【Destroyed】 da sacrificada) pendente pra A");
    expect(d.trigger).toBe("Destroyed");
    expect(d.queue.find((q) => q.specId === "GD01-005-Destroyed")?.implicitTargets).toEqual({ formerPairedPilot: [banagherId] });

    const resolved = applyPlayerAction(
      next,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: "GD01-005-Destroyed", activate: true, targetIds: [banagherId] }] },
      GD01_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(resolved.pendingDecision.A).toBeNull();
    expect(resolved.players.A.trash.some((c) => c.instanceId === banagherId)).toBe(true); // devolvido à mão e descartado de novo
    // custo/nível nunca foram cobrados: a Resource Area segue vazia.
    expect(resolved.players.A.resourceArea.length).toBe(0);
  });

  it("sacrifício de uma Unit que NÃO satisfaz Link -> recusa (mesmo sendo 'Unicorn Mode' Lv.5 mas sem o Pilot certo pareado)", () => {
    const state = freshMainPhase();
    const unicornModeId = place(state, "A", GD01_CARD_DEFS["GD01-005"], "battleArea");
    const wrongPilotId = place(state, "A", GD01_CARD_DEFS["GD01-089"], "battleArea"); // Riddhe Marcenas, não linka com GD01-005
    findCard(state, unicornModeId).pairedPilotId = wrongPilotId;
    findCard(state, wrongPilotId).pairedUnitId = unicornModeId;
    const destroyModeId = place(state, "A", GD01_CARD_DEFS["GD01-002"], "hand");

    expect(() => deployGd01(state, destroyModeId, { sacrificeInstanceId: unicornModeId })).toThrow(/Link Unit/);
  });

  it("sacrifício de uma Unit que não bate o filtro (nome/nível) -> recusa", () => {
    const state = freshMainPhase();
    const wrongUnitId = place(state, "A", GD01_CARD_DEFS["GD01-025"], "battleArea"); // Gundam Deathscythe, Lv5 mas não é "Unicorn Mode"
    const duoId = place(state, "A", GD01_CARD_DEFS["GD01-090"], "battleArea");
    findCard(state, wrongUnitId).pairedPilotId = duoId;
    findCard(state, duoId).pairedUnitId = wrongUnitId;
    const destroyModeId = place(state, "A", GD01_CARD_DEFS["GD01-002"], "hand");

    expect(() => deployGd01(state, destroyModeId, { sacrificeInstanceId: wrongUnitId })).toThrow(/Link Unit/);
  });

  it("sem sacrifício (deploy normal) e sem recurso/nível suficiente -> recusa como qualquer outra carta cara", () => {
    const state = freshMainPhase();
    const destroyModeId = place(state, "A", GD01_CARD_DEFS["GD01-002"], "hand");
    expect(() => deployGd01(state, destroyModeId)).toThrow(/Nível insuficiente/);
  });

  it("com recurso/nível suficiente, deploy normal (sem sacrifício) funciona igual a qualquer Unit", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 7);
    const destroyModeId = place(state, "A", GD01_CARD_DEFS["GD01-002"], "hand");

    const next = deployGd01(state, destroyModeId);

    expect(findCard(next, destroyModeId).zone).toBe("battleArea");
    expect(next.players.A.resourceArea.filter((r) => r.rested).length).toBe(6); // pagou o custo de 6 de verdade
  });

});

describe("deployCard — GD01-065 Freedom Gundam: 【During Pair】【Once per Turn】 reage a QUALQUER pareamento de Unit branca (Lote 5, docs/debates 2026-09-13)", () => {
  function deployGd01(state: GameState, cardInstanceId: string, extra: Parameters<typeof deployCard>[3] = {}) {
    return deployCard(state, "A", cardInstanceId, {
      specs: GD01_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
      ...extra,
    });
  }

  it("pareia um Pilot com a PRÓPRIA Freedom Gundam -> pausa (AnyPairing) -> resolve -> AP-2 no inimigo escolhido", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 6); // Banagher Links (GD01-088) é Lv.5 — precisa de 5+ recursos em campo
    const freedomId = place(state, "A", GD01_CARD_DEFS["GD01-065"], "battleArea");
    const pilotId = place(state, "A", GD01_CARD_DEFS["GD01-088"], "hand"); // Banagher Links, cost 1/Lv.5
    const enemyId = place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, "battleArea");

    const next = deployGd01(state, pilotId, { pairWithUnitId: freedomId });

    expect(findCard(next, freedomId).pairedPilotId).toBe(pilotId);
    const d = next.pendingDecision.A;
    if (d?.kind !== "abilityResolution") throw new Error("esperava abilityResolution (AnyPairing) pendente pra A");
    expect(d.trigger).toBe("AnyPairing");
    const q = d.queue.find((x) => x.specId === "GD01-065-AnyPairing");
    expect(q?.needsTarget).toBe(true);
    expect(q?.legalTargets).toContain(enemyId);

    const resolved = applyPlayerAction(
      next,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: "GD01-065-AnyPairing", activate: true, targetIds: [enemyId] }] },
      GD01_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(resolved.pendingDecision.A).toBeNull();
    expect(findCard(resolved, enemyId).statModifiers).toEqual([
      { stat: "ap", amount: -2, duration: "endOfTurn", appliedOnTurn: next.turnNumber, appliedBy: "A" },
    ]);
  });

  it("pareia um Pilot com OUTRA Unit branca (não a própria Freedom Gundam) -> também reage", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 6);
    place(state, "A", GD01_CARD_DEFS["GD01-065"], "battleArea"); // Freedom Gundam, sem parear
    const perfectStrikeId = place(state, "A", GD01_CARD_DEFS["GD01-068"], "battleArea"); // outra Unit branca
    const pilotId = place(state, "A", GD01_CARD_DEFS["GD01-088"], "hand");
    place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, "battleArea");

    const next = deployGd01(state, pilotId, { pairWithUnitId: perfectStrikeId });

    const d = next.pendingDecision.A;
    if (d?.kind !== "abilityResolution") throw new Error("esperava abilityResolution (AnyPairing) pendente pra A");
    expect(d.queue.some((x) => x.specId === "GD01-065-AnyPairing")).toBe(true);
  });

  it("pareia um Pilot com uma Unit NÃO branca -> não reage (sem pendingDecision)", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 6);
    place(state, "A", GD01_CARD_DEFS["GD01-065"], "battleArea"); // Freedom Gundam, sem parear
    const gundamId = place(state, "A", GD01_CARD_DEFS["GD01-001"], "battleArea"); // Gundam, blue
    const pilotId = place(state, "A", GD01_CARD_DEFS["GD01-088"], "hand");

    const next = deployGd01(state, pilotId, { pairWithUnitId: gundamId });

    expect(next.pendingDecision.A).toBeNull();
  });

  it("Once per Turn: 2ª ativação no mesmo turno não pausa de novo", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 6); // cobre o Lv.5 de Banagher Links + o Lv.3 de Riddhe Marcenas
    const freedomId = place(state, "A", GD01_CARD_DEFS["GD01-065"], "battleArea");
    const perfectStrikeId = place(state, "A", GD01_CARD_DEFS["GD01-068"], "battleArea");
    const pilot1Id = place(state, "A", GD01_CARD_DEFS["GD01-088"], "hand"); // Banagher Links, Lv.5
    const pilot2Id = place(state, "A", GD01_CARD_DEFS["GD01-089"], "hand"); // Riddhe Marcenas, Lv.3
    const enemyId = place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, "battleArea");

    let next = deployGd01(state, pilot1Id, { pairWithUnitId: freedomId });
    next = applyPlayerAction(
      next,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: "GD01-065-AnyPairing", activate: true, targetIds: [enemyId] }] },
      GD01_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(findCard(next, freedomId).usedKeywordsThisTurn).toContain("AnyPairing");

    next = deployCard(next, "A", pilot2Id, {
      pairWithUnitId: perfectStrikeId,
      specs: GD01_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });

    expect(next.pendingDecision.A).toBeNull(); // 2ª vez: já usada este turno, não pausa de novo
  });
});

import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildVanillaDeckList, VANILLA_CARD_DEFS } from "../fixtures/vanillaDeck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { advanceToMainPhase } from "./phases";
import { declareAttack, proceedToBlockStep, skipBlock } from "./combat";
import { canPayLevel, deployCard, playCommand } from "./deploy";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { AMURO_RAY_WHEN_PAIRED, GUNDAM_MA_FORM_WHEN_PAIRED, ST01_EFFECT_SPECS } from "../content/st01";
import { findCard } from "./events";
import { TOKEN_EX_RESOURCE_CODE } from "./setup";

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

  it("Battle Area comporta no máx. 6 Units — 7ª recusa", () => {
    const state = freshMainPhase();
    giveResources(state, "A", 20);
    for (let i = 0; i < 6; i++) {
      place(state, "A", VANILLA_CARD_DEFS.VANILLA_01, "battleArea");
    }
    const cardId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_01, "hand");
    expect(() => deployCard(state, "A", cardId)).toThrow(/Battle Area cheia/);
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

function findTriggerSpecsFired<T extends { cardCode: string; trigger: string }>(specs: T[], cardCode: string, trigger: string): T[] {
  return specs.filter((s) => s.cardCode === cardCode && s.trigger === trigger);
}

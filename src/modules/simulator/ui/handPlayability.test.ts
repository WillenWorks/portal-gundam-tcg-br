import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { advanceToMainPhase } from "../engine/phases";
import { buildVanillaDeckList, VANILLA_CARD_DEFS } from "../fixtures/vanillaDeck";
import type { CardDef, CardInstance, GameState, PlayerId } from "../engine/types";
import { isPlayableNow, playableModes, type PlayabilityContext } from "./handPlayability";

/** Estado real mínimo (mesma convenção de `deploy.test.ts`) — `computeLegalTargets`
 * (V0, docs/25) lê o `battleArea`/`resourceArea` de verdade, não uma contagem. */
function freshState(): GameState {
  return advanceToMainPhase(createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 3, firstPlayer: "A" }));
}

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, rested = false): CardInstance {
  const card: CardInstance = {
    instanceId: `${player}-hp-fx-${seq++}`,
    def,
    owner: player,
    zone: "battleArea",
    rested,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber - 1,
  };
  state.players[player].battleArea.push(card);
  return card;
}

const CTX: PlayabilityContext = {
  myTurnMain: true,
  inActionStep: false,
  activeResources: 5,
  totalResources: 5,
  hasUnpairedFriendlyUnit: false,
  state: freshState(),
  controller: "A",
};
const ctx = (over: Partial<PlayabilityContext>): PlayabilityContext => ({ ...CTX, ...over });

const def = (over: Partial<CardDef>): CardDef => ({
  code: "X",
  nameEn: "X",
  cardType: "UNIT",
  color: "blue",
  ...over,
});

describe("playableModes — custo / nível", () => {
  it("Unit sem recursos ativos suficientes → injogável", () => {
    const u = def({ cardType: "UNIT", cost: 3, level: 3 });
    expect(playableModes(u, ctx({ activeResources: 2, totalResources: 5 }))).toEqual([]);
  });

  it("Unit sem nível (poucos recursos em campo) → injogável mesmo com AP ativo", () => {
    const u = def({ cardType: "UNIT", cost: 1, level: 4 });
    expect(playableModes(u, ctx({ activeResources: 5, totalResources: 3 }))).toEqual([]);
  });

  it("Unit com custo e nível satisfeitos na Main → deploy", () => {
    const u = def({ cardType: "UNIT", cost: 2, level: 2 });
    expect(playableModes(u, ctx({}))).toEqual(["deploy"]);
  });

  it("Unit fora da Main Phase → injogável", () => {
    const u = def({ cardType: "UNIT", cost: 0, level: 0 });
    expect(playableModes(u, ctx({ myTurnMain: false }))).toEqual([]);
  });
});

describe("playableModes — Base (V6.3, docs/34 — achado real: nunca teve branch aqui)", () => {
  it("Base com custo e nível satisfeitos na Main → deploy (mesmo sem nenhuma Base em campo ainda)", () => {
    const b = def({ cardType: "BASE", cost: 2, level: 2 });
    expect(playableModes(b, ctx({}))).toEqual(["deploy"]);
  });

  it("Base substituindo uma já em campo (EX Base ou normal) continua jogável — motor já trata a troca", () => {
    // handPlayability não sabe (nem precisa saber) se já existe Base em campo —
    // quem decide isso é deployCard() (engine/deploy.ts, já testado); aqui só
    // confirma que a UI não bloqueia a jogada por existir Base nenhuma.
    const b = def({ cardType: "BASE", cost: 1, level: 1 });
    expect(playableModes(b, ctx({ activeResources: 1, totalResources: 1 }))).toEqual(["deploy"]);
  });

  it("Base sem recursos suficientes → injogável", () => {
    const b = def({ cardType: "BASE", cost: 3, level: 3 });
    expect(playableModes(b, ctx({ activeResources: 1, totalResources: 1 }))).toEqual([]);
  });

  it("Base fora da Main Phase → injogável", () => {
    const b = def({ cardType: "BASE", cost: 0, level: 0 });
    expect(playableModes(b, ctx({ myTurnMain: false }))).toEqual([]);
  });
});

describe("playableModes — Pilot / pareamento", () => {
  it("Pilot nativo sem Unit amiga livre → injogável", () => {
    const p = def({ cardType: "PILOT", cost: 1, level: 1 });
    expect(playableModes(p, ctx({ hasUnpairedFriendlyUnit: false }))).toEqual([]);
  });

  it("Pilot nativo com Unit amiga livre → deploy", () => {
    const p = def({ cardType: "PILOT", cost: 1, level: 1 });
    expect(playableModes(p, ctx({ hasUnpairedFriendlyUnit: true }))).toEqual(["deploy"]);
  });
});

describe("playableModes — Command e alvos", () => {
  // ST01-012 Thoroughly Damaged — 【Main】Choose 1 RESTED enemy Unit. Deal 1
  // damage. `targetFilter: "rested"` (V0, docs/25): não basta ter Unit
  // inimiga em campo, ela precisa estar descansada.
  const thoroughlyDamaged = def({
    code: "ST01-012",
    cardType: "COMMAND",
    cost: 0,
    level: 0,
    triggerKeywords: ["Main"],
    pilotMode: { pilotName: "Hayato Kobayashi", hp: 1 },
  });

  it("sem nenhuma Unit inimiga em campo → bloqueada", () => {
    expect(playableModes(thoroughlyDamaged, ctx({ state: freshState() }))).not.toContain("commandMain");
  });

  it("com Unit inimiga em campo mas ATIVA (não descansada) → ainda bloqueada (filtro 'rested')", () => {
    const state = freshState();
    place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, false);
    expect(playableModes(thoroughlyDamaged, ctx({ state, controller: "A" }))).not.toContain("commandMain");
  });

  it("com Unit inimiga DESCANSADA em campo → commandMain liberado", () => {
    const state = freshState();
    place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, true);
    expect(playableModes(thoroughlyDamaged, ctx({ state, controller: "A" }))).toContain("commandMain");
  });

  it("Command 【Action】 só sai num Action Step", () => {
    const c = def({ code: "C-ACT", cardType: "COMMAND", cost: 0, level: 0, triggerKeywords: ["Action"] });
    expect(playableModes(c, ctx({ myTurnMain: true, inActionStep: false }))).toEqual([]);
    expect(playableModes(c, ctx({ myTurnMain: false, inActionStep: true }))).toEqual(["commandAction"]);
  });
});

describe("isPlayableNow", () => {
  it("resume playableModes num booleano", () => {
    const u = def({ cardType: "UNIT", cost: 9, level: 9 });
    expect(isPlayableNow(u, ctx({}))).toBe(false);
    expect(isPlayableNow(def({ cardType: "UNIT", cost: 1, level: 1 }), ctx({}))).toBe(true);
  });
});

describe("playableModes — GD01 dynamicCost e alternateDeploySacrifice", () => {
  it("GD01-016 Jegan (custo 3) é jogável com 2 recursos quando há 2+ Earth Federation em campo", () => {
    const jegan = def({
      code: "GD01-016",
      nameEn: "Jegan",
      cardType: "UNIT",
      cost: 3,
      level: 2,
      dynamicCost: { condition: { kind: "friendlyOtherUnitTraitCountAtLeast", trait: "Earth Federation", n: 2 }, amount: -1 },
    });

    const state = freshState();
    // Sem as 2 units, com 2 recursos -> não pode (precisaria de 3)
    expect(playableModes(jegan, ctx({ state, controller: "A", activeResources: 2, totalResources: 3 }))).toEqual([]);

    // Coloca 2 units Earth Federation amigas
    place(state, "A", def({ traits: ["Earth Federation"] }));
    place(state, "A", def({ traits: ["Earth Federation"] }));

    // Agora com 2 recursos ativos -> pode jogar!
    expect(playableModes(jegan, ctx({ state, controller: "A", activeResources: 2, totalResources: 3 }))).toEqual(["deploy"]);
  });

  it("GD01-002 Unicorn Destroy Mode (custo 5, lv 5) é jogável por sacrifício mesmo com 0 recursos", () => {
    const destroyMode = def({
      code: "GD01-002",
      nameEn: "Unicorn Gundam (Destroy Mode)",
      cardType: "UNIT",
      cost: 5,
      level: 5,
      alternateDeploySacrifice: { nameContains: "Unicorn Mode", level: 5 },
    });

    const state = freshState();
    // Sem sacrifício e com 0 recursos -> não pode
    expect(playableModes(destroyMode, ctx({ state, controller: "A", activeResources: 0, totalResources: 0 }))).toEqual([]);

    // Coloca um Unicorn Mode Lv.5 pareado com Banagher Links
    const pilotDef = def({ code: "GD01-088", nameEn: "Banagher Links", cardType: "PILOT", traits: ["Earth Federation"] });
    const pilot = place(state, "A", pilotDef);

    const unicornModeDef = def({
      code: "GD01-005",
      nameEn: "Unicorn Gundam (Unicorn Mode)",
      cardType: "UNIT",
      level: 5,
      link: { kind: "pilotName", values: ["Banagher Links"] },
    });
    const unicornUnit = place(state, "A", unicornModeDef);
    unicornUnit.pairedPilotId = pilot.instanceId;

    // Agora pode jogar mesmo com 0 recursos e 0 nível!
    expect(playableModes(destroyMode, ctx({ state, controller: "A", activeResources: 0, totalResources: 0 }))).toEqual(["deploy"]);
  });
});


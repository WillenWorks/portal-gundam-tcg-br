import { describe, expect, it } from "vitest";
import type { CardDef, CardInstance, PlayerId } from "../types";
import type { ViewGameState } from "../viewState";
import type { LegalAction } from "../legalActions";
import { chooseAction, heuristicPolicy } from "./heuristicPolicy";

const rng = () => 0.42;

function def(partial: Partial<CardDef> & Pick<CardDef, "code" | "cardType">): CardDef {
  return {
    nameEn: partial.code,
    color: "white",
    ...partial,
  };
}

function card(id: string, owner: PlayerId, cardDef: CardDef, extra: Partial<CardInstance> = {}): CardInstance {
  return {
    instanceId: id,
    def: cardDef,
    owner,
    zone: "battleArea",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
    ...extra,
  };
}

interface Areas {
  battleArea?: CardInstance[];
  baseSection?: CardInstance[];
  hand?: CardInstance[];
  shields?: number;
}

function player(id: PlayerId, areas: Areas) {
  const battleArea = areas.battleArea ?? [];
  const baseSection = areas.baseSection ?? [];
  const hand = areas.hand ?? [];
  return {
    id,
    deck: [],
    resourceDeck: [],
    shields: [],
    resourceArea: [],
    battleArea,
    baseSection,
    trash: [],
    exile: [],
    hand,
    counts: {
      deck: 0,
      resourceDeck: 0,
      shields: areas.shields ?? 6,
      resourceArea: 0,
      battleArea: battleArea.length,
      baseSection: baseSection.length,
      trash: 0,
      exile: 0,
      hand: hand.length,
    },
  };
}

function view(overrides: {
  viewer?: PlayerId;
  turnNumber?: number;
  phase?: ViewGameState["phase"];
  combat?: ViewGameState["combat"];
  A: Areas;
  B: Areas;
}): ViewGameState {
  const viewer = overrides.viewer ?? "A";
  return {
    turnNumber: overrides.turnNumber ?? 3,
    activePlayer: viewer,
    phase: overrides.phase ?? "main",
    combat: overrides.combat ?? null,
    endPhaseAction: null,
    pendingDecision: { A: null, B: null },
    gameOver: null,
    eventLog: [],
    viewer,
    players: {
      A: player("A", overrides.A),
      B: player("B", overrides.B),
    },
  } as unknown as ViewGameState;
}

describe("heuristicPolicy — cenários fixos (nível normal)", () => {
  it("bloqueia aqui: chump-block salva uma Unit muito mais valiosa", () => {
    const bigUnit = card("myBig", "A", def({ code: "BIG", cardType: "UNIT", ap: 4, hp: 5 }));
    const blocker = card(
      "blk",
      "A",
      def({ code: "BLK", cardType: "UNIT", ap: 1, hp: 2, effectKeywords: ["Blocker"] }),
    );
    const attacker = card("atk", "B", def({ code: "ATK", cardType: "UNIT", ap: 5, hp: 3 }));

    const v = view({
      viewer: "A",
      combat: {
        step: "block",
        attackerId: "atk",
        attackingPlayer: "B",
        defendingPlayer: "A",
        originalTarget: { unitId: "myBig" },
        currentTarget: { unitId: "myBig" },
        actionPasses: { A: false, B: false },
        actionPriority: "A",
      } as ViewGameState["combat"],
      A: { battleArea: [bigUnit, blocker] },
      B: { battleArea: [attacker] },
    });

    const legal: LegalAction[] = [{ kind: "skipBlock" }, { kind: "activateBlocker", blockerId: "blk" }];
    expect(chooseAction(v, legal, rng)).toEqual({ kind: "activateBlocker", blockerId: "blk" });
  });

  it("não ataca o jogador quando o único <Blocker> é a margem que segura a Base", () => {
    const attacker = card(
      "mine",
      "A",
      def({ code: "MINE", cardType: "UNIT", ap: 2, hp: 3, effectKeywords: ["Blocker"] }),
    );
    const base = card("base", "A", def({ code: "BASE", cardType: "BASE", hp: 5 }), { zone: "baseSection" });
    const threat = card("t", "B", def({ code: "T", cardType: "UNIT", ap: 6, hp: 5 }));

    const v = view({
      viewer: "A",
      turnNumber: 5,
      A: { battleArea: [attacker], baseSection: [base] },
      B: { battleArea: [threat] },
    });

    const legal: LegalAction[] = [
      { kind: "finishTurn" },
      { kind: "declareAttack", attackerId: "mine", target: "player" },
      { kind: "declareAttack", attackerId: "mine", target: { unitId: "t" } },
    ];
    expect(chooseAction(v, legal, rng)).toEqual({ kind: "finishTurn" });
  });

  it("usa a remoção na maior ameaça", () => {
    const small = card("small", "B", def({ code: "S", cardType: "UNIT", ap: 2, hp: 2 }));
    const big = card("big", "B", def({ code: "B", cardType: "UNIT", ap: 7, hp: 6 }));

    const v = view({
      viewer: "A",
      A: { battleArea: [card("src", "A", def({ code: "SRC", cardType: "UNIT", ap: 2, hp: 2 }))] },
      B: { battleArea: [small, big] },
    });

    const legal: LegalAction[] = [
      { kind: "finishTurn" },
      { kind: "activateAbility", sourceInstanceId: "src", targets: { target: ["small"] } },
      { kind: "activateAbility", sourceInstanceId: "src", targets: { target: ["big"] } },
    ];
    const chosen = chooseAction(v, legal, rng);
    expect(chosen.kind).toBe("activateAbility");
    expect(chosen.kind === "activateAbility" && chosen.targets?.target).toEqual(["big"]);
  });

  it("forma Link quando pode: pareia o Piloto com a Unit cuja link condition ele satisfaz", () => {
    const linkUnit = card(
      "linkUnit",
      "A",
      def({ code: "LU", cardType: "UNIT", ap: 2, hp: 3, link: { kind: "pilotName", values: ["Amuro Ray"] } }),
    );
    const plainUnit = card("plainUnit", "A", def({ code: "PU", cardType: "UNIT", ap: 2, hp: 3 }));
    const pilot = card("pilot", "A", def({ code: "P", cardType: "PILOT", nameEn: "Amuro Ray", ap: 1, hp: 1 }), {
      zone: "hand",
    });

    const v = view({
      viewer: "A",
      A: { battleArea: [linkUnit, plainUnit], hand: [pilot] },
      B: {},
    });

    const legal: LegalAction[] = [
      { kind: "finishTurn" },
      { kind: "deployCard", cardInstanceId: "pilot", pairWithUnitId: "plainUnit" },
      { kind: "deployCard", cardInstanceId: "pilot", pairWithUnitId: "linkUnit" },
    ];
    const chosen = chooseAction(v, legal, rng);
    expect(chosen).toEqual({ kind: "deployCard", cardInstanceId: "pilot", pairWithUnitId: "linkUnit" });
  });

  it("prefere deployar a Unit de maior AP+HP efetivo", () => {
    const smallU = card("h1", "A", def({ code: "SU", cardType: "UNIT", ap: 1, hp: 2 }), { zone: "hand" });
    const bigU = card("h2", "A", def({ code: "BU", cardType: "UNIT", ap: 4, hp: 4 }), { zone: "hand" });

    const v = view({ viewer: "A", A: { hand: [smallU, bigU] }, B: {} });
    const legal: LegalAction[] = [
      { kind: "finishTurn" },
      { kind: "deployCard", cardInstanceId: "h1" },
      { kind: "deployCard", cardInstanceId: "h2" },
    ];
    expect(chooseAction(v, legal, rng)).toEqual({ kind: "deployCard", cardInstanceId: "h2" });
  });
});

describe("heuristicPolicy — nível facil", () => {
  const facil = heuristicPolicy({ level: "facil" });

  it("nunca bloqueia — sempre skipBlock", () => {
    const v = view({
      viewer: "A",
      combat: {
        step: "block",
        attackerId: "atk",
        attackingPlayer: "B",
        defendingPlayer: "A",
        originalTarget: { unitId: "myBig" },
        currentTarget: { unitId: "myBig" },
        actionPasses: { A: false, B: false },
        actionPriority: "A",
      } as ViewGameState["combat"],
      A: {
        battleArea: [
          card("myBig", "A", def({ code: "BIG", cardType: "UNIT", ap: 4, hp: 5 })),
          card("blk", "A", def({ code: "BLK", cardType: "UNIT", ap: 1, hp: 2, effectKeywords: ["Blocker"] })),
        ],
      },
      B: { battleArea: [card("atk", "B", def({ code: "ATK", cardType: "UNIT", ap: 5, hp: 3 }))] },
    });
    const legal: LegalAction[] = [{ kind: "skipBlock" }, { kind: "activateBlocker", blockerId: "blk" }];
    expect(facil(v, legal, rng)).toEqual({ kind: "skipBlock" });
  });

  it("ataca só o jogador, nunca troca com Unit", () => {
    const v = view({
      viewer: "A",
      A: { battleArea: [card("mine", "A", def({ code: "M", cardType: "UNIT", ap: 3, hp: 3 }))] },
      B: { battleArea: [card("weak", "B", def({ code: "W", cardType: "UNIT", ap: 1, hp: 1 }))] },
    });
    const legal: LegalAction[] = [
      { kind: "finishTurn" },
      { kind: "declareAttack", attackerId: "mine", target: "player" },
      { kind: "declareAttack", attackerId: "mine", target: { unitId: "weak" } },
    ];
    expect(facil(v, legal, rng)).toEqual({ kind: "declareAttack", attackerId: "mine", target: "player" });
  });
});

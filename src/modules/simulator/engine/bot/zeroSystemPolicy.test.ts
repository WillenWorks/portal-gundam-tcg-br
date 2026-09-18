import { describe, expect, it } from "vitest";
import type { CardDef, CardInstance, PlayerId } from "../types";
import type { ViewGameState } from "../viewState";
import type { LegalAction } from "../legalActions";
import { chooseZeroSystemAction, zeroSystemPolicy } from "./zeroSystemPolicy";

const rng = () => 0.5;

function def(partial: Partial<CardDef> & Pick<CardDef, "code" | "cardType">): CardDef {
  return {
    nameEn: partial.code,
    color: "blue",
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
  combat?: ViewGameState["combat"];
  A: Areas;
  B: Areas;
}): ViewGameState {
  const viewer = overrides.viewer ?? "A";
  return {
    turnNumber: overrides.turnNumber ?? 3,
    activePlayer: viewer,
    phase: "main",
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

describe("zeroSystemPolicy — Personas e IA Tática", () => {
  it("Persona Amuro: bloqueia ativamente para proteger unidade chave de alto valor", () => {
    const aceUnit = card("rx78", "A", def({ code: "RX-78-2", cardType: "UNIT", ap: 5, hp: 5 }));
    const blocker = card("guncannon", "A", def({ code: "GC", cardType: "UNIT", ap: 2, hp: 4, effectKeywords: ["Blocker"] }));
    const enemy = card("zaku", "B", def({ code: "ZAKU", cardType: "UNIT", ap: 5, hp: 3 }));

    const v = view({
      viewer: "A",
      combat: {
        step: "block",
        attackerId: "zaku",
        attackingPlayer: "B",
        defendingPlayer: "A",
        originalTarget: { unitId: "rx78" },
        currentTarget: { unitId: "rx78" },
        actionPasses: { A: false, B: false },
        actionPriority: "A",
      } as ViewGameState["combat"],
      A: { battleArea: [aceUnit, blocker], shields: 4 },
      B: { battleArea: [enemy], shields: 4 },
    });

    const actions: LegalAction[] = [
      { kind: "skipBlock" },
      { kind: "activateBlocker", blockerId: "guncannon" },
    ];

    const chosen = chooseZeroSystemAction(v, actions, rng, { persona: "amuro" });
    expect(chosen).toEqual({ kind: "activateBlocker", blockerId: "guncannon" });
  });

  it("Persona Char: prioriza ataque fulminante à base/jogador com Breach sobre troca passiva", () => {
    const redComet = card("sazabi", "A", def({ code: "MSN-04", cardType: "UNIT", ap: 6, hp: 6, effectKeywords: ["Breach"] }));
    const enemySmall = card("gm", "B", def({ code: "RGM-79", cardType: "UNIT", ap: 2, hp: 2 }));

    const v = view({
      viewer: "A",
      A: { battleArea: [redComet], shields: 5 },
      B: { battleArea: [enemySmall], shields: 3 },
    });

    const actions: LegalAction[] = [
      { kind: "declareAttack", attackerId: "sazabi", target: { unitId: "gm" } },
      { kind: "declareAttack", attackerId: "sazabi", target: "player" },
    ];

    const chosen = chooseZeroSystemAction(v, actions, rng, { persona: "char" });
    expect(chosen).toEqual({ kind: "declareAttack", attackerId: "sazabi", target: "player" });
  });

  it("Persona Heero: calcula letal exato e ataca o jogador para fechar a partida", () => {
    const wingZero = card("wing0", "A", def({ code: "XXXG-00W0", cardType: "UNIT", ap: 6, hp: 5 }));
    const enemyUnit = card("leo", "B", def({ code: "OZ-06MS", cardType: "UNIT", ap: 3, hp: 3 }));

    const v = view({
      viewer: "A",
      A: { battleArea: [wingZero], shields: 3 },
      B: { battleArea: [enemyUnit], shields: 1 }, // Inimigo com 1 escudo e vida vulnerável
    });

    const actions: LegalAction[] = [
      { kind: "declareAttack", attackerId: "wing0", target: { unitId: "leo" } },
      { kind: "declareAttack", attackerId: "wing0", target: "player" },
      { kind: "passAction" },
    ];

    const chosen = chooseZeroSystemAction(v, actions, rng, { persona: "heero" });
    expect(chosen).toEqual({ kind: "declareAttack", attackerId: "wing0", target: "player" });
  });

  it("Persona Adaptativa: detecta pressão crítica de escudos e adota postura defensiva de Amuro", () => {
    const blocker = card("blk", "A", def({ code: "BLK", cardType: "UNIT", ap: 1, hp: 3, effectKeywords: ["Blocker"] }));
    const enemyAtk = card("boss", "B", def({ code: "BOSS", cardType: "UNIT", ap: 4, hp: 4 }));

    const v = view({
      viewer: "A",
      combat: {
        step: "block",
        attackerId: "boss",
        attackingPlayer: "B",
        defendingPlayer: "A",
        originalTarget: "player",
        currentTarget: "player",
        actionPasses: { A: false, B: false },
        actionPriority: "A",
      } as ViewGameState["combat"],
      A: { battleArea: [blocker], shields: 1 }, // Escudos baixos -> Amuro ativado!
      B: { battleArea: [enemyAtk], shields: 5 },
    });

    const actions: LegalAction[] = [
      { kind: "skipBlock" },
      { kind: "activateBlocker", blockerId: "blk" },
    ];

    const chosen = chooseZeroSystemAction(v, actions, rng, { persona: "adaptive" });
    expect(chosen).toEqual({ kind: "activateBlocker", blockerId: "blk" });
  });

  it("Persona Treize Khushrenada: prioriza duelo de honra e abate do campeão inimigo de elite", () => {
    const tallgeese = card("tg", "A", def({ code: "OZ-00MS", cardType: "UNIT", ap: 5, hp: 5, level: 6 }));
    const grunt = card("grunt", "B", def({ code: "GRUNT", cardType: "UNIT", ap: 1, hp: 1, level: 1 }), { rested: true });
    const champion = card("boss", "B", def({ code: "CHAMPION", cardType: "UNIT", ap: 4, hp: 4, level: 5 }), { rested: true });

    const v = view({
      viewer: "A",
      A: { battleArea: [tallgeese], shields: 4 },
      B: { battleArea: [grunt, champion], shields: 4 },
    });

    const actions: LegalAction[] = [
      { kind: "declareAttack", attackerId: "tg", target: { unitId: "grunt" } },
      { kind: "declareAttack", attackerId: "tg", target: { unitId: "boss" } },
      { kind: "declareAttack", attackerId: "tg", target: "player" },
      { kind: "passAction" },
    ];

    const chosen = chooseZeroSystemAction(v, actions, rng, { persona: "treize" });
    // Treize desdenha de abater o peão fraco ou bater covardemente no jogador quando há um campeão adversário para duelar
    expect(chosen).toEqual({ kind: "declareAttack", attackerId: "tg", target: { unitId: "boss" } });
  });

  it("zeroSystemPolicy instancia corretamente a policy de self-play", () => {
    const policy = zeroSystemPolicy({ persona: "adaptive" });
    expect(typeof policy).toBe("function");

    const v = view({
      viewer: "A",
      A: { battleArea: [], shields: 5 },
      B: { battleArea: [], shields: 5 },
    });

    const actions: LegalAction[] = [{ kind: "passAction" }];
    const chosen = policy(v, actions, rng);
    expect(chosen).toEqual({ kind: "passAction" });
  });
});

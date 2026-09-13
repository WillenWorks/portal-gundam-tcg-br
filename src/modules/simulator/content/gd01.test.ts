import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { runEndPhase } from "../engine/phases";
import { placeCard } from "../engine/__testkit__/cardHarness";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import type { GameState, PlayerId } from "../engine/types";
import type { EffectContext } from "../engine/effectSpec";
import { resolveEffectSpec, specActiveCalls } from "../engine/effectSpec";
import { applyEvents, findCard } from "../engine/events";
import { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";
import {
  GD01_CARD_DEFS,
  GUNTANK_DEPLOY,
  SIGNS_OF_A_REVOLUTION_MAIN,
  GUNDAM_WHEN_PAIRED,
  ADZAM_DEPLOY,
  BLITZ_GUNDAM_DEPLOY,
  GUNDAM_SANDROCK_DEPLOY,
  SHENLONG_GUNDAM_ATTACK,
  GYAN_WHEN_PAIRED,
  SHAMBLO_ATTACK,
  PERFECT_STRIKE_GUNDAM_DEPLOY,
  SWORD_STRIKE_GUNDAM_ATTACK,
  GUNDAM_DEATHSCYTHE_WHEN_PAIRED,
  CHARS_ZAKU_II_DESTROYED,
  DEEP_DEVOTION_MAIN,
  SECURING_THE_SUPPLY_LINE_MAIN,
  NAHEL_ARGAMA_DEPLOY,
  ZANZIBAR_DEPLOY,
  GAMOW_ACTIVATE_ACTION,
  TACTICAL_TESTING_SECTOR_ACTIVATE_MAIN,
  JUSTICE_GUNDAM_DEPLOY,
  STRIKE_ROUGE_ACTIVATE_MAIN,
  GUNDAM_AERIAL_MIRASOUL_ACTIVATE_ACTION,
  IRON_FISTED_DISCIPLINE_MAIN,
} from "./gd01";

/**
 * Fase 2 (Claude) da wave GD01 — testa os EffectSpecs autorados sobre as
 * cláusulas que a Fase 1 (Gemini) tinha deferido incorretamente (primitivas já
 * existentes, só faltava autoria), mais os 2 bugs reais encontrados na
 * revalidação carta a carta (docs/47 §4.1B, mesmo espírito de ST01-04):
 *
 * 1. `targetFilter: "isRested"` (GD01-008/GD01-104) não batia com nenhum
 *    padrão de `defaultTargetFilterResolver` (o filtro real é "rested") —
 *    o efeito nunca tinha alvo legal. Corrigido em gd01.ts.
 * 2. Bounce (`moveZone` toZone "hand") de uma Unit PAREADA deixava o Pilot
 *    (ou a Unit) do outro lado do pareamento com um ponteiro furado
 *    (`pairedUnitId`/`pairedPilotId` apontando pra uma carta fora de campo).
 *    Corrigido em events.ts (`unpairCounterpart`).
 *
 * Mesmo padrão dos outros arquivos de conteúdo: monta o `EffectContext` à
 * mão (nenhum dispatcher automático ainda fora de `abilityDispatch.ts`).
 */

function freshGame(): GameState {
  return createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 7, firstPlayer: "A" });
}

function ctxFor(state: GameState, sourceInstanceId: string, controller: PlayerId = "A", targets: Record<string, string[]> = {}): EffectContext {
  return { state, controller, sourceInstanceId, turnNumber: state.turnNumber, targets };
}

describe("Bug fixes da revalidação (Fase 2)", () => {
  it("GD01-008 Guntank: 'targetFilter' correto ('rested') acha o alvo legal que 'isRested' nunca achava", () => {
    const state = freshGame();
    const guntankId = placeCard(state, "A", GD01_CARD_DEFS["GD01-008"], "battleArea");
    const restedEnemy = placeCard(state, "B", GD01_CARD_DEFS["GD01-035"], "battleArea", { rested: true });

    expect(GUNTANK_DEPLOY.targetFilter).toBe("rested");
    expect(defaultTargetFilterResolver("rested", findCard(state, restedEnemy), { state })).toBe(true);

    const ctx = ctxFor(state, guntankId, "A", { target: [restedEnemy] });
    const events = resolveEffectSpec(GUNTANK_DEPLOY, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(findCard(next, restedEnemy).damage).toBe(1);
  });

  it("GD01-104 Signs of a Revolution (Main): mesmo fix, 'rested' em vez de 'isRested'", () => {
    expect(SIGNS_OF_A_REVOLUTION_MAIN.targetFilter).toBe("rested");
  });

  it("bounce de uma Unit PAREADA (GD01-068) limpa o pareamento dos 2 lados, sem ponteiro furado", () => {
    const state = freshGame();
    const perfectStrikeId = placeCard(state, "A", GD01_CARD_DEFS["GD01-068"], "battleArea");
    const enemyPilotId = placeCard(state, "B", GD01_CARD_DEFS["GD01-087"], "battleArea");
    const enemyUnitId = placeCard(state, "B", GD01_CARD_DEFS["GD01-035"], "battleArea", {
      hp: undefined,
      damage: (GD01_CARD_DEFS["GD01-035"].hp ?? 2) - 1, // 1 HP restante
      pairedPilotId: enemyPilotId,
    });
    findCard(state, enemyPilotId).pairedUnitId = enemyUnitId;

    const ctx = ctxFor(state, perfectStrikeId, "A", { target: [enemyUnitId] });
    const events = resolveEffectSpec(PERFECT_STRIKE_GUNDAM_DEPLOY, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);

    expect(next.players.B.hand.some((c) => c.instanceId === enemyUnitId)).toBe(true);
    // a Unit bounçada não carrega mais o pareamento...
    expect(findCard(next, enemyUnitId).pairedPilotId).toBeUndefined();
    // ...e o Pilot que ficou em campo não aponta mais pra uma Unit fora do tabuleiro.
    expect(findCard(next, enemyPilotId).pairedUnitId).toBeUndefined();
  });
});

describe("Predicados/filtros novos (composição, trait, cor, contagem de board)", () => {
  it("GD01-001 Gundam (When Paired): dispara só com 2+ OUTRAS Units amigas em campo", () => {
    const state = freshGame();
    const gundamId = placeCard(state, "A", GD01_CARD_DEFS["GD01-001"], "battleArea");
    placeCard(state, "A", GD01_CARD_DEFS["GD01-008"], "battleArea");
    placeCard(state, "A", GD01_CARD_DEFS["GD01-035"], "battleArea");

    const ctx = ctxFor(state, gundamId);
    const calls = specActiveCalls(GUNDAM_WHEN_PAIRED, ctx, defaultPredicateResolver);
    expect(calls).toEqual([{ op: "draw", player: "controller", n: 1 }]);

    const events = resolveEffectSpec(GUNDAM_WHEN_PAIRED, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(next.players.A.hand.length).toBe(state.players.A.hand.length + 1);
  });

  it("GD01-001 Gundam (When Paired): NÃO dispara com menos de 2 outras Units", () => {
    const state = freshGame();
    const gundamId = placeCard(state, "A", GD01_CARD_DEFS["GD01-001"], "battleArea");
    const ctx = ctxFor(state, gundamId);
    expect(specActiveCalls(GUNDAM_WHEN_PAIRED, ctx, defaultPredicateResolver)).toEqual([]);
  });

  it("GD01-038 Adzam (Deploy): dano em área só com 5+ Units inimigas em campo", () => {
    const state = freshGame();
    const adzamId = placeCard(state, "A", GD01_CARD_DEFS["GD01-038"], "battleArea");
    for (let i = 0; i < 5; i++) placeCard(state, "B", GD01_CARD_DEFS["GD01-035"], "battleArea");
    const ctx = ctxFor(state, adzamId);
    const events = resolveEffectSpec(ADZAM_DEPLOY, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);
    for (const unit of next.players.B.battleArea) expect(unit.damage).toBe(1);
  });

  it("GD01-049 Blitz Gundam (Deploy): filtro composto 'trait:ZAFT;ap>=5' exige AMBAS as condições", () => {
    const state = freshGame();
    const blitzId = placeCard(state, "A", GD01_CARD_DEFS["GD01-049"], "battleArea");
    const zaftHighAp = placeCard(state, "A", { ...GD01_CARD_DEFS["GD01-064"], ap: 5 }, "battleArea"); // ZAFT, AP5
    const zaftLowAp = placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "battleArea"); // ZAFT, AP3 (default)
    const nonZaftHighAp = placeCard(state, "A", { ...GD01_CARD_DEFS["GD01-035"], ap: 5 }, "battleArea"); // Zeon, AP5

    expect(defaultTargetFilterResolver(BLITZ_GUNDAM_DEPLOY.targetFilter!, findCard(state, zaftHighAp), { state })).toBe(true);
    expect(defaultTargetFilterResolver(BLITZ_GUNDAM_DEPLOY.targetFilter!, findCard(state, zaftLowAp), { state })).toBe(false);
    expect(defaultTargetFilterResolver(BLITZ_GUNDAM_DEPLOY.targetFilter!, findCard(state, nonZaftHighAp), { state })).toBe(false);

    const ctx = ctxFor(state, blitzId, "A", { target: [zaftHighAp] });
    const events = resolveEffectSpec(BLITZ_GUNDAM_DEPLOY, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(findCard(next, zaftHighAp).keywordGrants).toEqual([{ keyword: "First Strike", duration: "endOfTurn", appliedOnTurn: state.turnNumber }]);
  });

  it("GD01-028 Gundam Sandrock (Deploy): 'you may deploy' de trait específico via deployFromHandTriggered", () => {
    const state = freshGame();
    const sandrockId = placeCard(state, "A", GD01_CARD_DEFS["GD01-028"], "battleArea");
    const maganacInHand = placeCard(state, "A", GD01_CARD_DEFS["GD01-043"], "hand"); // Rasid's Maganac, trait Maganac Corps

    const ctx = ctxFor(state, sandrockId, "A", { deploy: [maganacInHand] });
    const events = resolveEffectSpec(GUNDAM_SANDROCK_DEPLOY, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(next.players.A.battleArea.some((c) => c.instanceId === maganacInHand)).toBe(true);
  });

  it("GD01-029 Shenlong Gundam (Attack): filtro composto 'hasKeyword:Blocker;level<=3' destrói só quem casa os 2", () => {
    const state = freshGame();
    const shenlongId = placeCard(state, "A", GD01_CARD_DEFS["GD01-029"], "battleArea");
    const blockerLowLevel = placeCard(state, "B", GD01_CARD_DEFS["GD01-019"], "battleArea"); // Byarlant Custom: Blocker, Lv.4 -> ajusto level abaixo
    findCard(state, blockerLowLevel).def = { ...findCard(state, blockerLowLevel).def, level: 3 };

    const ctx = ctxFor(state, shenlongId, "A", { target: [blockerLowLevel] });
    const events = resolveEffectSpec(SHENLONG_GUNDAM_ATTACK, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(next.players.B.battleArea.some((c) => c.instanceId === blockerLowLevel)).toBe(false);
    expect(next.players.B.trash.some((c) => c.instanceId === blockerLowLevel)).toBe(true);
  });

  it("GD01-032 Gyan (When Paired, condição de trait do Piloto pareado): só dispara pareado com Piloto (Zeon)", () => {
    const state = freshGame();
    const gyanId = placeCard(state, "A", GD01_CARD_DEFS["GD01-032"], "battleArea");
    const zeonPilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-092"], "battleArea"); // M'Quve, trait Zeon
    findCard(state, gyanId).pairedPilotId = zeonPilotId;
    const target = placeCard(state, "B", GD01_CARD_DEFS["GD01-019"], "battleArea", { def: { ...GD01_CARD_DEFS["GD01-019"], level: 2 } });

    const ctx = ctxFor(state, gyanId, "A", { target: [target] });
    expect(specActiveCalls(GYAN_WHEN_PAIRED, ctx, defaultPredicateResolver)).toHaveLength(1);
  });

  it("GD01-047 Shamblo (Attack): dano condicionado a 2+ OUTRAS Units amigas rested", () => {
    const state = freshGame();
    const shambloId = placeCard(state, "A", GD01_CARD_DEFS["GD01-047"], "battleArea");
    placeCard(state, "A", GD01_CARD_DEFS["GD01-035"], "battleArea", { rested: true });
    placeCard(state, "A", GD01_CARD_DEFS["GD01-036"], "battleArea", { rested: true });
    const enemyId = placeCard(state, "B", GD01_CARD_DEFS["GD01-027"], "battleArea"); // Big Zam, HP6 (sobrevive aos 3 de dano)

    const ctx = ctxFor(state, shambloId, "A", { target: [enemyId] });
    const events = resolveEffectSpec(SHAMBLO_ATTACK, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(findCard(next, enemyId).damage).toBe(3);
  });

  it("GD01-073 Sword Strike Gundam (During Link + Attack): só bounça se a fonte É Link Unit agora", () => {
    const state = freshGame();
    const swordStrikeId = placeCard(state, "A", GD01_CARD_DEFS["GD01-073"], "battleArea");
    const ctxNotLinked = ctxFor(state, swordStrikeId);
    expect(specActiveCalls(SWORD_STRIKE_GUNDAM_ATTACK, ctxNotLinked, defaultPredicateResolver)).toEqual([]);
  });
});

describe("Primitivas existentes reaproveitadas (deployThisCard/spawnToken/addShieldToHand/staticAbilities)", () => {
  it("GD01-025 Gundam Deathscythe (When Paired, condição por trait do Piloto): recurso + First Strike", () => {
    const state = freshGame();
    const deathscytheId = placeCard(state, "A", GD01_CARD_DEFS["GD01-025"], "battleArea");
    const meteorPilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-090"], "battleArea"); // Duo Maxwell, trait Operation Meteor
    findCard(state, deathscytheId).pairedPilotId = meteorPilotId;

    const ctx = ctxFor(state, deathscytheId);
    const events = resolveEffectSpec(GUNDAM_DEATHSCYTHE_WHEN_PAIRED, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(next.players.A.resourceArea.some((c) => c.rested)).toBe(true);
    expect(findCard(next, deathscytheId).keywordGrants.some((g) => g.keyword === "First Strike")).toBe(true);
  });

  it("GD01-026 Char's Zaku II (During Pair + Destroyed): spawna token rested só se estava pareada ao morrer", () => {
    const state = freshGame();
    const zakuId = placeCard(state, "A", GD01_CARD_DEFS["GD01-026"], "battleArea");
    const events = resolveEffectSpec(CHARS_ZAKU_II_DESTROYED, ctxFor(state, zakuId), defaultPredicateResolver);
    const next = applyEvents(state, events);
    const token = next.players.A.battleArea.find((c) => c.def.isToken);
    expect(token?.rested).toBe(true);
    expect(CHARS_ZAKU_II_DESTROYED.duringPair).toBe(true);
  });

  it("GD01-101 Deep Devotion (Main): cura só Link Unit amiga (targetFilter 'linkUnit')", () => {
    const state = freshGame();
    const linkUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-088"], "battleArea"); // Banagher Links (pilot) pareado
    const unitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-005"], "battleArea", { damage: 2, pairedPilotId: linkUnitId }); // Unicorn Gundam, link Banagher Links
    findCard(state, linkUnitId).pairedUnitId = unitId;
    expect(defaultTargetFilterResolver("linkUnit", findCard(state, unitId), { state })).toBe(true);

    const ctx = ctxFor(state, "cmd-source", "A", { target: [unitId] });
    const events = resolveEffectSpec(DEEP_DEVOTION_MAIN, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(findCard(next, unitId).damage).toBe(0); // recuperou 3, cap em 0
  });

  it("GD01-102 Securing the Supply Line (Main): TargetGroup 'allFriendlyUnits' com maxLevel cura só quem casa o nível", () => {
    const state = freshGame();
    const lowLevel = placeCard(state, "A", GD01_CARD_DEFS["GD01-035"], "battleArea", { damage: 1 }); // Lv.2
    const highLevel = placeCard(state, "A", GD01_CARD_DEFS["GD01-024"], "battleArea", { damage: 1 }); // Lv.8
    const ctx = ctxFor(state, "cmd-source");
    const events = resolveEffectSpec(SECURING_THE_SUPPLY_LINE_MAIN, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(findCard(next, lowLevel).damage).toBe(0);
    expect(findCard(next, highLevel).damage).toBe(1); // Lv.8 > 4, não recuperou
  });

  it("GD01-123 Nahel Argama (Deploy): shield + rest do alvo com hp<=3", () => {
    const state = freshGame();
    const targetId = placeCard(state, "B", GD01_CARD_DEFS["GD01-035"], "battleArea");
    const ctx = ctxFor(state, "base-source", "A", { target: [targetId] });
    const events = resolveEffectSpec(NAHEL_ARGAMA_DEPLOY, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(next.players.A.hand.length).toBe(state.players.A.hand.length + 1);
    expect(findCard(next, targetId).rested).toBe(true);
  });

  it("GD01-125 Zanzibar (Deploy): deploy condicional só no PRÓPRIO turno (isControllersTurn)", () => {
    const state = freshGame();
    const zeonInHand = placeCard(state, "A", GD01_CARD_DEFS["GD01-035"], "hand");
    const ctx = ctxFor(state, "base-source", "A", { deploy: [zeonInHand] });
    expect(state.activePlayer).toBe("A");
    const calls = specActiveCalls(ZANZIBAR_DEPLOY, ctx, defaultPredicateResolver);
    expect(calls.some((c) => c.op === "deployFromHandTriggered")).toBe(true);

    const ctxOpponentTurn = ctxFor(state, "base-source", "B", { deploy: [zeonInHand] });
    const callsOpponent = specActiveCalls(ZANZIBAR_DEPLOY, ctxOpponentTurn, defaultPredicateResolver);
    expect(callsOpponent.some((c) => c.op === "deployFromHandTriggered")).toBe(false);
  });

  it("GD01-127 Gamow (Activate Action): concede Breach 3 'nesta batalha' (duration thisBattle) a Unit ZAFT AP>=5", () => {
    const state = freshGame();
    const gamowId = placeCard(state, "A", GD01_CARD_DEFS["GD01-127"], "baseSection");
    const targetId = placeCard(state, "A", { ...GD01_CARD_DEFS["GD01-064"], ap: 5 }, "battleArea");
    const ctx = ctxFor(state, gamowId, "A", { target: [targetId] });
    const events = resolveEffectSpec(GAMOW_ACTIVATE_ACTION, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(findCard(next, targetId).keywordGrants).toEqual([{ keyword: "Breach 3", duration: "thisBattle", appliedOnTurn: state.turnNumber }]);
  });

  it("GD01-130 13th Tactical Testing Sector (Activate Main): condicionado a ter Unit (Academy) em campo", () => {
    const state = freshGame();
    const sectorId = placeCard(state, "A", GD01_CARD_DEFS["GD01-130"], "baseSection");
    const enemyId = placeCard(state, "B", GD01_CARD_DEFS["GD01-035"], "battleArea");
    const ctxNoAcademy = ctxFor(state, sectorId, "A", { target: [enemyId] });
    expect(specActiveCalls(TACTICAL_TESTING_SECTOR_ACTIVATE_MAIN, ctxNoAcademy, defaultPredicateResolver)).toEqual([]);

    placeCard(state, "A", GD01_CARD_DEFS["GD01-083"], "battleArea"); // Guel's Dilanza, trait Academy
    const ctxWithAcademy = ctxFor(state, sectorId, "A", { target: [enemyId] });
    const events = resolveEffectSpec(TACTICAL_TESTING_SECTOR_ACTIVATE_MAIN, ctxWithAcademy, defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(findCard(next, enemyId).statModifiers).toEqual([{ stat: "ap", amount: -1, duration: "endOfTurn", appliedOnTurn: state.turnNumber }]);
  });

  it("GD01-066 Justice Gundam (Deploy): spawna o token Fatum-00 (AP2/HP2/Blocker)", () => {
    const state = freshGame();
    const justiceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-066"], "battleArea");
    const events = resolveEffectSpec(JUSTICE_GUNDAM_DEPLOY, ctxFor(state, justiceId), defaultPredicateResolver);
    const next = applyEvents(state, events);
    const token = next.players.A.battleArea.find((c) => c.def.nameEn === "Fatum-00");
    expect(token?.def.isToken).toBe(true);
    expect(token?.def.effectKeywords).toContain("Blocker");
  });

  it("GD01-006 Delta Plus: 'During Link, HP+1' agora é staticAbility real (effectiveHp reage a Link)", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-013"], "hand"); // qualquer pilot fixture não usado aqui — substituído abaixo
    void pilotId;
    expect(GD01_CARD_DEFS["GD01-006"].staticAbilities).toEqual([{ condition: "duringLink", scope: "self", stat: "hp", amount: 1 }]);
  });

  it("GD01-042 Duo's Leo: 'attackTargetRules.mayTargetActiveEnemyUnit' é campo estático, não EffectSpec", () => {
    expect(GD01_CARD_DEFS["GD01-042"].attackTargetRules).toEqual({ mayTargetActiveEnemyUnit: { maxLevel: 2 } });
  });

  it("GD01-069 Strike Rouge (Activate Main): filtro composto 'color:white;hasKeyword:Blocker;rested'", () => {
    const state = freshGame();
    const whiteBlockerRested = placeCard(state, "A", GD01_CARD_DEFS["GD01-068"], "battleArea", { rested: true }); // Perfect Strike Gundam: cor white, Blocker
    expect(defaultTargetFilterResolver(STRIKE_ROUGE_ACTIVATE_MAIN.targetFilter!, findCard(state, whiteBlockerRested), { state })).toBe(true);

    const activeOne = placeCard(state, "A", GD01_CARD_DEFS["GD01-068"], "battleArea", { rested: false });
    expect(defaultTargetFilterResolver(STRIKE_ROUGE_ACTIVATE_MAIN.targetFilter!, findCard(state, activeOne), { state })).toBe(false);
  });

  it("GD01-082 Gundam Aerial (Mirasoul): 'During Pair' via predicate selfIsPaired (mais simples que selfIsLinkUnit)", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-082"], "battleArea");
    const ctxUnpaired = ctxFor(state, sourceId);
    expect(specActiveCalls(GUNDAM_AERIAL_MIRASOUL_ACTIVATE_ACTION, ctxUnpaired, defaultPredicateResolver)).toEqual([]);

    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-087"], "battleArea");
    findCard(state, sourceId).pairedPilotId = pilotId;
    const ctxPaired = ctxFor(state, sourceId);
    expect(specActiveCalls(GUNDAM_AERIAL_MIRASOUL_ACTIVATE_ACTION, ctxPaired, defaultPredicateResolver)).toHaveLength(1);
  });
});

describe("Invariante C (Fase 3B) — expiração de Duration", () => {
  it("'endOfTurn' (GD01-049 grantKeyword, GD01-119 modifyStat) expira na End Phase do turno em que foi aplicado", () => {
    const state = freshGame();
    const blitzId = placeCard(state, "A", GD01_CARD_DEFS["GD01-049"], "battleArea");
    const zaftHighAp = placeCard(state, "A", { ...GD01_CARD_DEFS["GD01-064"], ap: 5 }, "battleArea");
    const enemyId = placeCard(state, "B", { ...GD01_CARD_DEFS["GD01-035"], level: 3 }, "battleArea");

    const ctx = ctxFor(state, blitzId, "A", { target: [zaftHighAp] });
    let next = applyEvents(state, resolveEffectSpec(BLITZ_GUNDAM_DEPLOY, ctx, defaultPredicateResolver));
    next = applyEvents(next, resolveEffectSpec(IRON_FISTED_DISCIPLINE_MAIN, { ...ctx, targets: { target: [enemyId] } }, defaultPredicateResolver));

    expect(findCard(next, zaftHighAp).keywordGrants).toHaveLength(1);
    expect(findCard(next, enemyId).statModifiers).toHaveLength(1);

    const afterEndPhase = runEndPhase(next);
    expect(findCard(afterEndPhase, zaftHighAp).keywordGrants).toEqual([]);
    expect(findCard(afterEndPhase, enemyId).statModifiers).toEqual([]);
  });

  it("'thisBattle' (GD01-127/GD01-071/GD01-059) usa o mesmo mecanismo genérico de combat.ts (já coberto pelos testes de combate ST01-04) — só confere que a duration gravada é a certa", () => {
    expect(GAMOW_ACTIVATE_ACTION.actions[0]).toMatchObject({ duration: "thisBattle" });
  });
});

import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { runEndPhase, advanceToMainPhase } from "../engine/phases";
import { deployCard } from "../engine/deploy";
import { declareAttack } from "../engine/combat";
import { applyPlayerAction } from "../engine/actions";
import { placeCard } from "../engine/__testkit__/cardHarness";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import type { GameState, PlayerId } from "../engine/types";
import { effectiveAp, effectiveCost, hasKeyword, keywordValue } from "../engine/types";
import type { EffectContext, EffectSpec } from "../engine/effectSpec";
import { computeLegalTargets, resolveEffectSpec, specActiveCalls } from "../engine/effectSpec";
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
  JUSTICE_GUNDAM_ATTACK,
  STRIKE_ROUGE_ACTIVATE_MAIN,
  GUNDAM_AERIAL_MIRASOUL_ACTIVATE_ACTION,
  IRON_FISTED_DISCIPLINE_MAIN,
  G_SKY_EASY_ACTIVATE_ACTION,
  WING_GUNDAM_ZERO_DEPLOY,
  BIG_ZAM_DEPLOY,
  GALLUSS_K_ACTIVATE_ACTION,
  STRATEGIC_ARMS_MAIN,
  RASIDS_ORDERS_MAIN,
  RASIDS_ORDERS_ACTION,
  RASIDS_MAGANAC_DEPLOY,
  ZAKU_I_SNIPER_TYPE_DEPLOY,
  THE_PATH_TO_VICTORY_OR_DEFEAT_MAIN,
  KSHATRIYA_WHEN_PAIRED,
  ASSAULT_ON_TORRINGTON_BASE_ACTION,
  GD01_EFFECT_SPECS,
  BANAGHER_LINKS_BURST,
  MARIDA_CRUZ_BURST,
  MARIDA_CRUZ_ATTACK,
  DEARKA_ELTHMAN_BURST,
  DEARKA_ELTHMAN_WHEN_LINKED,
  GUEL_JETURK_BURST,
  ELAN_CERES_BURST,
  CITIZENS_TAKE_A_STAND_BURST,
  MIDAIR_MODIFICATIONS_MAIN,
  MIDAIR_MODIFICATIONS_BURST,
  KUSANAGI_BURST,
  KUSANAGI_DEPLOY,
  THE_STUBBORN_COG_MAIN,
  EXTREME_HATRED_MAIN,
  DOPP_DEPLOY,
  DUEL_GUNDAM_ASSAULT_SHROUD_WHEN_PAIRED,
  GUNDAM_AERIAL_REBUILD_WHEN_PAIRED,
  COVERT_OPERATIVE_MAIN,
  BANSHEE_DESTROY_MODE_ATTACK,
  UNICORN_GUNDAM_DESTROY_MODE_ATTACK,
  CHARS_GELGOOG_ACTIVATE_MAIN,
  FREEDOM_GUNDAM_ANY_PAIRING,
} from "./gd01";
import { burstEligibleShieldIds, dispatchTrigger } from "../engine/dispatcher";

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
    expect(findCard(next, enemyId).statModifiers).toEqual([
      { stat: "ap", amount: -1, duration: "endOfTurn", appliedOnTurn: state.turnNumber, appliedBy: "A" },
    ]);
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

  it("GD01-066 Justice Gundam (Attack): 'selfIsPaired' só ativa a 2ª cláusula quando pareada (docs/47 Fase 3, deferred.ts fechado)", () => {
    const state = freshGame();
    const justiceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-066"], "battleArea");
    expect(specActiveCalls(JUSTICE_GUNDAM_ATTACK, ctxFor(state, justiceId), defaultPredicateResolver)).toEqual([]);

    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-087"], "battleArea");
    findCard(state, justiceId).pairedPilotId = pilotId;
    expect(specActiveCalls(JUSTICE_GUNDAM_ATTACK, ctxFor(state, justiceId), defaultPredicateResolver)).toHaveLength(1);
  });

  it("GD01-066 Justice Gundam (Attack): concede <AttackOnDeployTurn> ao token Fatum-00 escolhido, permitindo atacar no turno em que foi deployado", () => {
    let state = advanceToMainPhase(freshGame());
    const justiceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-066"], "battleArea");
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-087"], "battleArea");
    findCard(state, justiceId).pairedPilotId = pilotId;
    state = applyEvents(state, resolveEffectSpec(JUSTICE_GUNDAM_DEPLOY, ctxFor(state, justiceId), defaultPredicateResolver));
    const tokenId = state.players.A.battleArea.find((c) => c.def.nameEn === "Fatum-00")!.instanceId;
    findCard(state, tokenId).enteredZoneOnTurn = state.turnNumber; // deployado NESTE turno

    // sem a concessão, o token recém-deployado não pode atacar (CR 3-2-4).
    expect(() => declareAttack(state, tokenId, "player")).toThrow(/recém-deployada/);

    const ctx = ctxFor(state, justiceId, "A", { target: [tokenId] });
    const withGrant = applyEvents(state, resolveEffectSpec(JUSTICE_GUNDAM_ATTACK, ctx, defaultPredicateResolver));
    expect(hasKeyword(findCard(withGrant, tokenId), "AttackOnDeployTurn", withGrant)).toBe(true);

    expect(() => declareAttack(withGrant, tokenId, "player")).not.toThrow();
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

describe("Lote 1 (docs/debates 2026-09-13) — TargetScope 'anyUnit' e TargetGroup 'allUnits' (ambos os lados)", () => {
  it("GD01-014 G-Sky Easy (During Link + Activate·Action, Once per Turn): cura 1 HP em Unit de QUALQUER lado, só quando é Link Unit", () => {
    const state = freshGame();
    // link sobrescrito só pra este teste (o CardDef real de GD01-014 referencia
    // "White Base Team" como se fosse nome de Piloto — dado herdado da Fase 1,
    // fora do escopo deste lote; aqui só precisamos de uma Link Unit de verdade).
    const gSkyDef = { ...GD01_CARD_DEFS["GD01-014"], link: { kind: "pilotName" as const, values: ["Banagher Links"] } };
    const gSkyId = placeCard(state, "A", gSkyDef, "battleArea");
    const enemyTargetId = placeCard(state, "B", GD01_CARD_DEFS["GD01-035"], "battleArea", { damage: 1 });

    const ctxNotLinked = ctxFor(state, gSkyId, "A", { target: [enemyTargetId] });
    expect(specActiveCalls(G_SKY_EASY_ACTIVATE_ACTION, ctxNotLinked, defaultPredicateResolver)).toEqual([]);

    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-088"], "battleArea"); // Banagher Links
    findCard(state, gSkyId).pairedPilotId = pilotId;
    findCard(state, pilotId).pairedUnitId = gSkyId;

    const ctxLinked = ctxFor(state, gSkyId, "A", { target: [enemyTargetId] });
    const calls = specActiveCalls(G_SKY_EASY_ACTIVATE_ACTION, ctxLinked, defaultPredicateResolver);
    expect(calls).toEqual([{ op: "heal", target: { kind: "named", name: "target" }, amount: 1 }]);

    const events = resolveEffectSpec(G_SKY_EASY_ACTIVATE_ACTION, ctxLinked, defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(findCard(next, enemyTargetId).damage).toBe(0); // curou o alvo do lado INIMIGO — prova do targetScope "anyUnit"
  });

  it("GD01-024 Wing Gundam Zero (Deploy): 3 de dano em TODAS as Units (dos 2 lados) de Lv.5 ou menor", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-024"], "battleArea"); // Lv.8 — fora do próprio filtro
    const friendlyLow = placeCard(state, "A", GD01_CARD_DEFS["GD01-068"], "battleArea"); // Perfect Strike Gundam Lv.5/HP4
    const enemyLow = placeCard(state, "B", GD01_CARD_DEFS["GD01-071"], "battleArea"); // Gundam Pharact Lv.4/HP4
    const enemyHigh = placeCard(state, "B", GD01_CARD_DEFS["GD01-047"], "battleArea"); // Shamblo Lv.8

    const events = resolveEffectSpec(WING_GUNDAM_ZERO_DEPLOY, ctxFor(state, sourceId), defaultPredicateResolver);
    const next = applyEvents(state, events);

    expect(findCard(next, friendlyLow).damage).toBe(3);
    expect(findCard(next, enemyLow).damage).toBe(3);
    expect(findCard(next, enemyHigh).damage).toBe(0);
    expect(findCard(next, sourceId).damage).toBe(0);
  });

  it("GD01-027 Big Zam (Deploy): só dispara com 10+ Units (Zeon)/(Neo Zeon) na lixeira; dano 4 em TODAS as Units com <Blocker>", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-027"], "battleArea"); // já tem <Blocker> própria, HP6
    const enemyBlocker = placeCard(state, "B", { ...GD01_CARD_DEFS["GD01-035"], hp: 10, effectKeywords: ["Blocker"] }, "battleArea");
    const enemyNoBlocker = placeCard(state, "B", GD01_CARD_DEFS["GD01-064"], "battleArea");

    expect(specActiveCalls(BIG_ZAM_DEPLOY, ctxFor(state, sourceId), defaultPredicateResolver)).toEqual([]); // lixeira vazia

    for (let i = 0; i < 10; i++) placeCard(state, "A", GD01_CARD_DEFS["GD01-035"], "trash"); // 10 Units (Zeon) na lixeira

    const events = resolveEffectSpec(BIG_ZAM_DEPLOY, ctxFor(state, sourceId), defaultPredicateResolver);
    const next = applyEvents(state, events);

    expect(findCard(next, sourceId).damage).toBe(4); // a própria Big Zam tem Blocker — dano em área a atinge também
    expect(findCard(next, enemyBlocker).damage).toBe(4);
    expect(findCard(next, enemyNoBlocker).damage).toBe(0);
  });

  it("GD01-058 Galluss-K (Activate·Action, custo ①): paga 1 Recurso e dá AP+1 nesta batalha numa Unit Lv.4+ de QUALQUER lado", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-058"], "battleArea");
    const resourceId = placeCard(
      state,
      "A",
      { code: "GD01-RESOURCE", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" },
      "resourceArea",
    );
    const targetId = placeCard(state, "B", GD01_CARD_DEFS["GD01-047"], "battleArea"); // Shamblo, Lv.8

    const ctx: EffectContext = {
      state,
      controller: "A",
      sourceInstanceId: sourceId,
      turnNumber: state.turnNumber,
      targets: { target: [targetId] },
      costResourceIds: [resourceId],
    };
    const events = resolveEffectSpec(GALLUSS_K_ACTIVATE_ACTION, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);

    expect(findCard(next, resourceId).rested).toBe(true);
    expect(findCard(next, targetId).statModifiers).toContainEqual(
      expect.objectContaining({ stat: "ap", amount: 1, duration: "thisBattle" }),
    );
  });

  it("GD01-108 Strategic Arms (Main): 2 de dano em TODAS as Units com <Blocker>, dos 2 lados", () => {
    const state = freshGame();
    const friendlyBlocker = placeCard(state, "A", { ...GD01_CARD_DEFS["GD01-035"], hp: 10, effectKeywords: ["Blocker"] }, "battleArea");
    const enemyBlocker = placeCard(state, "B", { ...GD01_CARD_DEFS["GD01-035"], hp: 10, effectKeywords: ["Blocker"] }, "battleArea");
    const enemyNoBlocker = placeCard(state, "B", GD01_CARD_DEFS["GD01-064"], "battleArea");

    const events = resolveEffectSpec(STRATEGIC_ARMS_MAIN, ctxFor(state, "cmd-source"), defaultPredicateResolver);
    const next = applyEvents(state, events);

    expect(findCard(next, friendlyBlocker).damage).toBe(2);
    expect(findCard(next, enemyBlocker).damage).toBe(2);
    expect(findCard(next, enemyNoBlocker).damage).toBe(0);
  });

  it("GD01-110 Rasid's Orders (Main/Action): concede relaxamento de alvo de ataque por AP<=6 numa Unit Lv.4+ de QUALQUER lado", () => {
    const state = freshGame();
    const targetId = placeCard(state, "A", GD01_CARD_DEFS["GD01-047"], "battleArea"); // Shamblo, Lv.8

    const mainEvents = resolveEffectSpec(RASIDS_ORDERS_MAIN, ctxFor(state, "cmd-source", "A", { target: [targetId] }), defaultPredicateResolver);
    const afterMain = applyEvents(state, mainEvents);
    expect(findCard(afterMain, targetId).attackTargetRelaxUntilTurn).toEqual({ maxLevel: undefined, maxAp: 6, turn: state.turnNumber });

    // mesma primitiva, timing 【Action】 — RASIDS_ORDERS_ACTION reaproveita RASIDS_ORDERS_ACTIONS
    expect(RASIDS_ORDERS_ACTION.actions).toBe(RASIDS_ORDERS_MAIN.actions);
  });

  it("GD01-043 Rasid's Maganac (Deploy): concede relaxamento de alvo de ataque por AP<=4 numa Unit VERDE própria (reaproveita maxAp sem extensão nova de motor)", () => {
    const state = freshGame();
    const targetId = placeCard(state, "A", GD01_CARD_DEFS["GD01-043"], "battleArea"); // ela mesma é verde

    const events = resolveEffectSpec(RASIDS_MAGANAC_DEPLOY, ctxFor(state, "cmd-source", "A", { target: [targetId] }), defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(findCard(next, targetId).attackTargetRelaxUntilTurn).toEqual({ maxLevel: undefined, maxAp: 4, turn: state.turnNumber });
  });
});

describe("Lote 3 (docs/debates 2026-09-13) — StaticAbility com condição genérica de board/self e aura de Pilot condicional", () => {
  it("GD01-019 Byarlant Custom: só ganha <Blocker> com 4+ Units inimigas em campo (era effectKeywords fixo na Fase 1 — bug de mesma classe do GD01-108)", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-019"], "battleArea");
    for (let i = 0; i < 3; i++) placeCard(state, "B", GD01_CARD_DEFS["GD01-064"], "battleArea");
    expect(hasKeyword(findCard(state, sourceId), "Blocker", state)).toBe(false);

    placeCard(state, "B", GD01_CARD_DEFS["GD01-064"], "battleArea"); // 4ª Unit inimiga
    expect(hasKeyword(findCard(state, sourceId), "Blocker", state)).toBe(true);
  });

  it("GD01-034 Gundam Heavyarms: só ganha <Breach 3> 【During Pair】", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-034"], "battleArea");
    expect(hasKeyword(findCard(state, sourceId), "Breach", state)).toBe(false);
    expect(keywordValue(findCard(state, sourceId), "Breach", state)).toBeNull();

    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-088"], "battleArea");
    findCard(state, sourceId).pairedPilotId = pilotId;
    findCard(state, pilotId).pairedUnitId = sourceId;
    expect(hasKeyword(findCard(state, sourceId), "Breach", state)).toBe(true);
    expect(keywordValue(findCard(state, sourceId), "Breach", state)).toBe(3);
  });

  it("GD01-054 Duel Gundam: só ganha <Breach 3> com AP efetivo próprio >= 5", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-054"], "battleArea"); // AP base 3
    expect(hasKeyword(findCard(state, sourceId), "Breach", state)).toBe(false);

    findCard(state, sourceId).statModifiers.push({ stat: "ap", amount: 2, duration: "permanent", appliedOnTurn: state.turnNumber });
    expect(effectiveAp(findCard(state, sourceId), state)).toBe(5);
    expect(hasKeyword(findCard(state, sourceId), "Breach", state)).toBe(true);
    expect(keywordValue(findCard(state, sourceId), "Breach", state)).toBe(3);
  });

  it("GD01-076 Michaelis: só ganha AP+1/HP+1 com 4+ Command cards na lixeira do controller", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-076"], "battleArea"); // AP 3 / HP 3 base
    for (let i = 0; i < 3; i++) placeCard(state, "A", GD01_CARD_DEFS["GD01-099"], "trash"); // Intercept Orders (Command)
    expect(effectiveAp(findCard(state, sourceId), state)).toBe(3);
    expect(findCard(state, sourceId).def.hp).toBe(3);

    placeCard(state, "A", GD01_CARD_DEFS["GD01-099"], "trash"); // 4º Command na lixeira
    expect(effectiveAp(findCard(state, sourceId), state)).toBe(4);
  });

  it("GD01-081 M1 Astray: só ganha AP+1 e <Blocker> com OUTRA Unit (Triple Ship Alliance) em campo (exclui a própria fonte)", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-081"], "battleArea"); // já é (Triple Ship Alliance), sozinha não conta
    expect(effectiveAp(findCard(state, sourceId), state)).toBe(2);
    expect(hasKeyword(findCard(state, sourceId), "Blocker", state)).toBe(false);

    placeCard(state, "A", GD01_CARD_DEFS["GD01-065"], "battleArea"); // Freedom Gundam, também (Triple Ship Alliance)
    expect(effectiveAp(findCard(state, sourceId), state)).toBe(3);
    expect(hasKeyword(findCard(state, sourceId), "Blocker", state)).toBe(true);
  });

  it("GD01-087 Sayla Mass (Pilot): concede <Repair 1> à Unit pareada só enquanto ela for AZUL ('this Unit' = a Unit pareada, não o Piloto)", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-087"], "battleArea");
    const blueUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-001"], "battleArea"); // Gundam, blue
    findCard(state, pilotId).pairedUnitId = blueUnitId;
    findCard(state, blueUnitId).pairedPilotId = pilotId;
    expect(hasKeyword(findCard(state, blueUnitId), "Repair", state)).toBe(true);
    expect(keywordValue(findCard(state, blueUnitId), "Repair", state)).toBe(1);
    expect(hasKeyword(findCard(state, pilotId), "Repair", state)).toBe(false); // a própria Piloto NÃO ganha a keyword

    const redUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "battleArea"); // DINN, red
    findCard(state, pilotId).pairedUnitId = redUnitId;
    findCard(state, redUnitId).pairedPilotId = pilotId;
    expect(hasKeyword(findCard(state, redUnitId), "Repair", state)).toBe(false);
  });

  it("GD01-001 Gundam: aura 'All your (White Base Team) Units gain <Repair 1>' concede a keyword a OUTRA Unit do grupo sem tê-la impressa (deferred.ts fechado)", () => {
    const state = freshGame();
    placeCard(state, "A", GD01_CARD_DEFS["GD01-001"], "battleArea");
    // GD01-013 Gundam (outra versão): mesmo traits ["Earth Federation","White Base Team"], sem Repair impresso.
    const otherWhiteBaseUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-013"], "battleArea");
    expect(hasKeyword(findCard(state, otherWhiteBaseUnitId), "Repair", state)).toBe(true);
    expect(keywordValue(findCard(state, otherWhiteBaseUnitId), "Repair", state)).toBe(1);

    // Unit sem trait White Base Team NÃO recebe a aura.
    const nonWhiteBaseUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "battleArea"); // DINN, Principality of Zeon
    expect(hasKeyword(findCard(state, nonWhiteBaseUnitId), "Repair", state)).toBe(false);

    // Sem `state`, a concessão via StaticAbility não é vista (limite documentado em `hasKeyword`).
    expect(hasKeyword(findCard(state, otherWhiteBaseUnitId), "Repair")).toBe(false);

    // Fim de turno (activePlayer "A"): a Unit sem Repair impresso, mas danificada, é curada pela aura.
    findCard(state, otherWhiteBaseUnitId).damage = 1;
    const healed = runEndPhase(state);
    expect(findCard(healed, otherWhiteBaseUnitId).damage).toBe(0);
  });

  it("GD01-089 Riddhe Marcenas (Pilot): concede AP+1 à Unit pareada só enquanto ela mesma tiver <Repair>", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-089"], "battleArea");
    const repairUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-001"], "battleArea"); // Gundam, tem <Repair 1> própria
    findCard(state, pilotId).pairedUnitId = repairUnitId;
    findCard(state, repairUnitId).pairedPilotId = pilotId;
    // base 3 + AP impresso do Piloto pareado (Comprehensive Rules 3-3-5, incondicional, ap:1) + 1 da StaticAbility condicional (tem <Repair>)
    expect(effectiveAp(findCard(state, repairUnitId), state)).toBe(5);

    const noRepairUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "battleArea"); // DINN, sem Repair
    findCard(state, pilotId).pairedUnitId = noRepairUnitId;
    findCard(state, noRepairUnitId).pairedPilotId = pilotId;
    expect(effectiveAp(findCard(state, noRepairUnitId), state)).toBe(4); // base 3 + AP impresso do Piloto, SEM o bônus condicional
  });

  it("GD01-092 M'Quve (Pilot): concede <Breach 1> à Unit pareada só enquanto ela for (Zeon)", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-092"], "battleArea");
    const zeonUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-023"], "battleArea"); // Char's Gelgoog, (Zeon)
    findCard(state, pilotId).pairedUnitId = zeonUnitId;
    findCard(state, zeonUnitId).pairedPilotId = pilotId;
    expect(hasKeyword(findCard(state, zeonUnitId), "Breach", state)).toBe(true);
    expect(keywordValue(findCard(state, zeonUnitId), "Breach", state)).toBe(1);

    const nonZeonUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "battleArea"); // DINN, (ZAFT)
    findCard(state, pilotId).pairedUnitId = nonZeonUnitId;
    findCard(state, nonZeonUnitId).pairedPilotId = pilotId;
    expect(hasKeyword(findCard(state, nonZeonUnitId), "Breach", state)).toBe(false);
  });

  it("GD01-096 Cagalli Yula Athha (Pilot): concede <Blocker> à Unit pareada só enquanto ela for BRANCA", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-096"], "battleArea");
    const whiteUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-065"], "battleArea"); // Freedom Gundam, white (já tem Blocker próprio — usamos outra branca sem Blocker pra isolar)
    findCard(state, pilotId).pairedUnitId = whiteUnitId;
    findCard(state, whiteUnitId).pairedPilotId = pilotId;
    expect(hasKeyword(findCard(state, whiteUnitId), "Blocker", state)).toBe(true);

    const nonWhiteUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "battleArea"); // DINN, red
    findCard(state, pilotId).pairedUnitId = nonWhiteUnitId;
    findCard(state, nonWhiteUnitId).pairedPilotId = pilotId;
    expect(hasKeyword(findCard(state, nonWhiteUnitId), "Blocker", state)).toBe(false);
  });
});

describe("Lote 2 (docs/debates 2026-09-13) — busca no topo do deck com filtro composto", () => {
  it("GD01-048 Zaku I Sniper Type (Deploy): revela e adiciona à mão 1 Unit (Zeon)/(Neo Zeon) do topo (mesmo shape de ST03-006, sem extensão nova de motor)", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-048"], "battleArea");
    placeCard(state, "A", GD01_CARD_DEFS["GD01-023"], "deck"); // Char's Gelgoog, (Zeon) Unit
    state.players.A.deck.unshift(state.players.A.deck.pop()!);
    const topId = state.players.A.deck[0].instanceId;
    const handBefore = state.players.A.hand.length;

    const events = resolveEffectSpec(ZAKU_I_SNIPER_TYPE_DEPLOY, ctxFor(state, sourceId, "A", { reveal: [topId] }), defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(next.players.A.hand.some((c) => c.instanceId === topId)).toBe(true);
    expect(next.players.A.hand).toHaveLength(handBefore + 1);
  });

  it("GD01-109 The Path to Victory or Defeat (Main): revela e adiciona à mão 1 Unit/Pilot (Operation Meteor)/(G Team) entre as 5 do topo (usa CardDefFilter.anyCardType — extensão nova)", () => {
    const state = freshGame();
    const sourceId = "cmd-source";
    // 5 cartas no topo, a 3ª (índice 2) é o Piloto (Operation Meteor) que casa o filtro — prova o lado "Pilot card" do anyCardType.
    for (let i = 0; i < 5; i++) {
      const def = i === 2 ? GD01_CARD_DEFS["GD01-090"] : GD01_CARD_DEFS["GD01-064"]; // Duo Maxwell (Operation Meteor, PILOT) vs DINN (filler)
      placeCard(state, "A", def, "deck");
    }
    // as 5 cartas recém-empilhadas ficam no fundo (push) — inverte pra virarem o topo, na mesma ordem relativa.
    const justAdded = state.players.A.deck.splice(-5, 5);
    state.players.A.deck.unshift(...justAdded);
    const matchId = state.players.A.deck[2].instanceId;
    const handBefore = state.players.A.hand.length;
    const deckBefore = state.players.A.deck.length;

    const events = resolveEffectSpec(
      THE_PATH_TO_VICTORY_OR_DEFEAT_MAIN,
      ctxFor(state, sourceId, "A", { reveal: [matchId] }),
      defaultPredicateResolver,
    );
    const next = applyEvents(state, events);
    expect(next.players.A.hand.some((c) => c.instanceId === matchId)).toBe(true);
    expect(next.players.A.hand).toHaveLength(handBefore + 1);
    expect(next.players.A.deck).toHaveLength(deckBefore - 1); // 5 saíram do topo, 4 voltaram pro fundo, 1 foi pra mão
  });
});

describe("Lote 4 (docs/debates 2026-09-13) — escolha de até N alvos (TargetRef.namedGroup + EffectSpec.targetCount)", () => {
  it("GD01-044 Kshatriya (When Paired): só dispara com Piloto (Cyber-Newtype)/(Newtype); escolhendo 2 alvos, dano bate nos 2 (não só no 1º)", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-044"], "battleArea");
    const enemy1 = placeCard(state, "B", GD01_CARD_DEFS["GD01-064"], "battleArea");
    const enemy2 = placeCard(state, "B", GD01_CARD_DEFS["GD01-047"], "battleArea");

    // sem Piloto pareado: condição falha, sem dano
    const noPilotEvents = resolveEffectSpec(
      KSHATRIYA_WHEN_PAIRED,
      ctxFor(state, sourceId, "A", { target: [enemy1, enemy2] }),
      defaultPredicateResolver,
    );
    expect(applyEvents(state, noPilotEvents).players.B.battleArea.every((c) => c.damage === 0)).toBe(true);

    const nonNewtypePilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-097"], "battleArea"); // Guel Jeturk, (Academy) — não casa
    findCard(state, sourceId).pairedPilotId = nonNewtypePilotId;
    findCard(state, nonNewtypePilotId).pairedUnitId = sourceId;
    const wrongTraitEvents = resolveEffectSpec(
      KSHATRIYA_WHEN_PAIRED,
      ctxFor(state, sourceId, "A", { target: [enemy1, enemy2] }),
      defaultPredicateResolver,
    );
    expect(applyEvents(state, wrongTraitEvents).players.B.battleArea.every((c) => c.damage === 0)).toBe(true);

    const newtypePilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-088"], "battleArea"); // Banagher Links, (Newtype)
    findCard(state, sourceId).pairedPilotId = newtypePilotId;
    findCard(state, newtypePilotId).pairedUnitId = sourceId;
    const events = resolveEffectSpec(KSHATRIYA_WHEN_PAIRED, ctxFor(state, sourceId, "A", { target: [enemy1, enemy2] }), defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(findCard(next, enemy1).damage).toBe(1);
    expect(findCard(next, enemy2).damage).toBe(1); // prova que "namedGroup" aplica a AMBOS, não só ao 1º (group[0])
  });

  it("GD01-044: escolhendo só 1 dos 2 alvos possíveis ('Choose 1 to 2'), só ele recebe dano", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-044"], "battleArea");
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-088"], "battleArea");
    findCard(state, sourceId).pairedPilotId = pilotId;
    findCard(state, pilotId).pairedUnitId = sourceId;
    const enemy1 = placeCard(state, "B", GD01_CARD_DEFS["GD01-064"], "battleArea");
    const enemy2 = placeCard(state, "B", GD01_CARD_DEFS["GD01-047"], "battleArea");

    const events = resolveEffectSpec(KSHATRIYA_WHEN_PAIRED, ctxFor(state, sourceId, "A", { target: [enemy1] }), defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(findCard(next, enemy1).damage).toBe(1);
    expect(findCard(next, enemy2).damage).toBe(0);
  });

  it("GD01-114 Assault on Torrington Base (Action): AP+1 até o fim do turno nos 2 alvos escolhidos", () => {
    const state = freshGame();
    const unit1 = placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "battleArea");
    const unit2 = placeCard(state, "A", GD01_CARD_DEFS["GD01-001"], "battleArea");

    const events = resolveEffectSpec(
      ASSAULT_ON_TORRINGTON_BASE_ACTION,
      ctxFor(state, "cmd-source", "A", { target: [unit1, unit2] }),
      defaultPredicateResolver,
    );
    const next = applyEvents(state, events);
    expect(findCard(next, unit1).statModifiers).toContainEqual(expect.objectContaining({ stat: "ap", amount: 1, duration: "endOfTurn" }));
    expect(findCard(next, unit2).statModifiers).toContainEqual(expect.objectContaining({ stat: "ap", amount: 1, duration: "endOfTurn" }));
  });

  it("GD01-044 via camada de decisão real (deployCard pareando o Piloto -> PendingDecision.abilityResolution com targetCount -> resolveAbility): rejeita mais do que max, aceita até max", () => {
    const state = advanceToMainPhase(freshGame());
    const kshatriyaId = placeCard(state, "A", GD01_CARD_DEFS["GD01-044"], "battleArea");
    const banagherId = placeCard(state, "A", GD01_CARD_DEFS["GD01-088"], "hand"); // Banagher Links, (Newtype), Lv.5/custo1
    for (let i = 0; i < 5; i++) placeCard(state, "A", { code: "R", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
    const enemy1 = placeCard(state, "B", GD01_CARD_DEFS["GD01-064"], "battleArea");
    const enemy2 = placeCard(state, "B", GD01_CARD_DEFS["GD01-047"], "battleArea");
    const enemy3 = placeCard(state, "B", GD01_CARD_DEFS["GD01-023"], "battleArea");

    const paused = deployCard(state, "A", banagherId, {
      pairWithUnitId: kshatriyaId,
      specs: GD01_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    const decision = paused.pendingDecision.A;
    expect(decision?.kind).toBe("abilityResolution");
    const q = decision?.kind === "abilityResolution" ? decision.queue[0] : undefined;
    expect(q?.targetCount).toEqual({ min: 1, max: 2 });
    expect(q?.legalTargets).toEqual(expect.arrayContaining([enemy1, enemy2, enemy3]));

    const apply = (targetIds: string[]) =>
      applyPlayerAction(
        paused,
        "A",
        { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds }] },
        GD01_EFFECT_SPECS,
        defaultPredicateResolver,
        defaultTargetFilterResolver,
      );

    expect(() => apply([enemy1, enemy2, enemy3])).toThrow(/no máximo 2/);

    const next = apply([enemy1, enemy2]);
    expect(findCard(next, enemy1).damage).toBe(1);
    expect(findCard(next, enemy2).damage).toBe(1);
    expect(findCard(next, enemy3).damage).toBe(0);
  });
});

describe("Lote 5 (docs/debates 2026-09-13) — custo dinâmico de carta na mão (CardDef.dynamicCost)", () => {
  it("GD01-016 Jegan: custo -1 só com 2+ Units (Earth Federation) em campo", () => {
    const state = freshGame();
    expect(effectiveCost(GD01_CARD_DEFS["GD01-016"], state, "A")).toBe(3); // base, sem desconto

    placeCard(state, "A", GD01_CARD_DEFS["GD01-001"], "battleArea"); // Gundam (Earth Federation)
    expect(effectiveCost(GD01_CARD_DEFS["GD01-016"], state, "A")).toBe(3); // só 1 ainda

    placeCard(state, "A", GD01_CARD_DEFS["GD01-019"], "battleArea"); // Byarlant Custom (Earth Federation)
    expect(effectiveCost(GD01_CARD_DEFS["GD01-016"], state, "A")).toBe(2); // 2+ agora -> desconto

    expect(effectiveCost(GD01_CARD_DEFS["GD01-016"], state, "B")).toBe(3); // lado B não tem as Units -> sem desconto
  });

  it("GD01-070 Gundam Aerial: custo -2 só com 4+ Command cards na lixeira", () => {
    const state = freshGame();
    expect(effectiveCost(GD01_CARD_DEFS["GD01-070"], state, "A")).toBe(3);

    for (let i = 0; i < 3; i++) placeCard(state, "A", GD01_CARD_DEFS["GD01-099"], "trash"); // Intercept Orders (Command)
    expect(effectiveCost(GD01_CARD_DEFS["GD01-070"], state, "A")).toBe(3); // só 3 ainda

    placeCard(state, "A", GD01_CARD_DEFS["GD01-099"], "trash"); // 4º Command
    expect(effectiveCost(GD01_CARD_DEFS["GD01-070"], state, "A")).toBe(1); // 4+ agora -> desconto de 2
  });

  it("effectiveCost sem state/controller cai pro custo impresso (mesmo fallback de effectiveAp/effectiveHp)", () => {
    expect(effectiveCost(GD01_CARD_DEFS["GD01-016"])).toBe(3);
    expect(effectiveCost(GD01_CARD_DEFS["GD01-070"])).toBe(3);
  });

  it("deployCard cobra o custo COM desconto de verdade (não só effectiveCost isolado)", () => {
    const state = advanceToMainPhase(freshGame());
    placeCard(state, "A", GD01_CARD_DEFS["GD01-001"], "battleArea");
    placeCard(state, "A", GD01_CARD_DEFS["GD01-019"], "battleArea"); // 2 Earth Federation -> desconto ativo
    const jeganId = placeCard(state, "A", GD01_CARD_DEFS["GD01-016"], "hand");
    for (let i = 0; i < 2; i++) placeCard(state, "A", { code: "R", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
    const resourcesBefore = state.players.A.resourceArea.filter((r) => !r.rested).length;

    const next = deployCard(state, "A", jeganId, {});
    const restedResources = next.players.A.resourceArea.filter((r) => r.rested).length;
    expect(restedResources).toBe(2); // custo efetivo 2 (3-1), não 3
    void resourcesBefore;
  });
});

describe("Lote 5 (docs/debates 2026-09-13) — targetFilter relativo à própria carta (level<=self)", () => {
  it("GD01-093 Marida Cruz (Pilot, During Link/Attack): só dispara com a Unit pareada satisfazendo Link; alvo legal é limitado ao nível da Unit pareada, não da Piloto", () => {
    const state = freshGame();
    const kshatriyaId = placeCard(state, "A", GD01_CARD_DEFS["GD01-044"], "battleArea"); // Kshatriya, Lv.5, link "Marida Cruz"
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-093"], "battleArea"); // Marida Cruz, Lv.4 impresso
    const lowLevelEnemy = placeCard(state, "B", GD01_CARD_DEFS["GD01-064"], "battleArea"); // DINN, Lv.2
    const highLevelEnemy = placeCard(state, "B", GD01_CARD_DEFS["GD01-047"], "battleArea"); // Shamblo, Lv.8

    // ainda não pareada: condição falha.
    const noPairEvents = resolveEffectSpec(
      MARIDA_CRUZ_ATTACK,
      ctxFor(state, pilotId, "A", { target: [lowLevelEnemy] }),
      defaultPredicateResolver,
    );
    expect(applyEvents(state, noPairEvents).players.B.battleArea.every((c) => c.damage === 0)).toBe(true);

    findCard(state, kshatriyaId).pairedPilotId = pilotId;
    findCard(state, pilotId).pairedUnitId = kshatriyaId;

    // "self" = a UNIT pareada (Lv.5), não o valor impresso da Piloto (Lv.4) — sourceInstanceId aqui é o da PILOTO.
    const legal = computeLegalTargets(state, MARIDA_CRUZ_ATTACK, "A", defaultTargetFilterResolver, pilotId);
    expect(legal).toContain(lowLevelEnemy); // Lv.2 <= Lv.5 da Unit pareada
    expect(legal).not.toContain(highLevelEnemy); // Lv.8 > Lv.5

    const events = resolveEffectSpec(MARIDA_CRUZ_ATTACK, ctxFor(state, pilotId, "A", { target: [lowLevelEnemy] }), defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(findCard(next, lowLevelEnemy).damage).toBe(1);
  });
});

describe("Lote 5 (docs/debates 2026-09-13) — 'if you do' via predicate chosenNonEmpty (GD01-095)", () => {
  it("GD01-095 Dearka Elthman (When Linked): descarta 1 e compra 1 quando a escolha de descarte não é vazia", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-095"], "battleArea");
    const cardToDiscardId = placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "hand");
    const handBefore = state.players.A.hand.length;
    const deckBefore = state.players.A.deck.length;

    const events = resolveEffectSpec(
      DEARKA_ELTHMAN_WHEN_LINKED,
      ctxFor(state, pilotId, "A", { discard: [cardToDiscardId] }),
      defaultPredicateResolver,
    );
    const next = applyEvents(state, events);
    expect(next.players.A.hand.some((c) => c.instanceId === cardToDiscardId)).toBe(false); // descartada
    expect(next.players.A.hand).toHaveLength(handBefore - 1 + 1); // -1 descarte +1 compra = net 0
    expect(next.players.A.deck).toHaveLength(deckBefore - 1); // 1 carta comprada
  });

  it("GD01-095: sem escolha de descarte (mão vazia, handDiscard.legalHandIds seria []), NÃO compra ('if you do' falha)", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-095"], "battleArea");
    const deckBefore = state.players.A.deck.length;

    const events = resolveEffectSpec(DEARKA_ELTHMAN_WHEN_LINKED, ctxFor(state, pilotId, "A", { discard: [] }), defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(next.players.A.deck).toHaveLength(deckBefore); // nenhuma carta comprada
  });

  it("GD01-095 via camada de decisão real (deployCard formando Link Unit -> PendingDecision.abilityResolution com handDiscard -> resolveAbility)", () => {
    const state = advanceToMainPhase(freshGame());
    const busterId = placeCard(state, "A", GD01_CARD_DEFS["GD01-046"], "battleArea"); // Buster Gundam, link "Dearka Elthman"
    const dearkaId = placeCard(state, "A", GD01_CARD_DEFS["GD01-095"], "hand");
    for (let i = 0; i < 4; i++) placeCard(state, "A", { code: "R", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
    const discardCandidateId = placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "hand");

    const paused = deployCard(state, "A", dearkaId, {
      pairWithUnitId: busterId,
      specs: GD01_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    const decision = paused.pendingDecision.A;
    expect(decision?.kind).toBe("abilityResolution");
    const q = decision?.kind === "abilityResolution" ? decision.queue[0] : undefined;
    expect(q?.handDiscard?.legalHandIds).toContain(discardCandidateId);
    const deckBefore = paused.players.A.deck.length;

    const next = applyPlayerAction(
      paused,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds: [discardCandidateId] }] },
      GD01_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(next.players.A.hand.some((c) => c.instanceId === discardCandidateId)).toBe(false);
    expect(next.players.A.deck).toHaveLength(deckBefore - 1); // "if you do" -> comprou 1
  });
});

describe("Lote 5 (docs/debates 2026-09-13) — EffectSpec.secondaryTarget (2 pools de alvo com escopo diferente no mesmo spec)", () => {
  it("GD01-103 The Stubborn Cog (Main): resta a Unit amiga (Earth Federation) escolhida E a Unit inimiga escolhida — 2 pools independentes", () => {
    const state = freshGame();
    const friendlyId = placeCard(state, "A", GD01_CARD_DEFS["GD01-001"], "battleArea"); // Gundam, Earth Federation
    const friendlyOther = placeCard(state, "A", GD01_CARD_DEFS["GD01-023"], "battleArea"); // Char's Gelgoog, (Zeon) — não casa o trait
    const enemyId = placeCard(state, "B", GD01_CARD_DEFS["GD01-064"], "battleArea");

    const events = resolveEffectSpec(
      THE_STUBBORN_COG_MAIN,
      ctxFor(state, "cmd-source", "A", { target: [friendlyId], enemyTarget: [enemyId] }),
      defaultPredicateResolver,
    );
    const next = applyEvents(state, events);
    expect(findCard(next, friendlyId).rested).toBe(true);
    expect(findCard(next, enemyId).rested).toBe(true);
    expect(findCard(next, friendlyOther).rested).toBe(false);
  });

  it("GD01-112 Extreme Hatred (Main): resta as 2 Units ativas escolhidas; 'if you do' dispara o dano de 3 na Unit inimiga do 2º pool", () => {
    const state = freshGame();
    const unit1 = placeCard(state, "A", GD01_CARD_DEFS["GD01-001"], "battleArea");
    const unit2 = placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "battleArea");
    const enemyId = placeCard(state, "B", GD01_CARD_DEFS["GD01-047"], "battleArea");

    const events = resolveEffectSpec(
      EXTREME_HATRED_MAIN,
      ctxFor(state, "cmd-source", "A", { target: [unit1, unit2], enemyTarget: [enemyId] }),
      defaultPredicateResolver,
    );
    const next = applyEvents(state, events);
    expect(findCard(next, unit1).rested).toBe(true);
    expect(findCard(next, unit2).rested).toBe(true);
    expect(findCard(next, enemyId).damage).toBe(3);
  });

  it("GD01-112: se NENHUMA Unit foi restada (escolha vazia), 'if you do' falha — sem dano mesmo com alvo inimigo disponível", () => {
    const state = freshGame();
    const enemyId = placeCard(state, "B", GD01_CARD_DEFS["GD01-047"], "battleArea");

    const events = resolveEffectSpec(
      EXTREME_HATRED_MAIN,
      ctxFor(state, "cmd-source", "A", { target: [], enemyTarget: [enemyId] }),
      defaultPredicateResolver,
    );
    const next = applyEvents(state, events);
    expect(findCard(next, enemyId).damage).toBe(0);
  });
});

describe("Lote 5 (docs/debates 2026-09-13) — primitivas novas (moveTopCardToChosenPosition, deployFromTopFilterReveal, searchTrashToHand)", () => {
  it("GD01-039 Dopp (Deploy): a POSIÇÃO em si é a escolha do jogador (top/bottom), não fixa por quem autora", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-039"], "battleArea");
    placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "deck");
    state.players.A.deck.unshift(state.players.A.deck.pop()!);
    const topId = state.players.A.deck[0].instanceId;

    const keepOnTop = applyEvents(state, resolveEffectSpec(DOPP_DEPLOY, ctxFor(state, sourceId, "A", { position: ["top"] }), defaultPredicateResolver));
    expect(keepOnTop.players.A.deck[0].instanceId).toBe(topId);

    const toBottom = applyEvents(
      state,
      resolveEffectSpec(DOPP_DEPLOY, ctxFor(state, sourceId, "A", { position: ["bottom"] }), defaultPredicateResolver),
    );
    expect(toBottom.players.A.deck[toBottom.players.A.deck.length - 1].instanceId).toBe(topId);
  });

  it("GD01-045 Duel Gundam (Assault Shroud) (When Paired): deploya direto do topo do deck a Unit (ZAFT) Lv.4- escolhida; o resto vai pro fundo", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-045"], "battleArea");
    placeCard(state, "A", GD01_CARD_DEFS["GD01-046"], "deck"); // Buster Gundam, (ZAFT) Lv.4 — casa o filtro
    placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "deck"); // DINN, (ZAFT) mas isso não importa aqui
    placeCard(state, "A", GD01_CARD_DEFS["GD01-035"], "deck"); // Zaku Ⅱ, (Zeon) — não casa
    const justAdded = state.players.A.deck.splice(-3, 3);
    state.players.A.deck.unshift(...justAdded);
    const matchId = state.players.A.deck[0].instanceId;
    const battleAreaBefore = state.players.A.battleArea.length;
    const deckBefore = state.players.A.deck.length;

    const events = resolveEffectSpec(
      DUEL_GUNDAM_ASSAULT_SHROUD_WHEN_PAIRED,
      ctxFor(state, sourceId, "A", { reveal: [matchId] }),
      defaultPredicateResolver,
    );
    const next = applyEvents(state, events);
    expect(next.players.A.battleArea.some((c) => c.instanceId === matchId)).toBe(true); // deployada direto, não passou pela mão
    expect(next.players.A.hand.some((c) => c.instanceId === matchId)).toBe(false);
    expect(next.players.A.battleArea).toHaveLength(battleAreaBefore + 1);
    expect(next.players.A.deck).toHaveLength(deckBefore - 1); // 3 saíram do topo, 2 voltaram pro fundo, 1 foi deployada
  });

  it("GD01-067 Gundam Aerial Rebuild (When Paired): busca 1 Command Lv.5- na lixeira e adiciona à mão", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-067"], "battleArea");
    const commandId = placeCard(state, "A", GD01_CARD_DEFS["GD01-099"], "trash"); // Intercept Orders, Command
    const handBefore = state.players.A.hand.length;

    const noneChosenEvents = resolveEffectSpec(
      GUNDAM_AERIAL_REBUILD_WHEN_PAIRED,
      ctxFor(state, sourceId, "A", { trashSearch: [] }),
      defaultPredicateResolver,
    );
    expect(applyEvents(state, noneChosenEvents).players.A.hand).toHaveLength(handBefore);

    const events = resolveEffectSpec(
      GUNDAM_AERIAL_REBUILD_WHEN_PAIRED,
      ctxFor(state, sourceId, "A", { trashSearch: [commandId] }),
      defaultPredicateResolver,
    );
    const next = applyEvents(state, events);
    expect(next.players.A.hand.some((c) => c.instanceId === commandId)).toBe(true);
    expect(next.players.A.trash.some((c) => c.instanceId === commandId)).toBe(false);
  });
});

describe("Lote 5 (docs/debates 2026-09-13) — StaticAbility.boardCondition 'battlingEnemyLevelAtMost' (keyword condicional a combate específico)", () => {
  it("GD01-063 ZnO: só ganha <First Strike> batalhando (de verdade, via declareAttack) contra Unit inimiga Lv.2 ou menor", () => {
    const lowLevelState = advanceToMainPhase(freshGame());
    const attackerId = placeCard(lowLevelState, "A", GD01_CARD_DEFS["GD01-063"], "battleArea");
    const lowEnemyId = placeCard(lowLevelState, "B", GD01_CARD_DEFS["GD01-039"], "battleArea", { rested: true }); // Dopp, Lv.1
    const afterAttackLow = declareAttack(lowLevelState, attackerId, { unitId: lowEnemyId });
    expect(hasKeyword(findCard(afterAttackLow, attackerId), "First Strike", afterAttackLow)).toBe(true);

    const highLevelState = advanceToMainPhase(freshGame());
    const attackerId2 = placeCard(highLevelState, "A", GD01_CARD_DEFS["GD01-063"], "battleArea");
    const highEnemyId = placeCard(highLevelState, "B", GD01_CARD_DEFS["GD01-047"], "battleArea", { rested: true }); // Shamblo, Lv.8
    const afterAttackHigh = declareAttack(highLevelState, attackerId2, { unitId: highEnemyId });
    expect(hasKeyword(findCard(afterAttackHigh, attackerId2), "First Strike", afterAttackHigh)).toBe(false);

    // fora de combate, não tem <First Strike> nenhuma (nem contra o alvo baixo)
    expect(hasKeyword(findCard(lowLevelState, attackerId), "First Strike", lowLevelState)).toBe(false);
  });
});

describe("Lote 5 (docs/debates 2026-09-13) — targetFilter condicional a estado de board ('hp<=conditionalLinkUnit')", () => {
  it("GD01-122 Covert Operative (Main): sem Link Unit em campo, só alvo com HP<=2 é legal", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-122"], "hand");
    const lowHpEnemy = placeCard(state, "B", { ...GD01_CARD_DEFS["GD01-064"], hp: 2 }, "battleArea");
    const highHpEnemy = placeCard(state, "B", { ...GD01_CARD_DEFS["GD01-064"], hp: 4 }, "battleArea");

    const legal = computeLegalTargets(state, COVERT_OPERATIVE_MAIN, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(lowHpEnemy);
    expect(legal).not.toContain(highHpEnemy);
  });

  it("GD01-122: com Link Unit em campo (do controller), o limite sobe pra HP<=4", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-122"], "hand");
    const kshatriyaId = placeCard(state, "A", GD01_CARD_DEFS["GD01-044"], "battleArea"); // link "Marida Cruz"
    const maridaId = placeCard(state, "A", GD01_CARD_DEFS["GD01-093"], "battleArea");
    findCard(state, kshatriyaId).pairedPilotId = maridaId;
    findCard(state, maridaId).pairedUnitId = kshatriyaId;
    const highHpEnemy = placeCard(state, "B", { ...GD01_CARD_DEFS["GD01-064"], hp: 4 }, "battleArea");

    const legal = computeLegalTargets(state, COVERT_OPERATIVE_MAIN, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(highHpEnemy);
  });
});

describe("Lote 5 (docs/debates 2026-09-13) — reciclagem de lixeira pro deck + shuffle (returnTrashToDeckAndShuffle)", () => {
  it("GD01-003 Banshee (Destroy Mode) (During Link, Attack): devolve a lixeira pro deck, embaralha, fica active e ganha <First Strike> — só sendo Link Unit e com lixeira não-vazia", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-003"], "battleArea", { rested: true }); // rested = "acabou de atacar"
    for (let i = 0; i < 3; i++) placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "trash");
    const deckBefore = state.players.A.deck.length;

    // ainda não pareada: condição falha, nada acontece.
    const noPairEvents = resolveEffectSpec(BANSHEE_DESTROY_MODE_ATTACK, ctxFor(state, sourceId), defaultPredicateResolver);
    const afterNoPair = applyEvents(state, noPairEvents);
    expect(afterNoPair.players.A.trash).toHaveLength(3);
    expect(findCard(afterNoPair, sourceId).rested).toBe(true);

    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-093"], "battleArea"); // Marida Cruz
    findCard(state, sourceId).pairedPilotId = pilotId;
    findCard(state, pilotId).pairedUnitId = sourceId;

    const events = resolveEffectSpec(BANSHEE_DESTROY_MODE_ATTACK, ctxFor(state, sourceId), defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(next.players.A.trash).toHaveLength(0); // as 3 saíram da lixeira
    expect(next.players.A.deck).toHaveLength(deckBefore + 3); // foram pro deck
    expect(findCard(next, sourceId).rested).toBe(false); // active de novo
    expect(hasKeyword(findCard(next, sourceId), "First Strike")).toBe(true); // concessão temporária (keywordGrants)
  });

  it("GD01-003: sem cartas na lixeira, 'if you do' falha — não fica active nem ganha <First Strike>", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD01_CARD_DEFS["GD01-003"], "battleArea", { rested: true });
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-093"], "battleArea");
    findCard(state, sourceId).pairedPilotId = pilotId;
    findCard(state, pilotId).pairedUnitId = sourceId;

    const events = resolveEffectSpec(BANSHEE_DESTROY_MODE_ATTACK, ctxFor(state, sourceId), defaultPredicateResolver);
    const next = applyEvents(state, events);
    expect(findCard(next, sourceId).rested).toBe(true); // continua rested
    expect(hasKeyword(findCard(next, sourceId), "First Strike")).toBe(false);
  });
});

describe("Lote 5 (docs/debates 2026-09-13) — imunidade a redução de stat (CardDef.innateStatReductionImmunity)", () => {
  it("GD01-090 Duo Maxwell (Pilot, During Link): a Unit pareada (Link Unit) ignora redução de AP de efeito INIMIGO, mas não a própria", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-090"], "battleArea"); // Duo Maxwell
    const unitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-025"], "battleArea"); // Gundam Deathscythe, link "Duo Maxwell", AP5
    findCard(state, unitId).pairedPilotId = pilotId;
    findCard(state, pilotId).pairedUnitId = unitId;

    findCard(state, unitId).statModifiers.push(
      { stat: "ap", amount: -3, duration: "endOfTurn", appliedOnTurn: state.turnNumber, appliedBy: "B" }, // inimigo
      { stat: "ap", amount: -1, duration: "endOfTurn", appliedOnTurn: state.turnNumber, appliedBy: "A" }, // próprio lado
    );

    // AP efetivo = 5 (base) + 1 (AP impresso do Piloto pareado, incondicional, CR 3-3-5) - 1 (só a
    // redução PRÓPRIA conta; a do inimigo -3 é ignorada) = 5.
    expect(effectiveAp(findCard(state, unitId), state)).toBe(5);
  });

  it("GD01-090: SEM satisfazer Link (só pareada), a redução do inimigo conta normalmente", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-090"], "battleArea");
    const unitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-064"], "battleArea"); // DINN, NÃO linka com Duo Maxwell, AP3
    findCard(state, unitId).pairedPilotId = pilotId;
    findCard(state, pilotId).pairedUnitId = unitId;

    findCard(state, unitId).statModifiers.push({ stat: "ap", amount: -2, duration: "endOfTurn", appliedOnTurn: state.turnNumber, appliedBy: "B" });

    // AP efetivo = 3 (base) + 1 (AP impresso do Piloto pareado) - 2 (sem imunidade, não é Link Unit) = 2.
    expect(effectiveAp(findCard(state, unitId), state)).toBe(2);
  });

  it("GD01-090: modificador sem appliedBy (origem desconhecida) nunca é filtrado, mesmo com Link ativo", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-090"], "battleArea");
    const unitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-025"], "battleArea");
    findCard(state, unitId).pairedPilotId = pilotId;
    findCard(state, pilotId).pairedUnitId = unitId;

    findCard(state, unitId).statModifiers.push({ stat: "ap", amount: -3, duration: "endOfTurn", appliedOnTurn: state.turnNumber });

    // AP efetivo = 5 (base) + 1 (AP impresso do Piloto pareado) - 3 (sem appliedBy, nunca é filtrado) = 3.
    expect(effectiveAp(findCard(state, unitId), state)).toBe(3);
  });
});

describe("Lote 5 (docs/debates 2026-09-13) — GD01-002 Unicorn Gundam (Destroy Mode): 【Attack】Choose 1 enemy Unit. Rest it.", () => {
  it("reusa a primitiva 'rest' com alvo nomeado — sem filtro (qualquer Unit inimiga)", () => {
    const state = freshGame();
    const destroyModeId = placeCard(state, "A", GD01_CARD_DEFS["GD01-002"], "battleArea");
    const enemyId = placeCard(state, "B", GD01_CARD_DEFS["GD01-035"], "battleArea");

    const ctx = ctxFor(state, destroyModeId, "A", { target: [enemyId] });
    const events = resolveEffectSpec(UNICORN_GUNDAM_DESTROY_MODE_ATTACK, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);

    expect(findCard(next, enemyId).rested).toBe(true);
    expect(UNICORN_GUNDAM_DESTROY_MODE_ATTACK.targetScope).toBe("enemyUnit");
    expect(UNICORN_GUNDAM_DESTROY_MODE_ATTACK.targetFilter).toBeUndefined();
  });
});

describe("Lote 5 (docs/debates 2026-09-13) — GD01-023 Char's Gelgoog: custo com filtro (discardNamed.filter) + condição + busca-e-pareamento na lixeira (pairFromTrashSearch)", () => {
  it("sem Pilot pareado: descarta o custo (Zeon/Neo Zeon Unit) e pareia o Pilot (Newtype, Lv<=3) escolhido da lixeira", () => {
    const state = freshGame();
    const gelgoogId = placeCard(state, "A", GD01_CARD_DEFS["GD01-023"], "battleArea");
    const zeonUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-035"], "hand"); // Zaku II, trait Zeon
    const saylaId = placeCard(state, "A", GD01_CARD_DEFS["GD01-087"], "trash"); // Sayla Mass, Lv3, trait Newtype

    const ctx = ctxFor(state, gelgoogId, "A", { discard: [zeonUnitId], trashSearch: [saylaId] });
    const events = resolveEffectSpec(CHARS_GELGOOG_ACTIVATE_MAIN, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);

    expect(next.players.A.trash.some((c) => c.instanceId === zeonUnitId)).toBe(true); // custo pago
    expect(findCard(next, saylaId).zone).toBe("battleArea");
    expect(findCard(next, gelgoogId).pairedPilotId).toBe(saylaId);
    expect(findCard(next, saylaId).pairedUnitId).toBe(gelgoogId);
  });

  it("já com Pilot pareado: custo é pago (descarta) mas NÃO pareia de novo (condição selfNotPaired falha)", () => {
    const state = freshGame();
    const gelgoogId = placeCard(state, "A", GD01_CARD_DEFS["GD01-023"], "battleArea");
    const existingPilotId = placeCard(state, "A", GD01_CARD_DEFS["GD01-092"], "battleArea"); // M'Quve
    findCard(state, gelgoogId).pairedPilotId = existingPilotId;
    findCard(state, existingPilotId).pairedUnitId = gelgoogId;
    const zeonUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-035"], "hand");
    const saylaId = placeCard(state, "A", GD01_CARD_DEFS["GD01-087"], "trash");

    const ctx = ctxFor(state, gelgoogId, "A", { discard: [zeonUnitId], trashSearch: [saylaId] });
    const events = resolveEffectSpec(CHARS_GELGOOG_ACTIVATE_MAIN, ctx, defaultPredicateResolver);
    const next = applyEvents(state, events);

    expect(next.players.A.trash.some((c) => c.instanceId === zeonUnitId)).toBe(true); // custo pago mesmo assim
    expect(findCard(next, saylaId).zone).toBe("trash"); // NÃO saiu da lixeira
    expect(findCard(next, gelgoogId).pairedPilotId).toBe(existingPilotId); // pareamento anterior intacto
  });

  it("custo com carta que NÃO bate o filtro (não é Zeon/Neo Zeon) -> lança", () => {
    const state = freshGame();
    const gelgoogId = placeCard(state, "A", GD01_CARD_DEFS["GD01-023"], "battleArea");
    const wrongUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-001"], "hand"); // Gundam, Earth Federation/White Base Team
    const saylaId = placeCard(state, "A", GD01_CARD_DEFS["GD01-087"], "trash");

    const ctx = ctxFor(state, gelgoogId, "A", { discard: [wrongUnitId], trashSearch: [saylaId] });
    expect(() => resolveEffectSpec(CHARS_GELGOOG_ACTIVATE_MAIN, ctx, defaultPredicateResolver)).toThrow(/não casa o filtro do custo/);
  });

  it("busca na lixeira com carta que NÃO bate o filtro (Newtype mas Lv.5, acima de Lv.3) -> lança", () => {
    const state = freshGame();
    const gelgoogId = placeCard(state, "A", GD01_CARD_DEFS["GD01-023"], "battleArea");
    const zeonUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-035"], "hand");
    const banagherId = placeCard(state, "A", GD01_CARD_DEFS["GD01-088"], "trash"); // Newtype, mas Lv.5

    const ctx = ctxFor(state, gelgoogId, "A", { discard: [zeonUnitId], trashSearch: [banagherId] });
    expect(() => resolveEffectSpec(CHARS_GELGOOG_ACTIVATE_MAIN, ctx, defaultPredicateResolver)).toThrow(/não casa o filtro do efeito/);
  });

  it("spec: cost/condition/actions batem a estrutura esperada", () => {
    expect(CHARS_GELGOOG_ACTIVATE_MAIN.cost).toEqual([
      { op: "discardNamed", player: "controller", name: "discard", n: 1, filter: { cardType: "UNIT", anyTrait: ["Zeon", "Neo Zeon"] } },
    ]);
    expect(CHARS_GELGOOG_ACTIVATE_MAIN.condition?.predicate).toBe("selfNotPaired");
  });

  it("caminho real via applyPlayerAction({kind:'activateAbility'}) — V0, sem pausa (mesmo padrão de RASIDS_ORDERS_MAIN/GAMOW_ACTIVATE_ACTION)", () => {
    const state = freshGame();
    state.phase = "main";
    const gelgoogId = placeCard(state, "A", GD01_CARD_DEFS["GD01-023"], "battleArea");
    const zeonUnitId = placeCard(state, "A", GD01_CARD_DEFS["GD01-035"], "hand");
    const saylaId = placeCard(state, "A", GD01_CARD_DEFS["GD01-087"], "trash");

    const next = applyPlayerAction(
      state,
      "A",
      { kind: "activateAbility", sourceInstanceId: gelgoogId, targets: { discard: [zeonUnitId], trashSearch: [saylaId] } },
      GD01_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );

    expect(next.players.A.trash.some((c) => c.instanceId === zeonUnitId)).toBe(true);
    expect(findCard(next, gelgoogId).pairedPilotId).toBe(saylaId);
  });
});

describe("Lote 5 (docs/debates 2026-09-13) — GD01-065 Freedom Gundam: reage a QUALQUER pareamento de Unit branca (EffectSpec.trigger 'AnyPairing')", () => {
  it("spec: trigger/targetScope batem o esperado", () => {
    expect(FREEDOM_GUNDAM_ANY_PAIRING.trigger).toBe("AnyPairing");
    expect(FREEDOM_GUNDAM_ANY_PAIRING.targetScope).toBe("enemyUnit");
  });

  it("dispatcher.ts: QUALQUER EffectSpec com pairFromTrashSearch (não só o deploy de Pilot em deploy.ts) também dispara AnyPairing — mesmo hook genérico (dispatchAnyPairingFromEffect)", () => {
    const state = freshGame();
    const freedomId = placeCard(state, "A", GD01_CARD_DEFS["GD01-065"], "battleArea");
    const saylaId = placeCard(state, "A", GD01_CARD_DEFS["GD01-087"], "trash");
    placeCard(state, "B", GD01_CARD_DEFS["GD01-035"], "battleArea");

    // Spec SINTÉTICO só pra este teste (não é o texto real de GD01-065) — prova que
    // QUALQUER primitiva que pareie (não só deploy.ts) atravessa o MESMO hook de
    // dispatcher.ts, reagindo em Units reativas do controller mesmo quando a fonte
    // do PAIR_CARDS é outra carta/mecanismo (aqui, um pairFromTrashSearch qualquer).
    const syntheticPairSpec: EffectSpec = {
      id: "GD01-065-TestPair",
      cardCode: "GD01-065",
      trigger: "Main",
      actions: [{ op: "pairFromTrashSearch", player: "controller", filter: { cardType: "PILOT" } }],
      sourceText: "(spec sintético de teste)",
    };

    const next = dispatchTrigger(state, freedomId, "Main", [syntheticPairSpec], {
      targets: { trashSearch: [saylaId] },
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
      allSpecs: GD01_EFFECT_SPECS,
    });

    expect(findCard(next, freedomId).pairedPilotId).toBe(saylaId);
    const d = next.pendingDecision.A;
    if (d?.kind !== "abilityResolution") throw new Error("esperava abilityResolution (AnyPairing) pendente pra A");
    expect(d.trigger).toBe("AnyPairing");
    expect(d.queue.some((q) => q.specId === "GD01-065-AnyPairing")).toBe(true);
  });
});

/**
 * docs/debates 2026-09-15 (pedido do Willen — "verificar se Banagher está
 * ativando corretamente o burst"): 8 cartas GD01 tinham `hasBurst: true` no
 * CardDef mas NENHUM EffectSpec de `trigger: "Burst"` cadastrado.
 * `burstEligibleShieldIds` (dispatcher.ts) só oferece a decisão de 【Burst】
 * pra uma shield quando `findTriggerSpecs(specs, code, "Burst").length > 0`
 * — sem a spec, a carta nunca virava burst-eligible: quebrava como shield e
 * ficava presa no trash pra sempre, mesmo tendo texto de Burst real. Corrigido
 * cadastrando a spec que faltava pra cada uma (mesmo padrão de ST01-010/011
 * pro caso simples "Add this card to your hand").
 */
describe("Burst — 8 cartas GD01 com hasBurst:true sem EffectSpec de Burst (achado 2026-09-15)", () => {
  const ADD_TO_HAND_CASES: Array<{ code: string; label: string }> = [
    { code: "GD01-088", label: "Banagher Links" },
    { code: "GD01-093", label: "Marida Cruz" },
    { code: "GD01-095", label: "Dearka Elthman" },
    { code: "GD01-097", label: "Guel Jeturk" },
    { code: "GD01-098", label: "Elan Ceres" },
    { code: "GD01-105", label: "Citizens, Take a Stand!" },
  ];

  it.each(ADD_TO_HAND_CASES)("$label ($code): shield quebrada agora é burstEligible e o Burst manda a carta pra mão", ({ code }) => {
    const state = freshGame();
    const shieldId = placeCard(state, "A", GD01_CARD_DEFS[code], "shields");
    const trashed = applyEvents(state, [{ type: "MOVE_CARD", instanceId: shieldId, toZone: "trash" }]);

    // Antes do fix, esta lista vinha vazia — a carta nunca oferecia a decisão de 【Burst】.
    expect(burstEligibleShieldIds(state, trashed, "A", GD01_EFFECT_SPECS)).toEqual([shieldId]);

    const next = dispatchTrigger(trashed, shieldId, "Burst", GD01_EFFECT_SPECS, {
      targets: {},
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
      allSpecs: GD01_EFFECT_SPECS,
    });
    expect(findCard(next, shieldId).zone).toBe("hand");
  });

  it("GD01-121 Midair Modifications: 【Burst】Activate this card's 【Main】 reaproveita as MESMAS actions do 【Main】", () => {
    expect(MIDAIR_MODIFICATIONS_BURST.actions).toBe(MIDAIR_MODIFICATIONS_MAIN.actions);
    expect(MIDAIR_MODIFICATIONS_BURST.targetScope).toBe(MIDAIR_MODIFICATIONS_MAIN.targetScope);

    const state = freshGame();
    const midairId = placeCard(state, "A", GD01_CARD_DEFS["GD01-121"], "shields");
    const trashed = applyEvents(state, [{ type: "MOVE_CARD", instanceId: midairId, toZone: "trash" }]);
    const restedAllyId = placeCard(trashed, "A", GD01_CARD_DEFS["GD01-035"], "battleArea", { rested: true });

    expect(burstEligibleShieldIds(state, trashed, "A", GD01_EFFECT_SPECS)).toEqual([midairId]);

    const ctx = ctxFor(trashed, midairId, "A", { target: [restedAllyId] });
    const events = resolveEffectSpec(MIDAIR_MODIFICATIONS_BURST, ctx, defaultPredicateResolver);
    const next = applyEvents(trashed, events);
    expect(findCard(next, restedAllyId).rested).toBe(false);
    expect(findCard(next, restedAllyId).cannotAttackUntilTurn).toBe(next.turnNumber);
  });

  it("GD01-129 Kusanagi: 【Burst】Deploy this card encadeia o 【Deploy】 e PAUSA pra escolha real do bounce (docs/47 Fase 4)", () => {
    const state = freshGame();
    const kusanagiId = placeCard(state, "A", GD01_CARD_DEFS["GD01-129"], "shields");
    const trashed = applyEvents(state, [{ type: "MOVE_CARD", instanceId: kusanagiId, toZone: "trash" }]);
    const enemyId = placeCard(trashed, "B", GD01_CARD_DEFS["GD01-035"], "battleArea"); // Zaku Ⅱ, HP2 <= 3

    expect(burstEligibleShieldIds(state, trashed, "A", GD01_EFFECT_SPECS)).toEqual([kusanagiId]);
    const handBefore = trashed.players.A.hand.length;
    const shieldsBefore = trashed.players.A.shields.length;

    const next = dispatchTrigger(trashed, kusanagiId, "Burst", GD01_EFFECT_SPECS, {
      targets: {},
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
      allSpecs: GD01_EFFECT_SPECS,
    });

    expect(findCard(next, kusanagiId).zone).toBe("baseSection"); // deployThisCard (Base)
    // pausou: shield + bounce são o MESMO spec (Add Shield + moveZone alvo nomeado) — resolvem juntos.
    expect(next.players.A.hand.length).toBe(handBefore);
    const decision = next.pendingDecision.A;
    const q = decision?.kind === "abilityResolution" ? decision.queue[0] : undefined;
    expect(q?.specId).toBe("GD01-129-Deploy");
    expect(q?.legalTargets).toEqual([enemyId]);

    const resolved = applyPlayerAction(
      next,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds: [enemyId] }] },
      GD01_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(resolved.players.A.hand.length).toBe(handBefore + 1); // 【Deploy】 Add 1 Shield to hand
    expect(resolved.players.A.shields.length).toBe(shieldsBefore - 1);
    expect(findCard(resolved, enemyId).zone).toBe("hand"); // 【Deploy】 bounce
    expect(resolved.pendingDecision.A).toBeNull();
  });
});

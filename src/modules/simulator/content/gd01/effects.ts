import type { EffectSpec, PrimitiveCall } from "../../engine/effectSpec";
import type { CardDef } from "../../engine/types";
import { EX_RESOURCE_TOKEN } from "../../engine/setup";
import { TOKEN_ZAKU_II } from "../../fixtures/st03Deck";
import { mainAndAction, stdAddToHandBurst } from "../standardSpecs";

// GD01-066 Justice Gundam — token [Fatum-00] gerado pelo 【Deploy】.
export const TOKEN_FATUM_00: CardDef = {
  code: "T-011",
  nameEn: "Fatum-00",
  cardType: "UNIT",
  color: "white",
  ap: 2,
  hp: 2,
  traits: ["Triple Ship Alliance"],
  effectKeywords: ["Blocker"],
  keywordTags: ["Blocker"],
  isToken: true,
};

/**
 * Wave GD01 "Newtype Rising" (Fase 1 - Bootstrap & Ingestão).
 * 
 * Contém o catálogo completo das 130 cartas de GD01 (GD01_CARD_DEFS),
 * as EffectSpecs autoradas com as primitivas existentes no motor,
 * e encaminhamento de mecânicas não suportadas/ambíguas para deferred.ts.
 */

// =============================================================================
// EFFECT SPECS BESPOKE (SUPORTADAS POR PRIMITIVAS EXISTENTES)
// =============================================================================

// GD01-005 Unicorn Gundam (Unicorn Mode) — 【During Link】【Destroyed】Return this Unit's
// paired Pilot to its owner's hand. Then, discard 1. Lote 5 (docs/debates 2026-09-13):
// `duringLink` (gate por `DestroyedInBattle.wasLinkUnit`, capturado ANTES do
// `DESTROY_CARD`) + alvo implícito "formerPairedPilot" (`DestroyedInBattle.formerPairedPilotId`,
// injetado pelo dispatcher em `ctx.targets` sem escolha do jogador — o Pilot pode já ter
// ido pro trash via `pairedPilotFollowEvents`/CR 3-3-6, `moveZone` acha por instanceId em
// qualquer zona). "Then, discard 1" reaproveita `discardNamed` (mesmo padrão de ST04-002),
// cujos candidatos incluem o Pilot recém-devolvido (`discardCandidateHandIds`).
export const UNICORN_GUNDAM_UNICORN_MODE_DESTROYED: EffectSpec = {
  id: "GD01-005-Destroyed",
  cardCode: "GD01-005",
  trigger: "Destroyed",
  duringLink: true,
  actions: [
    { op: "moveZone", target: { kind: "named", name: "formerPairedPilot" }, toZone: "hand" },
    { op: "discardNamed", player: "controller", name: "discard", n: 1 },
  ],
  sourceText: "【During Link】【Destroyed】Return this Unit's paired Pilot to its owner's hand. Then, discard 1.",
};

// GD01-002 Unicorn Gundam (Destroy Mode) — 【Attack】Choose 1 enemy Unit. Rest it.
// (o deploy alternativo por sacrifício de Link Unit é validado em deployCard/deploy.ts
// via CardDef.alternateDeploySacrifice — não é um EffectSpec, é uma alternativa de custo.)
export const UNICORN_GUNDAM_DESTROY_MODE_ATTACK: EffectSpec = {
  id: "GD01-002-Attack",
  cardCode: "GD01-002",
  trigger: "Attack",
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  sourceText: "【Attack】Choose 1 enemy Unit. Rest it.",
};

// GD01-023 Char's Gelgoog — 【Activate･Main】Discard 1 (Zeon)/(Neo Zeon) Unit card：If a
// Pilot is not paired with this Unit, choose 1 (Newtype) Pilot card that is Lv.3 or lower
// from your trash. Pair it with this Unit. Lote 5 (docs/debates 2026-09-13): custo com
// filtro (discardNamed.filter, novo) + condição "selfNotPaired" (novo predicate) +
// pairFromTrashSearch (novo, mesmo padrão de searchTrashToHand mas pareia em vez de
// mandar pra mão). Ativado no caminho V0 de `activateAbility` (mesmo de RASIDS_ORDERS_MAIN/
// GAMOW_ACTIVATE_ACTION) — quem chama já resolve `targets.discard`/`targets.trashSearch`
// antes de ativar (sem pausa; validado de novo em compilePrimitive).
export const CHARS_GELGOOG_ACTIVATE_MAIN: EffectSpec = {
  id: "GD01-023-ActivateMain",
  cardCode: "GD01-023",
  trigger: "Activate·Main",
  cost: [{ op: "discardNamed", player: "controller", name: "discard", n: 1, filter: { cardType: "UNIT", anyTrait: ["Zeon", "Neo Zeon"] } }],
  condition: {
    predicate: "selfNotPaired",
    then: [{ op: "pairFromTrashSearch", player: "controller", filter: { cardType: "PILOT", anyTrait: ["Newtype"], maxLevel: 3 } }],
  },
  actions: [],
  sourceText:
    "【Activate･Main】Discard 1 (Zeon)/(Neo Zeon) Unit card：If a Pilot is not paired with this Unit, choose 1 (Newtype) Pilot card that is Lv.3 or lower from your trash. Pair it with this Unit.",
};

// GD01-065 Freedom Gundam — 【During Pair】【Once per Turn】When you pair a Pilot with this
// Unit or one of your white Units, choose 1 enemy Unit. It gets AP-2 during this turn.
// Lote 5 (docs/debates 2026-09-13): trigger novo "AnyPairing" — despachado por
// `dispatchAnyPairingFromEffect` (abilityDispatch.ts) sempre que um PAIR_CARDS real
// acontece (deploy.ts, ou qualquer EffectSpec com `pairFromTrashSearch`), não só quando
// A PRÓPRIA Freedom Gundam é pareada. `oncePerTurn`/`onAnyPairing` ficam na CardDef
// (unitsWhite.ts), não no EffectSpec — quem decide SE dispara é o motor, o EffectSpec só
// decide O QUE fazer quando dispara.
export const FREEDOM_GUNDAM_ANY_PAIRING: EffectSpec = {
  id: "GD01-065-AnyPairing",
  cardCode: "GD01-065",
  trigger: "AnyPairing",
  actions: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -2, duration: "endOfTurn" }],
  targetScope: "enemyUnit",
  sourceText: "【During Pair】【Once per Turn】When you pair a Pilot with this Unit or one of your white Units, choose 1 enemy Unit. It gets AP-2 during this turn.",
};

// GD01-004 Guncannon — 【When Paired】Choose 1 enemy Unit with 2 or less HP. Rest it.
export const GUNCANNON_WHEN_PAIRED: EffectSpec = {
  id: "GD01-004-WhenPaired",
  cardCode: "GD01-004",
  trigger: "When Paired",
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "hp<=2",
  sourceText: "【When Paired】Choose 1 enemy Unit with 2 or less HP. Rest it.",
};

// GD01-008 Guntank — 【Deploy】Choose 1 rested enemy Unit. Deal 1 damage to it.
export const GUNTANK_DEPLOY: EffectSpec = {
  id: "GD01-008-Deploy",
  cardCode: "GD01-008",
  trigger: "Deploy",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 }],
  targetScope: "enemyUnit",
  targetFilter: "rested",
  sourceText: "【Deploy】Choose 1 rested enemy Unit. Deal 1 damage to it.",
};

// GD01-010 Unicorn Gundam 02 Banshee (Unicorn Mode) — 【When Paired】Choose 1 enemy Unit with 3 or less HP. Rest it.
export const BANSHEE_UNICORN_WHEN_PAIRED: EffectSpec = {
  id: "GD01-010-WhenPaired",
  cardCode: "GD01-010",
  trigger: "When Paired",
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "hp<=3",
  sourceText: "【When Paired】Choose 1 enemy Unit with 3 or less HP. Rest it.",
};

// GD01-012 Zechs' Leo — 【When Paired】Choose 1 enemy Unit with 3 or less HP. Rest it.
export const ZECHS_LEO_WHEN_PAIRED: EffectSpec = {
  id: "GD01-012-WhenPaired",
  cardCode: "GD01-012",
  trigger: "When Paired",
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "hp<=3",
  sourceText: "【When Paired】Choose 1 enemy Unit with 3 or less HP. Rest it.",
};

// GD01-015 Ball — 【Attack】Choose 1 of your Units. It recovers 1 HP.
export const BALL_ATTACK: EffectSpec = {
  id: "GD01-015-Attack",
  cardCode: "GD01-015",
  trigger: "Attack",
  actions: [{ op: "heal", target: { kind: "named", name: "target" }, amount: 1 }],
  targetScope: "friendlyUnit",
  sourceText: "【Attack】Choose 1 of your Units. It recovers 1 HP.",
};

// GD01-074 Chuchu's Demi Trainer — 【Attack】Draw 1. Then, discard 1.
export const CHUCHUS_DEMI_TRAINER_ATTACK: EffectSpec = {
  id: "GD01-074-Attack",
  cardCode: "GD01-074",
  trigger: "Attack",
  actions: [
    { op: "draw", player: "controller", n: 1 },
    { op: "discardNamed", player: "controller", name: "discardTarget", n: 1 },
  ],
  sourceText: "【Attack】Draw 1. Then, discard 1.",
};

// GD01-078 Mistral — 【Deploy】Choose 1 enemy Unit. It gets AP-1 during this turn.
export const MISTRAL_DEPLOY: EffectSpec = {
  id: "GD01-078-Deploy",
  cardCode: "GD01-078",
  trigger: "Deploy",
  actions: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -1, duration: "endOfTurn" }],
  targetScope: "enemyUnit",
  sourceText: "【Deploy】Choose 1 enemy Unit. It gets AP-1 during this turn.",
};

// GD01-088 Banagher Links — 【Burst】Add this card to your hand. Achado
// 2026-09-15 (pedido do Willen "verificar se Banagher está ativando
// corretamente o burst"): `hasBurst: true` sozinho não basta —
// `burstEligibleShieldIds` (dispatcher.ts) só oferece a decisão de 【Burst】
// pra shields com um EffectSpec de trigger "Burst" cadastrado, mesmo quando
// o texto é só o básico "adicione à mão" (mesmo padrão de ST01-010/011).
// Faltava aqui — a Unit nunca virava burst-eligible, ficava presa no trash.
export const BANAGHER_LINKS_BURST: EffectSpec = {
  id: "GD01-088-Burst",
  cardCode: "GD01-088",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// GD01-088 Banagher Links — 【When Linked】Draw 1.
export const BANAGHER_LINKS_WHEN_LINKED: EffectSpec = {
  id: "GD01-088-WhenLinked",
  cardCode: "GD01-088",
  trigger: "When Linked",
  actions: [{ op: "draw", player: "controller", n: 1 }],
  sourceText: "【When Linked】Draw 1.",
};

// GD01-099 Intercept Orders — 【Burst】Choose 1 enemy Unit with 5 or less HP. Rest it.
export const INTERCEPT_ORDERS_BURST: EffectSpec = {
  id: "GD01-099-Burst",
  cardCode: "GD01-099",
  trigger: "Burst",
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "hp<=5",
  sourceText: "【Burst】Choose 1 enemy Unit with 5 or less HP. Rest it.",
};

// GD01-100 A Show of Resolve — 【Main】Draw 2.
export const A_SHOW_OF_RESOLVE_MAIN: EffectSpec = {
  id: "GD01-100-Main",
  cardCode: "GD01-100",
  trigger: "Main",
  actions: [{ op: "draw", player: "controller", n: 2 }],
  sourceText: "【Main】Draw 2.",
};

// GD01-104 Signs of a Revolution — 【Burst】Draw 1.
export const SIGNS_OF_A_REVOLUTION_BURST: EffectSpec = {
  id: "GD01-104-Burst",
  cardCode: "GD01-104",
  trigger: "Burst",
  actions: [{ op: "draw", player: "controller", n: 1 }],
  sourceText: "【Burst】Draw 1.",
};

// GD01-104 Signs of a Revolution — 【Main】Choose 1 rested enemy Unit. Deal 2 damage to it.
export const SIGNS_OF_A_REVOLUTION_MAIN: EffectSpec = {
  id: "GD01-104-Main",
  cardCode: "GD01-104",
  trigger: "Main",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 2 }],
  targetScope: "enemyUnit",
  targetFilter: "rested",
  sourceText: "【Main】Choose 1 rested enemy Unit. Deal 2 damage to it.",
};

// GD01-106 Fortress Defense — 【Main】Deploy 2 [Zaku Ⅱ]((Zeon)･AP1･HP1) Unit tokens.
export const FORTRESS_DEFENSE_MAIN: EffectSpec = {
  id: "GD01-106-Main",
  cardCode: "GD01-106",
  trigger: "Main",
  actions: [{ op: "spawnToken", def: TOKEN_ZAKU_II, player: "controller", zone: "battleArea", count: 2 }],
  sourceText: "【Main】Deploy 2 [Zaku Ⅱ]((Zeon)･AP1･HP1) Unit tokens.",
};

// GD01-107 First Contact — 【Burst】Place 1 EX Resource.
export const FIRST_CONTACT_BURST: EffectSpec = {
  id: "GD01-107-Burst",
  cardCode: "GD01-107",
  trigger: "Burst",
  actions: [{ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea" }],
  sourceText: "【Burst】Place 1 EX Resource.",
};

// GD01-107 First Contact — 【Main】Place 1 rested Resource.
export const FIRST_CONTACT_MAIN: EffectSpec = {
  id: "GD01-107-Main",
  cardCode: "GD01-107",
  trigger: "Main",
  actions: [{ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea", rested: true }],
  sourceText: "【Main】Place 1 rested Resource.",
};

// GD01-111 Battle of Aces — 【Burst】Choose 1 enemy Unit. Deal 2 damage to it.
export const BATTLE_OF_ACES_BURST: EffectSpec = {
  id: "GD01-111-Burst",
  cardCode: "GD01-111",
  trigger: "Burst",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 2 }],
  targetScope: "enemyUnit",
  sourceText: "【Burst】Choose 1 enemy Unit. Deal 2 damage to it.",
};

// GD01-115 Zeon Remnant Forces — 【Main】Choose 1 enemy Unit. Deal 1 damage to it.
export const ZEON_REMNANT_FORCES_MAIN: EffectSpec = {
  id: "GD01-115-Main",
  cardCode: "GD01-115",
  trigger: "Main",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 }],
  targetScope: "enemyUnit",
  sourceText: "【Main】/【Action】Choose 1 enemy Unit. Deal 1 damage to it.",
};

// GD01-118 Overflowing Affection — 【Main】Draw 2. Then, discard 1.
export const OVERFLOWING_AFFECTION_MAIN: EffectSpec = {
  id: "GD01-118-Main",
  cardCode: "GD01-118",
  trigger: "Main",
  actions: [
    { op: "draw", player: "controller", n: 2 },
    { op: "discardNamed", player: "controller", name: "discardTarget", n: 1 },
  ],
  sourceText: "【Main】Draw 2. Then, discard 1.",
};

// GD01-120 Naval Bombardment — 【Burst】Choose 1 enemy Unit. It gets AP-3 during this turn.
export const NAVAL_BOMBARDMENT_BURST: EffectSpec = {
  id: "GD01-120-Burst",
  cardCode: "GD01-120",
  trigger: "Burst",
  actions: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -3, duration: "endOfTurn" }],
  targetScope: "enemyUnit",
  sourceText: "【Burst】Choose 1 enemy Unit. It gets AP-3 during this turn.",
};

// GD01-121 Midair Modifications — 【Main】Choose 1 rested Unit with <Blocker>. Set it as active. It can't attack during this turn.
export const MIDAIR_MODIFICATIONS_MAIN: EffectSpec = {
  id: "GD01-121-Main",
  cardCode: "GD01-121",
  trigger: "Main",
  actions: [
    { op: "setActive", target: { kind: "named", name: "target" } },
    { op: "preventAttackThisTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  sourceText: "【Main】Choose 1 rested Unit with <Blocker>. Set it as active. It can't attack during this turn.",
};

// GD01-121 Midair Modifications — 【Burst】Activate this card's 【Main】. Mesmo
// achado 2026-09-15: faltava a spec de Burst (ver GD01-088); aqui reaproveita
// as MESMAS actions/targetScope do 【Main】 acima, igual ao padrão de
// ST01-014 Unforeseen Incident (Burst compartilha o array com Main/Action).
export const MIDAIR_MODIFICATIONS_BURST: EffectSpec = {
  id: "GD01-121-Burst",
  cardCode: "GD01-121",
  trigger: "Burst",
  actions: MIDAIR_MODIFICATIONS_MAIN.actions,
  targetScope: MIDAIR_MODIFICATIONS_MAIN.targetScope,
  sourceText: "【Burst】Activate this card's 【Main】.",
};

// GD01-124 Side 7 — 【Burst】Deploy this card.
export const SIDE_7_BURST: EffectSpec = {
  id: "GD01-124-Burst",
  cardCode: "GD01-124",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};

// GD01-124 Side 7 — 【Deploy】Add 1 of your Shields to your hand.
export const SIDE_7_DEPLOY: EffectSpec = {
  id: "GD01-124-Deploy",
  cardCode: "GD01-124",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// GD01-124 Side 7 — 【Activate･Main】Rest this Base：Choose 1 friendly Unit. It recovers 1 HP.
export const SIDE_7_ACTIVATE_MAIN: EffectSpec = {
  id: "GD01-124-ActivateMain",
  cardCode: "GD01-124",
  trigger: "Activate·Main",
  cost: [{ op: "rest", target: { kind: "self" } }],
  actions: [{ op: "heal", target: { kind: "named", name: "target" }, amount: 1 }],
  targetScope: "friendlyUnit",
  sourceText: "【Activate･Main】Rest this Base：Choose 1 friendly Unit. It recovers 1 HP.",
};

// GD01-126 Underground Desert Base — 【Burst】Deploy this card.
export const UNDERGROUND_DESERT_BASE_BURST: EffectSpec = {
  id: "GD01-126-Burst",
  cardCode: "GD01-126",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};

// GD01-126 Underground Desert Base — 【Deploy】Add 1 of your Shields to your hand.
export const UNDERGROUND_DESERT_BASE_DEPLOY: EffectSpec = {
  id: "GD01-126-Deploy",
  cardCode: "GD01-126",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// GD01-128 Mining Asteroid Palau — 【Burst】Deploy this card.
export const MINING_ASTEROID_PALAU_BURST: EffectSpec = {
  id: "GD01-128-Burst",
  cardCode: "GD01-128",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};

// GD01-128 Mining Asteroid Palau — 【Deploy】Add 1 of your Shields to your hand.
export const MINING_ASTEROID_PALAU_DEPLOY: EffectSpec = {
  id: "GD01-128-Deploy",
  cardCode: "GD01-128",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// GD01-001 Gundam — 【When Paired】If you have 2 or more other Units in play, draw 1.
// (a outra cláusula do texto oficial, "All your (White Base Team) Units gain
// <Repair 1>", segue deferida em deferred.ts — aura de concessão de keyword
// em grupo, fora do escopo desta resolução.)
export const GUNDAM_WHEN_PAIRED: EffectSpec = {
  id: "GD01-001-WhenPaired",
  cardCode: "GD01-001",
  trigger: "When Paired",
  condition: { predicate: "controllerOtherUnitCountAtLeast:2", then: [{ op: "draw", player: "controller", n: 1 }] },
  actions: [],
  sourceText: "【When Paired】If you have 2 or more other Units in play, draw 1.",
};

// GD01-038 Adzam — 【Deploy】If 5 or more enemy Units are in play, deal 1 damage to all enemy Units.
export const ADZAM_DEPLOY: EffectSpec = {
  id: "GD01-038-Deploy",
  cardCode: "GD01-038",
  trigger: "Deploy",
  condition: {
    predicate: "enemyUnitCountAtLeast:5",
    then: [{ op: "damageUnit", target: { kind: "group", group: { kind: "allEnemyUnits" } }, amount: 1 }],
  },
  actions: [],
  sourceText: "【Deploy】If 5 or more enemy Units are in play, deal 1 damage to all enemy Units.",
};

// GD01-049 Blitz Gundam — 【Deploy】Choose 1 of your (ZAFT) Units with 5 or more AP. It gains <First Strike> during this turn.
export const BLITZ_GUNDAM_DEPLOY: EffectSpec = {
  id: "GD01-049-Deploy",
  cardCode: "GD01-049",
  trigger: "Deploy",
  actions: [{ op: "grantKeyword", target: { kind: "named", name: "target" }, keyword: "First Strike", duration: "endOfTurn" }],
  targetScope: "friendlyUnit",
  targetFilter: "trait:ZAFT;ap>=5",
  sourceText: "【Deploy】Choose 1 of your (ZAFT) Units with 5 or more AP. It gains <First Strike> during this turn.",
};

// GD01-052 Geara Zulu (Guards Type) — 【Deploy】Choose 1 enemy Unit. Deal 1 damage to it.
export const GEARA_ZULU_DEPLOY: EffectSpec = {
  id: "GD01-052-Deploy",
  cardCode: "GD01-052",
  trigger: "Deploy",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 }],
  targetScope: "enemyUnit",
  sourceText: "【Deploy】Choose 1 enemy Unit. Deal 1 damage to it.",
};

// GD01-053 Geara Doga (Heavy Armed Type) — 【Activate･Main】【Once per Turn】①：Choose 1 enemy Unit with 2 or less AP. Deal 1 damage to it.
export const GEARA_DOGA_HEAVY_ARMED_ACTIVATE_MAIN: EffectSpec = {
  id: "GD01-053-ActivateMain",
  cardCode: "GD01-053",
  trigger: "Activate·Main",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 }],
  targetScope: "enemyUnit",
  targetFilter: "ap<=2",
  sourceText: "【Activate･Main】【Once per Turn】①：Choose 1 enemy Unit with 2 or less AP. Deal 1 damage to it.",
};

// GD01-056 Geara Doga (Sleeves) — 【Destroyed】Choose 1 enemy Unit with 5 or less AP. Deal 1 damage to it.
export const GEARA_DOGA_SLEEVES_DESTROYED: EffectSpec = {
  id: "GD01-056-Destroyed",
  cardCode: "GD01-056",
  trigger: "Destroyed",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 }],
  targetScope: "enemyUnit",
  targetFilter: "ap<=5",
  sourceText: "【Destroyed】Choose 1 enemy Unit with 5 or less AP. Deal 1 damage to it.",
};

// GD01-068 Perfect Strike Gundam — 【Deploy】Choose 1 enemy Unit with 1 HP. Return it to its owner's hand.
export const PERFECT_STRIKE_GUNDAM_DEPLOY: EffectSpec = {
  id: "GD01-068-Deploy",
  cardCode: "GD01-068",
  trigger: "Deploy",
  actions: [{ op: "moveZone", target: { kind: "named", name: "target" }, toZone: "hand" }],
  targetScope: "enemyUnit",
  targetFilter: "hp<=1",
  sourceText: "【Deploy】Choose 1 enemy Unit with 1 HP. Return it to its owner's hand.",
};

// GD01-073 Sword Strike Gundam — 【During Link】【Attack】Choose 1 enemy Unit with 2 or less HP. Return it to its owner's hand.
export const SWORD_STRIKE_GUNDAM_ATTACK: EffectSpec = {
  id: "GD01-073-Attack",
  cardCode: "GD01-073",
  trigger: "Attack",
  condition: {
    predicate: "selfIsLinkUnit",
    then: [{ op: "moveZone", target: { kind: "named", name: "target" }, toZone: "hand" }],
  },
  actions: [],
  targetScope: "enemyUnit",
  targetFilter: "hp<=2",
  sourceText: "【During Link】【Attack】Choose 1 enemy Unit with 2 or less HP. Return it to its owner's hand.",
};

// GD01-071 Gundam Pharact — 【During Link】【Attack】Choose 1 enemy Unit. It gets AP-2 during this battle.
export const GUNDAM_PHARACT_ATTACK: EffectSpec = {
  id: "GD01-071-Attack",
  cardCode: "GD01-071",
  trigger: "Attack",
  condition: {
    predicate: "selfIsLinkUnit",
    then: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -2, duration: "thisBattle" }],
  },
  actions: [],
  targetScope: "enemyUnit",
  sourceText: "【During Link】【Attack】Choose 1 enemy Unit. It gets AP-2 during this battle.",
};

// GD01-075 Darilbalde — 【Deploy】Choose 1 enemy Unit with 1 HP. Return it to its owner's hand.
export const DARILBALDE_DEPLOY: EffectSpec = {
  id: "GD01-075-Deploy",
  cardCode: "GD01-075",
  trigger: "Deploy",
  actions: [{ op: "moveZone", target: { kind: "named", name: "target" }, toZone: "hand" }],
  targetScope: "enemyUnit",
  targetFilter: "hp<=1",
  sourceText: "【Deploy】Choose 1 enemy Unit with 1 HP. Return it to its owner's hand.",
};

// GD01-080 Cagalli's Skygrasper — 【Destroyed】Choose 1 enemy Unit that is Lv.2 or lower. Return it to its owner's hand.
export const CAGALLIS_SKYGRASPER_DESTROYED: EffectSpec = {
  id: "GD01-080-Destroyed",
  cardCode: "GD01-080",
  trigger: "Destroyed",
  actions: [{ op: "moveZone", target: { kind: "named", name: "target" }, toZone: "hand" }],
  targetScope: "enemyUnit",
  targetFilter: "level<=2",
  sourceText: "【Destroyed】Choose 1 enemy Unit that is Lv.2 or lower. Return it to its owner's hand.",
};

// GD01-116 Stealth Stratagem — 【Main】/【Action】Choose 1 enemy Unit with 2 or less AP. Deal 2 damage to it.
// (lado 【Pilot】[Nicol Amarfi] é modo alternativo, fora do escopo desta resolução — ver pilotMode.)
export const STEALTH_STRATAGEM_MAIN: EffectSpec = {
  id: "GD01-116-Main",
  cardCode: "GD01-116",
  trigger: "Main",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 2 }],
  targetScope: "enemyUnit",
  targetFilter: "ap<=2",
  sourceText: "【Main】/【Action】Choose 1 enemy Unit with 2 or less AP. Deal 2 damage to it.",
};
export const STEALTH_STRATAGEM_ACTION: EffectSpec = { ...STEALTH_STRATAGEM_MAIN, id: "GD01-116-Action", trigger: "Action" };

// GD01-117 The Witch and the Bride — 【Burst】Activate this card's 【Main】. / 【Main】/【Action】
// Choose 1 enemy Unit with 5 or less HP. Return it to its owner's hand.
const WITCH_AND_BRIDE_ACTIONS: PrimitiveCall[] = [{ op: "moveZone", target: { kind: "named", name: "target" }, toZone: "hand" }];
export const WITCH_AND_BRIDE_BURST: EffectSpec = {
  id: "GD01-117-Burst",
  cardCode: "GD01-117",
  trigger: "Burst",
  actions: WITCH_AND_BRIDE_ACTIONS,
  targetScope: "enemyUnit",
  targetFilter: "hp<=5",
  sourceText: "【Burst】Activate this card's 【Main】.",
};
export const WITCH_AND_BRIDE_MAIN: EffectSpec = { ...WITCH_AND_BRIDE_BURST, id: "GD01-117-Main", trigger: "Main", sourceText: "【Main】/【Action】Choose 1 enemy Unit with 5 or less HP. Return it to its owner's hand." };
export const WITCH_AND_BRIDE_ACTION: EffectSpec = { ...WITCH_AND_BRIDE_MAIN, id: "GD01-117-Action", trigger: "Action" };

// GD01-129 Kusanagi — 【Burst】Deploy this card. Mesmo achado 2026-09-15 de
// GD01-088 (faltava a spec de Burst) — aqui o texto é "Deploy this card"
// (não "add to hand"), mesmo padrão de ST01-015/GD01-130 (`deployThisCard`).
export const KUSANAGI_BURST: EffectSpec = {
  id: "GD01-129-Burst",
  cardCode: "GD01-129",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};

// GD01-129 Kusanagi — 【Deploy】Add 1 of your Shields to your hand. Then, choose 1 enemy Unit with 3 or less HP. Return it to its owner's hand.
export const KUSANAGI_DEPLOY: EffectSpec = {
  id: "GD01-129-Deploy",
  cardCode: "GD01-129",
  trigger: "Deploy",
  actions: [
    { op: "addShieldToHand", player: "controller", count: 1 },
    { op: "moveZone", target: { kind: "named", name: "target" }, toZone: "hand" },
  ],
  targetScope: "enemyUnit",
  targetFilter: "hp<=3",
  sourceText: "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 enemy Unit with 3 or less HP. Return it to its owner's hand.",
};

// GD01-007 Noin's Aries — 【Destroyed】If you have another (OZ) Unit in play, draw 1.
export const NOINS_ARIES_DESTROYED: EffectSpec = {
  id: "GD01-007-Destroyed",
  cardCode: "GD01-007",
  trigger: "Destroyed",
  condition: { predicate: "controllerOtherUnitWithTrait:OZ", then: [{ op: "draw", player: "controller", n: 1 }] },
  actions: [],
  sourceText: "【Destroyed】If you have another (OZ) Unit in play, draw 1.",
};

// GD01-009 G-Fighter — 【Deploy】Choose 1 of your (White Base Team) Units. It gains <High-Maneuver> during this turn.
export const G_FIGHTER_DEPLOY: EffectSpec = {
  id: "GD01-009-Deploy",
  cardCode: "GD01-009",
  trigger: "Deploy",
  actions: [{ op: "grantKeyword", target: { kind: "named", name: "target" }, keyword: "High-Maneuver", duration: "endOfTurn" }],
  targetScope: "friendlyUnit",
  targetFilter: "trait:White Base Team",
  sourceText: "【Deploy】Choose 1 of your (White Base Team) Units. It gains <High-Maneuver> during this turn.",
};

// GD01-020 Anksha — 【Deploy】Choose 1 rested enemy Unit. Deal 1 damage to it.
export const ANKSHA_DEPLOY: EffectSpec = {
  id: "GD01-020-Deploy",
  cardCode: "GD01-020",
  trigger: "Deploy",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 }],
  targetScope: "enemyUnit",
  targetFilter: "rested",
  sourceText: "【Deploy】Choose 1 rested enemy Unit. Deal 1 damage to it.",
};

// GD01-028 Gundam Sandrock — 【Deploy】You may deploy 1 (Maganac Corps) Unit card from your hand.
export const GUNDAM_SANDROCK_DEPLOY: EffectSpec = {
  id: "GD01-028-Deploy",
  cardCode: "GD01-028",
  trigger: "Deploy",
  actions: [{ op: "deployFromHandTriggered", player: "controller", filter: { cardType: "UNIT", anyTrait: ["Maganac Corps"] } }],
  optional: true,
  sourceText: "【Deploy】You may deploy 1 (Maganac Corps) Unit card from your hand.",
};

// GD01-029 Shenlong Gundam — 【Attack】Choose 1 enemy Unit with <Blocker> that is Lv.3 or lower. Destroy it.
export const SHENLONG_GUNDAM_ATTACK: EffectSpec = {
  id: "GD01-029-Attack",
  cardCode: "GD01-029",
  trigger: "Attack",
  actions: [{ op: "destroy", target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "hasKeyword:Blocker;level<=3",
  sourceText: "【Attack】Choose 1 enemy Unit with <Blocker> that is Lv.3 or lower. Destroy it.",
};

// GD01-032 Gyan — 【When Paired･(Zeon) Pilot】Choose 1 enemy Unit with <Blocker> that is Lv.2 or lower. Destroy it.
export const GYAN_WHEN_PAIRED: EffectSpec = {
  id: "GD01-032-WhenPaired",
  cardCode: "GD01-032",
  trigger: "When Paired",
  condition: {
    predicate: "pairedPilotHasTrait:Zeon",
    then: [{ op: "destroy", target: { kind: "named", name: "target" } }],
  },
  actions: [],
  targetScope: "enemyUnit",
  targetFilter: "hasKeyword:Blocker;level<=2",
  sourceText: "【When Paired･(Zeon) Pilot】Choose 1 enemy Unit with <Blocker> that is Lv.2 or lower. Destroy it.",
};

// GD01-025 Gundam Deathscythe — 【When Paired･(Operation Meteor) Pilot】Place 1 rested Resource. Then, this Unit gains <First Strike> during this turn.
export const GUNDAM_DEATHSCYTHE_WHEN_PAIRED: EffectSpec = {
  id: "GD01-025-WhenPaired",
  cardCode: "GD01-025",
  trigger: "When Paired",
  condition: {
    predicate: "pairedPilotHasTrait:Operation Meteor",
    then: [
      { op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea", rested: true },
      { op: "grantKeyword", target: { kind: "self" }, keyword: "First Strike", duration: "endOfTurn" },
    ],
  },
  actions: [],
  sourceText: "【When Paired･(Operation Meteor) Pilot】Place 1 rested Resource. Then, this Unit gains <First Strike> during this turn.",
};

// GD01-026 Char's Zaku Ⅱ — 【During Pair】【Destroyed】Deploy 1 rested [Char's Zaku Ⅱ]((Zeon)･AP3･HP1) Unit token.
export const CHARS_ZAKU_II_DESTROYED: EffectSpec = {
  id: "GD01-026-Destroyed",
  cardCode: "GD01-026",
  trigger: "Destroyed",
  duringPair: true,
  actions: [{ op: "spawnToken", def: TOKEN_ZAKU_II, player: "controller", zone: "battleArea", rested: true }],
  sourceText: "【During Pair】【Destroyed】Deploy 1 rested [Char's Zaku Ⅱ]((Zeon)･AP3･HP1) Unit token.",
};

// GD01-050 LaGOWE — 【Attack】If this Unit has 5 or more AP and it is attacking an enemy Unit, choose 1 enemy Unit. Deal 2 damage to it.
export const LAGOWE_ATTACK: EffectSpec = {
  id: "GD01-050-Attack",
  cardCode: "GD01-050",
  trigger: "Attack",
  condition: {
    predicate: "selfApAtLeast:5;attackingEnemyUnit",
    then: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 2 }],
  },
  actions: [],
  targetScope: "enemyUnit",
  sourceText: "【Attack】If this Unit has 5 or more AP and it is attacking an enemy Unit, choose 1 enemy Unit. Deal 2 damage to it.",
};

// GD01-059 Zee Zulu — 【Attack】If you are attacking the enemy player, this Unit gets AP+2 during this battle.
export const ZEE_ZULU_ATTACK: EffectSpec = {
  id: "GD01-059-Attack",
  cardCode: "GD01-059",
  trigger: "Attack",
  condition: {
    predicate: "attackingPlayer",
    then: [{ op: "modifyStat", target: { kind: "self" }, stat: "ap", amount: 2, duration: "thisBattle" }],
  },
  actions: [],
  sourceText: "【Attack】If you are attacking the enemy player, this Unit gets AP+2 during this battle.",
};

// GD01-066 Justice Gundam — 【Deploy】Deploy 1 [Fatum-00]((Triple Ship Alliance)･AP2･HP2･<Blocker>) Unit token.
export const JUSTICE_GUNDAM_DEPLOY: EffectSpec = {
  id: "GD01-066-Deploy",
  cardCode: "GD01-066",
  trigger: "Deploy",
  actions: [{ op: "spawnToken", def: TOKEN_FATUM_00, player: "controller", zone: "battleArea" }],
  sourceText: "【Deploy】Deploy 1 [Fatum-00]((Triple Ship Alliance)･AP2･HP2･<Blocker>) Unit token.",
};

// GD01-066 Justice Gundam — 2ª cláusula, fechada na revalidação (docs/47 Fase 3):
// "【During Pair】【Attack】Choose 1 of your (Triple Ship Alliance) Unit tokens. It
// may attack on the turn it is deployed." `selfIsPaired` já é o predicado certo
// aqui (tempo real — a Unit ainda está viva no trigger Attack, diferente do
// `duringPair` de Destroyed que precisa de snapshot `wasPaired`; mesmo padrão já
// usado por GD01-073/GD01-082 com `selfIsLinkUnit`/`selfIsPaired`). A exceção de
// "pode atacar no turno do deploy" vira keyword sintética `AttackOnDeployTurn`
// via `grantKeyword` (endOfTurn) — combat.ts/declareAttack aceita como
// equivalente a Link Unit. Filtro `isToken` novo em predicates.ts.
export const JUSTICE_GUNDAM_ATTACK: EffectSpec = {
  id: "GD01-066-Attack",
  cardCode: "GD01-066",
  trigger: "Attack",
  condition: {
    predicate: "selfIsPaired",
    then: [{ op: "grantKeyword", target: { kind: "named", name: "target" }, keyword: "AttackOnDeployTurn", duration: "endOfTurn" }],
  },
  actions: [],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Triple Ship Alliance;isToken",
  sourceText: "【During Pair】【Attack】Choose 1 of your (Triple Ship Alliance) Unit tokens. It may attack on the turn it is deployed.",
};

// GD01-047 Shamblo — 【Attack】If 2 or more other rested friendly Units are in play, choose 1 enemy Unit. Deal 3 damage to it.
export const SHAMBLO_ATTACK: EffectSpec = {
  id: "GD01-047-Attack",
  cardCode: "GD01-047",
  trigger: "Attack",
  condition: {
    predicate: "controllerOtherRestedUnitCountAtLeast:2",
    then: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 3 }],
  },
  actions: [],
  targetScope: "enemyUnit",
  sourceText: "【Attack】If 2 or more other rested friendly Units are in play, choose 1 enemy Unit. Deal 3 damage to it.",
};

// GD01-097 Guel Jeturk — 【Burst】Add this card to your hand. Mesmo achado
// 2026-09-15 de GD01-088.
export const GUEL_JETURK_BURST: EffectSpec = {
  id: "GD01-097-Burst",
  cardCode: "GD01-097",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// GD01-097 Guel Jeturk — 【Activate･Main】【Once per Turn】If your opponent has 8 or more cards in their hand, set this Unit as active. It can't attack during this turn.
export const GUEL_JETURK_ACTIVATE_MAIN: EffectSpec = {
  id: "GD01-097-ActivateMain",
  cardCode: "GD01-097",
  trigger: "Activate·Main",
  condition: {
    predicate: "opponentHandCountAtLeast:8",
    then: [{ op: "setActive", target: { kind: "self" } }, { op: "preventAttackThisTurn", target: { kind: "self" } }],
  },
  actions: [],
  sourceText: "【Activate･Main】【Once per Turn】If your opponent has 8 or more cards in their hand, set this Unit as active. It can't attack during this turn.",
};

// GD01-098 Elan Ceres — 【Burst】Add this card to your hand. Mesmo achado
// 2026-09-15 de GD01-088.
export const ELAN_CERES_BURST: EffectSpec = {
  id: "GD01-098-Burst",
  cardCode: "GD01-098",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// GD01-098 Elan Ceres — 【Activate･Action】【Once per Turn】If an enemy Unit with 1 or less AP is in play, this Unit recovers 1 HP.
export const ELAN_CERES_ACTIVATE_ACTION: EffectSpec = {
  id: "GD01-098-ActivateAction",
  cardCode: "GD01-098",
  trigger: "Activate·Action",
  condition: {
    predicate: "enemyUnitExistsWithApAtMost:1",
    then: [{ op: "heal", target: { kind: "self" }, amount: 1 }],
  },
  actions: [],
  sourceText: "【Activate･Action】【Once per Turn】If an enemy Unit with 1 or less AP is in play, this Unit recovers 1 HP.",
};

// GD01-069 Strike Rouge — 【Activate･Main】【Once per Turn】①：Choose 1 of your rested white Units with <Blocker>. Set it as active. It can't attack during this turn.
export const STRIKE_ROUGE_ACTIVATE_MAIN: EffectSpec = {
  id: "GD01-069-ActivateMain",
  cardCode: "GD01-069",
  trigger: "Activate·Main",
  actions: [
    { op: "setActive", target: { kind: "named", name: "target" } },
    { op: "preventAttackThisTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "color:white;hasKeyword:Blocker;rested",
  sourceText: "【Activate･Main】【Once per Turn】①：Choose 1 of your rested white Units with <Blocker>. Set it as active. It can't attack during this turn.",
};

// GD01-082 Gundam Aerial (Mirasoul Flight Unit) — 【During Pair】【Activate･Action】【Once per Turn】②：Choose 1 enemy Unit. It gets AP-1 during this battle.
export const GUNDAM_AERIAL_MIRASOUL_ACTIVATE_ACTION: EffectSpec = {
  id: "GD01-082-ActivateAction",
  cardCode: "GD01-082",
  trigger: "Activate·Action",
  condition: {
    predicate: "selfIsPaired",
    then: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -1, duration: "thisBattle" }],
  },
  actions: [],
  targetScope: "enemyUnit",
  sourceText: "【During Pair】【Activate･Action】【Once per Turn】②：Choose 1 enemy Unit. It gets AP-1 during this battle.",
};

// GD01-105 Citizens, Take a Stand! — 【Burst】Add this card to your hand.
// Mesmo achado 2026-09-15 de GD01-088 — Command também pode ter Burst.
export const CITIZENS_TAKE_A_STAND_BURST: EffectSpec = {
  id: "GD01-105-Burst",
  cardCode: "GD01-105",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// GD01-105 Citizens, Take a Stand! — 【Main】All your Units get AP+2 during this turn.
export const CITIZENS_TAKE_A_STAND_MAIN: EffectSpec = {
  id: "GD01-105-Main",
  cardCode: "GD01-105",
  trigger: "Main",
  actions: [{ op: "modifyStat", target: { kind: "group", group: { kind: "allFriendlyUnits" } }, stat: "ap", amount: 2, duration: "endOfTurn" }],
  sourceText: "【Main】All your Units get AP+2 during this turn.",
};

// ─────────────────────────────────────────────────────────────────────────
// Lote 1 de gaps de motor fechado (docs/debates 2026-09-13) — TargetScope
// "anyUnit" e TargetGroup "allUnits" (texto oficial "Choose 1 Unit"/"all
// Units" sem "enemy"/"friendly" — os 2 lados do tabuleiro).
// ─────────────────────────────────────────────────────────────────────────

// GD01-014 G-Sky Easy — 【During Link】【Activate･Action】【Once per Turn】Choose 1 Unit. It recovers 1 HP.
export const G_SKY_EASY_ACTIVATE_ACTION: EffectSpec = {
  id: "GD01-014-ActivateAction",
  cardCode: "GD01-014",
  trigger: "Activate·Action",
  condition: {
    predicate: "selfIsLinkUnit",
    then: [{ op: "heal", target: { kind: "named", name: "target" }, amount: 1 }],
  },
  actions: [],
  targetScope: "anyUnit",
  sourceText: "【During Link】【Activate･Action】【Once per Turn】Choose 1 Unit. It recovers 1 HP.",
};

// GD01-024 Wing Gundam Zero — 【Deploy】Deal 3 damage to all Units that are Lv.5 or lower.
export const WING_GUNDAM_ZERO_DEPLOY: EffectSpec = {
  id: "GD01-024-Deploy",
  cardCode: "GD01-024",
  trigger: "Deploy",
  actions: [{ op: "damageUnit", target: { kind: "group", group: { kind: "allUnits", maxLevel: 5 } }, amount: 3 }],
  sourceText: "【Deploy】Deal 3 damage to all Units that are Lv.5 or lower.",
};

// GD01-027 Big Zam — 【Deploy】If there are 10 or more (Zeon)/(Neo Zeon) Unit cards in your trash, deal 4 damage to all Units with <Blocker>.
export const BIG_ZAM_DEPLOY: EffectSpec = {
  id: "GD01-027-Deploy",
  cardCode: "GD01-027",
  trigger: "Deploy",
  condition: {
    predicate: "controllerTrashUnitCountWithAnyTraitAtLeast:Zeon,Neo Zeon:10",
    then: [{ op: "damageUnit", target: { kind: "group", group: { kind: "allUnits", hasKeyword: "Blocker" } }, amount: 4 }],
  },
  actions: [],
  sourceText: "【Deploy】If there are 10 or more (Zeon)/(Neo Zeon) Unit cards in your trash, deal 4 damage to all Units with <Blocker>.",
};

// GD01-043 Rasid's Maganac — 【Deploy】Choose 1 of your green Units. During this turn, it may choose an active enemy Unit with 4 or less AP as its attack target.
export const RASIDS_MAGANAC_DEPLOY: EffectSpec = {
  id: "GD01-043-Deploy",
  cardCode: "GD01-043",
  trigger: "Deploy",
  actions: [{ op: "grantAttackTargetRelax", target: { kind: "named", name: "target" }, maxAp: 4 }],
  targetScope: "friendlyUnit",
  targetFilter: "color:green",
  sourceText: "【Deploy】Choose 1 of your green Units. During this turn, it may choose an active enemy Unit with 4 or less AP as its attack target.",
};

// GD01-058 Galluss-K — 【Activate･Action】【Once per Turn】①：Choose 1 Unit that is Lv.4 or higher. It gets AP+1 during this battle.
export const GALLUSS_K_ACTIVATE_ACTION: EffectSpec = {
  id: "GD01-058-ActivateAction",
  cardCode: "GD01-058",
  trigger: "Activate·Action",
  cost: [{ op: "payResourceCost", player: "controller", n: 1 }],
  actions: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: 1, duration: "thisBattle" }],
  targetScope: "anyUnit",
  targetFilter: "level>=4",
  sourceText: "【Activate･Action】【Once per Turn】①：Choose 1 Unit that is Lv.4 or higher. It gets AP+1 during this battle.",
};

// GD01-108 Strategic Arms — 【Main】Deal 2 damage to all Units with <Blocker>.
export const STRATEGIC_ARMS_MAIN: EffectSpec = {
  id: "GD01-108-Main",
  cardCode: "GD01-108",
  trigger: "Main",
  actions: [{ op: "damageUnit", target: { kind: "group", group: { kind: "allUnits", hasKeyword: "Blocker" } }, amount: 2 }],
  sourceText: "【Main】Deal 2 damage to all Units with <Blocker>.",
};

// GD01-110 Rasid's Orders — 【Main】/【Action】Choose 1 Unit that is Lv.4 or higher. During this turn, it may choose an active enemy Unit with 6 or less AP as its attack target.
const RASIDS_ORDERS_ACTIONS: PrimitiveCall[] = [
  { op: "grantAttackTargetRelax", target: { kind: "named", name: "target" }, maxAp: 6 },
];
export const RASIDS_ORDERS_MAIN: EffectSpec = {
  id: "GD01-110-Main",
  cardCode: "GD01-110",
  trigger: "Main",
  actions: RASIDS_ORDERS_ACTIONS,
  targetScope: "anyUnit",
  targetFilter: "level>=4",
  sourceText: "【Main】/【Action】Choose 1 Unit that is Lv.4 or higher. During this turn, it may choose an active enemy Unit with 6 or less AP as its attack target.",
};
export const RASIDS_ORDERS_ACTION: EffectSpec = {
  id: "GD01-110-Action",
  cardCode: "GD01-110",
  trigger: "Action",
  actions: RASIDS_ORDERS_ACTIONS,
  targetScope: "anyUnit",
  targetFilter: "level>=4",
  sourceText: "【Main】/【Action】Choose 1 Unit that is Lv.4 or higher. During this turn, it may choose an active enemy Unit with 6 or less AP as its attack target.",
};

// GD01-101 Deep Devotion — 【Main】/【Action】Choose 1 friendly Link Unit. It recovers 3 HP.
export const DEEP_DEVOTION_MAIN: EffectSpec = {
  id: "GD01-101-Main",
  cardCode: "GD01-101",
  trigger: "Main",
  actions: [{ op: "heal", target: { kind: "named", name: "target" }, amount: 3 }],
  targetScope: "friendlyUnit",
  targetFilter: "linkUnit",
  sourceText: "【Main】/【Action】Choose 1 friendly Link Unit. It recovers 3 HP.",
};
export const DEEP_DEVOTION_ACTION: EffectSpec = { ...DEEP_DEVOTION_MAIN, id: "GD01-101-Action", trigger: "Action" };

// GD01-102 Securing the Supply Line — 【Main】All friendly Units that are Lv.4 or lower recover 2 HP.
export const SECURING_THE_SUPPLY_LINE_MAIN: EffectSpec = {
  id: "GD01-102-Main",
  cardCode: "GD01-102",
  trigger: "Main",
  actions: [{ op: "heal", target: { kind: "group", group: { kind: "allFriendlyUnits", maxLevel: 4 } }, amount: 2 }],
  sourceText: "【Main】All friendly Units that are Lv.4 or lower recover 2 HP.",
};

// GD01-113 The Desert Tiger — 【Main】/【Action】Choose 1 friendly (ZAFT) Unit. It gets AP+3 during this turn.
export const THE_DESERT_TIGER_MAIN: EffectSpec = {
  id: "GD01-113-Main",
  cardCode: "GD01-113",
  trigger: "Main",
  actions: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: 3, duration: "endOfTurn" }],
  targetScope: "friendlyUnit",
  targetFilter: "trait:ZAFT",
  sourceText: "【Main】/【Action】Choose 1 friendly (ZAFT) Unit. It gets AP+3 during this turn.",
};
export const THE_DESERT_TIGER_ACTION: EffectSpec = { ...THE_DESERT_TIGER_MAIN, id: "GD01-113-Action", trigger: "Action" };

// GD01-119 Iron-Fisted Discipline — 【Main】/【Action】Choose 1 enemy Unit that is Lv.4 or lower. It gets AP-2 during this turn.
export const IRON_FISTED_DISCIPLINE_MAIN: EffectSpec = {
  id: "GD01-119-Main",
  cardCode: "GD01-119",
  trigger: "Main",
  actions: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -2, duration: "endOfTurn" }],
  targetScope: "enemyUnit",
  targetFilter: "level<=4",
  sourceText: "【Main】/【Action】Choose 1 enemy Unit that is Lv.4 or lower. It gets AP-2 during this turn.",
};
export const IRON_FISTED_DISCIPLINE_ACTION: EffectSpec = { ...IRON_FISTED_DISCIPLINE_MAIN, id: "GD01-119-Action", trigger: "Action" };

// GD01-123 Nahel Argama — 【Burst】Deploy this card. / 【Deploy】Add 1 of your Shields to your hand. Then, choose 1 enemy Unit with 3 or less HP. Rest it.
export const NAHEL_ARGAMA_BURST: EffectSpec = {
  id: "GD01-123-Burst",
  cardCode: "GD01-123",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};
export const NAHEL_ARGAMA_DEPLOY: EffectSpec = {
  id: "GD01-123-Deploy",
  cardCode: "GD01-123",
  trigger: "Deploy",
  actions: [
    { op: "addShieldToHand", player: "controller", count: 1 },
    { op: "rest", target: { kind: "named", name: "target" } },
  ],
  targetScope: "enemyUnit",
  targetFilter: "hp<=3",
  sourceText: "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 enemy Unit with 3 or less HP. Rest it.",
};

// GD01-125 Zanzibar — 【Burst】Deploy this card. / 【Deploy】Add 1 of your Shields to your hand. Then, if it is your
// turn, you may deploy 1 (Zeon) Unit card that is Lv.4 or lower from your hand.
export const ZANZIBAR_BURST: EffectSpec = {
  id: "GD01-125-Burst",
  cardCode: "GD01-125",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};
export const ZANZIBAR_DEPLOY: EffectSpec = {
  id: "GD01-125-Deploy",
  cardCode: "GD01-125",
  trigger: "Deploy",
  condition: {
    predicate: "isControllersTurn",
    then: [{ op: "deployFromHandTriggered", player: "controller", filter: { cardType: "UNIT", anyTrait: ["Zeon"], maxLevel: 4 } }],
  },
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn, you may deploy 1 (Zeon) Unit card that is Lv.4 or lower from your hand.",
};

// GD01-127 Gamow — 【Burst】Deploy this card. / 【Deploy】Add 1 of your Shields to your hand. /
// 【Activate･Action】Rest this Base：Choose 1 friendly (ZAFT) Unit with 5 or more AP. It gains <Breach 3> during this battle.
export const GAMOW_BURST: EffectSpec = {
  id: "GD01-127-Burst",
  cardCode: "GD01-127",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};
export const GAMOW_DEPLOY: EffectSpec = {
  id: "GD01-127-Deploy",
  cardCode: "GD01-127",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};
export const GAMOW_ACTIVATE_ACTION: EffectSpec = {
  id: "GD01-127-ActivateAction",
  cardCode: "GD01-127",
  trigger: "Activate·Action",
  cost: [{ op: "rest", target: { kind: "self" } }],
  actions: [{ op: "grantKeyword", target: { kind: "named", name: "target" }, keyword: "Breach 3", duration: "thisBattle" }],
  targetScope: "friendlyUnit",
  targetFilter: "trait:ZAFT;ap>=5",
  sourceText: "【Activate･Action】Rest this Base：Choose 1 friendly (ZAFT) Unit with 5 or more AP. It gains <Breach 3> during this battle.",
};

// GD01-130 13th Tactical Testing Sector — 【Burst】Deploy this card. / 【Deploy】Add 1 of your Shields to your hand. /
// 【Activate･Main】Rest this Base：If a friendly (Academy) Unit is in play, choose 1 enemy Unit. It gets AP-1 during this turn.
export const TACTICAL_TESTING_SECTOR_BURST: EffectSpec = {
  id: "GD01-130-Burst",
  cardCode: "GD01-130",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};
export const TACTICAL_TESTING_SECTOR_DEPLOY: EffectSpec = {
  id: "GD01-130-Deploy",
  cardCode: "GD01-130",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};
export const TACTICAL_TESTING_SECTOR_ACTIVATE_MAIN: EffectSpec = {
  id: "GD01-130-ActivateMain",
  cardCode: "GD01-130",
  trigger: "Activate·Main",
  cost: [{ op: "rest", target: { kind: "self" } }],
  condition: {
    predicate: "controllerUnitWithTraitInPlay:Academy",
    then: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -1, duration: "endOfTurn" }],
  },
  actions: [],
  targetScope: "enemyUnit",
  sourceText: "【Activate･Main】Rest this Base：If a friendly (Academy) Unit is in play, choose 1 enemy Unit. It gets AP-1 during this turn.",
};

// GD01-044 Kshatriya — 【When Paired･(Cyber-Newtype)/(Newtype) Pilot】Choose 1 to 2 enemy
// Units. Deal 1 damage to them. Lote 4 (docs/debates 2026-09-13): 1ª carta a usar
// `TargetRef.namedGroup` + `EffectSpec.targetCount` ("choose até N alvos").
export const KSHATRIYA_WHEN_PAIRED: EffectSpec = {
  id: "GD01-044-WhenPaired",
  cardCode: "GD01-044",
  trigger: "When Paired",
  condition: {
    predicate: "pairedPilotHasAnyTrait:Cyber-Newtype,Newtype",
    then: [{ op: "damageUnit", target: { kind: "namedGroup", name: "target" }, amount: 1 }],
  },
  actions: [],
  targetScope: "enemyUnit",
  targetCount: { min: 1, max: 2 },
  sourceText: "【When Paired･(Cyber-Newtype)/(Newtype) Pilot】Choose 1 to 2 enemy Units. Deal 1 damage to them.",
};

// GD01-114 Assault on Torrington Base — 【Action】Choose 2 friendly Units. They get AP+1 during this turn.
export const ASSAULT_ON_TORRINGTON_BASE_ACTION: EffectSpec = {
  id: "GD01-114-Action",
  cardCode: "GD01-114",
  trigger: "Action",
  actions: [{ op: "modifyStat", target: { kind: "namedGroup", name: "target" }, stat: "ap", amount: 1, duration: "endOfTurn" }],
  targetScope: "friendlyUnit",
  targetCount: { min: 2, max: 2 },
  sourceText: "【Action】Choose 2 friendly Units. They get AP+1 during this turn.",
};

// GD01-093 Marida Cruz — 【Burst】Add this card to your hand. Mesmo achado
// 2026-09-15 de GD01-088 — sem esta spec, o `hasBurst: true` do card def
// nunca vira decisão de burst de verdade (ver dispatcher.ts#burstEligibleShieldIds).
export const MARIDA_CRUZ_BURST: EffectSpec = {
  id: "GD01-093-Burst",
  cardCode: "GD01-093",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// GD01-093 Marida Cruz — 【During Link】【Attack】Choose 1 enemy Unit whose Lv. is equal to
// or lower than this Unit. Deal 1 damage to it. Lote 5 (docs/debates 2026-09-13):
// 1ª carta a usar targetFilter "level<=self" (relativo à própria fonte, não um número
// literal — precisou de sourceInstanceId em TargetFilterResolver/computeLegalTargets).
export const MARIDA_CRUZ_ATTACK: EffectSpec = {
  id: "GD01-093-Attack",
  cardCode: "GD01-093",
  trigger: "Attack",
  condition: {
    predicate: "sourcePairedUnitIsLinkUnit",
    then: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 }],
  },
  actions: [],
  targetScope: "enemyUnit",
  targetFilter: "level<=self",
  sourceText: "【During Link】【Attack】Choose 1 enemy Unit whose Lv. is equal to or lower than this Unit. Deal 1 damage to it.",
};

// GD01-095 Dearka Elthman — 【Burst】Add this card to your hand. Mesmo achado
// 2026-09-15 de GD01-088.
export const DEARKA_ELTHMAN_BURST: EffectSpec = {
  id: "GD01-095-Burst",
  cardCode: "GD01-095",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// GD01-095 Dearka Elthman — 【When Linked】Discard 1. If you do, draw 1. Lote 5
// (docs/debates 2026-09-13): "if you do" resolvido via predicate `chosenNonEmpty:discard`
// (a escolha de `discardNamed` já é conhecida em ctx.targets ANTES de resolveEffectSpec
// rodar — não precisou de nenhum "branching pós-primitiva" de verdade).
export const DEARKA_ELTHMAN_WHEN_LINKED: EffectSpec = {
  id: "GD01-095-WhenLinked",
  cardCode: "GD01-095",
  trigger: "When Linked",
  condition: {
    predicate: "chosenNonEmpty:discard",
    then: [{ op: "draw", player: "controller", n: 1 }],
  },
  actions: [{ op: "discardNamed", player: "controller", name: "discard", n: 1 }],
  sourceText: "【When Linked】Discard 1. If you do, draw 1.",
};

// GD01-103 The Stubborn Cog — 【Main】Choose 1 active friendly (Earth Federation) Unit and
// 1 active enemy Unit. Rest them. Lote 5 (docs/debates 2026-09-13): 1ª carta a usar
// `EffectSpec.secondaryTarget` (2º pool de alvo com ESCOPO PRÓPRIO no mesmo spec).
export const THE_STUBBORN_COG_MAIN: EffectSpec = {
  id: "GD01-103-Main",
  cardCode: "GD01-103",
  trigger: "Main",
  actions: [
    { op: "rest", target: { kind: "named", name: "target" } },
    { op: "rest", target: { kind: "named", name: "enemyTarget" } },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Earth Federation;active",
  secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit", targetFilter: "active" },
  sourceText: "【Main】Choose 1 active friendly (Earth Federation) Unit and 1 active enemy Unit. Rest them.",
};

// GD01-112 Extreme Hatred — 【Main】Choose 2 of your active Units. Rest them. If you do,
// choose 1 enemy Unit. Deal 3 damage to it. Lote 5: combina `targetCount` (Lote 4),
// `secondaryTarget` (GD01-103, acima) e `chosenNonEmpty` (GD01-095, "if you do").
export const EXTREME_HATRED_MAIN: EffectSpec = {
  id: "GD01-112-Main",
  cardCode: "GD01-112",
  trigger: "Main",
  condition: {
    predicate: "chosenNonEmpty:target",
    then: [{ op: "damageUnit", target: { kind: "named", name: "enemyTarget" }, amount: 3 }],
  },
  actions: [{ op: "rest", target: { kind: "namedGroup", name: "target" } }],
  targetScope: "friendlyUnit",
  targetFilter: "active",
  targetCount: { min: 2, max: 2 },
  secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit" },
  sourceText: "【Main】Choose 2 of your active Units. Rest them. If you do, choose 1 enemy Unit. Deal 3 damage to it.",
};

// GD01-039 Dopp — 【Deploy】Look at the top card of your deck. Return it to the top or
// bottom of your deck. Lote 5 (docs/debates 2026-09-13): 1ª carta a usar
// `moveTopCardToChosenPosition` (posição escolhida pelo jogador via enumChoice top/bottom).
export const DOPP_DEPLOY: EffectSpec = {
  id: "GD01-039-Deploy",
  cardCode: "GD01-039",
  trigger: "Deploy",
  actions: [{ op: "moveTopCardToChosenPosition", player: "controller", optionsKey: "position" }],
  sourceText: "【Deploy】Look at the top card of your deck. Return it to the top or bottom of your deck.",
};

// GD01-045 Duel Gundam (Assault Shroud) — 【When Paired】Look at the top 3 cards of your
// deck. You may deploy 1 (ZAFT) Unit card that is Lv.4 or lower among them. Return the
// remaining cards randomly to the bottom of your deck. Lote 5: `deployFromTopFilterReveal`.
export const DUEL_GUNDAM_ASSAULT_SHROUD_WHEN_PAIRED: EffectSpec = {
  id: "GD01-045-WhenPaired",
  cardCode: "GD01-045",
  trigger: "When Paired",
  actions: [{ op: "deployFromTopFilterReveal", player: "controller", count: 3, filter: { cardType: "UNIT", anyTrait: ["ZAFT"], maxLevel: 4 } }],
  optional: true,
  sourceText: "【When Paired】Look at the top 3 cards of your deck. You may deploy 1 (ZAFT) Unit card that is Lv.4 or lower among them. Return the remaining cards randomly to the bottom of your deck.",
};

// GD01-067 Gundam Aerial Rebuild — 【When Paired】Choose 1 Command card that is Lv.5 or
// lower from your trash. Add it to your hand. Lote 5: `searchTrashToHand`.
export const GUNDAM_AERIAL_REBUILD_WHEN_PAIRED: EffectSpec = {
  id: "GD01-067-WhenPaired",
  cardCode: "GD01-067",
  trigger: "When Paired",
  actions: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "COMMAND", maxLevel: 5 } }],
  sourceText: "【When Paired】Choose 1 Command card that is Lv.5 or lower from your trash. Add it to your hand.",
};

// GD01-122 Covert Operative — 【Main】Choose 1 enemy Unit with 2 or less HP. Return it to
// its owner's hand. If you have a Link Unit in play, choose 1 enemy Unit with 4 or less HP
// instead. Lote 5 (docs/debates 2026-09-13): targetFilter "hp<=conditionalLinkUnit:2:4".
export const COVERT_OPERATIVE_MAIN: EffectSpec = {
  id: "GD01-122-Main",
  cardCode: "GD01-122",
  trigger: "Main",
  actions: [{ op: "moveZone", target: { kind: "named", name: "target" }, toZone: "hand" }],
  targetScope: "enemyUnit",
  targetFilter: "hp<=conditionalLinkUnit:2:4",
  sourceText:
    "【Main】Choose 1 enemy Unit with 2 or less HP. Return it to its owner's hand. If you have a Link Unit in play, choose 1 enemy Unit with 4 or less HP instead.",
};

// GD01-003 Unicorn Gundam 02 Banshee (Destroy Mode) — 【During Link】【Attack】Choose 12 cards
// from your trash. Return them to their owner's deck and shuffle it. If you do, set this
// Unit as active. It gains <First Strike> during this turn. Lote 5 (docs/debates 2026-09-13):
// "During Link" + "if you do" combinados num único predicate composto (";") — sem trash pra
// devolver, a primitiva já é no-op, então a combinação reflete o "if you do" corretamente.
export const BANSHEE_DESTROY_MODE_ATTACK: EffectSpec = {
  id: "GD01-003-Attack",
  cardCode: "GD01-003",
  trigger: "Attack",
  condition: {
    predicate: "selfIsLinkUnit;controllerTrashCountAtLeast:1",
    then: [
      { op: "returnTrashToDeckAndShuffle", player: "controller", count: 12 },
      { op: "setActive", target: { kind: "self" } },
      { op: "grantKeyword", target: { kind: "self" }, keyword: "First Strike", duration: "endOfTurn" },
    ],
  },
  actions: [],
  sourceText:
    "【During Link】【Attack】Choose 12 cards from your trash. Return them to their owner's deck and shuffle it. If you do, set this Unit as active. It gains <First Strike> during this turn.",
};

// GD01-048 Zaku I Sniper Type — 【Deploy】Look at the top card of your deck. If it is a
// (Zeon)/(Neo Zeon) Unit card, you may reveal it and add it to your hand. Return any
// remaining card to the bottom of your deck. Lote 2 (docs/debates 2026-09-13): mesmo
// shape de ST03-006 (CHARS_ZAKU_II_DESTROYED) — `CardDefFilter.anyTrait` já cobria o
// filtro de trait múltiplo, nenhuma extensão de motor precisou ser feita.
export const ZAKU_I_SNIPER_TYPE_DEPLOY: EffectSpec = {
  id: "GD01-048-Deploy",
  cardCode: "GD01-048",
  trigger: "Deploy",
  actions: [{ op: "lookAtTopFilterReveal", player: "controller", count: 1, filter: { cardType: "UNIT", anyTrait: ["Zeon", "Neo Zeon"] } }],
  optional: true,
  sourceText:
    "【Deploy】Look at the top card of your deck. If it is a (Zeon)/(Neo Zeon) Unit card, you may reveal it and add it to your hand. Return any remaining card to the bottom of your deck.",
};

// GD01-109 The Path to Victory or Defeat — 【Main】Look at the top 5 cards of your deck.
// You may reveal 1 (Operation Meteor)/(G Team) Unit card/Pilot card among them and add it
// to your hand. Return the remaining cards randomly to the bottom of your deck. Lote 2:
// precisou da extensão `CardDefFilter.anyCardType` (2 tipos de carta possíveis — Unit OU
// Pilot —, o `cardType` existente só aceitava 1).
export const THE_PATH_TO_VICTORY_OR_DEFEAT_MAIN: EffectSpec = {
  id: "GD01-109-Main",
  cardCode: "GD01-109",
  trigger: "Main",
  actions: [
    {
      op: "lookAtTopFilterReveal",
      player: "controller",
      count: 5,
      filter: { anyCardType: ["UNIT", "PILOT"], anyTrait: ["Operation Meteor", "G Team"] },
    },
  ],
  optional: true,
  sourceText:
    "【Main】Look at the top 5 cards of your deck. You may reveal 1 (Operation Meteor)/(G Team) Unit card/Pilot card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
};

// ── Auditoria por cláusula (W0.3): 【Main】/【Action】 que faltavam em Commands ──────────
// GD01-115 Zeon Remnant Forces — só tinha o 【Main】; na Action Step não fazia nada.
export const ZEON_REMNANT_FORCES_ACTION: EffectSpec = { ...ZEON_REMNANT_FORCES_MAIN, id: "GD01-115-Action", trigger: "Action" };

// GD01-099 Intercept Orders — só tinha o 【Burst】; jogada como Command não fazia nada.
export const INTERCEPT_ORDERS_MAIN_ACTION = mainAndAction({
  cardCode: "GD01-099",
  actions: [{ op: "rest", target: { kind: "namedGroup", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "hp<=3",
  targetCount: { min: 1, max: 2 },
  sourceText: "【Main】/【Action】Choose 1 to 2 enemy Units with 3 or less HP. Rest them.",
});

// GD01-111 Battle of Aces — só tinha o 【Burst】.
export const BATTLE_OF_ACES_MAIN_ACTION = mainAndAction({
  cardCode: "GD01-111",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 3 }],
  targetScope: "enemyUnit",
  targetFilter: "damaged",
  sourceText: "【Main】/【Action】Choose 1 damaged enemy Unit. Deal 3 damage to it.",
});

// GD01-120 Naval Bombardment — só tinha o 【Burst】.
export const NAVAL_BOMBARDMENT_ACTION: EffectSpec = {
  id: "GD01-120-Action",
  cardCode: "GD01-120",
  trigger: "Action",
  actions: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: 3, duration: "endOfTurn" }],
  targetScope: "friendlyUnit",
  targetFilter: "hasKeyword:Blocker",
  sourceText: "【Action】Choose 1 friendly Unit with <Blocker>. It gets AP+3 during this turn.",
};

export const GD01_EFFECT_SPECS: EffectSpec[] = [
  // auditoria por cláusula (W0.3): 【Burst】Add this card to your hand. dos pilotos que faltava
  ...["GD01-087", "GD01-089", "GD01-090", "GD01-091", "GD01-092", "GD01-094", "GD01-096"].map(stdAddToHandBurst),
  ZEON_REMNANT_FORCES_ACTION,
  ...INTERCEPT_ORDERS_MAIN_ACTION,
  ...BATTLE_OF_ACES_MAIN_ACTION,
  NAVAL_BOMBARDMENT_ACTION,
  UNICORN_GUNDAM_DESTROY_MODE_ATTACK,
  UNICORN_GUNDAM_UNICORN_MODE_DESTROYED,
  CHARS_GELGOOG_ACTIVATE_MAIN,
  FREEDOM_GUNDAM_ANY_PAIRING,
  GUNCANNON_WHEN_PAIRED,
  GUNTANK_DEPLOY,
  BANSHEE_UNICORN_WHEN_PAIRED,
  ZECHS_LEO_WHEN_PAIRED,
  BALL_ATTACK,
  CHUCHUS_DEMI_TRAINER_ATTACK,
  MISTRAL_DEPLOY,
  BANAGHER_LINKS_BURST,
  BANAGHER_LINKS_WHEN_LINKED,
  INTERCEPT_ORDERS_BURST,
  A_SHOW_OF_RESOLVE_MAIN,
  SIGNS_OF_A_REVOLUTION_BURST,
  SIGNS_OF_A_REVOLUTION_MAIN,
  FORTRESS_DEFENSE_MAIN,
  FIRST_CONTACT_BURST,
  FIRST_CONTACT_MAIN,
  BATTLE_OF_ACES_BURST,
  ZEON_REMNANT_FORCES_MAIN,
  OVERFLOWING_AFFECTION_MAIN,
  NAVAL_BOMBARDMENT_BURST,
  MIDAIR_MODIFICATIONS_MAIN,
  MIDAIR_MODIFICATIONS_BURST,
  SIDE_7_BURST,
  SIDE_7_DEPLOY,
  SIDE_7_ACTIVATE_MAIN,
  UNDERGROUND_DESERT_BASE_BURST,
  UNDERGROUND_DESERT_BASE_DEPLOY,
  MINING_ASTEROID_PALAU_BURST,
  MINING_ASTEROID_PALAU_DEPLOY,
  GUNDAM_WHEN_PAIRED,
  ADZAM_DEPLOY,
  BLITZ_GUNDAM_DEPLOY,
  GEARA_ZULU_DEPLOY,
  GEARA_DOGA_HEAVY_ARMED_ACTIVATE_MAIN,
  GEARA_DOGA_SLEEVES_DESTROYED,
  PERFECT_STRIKE_GUNDAM_DEPLOY,
  SWORD_STRIKE_GUNDAM_ATTACK,
  DARILBALDE_DEPLOY,
  CAGALLIS_SKYGRASPER_DESTROYED,
  STEALTH_STRATAGEM_MAIN,
  STEALTH_STRATAGEM_ACTION,
  WITCH_AND_BRIDE_BURST,
  WITCH_AND_BRIDE_MAIN,
  WITCH_AND_BRIDE_ACTION,
  KUSANAGI_BURST,
  KUSANAGI_DEPLOY,
  NOINS_ARIES_DESTROYED,
  G_FIGHTER_DEPLOY,
  ANKSHA_DEPLOY,
  GUNDAM_SANDROCK_DEPLOY,
  SHENLONG_GUNDAM_ATTACK,
  GYAN_WHEN_PAIRED,
  SHAMBLO_ATTACK,
  GUEL_JETURK_BURST,
  GUEL_JETURK_ACTIVATE_MAIN,
  ELAN_CERES_BURST,
  ELAN_CERES_ACTIVATE_ACTION,
  DEEP_DEVOTION_MAIN,
  DEEP_DEVOTION_ACTION,
  SECURING_THE_SUPPLY_LINE_MAIN,
  THE_DESERT_TIGER_MAIN,
  THE_DESERT_TIGER_ACTION,
  IRON_FISTED_DISCIPLINE_MAIN,
  IRON_FISTED_DISCIPLINE_ACTION,
  NAHEL_ARGAMA_BURST,
  NAHEL_ARGAMA_DEPLOY,
  ZANZIBAR_BURST,
  ZANZIBAR_DEPLOY,
  GAMOW_BURST,
  GAMOW_DEPLOY,
  GAMOW_ACTIVATE_ACTION,
  TACTICAL_TESTING_SECTOR_BURST,
  TACTICAL_TESTING_SECTOR_DEPLOY,
  TACTICAL_TESTING_SECTOR_ACTIVATE_MAIN,
  GUNDAM_PHARACT_ATTACK,
  GUNDAM_DEATHSCYTHE_WHEN_PAIRED,
  CHARS_ZAKU_II_DESTROYED,
  LAGOWE_ATTACK,
  ZEE_ZULU_ATTACK,
  JUSTICE_GUNDAM_DEPLOY,
  JUSTICE_GUNDAM_ATTACK,
  STRIKE_ROUGE_ACTIVATE_MAIN,
  GUNDAM_AERIAL_MIRASOUL_ACTIVATE_ACTION,
  CITIZENS_TAKE_A_STAND_BURST,
  CITIZENS_TAKE_A_STAND_MAIN,
  G_SKY_EASY_ACTIVATE_ACTION,
  WING_GUNDAM_ZERO_DEPLOY,
  BIG_ZAM_DEPLOY,
  RASIDS_MAGANAC_DEPLOY,
  GALLUSS_K_ACTIVATE_ACTION,
  STRATEGIC_ARMS_MAIN,
  RASIDS_ORDERS_MAIN,
  RASIDS_ORDERS_ACTION,
  ZAKU_I_SNIPER_TYPE_DEPLOY,
  THE_PATH_TO_VICTORY_OR_DEFEAT_MAIN,
  KSHATRIYA_WHEN_PAIRED,
  ASSAULT_ON_TORRINGTON_BASE_ACTION,
  MARIDA_CRUZ_BURST,
  MARIDA_CRUZ_ATTACK,
  DEARKA_ELTHMAN_BURST,
  DEARKA_ELTHMAN_WHEN_LINKED,
  THE_STUBBORN_COG_MAIN,
  EXTREME_HATRED_MAIN,
  DOPP_DEPLOY,
  DUEL_GUNDAM_ASSAULT_SHROUD_WHEN_PAIRED,
  GUNDAM_AERIAL_REBUILD_WHEN_PAIRED,
  COVERT_OPERATIVE_MAIN,
  BANSHEE_DESTROY_MODE_ATTACK,
];

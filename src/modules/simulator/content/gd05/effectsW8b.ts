import type { CardDefFilter, EffectSpec, PrimitiveCall } from "../../engine/effectSpec";
import { TOKEN_PLUMA } from "./tokens";

/**
 * Wave W8b — GD05-C com motor novo pequeno: custo "Rest N of your Units" (`secondaryTarget.count`), <Repair>/AP por
 * contagem, reação de fim de turno com escolha, deploy de Base da mão. Reduções "aura" (GD05-084/123), <Repair> do
 * GD05-006, AP do GD05-051 e a regra de entrada descansada do GD05-026 ficam nas CardDefs (`// W8`).
 */

const target = { kind: "named", name: "target" } as const;
const costUnits = { kind: "namedGroup", name: "costUnits" } as const;

/** C3 — exilar do trash: as primeiras N que casam (aproximação A6 registrada em `deferred.ts`) */
const exile = (count: number, filter: CardDefFilter): PrimitiveCall => ({
  op: "moveZone",
  target: { kind: "group", group: { kind: "firstNInTrash", count, filter } },
  toZone: "exile",
});

const DESTROYS_ENEMY_CARD =
  "【Once per Turn】During your turn, when this Unit destroys an enemy card with battle damage, deploy 1 [Pluma]((Calamity War)･AP2･HP1) Unit token.";

export const GD05_W8B_EFFECT_SPECS: EffectSpec[] = [
  // GD05-001 V2 Gundam
  {
    id: "GD05-001-ActivateMain",
    cardCode: "GD05-001",
    trigger: "Activate·Main",
    oncePerTurn: true,
    cost: [{ op: "rest", target: costUnits }],
    actions: [{ op: "setActive", target: { kind: "self" } }],
    secondaryTarget: { name: "costUnits", targetScope: "friendlyUnit", targetFilter: "active", count: 2 },
    sourceText: "【Activate･Main】【Once per Turn】Rest 2 of your Units：Set this Unit as active.",
  },

  // GD05-006 Hashmal — "an enemy card" = Unit ou carta da área de escudo
  {
    id: "GD05-006-DestroyedUnit",
    cardCode: "GD05-006",
    trigger: "Reaction:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "self", turn: "yours" },
    oncePerTurn: true,
    actions: [{ op: "spawnToken", def: TOKEN_PLUMA, player: "controller", zone: "battleArea" }],
    sourceText: DESTROYS_ENEMY_CARD,
  },
  {
    id: "GD05-006-DestroyedShield",
    cardCode: "GD05-006",
    trigger: "Reaction:destroyedShieldInBattle",
    reaction: { event: "destroyedShieldInBattle", subject: "self", turn: "yours" },
    oncePerTurn: true,
    actions: [{ op: "spawnToken", def: TOKEN_PLUMA, player: "controller", zone: "battleArea" }],
    sourceText: DESTROYS_ENEMY_CARD,
  },

  // GD05-021 Gundam AGE-2 Double Bullet (a redução está na CardDef)
  {
    id: "GD05-021-ActivateAction",
    cardCode: "GD05-021",
    trigger: "Activate·Action",
    oncePerTurn: true,
    cost: [{ op: "payResourceCost", player: "controller", n: 1 }],
    actions: [{ op: "modifyStat", stat: "ap", amount: 4, duration: "thisBattle", target: { kind: "self" } }],
    sourceText: "【Activate･Action】【Once per Turn】①：This Unit gets AP+4 during this battle.",
  },

  // GD05-022 Gundam Schwarzette
  {
    id: "GD05-022-ActivateAction",
    cardCode: "GD05-022",
    trigger: "Activate·Action",
    cost: [exile(2, { cardType: "COMMAND" })],
    actions: [{ op: "grantDamageModifier", target: { kind: "self" }, amount: 2, scope: "battle", enemyOnly: true }],
    sourceText:
      "【Activate･Action】Exile 2 Command cards in your trash from the game：During this battle, when this Unit receives enemy damage, reduce it by 2.",
  },

  // GD05-038 Gundam Throne Eins (GN High Mega Launcher)
  {
    id: "GD05-038-ActivateMain",
    cardCode: "GD05-038",
    trigger: "Activate·Main",
    oncePerTurn: true,
    cost: [{ op: "rest", target: costUnits }],
    actions: [{ op: "damageUnit", target, amount: 4 }],
    targetScope: "enemyUnit",
    secondaryTarget: { name: "costUnits", targetScope: "friendlyUnit", targetFilter: "trait:CB;active", count: 3 },
    sourceText: "【Activate･Main】【Once per Turn】Rest 3 of your (CB) Units：Choose 1 enemy Unit. Deal 4 damage to it.",
  },

  // GD05-051 Gundam Barbatos Lupus Rex (o AP + dano está na CardDef)
  {
    id: "GD05-051-EndOfTurn",
    cardCode: "GD05-051",
    trigger: "Reaction:endOfTurn",
    reaction: { event: "endOfTurn", subject: "self", turn: "yours" },
    optional: true,
    actions: [
      { op: "damageUnit", target, amount: 1 },
      { op: "setActive", target },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Tekkadan",
    sourceText: "At the end of your turn, you may choose 1 of your (Tekkadan) Units. Deal 1 damage to it. Set it as active.",
  },

  // GD05-130 Presidential Office (Base)
  {
    id: "GD05-130-Destroyed",
    cardCode: "GD05-130",
    trigger: "Destroyed",
    optional: true,
    actions: [
      { op: "moveZone", target: { kind: "self" }, toZone: "exile" },
      { op: "thenTrigger", trigger: "Then:1" },
    ],
    sourceText: "【Destroyed】You may exile this card in your trash from the game.",
  },
  {
    id: "GD05-130-Then",
    cardCode: "GD05-130",
    trigger: "Then:1",
    optional: true,
    actions: [{ op: "deployFromHandTriggered", player: "controller", filter: { cardType: "BASE", nameContains: "Presidential Office" } }],
    sourceText: 'If you do, you may deploy 1 Base card with "Presidential Office" in its card name from your hand.',
  },
];

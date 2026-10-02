import type { EffectSpec } from "../../engine/effectSpec";
import { mainAndAction } from "../standardSpecs";

/**
 * Wave W5 (GD04-C). W5a — camada de dano (C2, `engine/damageLayer.ts`): "reduce the next damage",
 * "during this battle, reduce battle damage", "can't receive effect damage" e redirecionar dano de batalha.
 * As reduções contínuas (GD04-029/053/068/088/098/123) são `CardDef.damageReductions`.
 */

const target = { kind: "named", name: "target" } as const;
const thisUnit = { kind: "pairedUnit" } as const;

export const GD04_W5_EFFECT_SPECS: EffectSpec[] = [
  // ——— Pilots ———
  {
    id: "GD04-087-Attack",
    cardCode: "GD04-087",
    trigger: "Attack",
    duringLink: true,
    optional: true,
    actions: [{ op: "redirectBattleDamage", from: thisUnit, to: target, scope: "battle" }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Academy;notSelfUnit",
    sourceText: "【During Link】【Attack】You may choose 1 of your (Academy) Units. During this battle, battle damage this Unit would receive is dealt to that Unit instead.",
  },
  {
    id: "GD04-093-WhenLinked",
    cardCode: "GD04-093",
    trigger: "When Linked",
    actions: [{ op: "grantDamageModifier", target, amount: 2, scope: "next" }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:ZAFT;linkUnit",
    sourceText: "【When Linked】Choose 1 of your (ZAFT) Link Units. During this turn, reduce the next damage it receives by 2.",
  },
  {
    id: "GD04-095-WhenLinked",
    cardCode: "GD04-095",
    trigger: "When Linked",
    actions: [{ op: "redirectBattleDamage", from: target, to: thisUnit, scope: "turn" }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Minerva Squad;notSelfUnit",
    sourceText: "【When Linked】Choose 1 of your (Minerva Squad) Units. During this turn, battle damage it would receive is dealt to this Unit instead.",
  },
  // ——— Commands ———
  {
    id: "GD04-113-Action",
    cardCode: "GD04-113",
    trigger: "Action",
    actions: [{ op: "grantDamageModifier", target, amount: 3, kind: "battle", scope: "battle" }],
    targetScope: "friendlyUnit",
    sourceText: "【Action】Choose 1 of your Units. During this battle, reduce battle damage it receives by 3.",
  },
  ...mainAndAction({
    cardCode: "GD04-119",
    actions: [{ op: "grantDamageModifier", target, immune: true, kind: "effect", scope: "turn", enemyOnly: true, sourceUnitOnly: true }],
    targetScope: "friendlyUnit",
    targetFilter: "pairedPilotTrait:Newtype",
    sourceText: "【Main】/【Action】Choose 1 friendly Unit paired with a (Newtype) Pilot. It can't receive effect damage from enemy Units during this turn.",
  }),
];

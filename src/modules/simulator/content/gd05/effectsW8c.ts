import type { CardDefFilter, EffectSpec, PrimitiveCall } from "../../engine/effectSpec";
import { EX_RESOURCE_TOKEN } from "../../engine/setup";

/**
 * Wave W8c — as 3 últimas do GD05, com o FAQ oficial (10/07/2026):
 * - GD05-017: "Begin a battle … only perform the damage step" = combate direto no Damage Step (CR 5-22-3, Q346–Q348).
 * - GD05-018: "When one of your EX Resources is exiled" dispara 1× por pagamento, cada cópia (Q350/Q354/Q356); limite
 *   de 5 EX Resources (Q351).
 * - GD05-124: a substituição do custo de descanso está na CardDef (`restInsteadOfUnitCost`).
 */

const target = { kind: "named", name: "target" } as const;

/** C3 — exilar do trash: as primeiras N que casam (aproximação A6 registrada em `deferred.ts`) */
const exile = (count: number, filter: CardDefFilter): PrimitiveCall => ({
  op: "moveZone",
  target: { kind: "group", group: { kind: "firstNInTrash", count, filter } },
  toZone: "exile",
});

export const GD05_W8C_EFFECT_SPECS: EffectSpec[] = [
  // GD05-017 Nu Gundam
  {
    id: "GD05-017-WhenPaired",
    cardCode: "GD05-017",
    trigger: "When Paired",
    optional: true,
    condition: {
      predicate: "controllerTrashCardCountWithAnyTraitAtLeast:Londo Bell:3",
      then: [exile(3, { anyTrait: ["Londo Bell"] }), { op: "thenTrigger", trigger: "Then:1" }],
    },
    actions: [],
    sourceText: "【When Paired】You may choose 3 (Londo Bell) cards from your trash. Exile them from the game.",
  },
  {
    id: "GD05-017-Then",
    cardCode: "GD05-017",
    trigger: "Then:1",
    actions: [{ op: "beginDamageOnlyBattle", target }],
    targetScope: "enemyUnit",
    sourceText: "If you do, choose 1 enemy Unit. Begin a battle between this Unit and it and only perform the damage step.",
  },

  // GD05-018 Gundam Calibarn
  {
    id: "GD05-018-Reaction",
    cardCode: "GD05-018",
    trigger: "Reaction:exResourceExiled",
    reaction: { event: "exResourceExiled", subject: "friendly" },
    optional: true,
    actions: [{ op: "grantDamageModifier", target, amount: 3, scope: "turn", enemyOnly: true }],
    targetScope: "friendlyUnit",
    sourceText:
      "When one of your EX Resources is exiled from the game, you may choose 1 of your Units. During this turn, when it receives enemy damage, reduce it by 3.",
  },
  {
    id: "GD05-018-Deploy",
    cardCode: "GD05-018",
    trigger: "Deploy",
    actions: [{ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea", count: 3 }],
    sourceText: "【Deploy】Place 3 EX Resources.",
  },
];

import type { EffectSpec } from "../engine/effectSpec";

/**
 * Specs de texto padrão que se repetem em quase todo set. `hasBurst: true` sozinho não
 * basta: `burstEligibleShieldIds` (engine/dispatcher.ts) só oferece o 【Burst】 de um
 * Shield que tem EffectSpec de trigger "Burst" — sem o spec, o Burst simplesmente não
 * acontece (achado da auditoria por cláusula, W0.3).
 */

/** 【Burst】Add this card to your hand. */
export function stdAddToHandBurst(cardCode: string): EffectSpec {
  return {
    id: `${cardCode}-Burst`,
    cardCode,
    trigger: "Burst",
    actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
    sourceText: "【Burst】Add this card to your hand.",
  };
}

/** 【Burst】Deploy this card. (Base — `deployThisCard` aplica a regra de 1 Base e encadeia o 【Deploy】) */
export function stdDeployThisBurst(cardCode: string): EffectSpec {
  return {
    id: `${cardCode}-Burst`,
    cardCode,
    trigger: "Burst",
    actions: [{ op: "deployThisCard" }],
    sourceText: "【Burst】Deploy this card.",
  };
}

/** 【Main】/【Action】 no mesmo texto = 2 specs (`findTriggerSpecs` casa o gatilho exato — sem o de Main, jogar na Main Phase não faz nada) */
export function mainAndAction(base: Omit<EffectSpec, "id" | "trigger">): [EffectSpec, EffectSpec] {
  return [
    { ...base, id: `${base.cardCode}-Main`, trigger: "Main" },
    { ...base, id: `${base.cardCode}-Action`, trigger: "Action" },
  ];
}

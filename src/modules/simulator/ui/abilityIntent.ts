/* Sprint 6 · Etapa 3 — helpers pra ativar 【Activate·Main】 de uma carta JÁ EM
 * CAMPO (ex.: ST02-006 Tallgeese "④：Set this Unit as active"). O motor já sabe
 * resolver via `PlayerAction { kind: "activateAbility" }` — isto só decide, no
 * cliente, se o botão aparece e quanto custa. Puro/testável. */
import { ALL_EFFECT_SPECS } from "../content";
import type { EffectSpec } from "../engine/effectSpec";
import type { CardInstance } from "../engine/types";
import { specNeedsNamedTarget } from "./deployIntent";

const ACTIVATE_MAIN = "Activate·Main";

/** O EffectSpec de 【Activate·Main】 desta carta (por `code`), se houver. */
export function findActivateMainSpec(cardCode: string): EffectSpec | undefined {
  return ALL_EFFECT_SPECS.find((s) => s.cardCode === cardCode && s.trigger === ACTIVATE_MAIN);
}

/** Custo em recursos (`payResourceCost.n`) da habilidade — 0 se não tiver custo de recurso. */
export function abilityResourceCost(spec: EffectSpec): number {
  const call = spec.cost?.find((c) => c.op === "payResourceCost");
  return call && call.op === "payResourceCost" ? call.n : 0;
}

/** A habilidade custa "Rest this [carta]" (ex.: ST01-016 Asticassia) — se a carta já
 *  está rested, o custo não pode ser pago de novo (o motor rejeitaria a ação). */
function costRestsSelf(spec: EffectSpec): boolean {
  return Boolean(spec.cost?.some((c) => c.op === "rest" && c.target.kind === "self"));
}

export interface FieldAbility {
  spec: EffectSpec;
  cost: number;
  needsTarget: boolean;
}

/**
 * Descreve a 【Activate·Main】 disponível pra esta instância AGORA, ou `null`:
 * - carta própria com EffectSpec de Activate·Main;
 * - se `oncePerTurn`, ainda não usada neste turno.
 */
export function fieldAbilityFor(card: CardInstance): FieldAbility | null {
  const spec = findActivateMainSpec(card.def.code);
  if (!spec) return null;
  if (card.def.oncePerTurn && card.usedKeywordsThisTurn.includes(ACTIVATE_MAIN)) return null;
  if (card.rested && costRestsSelf(spec)) return null;
  return { spec, cost: abilityResourceCost(spec), needsTarget: specNeedsNamedTarget(spec) };
}

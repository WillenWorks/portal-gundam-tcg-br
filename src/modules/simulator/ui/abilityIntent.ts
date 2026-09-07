/* Sprint 6 · Etapa 3 — helpers pra ativar uma habilidade de carta JÁ EM CAMPO:
 * 【Activate·Main】 com EffectSpec (ex.: ST02-006 Tallgeese "④：Set this Unit as
 * active") OU a keyword de motor `<Support N>` (ex.: ST03-002 Angelo's Geara
 * Zulu, ST03-004 Gaza D), que não tem EffectSpec mas é resolvida pelo motor via
 * `activateSupport()` + `PlayerAction { kind: "activateAbility" }`. Isto só
 * decide, no cliente, se o botão aparece, quanto custa e se precisa de alvo.
 * Puro/testável. */
import { ALL_EFFECT_SPECS } from "../content";
import type { EffectSpec } from "../engine/effectSpec";
import type { CardInstance } from "../engine/types";
import { hasKeyword } from "../engine/types";
import { specNeedsNamedTarget } from "./deployIntent";

const ACTIVATE_MAIN = "Activate·Main";
const SUPPORT = "Support";

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
  /** origem da habilidade: EffectSpec de 【Activate·Main】 ou a keyword `<Support>`. */
  kind: "activateMain" | "support";
  cost: number;
  needsTarget: boolean;
}

/**
 * Descreve a habilidade de campo disponível pra esta instância AGORA, ou `null`:
 * - carta própria com EffectSpec de 【Activate·Main】 (se `oncePerTurn`, ainda não
 *   usada neste turno; se o custo é "rest this card", a carta não pode estar rested);
 * - Unit própria com `<Support N>` — o motor (`activateSupport`) cobra "rest this
 *   Unit" (0 recursos), mira em outra Unit amiga, e revalida tudo. Aqui: só
 *   aparece pra Unit active e, se `oncePerTurn`, ainda não usada neste turno.
 *
 * 【Activate·Main】 tem precedência: nenhuma carta de ST01–ST04 tem os dois, mas
 * se tivesse, o efeito bespoke é o que o texto descreve.
 */
export function fieldAbilityFor(card: CardInstance): FieldAbility | null {
  const spec = findActivateMainSpec(card.def.code);
  if (spec) {
    if (card.def.oncePerTurn && card.usedKeywordsThisTurn.includes(ACTIVATE_MAIN)) return null;
    if (card.rested && costRestsSelf(spec)) return null;
    return { kind: "activateMain", cost: abilityResourceCost(spec), needsTarget: specNeedsNamedTarget(spec) };
  }

  if (hasKeyword(card, SUPPORT) && card.def.cardType === "UNIT" && !card.rested) {
    if (card.def.oncePerTurn && card.usedKeywordsThisTurn.includes(SUPPORT)) return null;
    return { kind: "support", cost: 0, needsTarget: true };
  }

  return null;
}

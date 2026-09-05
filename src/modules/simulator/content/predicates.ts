import type { EffectContext, PredicateResolver, TargetFilterResolver } from "../engine/effectSpec";
import { findCard } from "../engine/events";
import { effectiveAp, effectiveHp, effectivePilotDef, satisfiesLinkCondition, type CardInstance, type GameState } from "../engine/types";

/**
 * `PredicateResolver` canônico pros predicados de `condition` já usados nos
 * EffectSpec reais de ST01/ST02 (docs/18, passo 3). Até agora só existe 1
 * família de predicado em uso — `pairedPilotHasTrait:<trait>` (ST01-002
 * Gundam MA Form, 【When Paired】) — mas isso ficava reimplementado ad-hoc
 * dentro de cada arquivo de teste que precisava disparar esse EffectSpec
 * (`st01VsSt02Match.test.ts`). Extraído aqui pra ser a MESMA função usada
 * pelos testes e pelo dispatcher real do servidor (`server/matchStore.ts`),
 * em vez de arriscar duas implementações divergentes do mesmo predicado.
 *
 * Novos predicados (se/quando aparecerem em cartas futuras) entram aqui,
 * não em mais um resolver local duplicado.
 */
export const defaultPredicateResolver: PredicateResolver = (predicate, ctx: EffectContext) => {
  const pairedPilotHasTrait = predicate.match(/^pairedPilotHasTrait:(.+)$/);
  if (pairedPilotHasTrait) {
    const source = findCard(ctx.state, ctx.sourceInstanceId);
    if (!source.pairedPilotId) return false;
    const pilot = findCard(ctx.state, source.pairedPilotId);
    return pilot.def.traits?.includes(pairedPilotHasTrait[1]) ?? false;
  }
  // ST02-016 Corsica Base — "if ... a card with 'Corsica Base' in its card name is in your trash".
  const cardInTrashNamed = predicate.match(/^cardInTrashNamed:(.+)$/);
  if (cardInTrashNamed) {
    return ctx.state.players[ctx.controller].trash.some((c) => c.def.nameEn.includes(cardInTrashNamed[1]));
  }
  // ST04-006 Aegis Gundam — 【Attack】"If this Unit has 5 or more AP, ...".
  const selfApAtLeast = predicate.match(/^selfApAtLeast:(\d+)$/);
  if (selfApAtLeast) {
    return effectiveAp(findCard(ctx.state, ctx.sourceInstanceId), ctx.state) >= Number(selfApAtLeast[1]);
  }
  // ST04-009 Miguel's Ginn — 【Destroyed】"If you have another Link Unit in play, draw 1."
  // "another" = qualquer Link Unit amiga na Battle Area que NÃO seja a fonte.
  if (predicate === "controllerHasOtherLinkUnit") {
    const owner = ctx.state.players[ctx.controller];
    return owner.battleArea.some((u) => u.instanceId !== ctx.sourceInstanceId && u.def.cardType === "UNIT" && isPairedLinkUnit(ctx.state, u));
  }
  // ST04-001 Aile Strike Gundam — 【When Paired･Lv.4 or Higher Pilot】.
  const pairedPilotLevelAtLeast = predicate.match(/^pairedPilotLevelAtLeast:(\d+)$/);
  if (pairedPilotLevelAtLeast) {
    const source = findCard(ctx.state, ctx.sourceInstanceId);
    if (!source.pairedPilotId) return false;
    const pilot = findCard(ctx.state, source.pairedPilotId);
    return (effectivePilotDef(pilot).level ?? 0) >= Number(pairedPilotLevelAtLeast[1]);
  }
  return false;
};

/** Uma Unit é "Link Unit" se tem Pilot pareado que satisfaz a link condition (mesma regra de `isLinkUnit` em effectSpec.ts / combat.ts). */
function isPairedLinkUnit(state: GameState, unit: CardInstance): boolean {
  if (!unit.pairedPilotId) return false;
  const pilot = findCard(state, unit.pairedPilotId);
  return satisfiesLinkCondition(effectivePilotDef(pilot), unit.def);
}

/** HP restante de verdade — HP efetivo (com buff/`During Pair`) menos o dano acumulado. Mesmo cálculo de `CardInspectorPanel`. */
function remainingHp(card: CardInstance, state: GameState): number {
  return Math.max(0, effectiveHp(card, state) - card.damage);
}

/**
 * `TargetFilterResolver` canônico (V0, docs/25) — mesmo espírito do
 * `defaultPredicateResolver` acima, só que resolvido POR CANDIDATO em vez de
 * pelo `EffectContext` inteiro. 3 famílias em uso hoje pelas cartas reais de
 * ST01/ST02 — `hp<=N` (Guntank/Amuro Ray/Siege Ploy), `level<=N` (Aerial
 * Score Six) e `rested` (Thoroughly Damaged, Suletta Mercury). Novo filtro
 * (carta futura) entra aqui, nunca como um hack local na UI.
 */
export const defaultTargetFilterResolver: TargetFilterResolver = (filter, candidate, ctx) => {
  const hpAtMost = filter.match(/^hp<=(\d+)$/);
  if (hpAtMost) return remainingHp(candidate, ctx.state) <= Number(hpAtMost[1]);

  const levelAtMost = filter.match(/^level<=(\d+)$/);
  if (levelAtMost) return (candidate.def.level ?? 0) <= Number(levelAtMost[1]);

  // ST04-006 Aegis Gundam — "enemy Unit that is Lv.5 or higher".
  const levelAtLeast = filter.match(/^level>=(\d+)$/);
  if (levelAtLeast) return (candidate.def.level ?? 0) >= Number(levelAtLeast[1]);

  // ST03-015 Rewloola — "enemy Unit with 5 or less AP".
  const apAtMost = filter.match(/^ap<=(\d+)$/);
  if (apAtMost) return effectiveAp(candidate, ctx.state) <= Number(apAtMost[1]);

  if (filter === "rested") return candidate.rested;

  return false;
};

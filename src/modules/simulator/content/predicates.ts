import type { EffectContext, PredicateResolver, TargetFilterResolver } from "../engine/effectSpec";
import { findCard } from "../engine/events";
import { effectiveHp, type CardInstance, type GameState } from "../engine/types";

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
  return false;
};

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

  if (filter === "rested") return candidate.rested;

  return false;
};

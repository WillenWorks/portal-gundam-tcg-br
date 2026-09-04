import type { EffectContext, PredicateResolver } from "../engine/effectSpec";
import { findCard } from "../engine/events";

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

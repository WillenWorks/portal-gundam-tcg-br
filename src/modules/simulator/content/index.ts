import type { EffectSpec } from "../engine/effectSpec";
import { ST01_EFFECT_SPECS } from "./st01";
import { ST02_EFFECT_SPECS } from "./st02";
import { ST03_EFFECT_SPECS } from "./st03";
import { ST04_EFFECT_SPECS } from "./st04";
import { ST06_EFFECT_SPECS } from "./st06";
import { GD01_EFFECT_SPECS, GD01_CARD_DEFS } from "./gd01";
import { GD02_EFFECT_SPECS, GD02_CARD_DEFS } from "./gd02";

export { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";
export { DEFERRED_CLAUSES, type DeferredClause } from "./deferred";
export { GD01_EFFECT_SPECS, GD01_CARD_DEFS } from "./gd01";
export { GD02_EFFECT_SPECS, GD02_CARD_DEFS } from "./gd02";
export { ST06_EFFECT_SPECS } from "./st06";
export {
  VALIDATED_DECKS,
  isValidatedDeck,
  validatedDeckList,
  deckListToLegalityItems,
  checkDeckListLegality,
  type ValidatedDeck,
} from "./validatedDecks";

/**
 * Todo EffectSpec real cadastrado até agora (ST01..ST04, ST06, GD01 e GD02).
 * Ponto único de agregação pra quem precisa da lista completa sem saber qual
 * carta é de qual produto — servidor (`server/matchStore.ts`), que dispatcha
 * triggers pra qualquer carta em jogo independente do deck de origem.
 */
export const ALL_EFFECT_SPECS: EffectSpec[] = [
  ...ST01_EFFECT_SPECS,
  ...ST02_EFFECT_SPECS,
  ...ST03_EFFECT_SPECS,
  ...ST04_EFFECT_SPECS,
  ...ST06_EFFECT_SPECS,
  ...GD01_EFFECT_SPECS,
  ...GD02_EFFECT_SPECS,
];

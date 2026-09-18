import type { EffectSpec } from "../engine/effectSpec";
import { ST01_EFFECT_SPECS } from "./st01";
import { ST02_EFFECT_SPECS } from "./st02";
import { ST03_EFFECT_SPECS } from "./st03";
import { ST04_EFFECT_SPECS } from "./st04";
import { ST05_EFFECT_SPECS } from "./st05";
import { ST06_EFFECT_SPECS } from "./st06";
import { ST07_EFFECT_SPECS } from "./st07";
import { ST08_EFFECT_SPECS } from "./st08";
import { GD01_EFFECT_SPECS, GD01_CARD_DEFS } from "./gd01";
import { GD02_EFFECT_SPECS, GD02_CARD_DEFS } from "./gd02";
import { GD03_EFFECT_SPECS, GD03_CARD_DEFS } from "./gd03";

export { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";
export { DEFERRED_CLAUSES, type DeferredClause } from "./deferred";
export { GD01_EFFECT_SPECS, GD01_CARD_DEFS } from "./gd01";
export { GD02_EFFECT_SPECS, GD02_CARD_DEFS } from "./gd02";
export { GD03_EFFECT_SPECS, GD03_CARD_DEFS } from "./gd03";
export { ST05_EFFECT_SPECS } from "./st05";
export { ST06_EFFECT_SPECS } from "./st06";
export { ST07_EFFECT_SPECS } from "./st07";
export { ST08_EFFECT_SPECS } from "./st08";
export {
  VALIDATED_DECKS,
  isValidatedDeck,
  validatedDeckList,
  deckListToLegalityItems,
  checkDeckListLegality,
  type ValidatedDeck,
} from "./validatedDecks";

/**
 * Todo EffectSpec real cadastrado até agora (ST01..ST08, GD01..GD03).
 * Ponto único de agregação pra quem precisa da lista completa sem saber qual
 * carta é de qual produto — servidor (`server/matchStore.ts`), que dispatcha
 * triggers pra qualquer carta em jogo independente do deck de origem.
 */
export const ALL_EFFECT_SPECS: EffectSpec[] = [
  ...ST01_EFFECT_SPECS,
  ...ST02_EFFECT_SPECS,
  ...ST03_EFFECT_SPECS,
  ...ST04_EFFECT_SPECS,
  ...ST05_EFFECT_SPECS,
  ...ST06_EFFECT_SPECS,
  ...ST07_EFFECT_SPECS,
  ...ST08_EFFECT_SPECS,
  ...GD01_EFFECT_SPECS,
  ...GD02_EFFECT_SPECS,
  ...GD03_EFFECT_SPECS,
];

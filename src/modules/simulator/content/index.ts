import type { EffectSpec } from "../engine/effectSpec";
import { ST01_EFFECT_SPECS } from "./st01";
import { ST02_EFFECT_SPECS } from "./st02";
import { ST03_EFFECT_SPECS } from "./st03";
import { ST04_EFFECT_SPECS } from "./st04";
import { ST05_EFFECT_SPECS } from "./st05";
import { GD01_EFFECT_SPECS, GD01_CARD_DEFS } from "./gd01";

export { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";
export { DEFERRED_CLAUSES, type DeferredClause } from "./deferred";
export { GD01_EFFECT_SPECS, GD01_CARD_DEFS } from "./gd01";
export {
  VALIDATED_DECKS,
  isValidatedDeck,
  validatedDeckList,
  deckListToLegalityItems,
  checkDeckListLegality,
  type ValidatedDeck,
} from "./validatedDecks";

/**
 * Todo EffectSpec real cadastrado até agora (ST01 + ST02 + ST03 + ST04 + ST05 +
 * GD01, docs/18 "Cobertura real" + docs/41 waves ST03/ST04 + GD01). Ponto único
 * de agregação pra quem precisa da lista completa sem saber qual carta é de
 * qual produto — hoje só o servidor (`server/matchStore.ts`), que dispatcha
 * triggers pra qualquer carta em jogo independente do deck de origem.
 */
export const ALL_EFFECT_SPECS: EffectSpec[] = [
  ...ST01_EFFECT_SPECS,
  ...ST02_EFFECT_SPECS,
  ...ST03_EFFECT_SPECS,
  ...ST04_EFFECT_SPECS,
  ...ST05_EFFECT_SPECS,
  ...GD01_EFFECT_SPECS,
];

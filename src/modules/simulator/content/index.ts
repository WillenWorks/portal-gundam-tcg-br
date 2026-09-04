import type { EffectSpec } from "../engine/effectSpec";
import { ST01_EFFECT_SPECS } from "./st01";
import { ST02_EFFECT_SPECS } from "./st02";

export { defaultPredicateResolver } from "./predicates";

/**
 * Todo EffectSpec real cadastrado até agora (18 ST01 + 13 ST02, docs/18
 * "Cobertura real" + "Agente 1 — fechamento das 8 lacunas de DSL"). Ponto único de agregação pra quem precisa da lista
 * completa sem saber qual carta é de qual produto — hoje só o servidor
 * (`server/matchStore.ts`), que dispatcha triggers pra qualquer carta em
 * jogo independente do deck de origem.
 */
export const ALL_EFFECT_SPECS: EffectSpec[] = [...ST01_EFFECT_SPECS, ...ST02_EFFECT_SPECS];

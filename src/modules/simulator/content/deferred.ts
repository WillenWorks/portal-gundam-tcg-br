/**
 * Registro tipado de CLÁUSULAS DEFERIDAS (docs/46 demanda 11 / Fase 4 §6.2).
 *
 * Cada entrada marca um trecho do texto oficial EN de uma carta que o motor
 * ainda NÃO cobre — de propósito, não por esquecimento. Serve de checkpoint
 * honesto de cobertura: impede que uma carta com cláusula deferida seja
 * marcada como "pronta" só porque tem um EffectSpec parcial.
 *
 * Este arquivo é só o STUB (lista vazia + tipo + teste de estrutura). A Lane
 * 1B popula `DEFERRED_CLAUSES` conforme audita carta a carta.
 */
export interface DeferredClause {
  cardCode: string;
  clause: string; // trecho do texto EN oficial
  reason: string; // por que não foi coberto
  blockedBy: string; // ex. "engine:sem-escolha-de-alvo-em-combate"
}

export const DEFERRED_CLAUSES: readonly DeferredClause[] = [] as const;

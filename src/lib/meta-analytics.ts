/**
 * Anaheim Tactical Meta Intelligence (ATMI) — Módulo Analítico & Estatístico.
 *
 * Fornece algoritmos matemáticos auditados para análise de metagame,
 * classificação de cartas em quadrantes (Core, Staple, Flex, Tech),
 * distribuição hipergeométrica de mãos iniciais e cálculo de Lift/sinergia.
 */

export type MetaCardQuadrant = "CORE" | "STAPLE" | "FLEX" | "TECH";

export interface MetaClassificationInput {
  inclusionRate: number; // 0 a 1 (percentual de decks do arquétipo que contêm a carta)
  affinity: number; // Razão IR(Arquétipo) / IR(Cor Global)
  colorInclusionRate?: number; // 0 a 1 (presença global na cor)
  meanCopies?: number; // Média de cópias nas listas que utilizam a carta
  stdDevCopies?: number; // Desvio padrão de cópias
}

export interface HypergeometricResult {
  exact: number; // P(X = k)
  atLeast: number; // P(X >= k)
  withMulligan: number; // P(X >= k) considerando 1 mulligan total
}

/**
 * Combinação simples C(n, k) = n! / (k! * (n - k)!).
 * Implementada com produto de razões para evitar estouro de ponto flutuante.
 */
export function combination(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n / 2) k = n - k;
  let res = 1;
  for (let i = 1; i <= k; i++) {
    res = (res * (n - i + 1)) / i;
  }
  return Math.round(res);
}

/**
 * Calcula a probabilidade hipergeométrica exata para um baralho.
 *
 * @param populationSize Tamanho total do deck (ex: 50 cartas)
 * @param totalSuccesses Número de cópias do alvo no deck (ex: 4 cópias)
 * @param sampleSize Tamanho da mão comprada (ex: 5 cartas iniciais)
 * @param targetCount Quantidade desejada (ex: 1 para pelo menos 1 cópia)
 */
export function calculateHypergeometric(
  populationSize: number,
  totalSuccesses: number,
  sampleSize: number,
  targetCount: number = 1,
): HypergeometricResult {
  if (populationSize <= 0 || sampleSize <= 0) {
    return { exact: 0, atLeast: 0, withMulligan: 0 };
  }
  if (totalSuccesses <= 0) {
    return {
      exact: targetCount === 0 ? 1 : 0,
      atLeast: targetCount === 0 ? 1 : 0,
      withMulligan: targetCount === 0 ? 1 : 0,
    };
  }

  const N = Math.max(1, populationSize);
  const K = Math.min(N, Math.max(0, totalSuccesses));
  const n = Math.min(N, Math.max(0, sampleSize));
  const k = Math.max(0, targetCount);

  const totalCombinations = combination(N, n);
  if (totalCombinations === 0) {
    return { exact: 0, atLeast: 0, withMulligan: 0 };
  }

  // P(X = k)
  const exactWays = combination(K, k) * combination(N - K, n - k);
  const exact = totalCombinations > 0 ? exactWays / totalCombinations : 0;

  // P(X >= k) = soma_{x=k}^{min(n, K)} P(X = x)
  let atLeastWays = 0;
  const maxPossible = Math.min(n, K);
  for (let x = k; x <= maxPossible; x++) {
    atLeastWays += combination(K, x) * combination(N - K, n - x);
  }
  const atLeast = totalCombinations > 0 ? atLeastWays / totalCombinations : 0;

  // Mulligan: se o jogador não comprou na 1ª mão (P(0)), ele devolve, embaralha e tenta de novo.
  // P(mulligan_success) = 1 - P(falha_1) * P(falha_2) = 1 - (1 - atLeast)^2
  const failureProb = Math.max(0, 1 - atLeast);
  const withMulligan = 1 - failureProb * failureProb;

  return {
    exact: Math.min(1, Math.max(0, Number(exact.toFixed(4)))),
    atLeast: Math.min(1, Math.max(0, Number(atLeast.toFixed(4)))),
    withMulligan: Math.min(1, Math.max(0, Number(withMulligan.toFixed(4)))),
  };
}

/**
 * Coeficiente de Rigidez de Slot (Slot Rigidity - CR):
 * Mede a consistência ou consenso do número de cópias usadas pelos pilotos.
 * CR = 1 - (stdDev / mean).
 * Valores próximos a 1.0 indicam consenso estrito (ex: todos usam 4x).
 */
export function computeSlotRigidity(mean: number, stdDev: number): number {
  if (mean <= 0) return 0;
  const rigidity = 1 - stdDev / mean;
  return Math.max(0, Math.min(1, Number(rigidity.toFixed(2))));
}

/**
 * Classifica a carta em um dos 4 quadrantes táticos do metagame:
 * - CORE: Identidade exclusiva do arquétipo (alta presença e alta afinidade).
 * - STAPLE: Eficiência universal da cor (alta presença no formato como um todo).
 * - FLEX: Suporte de curva e preenchimento tático oscilante.
 * - TECH: Resposta situacional ao metagame (poucas cópias e uso pontual).
 */
export function classifyMetaCard(input: MetaClassificationInput): MetaCardQuadrant {
  const { inclusionRate, affinity, colorInclusionRate = 0, meanCopies = 1 } = input;

  // 1. Core do Arquétipo: alta frequência local e afinidade desproporcional à cor
  if (inclusionRate >= 0.70 && affinity >= 1.25) {
    return "CORE";
  }

  // 2. Staples de Formato/Cor: onipresente em decks da mesma cor, independente do arquétipo
  if (
    (inclusionRate >= 0.65 && affinity < 1.25) ||
    (colorInclusionRate >= 0.60 && inclusionRate >= 0.50)
  ) {
    return "STAPLE";
  }

  // 3. Tech Options: uso situacional (8% a 40%) com quantidade moderada/baixa
  if (inclusionRate < 0.40 && meanCopies <= 2.5) {
    return "TECH";
  }

  // 4. Suporte / Flex: cartas de sustentação de curva (40% a 70% de presença)
  return "FLEX";
}

/**
 * Métrica de Lift para Regras de Associação entre pares de cartas (A e B):
 * Lift(A -> B) = P(A e B) / (P(A) * P(B)).
 * - Lift > 1.0: Associação positiva (sinergia tática).
 * - Lift > 1.8: Forte sinergia (ex: Unidade + Piloto correspondente com Link).
 * - Lift < 1.0: Substitutos ou cartas que competem pelo mesmo slot.
 */
export function computePairwiseLift(pBoth: number, pA: number, pB: number): number {
  if (pA <= 0 || pB <= 0) return 1.0;
  const lift = pBoth / (pA * pB);
  return Number(lift.toFixed(2));
}

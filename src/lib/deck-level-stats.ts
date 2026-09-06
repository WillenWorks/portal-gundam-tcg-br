/** Estatísticas de nível do deck principal para o Deckbuilder (docs/38 §5).
 *
 *  - Curva de nível: distribuição das Units por Lv., com Lv.6+ agrupado.
 *  - Abertura sólida: chance de comprar pelo menos 1 Unit de nível baixo
 *    (Lv.1 a Lv.3) na mão inicial de 5 cartas — mesma leitura hipergeométrica
 *    do card "Mão inicial", que hoje só olha custo.
 */

export const OPENING_HAND_SIZE = 5;

/** Menor nível considerado "abertura" — Units Lv.1..Lv.3 costumam entrar no turno 1-3. */
export const LOW_LEVEL_MAX = 3;

/** A partir daqui a curva agrupa tudo numa única barra "6+". */
export const LEVEL_CURVE_TOP_BUCKET = 6;

export type LevelCurveRow = { level: string; quantity: number };

type UnitLike = { type?: string | null; level?: number | null; quantity?: number | null };

function isUnit(type: string | null | undefined): boolean {
  return (type ?? "").toUpperCase() === "UNIT";
}

/** P(pelo menos 1 sucesso numa amostra sem reposição) — hipergeométrica. */
export function hypergeometricAtLeastOne(populationSize: number, successCount: number, drawSize: number): number {
  if (populationSize <= 0 || successCount <= 0 || drawSize <= 0) return 0;
  if (successCount >= populationSize) return 1;
  const draws = Math.min(drawSize, populationSize);
  let probabilityOfZero = 1;
  for (let i = 0; i < draws; i++) {
    const remainingFailures = populationSize - successCount - i;
    if (remainingFailures < 0) return 1;
    probabilityOfZero *= remainingFailures / (populationSize - i);
  }
  return 1 - probabilityOfZero;
}

/** Distribuição das Units por nível. Sempre devolve as 6 faixas (1..5 e "6+"),
 *  com zeros, pra a curva ficar legível mesmo em decks parciais. Cartas sem
 *  nível ou que não são Unit são ignoradas. */
export function buildLevelCurve(rows: UnitLike[]): LevelCurveRow[] {
  const buckets = new Map<string, number>();
  for (let lv = 1; lv < LEVEL_CURVE_TOP_BUCKET; lv++) buckets.set(String(lv), 0);
  buckets.set(`${LEVEL_CURVE_TOP_BUCKET}+`, 0);

  for (const row of rows) {
    if (!isUnit(row.type)) continue;
    if (typeof row.level !== "number" || !Number.isFinite(row.level) || row.level < 1) continue;
    const qty = typeof row.quantity === "number" ? row.quantity : 0;
    const key = row.level >= LEVEL_CURVE_TOP_BUCKET ? `${LEVEL_CURVE_TOP_BUCKET}+` : String(row.level);
    buckets.set(key, (buckets.get(key) ?? 0) + qty);
  }

  return Array.from(buckets.entries()).map(([level, quantity]) => ({ level, quantity }));
}

export type LowLevelUnitStats = {
  lowLevelUnitCount: number;
  openingHand: number;
  withMulligan: number;
};

/** Quantas Units Lv.1..3 há no principal e a chance de abrir com pelo menos uma. */
export function lowLevelUnitStats(rows: UnitLike[], mainDeckCount: number): LowLevelUnitStats {
  const lowLevelUnitCount = rows.reduce((sum, row) => {
    if (!isUnit(row.type)) return sum;
    if (typeof row.level !== "number" || row.level < 1 || row.level > LOW_LEVEL_MAX) return sum;
    return sum + (typeof row.quantity === "number" ? row.quantity : 0);
  }, 0);

  const openingHand = hypergeometricAtLeastOne(mainDeckCount, lowLevelUnitCount, OPENING_HAND_SIZE);
  const withMulligan = 1 - (1 - openingHand) * (1 - openingHand);
  return { lowLevelUnitCount, openingHand, withMulligan };
}

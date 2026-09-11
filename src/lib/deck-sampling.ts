/** Amostragem sem reposição de uma população de cartas do deck (mão inicial, Monte
 *  Carlo de abertura, etc.) — extraído de OpeningHandModal pra virar fonte única
 *  reaproveitável tanto pela UI quanto pelo motor estatístico (opening-hand-score.ts). */

export function buildDeckPopulation<T extends { quantity: number }>(rows: T[]): T[] {
  const population: T[] = [];
  rows.forEach((row) => {
    for (let i = 0; i < (row.quantity || 1); i++) {
      population.push(row);
    }
  });
  return population;
}

export function shuffleDraw<T>(population: T[], count: number): T[] {
  const pool = [...population];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

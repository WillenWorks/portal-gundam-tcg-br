type NewestRow = { code: string; createdAt: Date };

const utcDay = (date: Date) => date.toISOString().slice(0, 10);

/** Dia de cadastro mais novo primeiro e, dentro do dia, código crescente: as LR da coleção abrem a lista. */
export function sortNewestFirstByCode<T extends NewestRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => utcDay(b.createdAt).localeCompare(utcDay(a.createdAt)) || a.code.localeCompare(b.code));
}

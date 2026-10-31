/**
 * Fonte única das temporadas competitivas (formatos GDxx). Usada pelo servidor, pelas telas e pelos scripts
 * (Node 24 importa `.ts` direto — por isso só sintaxe apagável: nada de enum/namespace).
 *
 * Os dados ficam em `seasons.json` (lido também por script que roda sem suporte a `.ts`). Set novo: acrescentar a
 * temporada em `seasons`. A coleta diária (`prisma/import-tournaments.mjs`) cria a Season no
 * banco e marca a última como atual. Quando o formato novo tiver listas suficientes, trocar `defaultAnalysisSeason`.
 */

import data from "./seasons.json" with { type: "json" };

export type SeasonInfo = { code: string; name: string; startDate: string };

/** Lançamento oficial (EN) de cada coleção, em ordem; a temporada vai até a véspera da próxima (`seasons.json`). */
export const SEASONS: readonly SeasonInfo[] = data.seasons;

export const SEASON_CODES: readonly string[] = SEASONS.map((s) => s.code);

/** Temporada mais recente lançada (a "atual" no banco) */
export const LATEST_SEASON: string = SEASON_CODES[SEASON_CODES.length - 1];

/**
 * Temporada que as telas de análise (Stats, Veda, núcleos) abrem por padrão. Fica um formato atrás do lançamento
 * até o novo juntar listas (decisão de 2026-10-31: GD06 vira padrão com ~30 listas).
 */
export const DEFAULT_ANALYSIS_SEASON: string = data.defaultAnalysisSeason;

/** Recortes de um formato a partir de uma data (ex.: GD05.5 = GD05 depois do ST11–ST14) */
export const SEASON_SLICES: readonly { id: string; format: string; since: string }[] = data.slices;

/** Grafias antigas/recortes que contam como o próprio formato nas leituras */
const ALIASES: Record<string, string> = {
  GD05_COMBINED: "GD05",
  "GD05/GD05.5": "GD05",
  "GD05_GD05.5": "GD05",
  "GD05+GD05.5": "GD05",
};
for (const slice of SEASON_SLICES) ALIASES[slice.id] = slice.format;

/** Formato de que um apelido/recorte faz parte ("GD05.5" → "GD05"); null se não for apelido */
export function seasonAlias(code: string | null | undefined): string | null {
  if (!code) return null;
  return ALIASES[code.trim().toUpperCase().replace(/\s+/g, "")] ?? null;
}

/** "gd05.5" → "GD05", "GD05_COMBINED" → "GD05", "GD04" → "GD04"; null/vazio → null; o resto volta em maiúsculas */
export function normalizeSeasonCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const key = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!key) return null;
  return ALIASES[key] ?? key;
}

export function isSeasonCode(code: string | null | undefined): boolean {
  const normalized = normalizeSeasonCode(code);
  return normalized !== null && SEASON_CODES.includes(normalized);
}

/** Temporadas da mais nova para a mais antiga (ordem dos seletores) */
export function seasonsNewestFirst(): SeasonInfo[] {
  return [...SEASONS].reverse();
}

/** Temporada vigente numa data ISO (AAAA-MM-DD…); antes do GD01 → null */
export function seasonForDate(date: string | null | undefined): string | null {
  if (!date) return null;
  let season: string | null = null;
  for (const s of SEASONS) if (date >= s.startDate) season = s.code;
  return season;
}

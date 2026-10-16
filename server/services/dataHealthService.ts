/**
 * Saúde da coleta de torneios (Command Center → Workflows). A coleta roda todo dia no Actions (Dados do site) e o
 * importador regrava os torneios recentes de cada fonte, então o `updatedAt` mais novo de uma fonte é a hora da
 * última importação que deu certo. Sem importar há mais de STALE_AFTER_MS, a fonte aparece como atrasada.
 */
export const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

const COLLECTED_SOURCES = [
  { id: "egman", name: "Egman Events", host: "egmanevents.com" },
  { id: "digilab", name: "DigiLab", host: "digilab.cards" },
] as const;

export interface TournamentHealthRow {
  sourceUrl: string | null;
  updatedAt: Date;
  dateStart: Date | null;
}

export interface SourceHealth {
  id: string;
  name: string;
  tournaments: number;
  lastImportAt: string | null;
  lastEventDate: string | null;
  stale: boolean;
}

export interface WorkflowRunInfo {
  status: string;
  conclusion: string | null;
  createdAt: string;
  url: string;
  event: string;
}

export interface DataHealthResponse {
  staleAfterHours: number;
  stale: boolean;
  sources: SourceHealth[];
  workflow: { lastRun: WorkflowRunInfo | null; lastSuccessAt: string | null } | null;
}

export function sourceHealth(rows: TournamentHealthRow[], now: number): SourceHealth[] {
  return COLLECTED_SOURCES.map((src) => {
    const mine = rows.filter((r) => r.sourceUrl?.includes(src.host));
    const lastImport = mine.reduce<number | null>((max, r) => Math.max(max ?? 0, r.updatedAt.getTime()), null);
    const lastEvent = mine.reduce<number | null>((max, r) => (r.dateStart ? Math.max(max ?? 0, r.dateStart.getTime()) : max), null);
    return {
      id: src.id,
      name: src.name,
      tournaments: mine.length,
      lastImportAt: lastImport ? new Date(lastImport).toISOString() : null,
      lastEventDate: lastEvent ? new Date(lastEvent).toISOString().slice(0, 10) : null,
      stale: lastImport == null || now - lastImport > STALE_AFTER_MS,
    };
  });
}

/** runs do GitHub (mais novo primeiro) → último run e a última vez que terminou bem */
export function summarizeRuns(
  runs: Array<{ status: string; conclusion: string | null; created_at: string; html_url: string; event: string }>,
): { lastRun: WorkflowRunInfo | null; lastSuccessAt: string | null } {
  const last = runs[0];
  return {
    lastRun: last ? { status: last.status, conclusion: last.conclusion, createdAt: last.created_at, url: last.html_url, event: last.event } : null,
    lastSuccessAt: runs.find((r) => r.conclusion === "success")?.created_at ?? null,
  };
}

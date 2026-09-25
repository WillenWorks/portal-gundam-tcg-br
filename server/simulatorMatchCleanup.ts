const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** terminada: a linha só serve pra reconectar e ver o placar final (o dataset fica em `SimulatorMatchLog`) */
export const FINISHED_MATCH_RETENTION_MS = DAY_MS;
/** não terminada e sem nenhuma escrita: partida abandonada (ex.: servidor reiniciou no meio e ninguém voltou) */
export const ABANDONED_MATCH_RETENTION_MS = 7 * DAY_MS;
export const SIMULATOR_MATCH_PURGE_INTERVAL_MS = 6 * HOUR_MS;

export function simulatorMatchPurgeWhere(now: Date) {
  return {
    OR: [
      { finishedAt: { lt: new Date(now.getTime() - FINISHED_MATCH_RETENTION_MS) } },
      { finishedAt: null, updatedAt: { lt: new Date(now.getTime() - ABANDONED_MATCH_RETENTION_MS) } },
    ],
  };
}

interface SimulatorMatchDeleter {
  deleteMany(args: { where: ReturnType<typeof simulatorMatchPurgeWhere> }): Promise<{ count: number }>;
}

export async function purgeStaleSimulatorMatches(table: SimulatorMatchDeleter, now = new Date()): Promise<number> {
  try {
    const { count } = await table.deleteMany({ where: simulatorMatchPurgeWhere(now) });
    return count;
  } catch (err) {
    console.warn("[simulator] limpeza de partidas antigas falhou — tenta de novo no próximo ciclo", err);
    return 0;
  }
}

/**
 * docs/44 Fase 3 §5.1 — peças puras/testáveis da captura de bug report que o
 * `server/index.ts` costura na rota `POST /api/simulator/matches/:id/report`:
 * rate-limit por reporter, checagem de "pode reportar?" (guest não pode) e a
 * montagem do `repository_dispatch`. A gravação em si (Prisma) fica no
 * `setBugReportSink` do server, que não dá pra testar sem subir o app inteiro.
 */

export const BUG_REPORT_RATE_LIMIT = 5;
export const BUG_REPORT_RATE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Rate-limit in-memory (basta nesta fase — docs/44): no máx. `limit` relatos
 * por `windowMs` por reporterId. `check` só olha; `record` grava o hit. Separar
 * os dois deixa a rota não "gastar" uma cota quando o report falha (partida
 * inexistente, 403, etc.).
 */
export function createBugReportRateLimiter(limit = BUG_REPORT_RATE_LIMIT, windowMs = BUG_REPORT_RATE_WINDOW_MS) {
  const hitsByReporter = new Map<string, number[]>();

  function recent(reporterId: string, now: number): number[] {
    const kept = (hitsByReporter.get(reporterId) ?? []).filter((at) => now - at < windowMs);
    hitsByReporter.set(reporterId, kept);
    return kept;
  }

  return {
    /** `true` = já bateu o teto na janela atual (a rota deve responder 429). */
    isLimited(reporterId: string, now: number = Date.now()): boolean {
      return recent(reporterId, now).length >= limit;
    },
    /** registra um envio bem-sucedido. */
    record(reporterId: string, now: number = Date.now()): void {
      const kept = recent(reporterId, now);
      kept.push(now);
      hitsByReporter.set(reporterId, kept);
    },
    /** só teste. */
    _reset(): void {
      hitsByReporter.clear();
    },
  };
}

export interface BugReportRequester {
  userId?: string | null;
  guest?: boolean;
}

/** Guest (desafio por link, sem cadastro) NÃO reporta — precisa de conta. */
export function canSubmitBugReport(user: BugReportRequester | undefined | null): boolean {
  return Boolean(user?.userId) && user?.guest !== true;
}

export interface GithubDispatchConfig {
  token: string;
  repo: string;
}

export interface GithubDispatchRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * Monta o `POST .../dispatches` que acorda o workflow de triagem (Wave 3).
 * `null` quando não há `token` — o gate do docs/44 é justamente "sem token, só
 * loga e NÃO falha" (o workflow ainda nem existe).
 */
export function buildGithubDispatchRequest(shortCode: string, config: GithubDispatchConfig): GithubDispatchRequest | null {
  if (!config.token) return null;
  return {
    url: `https://api.github.com/repos/${config.repo}/dispatches`,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ event_type: "bug-report", client_payload: { shortCode } }),
  };
}

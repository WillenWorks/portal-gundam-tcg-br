import type { Options } from "express-rate-limit";

// Teto um pouco acima do limite do nginx (20 req/s por IP + burst de 80 em /api/): na VPS quem barra primeiro
// continua sendo o nginx, e este limite é a segunda camada — vale também se a API rodar sem o nginx na frente,
// e cobre toda rota nova de /api sem precisar lembrar de proteger uma a uma.
export const API_RATE_LIMIT_PER_MINUTE = 1500;
export const API_RATE_LIMIT_WINDOW_MS = 60_000;

/** Opções do limite por IP de toda a /api — o `rateLimit(...)` é chamado em `index.ts` com elas. */
export function apiRateLimitOptions({
  limit = API_RATE_LIMIT_PER_MINUTE,
  windowMs = API_RATE_LIMIT_WINDOW_MS,
}: { limit?: number; windowMs?: number } = {}): Partial<Options> {
  return {
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // o socket do simulador (socket.io) não passa pelo Express; aqui só sobra a API HTTP
    skip: (req) => !req.path.startsWith("/api/"),
    message: { error: "Muitas requisições. Aguarde um instante e tente de novo." },
  };
}

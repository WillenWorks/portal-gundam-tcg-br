/* Estado da sessão conferido no banco a cada requisição autenticada.
 *
 * O JWT vale 7 dias e carrega o papel do usuário. Sem esta checagem, banir, rebaixar ou trocar a senha de
 * alguém só tinha efeito quando o token vencia. Agora:
 * - conta desativada → o token deixa de valer;
 * - papel e flag de organizador vêm do banco, não do token;
 * - trocar ou redefinir a senha aumenta `tokenVersion`, e tokens antigos (com outra `tv`) deixam de valer.
 *
 * O estado fica em cache por 60 s por usuário (uma consulta por minuto por pessoa ativa, não por requisição);
 * mudanças feitas pela própria API chamam `invalidate` e valem na hora. */

export type SessionState = {
  isActive: boolean;
  role: string;
  isHoster: boolean;
  tokenVersion: number;
};

export type SessionVerdict = "ok" | "inactive" | "revoked";

const MAX_ENTRIES = 5000;

export function createSessionStateCache(
  load: (userId: string) => Promise<SessionState | null>,
  ttlMs = 60_000,
  now: () => number = Date.now,
) {
  const cache = new Map<string, { at: number; state: Promise<SessionState | null> }>();
  return {
    get(userId: string): Promise<SessionState | null> {
      const hit = cache.get(userId);
      if (hit && now() - hit.at < ttlMs) return hit.state;
      const state = load(userId).catch((error) => {
        cache.delete(userId);
        throw error;
      });
      cache.set(userId, { at: now(), state });
      if (cache.size > MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      return state;
    },
    invalidate(userId: string) {
      cache.delete(userId);
    },
    size() {
      return cache.size;
    },
  };
}

/** `tv` ausente = token emitido antes desta checagem existir; vale enquanto a versão no banco for 0. */
export function checkSession(tokenVersionInToken: number | undefined, state: SessionState | null): SessionVerdict {
  if (!state || !state.isActive) return "inactive";
  if ((tokenVersionInToken ?? 0) !== state.tokenVersion) return "revoked";
  return "ok";
}

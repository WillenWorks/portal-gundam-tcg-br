/* Autenticação da API: token JWT + conferência da sessão no banco.
 *
 * `createAuth` monta os middlewares a partir do segredo do JWT e de uma função que lê o estado da conta
 * (ativa, papel, organizador, versão da senha). Sem dependência direta do Prisma: o index.ts passa a
 * consulta, e os testes passam uma função falsa. */
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { checkSession, createSessionStateCache, type SessionState } from "./sessionState.ts";

export type AuthPayload = {
  userId: string;
  role: UserRole;
  email: string;
  username: string;
  isHoster: boolean;
  /** versão da senha quando o token foi emitido (ver server/sessionState.ts); tokens antigos não têm */
  tv?: number;
};

export type RequestWithUser = Request & { user?: AuthPayload };

export type AuthOptions = {
  jwtSecret: string;
  /** Lê do banco o estado atual da conta; `null` = conta não existe mais. */
  loadSessionState: (userId: string) => Promise<SessionState | null>;
  /** Tempo do cache do estado da sessão (padrão do sessionState.ts). */
  sessionTtlMs?: number;
  tokenExpiresIn?: jwt.SignOptions["expiresIn"];
};

export function createAuth({ jwtSecret, loadSessionState, sessionTtlMs, tokenExpiresIn = "7d" }: AuthOptions) {
  const sessions = createSessionStateCache(loadSessionState, sessionTtlMs);

  function signToken(payload: AuthPayload) {
    return jwt.sign(payload, jwtSecret, { expiresIn: tokenExpiresIn });
  }

  /** Confere no banco (cache de 60 s) se a conta segue ativa e se o token é de depois da última troca de senha;
   *  papel e flag de organizador passam a vir do banco. Banco fora do ar → segue com o que o token diz. */
  async function resolveSession(payload: AuthPayload): Promise<AuthPayload | "inactive" | "revoked"> {
    let state;
    try {
      state = await sessions.get(payload.userId);
    } catch (error) {
      console.warn("[auth] estado da sessão indisponível — usando o token", error instanceof Error ? error.message : error);
      return payload;
    }
    const verdict = checkSession(payload.tv, state);
    if (verdict !== "ok") return verdict;
    return { ...payload, role: state!.role as UserRole, isHoster: state!.isHoster };
  }

  async function authRequired(req: RequestWithUser, res: Response, next: NextFunction) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Token ausente." });
    let payload: AuthPayload;
    try {
      payload = jwt.verify(auth.slice(7), jwtSecret) as AuthPayload;
    } catch {
      return res.status(401).json({ error: "Token inválido." });
    }
    const session = await resolveSession(payload);
    if (session === "inactive") return res.status(401).json({ error: "Conta sem acesso ativo." });
    if (session === "revoked") return res.status(401).json({ error: "Sessão encerrada. Entre de novo." });
    req.user = session;
    next();
  }

  /** Como authRequired, mas não bloqueia se não tiver token — só preenche req.user
   *  quando o token existe e é válido. Usado em rotas públicas onde o dono logado
   *  deve enxergar mais do que um visitante anônimo (ex: pasta privada só pro dono). */
  async function authOptional(req: RequestWithUser, _res: Response, next: NextFunction) {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      try {
        const session = await resolveSession(jwt.verify(auth.slice(7), jwtSecret) as AuthPayload);
        if (typeof session !== "string") req.user = session;
      } catch { /* token invalido, segue como anonimo */ }
    }
    next();
  }

  function roleRequired(roles: UserRole[]) {
    return (req: RequestWithUser, res: Response, next: NextFunction) => {
      if (!req.user) return res.status(401).json({ error: "Não autenticado." });
      if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Sem permissão." });
      next();
    };
  }

  /** Libera pra quem tem a flag isHoster (concedida pelo admin) ou é ADMIN direto --
   *  diferente de roleRequired porque isHoster não é um degrau de UserRole, é uma
   *  capacidade extra concedida por fora (um EDITOR ou USER comum pode virar Hoster
   *  sem mudar de role). Ownership de um evento específico (só o próprio hoster ou um
   *  ADMIN pode editar/apagar) é checado à parte, dentro de cada rota. */
  function hosterRequired(req: RequestWithUser, res: Response, next: NextFunction) {
    if (!req.user) return res.status(401).json({ error: "Não autenticado." });
    if (!req.user.isHoster && req.user.role !== "ADMIN") return res.status(403).json({ error: "Sem permissão de organizador." });
    next();
  }

  return { sessions, signToken, resolveSession, authRequired, authOptional, roleRequired, hosterRequired };
}

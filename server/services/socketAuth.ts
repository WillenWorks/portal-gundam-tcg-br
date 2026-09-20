/**
 * Handshake Socket.io + registro de sockets por usuário — compartilhado entre
 * `server/simulatorSocket.ts` (1v1) e `server/simulatorSocket4p.ts` (Arena
 * 4P), que tinham esse handshake e a lógica de `Map<string, Set<Socket>>`
 * praticamente duplicados letra por letra (achado de auditoria de
 * arquitetura, 2026-09-20).
 *
 * Extraído pra cá em vez de ficar em `server/services/` com sufixo `*Service`
 * porque não é um serviço de domínio (não fala com API externa nem faz fetch
 * de dado) — é infraestrutura pura de rede reusada pelos dois arquivos
 * `server/simulatorSocket*.ts`. Mora em `server/services/` só pela convenção
 * de "coisas Node-only compartilhadas ficam aqui" já estabelecida pelos
 * outros arquivos da pasta.
 *
 * Contrato preservado EXATAMENTE igual ao que cada arquivo tinha antes desta
 * extração (mesma ordem de tentativa token → guestToken → guest novo, mesmo
 * TTL "12h", mesmo fallback de displayName) — só elimina a duplicação de
 * código, não muda regra de negócio.
 */
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";

/** TTL padrão do guestId efêmero assinado — mesmo valor usado hoje pelos dois sockets (1v1 e Arena 4P). */
export const DEFAULT_GUEST_TOKEN_TTL = "12h";

export interface SocketAuthUser {
  userId: string;
  displayName: string;
  guest: boolean;
}

/**
 * Formato mínimo que `socket.data` precisa ter pro middleware funcionar.
 * Cada arquivo pode estender esse tipo com campos próprios (ex.: `matchId`,
 * `seat`, `challengeCode` em `simulatorSocket.ts`) — o middleware só lê/escreve
 * `user` e `freshGuestToken`.
 */
export interface SocketAuthData {
  user: SocketAuthUser;
  freshGuestToken?: string;
}

export interface SocketAuthDeps {
  jwtSecret: string;
  /** Default `"12h"` (`DEFAULT_GUEST_TOKEN_TTL`) — nenhum dos dois sockets usa um valor diferente hoje, mas fica configurável caso um dia precisem divergir. */
  guestTokenTtl?: string;
}

/**
 * Middleware de handshake `io.use(...)`: tenta `auth.token` (JWT de usuário
 * cadastrado), cai pro `auth.guestToken` (guest reconectando) e, se nenhum
 * dos dois validar, gera um guestId novo + `freshGuestToken` assinado (que o
 * `connection` handler de cada arquivo deve emitir via `session:guest`).
 *
 * Nunca rejeita a conexão (nunca chama `next(err)`) — token/guestToken
 * inválido só faz cair pro próximo fluxo, igual ao comportamento original dos
 * dois arquivos.
 */
export function createSocketAuthMiddleware(
  deps: SocketAuthDeps,
): (socket: Socket, next: (err?: Error) => void) => void {
  const guestTokenTtl = deps.guestTokenTtl ?? DEFAULT_GUEST_TOKEN_TTL;

  return (socket, next) => {
    const auth = (socket.handshake.auth ?? {}) as { token?: string; guestToken?: string };
    const data = socket.data as SocketAuthData;

    if (auth.token) {
      try {
        const payload = jwt.verify(auth.token, deps.jwtSecret) as { userId: string; username?: string; email?: string };
        data.user = { userId: payload.userId, displayName: payload.username || payload.email || "Jogador", guest: false };
        return next();
      } catch {
        // token expirado/inválido → cai pro fluxo de convidado abaixo em vez de derrubar a conexão
      }
    }
    if (auth.guestToken) {
      try {
        const payload = jwt.verify(auth.guestToken, deps.jwtSecret) as { guestId: string };
        data.user = { userId: payload.guestId, displayName: "Convidado", guest: true };
        return next();
      } catch {
        // guestToken velho → gera um novo abaixo
      }
    }
    const guestId = `guest:${randomUUID()}`;
    data.user = { userId: guestId, displayName: "Convidado", guest: true };
    data.freshGuestToken = jwt.sign({ guestId, guest: true }, deps.jwtSecret, { expiresIn: guestTokenTtl });
    next();
  };
}

const EMPTY_SOCKET_SET: ReadonlySet<never> = new Set();

/**
 * `userId → sockets vivos` (um usuário pode ter várias abas/dispositivos
 * conectados ao mesmo tempo). Cada arquivo (`simulatorSocket.ts`,
 * `simulatorSocket4p.ts`) tinha essa mesma estrutura + a mesma lógica de
 * add/remove duplicada em `connection`/`disconnect(ing)` — extraída aqui.
 *
 * Não decide NADA de negócio (não sabe de fila, lobby, partida) — só
 * responde "este usuário ainda tem algum socket vivo?" pro chamador decidir
 * o que fazer (sair da fila, cancelar convite, armar timer de reconexão...).
 */
export class UserSocketRegistry<TSocket extends Socket = Socket> {
  private readonly byUser = new Map<string, Set<TSocket>>();

  addSocket(userId: string, socket: TSocket): void {
    let set = this.byUser.get(userId);
    if (!set) {
      set = new Set();
      this.byUser.set(userId, set);
    }
    set.add(socket);
  }

  /**
   * Remove `socket` do registro de `userId`. Devolve `true` quando esse era
   * o ÚLTIMO socket vivo daquele usuário (ficou offline) — é o sinal que os
   * handlers de `disconnect`/`disconnecting` usam pra decidir se saem da
   * fila, cancelam convite, armam timer de reconexão etc. Se ainda sobrar
   * pelo menos 1 socket (outra aba), devolve `false` e não mexe no resto.
   */
  removeSocket(userId: string, socket: TSocket): boolean {
    const set = this.byUser.get(userId);
    if (!set) return false;
    set.delete(socket);
    if (set.size > 0) return false;
    this.byUser.delete(userId);
    return true;
  }

  /** Sockets vivos de `userId` (set vazio, nunca `undefined`, se não há nenhum). */
  getSockets(userId: string): ReadonlySet<TSocket> {
    return this.byUser.get(userId) ?? (EMPTY_SOCKET_SET as ReadonlySet<TSocket>);
  }

  countFor(userId: string): number {
    return this.byUser.get(userId)?.size ?? 0;
  }
}

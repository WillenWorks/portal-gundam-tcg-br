/**
 * Gateway Socket.io de Rede Social e Partidas Rápidas em Tempo Real (Anaheim Hub).
 * Opera multiplexado no mesmo servidor HTTP do Express através de path dedicado (/social.io),
 * gerenciando presença online de amigos, convites de Partida Rápida 1v1 com loading inferior
 * direito no anfitrião e aceitação no convidado, além de alertas administrativos de denúncia.
 */
import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { PrismaClient, FriendshipStatus } from "@prisma/client";
import { createSocketAuthMiddleware, UserSocketRegistry, type SocketAuthData } from "./services/socketAuth.ts";
import { createMatch, joinMatch } from "../src/modules/simulator/server/matchStore.ts";

export const SOCIAL_SOCKET_PATH = "/social.io";
const QUICK_MATCH_DECK_TIMEOUT_MS = 5 * 60 * 1000;

export type SimulatorDeckResolution = { ok: true; key: string; build: () => any } | { ok: false; message: string };

export interface SocialSocketDeps {
  jwtSecret: string;
  allowedOrigins: string[];
  prisma: PrismaClient;
  resolveDeck?: (raw: unknown, userId: string) => Promise<SimulatorDeckResolution>;
}

interface QuickMatchInvite {
  id: string;
  hostUserId: string;
  hostUser: { id: string; username: string; displayName: string; avatarUrl?: string | null };
  guestUserId: string;
  guestUser: { id: string; username: string; displayName: string; avatarUrl?: string | null };
  createdAt: number;
  timer: NodeJS.Timeout;
}

interface QuickMatchSession {
  id: string;
  hostUserId: string;
  hostUser: { id: string; username: string; displayName: string; avatarUrl?: string | null };
  guestUserId: string;
  guestUser: { id: string; username: string; displayName: string; avatarUrl?: string | null };
  hostDeckKey?: string;
  guestDeckKey?: string;
  createdAt: number;
}

const socialSocketsByUser = new UserSocketRegistry<Socket>();
const activeQuickMatchInvites = new Map<string, QuickMatchInvite>();
const activeQuickMatchSessions = new Map<string, QuickMatchSession>();

export function isUserOnline(userId: string): boolean {
  return socialSocketsByUser.countFor(userId) > 0;
}

export function emitSocialEventToUser(userId: string, event: string, payload: unknown): void {
  const sockets = socialSocketsByUser.getSockets(userId);
  for (const socket of sockets) {
    socket.emit(event, payload);
  }
}

export function attachSocialSocket(httpServer: HttpServer, deps: SocialSocketDeps): Server {
  const io = new Server(httpServer, {
    path: SOCIAL_SOCKET_PATH,
    serveClient: false,
    cors: deps.allowedOrigins.length ? { origin: deps.allowedOrigins } : { origin: true },
  });


  io.use(createSocketAuthMiddleware({ jwtSecret: deps.jwtSecret }));

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketAuthData;
    const userId = data.user.userId;

    socialSocketsByUser.addSocket(userId, socket);

    // Confirmação de conexão e identificação do piloto
    socket.emit("social:ready", {
      userId,
      guest: data.user.guest,
      displayName: data.user.displayName,
    });

    // =========================================================================
    // PARTIDA RÁPIDA ENTRE AMIGOS CONECTADOS (QUICK MATCH DIRECT PROTOCOL)
    // =========================================================================

    // 1. Anfitrião dispara convite para amigo online
    socket.on("quick_match:invite", async (payload: { targetUserId: string }, ack?: (res: any) => void) => {
      try {
        const targetUserId = String(payload?.targetUserId ?? "");
        if (!targetUserId || targetUserId === userId) {
          if (typeof ack === "function") ack({ error: "Destinatário inválido." });
          return;
        }

        // Verifica se o amigo está online
        if (!isUserOnline(targetUserId)) {
          if (typeof ack === "function") ack({ error: "O piloto não está online no momento." });
          return;
        }

        // Verifica se ambos são amigos vinculados
        const friendship = await deps.prisma.userFriendship.findFirst({
          where: {
            status: FriendshipStatus.ACCEPTED,
            OR: [
              { requesterId: userId, addresseeId: targetUserId },
              { requesterId: targetUserId, addresseeId: userId },
            ],
          },
        });

        if (!friendship) {
          if (typeof ack === "function") ack({ error: "Apenas pilotos vinculados como amigos podem disputar partidas rápidas." });
          return;
        }

        // Busca dados de exibição do anfitrião e do convidado
        const [hostUser, guestUser] = await Promise.all([
          deps.prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, displayName: true, avatarUrl: true } }),
          deps.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, username: true, displayName: true, avatarUrl: true } }),
        ]);

        if (!hostUser || !guestUser) {
          if (typeof ack === "function") ack({ error: "Piloto não encontrado." });
          return;
        }

        const inviteId = "inv_" + Math.random().toString(36).substring(2, 9);

        // Timer de expiração de 45 segundos
        const timer = setTimeout(() => {
          const inv = activeQuickMatchInvites.get(inviteId);
          if (inv) {
            activeQuickMatchInvites.delete(inviteId);
            emitSocialEventToUser(inv.hostUserId, "quick_match:expired", { inviteId, reason: "timeout" });
            emitSocialEventToUser(inv.guestUserId, "quick_match:expired", { inviteId, reason: "timeout" });
          }
        }, 45_000);

        const invite: QuickMatchInvite = {
          id: inviteId,
          hostUserId: userId,
          hostUser,
          guestUserId: targetUserId,
          guestUser,
          createdAt: Date.now(),
          timer,
        };

        activeQuickMatchInvites.set(inviteId, invite);

        // Emite alerta em tempo real para o convidado
        emitSocialEventToUser(targetUserId, "quick_match:incoming", {
          inviteId,
          hostUser,
        });

        if (typeof ack === "function") ack({ ok: true, inviteId, guestUser });
      } catch (err: any) {
        if (typeof ack === "function") ack({ error: err?.message || "Erro ao convidar para partida rápida." });
      }
    });

    // 2. Anfitrião cancela a espera do convite
    socket.on("quick_match:cancel", (payload: { inviteId: string }, ack?: (res: any) => void) => {
      const inviteId = String(payload?.inviteId ?? "");
      const invite = activeQuickMatchInvites.get(inviteId);
      if (invite && invite.hostUserId === userId) {
        clearTimeout(invite.timer);
        activeQuickMatchInvites.delete(inviteId);
        emitSocialEventToUser(invite.guestUserId, "quick_match:cancelled", { inviteId });
        if (typeof ack === "function") ack({ ok: true });
      } else {
        if (typeof ack === "function") ack({ error: "Convite não encontrado ou já expirado." });
      }
    });

    // 3. Convidado recusa o convite
    socket.on("quick_match:decline", (payload: { inviteId: string }, ack?: (res: any) => void) => {
      const inviteId = String(payload?.inviteId ?? "");
      const invite = activeQuickMatchInvites.get(inviteId);
      if (invite && invite.guestUserId === userId) {
        clearTimeout(invite.timer);
        activeQuickMatchInvites.delete(inviteId);
        emitSocialEventToUser(invite.hostUserId, "quick_match:declined", {
          inviteId,
          guestUsername: invite.guestUser.username,
        });
        if (typeof ack === "function") ack({ ok: true });
      } else {
        if (typeof ack === "function") ack({ error: "Convite não encontrado ou já expirado." });
      }
    });

    // 4. Convidado aceita o convite -> Inicia sessão pré-jogo e abre modal de seleção de deck para ambos
    socket.on("quick_match:accept", (payload: { inviteId: string }, ack?: (res: any) => void) => {
      const inviteId = String(payload?.inviteId ?? "");
      const invite = activeQuickMatchInvites.get(inviteId);
      if (invite && invite.guestUserId === userId) {
        clearTimeout(invite.timer);
        activeQuickMatchInvites.delete(inviteId);

        const sessionId = "qm_" + inviteId;
        const session: QuickMatchSession = {
          id: sessionId,
          hostUserId: invite.hostUserId,
          hostUser: invite.hostUser,
          guestUserId: invite.guestUserId,
          guestUser: invite.guestUser,
          createdAt: Date.now(),
        };

        activeQuickMatchSessions.set(sessionId, session);
        // Ninguém escolheu o deck a tempo (fechou a aba, caiu a conexão): a sessão não fica presa na memória
        setTimeout(() => {
          if (activeQuickMatchSessions.delete(sessionId)) {
            const timeout = { message: "O tempo para escolher o deck acabou. Convide de novo para jogar." };
            emitSocialEventToUser(session.hostUserId, "quick_match:error", timeout);
            emitSocialEventToUser(session.guestUserId, "quick_match:error", timeout);
          }
        }, QUICK_MATCH_DECK_TIMEOUT_MS).unref?.();

        // Notifica ambos os jogadores para abrirem a modal de seleção de deck
        const launchPayload = {
          quickMatchId: sessionId,
          hostUser: invite.hostUser,
          guestUser: invite.guestUser,
        };

        emitSocialEventToUser(invite.hostUserId, "quick_match:launch", launchPayload);
        emitSocialEventToUser(invite.guestUserId, "quick_match:launch", launchPayload);

        if (typeof ack === "function") ack({ ok: true, quickMatchId: sessionId });
      } else {
        if (typeof ack === "function") ack({ error: "Convite não encontrado ou já expirado." });
      }
    });

    // 5. Jogador seleciona seu deck na modal de partida rápida
    socket.on("quick_match:select_deck", async (payload: { quickMatchId: string; deckKey: string }, ack?: (res: any) => void) => {
      try {
        const quickMatchId = String(payload?.quickMatchId ?? "");
        const deckKey = String(payload?.deckKey ?? "").trim();
        const session = activeQuickMatchSessions.get(quickMatchId);

        if (!session) {
          if (typeof ack === "function") ack({ error: "Sessão de partida rápida não encontrada ou expirada." });
          return;
        }

        if (session.hostUserId === userId) {
          session.hostDeckKey = deckKey;
        } else if (session.guestUserId === userId) {
          session.guestDeckKey = deckKey;
        } else {
          if (typeof ack === "function") ack({ error: "Você não faz parte desta sessão de partida rápida." });
          return;
        }

        if (typeof ack === "function") ack({ ok: true, confirmed: true });

        // Avisa ao oponente que o piloto já escolheu o deck
        const otherUserId = session.hostUserId === userId ? session.guestUserId : session.hostUserId;
        emitSocialEventToUser(otherUserId, "quick_match:opponent_deck_confirmed", { quickMatchId });

        // Quando AMBOS os jogadores tiverem confirmado seus decks, inicia a partida de verdade!
        if (session.hostDeckKey && session.guestDeckKey && deps.resolveDeck) {
          const [hostDeckRes, guestDeckRes] = await Promise.all([
            deps.resolveDeck(session.hostDeckKey, session.hostUserId),
            deps.resolveDeck(session.guestDeckKey, session.guestUserId),
          ]);

          if (!hostDeckRes.ok) {
            const errMsg = `Deck do anfitrião inválido: ${hostDeckRes.message}`;
            emitSocialEventToUser(session.hostUserId, "quick_match:error", { message: errMsg });
            emitSocialEventToUser(session.guestUserId, "quick_match:error", { message: errMsg });
            activeQuickMatchSessions.delete(quickMatchId);
            return;
          }

          if (!guestDeckRes.ok) {
            const errMsg = `Deck do convidado inválido: ${guestDeckRes.message}`;
            emitSocialEventToUser(session.hostUserId, "quick_match:error", { message: errMsg });
            emitSocialEventToUser(session.guestUserId, "quick_match:error", { message: errMsg });
            activeQuickMatchSessions.delete(quickMatchId);
            return;
          }

          // Cria a partida no motor 1v1 oficial
          const match = createMatch({
            deckA: hostDeckRes.build(),
            deckB: guestDeckRes.build(),
            firstPlayer: Math.random() < 0.5 ? "A" : "B",
          });

          match.deckKeys = { A: hostDeckRes.key, B: guestDeckRes.key };
          joinMatch(match.id, "A", { userId: session.hostUserId, displayName: session.hostUser.displayName });
          joinMatch(match.id, "B", { userId: session.guestUserId, displayName: session.guestUser.displayName });

          activeQuickMatchSessions.delete(quickMatchId);

          // Comanda ambos os navegadores a entrarem na partida
          emitSocialEventToUser(session.hostUserId, "quick_match:ready", { matchId: match.id });
          emitSocialEventToUser(session.guestUserId, "quick_match:ready", { matchId: match.id });
        }
      } catch (err: any) {
        if (typeof ack === "function") ack({ error: err?.message || "Erro ao processar seleção de deck." });
      }
    });

    socket.on("disconnect", () => {
      socialSocketsByUser.removeSocket(userId, socket);

      // Cancela convites pendentes caso o anfitrião desconecte
      for (const [id, invite] of activeQuickMatchInvites.entries()) {
        if (invite.hostUserId === userId) {
          clearTimeout(invite.timer);
          activeQuickMatchInvites.delete(id);
          emitSocialEventToUser(invite.guestUserId, "quick_match:cancelled", { inviteId: id });
        }
      }
    });
  });

  return io;
}

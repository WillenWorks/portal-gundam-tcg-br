import type { Express, Response } from "express";
import { PrismaClient, FriendshipStatus, NotificationType, UserRole, ReportStatus } from "@prisma/client";
import { emitSocialEventToUser, isUserOnline } from "../socialSocket.ts";

interface RequestWithUser {
  user?: {
    userId: string;
    username?: string;
    email?: string;
    role?: string;
    guest?: boolean;
  };
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  body: any;
}

export function registerSocialRoutes(
  app: Express,
  prisma: PrismaClient,
  authRequired: any,
  authOptional: any,
) {
  // Convidado (guest do simulador) não tem conta: as rotas sociais são só para pilotos cadastrados.
  const member = [
    authRequired,
    (req: RequestWithUser, res: Response, next: () => void) =>
      req.user?.guest ? res.status(403).json({ error: "Entre com sua conta para usar a área social." }) : next(),
  ];

  // ==========================================
  // 1. SEGUIR / UNFOLLOW (FOLLOW SYSTEM)
  // ==========================================

  // Consultar status de follow e contadores de um perfil
  app.get("/api/social/follow-status/:username", authOptional, async (req: RequestWithUser, res: Response) => {
    try {
      const targetUser = await prisma.user.findUnique({
        where: { username: req.params.username },
        select: { id: true, username: true },
      });
      if (!targetUser) return res.status(404).json({ error: "Piloto não encontrado." });

      const [followerCount, followingCount] = await Promise.all([
        prisma.userFollow.count({ where: { followingId: targetUser.id } }),
        prisma.userFollow.count({ where: { followerId: targetUser.id } }),
      ]);

      let isFollowing = false;
      if (req.user?.userId) {
        const existing = await prisma.userFollow.findUnique({
          where: {
            followerId_followingId: {
              followerId: req.user.userId,
              followingId: targetUser.id,
            },
          },
        });
        isFollowing = Boolean(existing);
      }

      res.json({
        following: isFollowing,
        followerCount,
        followingCount,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao consultar seguidores." });
    }
  });

  // Seguir um perfil
  app.post("/api/social/follow/:username", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const targetUser = await prisma.user.findUnique({
        where: { username: req.params.username },
        select: { id: true, username: true, displayName: true },
      });
      if (!targetUser) return res.status(404).json({ error: "Piloto não encontrado." });
      if (targetUser.id === currentUserId) {
        return res.status(400).json({ error: "Você não pode seguir seu próprio perfil." });
      }

      const alreadyFollowing = await prisma.userFollow.findUnique({
        where: { followerId_followingId: { followerId: currentUserId, followingId: targetUser.id } },
        select: { id: true },
      });
      if (!alreadyFollowing) {
        await prisma.userFollow.create({ data: { followerId: currentUserId, followingId: targetUser.id } });
      }

      // Notifica o alvo uma vez por seguidor (seguir/deixar de seguir em sequência não vira spam)
      const notifiedBefore = await prisma.notification.findFirst({
        where: { recipientId: targetUser.id, actorId: currentUserId, type: NotificationType.NEW_FOLLOWER },
        select: { id: true },
      });
      if (alreadyFollowing || notifiedBefore) {
        const followerCount = await prisma.userFollow.count({ where: { followingId: targetUser.id } });
        return res.json({ following: true, followerCount });
      }

      const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { displayName: true, username: true },
      });

      const notification = await prisma.notification.create({
        data: {
          recipientId: targetUser.id,
          actorId: currentUserId,
          type: NotificationType.NEW_FOLLOWER,
          entityId: currentUserId,
          entityType: "user",
          message: `${currentUser?.displayName || "Um piloto"} começou a seguir seu perfil!`,
        },
      });

      emitSocialEventToUser(targetUser.id, "social:notification", notification);

      const followerCount = await prisma.userFollow.count({ where: { followingId: targetUser.id } });
      res.json({ following: true, followerCount });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao seguir piloto." });
    }
  });

  // Deixar de seguir um perfil
  app.delete("/api/social/follow/:username", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const targetUser = await prisma.user.findUnique({
        where: { username: req.params.username },
        select: { id: true },
      });
      if (!targetUser) return res.status(404).json({ error: "Piloto não encontrado." });

      await prisma.userFollow.deleteMany({
        where: {
          followerId: currentUserId,
          followingId: targetUser.id,
        },
      });

      const followerCount = await prisma.userFollow.count({ where: { followingId: targetUser.id } });
      res.json({ following: false, followerCount });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao deixar de seguir piloto." });
    }
  });

  // ==========================================
  // 2. AMIZADES (FRIENDSHIP SYSTEM)
  // ==========================================

  // Consultar status de amizade com determinado usuário
  app.get("/api/social/friends/status/:username", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const targetUser = await prisma.user.findUnique({
        where: { username: req.params.username },
        select: { id: true },
      });
      if (!targetUser) return res.status(404).json({ error: "Piloto não encontrado." });

      const friendship = await prisma.userFriendship.findFirst({
        where: {
          OR: [
            { requesterId: currentUserId, addresseeId: targetUser.id },
            { requesterId: targetUser.id, addresseeId: currentUserId },
          ],
        },
      });

      const online = isUserOnline(targetUser.id);

      if (!friendship) {
        return res.json({ status: "NONE", online });
      }

      if (friendship.status === FriendshipStatus.ACCEPTED) {
        return res.json({ status: "FRIENDS", friendshipId: friendship.id, online });
      }

      if (friendship.requesterId === currentUserId) {
        return res.json({ status: "PENDING_SENT", friendshipId: friendship.id, online });
      } else {
        return res.json({ status: "PENDING_RECEIVED", friendshipId: friendship.id, online });
      }
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao consultar amizade." });
    }
  });

  // Solicitar amizade
  app.post("/api/social/friends/request/:username", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const targetUser = await prisma.user.findUnique({
        where: { username: req.params.username },
        select: { id: true, displayName: true },
      });
      if (!targetUser) return res.status(404).json({ error: "Piloto não encontrado." });
      if (targetUser.id === currentUserId) {
        return res.status(400).json({ error: "Você não pode enviar solicitação para si mesmo." });
      }

      // Verifica se já existe relação
      const existing = await prisma.userFriendship.findFirst({
        where: {
          OR: [
            { requesterId: currentUserId, addresseeId: targetUser.id },
            { requesterId: targetUser.id, addresseeId: currentUserId },
          ],
        },
      });

      if (existing) {
        if (existing.status === FriendshipStatus.ACCEPTED) {
          return res.json({ status: "FRIENDS", friendshipId: existing.id });
        }
        // Se o outro já havia enviado solicitação, aceita automaticamente!
        if (existing.requesterId === targetUser.id) {
          const updated = await prisma.userFriendship.update({
            where: { id: existing.id },
            data: { status: FriendshipStatus.ACCEPTED },
          });

          const notification = await prisma.notification.create({
            data: {
              recipientId: targetUser.id,
              actorId: currentUserId,
              type: NotificationType.FRIEND_ACCEPT,
              entityId: updated.id,
              entityType: "friendship",
              message: `Você e ${req.user?.username || "um piloto"} agora são amigos!`,
            },
          });
          emitSocialEventToUser(targetUser.id, "social:notification", notification);

          return res.json({ status: "FRIENDS", friendshipId: updated.id });
        }
        return res.json({ status: "PENDING_SENT", friendshipId: existing.id });
      }

      const created = await prisma.userFriendship.create({
        data: {
          requesterId: currentUserId,
          addresseeId: targetUser.id,
          status: FriendshipStatus.PENDING,
        },
      });

      const notification = await prisma.notification.create({
        data: {
          recipientId: targetUser.id,
          actorId: currentUserId,
          type: NotificationType.FRIEND_REQUEST,
          entityId: created.id,
          entityType: "friendship",
          message: `${req.user?.username || "Um piloto"} enviou uma solicitação de amizade.`,
        },
      });
      emitSocialEventToUser(targetUser.id, "social:notification", notification);

      res.status(201).json({ status: "PENDING_SENT", friendshipId: created.id });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao solicitar amizade." });
    }
  });

  // Aceitar solicitação de amizade
  app.post("/api/social/friends/accept/:friendshipId", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const friendship = await prisma.userFriendship.findUnique({
        where: { id: req.params.friendshipId },
      });
      if (!friendship || friendship.addresseeId !== currentUserId || friendship.status !== FriendshipStatus.PENDING) {
        return res.status(404).json({ error: "Solicitação não encontrada." });
      }

      const updated = await prisma.userFriendship.update({
        where: { id: friendship.id },
        data: { status: FriendshipStatus.ACCEPTED },
      });

      const notification = await prisma.notification.create({
        data: {
          recipientId: friendship.requesterId,
          actorId: currentUserId,
          type: NotificationType.FRIEND_ACCEPT,
          entityId: updated.id,
          entityType: "friendship",
          message: `${req.user?.username || "Seu colega"} aceitou sua solicitação de amizade!`,
        },
      });
      emitSocialEventToUser(friendship.requesterId, "social:notification", notification);

      res.json({ ok: true, status: "ACCEPTED" });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao aceitar amizade." });
    }
  });

  // Recusar ou cancelar amizade
  app.delete("/api/social/friends/:username", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const targetUser = await prisma.user.findUnique({
        where: { username: req.params.username },
        select: { id: true },
      });
      if (!targetUser) return res.status(404).json({ error: "Piloto não encontrado." });

      await prisma.userFriendship.deleteMany({
        where: {
          OR: [
            { requesterId: currentUserId, addresseeId: targetUser.id },
            { requesterId: targetUser.id, addresseeId: currentUserId },
          ],
        },
      });

      res.json({ ok: true, status: "NONE" });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao remover amizade." });
    }
  });

  // Listar amigos e solicitações pendentes
  app.get("/api/social/friends", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const friendships = await prisma.userFriendship.findMany({
        where: {
          OR: [{ requesterId: currentUserId }, { addresseeId: currentUserId }],
        },
        include: {
          requester: { select: { id: true, username: true, displayName: true, avatarUrl: true, isSupporter: true } },
          addressee: { select: { id: true, username: true, displayName: true, avatarUrl: true, isSupporter: true } },
        },
      });

      const friends: any[] = [];
      const pendingReceived: any[] = [];
      const pendingSent: any[] = [];

      for (const f of friendships) {
        if (f.status === FriendshipStatus.ACCEPTED) {
          const friend = f.requesterId === currentUserId ? f.addressee : f.requester;
          friends.push({
            friendshipId: f.id,
            ...friend,
            online: isUserOnline(friend.id),
          });
        } else if (f.status === FriendshipStatus.PENDING) {
          if (f.addresseeId === currentUserId) {
            pendingReceived.push({ friendshipId: f.id, requester: f.requester, createdAt: f.createdAt });
          } else {
            pendingSent.push({ friendshipId: f.id, addressee: f.addressee, createdAt: f.createdAt });
          }
        }
      }

      res.json({ friends, pendingReceived, pendingSent });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao listar amigos." });
    }
  });

  // ==========================================
  // 3. MENSAGERIA ASSÍNCRONA & CAIXA POSTAL (LGPD & COMPLIANCE DE MENORES)
  // ==========================================

  // Listar mensagens recebidas (Caixa de Entrada)
  app.get("/api/social/mail/inbox", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const messages = await prisma.pilotMailMessage.findMany({
        where: { recipientId: currentUserId, recipientDeleted: false },
        orderBy: { createdAt: "desc" },
        include: {
          sender: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true, isSupporter: true } },
        },
      });
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao consultar caixa de entrada." });
    }
  });

  // Listar mensagens enviadas (Caixa de Saída)
  app.get("/api/social/mail/sent", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const messages = await prisma.pilotMailMessage.findMany({
        where: { senderId: currentUserId, senderDeleted: false },
        orderBy: { createdAt: "desc" },
        include: {
          recipient: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true, isSupporter: true } },
        },
      });
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao consultar mensagens enviadas." });
    }
  });

  // Contagem de mensagens não lidas
  app.get("/api/social/mail/unread-count", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const unreadCount = await prisma.pilotMailMessage.count({
        where: { recipientId: currentUserId, recipientDeleted: false, isRead: false },
      });
      res.json({ unreadCount });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao consultar mensagens não lidas." });
    }
  });

  // Obter detalhes de uma mensagem e marcar como lida
  app.get("/api/social/mail/:id", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const message = await prisma.pilotMailMessage.findUnique({
        where: { id: req.params.id },
        include: {
          sender: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true, isSupporter: true } },
          recipient: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true, isSupporter: true } },
        },
      });

      if (!message) return res.status(404).json({ error: "Mensagem não encontrada." });
      if (message.senderId !== currentUserId && message.recipientId !== currentUserId) {
        return res.status(403).json({ error: "Acesso não autorizado a esta transmissão." });
      }

      if (message.recipientId === currentUserId && !message.isRead) {
        await prisma.pilotMailMessage.update({
          where: { id: message.id },
          data: { isRead: true, readAt: new Date() },
        });
        message.isRead = true;
        message.readAt = new Date();
      }

      res.json(message);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao carregar transmissão." });
    }
  });

  // Enviar mensagem assíncrona (Apenas amigos vinculados)
  app.post("/api/social/mail", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const recipientUsername = String(req.body?.recipientUsername ?? "").trim();
      const subject = String(req.body?.subject ?? "").trim();
      const content = String(req.body?.content ?? "").trim();

      if (!recipientUsername) return res.status(400).json({ error: "Informe o piloto destinatário." });
      if (!subject) return res.status(400).json({ error: "Informe o assunto da transmissão." });
      if (subject.length > 120) return res.status(400).json({ error: "O assunto não pode exceder 120 caracteres." });
      if (!content) return res.status(400).json({ error: "A mensagem não pode ser vazia." });
      if (content.length > 1500) return res.status(400).json({ error: "A mensagem não pode exceder 1500 caracteres." });

      const targetUser = await prisma.user.findUnique({
        where: { username: recipientUsername },
        select: { id: true, username: true, displayName: true },
      });
      if (!targetUser) return res.status(404).json({ error: "Piloto destinatário não encontrado." });
      if (targetUser.id === currentUserId) return res.status(400).json({ error: "Você não pode enviar mensagem para si mesmo." });

      // Verificação de Vínculo de Amizade (Hard gate de privacidade e segurança)
      const friendship = await prisma.userFriendship.findFirst({
        where: {
          status: FriendshipStatus.ACCEPTED,
          OR: [
            { requesterId: currentUserId, addresseeId: targetUser.id },
            { requesterId: targetUser.id, addresseeId: currentUserId },
          ],
        },
      });
      if (!friendship) {
        return res.status(403).json({ error: "Apenas pilotos vinculados como amigos podem trocar transmissões assíncronas." });
      }

      // Rate Limiting anti-abuso / anti-spam (máximo 10 transmissões/hora)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = await prisma.pilotMailMessage.count({
        where: { senderId: currentUserId, createdAt: { gte: oneHourAgo } },
      });
      if (recentCount >= 10) {
        return res.status(429).json({ error: "Limite de transmissões por hora atingido (máximo de 10 envios/hora). Aguarde antes de transmitir novamente." });
      }

      const created = await prisma.pilotMailMessage.create({
        data: {
          senderId: currentUserId,
          recipientId: targetUser.id,
          subject,
          content,
        },
        include: {
          sender: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true, isSupporter: true } },
          recipient: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true, isSupporter: true } },
        },
      });

      // Notificação ao destinatário
      const notification = await prisma.notification.create({
        data: {
          recipientId: targetUser.id,
          actorId: currentUserId,
          type: NotificationType.NEW_MESSAGE,
          entityId: created.id,
          entityType: "mail",
          message: `${req.user?.username || "Um amigo"} enviou uma transmissão: "${subject}"`,
        },
      });
      emitSocialEventToUser(targetUser.id, "social:notification", notification);
      emitSocialEventToUser(targetUser.id, "social:mail_new", created);

      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao transmitir mensagem." });
    }
  });

  // Excluir mensagem (Direito à exclusão LGPD)
  app.delete("/api/social/mail/:id", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const message = await prisma.pilotMailMessage.findUnique({ where: { id: req.params.id } });
      if (!message) return res.status(404).json({ error: "Mensagem não encontrada." });
      if (message.senderId !== currentUserId && message.recipientId !== currentUserId) {
        return res.status(403).json({ error: "Sem permissão para excluir esta mensagem." });
      }

      if (message.senderId === currentUserId) {
        if (message.recipientDeleted) {
          await prisma.pilotMailMessage.delete({ where: { id: message.id } });
        } else {
          await prisma.pilotMailMessage.update({ where: { id: message.id }, data: { senderDeleted: true } });
        }
      } else if (message.recipientId === currentUserId) {
        if (message.senderDeleted) {
          await prisma.pilotMailMessage.delete({ where: { id: message.id } });
        } else {
          await prisma.pilotMailMessage.update({ where: { id: message.id }, data: { recipientDeleted: true } });
        }
      }
      res.json({ ok: true, deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao excluir mensagem." });
    }
  });

  // ==========================================
  // 4. DENÚNCIAS & COMPLIANCE LEGAL (ADMIN ALERT)
  // ==========================================

  // Denunciar mensagem ou conduta de piloto
  app.post("/api/social/mail/:id/report", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const reason = String(req.body?.reason ?? "").trim();
      const details = req.body?.details ? String(req.body.details).trim() : null;

      if (!reason) return res.status(400).json({ error: "Informe o motivo da denúncia." });
      if (reason.length > 255) return res.status(400).json({ error: "O motivo não pode exceder 255 caracteres." });
      if (details && details.length > 2000) return res.status(400).json({ error: "Os detalhes não podem exceder 2000 caracteres." });

      const message = await prisma.pilotMailMessage.findUnique({
        where: { id: req.params.id },
        include: { sender: { select: { id: true, username: true, displayName: true } } },
      });
      // só quem recebeu a mensagem pode denunciá-la (o id sozinho não dá acesso a conversa de terceiros)
      if (!message || message.recipientId !== currentUserId) return res.status(404).json({ error: "Mensagem não encontrada." });

      const alreadyReported = await prisma.mailReport.findFirst({
        where: { reporterId: currentUserId, messageId: message.id },
        select: { id: true },
      });
      if (alreadyReported) {
        return res.json({ ok: true, reportId: alreadyReported.id, message: "Esta mensagem já foi denunciada e está com a administração." });
      }

      const report = await prisma.mailReport.create({
        data: {
          reporterId: currentUserId,
          reportedUserId: message.senderId,
          messageId: message.id,
          reason,
          details,
          status: ReportStatus.PENDING,
        },
      });

      // Notifica todos os administradores com alerta de alta prioridade
      const admins = await prisma.user.findMany({
        where: { role: UserRole.ADMIN },
        select: { id: true },
      });

      for (const admin of admins) {
        const notification = await prisma.notification.create({
          data: {
            recipientId: admin.id,
            actorId: currentUserId,
            type: NotificationType.ADMIN_REPORT_ALERT,
            entityId: report.id,
            entityType: "report",
            message: `🚨 DENÚNCIA: @${req.user?.username || "Piloto"} denunciou a mensagem "${message.subject}" de @${message.sender.username}. Motivo: ${reason}`,
          },
        });
        emitSocialEventToUser(admin.id, "social:notification", notification);
        emitSocialEventToUser(admin.id, "social:admin_report", {
          reportId: report.id,
          reporterUsername: req.user?.username,
          reportedUsername: message.sender.username,
          reason,
          details,
          createdAt: report.createdAt,
        });
      }

      console.warn(`[DENÚNCIA REGISTRADA] Report #${report.id} por @${req.user?.username} contra @${message.sender.username}: ${reason}`);
      res.status(201).json({
        ok: true,
        reportId: report.id,
        message: "Denúncia registrada com sucesso. A administração foi notificada para as medidas legais cabíveis.",
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao registrar denúncia." });
    }
  });

  // Listar denúncias para o painel de moderação administrativa
  app.get("/api/social/admin/reports", member, async (req: RequestWithUser, res: Response) => {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "Acesso restrito a administradores." });
      }

      const reports = await prisma.mailReport.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          reporter: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          reportedUser: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          message: { select: { id: true, subject: true, content: true, createdAt: true } },
        },
      });
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao buscar denúncias." });
    }
  });

  // Resolver denúncia (Admin action)
  app.post("/api/social/admin/reports/:id/resolve", member, async (req: RequestWithUser, res: Response) => {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "Acesso restrito a administradores." });
      }

      const status = req.body?.status === "DISMISSED" ? ReportStatus.DISMISSED : ReportStatus.RESOLVED;
      const adminNotes = req.body?.adminNotes ? String(req.body.adminNotes).trim() : null;

      const updated = await prisma.mailReport.update({
        where: { id: req.params.id },
        data: {
          status,
          adminNotes,
          resolvedAt: new Date(),
          resolvedById: req.user!.userId,
        },
      });

      res.json({ ok: true, report: updated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao resolver denúncia." });
    }
  });

  // ==========================================
  // 4. NOTIFICAÇÕES (TRANSMISSIONS)
  // ==========================================

  app.get("/api/social/notifications", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: { recipientId: currentUserId },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        }),
        prisma.notification.count({
          where: { recipientId: currentUserId, isRead: false },
        }),
      ]);

      res.json({ notifications, unreadCount });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao buscar notificações." });
    }
  });

  app.post("/api/social/notifications/:id/read", member, async (req: RequestWithUser, res: Response) => {
    try {
      await prisma.notification.updateMany({
        where: { id: req.params.id, recipientId: req.user!.userId },
        data: { isRead: true },
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao marcar notificação como lida." });
    }
  });

  app.post("/api/social/notifications/read-all", member, async (req: RequestWithUser, res: Response) => {
    try {
      await prisma.notification.updateMany({
        where: { recipientId: req.user!.userId, isRead: false },
        data: { isRead: true },
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao limpar notificações." });
    }
  });
}

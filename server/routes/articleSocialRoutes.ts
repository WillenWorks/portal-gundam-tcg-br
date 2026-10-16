import type { Express, Response } from "express";
import { PrismaClient, UserRole, NotificationType, PostStatus } from "@prisma/client";
import { emitSocialEventToUser } from "../socialSocket.ts";

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

// Anti-spam de comentários: até COMMENT_LIMIT por piloto a cada COMMENT_WINDOW_MS
const COMMENT_LIMIT = 10;
const COMMENT_WINDOW_MS = 10 * 60 * 1000;

export function registerArticleSocialRoutes(
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

  // Helper para resolver post por id ou slug
  async function resolvePost(slugOrId: string) {
    return prisma.post.findFirst({
      // rascunho/revisão não recebe curtida nem comentário
      where: {
        status: PostStatus.PUBLISHED,
        OR: [{ id: slugOrId }, { slug: slugOrId }],
      },
      select: { id: true, slug: true, title: true, authorId: true, likeCount: true },
    });
  }

  // ==========================================
  // 1. LIKES DO ARTIGO
  // ==========================================

  app.get("/api/posts/:slugOrId/like-status", authOptional, async (req: RequestWithUser, res: Response) => {
    try {
      const post = await resolvePost(req.params.slugOrId);
      if (!post) return res.status(404).json({ error: "Artigo não encontrado." });

      let liked = false;
      if (req.user?.userId) {
        const existing = await prisma.postLike.findUnique({
          where: {
            postId_userId: {
              postId: post.id,
              userId: req.user.userId,
            },
          },
        });
        liked = Boolean(existing);
      }

      res.json({ liked, likeCount: post.likeCount });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao consultar curtidas do artigo." });
    }
  });

  app.post("/api/posts/:slugOrId/like", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const post = await resolvePost(req.params.slugOrId);
      if (!post) return res.status(404).json({ error: "Artigo não encontrado." });

      const existingLike = await prisma.postLike.findUnique({
        where: {
          postId_userId: {
            postId: post.id,
            userId: currentUserId,
          },
        },
      });

      if (existingLike) {
        await prisma.postLike.delete({ where: { id: existingLike.id } });
        const updated = await prisma.post.update({
          where: { id: post.id },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
        return res.json({ liked: false, likeCount: Math.max(0, updated.likeCount) });
      } else {
        await prisma.postLike.create({
          data: { postId: post.id, userId: currentUserId },
        });
        const updated = await prisma.post.update({
          where: { id: post.id },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        });

        // Notifica o autor do artigo uma vez por leitor (curtir/descurtir em sequência não vira spam)
        const notifiedBefore =
          post.authorId !== currentUserId &&
          (await prisma.notification.findFirst({
            where: { recipientId: post.authorId, actorId: currentUserId, entityId: post.id, type: NotificationType.DECK_LIKE },
            select: { id: true },
          }));
        if (post.authorId !== currentUserId && !notifiedBefore) {
          const notification = await prisma.notification.create({
            data: {
              recipientId: post.authorId,
              actorId: currentUserId,
              type: NotificationType.DECK_LIKE, // reutiliza notificação de curtida de conteúdo
              entityId: post.id,
              entityType: "post",
              message: `${req.user?.username || "Um piloto"} curtiu seu artigo "${post.title}".`,
            },
          });
          emitSocialEventToUser(post.authorId, "social:notification", notification);
        }

        return res.json({ liked: true, likeCount: updated.likeCount });
      }
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao curtir artigo." });
    }
  });

  // ==========================================
  // 2. COMENTÁRIOS E RESPOSTAS (THREADED COMMENTS)
  // ==========================================

  app.get("/api/posts/:slugOrId/comments", authOptional, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user?.userId;
      const post = await resolvePost(req.params.slugOrId);
      if (!post) return res.status(404).json({ error: "Artigo não encontrado." });

      const authorSelect = {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        role: true,
        isSupporter: true,
      };

      const [rootComments, totalCount] = await Promise.all([
        prisma.postComment.findMany({
          where: { postId: post.id, parentId: null },
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: authorSelect },
            _count: { select: { likes: true, replies: true } },
            likes: currentUserId ? { where: { userId: currentUserId } } : false,
            replies: {
              orderBy: { createdAt: "asc" },
              include: {
                author: { select: authorSelect },
                _count: { select: { likes: true } },
                likes: currentUserId ? { where: { userId: currentUserId } } : false,
              },
            },
          },
        }),
        prisma.postComment.count({ where: { postId: post.id } }),
      ]);

      const formatComment = (c: any) => ({
        id: c.id,
        postId: c.postId,
        authorId: c.authorId,
        parentId: c.parentId,
        content: c.isDeleted ? "[Comentário removido pela moderação]" : c.content,
        isDeleted: c.isDeleted,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        author: c.author,
        likeCount: c._count?.likes ?? 0,
        hasLiked: Boolean(c.likes?.length),
        replies: (c.replies || []).map((r: any) => ({
          id: r.id,
          postId: r.postId,
          authorId: r.authorId,
          parentId: r.parentId,
          content: r.isDeleted ? "[Comentário removido pela moderação]" : r.content,
          isDeleted: r.isDeleted,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          author: r.author,
          likeCount: r._count?.likes ?? 0,
          hasLiked: Boolean(r.likes?.length),
        })),
      });

      res.json({
        comments: rootComments.map(formatComment),
        totalCount,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao buscar comentários." });
    }
  });

  app.post("/api/posts/:slugOrId/comments", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const content = String(req.body?.content ?? "").trim();
      const parentId = req.body?.parentId ? String(req.body.parentId) : null;

      if (!content) return res.status(400).json({ error: "O comentário não pode ser vazio." });
      if (content.length > 2000) return res.status(400).json({ error: "O comentário não pode ter mais de 2000 caracteres." });

      const post = await resolvePost(req.params.slugOrId);
      if (!post) return res.status(404).json({ error: "Artigo não encontrado." });

      const recent = await prisma.postComment.count({
        where: { authorId: currentUserId, createdAt: { gte: new Date(Date.now() - COMMENT_WINDOW_MS) } },
      });
      if (recent >= COMMENT_LIMIT) {
        return res.status(429).json({ error: "Muitos comentários em pouco tempo. Aguarde alguns minutos." });
      }

      // Se for resposta a um comentário, verifica se o pai existe
      let parentComment: { id: string; authorId: string; parentId: string | null } | null = null;
      if (parentId) {
        parentComment = await prisma.postComment.findFirst({
          where: { id: parentId, postId: post.id },
          select: { id: true, authorId: true, parentId: true },
        });
        if (!parentComment) return res.status(404).json({ error: "Comentário pai não encontrado." });
      }

      const comment = await prisma.postComment.create({
        data: {
          postId: post.id,
          authorId: currentUserId,
          // a lista mostra 2 níveis: resposta a uma resposta entra no fio do comentário raiz
          parentId: parentComment ? parentComment.parentId ?? parentComment.id : null,
          content,
        },
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatarUrl: true,
              role: true,
              isSupporter: true,
            },
          },
        },
      });

      // Notificação: se for resposta, notifica o autor do comentário pai; senão, o autor do artigo
      const notifyTargetUserId = parentComment ? parentComment.authorId : post.authorId;
      if (notifyTargetUserId && notifyTargetUserId !== currentUserId) {
        const notification = await prisma.notification.create({
          data: {
            recipientId: notifyTargetUserId,
            actorId: currentUserId,
            type: NotificationType.BINDER_INTEREST,
            entityId: post.id,
            entityType: "post",
            message: parentComment
              ? `${req.user?.username || "Um piloto"} respondeu ao seu comentário no artigo "${post.title}".`
              : `${req.user?.username || "Um piloto"} comentou no seu artigo "${post.title}".`,
          },
        });
        emitSocialEventToUser(notifyTargetUserId, "social:notification", notification);
      }

      res.status(201).json({
        ...comment,
        likeCount: 0,
        hasLiked: false,
        replies: [],
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao publicar comentário." });
    }
  });

  // ==========================================
  // 3. MODERAÇÃO DE COMENTÁRIOS
  // ==========================================

  app.delete("/api/posts/comments/:commentId", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const userRole = req.user!.role;
      const commentId = String(req.params.commentId);

      const comment = await prisma.postComment.findUnique({
        where: { id: commentId },
        include: { _count: { select: { replies: true } } },
      });

      if (!comment) return res.status(404).json({ error: "Comentário não encontrado." });

      const isStaff = userRole === UserRole.ADMIN || userRole === UserRole.EDITOR;
      const isAuthor = comment.authorId === currentUserId;

      if (!isStaff && !isAuthor) {
        return res.status(403).json({ error: "Você não tem permissão para moderar este comentário." });
      }

      // Se possui respostas, mantém o placeholder marcado como deletado para preservar a árvore
      if (comment._count.replies > 0) {
        await prisma.postComment.update({
          where: { id: commentId },
          data: {
            isDeleted: true,
            deletedByRole: isStaff ? userRole : "AUTHOR",
          },
        });
      } else {
        await prisma.postComment.delete({ where: { id: commentId } });
      }

      res.json({ ok: true, deleted: true, isStaffModerated: isStaff });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao excluir comentário." });
    }
  });

  // ==========================================
  // 4. LIKES DE COMENTÁRIOS
  // ==========================================

  app.post("/api/posts/comments/:commentId/like", member, async (req: RequestWithUser, res: Response) => {
    try {
      const currentUserId = req.user!.userId;
      const commentId = String(req.params.commentId);

      const comment = await prisma.postComment.findUnique({
        where: { id: commentId },
        select: { id: true },
      });
      if (!comment) return res.status(404).json({ error: "Comentário não encontrado." });

      const existingLike = await prisma.postCommentLike.findUnique({
        where: {
          commentId_userId: { commentId, userId: currentUserId },
        },
      });

      if (existingLike) {
        await prisma.postCommentLike.delete({ where: { id: existingLike.id } });
        const likeCount = await prisma.postCommentLike.count({ where: { commentId } });
        return res.json({ liked: false, likeCount });
      } else {
        await prisma.postCommentLike.create({
          data: { commentId, userId: currentUserId },
        });
        const likeCount = await prisma.postCommentLike.count({ where: { commentId } });
        return res.json({ liked: true, likeCount });
      }
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Erro ao curtir comentário." });
    }
  });
}

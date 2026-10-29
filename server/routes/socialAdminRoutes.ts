/* Rotas do admin para os posts do Instagram (rascunho → revisão → aprovação → publicação).
 * O serviço (Gemini, Playwright) só é carregado quando uma rota é usada, para não pesar na subida da API. */
import type { Express, Request, Response, RequestHandler } from "express";
import { Prisma, PrismaClient, SocialPostStatus, SocialPostType } from "@prisma/client";

const loadService = () => import("../services/socialPublisherService.ts");

const STATUS_VALUES = new Set<string>(Object.values(SocialPostStatus));
const TYPE_VALUES = new Set<string>(Object.values(SocialPostType));

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
// SocialActionError traz o status certo (404/409/400); erro inesperado usa o padrão da rota
const actionStatus = (err: unknown, fallback: number) => {
  const status = err instanceof Error ? (err as Error & { status?: unknown }).status : undefined;
  return typeof status === "number" ? status : fallback;
};

function parseTextEdits(body: unknown): { title?: string; caption?: string; error?: string } {
  const { title, caption } = (body ?? {}) as { title?: unknown; caption?: unknown };
  if (title !== undefined && (typeof title !== "string" || title.length > 200)) return { error: "Título inválido (até 200 caracteres)." };
  if (caption !== undefined && (typeof caption !== "string" || caption.length > 5000)) return { error: "Legenda inválida." };
  return { title: title as string | undefined, caption: caption as string | undefined };
}

export function registerSocialRoutes(app: Express, prisma: PrismaClient, authRequired: RequestHandler, adminOnly: RequestHandler) {
  // situação das integrações (sim/não) + agenda
  app.get("/api/admin/social/status", authRequired, adminOnly, async (_req: Request, res: Response) => {
    try {
      const { socialIntegrationStatus } = await loadService();
      const { readSocialScheduleConfig, nextSlot } = await import("../services/socialSchedule.ts");
      const config = readSocialScheduleConfig();
      const token = await prisma.socialIntegrationToken.findUnique({ where: { provider: "instagram" }, select: { expiresAt: true, refreshedAt: true } }).catch(() => null);
      res.json({
        ...(await socialIntegrationStatus()),
        instagramTokenExpiresAt: token?.expiresAt ?? null,
        instagramTokenRefreshedAt: token?.refreshedAt ?? null,
        schedule: { days: config.days, hour: config.hour, minute: config.minute, leadHours: config.leadHours, next: nextSlot(new Date(), config) },
      });
    } catch (err) {
      res.status(500).json({ error: errorMessage(err, "Erro ao consultar as integrações.") });
    }
  });

  app.get("/api/admin/social/posts", authRequired, adminOnly, async (req: Request, res: Response) => {
    const status = typeof req.query.status === "string" && STATUS_VALUES.has(req.query.status) ? (req.query.status as SocialPostStatus) : undefined;
    try {
      const posts = await prisma.socialMediaPost.findMany({ where: status ? { status } : undefined, orderBy: { createdAt: "desc" }, take: 50 });
      res.json(posts);
    } catch (err) {
      res.status(500).json({ error: errorMessage(err, "Erro ao listar posts sociais.") });
    }
  });

  app.post("/api/admin/social/generate", authRequired, adminOnly, async (req: Request, res: Response) => {
    const { cardCode, customTopic, type, articleId, reel, spoiler, story } = (req.body ?? {}) as {
      cardCode?: unknown;
      customTopic?: unknown;
      type?: unknown;
      articleId?: unknown;
      reel?: unknown;
      spoiler?: unknown;
      story?: unknown;
    };
    try {
      const { startSocialPostDraft, socialGenerationState, CARD_CODE_PATTERN } = await loadService();
      const code = typeof cardCode === "string" && cardCode.trim() ? cardCode.trim().toUpperCase() : undefined;
      if (code && !CARD_CODE_PATTERN.test(code)) return res.status(400).json({ error: "Código de carta inválido (ex.: GD01-001)." });
      const topic = typeof customTopic === "string" ? customTopic.trim().slice(0, 300) || undefined : undefined;
      const isReel = reel === true;
      const isSpoiler = spoiler === true;
      const withStory = story === false ? false : undefined;
      const postType = isReel || isSpoiler
        ? SocialPostType.CARD_SPOTLIGHT
        : typeof type === "string" && TYPE_VALUES.has(type)
          ? (type as SocialPostType)
          : undefined;
      const article = postType === SocialPostType.ARTICLE && typeof articleId === "string" && articleId.trim() ? articleId.trim().slice(0, 64) : undefined;
      // responde na hora: a geração segue em segundo plano e o painel acompanha por GET /generation
      if (!startSocialPostDraft(prisma, { cardCode: code, customTopic: topic, type: postType, articleId: article, reel: isReel, spoiler: isSpoiler, story: withStory })) {
        return res.status(409).json({ error: "Já tem um post sendo gerado. Ele aparece na lista e no Discord quando terminar.", generation: socialGenerationState() });
      }
      res.status(202).json(socialGenerationState());
    } catch (err) {
      res.status(500).json({ error: errorMessage(err, "Erro ao gerar post com IA.") });
    }
  });

  app.get("/api/admin/social/generation", authRequired, adminOnly, async (_req: Request, res: Response) => {
    const { socialGenerationState } = await loadService();
    res.json(socialGenerationState());
  });

  // edição de título/legenda (e configurações do Story companheiro)
  app.put("/api/admin/social/posts/:id", authRequired, adminOnly, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const edits = parseTextEdits(req.body);
    if (edits.error) return res.status(400).json({ error: edits.error });
    const { storyEnabled, storyTitle } = (req.body ?? {}) as { storyEnabled?: unknown; storyTitle?: unknown };
    try {
      const existing = await prisma.socialMediaPost.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Post não encontrado." });
      const { SOCIAL_EDITABLE, updatePostStorySettings } = await loadService();
      if (!SOCIAL_EDITABLE.has(existing.status)) return res.status(409).json({ error: "Post já publicado (ou publicando) não pode ser editado." });
      if (typeof storyEnabled === "boolean" || typeof storyTitle === "string") {
        await updatePostStorySettings(prisma, id, {
          storyEnabled: typeof storyEnabled === "boolean" ? storyEnabled : undefined,
          storyTitle: typeof storyTitle === "string" ? storyTitle : undefined,
        });
      }
      const updated = await prisma.socialMediaPost.update({ where: { id }, data: { title: edits.title, caption: edits.caption } });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: errorMessage(err, "Erro ao atualizar post.") });
    }
  });

  // configurar ou regerar o vídeo MP4 do Story companheiro do post
  app.post("/api/admin/social/posts/:id/story", authRequired, adminOnly, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { storyEnabled, storyTitle, regenerate } = (req.body ?? {}) as {
      storyEnabled?: unknown;
      storyTitle?: unknown;
      regenerate?: unknown;
    };
    try {
      const { updatePostStorySettings } = await loadService();
      const updated = await updatePostStorySettings(prisma, id, {
        storyEnabled: typeof storyEnabled === "boolean" ? storyEnabled : undefined,
        storyTitle: typeof storyTitle === "string" ? storyTitle : undefined,
        regenerate: regenerate === true,
      });
      res.json(updated);
    } catch (err) {
      res.status(actionStatus(err, 400)).json({ error: errorMessage(err, "Erro ao atualizar o Story do post.") });
    }
  });

  /** Tempo máximo em ms que a rota HTTP aguarda a publicação na Meta antes de devolver 202 Accepted. */
  const PUBLISH_MAX_WAIT_MS = 15000;

  async function withQuickPublishResponse<T extends { ok: boolean; post: unknown; publishing?: boolean }>(
    promise: Promise<T>,
    fallbackPostGetter: () => Promise<unknown>,
  ): Promise<{ result: T; status: number }> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<{ result: T; status: number }>((resolve) => {
      timer = setTimeout(async () => {
        const fallback = await fallbackPostGetter().catch(() => null);
        resolve({
          result: { ok: true, publishing: true, post: fallback } as unknown as T,
          status: 202,
        });
      }, PUBLISH_MAX_WAIT_MS);
    });

    try {
      const outcome = await Promise.race([
        promise.then((res) => ({ result: res, status: 200 })),
        timeoutPromise,
      ]);
      clearTimeout(timer!);
      return outcome;
    } catch (err) {
      clearTimeout(timer!);
      throw err;
    }
  }

  // aprovar: salva a edição que estiver na tela e, se já passou do horário marcado, publica na hora
  app.post("/api/admin/social/posts/:id/approve", authRequired, adminOnly, async (req: Request, res: Response) => {
    const edits = parseTextEdits(req.body);
    if (edits.error) return res.status(400).json({ error: edits.error });
    const { storyEnabled, storyTitle } = (req.body ?? {}) as { storyEnabled?: unknown; storyTitle?: unknown };
    const id = String(req.params.id);
    try {
      const { approveSocialPost } = await loadService();
      const approveTask = approveSocialPost(prisma, id, {
        title: edits.title,
        caption: edits.caption,
        storyEnabled: typeof storyEnabled === "boolean" ? storyEnabled : undefined,
        storyTitle: typeof storyTitle === "string" ? storyTitle : undefined,
      });
      const { result, status } = await withQuickPublishResponse(approveTask, () =>
        prisma.socialMediaPost.findUnique({ where: { id } }),
      );
      res.status(status).json(result);
    } catch (err) {
      res.status(actionStatus(err, 400)).json({ error: errorMessage(err, "Erro ao aprovar post.") });
    }
  });

  // publicar agora (aprovado aguardando horário, ou nova tentativa depois de falha)
  app.post("/api/admin/social/posts/:id/publish", authRequired, adminOnly, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    try {
      const { publishApprovedPost } = await loadService();
      const publishTask = publishApprovedPost(prisma, id).then((post) => ({
        ok: post.status === SocialPostStatus.PUBLISHED,
        post,
        publishing: post.status === SocialPostStatus.PUBLISHING,
      }));
      const { result, status } = await withQuickPublishResponse(publishTask, () =>
        prisma.socialMediaPost.findUnique({ where: { id } }),
      );
      res.status(status).json(result);
    } catch (err) {
      res.status(400).json({ error: errorMessage(err, "Erro ao publicar.") });
    }
  });

  app.post("/api/admin/social/posts/:id/reject", authRequired, adminOnly, async (req: Request, res: Response) => {
    const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 300) : "";
    try {
      const { rejectSocialPost } = await loadService();
      res.json({ ok: true, post: await rejectSocialPost(prisma, String(req.params.id), reason) });
    } catch (err) {
      res.status(actionStatus(err, 400)).json({ error: errorMessage(err, "Erro ao rejeitar post.") });
    }
  });

  app.delete("/api/admin/social/posts/:id", authRequired, adminOnly, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    try {
      // a imagem fica no disco até a limpeza diária da agenda (cleanupOrphanSocialImages)
      await prisma.socialMediaPost.delete({ where: { id } });
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return res.status(404).json({ error: "Post não encontrado." });
      res.status(400).json({ error: errorMessage(err, "Erro ao excluir post.") });
    }
  });
}

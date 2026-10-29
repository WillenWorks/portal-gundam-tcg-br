import type { Express, Request, Response, RequestHandler } from "express";
import { PrismaClient, PostStatus } from "@prisma/client";
import { generateArticleWithAi, type ArticleAiGenerateInput } from "../services/articleAiService.ts";

export function registerArticleAdminRoutes(
  app: Express,
  prisma: PrismaClient,
  authRequired: RequestHandler,
  editorOrAdmin: RequestHandler,
) {
  /**
   * Gera um artigo completo com IA especializada (jornalismo gamer / análise tática de TCG).
   * Devolve o artigo estruturado para prévia/edição no painel antes de salvar.
   */
  app.post("/api/admin/articles/generate", authRequired, editorOrAdmin, async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as ArticleAiGenerateInput;
    const topic = String(body.topic || "").trim();
    if (!topic) {
      return res.status(400).json({ error: "O tema ou pauta do artigo é obrigatório." });
    }

    try {
      const generated = await generateArticleWithAi(prisma, {
        topic,
        category: body.category,
        context: body.context,
        rules: body.rules,
        cardReferences: Array.isArray(body.cardReferences) ? body.cardReferences : [],
        imageMode: body.imageMode || "CARD_ART",
        customImageUrl: body.customImageUrl,
        modelPreference: body.modelPreference,
      });

      return res.json({ ok: true, article: generated });
    } catch (err) {
      console.error("[articleAdminRoutes] Erro ao gerar artigo com IA:", err);
      const msg = err instanceof Error ? err.message : "Falha na geração do artigo com IA.";
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * Aprova um artigo (status REVIEW ou DRAFT -> PUBLISHED), publicando no site
   * e enfileirando simultaneamente o post do feed e o Story de notificação no Instagram.
   */
  app.post("/api/admin/articles/:id/approve", authRequired, editorOrAdmin, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = (req.body ?? {}) as { publishSocialNow?: boolean };

    try {
      const existing = await prisma.post.findUnique({
        where: { id },
        include: { author: true },
      });

      if (!existing) {
        return res.status(404).json({ error: "Artigo não encontrado." });
      }

      const updated = await prisma.post.update({
        where: { id },
        data: {
          status: PostStatus.PUBLISHED,
          publishedAt: existing.publishedAt ?? new Date(),
        },
        include: { author: true },
      });

      let socialDraftCreated = false;
      let socialPublished = false;
      let socialPostId: string | null = null;
      let socialError: string | null = null;

      try {
        const { queueArticleSocialDraft, createSocialPostDraft, publishApprovedPost } = await import(
          "../services/socialPublisherService.ts"
        );

        if (body.publishSocialNow) {
          // Cria o rascunho com Story síncrono e já dispara a publicação na Meta
          const draft = await createSocialPostDraft(prisma, {
            type: "ARTICLE" as any,
            articleId: updated.id,
            slotKey: `artigo-${updated.id}`,
          });
          socialDraftCreated = true;
          socialPostId = draft.id;

          try {
            const pubResult = await publishApprovedPost(prisma, draft.id);
            socialPublished = pubResult.status === "PUBLISHED";
          } catch (pubErr) {
            socialError = pubErr instanceof Error ? pubErr.message : "Erro ao publicar no Instagram.";
            console.warn("[articleAdminRoutes] Falha na publicação imediata no Instagram:", socialError);
          }
        } else {
          socialDraftCreated = await queueArticleSocialDraft(prisma, updated.id);
        }
      } catch (socialErr) {
        console.warn("[articleAdminRoutes] Falha ao processar post social do artigo:", socialErr);
      }

      return res.json({
        ok: true,
        post: updated,
        socialDraftCreated,
        socialPublished,
        socialPostId,
        socialError,
      });
    } catch (err) {
      console.error("[articleAdminRoutes] Erro ao aprovar artigo:", err);
      const msg = err instanceof Error ? err.message : "Falha ao aprovar artigo.";
      return res.status(500).json({ error: msg });
    }
  });
}

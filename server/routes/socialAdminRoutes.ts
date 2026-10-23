/* Rotas do admin para os posts do Instagram (rascunho → revisão → aprovação → publicação).
 * O serviço (Gemini, Playwright) só é carregado quando uma rota é usada, para não pesar na subida da API. */
import type { Express, Request, Response, RequestHandler } from "express";
import { Prisma, PrismaClient, SocialPostStatus, SocialPostType } from "@prisma/client";

const loadService = () => import("../services/socialPublisherService.ts");

const STATUS_VALUES = new Set<string>(Object.values(SocialPostStatus));
const TYPE_VALUES = new Set<string>(Object.values(SocialPostType));
const EDITABLE = new Set<SocialPostStatus>([SocialPostStatus.DRAFT, SocialPostStatus.PENDING_APPROVAL, SocialPostStatus.APPROVED, SocialPostStatus.FAILED, SocialPostStatus.REJECTED]);

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

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
    const { cardCode, customTopic, type } = (req.body ?? {}) as { cardCode?: unknown; customTopic?: unknown; type?: unknown };
    try {
      const { createSocialPostDraft, CARD_CODE_PATTERN } = await loadService();
      const code = typeof cardCode === "string" && cardCode.trim() ? cardCode.trim().toUpperCase() : undefined;
      if (code && !CARD_CODE_PATTERN.test(code)) return res.status(400).json({ error: "Código de carta inválido (ex.: GD01-001)." });
      const topic = typeof customTopic === "string" ? customTopic.trim().slice(0, 300) || undefined : undefined;
      const postType = typeof type === "string" && TYPE_VALUES.has(type) ? (type as SocialPostType) : undefined;
      const post = await createSocialPostDraft(prisma, { cardCode: code, customTopic: topic, type: postType });
      res.json(post);
    } catch (err) {
      res.status(500).json({ error: errorMessage(err, "Erro ao gerar post com IA.") });
    }
  });

  // edição de título/legenda (post já publicado não muda: o Instagram não aceita editar pela API)
  app.put("/api/admin/social/posts/:id", authRequired, adminOnly, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const edits = parseTextEdits(req.body);
    if (edits.error) return res.status(400).json({ error: edits.error });
    try {
      const existing = await prisma.socialMediaPost.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Post não encontrado." });
      if (!EDITABLE.has(existing.status)) return res.status(409).json({ error: "Post já publicado (ou publicando) não pode ser editado." });
      const updated = await prisma.socialMediaPost.update({ where: { id }, data: { title: edits.title, caption: edits.caption } });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: errorMessage(err, "Erro ao atualizar post.") });
    }
  });

  // aprovar: salva a edição que estiver na tela e, se já passou do horário marcado, publica na hora
  app.post("/api/admin/social/posts/:id/approve", authRequired, adminOnly, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const edits = parseTextEdits(req.body);
    if (edits.error) return res.status(400).json({ error: edits.error });
    try {
      const { captionProblems, missingAdDisclosure, publishApprovedPost } = await loadService();
      const { readInstagramConfig } = await import("../services/instagramPublisher.ts");
      const existing = await prisma.socialMediaPost.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Post não encontrado." });
      if (!EDITABLE.has(existing.status)) return res.status(409).json({ error: "Este post já foi publicado." });
      const caption = edits.caption ?? existing.caption;
      const problems = captionProblems(caption);
      if (problems.length) return res.status(400).json({ error: problems.join(" ") });
      if (missingAdDisclosure(existing.type, caption)) return res.status(400).json({ error: "Post de afiliado precisa estar identificado como publicidade (ex.: #publi) — regra do CONAR." });

      const approved = await prisma.socialMediaPost.update({
        where: { id },
        data: { title: edits.title, caption, status: SocialPostStatus.APPROVED, approvedAt: new Date(), publishError: null, rejectedReason: null },
      });
      const due = !approved.scheduledFor || approved.scheduledFor.getTime() <= Date.now();
      if (due && readInstagramConfig()) {
        const post = await publishApprovedPost(prisma, id);
        return res.json({ ok: post.status === SocialPostStatus.PUBLISHED, post });
      }
      res.json({ ok: true, post: approved });
    } catch (err) {
      res.status(400).json({ error: errorMessage(err, "Erro ao aprovar post.") });
    }
  });

  // publicar agora (aprovado aguardando horário, ou nova tentativa depois de falha)
  app.post("/api/admin/social/posts/:id/publish", authRequired, adminOnly, async (req: Request, res: Response) => {
    try {
      const { publishApprovedPost } = await loadService();
      const post = await publishApprovedPost(prisma, String(req.params.id));
      res.json({ ok: post.status === SocialPostStatus.PUBLISHED, post });
    } catch (err) {
      res.status(400).json({ error: errorMessage(err, "Erro ao publicar.") });
    }
  });

  app.post("/api/admin/social/posts/:id/reject", authRequired, adminOnly, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 300) : "";
    try {
      const updated = await prisma.socialMediaPost.updateMany({
        where: { id, status: { notIn: [SocialPostStatus.PUBLISHED, SocialPostStatus.PUBLISHING] } },
        data: { status: SocialPostStatus.REJECTED, rejectedReason: reason || "Rejeitado pelo moderador" },
      });
      if (updated.count !== 1) return res.status(409).json({ error: "Post não encontrado ou já publicado." });
      res.json({ ok: true, post: await prisma.socialMediaPost.findUnique({ where: { id } }) });
    } catch (err) {
      res.status(400).json({ error: errorMessage(err, "Erro ao rejeitar post.") });
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

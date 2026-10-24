/* Registra POST /api/discord/interactions. Precisa vir ANTES do express.json global: a assinatura do Discord é sobre
 * os bytes exatos do corpo. O serviço (SDKs de IA, Playwright) só carrega no primeiro clique, não na subida da API. */
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { PrismaClient } from "@prisma/client";

export function registerDiscordInteractionRoute(app: Express, prisma: PrismaClient) {
  let handler: ((req: Request, res: Response) => Promise<void>) | null = null;

  app.post("/api/discord/interactions", express.raw({ type: "*/*", limit: "100kb" }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!handler) {
        const [{ createDiscordInteractionHandler }, social, { readDiscordBotConfig }] = await Promise.all([
          import("./discordInteractions.ts"),
          import("../services/socialPublisherService.ts"),
          import("../services/discordBot.ts"),
        ]);
        handler = createDiscordInteractionHandler({
          config: () => readDiscordBotConfig(),
          approve: (postId) => social.approveSocialPost(prisma, postId),
          reject: (postId, reason) => social.rejectSocialPost(prisma, postId, reason),
          publicUrl: () => social.socialPublicAppUrl(),
        });
      }
      await handler(req, res);
    } catch (err) {
      next(err);
    }
  });
}

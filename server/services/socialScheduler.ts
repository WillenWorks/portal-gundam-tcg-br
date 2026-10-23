/* Agenda do Instagram rodando dentro da API (liga com SOCIAL_SCHEDULER_ENABLED=true).
 *
 * A cada 5 minutos:
 *  1. em dia de post (padrão seg/qua/sex), a partir de SOCIAL_DRAFT_LEAD_HOURS antes do horário, gera o rascunho
 *     do dia (uma vez só: o dia fica gravado em slotKey, único no banco) e avisa no Discord;
 *  2. publica os posts APROVADOS cujo horário já chegou;
 *  3. uma vez por dia, renova o token do Instagram (vale 60 dias) e apaga imagens de posts excluídos.
 * Nada é publicado sem aprovação: rascunho não aprovado fica esperando no painel.
 *
 * Por que aqui e não num cron do GitHub: o agendamento do GitHub Actions atrasa de 3 a 7 horas. */
import { Prisma, SocialPostStatus, type PrismaClient } from "@prisma/client";
import { draftSlotDue, readSocialScheduleConfig, slotKeyFor } from "./socialSchedule.ts";

const TICK_MS = 5 * 60_000;
const TOKEN_CHECK_MS = 24 * 3600_000;

type Deps = {
  now?: () => Date;
  createDraft?: (prisma: PrismaClient, input: { scheduledFor: Date; slotKey: string }) => Promise<unknown>;
  publish?: (prisma: PrismaClient, postId: string) => Promise<unknown>;
  refreshToken?: (prisma: PrismaClient) => Promise<unknown>;
  instagramConfigured?: () => boolean;
};

let running = false;
let lastTokenCheck = 0;

/** Um ciclo da agenda (exportado para teste). */
export async function runSocialSchedulerTick(prisma: PrismaClient, deps: Deps = {}): Promise<{ drafted: string | null; published: number }> {
  if (running) return { drafted: null, published: 0 };
  running = true;
  const now = (deps.now ?? (() => new Date()))();
  let drafted: string | null = null;
  let published = 0;
  try {
    const service = deps.createDraft && deps.publish ? null : await import("./socialPublisherService.ts");
    const ig = deps.instagramConfigured ? null : await import("./instagramPublisher.ts");
    const instagramConfigured = deps.instagramConfigured ?? (() => Boolean(ig?.readInstagramConfig()));

    // 1. rascunho do dia
    const slot = draftSlotDue(now, readSocialScheduleConfig());
    if (slot) {
      const slotKey = slotKeyFor(slot);
      const exists = await prisma.socialMediaPost.findUnique({ where: { slotKey }, select: { id: true } });
      if (!exists) {
        try {
          await (deps.createDraft ?? service!.createSocialPostDraft)(prisma, { scheduledFor: slot, slotKey });
          drafted = slotKey;
        } catch (err) {
          // outro processo gerou o mesmo dia ao mesmo tempo: tudo bem
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
        }
      }
    }

    // limpeza diária das imagens de posts excluídos (com ou sem Instagram configurado)
    const daily = now.getTime() - lastTokenCheck >= TOKEN_CHECK_MS;
    if (daily && service) await service.cleanupOrphanSocialImages(prisma, now).catch(() => 0);

    // 2. aprovados cujo horário chegou
    if (instagramConfigured()) {
      const due = await prisma.socialMediaPost.findMany({
        where: { status: SocialPostStatus.APPROVED, OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] },
        select: { id: true },
        orderBy: { scheduledFor: "asc" },
        take: 3,
      });
      for (const post of due) {
        await (deps.publish ?? service!.publishApprovedPost)(prisma, post.id);
        published += 1;
      }

      // 3. token
      if (daily) await (deps.refreshToken ?? ig!.refreshInstagramTokenIfNeeded)(prisma);
    }
    if (daily) lastTokenCheck = now.getTime();
  } finally {
    running = false;
  }
  return { drafted, published };
}

export function startSocialScheduler(prisma: PrismaClient): void {
  if (process.env.SOCIAL_SCHEDULER_ENABLED !== "true") return;
  const tick = () =>
    runSocialSchedulerTick(prisma).catch((err) => {
      console.error("[socialScheduler] falha no ciclo:", err instanceof Error ? err.message : err);
    });
  setTimeout(tick, 60_000).unref();
  setInterval(tick, TICK_MS).unref();
  console.log("[socialScheduler] agenda do Instagram ligada");
}

/** Só para testes: zera o controle de renovação do token. */
export function resetSocialSchedulerState(): void {
  running = false;
  lastTokenCheck = 0;
}

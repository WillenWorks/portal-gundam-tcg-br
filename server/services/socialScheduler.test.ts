import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSocialSchedulerState, runSocialSchedulerTick } from "./socialScheduler";

function makePrisma({ existingSlot = false, due = [] as { id: string }[] } = {}) {
  return {
    socialMediaPost: {
      findUnique: vi.fn().mockResolvedValue(existingSlot ? { id: "ja-existe" } : null),
      findMany: vi.fn().mockResolvedValue(due),
    },
  } as any;
}

describe("agenda do Instagram (ciclo)", () => {
  beforeEach(() => {
    resetSocialSchedulerState();
    delete process.env.SOCIAL_POST_DAYS;
    delete process.env.SOCIAL_POST_TIME;
    delete process.env.SOCIAL_DRAFT_LEAD_HOURS;
  });

  it("segunda às 08:00 gera o rascunho do dia com horário e chave do dia", async () => {
    const createDraft = vi.fn().mockResolvedValue({});
    const result = await runSocialSchedulerTick(makePrisma(), {
      now: () => new Date("2026-10-26T11:00:00Z"),
      createDraft,
      publish: vi.fn(),
      refreshToken: vi.fn(),
      instagramConfigured: () => false,
    });
    expect(result.drafted).toBe("2026-10-26");
    expect(createDraft.mock.calls[0][1]).toEqual({ scheduledFor: new Date("2026-10-26T15:00:00Z"), slotKey: "2026-10-26" });
  });

  it("não gera de novo se o rascunho do dia já existe, nem em dia sem post", async () => {
    const createDraft = vi.fn();
    await runSocialSchedulerTick(makePrisma({ existingSlot: true }), { now: () => new Date("2026-10-26T12:00:00Z"), createDraft, publish: vi.fn(), instagramConfigured: () => false });
    await runSocialSchedulerTick(makePrisma(), { now: () => new Date("2026-10-27T12:00:00Z"), createDraft, publish: vi.fn(), instagramConfigured: () => false });
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("publica os aprovados cujo horário chegou e renova o token uma vez por dia", async () => {
    const publish = vi.fn().mockResolvedValue({});
    const refreshToken = vi.fn().mockResolvedValue("fresh");
    const prisma = makePrisma({ due: [{ id: "a" }, { id: "b" }] });
    const deps = { now: () => new Date("2026-10-27T15:00:00Z"), createDraft: vi.fn(), publish, refreshToken, instagramConfigured: () => true };
    const result = await runSocialSchedulerTick(prisma, deps);
    expect(result.published).toBe(2);
    expect(publish.mock.calls.map((c) => c[1])).toEqual(["a", "b"]);
    await runSocialSchedulerTick(prisma, deps);
    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  it("sem Instagram configurado não tenta publicar", async () => {
    const publish = vi.fn();
    const prisma = makePrisma({ due: [{ id: "a" }] });
    await runSocialSchedulerTick(prisma, { now: () => new Date("2026-10-27T15:00:00Z"), createDraft: vi.fn(), publish, instagramConfigured: () => false });
    expect(publish).not.toHaveBeenCalled();
    expect(prisma.socialMediaPost.findMany).not.toHaveBeenCalled();
  });
});

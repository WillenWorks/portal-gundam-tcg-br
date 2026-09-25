import { describe, expect, it, vi } from "vitest";
import {
  ABANDONED_MATCH_RETENTION_MS,
  FINISHED_MATCH_RETENTION_MS,
  purgeStaleSimulatorMatches,
  simulatorMatchPurgeWhere,
} from "./simulatorMatchCleanup.ts";

const NOW = new Date("2026-09-25T12:00:00Z");

describe("simulatorMatchPurgeWhere", () => {
  it("apaga terminadas há mais de 1 dia e não terminadas sem atividade há mais de 7 dias", () => {
    const where = simulatorMatchPurgeWhere(NOW);
    expect(where).toEqual({
      OR: [
        { finishedAt: { lt: new Date(NOW.getTime() - FINISHED_MATCH_RETENTION_MS) } },
        { finishedAt: null, updatedAt: { lt: new Date(NOW.getTime() - ABANDONED_MATCH_RETENTION_MS) } },
      ],
    });
    expect(FINISHED_MATCH_RETENTION_MS).toBe(24 * 60 * 60 * 1000);
    expect(ABANDONED_MATCH_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("purgeStaleSimulatorMatches", () => {
  it("chama deleteMany com o filtro e devolve quantas linhas saíram", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const count = await purgeStaleSimulatorMatches({ deleteMany }, NOW);
    expect(count).toBe(3);
    expect(deleteMany).toHaveBeenCalledWith({ where: simulatorMatchPurgeWhere(NOW) });
  });

  it("falha do banco vira 0 com aviso no log, sem derrubar o servidor", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deleteMany = vi.fn().mockRejectedValue(new Error("conexão caiu"));
    const count = await purgeStaleSimulatorMatches({ deleteMany }, NOW);
    expect(count).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

import { describe, expect, it } from "vitest";
import { STALE_AFTER_MS, sourceHealth, summarizeRuns } from "./dataHealthService.ts";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const row = (sourceUrl: string, updatedAt: string, dateStart: string | null) => ({
  sourceUrl,
  updatedAt: new Date(updatedAt),
  dateStart: dateStart ? new Date(dateStart) : null,
});

describe("saúde da coleta de torneios", () => {
  it("última importação e último evento por fonte; atrasada passado o limite", () => {
    const rows = [
      row("https://deckbuilder.egmanevents.com/gundam/tournaments#a", "2026-10-16T09:30:00Z", "2026-10-12T00:00:00Z"),
      row("https://deckbuilder.egmanevents.com/gundam/tournaments#b", "2026-10-15T09:30:00Z", "2026-10-14T00:00:00Z"),
      row("https://gundam.digilab.cards/tournament/1", new Date(NOW - STALE_AFTER_MS - 60_000).toISOString(), "2026-10-13T00:00:00Z"),
      row("https://manual.example/x", "2026-10-16T10:00:00Z", null),
    ];
    const [egman, digilab] = sourceHealth(rows, NOW);
    expect(egman).toMatchObject({ id: "egman", tournaments: 2, lastImportAt: "2026-10-16T09:30:00.000Z", lastEventDate: "2026-10-14", stale: false });
    expect(digilab).toMatchObject({ id: "digilab", tournaments: 1, stale: true });
  });

  it("fonte sem nenhum torneio conta como atrasada", () => {
    const [, digilab] = sourceHealth([], NOW);
    expect(digilab).toMatchObject({ tournaments: 0, lastImportAt: null, stale: true });
  });

  it("resume os runs do workflow: o último e o último que deu certo", () => {
    const runs = [
      { status: "completed", conclusion: "failure", created_at: "2026-10-16T09:00:00Z", html_url: "u3", event: "schedule" },
      { status: "completed", conclusion: "success", created_at: "2026-10-15T09:00:00Z", html_url: "u2", event: "schedule" },
    ];
    expect(summarizeRuns(runs)).toEqual({
      lastRun: { status: "completed", conclusion: "failure", createdAt: "2026-10-16T09:00:00Z", url: "u3", event: "schedule" },
      lastSuccessAt: "2026-10-15T09:00:00Z",
    });
    expect(summarizeRuns([])).toEqual({ lastRun: null, lastSuccessAt: null });
  });
});

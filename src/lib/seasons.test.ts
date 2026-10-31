import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_ANALYSIS_SEASON,
  LATEST_SEASON,
  SEASON_CODES,
  SEASON_SLICES,
  SEASONS,
  isSeasonCode,
  normalizeSeasonCode,
  seasonAlias,
  seasonForDate,
  seasonsNewestFirst,
} from "./seasons";

describe("temporadas — fonte única", () => {
  it("em ordem de lançamento, sem código repetido; a última é a atual", () => {
    const dates = SEASONS.map((s) => s.startDate);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(SEASON_CODES).size).toBe(SEASON_CODES.length);
    expect(LATEST_SEASON).toBe(SEASON_CODES[SEASON_CODES.length - 1]);
    expect(seasonsNewestFirst()[0].code).toBe(LATEST_SEASON);
  });

  it("GD06 aberta em 30/10/2026; a análise abre em GD05 até o GD06 juntar listas", () => {
    expect(SEASONS.find((s) => s.code === "GD06")?.startDate).toBe("2026-10-30");
    expect(SEASON_CODES).toContain(DEFAULT_ANALYSIS_SEASON);
    expect(DEFAULT_ANALYSIS_SEASON).toBe("GD05");
  });

  it("recortes e grafias antigas contam como o próprio formato", () => {
    for (const s of SEASON_SLICES) expect(SEASON_CODES).toContain(s.format);
    expect(normalizeSeasonCode("GD05.5")).toBe("GD05");
    expect(normalizeSeasonCode(" gd05_combined ")).toBe("GD05");
    expect(normalizeSeasonCode("GD04")).toBe("GD04");
    expect(normalizeSeasonCode("")).toBeNull();
    expect(seasonAlias("GD05")).toBeNull();
    expect(isSeasonCode("gd05.5")).toBe(true);
    expect(isSeasonCode("EB01")).toBe(false);
  });

  it("temporada vigente numa data: até a véspera do próximo lançamento", () => {
    expect(seasonForDate("2025-07-24")).toBeNull();
    expect(seasonForDate("2026-10-29T23:00:00Z")).toBe("GD05");
    expect(seasonForDate("2026-10-30")).toBe("GD06");
  });

  it("nenhum código de temporada escrito à mão nas leituras de temporada", () => {
    // set novo = só src/lib/seasons.json; estes arquivos tinham "GD05"/"GD05.5" fixos até 2026-10-31
    const files = [
      "server/seasonFormatMetaService.ts",
      "server/vedaCore.ts",
      "src/pages/StatsPage.tsx",
      "src/pages/veda/VedaArchetypesPage.tsx",
      "src/pages/veda/VedaTournamentsPage.tsx",
      "src/pages/veda/VedaPlayerPage.tsx",
      "src/pages/veda/VedaArchetypeDetailPage.tsx",
      "src/components/stats/FormatArchetypeCoresPanel.tsx",
      "scripts/gundam-meta-scrape.mjs",
      "scripts/gundam-meta-cores.mjs",
      "prisma/import-tournaments.mjs",
    ];
    for (const f of files) {
      const code = readFileSync(new URL(`../../${f}`, import.meta.url), "utf8")
        .split(/\r*\n/)
        .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
        .map((l) => l.replace(/\s\/\/ .*$/, ""));
      const hits = code.filter((l) => /["'`]GD0\d(\.5|_COMBINED)?["'`]/.test(l));
      expect(hits, f).toEqual([]);
    }
  });
});

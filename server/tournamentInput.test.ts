import { describe, expect, it } from "vitest";
import { tournamentCreateSchema, tournamentUpdateSchema } from "./tournamentInput.ts";

describe("tournamentInput", () => {
  it("aceita o que o painel envia", () => {
    const parsed = tournamentCreateSchema.parse({
      name: " Regional ", organizer: null, country: null, city: "Campinas", format: "constructed", season: null, seasonId: null, sourceUrl: null,
      participantCount: 32, roundCount: null, topCutSize: 8, dateStart: "2026-11-03T12:00:00.000Z", dateEnd: null, tier: "SMALL_OFFICIAL", vodUrls: [],
    });
    expect(parsed.name).toBe("Regional");
    expect(parsed.dateStart).toEqual(new Date("2026-11-03T12:00:00.000Z"));
    expect(parsed.dateEnd).toBeNull();
  });

  it("descarta campos que não são do formulário", () => {
    const parsed = tournamentUpdateSchema.parse({ name: "x", id: "outro", isActive: false, deletedAt: null, entries: { deleteMany: {} } });
    expect(parsed).toEqual({ name: "x" });
  });

  it("recusa valores inválidos", () => {
    expect(tournamentCreateSchema.safeParse({}).success).toBe(false);
    expect(tournamentCreateSchema.safeParse({ name: "x", tier: "INEXISTENTE" }).success).toBe(false);
    expect(tournamentCreateSchema.safeParse({ name: "x", participantCount: -1 }).success).toBe(false);
    expect(tournamentCreateSchema.safeParse({ name: "x", dateStart: "não é data" }).success).toBe(false);
  });

  it("edição parcial não inventa campos", () => {
    expect(tournamentUpdateSchema.parse({ city: "Santos" })).toEqual({ city: "Santos" });
  });
});

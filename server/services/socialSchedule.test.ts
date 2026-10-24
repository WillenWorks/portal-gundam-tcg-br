import { describe, expect, it } from "vitest";
import { draftSlotDue, formatSlot, nextSlot, postTypeFor, previousWeekRange, readSocialScheduleConfig, slotKeyFor, todaySlot } from "./socialSchedule";

const config = readSocialScheduleConfig({});

describe("agenda do Instagram", () => {
  it("padrão: segunda, quarta e sexta às 12:00 de Brasília, rascunho 4 h antes", () => {
    expect(config).toEqual({ days: [1, 3, 5], plan: { 1: "TOURNAMENT_REPORT", 3: "CARD_SPOTLIGHT", 5: "DECK_FEATURE" }, hour: 12, minute: 0, leadHours: 4 });
  });

  it("ignora valores inválidos nas variáveis", () => {
    expect(readSocialScheduleConfig({ SOCIAL_POST_DAYS: "9,x", SOCIAL_POST_TIME: "25:99", SOCIAL_DRAFT_LEAD_HOURS: "-3" })).toEqual(config);
    expect(readSocialScheduleConfig({ SOCIAL_POST_DAYS: "2,4", SOCIAL_POST_TIME: "19:30" })).toMatchObject({ days: [2, 4], plan: { 2: "CARD_SPOTLIGHT", 4: "CARD_SPOTLIGHT" }, hour: 19, minute: 30 });
    expect(readSocialScheduleConfig({ SOCIAL_POST_PLAN: "9:DECK_FEATURE,x:y,2:OUTRO" })).toMatchObject({ days: [1, 3, 5] });
  });

  it("horário de hoje em UTC (Brasília é UTC−3)", () => {
    // segunda-feira, 26/10/2026, 08:00 em Brasília
    const monday = new Date("2026-10-26T11:00:00Z");
    expect(todaySlot(monday, config)?.toISOString()).toBe("2026-10-26T15:00:00.000Z");
    // terça não é dia de post
    expect(todaySlot(new Date("2026-10-27T11:00:00Z"), config)).toBeNull();
  });

  it("dia da agenda usa a data de Brasília, não a de UTC", () => {
    // 23:30 de sexta em Brasília já é sábado em UTC
    expect(slotKeyFor(new Date("2026-10-31T02:30:00Z"))).toBe("2026-10-30");
  });

  it("rascunho só a partir de 4 h antes e até o fim do dia", () => {
    expect(draftSlotDue(new Date("2026-10-26T10:59:00Z"), config)).toBeNull(); // 07:59
    expect(draftSlotDue(new Date("2026-10-26T11:00:00Z"), config)?.toISOString()).toBe("2026-10-26T15:00:00.000Z"); // 08:00
    expect(draftSlotDue(new Date("2026-10-26T22:00:00Z"), config)?.toISOString()).toBe("2026-10-26T15:00:00.000Z"); // 19:00
    expect(draftSlotDue(new Date("2026-10-27T15:00:00Z"), config)).toBeNull(); // terça
  });

  it("próximo horário pula para o próximo dia de post", () => {
    // sexta 30/10 às 13:00 (já passou o horário) → segunda 02/11 12:00
    expect(nextSlot(new Date("2026-10-30T16:00:00Z"), config)?.toISOString()).toBe("2026-11-02T15:00:00.000Z");
    // segunda às 09:00 → hoje mesmo
    expect(nextSlot(new Date("2026-10-26T12:00:00Z"), config)?.toISOString()).toBe("2026-10-26T15:00:00.000Z");
  });

  it("formata em português no fuso de Brasília", () => {
    expect(formatSlot(new Date("2026-10-26T15:00:00Z"))).toContain("12:00");
  });

  it("formato de cada dia: segunda torneios, quarta carta, sexta deck (e o plano pode mudar)", () => {
    expect(postTypeFor(new Date("2026-10-26T15:00:00Z"), config)).toBe("TOURNAMENT_REPORT");
    expect(postTypeFor(new Date("2026-10-28T15:00:00Z"), config)).toBe("CARD_SPOTLIGHT");
    expect(postTypeFor(new Date("2026-10-30T15:00:00Z"), config)).toBe("DECK_FEATURE");
    const custom = readSocialScheduleConfig({ SOCIAL_POST_PLAN: "0:DECK_FEATURE, 2:TOURNAMENT_REPORT" });
    expect(custom.days).toEqual([0, 2]);
    expect(postTypeFor(new Date("2026-10-27T15:00:00Z"), custom)).toBe("TOURNAMENT_REPORT");
  });

  it("semana anterior ao post de segunda: segunda a domingo, pela data de Brasília", () => {
    expect(previousWeekRange(new Date("2026-10-26T15:00:00Z"))).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    // 22:00 de domingo em Brasília (já é segunda em UTC) ainda conta como a semana do domingo
    expect(previousWeekRange(new Date("2026-11-02T01:00:00Z"))).toEqual({ from: "2026-10-19", to: "2026-10-25" });
  });
});

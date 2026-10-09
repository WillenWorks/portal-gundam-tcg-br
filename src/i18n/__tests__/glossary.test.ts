import { describe, expect, it } from "vitest";
import {
  ALL_KEYWORDS,
  getKeywordDefinition,
  getPhaseStepLabel,
} from "../index";
import type { KeywordCategory } from "../types";

describe("i18n: glossário e dicionário de keywords (Fase 5)", () => {
  it("contém todas as keywords canônicas oficiais do Comprehensive Rules", () => {
    expect(ALL_KEYWORDS.length).toBeGreaterThanOrEqual(20);

    const ids = ALL_KEYWORDS.map((k) => k.id);
    expect(ids).toContain("blocker");
    expect(ids).toContain("breach");
    expect(ids).toContain("repair");
    expect(ids).toContain("high-maneuver");
    expect(ids).toContain("first-strike");
    expect(ids).toContain("suppression");
    expect(ids).toContain("support");
    expect(ids).toContain("deploy");
    expect(ids).toContain("burst");
    expect(ids).toContain("when-paired");
    expect(ids).toContain("during-pair");
    expect(ids).toContain("during-link");
    expect(ids).toContain("activate-main");
    expect(ids).toContain("attack");
    expect(ids).toContain("destroyed");
    expect(ids).toContain("once-per-turn");
    expect(ids).toContain("link");
    expect(ids).toContain("ex-resource");
    expect(ids).toContain("development");
    expect(ids).toContain("rest");
    expect(ids).toContain("active");
  });

  it("todas as definições possuem campos obrigatórios consistentes em pt-BR e EN", () => {
    const validCategories: KeywordCategory[] = [
      "effect_keyword",
      "trigger_keyword",
      "mechanic",
      "phase_or_step",
    ];

    for (const kw of ALL_KEYWORDS) {
      expect(kw.id).toBeTruthy();
      expect(kw.name).toBeTruthy();
      expect(kw.raw).toBeTruthy();
      expect(validCategories).toContain(kw.category);
      expect(kw.descriptionPt).toBeTruthy();
      expect(kw.descriptionEn).toBeTruthy();
      // O nome oficial em inglês NUNCA é traduzido (<Blocker>, etc.)
      expect(kw.raw).toContain(kw.name.split(" ")[0]);
    }
  });

  it("inclui seções correspondentes das Comprehensive Rules (CR) nas keywords de efeito", () => {
    const blocker = ALL_KEYWORDS.find((k) => k.id === "blocker");
    expect(blocker?.rulesSection).toBe("CR 13-1-4");

    const breach = ALL_KEYWORDS.find((k) => k.id === "breach");
    expect(breach?.rulesSection).toBe("CR 13-1-2");

    const repair = ALL_KEYWORDS.find((k) => k.id === "repair");
    expect(repair?.rulesSection).toBe("CR 13-1-1");
  });

  it("interpola parâmetros numéricos corretamente em pt-BR e EN", () => {
    // Breach N
    const breach2Pt = getKeywordDefinition("<Breach 2>", "PT_BR");
    expect(breach2Pt).toBeDefined();
    expect(breach2Pt?.descriptionPt).toContain("2 de dano direto");

    const breach3En = getKeywordDefinition("Breach 3", "EN");
    expect(breach3En).toBeDefined();
    expect(breach3En?.descriptionEn).toContain("3 direct damage");

    // Repair N
    const repair1Pt = getKeywordDefinition("<Repair 1>", "PT_BR");
    expect(repair1Pt?.descriptionPt).toContain("1 pontos de HP");

    // Support N
    const support4Pt = getKeywordDefinition("<Support 4>", "PT_BR");
    expect(support4Pt?.descriptionPt).toContain("AP+4");

    // Development N
    const dev5Pt = getKeywordDefinition("Development 5", "PT_BR");
    expect(dev5Pt?.descriptionPt).toContain("exile 5 cartas");
  });

  it("resolve gatilhos com delimitadores variados (【...】, [...], <...>)", () => {
    const deployBracket = getKeywordDefinition("【Deploy】", "PT_BR");
    expect(deployBracket?.name).toBe("Deploy");
    expect(deployBracket?.category).toBe("trigger_keyword");

    const burstRaw = getKeywordDefinition("[Burst]", "PT_BR");
    expect(burstRaw?.name).toBe("Burst");

    const attackClean = getKeywordDefinition("attack", "PT_BR");
    expect(attackClean?.name).toBe("Attack");
  });

  it("retorna undefined para termo desconhecido", () => {
    const unknown = getKeywordDefinition("termo_inexistente_xyz", "PT_BR");
    expect(unknown).toBeUndefined();
  });

  it("traduz rótulos de fases e etapas de combate em ambos os idiomas", () => {
    expect(getPhaseStepLabel("start_phase", "PT_BR")).toBe("Fase de Início");
    expect(getPhaseStepLabel("start_phase", "EN")).toBe("Start Phase");

    expect(getPhaseStepLabel("draw_phase", "PT_BR")).toBe("Fase de Compra");
    expect(getPhaseStepLabel("draw_phase", "EN")).toBe("Draw Phase");

    expect(getPhaseStepLabel("resource_phase", "PT_BR")).toBe("Fase de Recurso");
    expect(getPhaseStepLabel("resource_phase", "EN")).toBe("Resource Phase");

    expect(getPhaseStepLabel("main_phase", "PT_BR")).toBe("Fase Principal");
    expect(getPhaseStepLabel("main_phase", "EN")).toBe("Main Phase");

    expect(getPhaseStepLabel("end_phase", "PT_BR")).toBe("Fase Final");
    expect(getPhaseStepLabel("end_phase", "EN")).toBe("End Phase");

    // Passos de combate
    expect(getPhaseStepLabel("attack", "PT_BR")).toBe("Etapa de Ataque");
    expect(getPhaseStepLabel("blocker_step", "PT_BR")).toBe("Etapa de Bloqueio");
    expect(getPhaseStepLabel("action_step", "PT_BR")).toBe("Etapa de Ação");
    expect(getPhaseStepLabel("damage_step", "PT_BR")).toBe("Etapa de Dano");
    expect(getPhaseStepLabel("end_battle_step", "PT_BR")).toBe("Etapa Final da Batalha");
  });
});

describe("glossário × Comprehensive Rules (auditoria 2026-10-08)", () => {
  it("cada keyword aponta para a seção certa da CR", () => {
    const expected: Record<string, string> = {
      Repair: "CR 13-1-1",
      Breach: "CR 13-1-2",
      Support: "CR 13-1-3",
      Blocker: "CR 13-1-4",
      "First Strike": "CR 13-1-5",
      "High-Maneuver": "CR 13-1-6",
      Suppression: "CR 13-1-7",
      "Development N": "CR 13-1-8",
      Deploy: "CR 13-2-6",
      Burst: "CR 13-2-5",
      "When Paired": "CR 13-2-9",
      "Once per Turn": "CR 13-2-13",
    };
    for (const [kw, section] of Object.entries(expected)) {
      expect(getKeywordDefinition(kw, "PT_BR")?.rulesSection, kw).toBe(section);
    }
  });
});

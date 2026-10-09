import { describe, expect, it } from "vitest";
import {
  ALL_KEYWORDS,
  cardText,
  extractCardSections,
  getKeywordDefinition,
  getPhaseStepLabel,
  getTranslationPendingBadge,
  isTranslationPending,
  normalizeTrigger,
  parseKeywordValue,
} from "../index";

describe("i18n: cardText", () => {
  const sampleCard = {
    code: "ST01-001",
    nameEn: "Gundam",
    effectEn: "<Repair 2> (At the end of your turn, this Unit recovers the specified number of HP.)\n【During Pair】During your turn, all your Units get AP+1.",
    effectPt: "<Repair 2> (No fim do seu turno, esta Unidade recupera a quantidade de HP indicada.)\n【During Pair】Durante o seu turno, todas as suas Unidades recebem AP+1.",
  };

  it("retorna o texto em pt-BR quando a preferência é PT_BR e a tradução existe", () => {
    const res = cardText(sampleCard, undefined, "PT_BR");
    expect(res.language).toBe("PT_BR");
    expect(res.isFallback).toBe(false);
    expect(res.isPending).toBe(false);
    expect(res.text).toContain("No fim do seu turno, esta Unidade recupera");
    expect(res.text).toContain("Durante o seu turno, todas as suas Unidades recebem AP+1.");
  });

  it("retorna o texto em inglês quando a preferência é EN", () => {
    const res = cardText(sampleCard, undefined, "EN");
    expect(res.language).toBe("EN");
    expect(res.isFallback).toBe(false);
    expect(res.isPending).toBe(false);
    expect(res.text).toContain("At the end of your turn, this Unit recovers");
    expect(res.text).toContain("During your turn, all your Units get AP+1.");
  });

  it("faz fallback para EN e marca isPending quando a carta não possui tradução em pt-BR", () => {
    const unstranslatedCard = {
      code: "EB01-099",
      effectEn: "【Deploy】Draw 2 cards, then discard 1 card from your hand.",
      effectPt: null,
    };

    const res = cardText(unstranslatedCard, undefined, "PT_BR");
    expect(res.text).toBe("【Deploy】Draw 2 cards, then discard 1 card from your hand.");
    expect(res.language).toBe("EN");
    expect(res.isFallback).toBe(true);
    expect(res.isPending).toBe(true);
    expect(isTranslationPending(unstranslatedCard)).toBe(true);
  });

  it("trata cartas vanilla sem efeito: retorna string vazia e não marca como pendente", () => {
    const vanillaCard = {
      code: "ST05-004",
      effectEn: null,
      effectPt: null,
    };

    const res = cardText(vanillaCard, undefined, "PT_BR");
    expect(res.text).toBe("");
    expect(res.isPending).toBe(false);
    expect(res.isFallback).toBe(false);
    expect(isTranslationPending(vanillaCard)).toBe(false);
  });

  it("filtra por gatilho específico quando solicitado (ex.: Deploy)", () => {
    const multiTriggerCard = {
      code: "ST05-001",
      effectEn: "【Deploy】Choose 1 of your other Units. Deal 1 damage to it. It gets AP+1 during this turn.\nWhile this is damaged, it gains <Suppression>.",
      effectPt: "【Deploy】Escolha 1 das suas outras Unidades. Cause 1 de dano a ela. Ela recebe AP+1 durante este turno.\nEnquanto esta Unidade estiver danificada, ela ganha <Suppression>.",
    };

    const deployPt = cardText(multiTriggerCard, "Deploy", "PT_BR");
    expect(deployPt.text).toBe("【Deploy】Escolha 1 das suas outras Unidades. Cause 1 de dano a ela. Ela recebe AP+1 durante este turno.");
    expect(deployPt.isPending).toBe(false);

    const deployEn = cardText(multiTriggerCard, "Deploy", "EN");
    expect(deployEn.text).toBe("【Deploy】Choose 1 of your other Units. Deal 1 damage to it. It gets AP+1 during this turn.");
  });

  it("resolve seções a partir de textSectionsJson estruturado", () => {
    const structuredCard = {
      code: "GD01-001",
      textSectionsJson: [
        {
          trigger: "【Deploy】",
          label: "Deploy",
          textPt: "【Deploy】Compre 1 carta.",
          textEn: "【Deploy】Draw 1 card.",
        },
        {
          trigger: "【Attack】",
          label: "Attack",
          textPt: "【Attack】Esta Unidade recebe AP+1.",
          textEn: "【Attack】This Unit gets AP+1.",
        },
      ],
    };

    const sections = extractCardSections(structuredCard, "PT_BR");
    expect(sections).toHaveLength(2);
    expect(sections[0].resolvedText).toBe("【Deploy】Compre 1 carta.");
    expect(sections[1].resolvedText).toBe("【Attack】Esta Unidade recebe AP+1.");

    const deploy = cardText(structuredCard, "Deploy", "PT_BR");
    expect(deploy.text).toBe("【Deploy】Compre 1 carta.");

    const attackEn = cardText(structuredCard, "Attack", "EN");
    expect(attackEn.text).toBe("【Attack】This Unit gets AP+1.");
  });

  it("lê de card.def.sourceText caso effectEn não esteja presente diretamente", () => {
    const engineCard = {
      def: {
        code: "ST01-001",
        sourceText: "【Deploy】Draw 1.",
      },
      effectPt: null,
    };

    const res = cardText(engineCard, undefined, "PT_BR");
    expect(res.text).toBe("【Deploy】Draw 1.");
    expect(res.isFallback).toBe(true);
    expect(res.isPending).toBe(true);
  });
});

describe("i18n: keywords e termos", () => {
  it("recupera keywords sem valor (Blocker, High-Maneuver, First Strike, Suppression)", () => {
    const blocker = getKeywordDefinition("<Blocker>");
    expect(blocker).toBeDefined();
    expect(blocker?.name).toBe("Blocker");
    expect(blocker?.category).toBe("effect_keyword");
    expect(blocker?.descriptionPt).toContain("mudar o alvo do ataque para ela");
    expect(blocker?.descriptionEn).toContain("change the attack target to this Unit");

    const highManeuver = getKeywordDefinition("High-Maneuver");
    expect(highManeuver?.descriptionPt).toContain("não pode ser bloqueada");

    const firstStrike = getKeywordDefinition("<First Strike>");
    expect(firstStrike?.descriptionPt).toContain("Quando esta Unidade ataca, ela causa dano de batalha ANTES do alvo");

    const suppression = getKeywordDefinition("<Suppression>");
    expect(suppression?.descriptionPt).toContain("atinge os 2 primeiros escudos simultaneamente");
  });

  it("recupera keywords parametrizadas com valor interpolado (Breach, Repair, Support, Development)", () => {
    const breach2 = getKeywordDefinition("<Breach 2>");
    expect(breach2).toBeDefined();
    expect(breach2?.value).toBe(2);
    expect(breach2?.raw).toBe("<Breach 2>");
    expect(breach2?.descriptionPt).toContain("causa 2 de dano direto");
    expect(breach2?.descriptionEn).toContain("deal 2 direct damage");

    const breach5 = getKeywordDefinition("Breach 5");
    expect(breach5?.value).toBe(5);
    expect(breach5?.descriptionPt).toContain("causa 5 de dano direto");

    const repair2 = getKeywordDefinition("<Repair 2>");
    expect(repair2?.value).toBe(2);
    expect(repair2?.descriptionPt).toContain("recupera 2 pontos de HP");

    const support3 = getKeywordDefinition("<Support 3>");
    expect(support3?.value).toBe(3);
    expect(support3?.descriptionPt).toContain("concede AP+3");

    const dev4 = getKeywordDefinition("Development 4");
    expect(dev4?.value).toBe(4);
    expect(dev4?.descriptionPt).toContain("exile 4 cartas com a característica especificada");
  });

  it("recupera gatilhos e mecânicas (Deploy, Burst, When Paired, Link, EX Resource)", () => {
    const deploy = getKeywordDefinition("【Deploy】");
    expect(deploy?.name).toBe("Deploy");
    expect(deploy?.descriptionPt).toContain("no instante em que a carta entra em jogo");

    const burst = getKeywordDefinition("【Burst】");
    expect(burst?.descriptionPt).toContain("revelada na área de escudo");

    const whenPaired = getKeywordDefinition("【When Paired】");
    expect(whenPaired?.descriptionPt).toContain("exato momento em que um Piloto é pareado");

    const link = getKeywordDefinition("Link");
    expect(link?.descriptionPt).toContain("Condição de afinidade de Piloto");

    const exResource = getKeywordDefinition("EX Resource");
    expect(exResource?.descriptionPt).toContain("ao pagar, ele é removido do jogo");
  });

  it("parseKeywordValue decompõe corretamente nomes e números", () => {
    expect(parseKeywordValue("<Breach 3>")).toEqual({
      id: "breach",
      name: "Breach",
      value: 3,
      cleanTag: "<Breach 3>",
    });

    expect(parseKeywordValue("【Deploy】")).toEqual({
      id: "deploy",
      name: "Deploy",
      value: undefined,
      cleanTag: "【Deploy】",
    });

    expect(parseKeywordValue("Development 2")).toEqual({
      id: "development",
      name: "Development",
      value: 2,
      cleanTag: "Development 2",
    });
  });

  it("ALL_KEYWORDS contém catálogo amplo de definições", () => {
    expect(ALL_KEYWORDS.length).toBeGreaterThanOrEqual(15);
    const names = ALL_KEYWORDS.map((k) => k.name);
    expect(names).toContain("Blocker");
    expect(names).toContain("Breach");
    expect(names).toContain("Repair");
    expect(names).toContain("Deploy");
    expect(names).toContain("Burst");
    expect(names).toContain("Link");
  });
});

describe("i18n: rótulos de fases e etapas", () => {
  it("traduz as fases do turno em pt-BR e EN", () => {
    expect(getPhaseStepLabel("start_phase", "PT_BR")).toBe("Fase de Início");
    expect(getPhaseStepLabel("start_phase", "EN")).toBe("Start Phase");

    expect(getPhaseStepLabel("draw_phase", "PT_BR")).toBe("Fase de Compra");
    expect(getPhaseStepLabel("draw_phase", "EN")).toBe("Draw Phase");

    expect(getPhaseStepLabel("resource_phase", "PT_BR")).toBe("Fase de Recurso");
    expect(getPhaseStepLabel("main_phase", "PT_BR")).toBe("Fase Principal");
    expect(getPhaseStepLabel("end_phase", "PT_BR")).toBe("Fase Final");
  });

  it("traduz etapas de combate e aceita aliases do simulador", () => {
    expect(getPhaseStepLabel("attack_step", "PT_BR")).toBe("Etapa de Ataque");
    expect(getPhaseStepLabel("attack", "PT_BR")).toBe("Etapa de Ataque");
    expect(getPhaseStepLabel("attack", "EN")).toBe("Attack Step");

    expect(getPhaseStepLabel("blocker_step", "PT_BR")).toBe("Etapa de Bloqueio");
    expect(getPhaseStepLabel("block", "PT_BR")).toBe("Etapa de Bloqueio");

    expect(getPhaseStepLabel("action_step", "PT_BR")).toBe("Etapa de Ação");
    expect(getPhaseStepLabel("action", "PT_BR")).toBe("Etapa de Ação");

    expect(getPhaseStepLabel("damage_step", "PT_BR")).toBe("Etapa de Dano");
    expect(getPhaseStepLabel("damage", "EN")).toBe("Damage Step");

    expect(getPhaseStepLabel("end_battle_step", "PT_BR")).toBe("Etapa Final da Batalha");
  });

  it("traduz etapas da fase final", () => {
    expect(getPhaseStepLabel("end_action_step", "PT_BR")).toBe("Etapa de Ação Final");
    expect(getPhaseStepLabel("end_resolution_step", "PT_BR")).toBe("Etapa Final");
    expect(getPhaseStepLabel("hand_limit_step", "PT_BR")).toBe("Etapa de Limite da Mão");
    expect(getPhaseStepLabel("cleanup_step", "PT_BR")).toBe("Etapa de Limpeza");
  });
});

describe("i18n: utilitários complementares", () => {
  it("normalizeTrigger normaliza delimitações variadas", () => {
    expect(normalizeTrigger("【Deploy】")).toBe("deploy");
    expect(normalizeTrigger("[Burst]")).toBe("burst");
    expect(normalizeTrigger("<Blocker>")).toBe("blocker");
    expect(normalizeTrigger("Attack")).toBe("attack");
  });

  it("getTranslationPendingBadge retorna rótulo adequado", () => {
    expect(getTranslationPendingBadge("PT_BR")).toBe("Tradução pendente");
    expect(getTranslationPendingBadge("EN")).toBe("Pending translation");
  });
});

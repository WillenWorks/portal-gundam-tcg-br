import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCardTranslationRegistry,
  extractCardCodeFromSpecId,
  getDecisionModalStrings,
  getTriggerModalLabel,
  registerCardTranslations,
  resolveDecisionText,
} from "../decisionText";

describe("i18n decisionText", () => {
  beforeEach(() => {
    clearCardTranslationRegistry();
  });
  describe("extractCardCodeFromSpecId", () => {
    it("extrai códigos canônicos a partir de specIds padrão", () => {
      expect(extractCardCodeFromSpecId("ST01-010-WhenPaired")).toBe("ST01-010");
      expect(extractCardCodeFromSpecId("GD01-044-WhenPaired")).toBe("GD01-044");
      expect(extractCardCodeFromSpecId("ST03-015-Deploy-Damage")).toBe("ST03-015");
      expect(extractCardCodeFromSpecId("EB01-022-Attack")).toBe("EB01-022");
      expect(extractCardCodeFromSpecId("T-025-Deploy")).toBe("T-025");
    });

    it("retorna null para specIds sintéticos sem código ou valores vazios", () => {
      expect(extractCardCodeFromSpecId("spec-1")).toBeNull();
      expect(extractCardCodeFromSpecId("p1-combatTrigger-destroy")).toBeNull();
      expect(extractCardCodeFromSpecId("")).toBeNull();
      expect(extractCardCodeFromSpecId(null)).toBeNull();
      expect(extractCardCodeFromSpecId(undefined)).toBeNull();
    });
  });

  describe("resolveDecisionText", () => {
    it("respeita preferência da conta em EN retornando o texto original do motor", () => {
      const result = resolveDecisionText(
        {
          label: "Choose 1 enemy Unit. Rest it.",
          specId: "ST01-010-WhenPaired",
          trigger: "When Paired",
        },
        "EN",
      );
      expect(result).toBe("Choose 1 enemy Unit. Rest it.");
    });

    it("traduz para pt-BR casando por specId e trigger nas cartas iniciais registradas", () => {
      const result = resolveDecisionText(
        {
          label: "Choose 1 enemy Unit. Rest it.",
          specId: "ST01-010-WhenPaired",
          trigger: "When Paired",
        },
        "PT_BR",
      );
      expect(result).toBe("Escolha 1 Unidade inimiga. Descanse-a.");
    });

    it("traduz cartas registradas dinamicamente via registerCardTranslations", () => {
      registerCardTranslations([
        {
          code: "GD02-005",
          effectPt: "【Deploy】Compre 2 cartas e descarte 1 da sua mão.",
          effectEn: "【Deploy】Draw 2 cards and discard 1 from your hand.",
        },
      ]);

      const result = resolveDecisionText(
        {
          label: "Draw 2 cards and discard 1 from your hand.",
          specId: "GD02-005-Deploy",
          trigger: "Deploy",
        },
        "PT_BR",
      );
      expect(result).toBe("Compre 2 cartas e descarte 1 da sua mão.");
    });

    it("prioriza objeto de carta passado diretamente no parâmetro", () => {
      const customCard = {
        code: "CUSTOM-001",
        effectPt: "【Attack】Cause 3 de dano à Base inimiga.",
        effectEn: "【Attack】Deal 3 damage to enemy Base.",
      };

      const result = resolveDecisionText(
        {
          label: "Deal 3 damage to enemy Base.",
          card: customCard,
          trigger: "Attack",
        },
        "PT_BR",
      );
      expect(result).toBe("Cause 3 de dano à Base inimiga.");
    });

    it("faz fallback para o label original em inglês se a tradução estiver ausente ou pendente", () => {
      const pendingCard = {
        code: "GD05-099",
        effectEn: "【Deploy】Deal 5 damage to all units.",
      };

      const result = resolveDecisionText(
        {
          label: "Deal 5 damage to all units.",
          card: pendingCard,
          trigger: "Deploy",
        },
        "PT_BR",
      );
      expect(result).toBe("Deal 5 damage to all units.");
    });

    it("suporta resolução de carta com múltiplas seções por gatilho", () => {
      const multiSectionCard = {
        code: "ST01-001",
        textSections: [
          {
            trigger: "<Repair 2>",
            textPt: "<Repair 2> No fim do seu turno, recupere 2 de HP.",
            textEn: "<Repair 2> At the end of your turn, recover 2 HP.",
          },
          {
            trigger: "【During Pair】",
            textPt: "【During Pair】Durante o seu turno, todas as suas Unidades recebem AP+1.",
            textEn: "【During Pair】During your turn, all your Units get AP+1.",
          },
        ],
      };

      const result = resolveDecisionText(
        {
          label: "During your turn, all your Units get AP+1.",
          card: multiSectionCard,
          trigger: "During Pair",
        },
        "PT_BR",
      );
      expect(result).toBe("Durante o seu turno, todas as suas Unidades recebem AP+1.");
    });
  });

  describe("getTriggerModalLabel & getDecisionModalStrings", () => {
    it("retorna rótulos de gatilho em pt-BR e EN", () => {
      expect(getTriggerModalLabel("When Paired", "PT_BR")).toBe("Vínculo resolvido — 【When Paired】");
      expect(getTriggerModalLabel("When Paired", "EN")).toBe("Pairing resolved — 【When Paired】");
      expect(getTriggerModalLabel("Deploy", "PT_BR")).toBe("Carta implantada — 【Deploy】");
      expect(getTriggerModalLabel("Deploy", "EN")).toBe("Card deployed — 【Deploy】");
    });

    it("retorna conjunto de strings do modal respeitando o idioma", () => {
      const pt = getDecisionModalStrings("PT_BR");
      expect(pt.confirm).toBe("Confirmar");
      expect(pt.activate).toBe("Ativar");
      expect(pt.skip).toBe("Pular");
      expect(pt.ally).toBe("aliado");
      expect(pt.enemy).toBe("inimigo");

      const en = getDecisionModalStrings("EN");
      expect(en.confirm).toBe("Confirm");
      expect(en.activate).toBe("Activate");
      expect(en.skip).toBe("Skip");
      expect(en.ally).toBe("ally");
      expect(en.enemy).toBe("enemy");
    });
  });
});

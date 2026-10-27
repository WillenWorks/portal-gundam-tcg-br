import { describe, expect, it } from "vitest";
import { triggerEffectText } from "./effectText";

describe("triggerEffectText — só o trecho do gatilho, para o banner", () => {
  it("formato com colchetes e <br> (texto em português do catálogo)", () => {
    const pt = "[Burst] Faça o Deploy desta carta.<br>[Deploy] Adicione 1 dos seus escudos à sua mão.";
    expect(triggerEffectText(pt, "Burst")).toBe("Faça o Deploy desta carta.");
    expect(triggerEffectText(pt, "Deploy")).toBe("Adicione 1 dos seus escudos à sua mão.");
  });

  it("formato oficial com 【】 e quebras de linha", () => {
    const en = "【Burst】Choose 1 enemy Unit. Deal 2 damage to it.\n【Main】Draw 1.";
    expect(triggerEffectText(en, "Burst")).toBe("Choose 1 enemy Unit. Deal 2 damage to it.");
  });

  it("palavras-chave no meio do texto ficam; sem o gatilho, nada", () => {
    expect(triggerEffectText("【Burst】【Once per Turn】Draw 1.", "Burst")).toBe("【Once per Turn】Draw 1.");
    expect(triggerEffectText("【Deploy】Draw 1.", "Burst")).toBeNull();
    expect(triggerEffectText(undefined, "Burst")).toBeNull();
  });
});

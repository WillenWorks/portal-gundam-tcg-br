// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { defaultResolutionPacing, getResolutionPacing, saveResolutionPacing } from "./animationSettings";

afterEach(() => window.localStorage.clear());

describe("ritmo da resolução — chave de reversão", () => {
  it("padrão é o cinemático; o build pode desligar com VITE_SIM_RESOLUTION_PACING=classic", () => {
    expect(defaultResolutionPacing({})).toBe("cinematic");
    expect(defaultResolutionPacing({ VITE_SIM_RESOLUTION_PACING: "classic" })).toBe("classic");
    expect(defaultResolutionPacing({ VITE_SIM_RESOLUTION_PACING: "qualquer" })).toBe("cinematic");
  });

  it("a escolha do jogador vale por cima do padrão e sobrevive ao recarregar", () => {
    saveResolutionPacing("classic");
    expect(getResolutionPacing()).toBe("classic");
    saveResolutionPacing("cinematic");
    expect(getResolutionPacing()).toBe("cinematic");
  });

  it("valor estranho salvo cai no padrão", () => {
    window.localStorage.setItem("portal_gundam_sim_resolution_pacing", "turbo");
    expect(getResolutionPacing()).toBe(defaultResolutionPacing());
  });
});

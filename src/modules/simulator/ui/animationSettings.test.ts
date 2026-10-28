// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { defaultResolutionPacing, effectiveAnimSpeed, getResolutionPacing, getScaledDuration, saveAnimSpeed, saveResolutionPacing } from "./animationSettings";

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

  it("P6: o Normal toca a cena inteira mais rápido (a mesma conta do servidor), somado à velocidade do menu", () => {
    saveResolutionPacing("cinematic");
    saveAnimSpeed(1);
    expect(getScaledDuration(700)).toBe(700);
    saveResolutionPacing("normal");
    expect(getScaledDuration(700)).toBe(490);
    saveAnimSpeed(2);
    expect(effectiveAnimSpeed()).toBeCloseTo(2 / 0.7);
    expect(document.documentElement.style.getPropertyValue("--sim-anim-speed-mult")).toBe(String(2 / 0.7));
    saveResolutionPacing("classic");
    expect(getScaledDuration(700)).toBe(350);
  });

  it("valor estranho salvo cai no padrão", () => {
    window.localStorage.setItem("portal_gundam_sim_resolution_pacing", "turbo");
    expect(getResolutionPacing()).toBe(defaultResolutionPacing());
  });
});

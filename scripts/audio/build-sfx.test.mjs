import { describe, expect, it } from "vitest";
import { fileNameFor, impactMsOf, shape } from "./build-sfx.mjs";

describe("build-sfx", () => {
  it("nomes de arquivo sem espaço nem ponto, numerados por variante", () => {
    expect(fileNameFor("attack.high", 0)).toBe("attack-high-1.m4a");
    expect(fileNameFor("highManeuver", 2)).toBe("high-maneuver-3.m4a");
  });

  it("o impacto é o primeiro trecho que chega perto do pico", () => {
    const rate = 1000;
    const samples = new Float32Array(1000);
    for (let i = 300; i < 320; i++) samples[i] = 0.9;
    for (let i = 600; i < 620; i++) samples[i] = 1;
    expect(impactMsOf(samples, rate)).toBe(300);
    expect(impactMsOf(new Float32Array(100), rate)).toBe(0);
  });

  it("corta no máximo e termina em silêncio", () => {
    const rate = 1000;
    const cut = shape(new Float32Array(3000).fill(1), 2000, rate);
    expect(cut.length).toBe(2000);
    expect(cut[cut.length - 1]).toBe(0);
    expect(cut[0]).toBe(1);
  });
});

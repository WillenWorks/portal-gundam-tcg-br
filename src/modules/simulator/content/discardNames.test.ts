import { describe, expect, it } from "vitest";
import type { EffectSpec } from "../engine/effectSpec";
import { ALL_EFFECT_SPECS } from "./index";

/**
 * BUG-065ZK9 — Overflowing Affection (GD01-118) mostrava a escolha do descarte e não descartava: o efeito procurava a
 * carta em `discardTarget`, mas o motor (actions.ts) entrega a escolha do jogador sempre em `discard`. GD01-074 e
 * GD03-072 tinham o mesmo erro (compravam sem descartar). Os testes de carta passavam porque chamavam o efeito já
 * com o nome errado, sem passar pela escolha do jogador.
 */
function discardNames(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) discardNames(v, out);
  else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o.op === "discardNamed" && typeof o.name === "string") out.push(o.name);
    for (const v of Object.values(o)) discardNames(v, out);
  }
  return out;
}

describe("descarte escolhido pelo jogador", () => {
  it("todo efeito de descarte da mão usa o nome que o motor preenche (`discard`)", () => {
    const wrong = ALL_EFFECT_SPECS.flatMap((spec: EffectSpec) => discardNames(spec).filter((n) => n !== "discard").map((n) => `${spec.id} → ${n}`));
    expect(wrong).toEqual([]);
  });
});

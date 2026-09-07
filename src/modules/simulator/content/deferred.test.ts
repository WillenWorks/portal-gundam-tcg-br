import { describe, expect, it } from "vitest";

import { ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { ST02_CARD_DEFS } from "../fixtures/st02Deck";
import { ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { ST04_CARD_DEFS } from "../fixtures/st04Deck";
import { ALL_EFFECT_SPECS } from "./index";
import { DEFERRED_CLAUSES } from "./deferred";

/**
 * Fase 4 §6.2: pra cada cláusula deferida, garantir que (1) a carta existe de
 * fato no motor (tem CardDef de fixture ou ao menos um EffectSpec) e (2) a
 * cláusula realmente NÃO está coberta por nenhum `sourceText` de EffectSpec
 * daquele code. Com `DEFERRED_CLAUSES` vazio (stub), tudo passa trivialmente —
 * a estrutura já está pronta pra quando a Lane 1B popular.
 */

const KNOWN_CARD_CODES = new Set<string>([
  ...ALL_EFFECT_SPECS.map((spec) => spec.cardCode),
  ...[ST01_CARD_DEFS, ST02_CARD_DEFS, ST03_CARD_DEFS, ST04_CARD_DEFS].flatMap((defs) =>
    Object.values(defs).map((def) => def.code),
  ),
]);

const SPEC_TEXTS_BY_CODE = new Map<string, string[]>();
for (const spec of ALL_EFFECT_SPECS) {
  const texts = SPEC_TEXTS_BY_CODE.get(spec.cardCode) ?? [];
  texts.push(spec.sourceText);
  SPEC_TEXTS_BY_CODE.set(spec.cardCode, texts);
}

describe("DEFERRED_CLAUSES", () => {
  it("é uma lista tipada (pode estar vazia — Lane 1B popula)", () => {
    expect(Array.isArray(DEFERRED_CLAUSES)).toBe(true);
  });

  it("cada entrada tem os 4 campos obrigatórios preenchidos", () => {
    for (const entry of DEFERRED_CLAUSES) {
      expect(entry.cardCode.length, "cardCode vazio").toBeGreaterThan(0);
      expect(entry.clause.length, `${entry.cardCode}: clause vazia`).toBeGreaterThan(0);
      expect(entry.reason.length, `${entry.cardCode}: reason vazia`).toBeGreaterThan(0);
      expect(entry.blockedBy.length, `${entry.cardCode}: blockedBy vazio`).toBeGreaterThan(0);
    }
  });

  it("cada cláusula deferida referencia uma carta conhecida do motor", () => {
    for (const entry of DEFERRED_CLAUSES) {
      expect(KNOWN_CARD_CODES.has(entry.cardCode), `${entry.cardCode} não existe em fixture/EffectSpec`).toBe(true);
    }
  });

  it("cada cláusula deferida realmente NÃO é coberta por um EffectSpec do code", () => {
    for (const entry of DEFERRED_CLAUSES) {
      const texts = SPEC_TEXTS_BY_CODE.get(entry.cardCode) ?? [];
      const covered = texts.some((text) => text.includes(entry.clause));
      expect(covered, `${entry.cardCode}: cláusula "${entry.clause}" já está coberta — não deveria estar deferida`).toBe(false);
    }
  });
});

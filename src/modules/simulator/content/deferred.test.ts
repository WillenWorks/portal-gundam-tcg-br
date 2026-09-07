import { describe, expect, it } from "vitest";

import { ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { ST02_CARD_DEFS } from "../fixtures/st02Deck";
import { ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { ST04_CARD_DEFS } from "../fixtures/st04Deck";
import { DEFERRED_CLAUSES } from "./deferred";

/**
 * docs/44 §6.2 / docs/48 — invariantes estruturais de `DEFERRED_CLAUSES`.
 *
 * A checagem "a cláusula é trecho LITERAL do texto EN oficial" vive em
 * `scripts/gundam-coverage.test.mjs` (roda como node puro, pode ler o
 * `data/gcg-official-cards.json`); aqui, que roda sob o tsconfig do `src`
 * (sem tipos de node), ficam só as invariantes que dependem do código.
 */

const KNOWN_CARD_CODES = new Set<string>(
  [ST01_CARD_DEFS, ST02_CARD_DEFS, ST03_CARD_DEFS, ST04_CARD_DEFS].flatMap((defs) =>
    Object.values(defs).map((def) => def.code),
  ),
);

describe("DEFERRED_CLAUSES", () => {
  it("é uma lista tipada e não-vazia (Lane 1B populou)", () => {
    expect(Array.isArray(DEFERRED_CLAUSES)).toBe(true);
    expect(DEFERRED_CLAUSES.length).toBeGreaterThan(0);
  });

  it("cada entrada tem os 4 campos preenchidos e blockedBy com prefixo engine:", () => {
    for (const entry of DEFERRED_CLAUSES) {
      expect(entry.cardCode.length, "cardCode vazio").toBeGreaterThan(0);
      expect(entry.clause.length, `${entry.cardCode}: clause vazia`).toBeGreaterThan(0);
      expect(entry.reason.length, `${entry.cardCode}: reason vazia`).toBeGreaterThan(0);
      expect(entry.blockedBy.startsWith("engine:"), `${entry.cardCode}: blockedBy sem prefixo 'engine:'`).toBe(true);
    }
  });

  it("sem par (cardCode, clause) duplicado", () => {
    const seen = new Set<string>();
    for (const entry of DEFERRED_CLAUSES) {
      const key = `${entry.cardCode}::${entry.clause}`;
      expect(seen.has(key), `entrada duplicada: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("cláusula de carta específica referencia uma carta conhecida de ST01–04 ('*' = gap transversal)", () => {
    for (const entry of DEFERRED_CLAUSES) {
      if (entry.cardCode === "*") continue;
      expect(KNOWN_CARD_CODES.has(entry.cardCode), `${entry.cardCode} não existe em fixture ST01–04`).toBe(true);
    }
  });
});

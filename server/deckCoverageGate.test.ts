import { describe, expect, it } from "vitest";
import { isCardPlayable, validateDeckPayload } from "./deckCoverageGate.ts";
import { GD01_TEST_DECKS } from "../src/modules/simulator/fixtures/gd01TestDecks.ts";
import { GD01_CARD_DEFS } from "../src/modules/simulator/content/gd01/index.ts";
import { GD02_CARD_DEFS } from "../src/modules/simulator/content/gd02/index.ts";
import { GD03_CARD_DEFS } from "../src/modules/simulator/content/gd03/index.ts";
import type { CardDef } from "../src/modules/simulator/engine/types.ts";
import type { DeckList } from "../src/modules/simulator/engine/setup.ts";

/**
 * server/deckCoverageGate.test.ts (docs/debates 2026-09-13, Etapa 1) —
 * cobertura unitária do gate de segurança que faltava: `validateDeckPayload`
 * já protege queue/join, training/new e o endpoint de debug, mas nunca tinha
 * teste dedicado. Achado desta bateria: sem checar o código contra o
 * catálogo oficial, um `cardCode` forjado (`GD01-999`) caía no fallback
 * "sem texto de efeito -> vanilla -> jogável" — corrigido em
 * `deckCoverageGate.ts` (`KNOWN_CODES`) junto com este teste.
 */

const GENERIC_RESOURCE: CardDef = { code: "GD01-RESOURCE", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };

function deckOf(main: CardDef[]): DeckList {
  return { main, resources: [GENERIC_RESOURCE] };
}

describe("deckCoverageGate — decks válidos (90 cartas GD01)", () => {
  it("aprova os 4 decks de fixtures/gd01TestDecks.ts (só usam o pool jogável)", () => {
    for (const [key, deck] of Object.entries(GD01_TEST_DECKS)) {
      const validation = validateDeckPayload(deck.build());
      expect(validation.valid, `${key}: ${JSON.stringify(validation.unplayableCards)}`).toBe(true);
      expect(validation.unplayableCards).toEqual([]);
    }
  });

  it("isCardPlayable aprova individualmente uma carta vanilla e uma implementada", () => {
    expect(isCardPlayable(GD01_CARD_DEFS["GD01-035"])).toBe(true); // Zaku Ⅱ, vanilla
    expect(isCardPlayable(GD01_CARD_DEFS["GD01-008"])).toBe(true); // Guntank, implementada (EffectSpec real)
  });

  it("aprova a carta de recurso genérica (placeholder do motor, não catalogada de propósito)", () => {
    expect(isCardPlayable(GENERIC_RESOURCE)).toBe(true);
  });
});

describe("deckCoverageGate — decks com carta sem cobertura no motor (0% implementada)", () => {
  // 5ª vez nesta sessão que este fixture quebra por depender de quantos gaps de GD01
  // ainda restam: com o Lote 5 inteiro fechado (GD01-002/005/023/065/090), `DEFERRED_CLAUSES`
  // não tem mais NENHUM código de GD01 com `isCardPlayable` falso (GD01-001/066 são
  // "implementada*" — têm EffectSpec real, só uma 2ª cláusula residual segue deferida, e por
  // isso já SÃO jogáveis). Pra nunca mais depender do progresso de um lote específico,
  // usa exclusivamente cartas SINTÉTICAS de outra wave (0% implementada por definição — ver
  // describe "códigos inexistentes/fora do catálogo" logo abaixo, mesmo padrão).
  const unplayable1: CardDef = { code: "GD02-001", nameEn: "Psycho Gundam", cardType: "UNIT", color: "red" };
  const unplayable2: CardDef = { code: "GD02-002", nameEn: "Psyco Gundam Mk-II", cardType: "UNIT", color: "red" };

  it("rejeita um deck com 1 carta sem cobertura misturada com cartas válidas", () => {
    const deck = deckOf([GD01_CARD_DEFS["GD01-008"], GD01_CARD_DEFS["GD01-035"], unplayable1]);
    const validation = validateDeckPayload(deck);
    expect(validation.valid).toBe(false);
    expect(validation.unplayableCards).toEqual(["GD02-001"]);
  });

  it("relata TODAS as cartas sem cobertura do deck, não só a primeira", () => {
    const deck = deckOf([GD01_CARD_DEFS["GD01-008"], unplayable1, unplayable2]);
    const validation = validateDeckPayload(deck);
    expect(validation.valid).toBe(false);
    expect(validation.unplayableCards).toEqual(["GD02-001", "GD02-002"]);
  });

  it("isCardPlayable rejeita diretamente uma carta sem cobertura", () => {
    expect(isCardPlayable(unplayable1)).toBe(false);
  });
});

describe("deckCoverageGate — códigos de carta inexistentes/fora do catálogo", () => {
  it("rejeita estritamente um cardCode que não existe em nenhum catálogo (GD01-999)", () => {
    const forged: CardDef = { code: "GD01-999", nameEn: "Carta Forjada", cardType: "UNIT", color: "blue" };
    expect(isCardPlayable(forged)).toBe(false);
    const validation = validateDeckPayload(deckOf([GD01_CARD_DEFS["GD01-008"], forged]));
    expect(validation.valid).toBe(false);
    expect(validation.unplayableCards).toEqual(["GD01-999"]);
  });

  it("rejeita um cardCode de outra wave sem cobertura no motor (GD02-001, real no catálogo mas 0% implementado)", () => {
    const gd02Card: CardDef = { code: "GD02-001", nameEn: "Psycho Gundam", cardType: "UNIT", color: "red" };
    expect(isCardPlayable(gd02Card)).toBe(false);
    const validation = validateDeckPayload(deckOf([GD01_CARD_DEFS["GD01-008"], gd02Card]));
    expect(validation.valid).toBe(false);
    expect(validation.unplayableCards).toEqual(["GD02-001"]);
  });
});

describe("deckCoverageGate — mesmo critério do script de cobertura (content/coverage/clauseAudit.ts)", () => {
  it("carta coberta só por campo estruturado fora da lista antiga (GD01-046, onSupportUsed) é jogável", () => {
    // a lista antiga do gate só olhava staticAbilities/combatTriggers/attackTargetRules e barrava esta carta
    expect(isCardPlayable(GD01_CARD_DEFS["GD01-046"])).toBe(true);
  });

  it("W0.4 — cláusula sem efeito bloqueia mesmo com outro campo coberto (GD03-104: tem pilotMode, falta 【Main】/【Action】)", () => {
    expect(isCardPlayable(GD03_CARD_DEFS["GD03-104"])).toBe(false);
  });

  it("W0.4 — GD02 com a auditoria zerada é jogável (GD02-001 real, coberto por allyCombatTriggers)", () => {
    expect(isCardPlayable(GD02_CARD_DEFS["GD02-001"])).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import type { DeckList } from "../engine/setup";
import { GD01_TEST_DECKS } from "../fixtures/gd01TestDecks";
import { META_DECKS_GD02_ERA } from "../fixtures/metaDecksGd02Era";
import { GD03_TEST_DECKS } from "../fixtures/gd03Decks";
import { GD04_TEST_DECKS } from "../fixtures/gd04Decks";
import { ST09_DECKS } from "../fixtures/st09Decks";
import { GD05_DECKS } from "../fixtures/gd05Decks";
import { ST10_TEST_DECKS } from "../fixtures/st10Decks";
import { EB01_TEST_DECKS } from "../fixtures/eb01Decks";
import { SIMULATOR_DECK_PRESETS } from "./simulatorDeckPresets";
import { VALIDATED_DECKS, checkDeckListLegality } from "./validatedDecks";

// Mesmo conjunto que `SIMULATOR_DECKS` em `server/index.ts` resolve — preset que não estiver
// aqui aparece no seletor do cliente e falha no servidor.
const REGISTRIES: Record<string, { build: () => DeckList }>[] = [
  VALIDATED_DECKS,
  GD01_TEST_DECKS,
  META_DECKS_GD02_ERA,
  GD03_TEST_DECKS,
  GD04_TEST_DECKS,
  ST09_DECKS,
  GD05_DECKS,
  ST10_TEST_DECKS,
  EB01_TEST_DECKS,
];

function resolvePreset(key: string): (() => DeckList) | undefined {
  for (const registry of REGISTRIES) {
    if (Object.hasOwn(registry, key)) return registry[key].build;
  }
  return undefined;
}

describe("SIMULATOR_DECK_PRESETS", () => {
  it("não repete chave", () => {
    const keys = SIMULATOR_DECK_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("inclui os decks do fechamento do GD03, do GD04, do ST09, do GD05, do ST10 e do EB01", () => {
    const keys = new Set(SIMULATOR_DECK_PRESETS.map((p) => p.key));
    for (const key of [...Object.keys(GD03_TEST_DECKS), ...Object.keys(GD04_TEST_DECKS), ...Object.keys(ST09_DECKS), ...Object.keys(GD05_DECKS), ...Object.keys(ST10_TEST_DECKS), ...Object.keys(EB01_TEST_DECKS)]) {
      expect(keys.has(key), key).toBe(true);
    }
  });

  for (const preset of SIMULATOR_DECK_PRESETS) {
    it(`${preset.key}: resolve num registro de decks e passa a legalidade estrutural`, () => {
      const build = resolvePreset(preset.key);
      expect(build, `${preset.key} não está em nenhum registro de decks`).toBeDefined();
      if (!build) return;
      const list = build();
      expect(list.main).toHaveLength(50);
      expect(list.resources).toHaveLength(10);
      expect(checkDeckListLegality(list).issues).toEqual([]);
    });
  }
});

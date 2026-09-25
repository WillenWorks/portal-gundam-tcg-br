/**
 * Lista curada de decks prontos pra qualquer modalidade do simulador (Fila
 * Online, Convite Direto, Treino Solo) — docs/debates 2026-09-14/15, pedido
 * do Willen: os 4 starters oficiais (ST01..ST04) + os 4 decks de teste GD01
 * + qualquer deck montado pelo próprio jogador (ver `useMySimulatorDecks`).
 * Revisão 2026-09-15: a lista anterior escondia ST02/03/04 dos seletores —
 * corrigido, já que o servidor sempre resolveu os 4 (nunca foi restrição
 * real, só de UI).
 *
 * Único ponto de verdade pro CLIENTE; o servidor (`SIMULATOR_DECKS` em
 * `server/index.ts`) resolve o mesmo conjunto.
 */
export interface SimulatorDeckPreset {
  key: string;
  label: string;
}

export const SIMULATOR_DECK_PRESETS: SimulatorDeckPreset[] = [
  { key: "ST01", label: 'ST01 "Heroic Beginnings"' },
  { key: "ST02", label: 'ST02 "Wings of Advance"' },
  { key: "ST03", label: 'ST03 "Zeon\'s Rush"' },
  { key: "ST04", label: 'ST04 "SEED Strike"' },
  { key: "ST05", label: 'ST05 "Iron-Blooded Struggle"' },
  { key: "GD01-FED", label: "Federation Vanguard (GD01)" },
  { key: "GD01-ZEON", label: "Zeon Legion (GD01)" },
  { key: "GD01-NEWTYPE", label: "Newtype Corps (GD01)" },
  { key: "GD01-SLEEVES", label: "Sleeves Uprising (GD01)" },
  // Decks meta da época GD02 + ST06 (receitas oficiais, out/2025) — `fixtures/metaDecksGd02Era.ts`
  { key: "META-GD02-AEUG-EA", label: "Meta GD02 · AEUG / Earth Alliance" },
  { key: "META-GD02-TEKKADAN-VAGAN", label: "Meta GD02 · Tekkadan × Vagan" },
  { key: "META-GD02-QUBELEY", label: "Meta GD02 · Qubeley Control" },
  { key: "META-GD02-AGE-WING", label: "Meta GD02 · AGE × Wing" },
  { key: "META-GD02-TITANS", label: "Meta GD02 · Titans × Cyber-Newtype" },
  { key: "META-ST06-GQUUUUUUX", label: "Meta ST06 × GD02 · GQuuuuuuX" },
];

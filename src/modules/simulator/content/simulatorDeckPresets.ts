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
];

/**
 * Lista curada de decks prontos pra qualquer modalidade do simulador (Fila
 * Online, Convite Direto, Treino Solo) — docs/debates 2026-09-14, pedido do
 * Willen: "deixe o deck ST01 (01), os 4 decks de GD01 e permita que o
 * usuário use o seu próprio deck". Fora daqui, ST02/ST03/ST04 continuam
 * jogáveis via API (bot self-play, testes, debug hoster-only) mas não
 * aparecem mais nos seletores — só ST01 representa os starters clássicos.
 *
 * Único ponto de verdade pro CLIENTE; o servidor (`SIMULATOR_DECKS` em
 * `server/index.ts`) continua resolvendo ST01..ST04 + os 4 de GD01, então um
 * link antigo com `?challenge=` apontando pra ST02..04 ainda funciona.
 */
export interface SimulatorDeckPreset {
  key: string;
  label: string;
}

export const SIMULATOR_DECK_PRESETS: SimulatorDeckPreset[] = [
  { key: "ST01", label: 'ST01 "Heroic Beginnings"' },
  { key: "GD01-FED", label: "Federation Vanguard (GD01)" },
  { key: "GD01-ZEON", label: "Zeon Legion (GD01)" },
  { key: "GD01-NEWTYPE", label: "Newtype Corps (GD01)" },
  { key: "GD01-SLEEVES", label: "Sleeves Uprising (GD01)" },
];

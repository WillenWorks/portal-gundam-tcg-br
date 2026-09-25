import type { DeckList } from "../engine/setup";
import { buildDeckListFromUserDeck } from "../content/userDeckBuilder";

/**
 * Decks meta da época GD02 "Dual Impact" + ST06 (formato de 24/10/2025 até a
 * chegada do GD03 em jan/2026) — base de benchmark do bot (spec
 * bot-avaliacao-forca). Fonte: as 6 receitas oficiais publicadas no lançamento
 * do GD02 (gundam-gcg.com/en/decks/deck-011..016), listas completas e datadas.
 *
 * Tier/arquétipo de referência: tier list de 03/11/2025 (gundamcard.gg, ~20
 * torneios de loja no Japão). Listas vencedoras exatas de torneio (Egman,
 * ExBurst) não entraram: os sites só renderizam com JavaScript. Pra adicionar
 * uma, cole a lista em texto (`4x GD02-001`) numa entrada nova — o
 * `parseDecklistText` e o teste validam 50 cartas, cópias e catálogo.
 *
 * Resource deck: as receitas não trazem; completa com 10 recursos da cor
 * principal (mesma regra de `buildDeckListFromUserDeck`).
 *
 * `knownGaps`: cartas do deck com efeito AINDA não implementado no motor (jogam
 * como corpo sem efeito). Hoje nenhuma: GD02-001 e GD02-002 aparecem como
 * "faltando" no `gundam_coverage` (que só enxerga EffectSpec), mas são modeladas
 * via `allyCombatTriggers` no CardDef e têm teste em `engine/combat.test.ts`.
 */

export interface MetaDeck {
  id: string;
  label: string;
  /** arquétipo na nomenclatura da comunidade (tier list de referência) */
  archetype: string;
  source: string;
  /** data de publicação da lista */
  date: string;
  /** decklist em texto, uma carta por linha: `Nx CÓDIGO [nome]` */
  list: string;
  /** cartas com efeito ainda não implementado no simulador (ver cabeçalho) */
  knownGaps: string[];
  build: () => DeckList;
}

export interface DecklistEntry {
  code: string;
  quantity: number;
}

const LINE = /^(\d+)\s*x?\s+([A-Za-z]{2,4}\d{0,2}-\d{3}[A-Za-z]?)\b/;

/** Converte decklist em texto (`4x GD02-001 Nome` ou `4 GD02-001`) em entradas somadas por código. */
export function parseDecklistText(text: string): DecklistEntry[] {
  const totals = new Map<string, number>();
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) return;
    const match = LINE.exec(line);
    if (!match) throw new Error(`Decklist inválida na linha ${index + 1}: "${line}"`);
    const code = match[2].toUpperCase();
    totals.set(code, (totals.get(code) ?? 0) + Number(match[1]));
  });
  return Array.from(totals, ([code, quantity]) => ({ code, quantity }));
}

function metaDeck(input: Omit<MetaDeck, "build">): MetaDeck {
  return {
    ...input,
    build: () =>
      buildDeckListFromUserDeck({
        id: input.id,
        name: input.label,
        items: parseDecklistText(input.list).map((e) => ({ quantity: e.quantity, card: { code: e.code } })),
      }),
  };
}

const OFFICIAL = "https://www.gundam-gcg.com/en/decks";
const RELEASE_DATE = "2025-10-24";

export const META_DECKS_GD02_ERA: Record<string, MetaDeck> = {
  "META-GD02-AEUG-EA": metaDeck({
    id: "META-GD02-AEUG-EA",
    knownGaps: [],
    label: "AEUG / Earth Alliance (GD02, oficial)",
    archetype: "Red-White SEED / AEUG control",
    source: `${OFFICIAL}/deck-011.php`,
    date: RELEASE_DATE,
    list: `
      2x GD02-129
      4x GD02-097
      4x GD02-069
      4x ST04-015
      3x ST04-012
      4x ST04-010
      4x ST04-001
      3x ST01-014
      4x GD01-118
      3x GD01-065
      2x ST05-014
      3x GD02-059
      4x GD01-086
      4x GD02-079
      2x GD02-075`,
  }),
  "META-GD02-TEKKADAN-VAGAN": metaDeck({
    id: "META-GD02-TEKKADAN-VAGAN",
    knownGaps: [],
    label: "Tekkadan × Vagan (GD02, oficial)",
    archetype: "Blue-Purple Barbatos",
    source: `${OFFICIAL}/deck-012.php`,
    date: RELEASE_DATE,
    list: `
      4x GD02-054 Gundam Barbatos 1st Form
      4x GD02-055 Gundam Gusion Rebake
      4x GD02-057 Zedas
      4x GD02-058 Ryusei-Go (Graze Custom II)
      4x GD02-066 Gafran
      4x GD02-067 Baqto
      4x GD02-096 Desil Galette
      2x GD02-110 Awakened Power
      2x GD02-112 Momentary Respite
      4x ST05-001 Gundam Barbatos 4th Form
      4x ST05-002
      4x ST05-010 Mikazuki Augus
      2x ST05-014 Fatal Strike
      4x ST05-015`,
  }),
  "META-GD02-QUBELEY": metaDeck({
    id: "META-GD02-QUBELEY",
    knownGaps: [],
    label: "Qubeley Control (GD02, oficial)",
    archetype: "Green-Red Zeon Ping",
    source: `${OFFICIAL}/deck-013.php`,
    date: RELEASE_DATE,
    list: `
      4x GD01-044 Kshatriya
      4x GD01-051
      4x GD01-093 Marida Cruz
      3x ST03-001 Sinanju
      3x ST03-010
      4x ST03-015
      4x GD02-036 Qubeley
      4x GD02-039
      4x GD02-091
      4x GD02-107 All-Range Attack
      4x GD01-035
      4x ST03-006 Char's Zaku II
      4x ST03-008 Zaku II`,
  }),
  "META-GD02-AGE-WING": metaDeck({
    id: "META-GD02-AGE-WING",
    knownGaps: [],
    label: "AGE × Wing (GD02, oficial)",
    archetype: "Green-White Wing / Blue-White Epyon",
    source: `${OFFICIAL}/deck-014.php`,
    date: RELEASE_DATE,
    list: `
      4x ST02-002 Wing Gundam (Bird Mode)
      4x ST02-011 Zechs Merquise
      3x GD02-002 Gundam Epyon
      3x GD02-005
      2x ST02-006
      4x GD02-021 Gundam AGE-1 Normal
      3x GD02-023
      4x GD02-027
      4x GD02-031
      4x GD02-035
      4x GD02-088 Flit Asuno
      3x GD02-103 AGE Device
      4x GD02-124
      2x GD01-024 Wing Gundam Zero
      2x GD01-100`,
  }),
  "META-GD02-TITANS": metaDeck({
    id: "META-GD02-TITANS",
    knownGaps: [],
    label: "Titans × Cyber-Newtype (GD02, oficial)",
    archetype: "Blue-Red Kshatriya / Titans",
    source: `${OFFICIAL}/deck-015.php`,
    date: RELEASE_DATE,
    list: `
      4x GD02-001 Psycho Gundam
      3x GD01-044 Kshatriya
      3x GD02-007 Psycho Gundam (MA Mode)
      4x GD01-051
      2x GD02-008
      4x GD02-015
      4x GD02-016
      4x GD02-013
      4x GD01-008
      4x GD02-086 Jerid Messa
      4x GD02-085 Four Murasame
      4x GD01-093 Marida Cruz
      2x ST02-014 Siege Ploy
      4x GD01-124`,
  }),
  "META-ST06-GQUUUUUUX": metaDeck({
    id: "META-ST06-GQUUUUUUX",
    knownGaps: [],
    label: "ST06 × GD02 GQuuuuuuX (oficial)",
    archetype: "Green-Red Clan",
    source: `${OFFICIAL}/deck-016.php`,
    date: RELEASE_DATE,
    list: `
      4x ST06-001 GQuuuuuuX (Omega Psycommu)
      3x ST06-002
      4x ST06-005 Red Gundam
      2x ST06-006
      4x ST06-007 Ortega's Rick Dom (GQ)
      4x ST06-008 Sugai's Gelgoog (GQ)
      4x ST06-009
      4x ST06-010 Shuji Itō
      4x ST06-014
      4x GD02-038 GQuuuuuuX (Omega Psycommu)
      2x GD02-041
      3x GD02-109
      4x GD01-035
      4x ST03-008 Zaku Ⅱ`,
  }),
};

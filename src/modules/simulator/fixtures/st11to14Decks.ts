import type { DeckList } from "../engine/setup";
import { buildDeckListFromUserDeck } from "../content/userDeckBuilder";
import { parseDecklistText } from "./metaDecksGd02Era";

/**
 * Decks do ST11–ST14 (W12 — lançamento junto do GD05.5): as 4 receitas oficiais (deck-045 a deck-048), que completam
 * as cartas do starter com reimpressões de ST01/GD01–GD05. Entram no fuzz, no golden e nos presets.
 *
 * Resource deck: as receitas não trazem; completa com 10 recursos da cor principal (regra de
 * `buildDeckListFromUserDeck`).
 */
export interface St11to14Deck {
  id: string;
  label: string;
  source: string;
  list: string;
  build: () => DeckList;
}

const OFFICIAL = "https://www.gundam-gcg.com/en/decks";

function officialDeck(id: string, label: string, source: string, list: string): St11to14Deck {
  return {
    id,
    label,
    source,
    list,
    build: () =>
      buildDeckListFromUserDeck({
        id,
        name: label,
        items: parseDecklistText(list).map((e) => ({ quantity: e.quantity, card: { code: e.code } })),
      }),
  };
}

export const ST11_TO_14_DECKS: Record<string, St11to14Deck> = {
  "ST11-MARINE": officialDeck(
    "ST11-MARINE",
    "Marine Azul/Roxo (ST11)",
    `${OFFICIAL}/deck-045.php`,
    `4x ST11-001 Char's Z'Gok
4x ST11-002 Acguy
3x ST11-003 Zock
4x ST11-006 Shamblo
3x ST11-007 Gundam Leopard
4x ST11-008 Daughseat
4x ST11-009 Kapool
4x ST11-010 Abyss Gundam
4x ST11-011 Char Aznable
4x ST11-012 Loni Garvey
4x ST11-015 A Twinkle from the Abyss
4x ST01-015 White Base
4x GD05-050 Gundam Exia Repair`,
  ),
  "ST12-CLOSE-COMBAT": officialDeck(
    "ST12-CLOSE-COMBAT",
    "Close Combat Vermelho/Roxo (ST12)",
    `${OFFICIAL}/deck-046.php`,
    `4x ST12-001 Gundam Epyon
2x ST12-003 Tallgeese Ⅲ
4x ST12-005 GQuuuuuuX (Omega Psycommu)
4x ST12-006 Unicorn Gundam 02 Banshee (Destroy Mode)
3x ST12-009 Unicorn Gundam 02 Banshee (Unicorn Mode)
4x ST12-010 Slash Zaku Phantom
4x ST12-011 Milliardo Peacecraft
2x ST12-012 Ple-Twelve
4x ST12-016 Libra
4x GD01-044 Kshatriya
4x GD01-050 LaGOWE
4x GD01-051 Kshatriya
3x GD01-093 Marida Cruz
4x GD05-111 Airframe Seizure`,
  ),
  "ST13-BIT-FUNNEL": officialDeck(
    "ST13-BIT-FUNNEL",
    "Bit / Funnel Verde/Vermelho (ST13)",
    `${OFFICIAL}/deck-047.php`,
    `4x ST13-001 Qubeley
4x ST13-002 Elmeth
4x ST13-006 Gundam Aerial
4x ST13-008 Gundam Throne Zwei
3x ST13-009 Gundam Pharact
4x ST13-010 Red Gundam (0079)
4x ST13-011 Haman Karn
4x ST13-012 Suletta Mercury
3x GD01-112 Extreme Hatred
2x GD02-036 Qubeley
2x GD03-107 Over the River and Through the Woods
4x GD05-025 Demi Barding
4x GD05-111 Airframe Seizure
4x GD05-126 Quiet Zero`,
  ),
  "ST14-HEAVY-ARMED": officialDeck(
    "ST14-HEAVY-ARMED",
    "Heavy Armed Branco/Verde (ST14)",
    `${OFFICIAL}/deck-048.php`,
    `3x ST14-001 The-O
3x ST14-002 Gundam NT-1 Full Armor
2x ST14-003 Palace Athene
3x ST14-004 Geara Doga (Heavy Armed Type)
4x ST14-005 G-Falcon DX
4x ST14-006 Full Armor Unicorn Gundam (Destroy Mode)
4x ST14-007 Full Armor Unicorn Gundam (Unicorn Mode)
3x ST14-009 Duel Gundam (Assault Shroud)
4x ST14-011 Paptimus Scirocco
4x ST14-012 Banagher Links
2x ST14-013 Natural Talent
2x ST14-014 Blazing Mobile Suit Rider
4x ST14-016 Gryphios 2
4x GD01-107 First Contact
4x GD01-118 Overflowing Affection`,
  ),
};

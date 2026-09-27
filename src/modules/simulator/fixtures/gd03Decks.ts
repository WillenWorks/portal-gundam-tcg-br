import type { DeckList } from "../engine/setup";
import { buildDeckListFromUserDeck } from "../content/userDeckBuilder";
import { parseDecklistText } from "./metaDecksGd02Era";

/**
 * Decks de teste do GD03 (W2c — fechamento do set): entram no fuzz e no golden. Não são receitas
 * oficiais nem meta — só 2 decks de 2 cores montados com cartas do GD03 que o motor cobre
 * inteiras (sem cláusula deferida), puxando as mecânicas novas: tokens/contagem (Cyclops Team),
 * exilar do trash e moer o deck (Titans/Vagan). Resource deck: 10 recursos da cor principal.
 */
export interface Gd03TestDeck {
  id: string;
  label: string;
  list: string;
  build: () => DeckList;
}

function testDeck(id: string, label: string, list: string): Gd03TestDeck {
  return {
    id,
    label,
    list,
    build: () =>
      buildDeckListFromUserDeck({
        id,
        name: label,
        items: parseDecklistText(list).map((e) => ({ quantity: e.quantity, card: { code: e.code } })),
      }),
  };
}

export const GD03_TEST_DECKS: Record<string, Gd03TestDeck> = {
  "GD03-CYCLOPS": testDeck(
    "GD03-CYCLOPS",
    "Cyclops Team / Zeon (GD03, teste)",
    `4x GD03-020 Zaku II FZ
4x GD03-024 Hy-Gogg
4x GD03-027 Z'Gok E
4x GD03-017 Kämpfer
4x GD03-090 Mikhail Kaminsky
4x GD03-089 Bernard Wiseman
4x GD03-107 Over the River and Through the Woods
4x GD03-108 How Many Miles to the Battlefield?
4x GD03-126 Cyclops Team
4x GD03-048 GFreD
4x GD03-035 GFreD
3x GD03-092 Nyaan
3x GD03-109 Improved Technique`,
  ),
  "GD03-TITANS-VAGAN": testDeck(
    "GD03-TITANS-VAGAN",
    "Titans / Vagan (GD03, teste)",
    `4x GD03-013 Hizack
4x GD03-014 Hizack Custom
4x GD03-008 Bolinoak Sammahn
4x GD03-009 Palace Athene
3x GD03-015 Baund Doc
3x GD03-084 Paptimus Scirocco
3x GD03-087 Sarah Zabiarov
2x GD03-123 Jupitris
4x GD03-058 Farsia
4x GD03-059 Zedas R
4x GD03-065 Zedas M
3x GD03-054 Zeydra
4x GD03-094 Zeheart Galette
4x GD03-114 Look of Determination`,
  ),
};

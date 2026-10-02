import type { DeckList } from "../engine/setup";
import { buildDeckListFromUserDeck } from "../content/userDeckBuilder";
import { parseDecklistText } from "./metaDecksGd02Era";

/**
 * Decks de teste do GD04 (W5 — fechamento do set): entram no fuzz e no golden. Não são receitas
 * oficiais nem meta — 2 decks de 2 cores com cartas do GD04 cobertas inteiras (sem cláusula deferida
 * ou aproximada), puxando as mecânicas novas: EX Resource / origem do pagamento e custo de descansar
 * Unit (Academy + CB/Trinity); camada de dano, exilar do trash e gatilhos atrasados (Vulture + Militia).
 */
export interface Gd04TestDeck {
  id: string;
  label: string;
  list: string;
  build: () => DeckList;
}

function testDeck(id: string, label: string, list: string): Gd04TestDeck {
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

export const GD04_TEST_DECKS: Record<string, Gd04TestDeck> = {
  "GD04-ACADEMY-CB": testDeck(
    "GD04-ACADEMY-CB",
    "Academy / CB Trinity (GD04, teste)",
    `4x GD04-020 Gundam Lfrith Ur
4x GD04-025 Gundvölva
4x GD04-030 Chuchu's Demi Trainer
4x GD04-031 Heindree
3x GD04-021 Gundam Lfrith Thorn
2x GD04-018 Gundam Pharact
4x GD04-108 Witches from Earth
3x GD04-106 Indiscriminate Violence
3x GD04-085 Suletta Mercury
2x GD04-124 9th Tactical Testing Sector
4x GD04-038 Gundam Exia
4x GD04-034 Gundam Kyrios
3x GD04-045 Gundam Throne Zwei
2x GD04-036 Gundam Throne Eins
2x GD04-089 Nena Trinity
2x GD04-111 Trinity`,
  ),
  "GD04-VULTURE-MILITIA": testDeck(
    "GD04-VULTURE-MILITIA",
    "Vulture / Militia (GD04, teste)",
    `4x GD04-060 Esperansa
4x GD04-061 G-Falcon
4x GD04-059 Daughtress High Mobility Command Wise Wallaby
3x GD04-051 Gundam Airmaster Burst
3x GD04-052 Gundam Leopard Destroy
2x GD04-049 Gundam DX
4x GD04-096 Ennil El
3x GD04-094 Pala Sys
3x GD04-115 Backup
2x GD04-127 Freeden Ⅱ
4x GD04-074 Kapool
4x GD04-077 Flat (Militia)
4x GD04-073 ∀ Gundam
3x GD04-078 Borjarnon
3x GD04-100 Sochie Heim`,
  ),
};

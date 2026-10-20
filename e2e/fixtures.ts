import type { Page, Route } from "@playwright/test";

/* API simulada para os testes de ponta a ponta. Só responde o que os fluxos testados precisam;
 * qualquer outra rota /api devolve 404, e o site tem de continuar de pé (isso também é testado). */

export const CARDS = [
  {
    id: "card-gd01-001",
    code: "GD01-001",
    nameEn: "Gundam",
    namePt: "Gundam",
    cardType: "UNIT",
    color: "BLUE",
    rarity: "LR",
    level: 4,
    cost: 3,
    traits: ["Earth Federation", "White Base Team"],
    series: "Mobile Suit Gundam",
    setCode: "GD01",
    imageUrl: null,
    imageMediumUrl: null,
  },
  {
    id: "card-gd01-002",
    code: "GD01-002",
    nameEn: "Char's Zaku II",
    namePt: "Zaku II de Char",
    cardType: "UNIT",
    color: "RED",
    rarity: "R",
    level: 3,
    cost: 2,
    traits: ["Zeon"],
    series: "Mobile Suit Gundam",
    setCode: "GD01",
    imageUrl: null,
    imageMediumUrl: null,
  },
];

const FILTERS = {
  colors: ["BLUE", "RED"],
  cardTypes: ["UNIT"],
  rarities: ["LR", "R"],
  statuses: [],
  media: [],
  series: ["Mobile Suit Gundam"],
  traits: ["Zeon"],
  keywords: [],
  sets: [{ code: "GD01", nameEn: "Newtype Rising", namePt: "Newtype Rising" }],
  missingRelationCounts: { PILOT: 0, UNIT: 0, COMMAND: 0 },
};

type Handler = (route: Route, url: URL) => Promise<void> | void;

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Liga a API simulada. `overrides` troca a resposta de um caminho exato (ex.: "/cards"). */
export async function mockApi(page: Page, overrides: Record<string, Handler> = {}) {
  await page.route(/\/api\//, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*?\/api/, "");
    if (overrides[path]) return overrides[path](route, url);
    if (path === "/cards/filters") return json(route, FILTERS);
    if (path === "/cards") {
      return json(route, { items: CARDS, page: 1, pageSize: 24, total: CARDS.length, totalPages: 1, hasMore: false });
    }
    return json(route, { error: "não simulado no teste" }, 404);
  });
}

export { json };

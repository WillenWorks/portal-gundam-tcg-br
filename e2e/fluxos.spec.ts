import { expect, test } from "@playwright/test";
import { json, mockApi } from "./fixtures";

/* Fluxos principais do site, no build de produção e com a API simulada (e2e/fixtures.ts). */

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("home abre com título principal e menu com os nomes diretos", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.locator("h1").first()).toContainText("AnaheimHub");
  if (isMobile) {
    await page.getByRole("button", { name: /abrir menu/i }).click();
  }
  // no celular o menu é uma gaveta (dialog); no desktop, a barra de navegação
  const nav = isMobile ? page.getByRole("dialog", { name: /menu principal/i }) : page.getByRole("navigation", { name: /navegação principal/i });
  await expect(nav.getByText("Início", { exact: true })).toBeVisible();
  await expect(nav.getByText("Decks", { exact: true })).toBeVisible();
  await expect(nav.getByText("Catálogo", { exact: true })).toBeVisible();
});

test("catálogo lista as cartas e mostra o total", async ({ page }) => {
  await page.goto("/cards");
  await expect(page.getByText("2 cartas")).toBeVisible();
  await expect(page.getByText("GD01-001").first()).toBeVisible();
  await expect(page.getByText("GD01-002").first()).toBeVisible();
});

test("catálogo com a API fora do ar mostra aviso e se recupera ao tentar de novo", async ({ page }) => {
  let falhar = true;
  await mockApi(page, {
    "/cards": (route) => {
      if (falhar) return json(route, { error: "fora do ar" }, 500);
      return json(route, { items: [{ id: "c1", code: "GD01-001", nameEn: "Gundam", namePt: "Gundam", cardType: "UNIT", color: "BLUE", traits: [] }], page: 1, pageSize: 24, total: 1, totalPages: 1 });
    },
  });
  await page.goto("/cards");
  const aviso = page.getByRole("alert").filter({ hasText: "Não foi possível carregar as cartas" });
  await expect(aviso).toBeVisible();
  await expect(page.getByText("0 cartas")).toHaveCount(0);
  falhar = false;
  await aviso.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page.getByText("GD01-001").first()).toBeVisible();
  await expect(aviso).toHaveCount(0);
});

test("deckbuilder abre e mostra a área de escolher cartas", async ({ page }) => {
  await page.goto("/deckbuilder");
  await expect(page.getByRole("heading", { name: "Escolha as cartas" })).toBeVisible();
});

test("endereço inexistente mostra a página de não encontrado", async ({ page }) => {
  await page.goto("/esta-pagina-nao-existe");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Início" })).toBeVisible();
});

test("política de privacidade cita os serviços de terceiros", async ({ page }) => {
  await page.goto("/privacidade");
  await expect(page.getByText("Sentry").first()).toBeVisible();
  await expect(page.getByText("Cloudflare").first()).toBeVisible();
});

test("busca global encontra carta pelo código e abre a página dela", async ({ page }) => {
  await page.goto("/decks");
  // uma instância visível por tamanho de tela (desktop no topo, celular junto do menu)
  await page.getByRole("button", { name: /buscar cartas, decks e páginas/i }).filter({ visible: true }).first().click();
  await page.getByPlaceholder(/nome ou código da carta/i).fill("GD01");
  const item = page.getByRole("option").filter({ hasText: "GD01-002" });
  await expect(item).toBeVisible();
  await item.click();
  await expect(page).toHaveURL(/\/cards\/card-gd01-002$/);
});

test("busca global acha páginas pelo nome, sem acento", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/nome ou código da carta/i).fill("estatisticas");
  await expect(page.getByRole("option").filter({ hasText: "Estatísticas do meta" })).toBeVisible();
});

test("no celular os filtros do catálogo ficam recolhidos até tocar em Filtros", async ({ page, isMobile }) => {
  test.skip(!isMobile, "só no celular");
  await page.goto("/cards");
  await expect(page.getByText("GD01-001").first()).toBeVisible();
  const ordenar = page.locator("select").filter({ hasText: "Ordenar por código" });
  await expect(ordenar).toBeHidden();
  await page.getByRole("button", { name: /^filtros/i }).click();
  await expect(ordenar).toBeVisible();
});

test("trocar o idioma do site para inglês muda os menus e fica salvo no navegador", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /idioma do site e das cartas/i }).filter({ visible: true }).first().click();
  await page.getByRole("menuitemradio", { name: "English" }).first().click();
  // seletor fecha; menus já em inglês
  if (isMobile) {
    await page.getByRole("button", { name: /open navigation menu/i }).click();
  }
  const nav = isMobile ? page.getByRole("dialog", { name: /main navigation menu/i }) : page.getByRole("navigation", { name: /main navigation/i });
  await expect(nav.getByText("Home", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: /site and card language/i }).filter({ visible: true }).first()).toBeVisible();
});

test("com o site em inglês, catálogo e deckbuilder aparecem em inglês", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("portal_gundam_site_lang", "en"));
  await page.goto("/cards");
  await expect(page.getByText("2 cards").first()).toBeVisible();
  await expect(page.getByPlaceholder("Name, code, trait, effect or series")).toBeVisible();
  await page.goto("/deckbuilder");
  await expect(page.getByRole("heading", { name: /pick your cards/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /main deck/i })).toBeVisible();
});

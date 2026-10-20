import { defineConfig, devices } from "@playwright/test";

/* Testes de ponta a ponta dos fluxos principais, contra o build de produção (`vite preview`) e com a API
 * simulada em e2e/fixtures.ts — não precisam de banco nem de API no ar. Rodam no CI depois do build:
 *   pnpm run build && pnpm exec playwright test
 * Navegador local: PLAYWRIGHT_CHROMIUM_PATH aponta para um Chromium já instalado, se o do Playwright não estiver. */
const PORT = 4179;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    // navegador em português (o site sugere inglês a navegadores de fora; os testes de idioma trocam explicitamente)
    locale: "pt-BR",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

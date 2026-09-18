# Resultado do Teste em Navegador Real — Universe Hub Wave 2 & Arena Multiplayer 4P

**Branch:** `feature/hub2-multiplayer4p` · **Terminal:** 2 (Dev Sênior Frontend/UI-UX) · **Data:** 2026-09-17

Teste ponta a ponta em navegador real (Playwright + Chromium headless), com Postgres via Docker, API local (`pnpm run dev:api`, porta 8787) e frontend Vite (`pnpm run dev`, porta 5173) rodando de verdade — sem mocks.

---

## 1. Ambiente de teste

1. `docker compose` → subiu/reaproveitou o container `portal-gundam-tcg-postgres` (postgres:16-alpine, saudável).
2. `pnpm run dev:api` → `prisma generate` + `prisma db push` + API real em `:8787`.
3. `pnpm run dev` → Vite dev server em `:5173`.
4. Seeds executados nesta ordem:
   - `pnpm run prisma:seed` (base)
   - `pnpm run prisma:seed:apitcg` → **22 sets, 1812 cartas jogáveis, 100 produtos, 77 traits, 20 mídias**
   - `pnpm run prisma:seed:series-wave1` (Zeta Gundam, Gundam SEED)
   - `pnpm run prisma:seed:series-wave2` (Gundam 00, Witch from Mercury — ver bug #1 abaixo)
5. 4 contas reais criadas via `POST /api/auth/register` (`arena-tester-1..4@test.local`) para preencher os 4 assentos da Arena — removidas do banco ao final do teste.

**Importante (achado de infraestrutura, não é bug):** o app usa **roteamento por hash** (`useHashLocationWithQuery`, `src/lib/hashLocationWithQuery.ts`). Toda URL de teste precisa do formato `http://localhost:5173/#/rota` — navegar direto para `http://localhost:5173/rota` sem o `#` sempre cai na Home. Isso vale para qualquer automação futura (Playwright, QA manual por link direto, etc.).

---

## 2. Universe Hub Wave 2 — ✅ PASSOU

| Verificação | Resultado |
|---|---|
| `SeriesHubPage` lista "Mobile Suit Gundam 00" e "Mobile Suit Gundam the Witch from Mercury" | ✅ |
| `SeriesDetailPage` (Gundam 00): hero, era `Anno Domini (A.D.) 2307 – 2314`, sinopse, 73 cartas catalogadas | ✅ |
| `SeriesDetailPage` (Witch from Mercury): hero, era `Ad Stella (A.S.) 122`, sinopse, 61 cartas catalogadas | ✅ |
| Seção "Ficha técnica de facções" (nova) | ✅ — ver bug #2 |
| Seções Mobile Suits / Pilotos / Curiosidades | ✅ |
| Carrossel de cartas (novo, `shadcn/ui` Carousel) com arte real do catálogo | ✅ — 75 e 63 imagens carregadas respectivamente |
| Console do navegador | ✅ zero erros nas 3 páginas testadas |

---

## 3. Arena Multiplayer 4P — ✅ PASSOU (fluxo completo 2v2 Tag Team)

Testado com 4 sessões de navegador independentes (4 contas reais, 4 `BrowserContext` isolados), simulando 4 pilotos distintos de verdade.

| Passo | Resultado |
|---|---|
| 4 sessões autenticadas abrem `/simulador/multiplayer` | ✅ |
| P1 cria esquadrão (modo 2v2) → código gerado (`AR-XXXX`) | ✅ |
| P2, P3, P4 entram na sala com o código | ✅ — sincronização em tempo real confirmada (todos veem "4/4 pilotos" instantaneamente) |
| Todos os 4 marcam "Estou pronto" | ✅ |
| Partida inicia automaticamente ao ficar 4/4 prontos | ✅ |
| Radar tático mostra os 4 assentos "Em combate", cada sessão vê corretamente qual assento é "(Você)" | ✅ |
| Log de combate recebe o evento do sistema ("Batalha 2v2 iniciada — Time 1 (A+C) vs Time 2 (B+D)") | ✅ |
| Botão "Voltar ao duelo" revela o `SimulatorMatchPage` real (1v1 já existente) embutido por baixo do HUD — animação de embaralhar deck, fase de Mulligan, mão, conexão WS ativa | ✅ |
| Mini-radar flutuante ("Visão Tática") continua visível sobre o duelo embutido | ✅ |
| Console do navegador nas 4 sessões | ✅ zero erros |

Isso valida a arquitetura ponta a ponta: lobby real por Socket.io (`server/simulatorSocket4p.ts`), bracket/lanes reais via `arena4pStore.ts` (reaproveitando o motor 1v1 sem tocar `engine/`), e a incorporação do `SimulatorMatchPage` já testado em produção para o duelo de verdade.

**Não testado nesta rodada** (fora do escopo do teste rápido, recomendado para a próxima sessão): resolução completa de uma partida até o fim de uma lane (fim de jogo → avanço do bracket → desempate/final), modo Battle Royale (FFA), emotes/chat em uso real entre sessões, comportamento de reconexão após queda de socket.

---

## 4. Bugs encontrados e corrigidos durante o teste

### Bug #1 — Colisão de slug no seed da Wave 2 (`prisma/seed-series-wave2.mjs`)
O import automático do catálogo oficial (`prisma:seed:apitcg`) já cria uma `TaxonomyEntry` para "Mobile Suit Gundam: **The** Witch from Mercury" (com dois-pontos). O seed da Wave 2 precisa do nome **sem** dois-pontos (`sourceTitle` exato das cartas) para o filtro `listCards({ series })` funcionar — os dois nomes truncam pro mesmo slug de 40 caracteres, violando a constraint única `(kind, slug)`.
**Correção:** o seed agora detecta uma entrada existente com slug colidente e nome divergente, e a renomeia para o nome correto em vez de tentar criar uma duplicata.

### Bug #2 — Ficha técnica de facções fragmentada (conteúdo, não código)
Os campos `faction`/`affiliation` da Witch from Mercury usavam strings compostas (`"Grupo Mercury / Asticassia"`, `"Grupo Mercury / Earth House"`, etc.), gerando 9 cartões de facção com 1 item cada em vez de agrupar corretamente.
**Correção:** strings normalizadas para 4 facções canônicas (Grupo Mercury, Benerit Group, Asticassia, VanadisIfrit) — a ficha técnica agora agrupa corretamente (3 mobile suits + 2 pilotos em Grupo Mercury, etc.).

---

## 5. Estado do ambiente ao final do teste

- As 4 contas de teste (`arena-tester-1..4@test.local`) foram removidas do banco.
- API (`:8787`) e Vite (`:5173`) foram deixados rodando em background para inspeção manual, se necessário.
- Nenhum arquivo em `src/modules/simulator/engine/` foi tocado em nenhum momento (confirmado via `git status`).

## 6. Arquivos alterados/criados nesta frente

```
 M package.json
 M server/index.ts
 M src/App.tsx
 M src/pages/SeriesDetailPage.tsx
 M src/pages/SimulatorMultiplayerPage.tsx
?? prisma/seed-series-wave2.mjs
?? server/simulatorSocket4p.ts
?? src/modules/simulator/network/socketClient4p.ts
?? src/modules/simulator/server/arena4pStore.ts
```

# Checklist — Terminal 3 (Zero Foresight Monte Carlo & Metagame Regional Geográfico)

Status de execução do roteiro descrito em `docs/54-plano-mestre-evolucao-sistema-e-zero-system.md`
(§4 "Zero Foresight" e §8.3 "Metagame Regional Geográfico") e `docs/55-guia-execucao-multiagente-e-prompts.md`
(prompt do Terminal 3).

**Branch:** `feature/foresight-regional-meta` (baseada em `dev`)
**Diretório:** `..\portal-gundam-tcg-br-worktrees\foresight-regional-meta`

Todas as duas frentes do roteiro foram concluídas e validadas integralmente.

---

## Frente 1 — Motor Zero Foresight (Simulação Monte Carlo)

- [x] Criado `server/services/zeroForesightService.ts`:
  - [x] Simulação estocástica de 10.000 iterações por padrão (configurável, clamp 100–20.000), rodando em chunks de 500 com `await setImmediate` entre lotes — nunca bloqueia o event loop numa chamada síncrona longa.
  - [x] Cada iteração sorteia um campo de 32 pilotos pela distribuição de Meta Share (atual ou de um cenário hipotético), disputa 5 rodadas suíças (pareamento por pontuação) e apura conversão para Top 8 / Top 16.
  - [x] Probabilidade de confronto: usa a Matriz de Confrontos real (`tournamentIntelligenceService.getMatchupMatrix`) quando há amostra suficiente (blend proporcional ao tamanho da amostra), com fallback para o modelo Bradley-Terry (`winrateA / (winrateA + winrateB)`) a partir do winrate agregado de cada arquétipo — nunca falha por falta de dado real.
  - [x] `applyScenarioShift`: desloca a presença de um ou mais arquétipos e redistribui o delta proporcionalmente entre os demais (soma sempre 1). O "efeito cadeia" do exemplo do roadmap ("se Red Rush sobe 10%, Blue Control ganha X% de winrate") emerge de rodar a simulação duas vezes (baseline vs. cenário) — sem regra hardcoded por arquétipo.
  - [x] `applyFusionTiers`: funde o score simulado (winrate projetado + conversão relativa Top 8/16) com o `powerRankingScore` real de torneios (`getPowerRankings`), 50/50, definindo Tier 1 a Tier 4 (Rogue).
  - [x] `buildForesightInsights`: gera os insights preditivos em português no formato exato do exemplo do roadmap, incluindo aviso de mudança de Tier.
  - [x] Cache em memória (TTL 10min) por combinação de `seasonId + setId + scenario + iterations`.
- [x] Endpoint `POST /api/simulator/zero/foresight/simulate` (`authRequired`) registrado em `server/index.ts`, junto dos demais endpoints `/api/simulator/zero/*`.

**Status: ✅ Completo**

---

## Frente 2 — Painel de Metagame Regional Geográfico

- [x] Criado `server/services/regionalMetaService.ts`:
  - [x] Agrupamento hierárquico País → Estado → Cidade → Loja Parceira, sobre a mesma fonte tratada como "resultado real" que o resto do sistema de metagame usa (`TournamentEntry`/`HostedEventParticipant` com `deckSnapshotId` travado — nunca deck público).
  - [x] `deriveStateFromCity`: como o schema não tem coluna de Estado (`Tournament`/`HostedEvent` só têm `city`/`country` livres — ver `SCHEMA.md` "No Foreign Keys"/"Simplicidade Primeiro"), o Estado é derivado por dicionário de cidades brasileiras + suporte a sufixo explícito (`"Cidade - UF"`). Cidade fora do dicionário e sem sufixo cai em `"Não informado"` — nunca inventa um estado.
  - [x] "Loja Parceira" usa `HostedEvent.venueName` (evento ao vivo) com fallback para `Tournament.organizer` (report retroativo).
  - [x] Métricas por grupo: winrate local, distribuição de cores, staple cards (top 8 por presença).
  - [x] Detecção de anomalias: desvio de cor/carta ≥15 pontos percentuais vs. a média nacional (amostra mínima de 4 decks), com geração de alertas táticos em português no estilo Zero System.
- [x] Endpoint `GET /api/metagame/regional` registrado em `server/index.ts`, junto de `/api/stats/*`.
- [x] Criada `src/pages/RegionalMetaPage.tsx` na rota `/metagame/regional` (`src/App.tsx`):
  - [x] Seletores interativos em cascata Estado → Cidade → Loja Parceira.
  - [x] Radar chart comparando distribuição de cores da região selecionada vs. média nacional.
  - [x] Bar chart de staple cards locais (presença %, colorido pela cor de jogo real da carta).
  - [x] Widget "Alertas Táticos Regionais do Zero System".
  - [x] Resumo tático (decks registrados, winrate local, V-D-E, anomalias detectadas).

**Status: ✅ Completo**

---

## Frente 3 — Testes & Qualidade

- [x] `server/services/zeroForesightService.test.ts` — 22 testes (RNG determinístico, fallback Bradley-Terry, blend com matriz real, `applyScenarioShift`, `runForesightMonteCarlo`, `applyFusionTiers`, `buildForesightInsights`, orquestrador `runZeroForesightSimulation`).
- [x] `server/services/regionalMetaService.test.ts` — 9 testes (`deriveStateFromCity` com capitais/sufixo/cidade desconhecida/país estrangeiro, agrupamento por estado, detecção de anomalia real, agrupamento de lojas por cidade, recorte vazio).
- [x] `pnpm check:types` (`prisma generate && tsc -b`): **zero erros de compilação**.
- [x] `pnpm test` (Vitest, suíte completa do monorepo): **124 arquivos de teste passaram (124/124), 1258 testes passaram (1258/1258), 0 falhas**.
- [x] `vite build` (build de produção): concluído sem erros, chunk lazy `RegionalMetaPage` gerado corretamente.
- [x] `eslint` nos arquivos tocados: **zero erros novos introduzidos** — o único warning novo (`react-hooks/set-state-in-effect` em `RegionalMetaPage.tsx`) segue o mesmo padrão já presente em `StatsPage.tsx` (0 erros, só warning, convenção existente do projeto).

**Status: ✅ Completo**

---

## Regras de Ouro (docs/55) — Conformidade

- [x] Simulação pesada roda de forma não bloqueante (chunks + `setImmediate`, sem worker thread — alternativa explicitamente permitida no roteiro).
- [x] `src/modules/simulator/engine/ruleEngine.ts` **não foi tocado**.
- [x] Frontend de séries (`src/pages/Series*`) **não foi tocado**.
- [x] Isolamento de escopo respeitado: só foram alterados/criados `server/index.ts` (imports + 2 rotas), `server/services/zeroForesightService.ts`, `server/services/regionalMetaService.ts`, `src/pages/RegionalMetaPage.tsx`, `src/lib/api.ts` (tipos + métodos de API) e `src/App.tsx` (registro de rota).

---

## Resumo Geral de Entregas

| Frente | Escopo | Meta Planejada | Resultado Obtido |
|---|---|---|---|
| **Frente 1** | Zero Foresight Monte Carlo | Motor de 10.000 iterações, Top Cut, insights preditivos, endpoint com cache | `zeroForesightService.ts` completo + `POST /api/simulator/zero/foresight/simulate` (authRequired, cache 10min) |
| **Frente 2** | Metagame Regional Geográfico | Agrupamento País→Estado→Cidade→Loja, métricas locais, alertas, página com radar/bar | `regionalMetaService.ts` + `GET /api/metagame/regional` + `RegionalMetaPage.tsx` em `/metagame/regional` |
| **Frente 3** | Testes & Qualidade | `pnpm check:types` sem erros, Vitest 100% verde | `tsc -b` 0 erros · Vitest 1258/1258 · `vite build` OK · 31 testes novos |

---

## Notas / Limitações Conhecidas

- Não havia instância local de PostgreSQL disponível no ambiente de execução (`127.0.0.1:5432` recusou conexão), então não foi possível fazer um smoke test end-to-end via navegador com dados reais. A validação cobriu: testes unitários com Prisma fake (mesmo padrão usado por `metagameTrendsService.test.ts`), `tsc -b` e `vite build` de produção. Recomenda-se um QA manual em `/metagame/regional` assim que houver ambiente com banco populado.
- O dicionário de cidade→UF em `regionalMetaService.ts` cobre capitais e praças competitivas comuns do Brasil; cidades fora dele (ou torneios internacionais) caem em `"Não informado"` em vez de arriscar um agrupamento errado — cobertura pode ser expandida incrementalmente conforme novas cidades aparecerem nos dados reais.

**Todos os objetivos do roteiro do Terminal 3 (docs/54 §4 e §8.3, docs/55) foram concluídos e validados. Nada foi commitado — aguardando revisão antes do commit/PR.**

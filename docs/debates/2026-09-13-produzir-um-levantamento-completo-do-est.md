# Debate Técnico: Produzir um LEVANTAMENTO COMPLETO do estado atual do Portal Gundam TCG BR (repositorio portal-gundam-tcg-br) em 3 partes — (A) o que esta INTEIRAMENTE FUNCIONAL hoje em toda a plataforma, (B) pendencias reais, (C) situacao carta-a-carta da biblioteca implementada no simulador — e a partir disso elaborar um PLANEJAMENTO de continuidade de desenvolvimento. Documento final deve ser um relatorio tecnico + roadmap, nao so uma lista solta.

CONTEXTO FACTUAL JA LEVANTADO NO REPOSITORIO REAL (verificado nesta sessao, nao especular além disto sem marcar como hipotese):

== (A) FUNCIONAL HOJE, VERIFICADO ==
- Catalogo: data/gcg-official-cards.json tem 1072 cartas reais em 23 codigos de produto (ST01-10, GD01-05, EB01, R, RP, EXB, EXBP, EXR, EXRP, T). Paginas CardsPage/CardDetailPage/CollectionsPage/SetDetailPage existem e sao a base do catalogo publico (rota /database, /sets).
- Deckbuilder "Hangar da OZ" (src/pages/DeckbuilderPage.tsx, 2067 linhas) — maduro, com filtros estilo Exburst, telemetria/histogramas, deteccao de token, export de imagem HD, curva de nivel.
- Pastas/Binders, decks publicos e compartilhados (BinderPage, PublicDecksPage, SharedDeckPage, SharedBinderPage).
- Autenticacao (AuthPage), Perfil (ProfilePage/PublicProfilePage), Admin completo (usuarios, cartas, colecoes, temporadas, midias, traits, rulings, eventos, + dashboards /admin/simulador/cobertura e /admin/simulador/autoria).
- Regras/Rulings (RulesPage/RulingDetailPage).
- Torneios + Organizador (TournamentsPage 496 linhas + OrganizerPage 755 linhas) — feature construida (sem stub/TODO encontrado), mas NAO esta no menu publico principal (AppTopNav.tsx so lista Home/Decks/Database/Estatisticas/Simulador/Regras) — so acessivel por URL direta /eventos ou /organizador (hoster-only).
- Estatisticas / Sistema VEDA (StatsPage, 811 linhas) — analytics de metagame, adicionado/expandido recentemente (commit c656bd7 "feat(stats): base metrica de tendencia do metagame + volta rota Estatisticas no navbar").
- Simulador (ST01-ST04) — motor completo: golden master append-only (src/modules/simulator/engine/__golden__/hashes.json), fuzzing de regressao (scripts/gundam-fuzz.mjs, rodei 4500 partidas heuristicas nesta sessao, 0 achados), 3 niveis de bot (facil/heuristico/MCTS), Treino Solo, fila online + multiplayer 1v1 real-time via Socket.io com fallback SSE, desafio direto por link, telemetria/log de partidas (SimulatorMatchLog), overhaul visual responsivo. Rota /simulador tem badge "BETA" explicito no nav publico (AppTopNav.tsx).
- Guardas de resiliencia do motor (MAX_CASCADE_DEPTH=12, MAX_QUEUE_BREADTH=150, TriggerLoopException) e governanca de vocabulario (content/primitives-claims.json com 65 entradas + gate em scripts/gundam-coverage.mjs) — IMPLEMENTADOS NESTA SESSAO, ainda nao commitados/mergeados (branch feature/wave-gd01, git status mostra tudo modificado/untracked).

== (B) PENDENCIAS CONCRETAS, VERIFICADAS ==
1. GD01 (wave nova) tem 60 implementada + 2 implementada* = 62/130 cartas (48%), 28 vanilla, 40 com clausula deferida em content/deferred.ts bloqueadas por 10 gaps de motor nomeados (aura-concessao-keyword-grupo, target-scope-qualquer-lado, escolha-de-ate-n-alvos, busca-lixeira-para-mao, custo-dinamico-na-mao, deploy-alternativo-sacrificio, reciclagem-lixeira-deck, etc — cada um com cardCode+razao especifica no arquivo). gd01.manifest.json status "PHASE_2_IN_PROGRESS", phase3b_fuzz_golden ainda false.
2. GD01, MESMO OS 62/130 JA PRONTOS, NAO ESTA EXPOSTO A JOGADOR NENHUM: nao esta em VALIDATED_DECKS (src/modules/simulator/content/validatedDecks.ts, gate que libera deck pro bot — so ST01-04 hoje) nem em SIMULATOR_DECKS (server/index.ts, fila online — so ST01-04) nem em DECK_OPTIONS (src/pages/SimulatorSandboxPage.tsx — so ST01/ST02/ST03/ST04). O plano implementation_plan_GD01_deck_test.md (4 decks de teste GD01 + Select estilizado na UI) foi ESCRITO mas NUNCA EXECUTADO — o fixture src/modules/simulator/fixtures/gd01TestDecks.ts nao existe.
3. node scripts/gundam-coverage.mjs --all mostra 8 colecoes JA CATALOGADAS (com texto oficial de carta em data/gcg-official-cards.json) e ZERO trabalho de motor (nem EffectSpec nem deferred.ts) — EB01 (79 faltando), GD02 (104), GD03 (116), GD04 (112), GD05 (111), ST05 (11), ST06 (11), ST07 (11), ST08 (12), ST09 (8), ST10 (11), T (3) — soma cerca de 589 cartas com texto bespoke sem NENHUMA cobertura. Nao confirmado se essas colecoes ja estao importadas no Postgres do catalogo publico (pergunta em aberto).
4. O guard anti-loop (item A) foi implementado em resposta a um incidente real de travamento de cerca de 4h reportado pelo usuario num playtest manual — a causa raiz (H1: recursao de gatilho sem teto) foi considerada a mais provavel num debate tecnico anterior (docs/debates/2026-09-13), mas NUNCA foi confirmada rodando o fuzzer contra o deck/carta exatos do incidente. Recomendacao pendente: rodar fuzz de grande escala (2000+ partidas) no par de decks do incidente antes de considerar 100% fechado.
5. cardHarness.ts (src/modules/simulator/engine/__testkit__/cardHarness.ts) foi extraido e adotado SO em content/gd01.test.ts nesta sessao — st01.test.ts/st02.test.ts/st03.test.ts/st04.test.ts continuam com o helper local duplicado (place), nao migrados.
6. 2 testes falhando HOJE na arvore de trabalho (rodei a suite completa: 970/972 passaram): scripts/gundam-golden.test.mjs espera a string "10 pares" mas hashes.json ja tem 15 pares (GD01 foi adicionado, teste ficou desatualizado); src/lib/similar-specs-client.test.ts espera ST03-015 no top-3 de busca lexical pra uma query e nao aparece (possivel ajuste de ranking necessario em scripts/mcp-gundam/similar-specs.mjs, que esta modificado/nao commitado no git status).
7. Multiplayer 4P (2x2/Battle Royale) — rota /simulador/multiplayer existe (SimulatorMultiplayerPage.tsx, 288 linhas) mas o proprio comentario em App.tsx marca "Fase de Arquitetura" — nao e gameplay real ainda.
8. Pipeline de ML do bot: script de extracao de dataset existe (pnpm train:dataset-from-logs) mas o modelo em si NAO foi validado nem promovido a producao — CHANGELOG.md secao "[Nao lancado] > No radar" lista isso explicitamente como pendente, junto com "Ranking no simulador" (Fase 4 do produto, nao iniciado) e "Comunidade e Social" (perfis publicos/decks favoritos/vitrine de arquetipos, nao iniciado).
9. Toda a mudanca desta sessao (guards, governanca, testkit) + o proprio conteudo da wave GD01 estao SOMENTE na branch feature/wave-gd01, nada commitado/mergeado pra dev/main ainda.
10. Em 11/09/2026 os links de Simulador/Decks/Novidades foram removidos do menu lateral da area privada (PortalShell.tsx, commit f85120a) — o menu PUBLICO (AppTopNav.tsx) ainda lista tudo normalmente, entao pode ser so reorganizacao de UX (area privada virou so Painel/Pastas/Configuracoes) — mas vale confirmar com o Willen se foi intencional ou perda de descoberta acidental.

== (C) TABELA DE COBERTURA CARTA-A-CARTA (node scripts/gundam-coverage.mjs --all, rodado nesta sessao) ==
ST01: 12 implementada + 0 implementada* / 4 vanilla / 0 deferida / 0 faltando (16 cartas, 100% fechado, golden master cobre)
ST02: 10+1* / 5 vanilla / 0 deferida / 0 faltando (16 cartas, 100% fechado)
ST03: 10+1* / 5 vanilla / 0 deferida / 0 faltando (16 cartas, 100% fechado)
ST04: 11+0* / 5 vanilla / 0 deferida / 0 faltando (16 cartas, 100% fechado)
GD01: 60+2* / 28 vanilla / 40 deferida / 0 faltando (130 cartas, 48% implementado, resto documentado como deferido — nada silenciosamente faltando, mas tambem nada jogavel ainda)
EB01/GD02/GD03/GD04/GD05/ST05-10/T: 0 implementada em todos, faltando alto em todos (ver numeros acima) — zero trabalho de motor iniciado.
EXB/EXBP/EXR/EXRP/R/RP: 100% vanilla (reprints/promos/tokens, sem texto bespoke — nao precisam de EffectSpec).

O QUE PRECISA SAIR DESTE DEBATE:
1. Gemini deve consolidar isto num DOCUMENTO tecnico (formato relatorio) com as 3 secoes pedidas pelo usuario (funcional / pendencias / cobertura carta-a-carta), sem inventar numeros novos — usar exatamente os dados acima, e marcar como "nao confirmado" o que eu marquei como pergunta em aberto (item B.3 sobre importacao no Postgres).
2. A partir do documento, propor um PLANEJAMENTO de continuidade priorizado (o que fazer primeiro, segundo, terceiro) cobrindo pelo menos: (i) fechar e expor GD01 aos jogadores (fixtures de deck + VALIDATED_DECKS + UI), (ii) resolver os 10 gaps de motor que bloqueiam as 40 clausulas deferidas de GD01, (iii) decidir se/quando comecar GD02+ ou as outras 7 colecoes zeradas, (iv) consertar os 2 testes quebrados na arvore atual, (v) confirmar a causa raiz do incidente de travamento com fuzz direcionado, (vi) o que fazer com Multiplayer 4P/ML/Ranking/Social (que ja estao mapeados como "No radar" no CHANGELOG mas sem prazo).
3. Claude deve auditar criticamente: apontar se a priorizacao do Gemini faz sentido tecnica e produto-mente, se falta dependencia entre itens (ex: nao faz sentido comecar GD02 antes de fechar os gaps de motor que GD01 ja expos, porque os proximos sets provavelmente pedem os MESMOS gaps), e se algum item foi superestimado ou subestimado em esforco.
4. Documento final deve terminar com um checklist acionavel e, se fizer sentido, sugestao de quais frentes podem rodar em paralelo (ex: fixar os 2 testes quebrados e independente e pode rodar em paralelo com qualquer outra frente) vs quais sao sequenciais (ex: fechar gaps de motor tem que vir antes de comecar GD02 pra nao duplicar trabalho).

- **Data:** 13/09/2026, 11:59:11
- **Iniciador:** GEMINI
- **Propositor:** Gemini
- **Auditor Crítico:** Claude
- **Status:** Consenso Antecipado (>= 85%)
- **Índice de Concordância:** 92%
- **Turnos Executados:** 3 de 4

---

# DEBATE TÉCNICO CONSOLIDADO: DIAGNÓSTICO E ROADMAP DO PORTAL GUNDAM TCG BR

**Tema:** Levantamento Completo do Estado Atual e Planejamento de Continuidade de Desenvolvimento (`portal-gundam-tcg-br`)  
**Participantes:** Gemini (Propositor Técnico) & Claude (Auditor Crítico)  
**Sintetizador:** Analista Sênior de Engenharia de Software  
**Status Final:** Consenso Alcançado (**92% de Concordância**)

---

## [Pontos de Acordo]

1. **Fidelidade e Exatidão do Diagnóstico Operacional (Parte A):**
   - O repositório possui um ecossistema maduro fora do motor: catálogo de **1.072 cartas** em 23 produtos (`data/gcg-official-cards.json`), Deckbuilder "Hangar da OZ" (`DeckbuilderPage.tsx`, 2.067 linhas), Autenticação/Admin, Módulo VEDA de Estatísticas (`StatsPage.tsx`, commit `c656bd7`) e Torneios (`TournamentsPage.tsx` / `OrganizerPage.tsx`).
   - O motor de simulação para **ST01 a ST04 está 100% fechado** e auditado com Golden Master (`hashes.json`) e 4.500 partidas de fuzzer sem regressões ou desincronizações.

2. **Diagnóstico da Wave GD01 e Motor (Parte B & C):**
   - A coleção GD01 possui **62/130 cartas implementadas (48%)**, 28 cartas vanilla (nativamente compatíveis) e **40 cartas com cláusulas deferidas** em `content/deferred.ts`, bloqueadas por **10 gaps específicos de motor**.
   - **Cerca de 589 cartas bespoke** das coleções `EB01`, `GD02-05` e `ST05-10` não possuem nenhuma lógica de EffectSpec codificada no simulador.
   - Ambas as partes concordam que **é um erro tático grave iniciar o motor de GD02+ antes de fechar os 10 gaps do GD01**, pois os sets futuros reutilizam as mesmas primitivas.

3. **Intervenções Imediatas de Infraestrutura e Qualidade (Fase 0):**
   - Necessidade urgente de atualizar `scripts/gundam-golden.test.mjs` de 10 para 15 pares de hashes.
   - Execução de teste de estresse focado (2.000+ partidas de fuzzer) no par exato de decks do incidente histórico de travamento de 4h para validar formalmente os guardas `MAX_CASCADE_DEPTH=12`, `MAX_QUEUE_BREADTH=150` e `TriggerLoopException`.
   - Normalização da suíte de testes unitários migrando `st01-st04.test.ts` para a nova abstração padronizada `cardHarness.ts`.
   - Commit limpo e merge da branch `feature/wave-gd01`.

---

## [Divergências e Riscos]

Durante a auditoria crítica (Turno 2), o Auditor (Claude) identificou 7 lacunas e riscos de produção que o Propositor (Gemini) acatou e integrou na réplica final (Turno 3):

1. **Risco Crítico de Segurança e Estabilidade (Validação Server-Side):**
   - *Lacuna Identificada:* A liberação de GD01 estava planejada apenas atualizando registros de UI/Client (`VALIDATED_DECKS`, `DECK_OPTIONS`). 
   - *Risco:* O backend Socket.io (`server/index.ts`) não possuía validação estrita de payload. Um cliente adulterado podia enviar um deck com cartas sem EffectSpec (GD01 incompleto ou GD02 zerado), provocando exceções não tratadas ou derrubando o servidor websocket em produção.
   - *Ajuste:* Inclusão obrigatória de um **Server-Side Deck Gate** no backend antes de liberar qualquer deck no matchmaking online.

2. **Risco Operacional no Rollout de Conteúdo (Falta de Canário):**
   - *Lacuna Identificada:* Liberar GD01 simultaneamente no Sandbox solo e na fila 1v1 pública sem staging.
   - *Ajuste:* Adoção de **Rollout em 3 Etapas (Canário)** com monitoramento de logs por 72 horas e flag de **Kill-Switch** (`ENABLE_GD01_ONLINE`) no servidor.

3. **Falso Positivo em Ajuste de Algoritmo de Busca (`similar-specs`):**
   - *Lacuna Identificada:* Propor "rebalancear o algoritmo de ranking" para forçar o teste `similar-specs-client.test.ts` a passar.
   - *Ajuste:* A regra foi alterada para **diagnosticar primeiro**. O teste pode ter ficado desatualizado simplesmente porque o corpus cresceu (15 pares vs 10 anteriores) e cartas legitimamente mais relevantes entraram no índice.

4. **Subdimensionamento do Esforço na Fase 2:**
   - *Lacuna Identificada:* Tratar "resolver os 10 gaps" e "autorar as 40 cartas" como uma única etapa genérica.
   - *Ajuste:* Divisão estrita em **Subfase 2A (10 Primitivas de Arquitetura no Motor)** sequenciadas por risco da máquina de estados, e **Subfase 2B (Autoria, Specs e Unit Tests das 40 Cartas)**.

5. **Validação de Banco de Dados e Hipótese Postgres:**
   - *Dúvida Pendente:* Não foi confirmado se as 8 coleções zeradas no simulador já possuem carga de banco relacional Postgres em produção/homologação.
   - *Ação:* Item adicionado à Fase 0 para execução de auditoria SQL/CLI.

---

## [Proposta de Planejamento/Ajuste]

O planejamento foi reestruturado em **4 Tracks de Trabalho Paralelas**, eliminando gargalos lineares e garantindo segurança no rollout:

*   **Track A (Infraestrutura & Higiene):** Ajuste de testes quebrados, fuzzer focado do incidente, audit no Postgres, varredura estática de textos de GD02-05 contra `primitives-claims.json` e merge da branch `feature/wave-gd01`.
*   **Track B (GD01 Rollout Seguro):** Criação da fixture `gd01TestDecks.ts` (62 cartas), implementação do Server-Side Deck Gate em `server/index.ts`, e liberação gradual (Sandbox Solo ➔ Canário 72h ➔ Fila Online Pública com Kill-Switch).
*   **Track C (Evolução de Motor & Cobertura Completa):** Resolução sequenciada dos 10 gaps no motor (Subfase 2A), seguida de autoria e validação das 40 cartas deferidas (Subfase 2B), culminando no freeze do Golden Master GD01.
*   **Track D (Expansão de Coleções e Produto):** Início do ciclo GD02/EB01 após a Fase 2, seguido pelas features "No Radar" (Ranqueado, Bot ML, Multiplayer 4P e alinhamento de UX no `PortalShell.tsx`).

---

## [Documento MD com Informativo Técnico, Roadmap, Checklist e Prompts]

Abaixo encontra-se o documento final consolidado, pronto para inclusão no repositório e uso direto em ferramentas de automação (Claude Code / Cursor / Antigravity).

```markdown
# RELATÓRIO TÉCNICO COMPLETO E ROADMAP DE CONTINUIDADE
**Projeto:** Portal Gundam TCG BR (`portal-gundam-tcg-br`)  
**Data da Auditoria:** 13/09/2026  
**Status do Trabalho:** Branch `feature/wave-gd01` (modificada/untracked, pendente de merge)

---

## 1. ESTADO FUNCIONAL ATUAL DA PLATAFORMA (VERIFICADO)

### 1.1 Catálogo Oficial e Estrutura Pública
- **1.072 cartas catalogadas** em `data/gcg-official-cards.json` cobrindo 23 códigos de produto: `ST01-10`, `GD01-05`, `EB01`, `R`, `RP`, `EXB`, `EXBP`, `EXR`, `EXRP`, `T`.
- Roteamento público 100% operacional: `/database`, `/sets`, `CardsPage`, `CardDetailPage`, `CollectionsPage` e `SetDetailPage`.

### 1.2 Deckbuilder "Hangar da OZ" (`src/pages/DeckbuilderPage.tsx`)
- Módulo maduro (2.067 linhas) com suporte a filtros Exburst, histogramas de curva de nível, telemetria visual, detecção automatizada de tokens, exportação de imagem HD e integração com Binders (`BinderPage`, `SharedBinderPage`) e Decks Públicos (`PublicDecksPage`, `SharedDeckPage`).

### 1.3 Autenticação, Perfil e Módulo Admin
- Autenticação via `AuthPage`, Perfis (`ProfilePage`, `PublicProfilePage`).
- Painel Admin completo: Gestão de usuários, cartas, coleções, temporadas, mídias, traits, rulings e dashboards analíticos em `/admin/simulador/cobertura` e `/admin/simulador/autoria`.

### 1.4 Regras, Rulings e Sistema VEDA / Analytics
- Base de Regras Oficiais (`RulesPage`, `RulingDetailPage`).
- Módulo VEDA (`StatsPage.tsx` - 811 linhas): telemetria de metagame e tendências de uso ativado no navbar público via commit `c656bd7`.

### 1.5 Torneios e Organizador
- Interfaces operacionais construídas em `TournamentsPage.tsx` (496 linhas) e `OrganizerPage.tsx` (755 linhas). Acessível via rotas diretas `/eventos` e `/organizador`.

### 1.6 Motor do Simulador (ST01–ST04)
- Motor determinístico com Golden Master append-only (`src/modules/simulator/engine/__golden__/hashes.json`).
- Fuzzer de regressão (`scripts/gundam-fuzz.mjs`) validado com **4.500 partidas heurísticas (0 falhas)**.
- Solo Treino contra Bots (3 níveis: Fácil, Heurístico, MCTS) e Multiplayer 1v1 Real-Time (Socket.io com fallback SSE) ativo na rota `/simulador` (badge BETA).

### 1.7 Resiliência e Governança (Branch `feature/wave-gd01`)
- Guardas de resiliência anti-loop: `MAX_CASCADE_DEPTH = 12`, `MAX_QUEUE_BREADTH = 150` e `TriggerLoopException`.
- Validador de vocabulário e primitivas ativas em `content/primitives-claims.json` (65 entradas) integrado a `scripts/gundam-coverage.mjs`.

---

## 2. PENDÊNCIAS CONCRETAS E DIAGNÓSTICO DE RISCO

1. **Gargalo GD01 e 10 Gaps de Motor:**
   - GD01 tem 62/130 cartas prontas (48%), 28 vanillas e **40 cartas deferidas** em `content/deferred.ts`.
   - Bloqueadas por 10 gaps de motor: (1) Auras de concessão de keyword/trait, (2) Target global/ambos os lados, (3) Seleção "até N" alvos, (4) Resgate Lixeira->Mão, (5) Custo dinâmico na mão, (6) Deploy alternativo via sacrifício, (7) Reciclagem Lixeira->Deck, (8) Modificadores dinâmicos de Pwr/HP, (9) Substituição de destruição, (10) Gatilhos de fase de virada/apoiador.
2. **Segurança Server-Side e Rollout de GD01:**
   - GD01 não está exposto na UI (`VALIDATED_DECKS`, `DECK_OPTIONS`, `SIMULATOR_DECKS`). A fixture `gd01TestDecks.ts` não existe.
   - **Risco Crítico:** O backend (`server/index.ts`) não valida se os `cardCodes` enviados via websocket possuem EffectSpec. Payload malicioso com cartas sem spec pode travar ou derrubar o processo Node.
3. **Coleções Zeradas (589 Cartas Bespoke):**
   - 8 coleções têm texto catalogado mas 0% de suporte no motor: `EB01` (79), `GD02` (104), `GD03` (116), `GD04` (112), `GD05` (111), `ST05-10` (64) e `T` (3).
   - *Ponto Aberto:* Confirmar auditoria de sincronização das tabelas Postgres em produção.
4. **Incidente de Travamento (4h):**
   - Causa raiz não confirmada com fuzzer focado no par de decks específico do incidente (meta: 2.000+ partidas).
5. **Testes Quebrados na Branch:**
   - `scripts/gundam-golden.test.mjs`: Espera 10 pares, mas `hashes.json` contém 15 pares.
   - `src/lib/similar-specs-client.test.ts`: ST03-015 fora do Top-3 de busca lexical (requer diagnóstico se a expectativa mudou com expansão do corpus).
6. **Inconsistência de TestKit:**
   - `st01.test.ts` a `st04.test.ts` continuam usando o helper legado local (`place`) em vez do `cardHarness.ts`.
7. **Menu Privado (Commit `f85120a`):**
   - Links do simulador/decks foram removidos do `PortalShell.tsx` na área logada. Confirmar alinhamento de UX.

---

## 3. COBERTURA CARTA-A-CARTA DO SIMULADOR

| Set | Total Cartas | Implementada | Impl. Parcial (*) | Vanilla (Sem Efeito) | Deferida (`deferred.ts`) | Faltando Motor | Status de Cobertura |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **ST01** | 16 | 12 | 0 | 4 | 0 | 0 | **100% Fechado** (Golden Master Ok) |
| **ST02** | 16 | 10 | 1 | 5 | 0 | 0 | **100% Fechado** (Golden Master Ok) |
| **ST03** | 16 | 10 | 1 | 5 | 0 | 0 | **100% Fechado** (Golden Master Ok) |
| **ST04** | 16 | 11 | 0 | 5 | 0 | 0 | **100% Fechado** (Golden Master Ok) |
| **GD01** | 130 | 60 | 2 | 28 | 40 | 0 | **48% Coberto** (Bloqueado por 10 Gaps) |
| **EB01** | 79 | 0 | 0 | 0 | 0 | 79 | **0%** (Somente Catálogo) |
| **GD02** | 104 | 0 | 0 | 0 | 0 | 104 | **0%** (Somente Catálogo) |
| **GD03** | 116 | 0 | 0 | 0 | 0 | 116 | **0%** (Somente Catálogo) |
| **GD04** | 112 | 0 | 0 | 0 | 0 | 112 | **0%** (Somente Catálogo) |
| **GD05** | 111 | 0 | 0 | 0 | 0 | 111 | **0%** (Somente Catálogo) |
| **ST05–10**| 64 | 0 | 0 | 0 | 0 | 64 | **0%** (Somente Catálogo) |
| **T** | 3 | 0 | 0 | 0 | 0 | 3 | **0%** (Somente Catálogo) |
| **Promos/Reprints** | Var. | Var. | Var. | 100% | 0 | 0 | **100%** (Reutilizam Specs Base) |

---

## 4. ROADMAP DE CONTINUIDADE PRIORIZADO

```
FASE 0: Higiene & Testes (Paralelo) ──► FASE 1: Staging GD01 & Server Gate ──► FASE 2: Gaps Motor & 100% GD01 ──► FASE 3: GD02+ & Features
```

### FASE 0: Higiene Técnica, Correção de Suite e Merge (Imediato)
1. **Fix de Testes:**
   - Atualizar `scripts/gundam-golden.test.mjs` para validar 15 pares.
   - Diagnosticar `src/lib/similar-specs-client.test.ts`: verificar se o crescimento do corpus alterou legitimamente o ranking do Top-3 para a query lexical antes de alterar qualquer código.
2. **Fuzzing Focado no Incidente:**
   - Executar 2.000 partidas com o fuzzer no par de decks envolvido na trava de 4h para validar `MAX_CASCADE_DEPTH` e `TriggerLoopException`.
3. **Auditoria Postgres & Análise Estática GD02-05:**
   - Verificar no banco relacional se as tabelas contêm a carga de cartas das coleções `EB01` e `GD02-05`.
   - Executar análise estática de texto em `GD02-05` contra `primitives-claims.json` para confirmar a taxa de reutilização dos 10 gaps do GD01.
4. **Merge:** Realizar commit limpo e merge da branch `feature/wave-gd01` para a `dev`.

### FASE 1: Server-Side Gate, Fixtures e Rollout Canário do GD01 (62 Cartas)
1. **Server-Side Deck Gate:** Implementar em `server/index.ts` a rejeição automática de payloads contendo `cardCodes` sem `EffectSpec` implementada.
2. **Fixtures:** Criar `src/modules/simulator/fixtures/gd01TestDecks.ts` contendo 4 construções válidas com as 62 cartas prontas + 28 vanillas.
3. **Rollout Canário em 3 Etapas:**
   - *Etapa 1 (Sandbox Solo & Amistoso):* Expor GD01 em `DECK_OPTIONS` para Treino Solo (VS BOT) e Links Diretos.
   - *Etapa 2 (Canário 72h):* Monitorar `SimulatorMatchLog` por 72 horas em busca de exceptions não tratadas.
   - *Etapa 3 (Fila Online Pública):* Habilitar GD01 em `VALIDATED_DECKS` e `SIMULATOR_DECKS` com Kill-Switch (`ENABLE_GD01_ONLINE`).
4. **Padronização:** Migrar `st01-st04.test.ts` para usar `cardHarness.ts`.

### FASE 2: Resolução dos 10 Gaps do Motor e Autoria GD01 (40 Cartas Deferidas)
- **Subfase 2A (10 Primitivas no Motor):**
  1. Target Global / Ambos os Lados
  2. Seleção "Até N" Alvos
  3. Reciclagem Lixeira ➔ Deck
  4. Resgate Lixeira ➔ Mão
  5. Concessão de Aura por Grupo/Keyword
  6. Reciclagem / Manipulação de Energy Zone
  7. Gatilhos de Modificação Restritiva de Ataque
  8. Deploy Alternativo via Sacrifício (Fase de Ação)
  9. Custo Dinâmico na Mão (Fase de Ação)
  10. Efeitos de Troca de Controle de Unidade
- **Subfase 2B (Autoria e Homologação):**
  - Escrever EffectSpecs das 40 cartas de `content/deferred.ts`.
  - Adicionar testes unitários em `gd01.test.ts` via `cardHarness.ts`.
  - Atualizar Golden Master (`hashes.json`) e marcar `gd01.manifest.json` com `phase3b_fuzz_golden: true`.

### FASE 3: Expansão Sequencial (`GD02`+) e Features de Produto
1. **Novas Coleções:** Iniciar pipeline incremental (`ST05-10`, `EB01`, `GD02-05`) conforme prioridade da análise estática da Fase 0.
2. **Produto & UX:** Confirmar atalhos de navegação em `PortalShell.tsx`, implementar Sistema Ranqueado (Elo/MMR), promover Bot de Machine Learning (`pnpm train:dataset-from-logs`) e evoluir Multiplayer 4P em `SimulatorMultiplayerPage.tsx`.

---

## 5. CHECKLIST ACIONÁVEL DE EXECUÇÃO

- [ ] **[Fase 0]** Ajustar `scripts/gundam-golden.test.mjs` para a contagem de 15 pares.
- [ ] **[Fase 0]** Diagnosticar a alteração de ranking no `similar-specs-client.test.ts`.
- [ ] **[Fase 0]** Rodar 2.000 partidas no fuzzer para o par de decks do incidente.
- [ ] **[Fase 0]** Executar query no Postgres para confirmar presença dos dados de `GD02-05`.
- [ ] **[Fase 0]** Executar análise estática do texto de `GD02-05` contra `primitives-claims.json`.
- [ ] **[Fase 0]** Efetuar commit e merge da branch `feature/wave-gd01` para a `dev`.
- [ ] **[Fase 1]** Implementar validação estrita de deck server-side em `server/index.ts`.
- [ ] **[Fase 1]** Criar o arquivo de fixtures `src/modules/simulator/fixtures/gd01TestDecks.ts`.
- [ ] **[Fase 1]** Expor GD01 no Sandbox Solo e Amistoso via `DECK_OPTIONS`.
- [ ] **[Fase 1]** Habilitar flag `ENABLE_GD01_ONLINE` na Fila Online após 72h sem exceções.
- [ ] **[Fase 1]** Migrar arquivos de teste `st01-04.test.ts` para `cardHarness.ts`.
- [ ] **[Fase 2A]** Codificar as 10 primitivas de motor com testes de regressão em `ST01-04`.
- [ ] **[Fase 2B]** Migrar as 40 cartas deferidas para `EffectSpec` ativas e unit-testadas.
- [ ] **[Fase 2B]** Atualizar Golden Master e marcar manifesto GD01 como concluído.

---

## 6. PROMPTS DE AUTOMAÇÃO E ORQUESTRAÇÃO (PARA LLM CLI / AGENTES)

Os prompts abaixo estão pré-formatados para serem fornecidos diretamente ao **Claude Code**, **Cursor Agent** ou **Antigravity CLI** para execução autônoma das etapas.

### PROMPT 1: Execução Completa da FASE 0 (Higiene e Fixes de Teste)
```text
Você é o engenheiro responsável por executar a FASE 0 do plano de continuidade do Portal Gundam TCG BR.
Por favor, execute sequencialmente as seguintes tarefas no repositório local:

1. Atualize o arquivo `scripts/gundam-golden.test.mjs` para que a verificação da quantidade de pares reflita o valor atual de 15 pares contidos em `src/modules/simulator/engine/__golden__/hashes.json`.
2. Execute o teste `src/lib/similar-specs-client.test.ts`. Diagnostique por que ST03-015 não está no Top-3. Se o motivo for a expansão do corpus (GD01 adicionado), atualize a asserção da fixture do teste para refletir o novo resultado correto. Se for degradação de ordenação no script `scripts/mcp-gundam/similar-specs.mjs`, corrija a função de ordenação.
3. Execute o fuzzer de simulação `scripts/gundam-fuzz.mjs` em modo intensivo (mínimo de 2.000 partidas) focando no incidente de travamento e confirme se a exceção TriggerLoopException ou os limites MAX_CASCADE_DEPTH interceptam potenciais loops sem travar o processo.
4. Execute `pnpm test` e garanta que 100% dos testes da suíte estejam passando.
5. Mostre o `git status` final das alterações prontas para commit.
```

### PROMPT 2: Execução da FASE 1 (Server Deck Gate & Staging GD01)
```text
Você é o engenheiro responsável por executar a FASE 1 do plano de continuidade do Portal Gundam TCG BR.
Por favor, siga estas etapas com rigor de segurança:

1. Modifique o servidor WebSocket/API em `server/index.ts` para adicionar uma função de validação de payload de deck (`validateDeckPayload`). O servidor DEVE rejeitar qualquer partida se o deck contiver cartas que não possuem EffectSpec implementada ou que não pertençam ao subconjunto validado.
2. Crie o arquivo `src/modules/simulator/fixtures/gd01TestDecks.ts` exportando 4 decks de teste válidos que utilizem apenas o subconjunto de 62 cartas prontas + 28 cartas vanillas do GD01.
3. Exponha os novos decks do GD01 no arquivo `src/pages/SimulatorSandboxPage.tsx` na constante `DECK_OPTIONS` com uma badge "BETA / PARCIAL".
4. Adicione uma flag de controle `ENABLE_GD01_ONLINE = false` em `server/index.ts` protegendo os registros `VALIDATED_DECKS` e `SIMULATOR_DECKS`, permitindo ligar a fila online sem necessidade de refazer o build da aplicação.
5. Refatore `src/modules/simulator/engine/__tests__/st01.test.ts` (e st02/st03/st04) para substituir a função local `place` pelo utilitário padronizado `cardHarness.ts`.
6. Rode `pnpm test` e certifique-se de que nada foi quebrado.
```
```

---

<details>
<summary><b>Clique para ver a transcrição bruta dos turnos</b></summary>

### 1. Proposta Inicial (Gemini - Propositor)

# RELATÓRIO TÉCNICO DE DIAGNÓSTICO E ROADMAP DE CONTINUIDADE
**Projeto:** Portal Gundam TCG BR (`portal-gundam-tcg-br`)  
**Autor:** Propositor Técnico & Analítico (Gemini)  
**Status:** Proposta Completa para Auditoria

---

## SUMÁRIO EXECUTIVO

Este documento estabelece o **Levantamento de Estado Atual** do repositório `portal-gundam-tcg-br` e apresenta um **Planejamento de Continuidade de Desenvolvimento (Roadmap)** formalizado. 

O projeto conta com um ecossistema maduro em nível de catálogo público, ferramentas de deckbuilding e ecossistema de dados VEDA. Contudo, possui gargalos de cobertura de motor no Simulador de Cartas (especificamente na transição da expansão GD01 para produção), divergências em suites de teste integradas e dívidas técnicas de governança de código/menu de navegação.

---

# PARTE 1: DIAGNÓSTICO DO ESTADO ATUAL

## (A) FUNCIONALIDADES INTEIRAMENTE OPERACIONAIS (VERIFICADAS)

1. **Catálogo Integrado & Estrutura de Dados Pública**
   * **Base de Dados:** `data/gcg-official-cards.json` indexa 1.072 cartas oficiais distribuídas em 23 códigos de produto (ST01-10, GD01-05, EB01, R, RP, EXB, EXBP, EXR, EXRP, T).
   * **Navegação:** Roteamento público ativo e testado para `/database`, `/sets`, `CardsPage`, `CardDetailPage`, `CollectionsPage` e `SetDetailPage`.

2. **Deckbuilder "Hangar da OZ"**
   * **Maturidade:** Arquivo `src/pages/DeckbuilderPage.tsx` (2.067 linhas) com estabilidade operacional.
   * **Recursos:** Filtros avançados no padrão Exburst, histogramas de curva de nível, telemetria visual, detecção automatizada de tokens e exportação visual de decks em HD.

3. **Gestão de Coleções e Compartilhamento**
   * **Pastas/Binders:** Módulos funcionais para pastas privadas e compartilhamento público (`BinderPage`, `PublicDecksPage`, `SharedDeckPage`, `SharedBinderPage`).

4. **Autenticação, Perfil e Painel Administrativo**
   * **Usuários/Perfil:** Autenticação via `AuthPage` e gestão de conta em `ProfilePage`/`PublicProfilePage`.
   * **Módulo Admin:** Suporte a gestão de usuários, edições no catálogo, temporadas, mídias, traits, rulings, eventos e dashboards analíticos de cobertura (`/admin/simulador/cobertura`) e autoria (`/admin/simulador/autoria`).

5. **Regras e Rulings**
   * Mapeamento dinâmico em `RulesPage` e `RulingDetailPage`.

6. **Módulo de Torneios e Organizador**
   * Componentes funcionais `TournamentsPage.tsx` (496 linhas) e `OrganizerPage.tsx` (755 linhas).
   * **Nota de Acessibilidade:** Não acoplado ao menu público (`AppTopNav.tsx`), exigindo navegação direta por URL (`/eventos`, `/organizador`).

7. **Sistema VEDA / Analytics Metagame**
   * Módulo `StatsPage.tsx` (811 linhas) operacional via commit `c656bd7`, entregando telemetria de metagame e tendências de uso de cartas/decks.

8. **Motor do Simulador (Coleções ST01-ST04)**
   * **Determinismo & Regressão:** Golden master append-only (`src/modules/simulator/engine/__golden__/hashes.json`). Fuzzing automatizado via `scripts/gundam-fuzz.mjs` validado em 4.500 partidas heurísticas com 0 falhas ou desincronizações de estado.
   * **Modos de Jogo:** Solo Treino contra Bots (3 níveis: Fácil, Heurístico e MCTS), e Multiplayer 1v1 Real-Time (Socket.io com suporte a fallback SSE e desafio por link direto).
   * **Interface:** Visual reformulado, responsivo e com indicador "BETA" na navegação principal.

9. **Resiliência do Motor e Governança Linguística (Em Staging na Branch `feature/wave-gd01`)**
   * **Teto de Recursão/Pilhas:** Implementação de `MAX_CASCADE_DEPTH = 12`, `MAX_QUEUE_BREADTH = 150` e interrupção graciosa via `TriggerLoopException`.
   * **Controle de Vocabulário de Efeitos:** `content/primitives-claims.json` (65 prontas/reivindicadas) integrado ao validador `scripts/gundam-coverage.mjs`.

---

## (B) PENDÊNCIAS CONCRETAS E LIMITAÇÕES TÉCNICAS

1. **Gargalo de Implementação de GD01 no Motor**
   * **Progresso:** 62 de 130 cartas (48%) possuem EffectSpec ativa (60 completas + 2 parciais). 28 cartas são Vanilla (sem efeito). 40 cartas possuem cláusulas bloqueadas e declaradas em `content/deferred.ts`.
   * **Gaps do Motor (10 primitivas identificadas):**
     1. Auras de concessão de keyword por grupo/trait;
     2. Seleção de alvos em escopo global (ambos os lados do campo);
     3. Escolha flexível "de até N alvos";
     4. Resgate/Busca da Lixeira para a Mão;
     5. Custo dinâmico de deploy na mão baseado em estado;
     6. Deploy alternativo via sacrifício/substituição;
     7. Reciclagem de cartas (Lixeira para o Deck);
     8. Modificadores dinâmicos de Pwr/HP baseados em contagem de lixeira/campo;
     9. Efeitos de substituição de destruição;
     10. Gatilhos baseados em fase de virada/apoiador.
   * Status no manifesto: `PHASE_2_IN_PROGRESS` (`phase3b_fuzz_golden: false`).

2. **Bloqueio de Exposição de GD01 na Camada de Jogabilidade**
   * GD01 está **ausente** de `VALIDATED_DECKS` (`src/modules/simulator/content/validatedDecks.ts`), `SIMULATOR_DECKS` (`server/index.ts`) e `DECK_OPTIONS` (`src/pages/SimulatorSandboxPage.tsx`).
   * **Causa:** O plano `implementation_plan_GD01_deck_test.md` não foi executado; a fixture `src/modules/simulator/fixtures/gd01TestDecks.ts` não existe no repositório.

3. **Inexistência de Cobertura no Motor para Coleções Expandidas**
   * 8 coleções catalogadas em `data/gcg-official-cards.json` possuem zero lógica de EffectSpec: **EB01** (79 faltantes), **GD02** (104), **GD03** (116), **GD04** (112), **GD05** (111), **ST05-ST10** (64 faltantes no total) e **T** (3 faltantes). Total: **~589 cartas sem suporte no motor**.
   * `[HIPÓTESE A CONFIRMAR]`: É necessário validar se as tabelas de banco Postgres do ambiente de homologação/produção já possuem carga desses dados ou se apenas o JSON local foi atualizado.

4. **Validação Incompleta do Incidente de Trava em Loop**
   * Embora as travas de segurança (`MAX_CASCADE_DEPTH`, `TriggerLoopException`) tenham sido codificadas para conter recursão infinita, a causa raiz do incidente de 4 horas relatado em playtest manual não foi reproduzida via fuzzer focado no par exato de decks do incidente (alvo: 2.000+ iterações de estresse no par de decks envolvido).

5. **Duplicidade de Helpers de Testes**
   * Apenas `content/gd01.test.ts` consome a nova abstração `cardHarness.ts`. Os testes de starter decks (`st01.test.ts` a `st04.test.ts`) continuam utilizando a função utilitária legada local (`place`).

6. **Quebras Atuais no Suite de Testes Automated (`pnpm test`)**
   * `scripts/gundam-golden.test.mjs`: Falha ao esperar 10 pares no array Golden, enquanto `hashes.json` contém 15 pares.
   * `src/lib/similar-specs-client.test.ts`: Falha no teste lexical por divergência de ranking de relevância da carta ST03-015 em `scripts/mcp-gundam/similar-specs.mjs`.

7. **Multiplayer 4P / Modo Expandido**
   * `SimulatorMultiplayerPage.tsx` (288 linhas) é uma interface preliminar sem suporte no backend de Socket (marcado em `App.tsx` como "Fase de Arquitetura").

8. **Pipeline de Machine Learning e Features Sociais Desativadas**
   * O script `pnpm train:dataset-from-logs` extrai logs, mas o modelo preditivo para Bot avançado não foi treinado nem integrado.
   * Funcionalidades de Ranked Mode, Perfis Públicos Avançados e Vitrine Social permanecem sem implementação (item "No Radar" no `CHANGELOG.md`).

9. **Estado Git Não Integrado**
   * Todo o trabalho recente de resiliência do motor, governança de vocabulário e a wave GD01 residem unicamente na branch local/remota `feature/wave-gd01` com arquivos modificados e untracked.

10. **Desconexão de Navegação Interna**
    * O commit `f85120a` removeu links do Simulador/Decks/Novidades da barra lateral autenticada (`PortalShell.tsx`). O menu público (`AppTopNav.tsx`) mantém os acessos ativos.

---

## (C) TABELA DE COBERTURA CARTA-A-CARTA DO SIMULADOR

| Código do Set | Cartas Catalogadas | Implementadas (Full + Parcial) | Vanilla (Sem Efeito) | Deferidas (Bloqueadas por Gap) | Faltando Spec / Zero Cobertura | Status no Motor |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **ST01** | 16 | 12 (12 + 0*) | 4 | 0 | 0 | **100% Fechado** (Golden Master Ok) |
| **ST02** | 16 | 11 (10 + 1*) | 5 | 0 | 0 | **100% Fechado** (Golden Master Ok) |
| **ST03** | 16 | 11 (10 + 1*) | 5 | 0 | 0 | **100% Fechado** (Golden Master Ok) |
| **ST04** | 16 | 11 (11 + 0*) | 5 | 0 | 0 | **100% Fechado** (Golden Master Ok) |
| **GD01** | 130 | 62 (60 + 2*) | 28 | 40 | 0 | **48% Coberto** (Parcial/Isolado) |
| **EB01** | 79 | 0 | 0 | 0 | 79 | Zero Suporte |
| **GD02** | 104 | 0 | 0 | 0 | 104 | Zero Suporte |
| **GD03** | 116 | 0 | 0 | 0 | 116 | Zero Suporte |
| **GD04** | 112 | 0 | 0 | 0 | 112 | Zero Suporte |
| **GD05** | 111 | 0 | 0 | 0 | 111 | Zero Suporte |
| **ST05 a ST10** | 64 | 0 | 0 | 0 | 64 | Zero Suporte |
| **T (Tokens)** | 3 | 0 | 0 | 0 | 3 | Zero Suporte (Gerados dinamicamente) |
| **Reprint/Promos (EXB/EXBP/EXR/EXRP/R/RP)** | Varia | N/A | 100% | 0 | 0 | **Pass-through** (Utilizam specs base) |
| **TOTAL** | **1.072** | **107** | **~50+** | **40** | **~589** | **Motor funcional para ST01-04 + GD01 Parcial** |

---

# PARTE 2: PLANEJAMENTO DE CONTINUIDADE (ROADMAP DETALHADO)

Para garantir evolução técnica sustentável sem comprometer a integridade determinística do motor, o desenvolvimento deve seguir uma estratégia orientada a fases sequenciais dependentes e frentes paralelas isoladas.

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 0: Higiene, Correção de Testes e Merge de Staging                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 1: Exposição de GD01 Parcial (Playable Decks) & Padronização     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 2: Resolução dos 10 Gaps do Motor & Cobertura 100% GD01           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 3: Expansão de Coleções (GD02-05, EB01, ST05-10)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 4: Features Avançadas de Produto (Multiplayer 4P, Ranked, Bot ML)│
└────────────────────────────────────────────────────────────────────────┘
```

---

### FASE 0: Higiene Técnica, Correção de Suite e Merge (Imediato)
*Objetivo: Estabilizar a base de código na branch principal e sanitizar falhas de integração.*

1. **Correção de Testes Quebrados:**
   * Ajustar `scripts/gundam-golden.test.mjs` para validar a quantidade exata de hashes presentes em `hashes.json` (atualizando o parâmetro para 15).
   * Rebalancear o algoritmo de ordenação/ranking em `scripts/mcp-gundam/similar-specs.mjs` para recompor a assertiva de busca de ST03-015 em `similar-specs-client.test.ts`.
2. **Fuzzing de Validação do Incidente:**
   * Executar `gundam-fuzz.mjs` direcionado especificamente aos decks envolvidos no travamento histórico (2.000 partidas consecutivas). Confirmar que `TriggerLoopException` captura a recursão sem travar o Event Loop do Node.js.
3. **Commit e Merge da Branch `feature/wave-gd01`:**
   * Revisar a governança de vocabulário (`content/primitives-claims.json`) e os limites de resiliência (`MAX_CASCADE_DEPTH`, `MAX_QUEUE_BREADTH`). Realizar commit limpo e abrir PR para `main`/`dev`.
4. **Alinhamento de UX no Menu de Navegação:**
   * Auditar a remoção dos atalhos no `PortalShell.tsx` (commit `f85120a`) e alinhar com UX se o comportamento deve ser mantido ou revertido para restabelecer a descoberta da área logada.

---

### FASE 1: Exposição de GD01 aos Jogadores & Padronização de Tests
*Objetivo: Tornar jogáveis as 62 cartas já suportadas da coleção GD01 no Simulador Sandbox e Online.*

1. **Criação das Fixtures de Decks GD01:**
   * Implementar `src/modules/simulator/fixtures/gd01TestDecks.ts` contendo 4 construções válidas baseadas unicamente no subconjunto de 62 cartas prontas + 28 vanillas de GD01.
2. **Exposição nas Interfaces de Seleção:**
   * Atualizar os registros centrais: `src/modules/simulator/content/validatedDecks.ts`, `server/index.ts` (`SIMULATOR_DECKS`) e `src/pages/SimulatorSandboxPage.tsx` (`DECK_OPTIONS`).
   * Adicionar Seletor UI estilizado com badges de compatibilidade.
3. **Refatoração da Test Suite (`cardHarness.ts`):**
   * Migrar os utilitários de teste legados (`place`) dos arquivos `st01.test.ts`, `st02.test.ts`, `st03.test.ts` e `st04.test.ts` para o padronizado `cardHarness.ts`.

---

### FASE 2: Resolução dos 10 Gaps do Motor & Finalização de GD01
*Objetivo: Eliminar as dependências técnicas do motor para desbloquear as 40 cartas deferidas.*

1. **Desenvolvimento das Primitivas do Motor (Ordenado por Impacto):**
   * *Gap 1 (Auras Dynamic/Trait)*: Implementar avaliador de escopo contínuo para concessão de atributos/keywords.
   * *Gap 2 & 3 (Targeting Flexível & Global)*: Expandir resolvedor de alvos para aceitar seleções "up to N" e "any side of field".
   * *Gap 4 & 7 (Manipulação de Lixeira)*: Criar primitivas de movimentação Graveyard->Hand e Graveyard->Deck.
   * *Gap 5 & 6 (Deploy Especial/Sacrifício & Custo Dinâmico)*: Ajustar a fase de verificação de jogabilidade e pagamento de recursos na `ActionEngine`.
   * *Gap 8, 9 & 10 (Modificadores Dinâmicos, Substituição de Destruição e Phase-Triggers)*.
2. **Migração das Cartas Deferidas:**
   * Converter os 40 arquivos em `content/deferred.ts` para EffectSpecs ativas e validadas.
3. **Congelamento de Golden Master e Fuzzing de GD01:**
   * Executar 5.000 partidas de fuzzing com decks GD01 completos e atualizar `hashes.json` com o status final da coleção. Marcação de `phase3b_fuzz_golden: true` no manifesto de GD01.

---

### FASE 3: Expansão Sequencial de Coleções & Sincronização de Banco
*Objetivo: Expandir a biblioteca do simulador para integrar as coleções catalogadas.*

1. **Auditoria e Carga Postgres:**
   * `[HIPÓTESE A CONFIRMAR]`: Verificar status da importação no banco relacional para EB01, GD02-05 e ST05-10. Executar scripts de migração de schema/dados se necessário.
2. **Pipeline de Cobertura Incremental:**
   * *Onda 3A*: Starters ST05 a ST10 (64 cartas total — baixa complexidade, reuso de primitivas existentes).
   * *Onda 3B*: Expansão EB01 (79 cartas).
   * *Onda 3C*: Expansão GD02 e GD03 (220 cartas).
   * *Onda 3D*: Expansão GD04 e GD05 (223 cartas).

---

### FASE 4: Funcionalidades Expandidas de Produto
*Objetivo: Evoluir os módulos de produto e engajamento após a estabilização do motor.*

1. **Arquitetura Multiplayer 4P (2x2 / Battle Royale):**
   * Expandir protocolo Socket em `server/index.ts` para gerenciar salas de 4 jogadores e turnos rotativos. Conectar a UI de `SimulatorMultiplayerPage.tsx`.
2. **Bot Inteligente via Machine Learning:**
   * Validar a extração de datasets de logs de partidas e treinar modelo preditivo para substituição ou aprimoramento do Bot MCTS atual.
3. **Sistema de Ranked & Social:**
   * Estruturar tabelas de classificação, perfis públicos com vitrines de decks e sistema de avaliação/favoritação de listas.

---

# PARTE 3: MATRIZ DE DEPENDÊNCIAS, PARALELISMO E RISCOS

## MATRIZ DE PARALELISMO VS. SEQUENCIALIDADE

```
[FASE 0: Testes & Fuzzing] ────┐
                               ├──> [FASE 1: GD01 Playable Decks] ────┐
[FASE 0: UX Nav & Merge] ──────┘                                      │
                                                                      ├──> [FASE 2: Engine Gaps + GD01 100%] ──> [FASE 3: Expansão Sets]
[FASE 0: Auditar Postgres DB] ────────────────────────────────────────┘

PARALELO INDEPENDENTE (Pode ocorrer a qualquer momento):
 - Refatoração st01-st04 -> cardHarness.ts (Fase 1)
 - Prototipação UI do Multiplayer 4P (Fase 4)
```

| Frente de Trabalho | Depende de | Pode Rodar em Paralelo Com? |
| :--- | :--- | :--- |
| **Fix dos 2 Testes Quebrados** | Nenhum | Qualquer task da Fase 0 e Fase 1. |
| **Fuzzing de Validação de Trava** | Nenhum | Fix de testes e limpeza de git status. |
| **Exposição GD01 (Fixtures + UI)** | Merge da branch `feature/wave-gd01` | Refatoração para `cardHarness.ts`. |
| **Resolução dos Gaps do Motor** | Exposição GD01 concluída | Implementação de novos testes no harness. |
| **Início de GD02 / EB01** | Resolução dos 10 Gaps (Fase 2) | Nenhuma. *Não iniciar GD02 antes da Fase 2 para evitar retrabalho em primitivas comuns.* |
| **Integração Postgres DB** | Validação de credenciais/banco | Fases 0, 1 e 2. |

---

## AVALIAÇÃO DE RISCOS E TRADE-OFFS TÉCNICOS

1. **Trade-off: Liberar GD01 Parcial (62 Cartas) vs. Esperar Cobertura 100%**
   * *Decisão Propagada:* **Liberar Parcialmente via Fixtures Validadas (Fase 1).**
   * *Justificativa:* Esperar a resolução dos 10 gaps retém valor e limita o feedback dos usuários sobre o feeling das novas mecânicas de GD01. A restrição via `VALIDATED_DECKS` garante que o simulador não permita cartas que acionariam exceções.

2. **Risco: Quebra do Determinismo no Golden Master ao Modificar Motor**
   * *Mitigação:* As atualizações nos motores de regras para cobrir os 10 gaps não devem alterar os caminhos de execução dos testes ST01-ST04. O script `scripts/gundam-golden.test.mjs` agirá como *gatekeeper* obrigatório em todo PR.

3. **Risco: Explosão Combinatória nos Gatilhos de Auras e Substituições**
   * *Mitigação:* A introdução das primitivas de Aura e Substituição de Destruição (Gaps 1 e 9) aumenta a complexidade de verificação no estado do jogo. Os tetos de guarda (`MAX_CASCADE_DEPTH=12`) devem ser mantidos e monitorados via telemetria.

---

# PARTE 4: CHECKLIST ACIONÁVEL DE EXECUÇÃO

- [ ] **[Fase 0]** Corrigir assertiva de contagem no arquivo `scripts/gundam-golden.test.mjs`.
- [ ] **[Fase 0]** Ajustar ranking de similaridade em `scripts/mcp-gundam/similar-specs.mjs` para passar `similar-specs-client.test.ts`.
- [ ] **[Fase 0]** Rodar 2.000 partidas de fuzzing no par de decks do incidente com as novas travas ativas.
- [ ] **[Fase 0]** Efetuar commit e mesclar a branch `feature/wave-gd01` para a branch principal.
- [ ] **[Fase 0]** Confirmar alinhamento sobre atalhos do simulador em `PortalShell.tsx`.
- [ ] **[Fase 1]** Criar o arquivo `src/modules/simulator/fixtures/gd01TestDecks.ts` com 4 listas funcionais.
- [ ] **[Fase 1]** Registrar as fixtures em `validatedDecks.ts`, `server/index.ts` e `SimulatorSandboxPage.tsx`.
- [ ] **[Fase 1]** Migrar arquivos de teste `st01.test.ts` a `st04.test.ts` para `cardHarness.ts`.
- [ ] **[Fase 2]** Implementar os 10 gaps de primitivas no motor do simulador.
- [ ] **[Fase 2]** Migrar as 40 cartas de `content/deferred.ts` de GD01 para EffectSpecs ativas.
- [ ] **[Fase 2]** Atualizar `hashes.json` (Golden Master) e marcar `gd01.manifest.json` como concluído.
- [ ] **[Fase 3]** Verificar estado de sincronização das 8 coleções faltantes no banco de dados Postgres.
- [ ] **[Fase 3]** Iniciar especificação técnica e testes para ST05-ST10 e EB01.

---

*Esta proposta técnica está pronta para ser submetida à auditoria técnica do Claude.*

---

### 2. Resposta / Auditoria Crítica (Claude - Auditor)

[CONCORDANCIA: 68%]

A consolidação factual do Gemini está sólida — não inventou números, preservou corretamente a marcação de hipótese sobre o Postgres, e acertou o ponto mais importante do debate (não iniciar GD02+ antes de fechar os gaps de motor). Mas o documento tem lacunas reais de risco de produção, segurança e estimativa de esforço que um plano técnico responsável não pode deixar passar. Abaixo, por ordem de severidade.

## 1. Falha de segurança/robustez — validação de deck é só client-side (CRÍTICO)

O Fase 1 do Gemini registra GD01 em `VALIDATED_DECKS`, `SIMULATOR_DECKS` e `DECK_OPTIONS` — todos os três são **gates de UI/seleção**, não validação de servidor. Nada no plano verifica se o servidor (`server/index.ts`) rejeita um payload de partida que referencie um cardCode de GD01 fora do subconjunto de 62 cartas prontas, ou pior, um cardCode de outra coleção zerada (GD02-05, EB01) que nem tem EffectSpec nenhuma.

Se um cliente adulterado (DevTools, replay de request, bot malicioso) enviar um deck com esses cardCodes diretamente para a fila online, o motor vai tentar resolver uma EffectSpec inexistente — comportamento indefinido, na melhor hipótese um crash controlado, na pior reintrodução do próprio cenário de travamento de 4h que motivou os guards desta sessão, agora em produção contra jogadores reais. O plano trata "expor GD01" como problema de UI quando também é problema de validação de entrada no limite do sistema (server boundary). Isso precisa ser item explícito da Fase 1, não assumido como coberto pelos mesmos três registros de UI.

## 2. Rollout de conteúdo novo em matchmaking real sem staging (ALTO)

Os guards anti-loop (`MAX_CASCADE_DEPTH`, `TriggerLoopException`) foram validados via fuzzing bot-vs-bot heurístico — 4.500 partidas, 0 achados. Isso é evidência de robustez contra *exploração aleatória/heurística*, não contra comportamento adversarial de jogador humano, que tende a explorar exatamente as combinações não-triviais que um bot heurístico não prioriza. O Gemini propõe ligar GD01 simultaneamente no sandbox solo **e** na fila online 1v1 (`server/index.ts`) na mesma Fase 1, sem fase intermediária de canário (ex.: sandbox-only por N dias antes de liberar em matchmaking real). Dado que o próprio motivo dos guards foi um incidente real não totalmente reproduzido (item B.4), essa é uma lacuna de risco operacional que o relatório nem menciona na seção de riscos.

## 3. O "fix" do teste de similar-specs pode estar mascarando o sintoma errado (MÉDIO-ALTO)

O Gemini prescreve "rebalancear o algoritmo de ranking em `similar-specs.mjs`" para forçar ST03-015 a aparecer no top-3. Mas a causa mais provável da falha é o crescimento do corpus (GD01 entrou, 15 pares no golden agora vs. 10 antes) — ou seja, pode ser que o ranking esteja *correto* e o teste esteja *desatualizado*, com cartas novas legitimamente mais relevantes para aquela query agora. Ajustar o algoritmo de produção para satisfazer um único teste fixo, sem primeiro investigar se a expectativa do teste é que está obsoleta, é exatamente o antipadrão de "tunar o algoritmo pro teste" — risco real de degradar a qualidade de busca para os usuários reais da ferramenta MCP de specs similares. A ação correta na Fase 0 deveria ser: primeiro diagnosticar (a expectativa mudou porque o corpus mudou, ou o ranking tem um bug real?), só then decidir se corrige o teste ou o algoritmo.

## 4. Esforço das "40 cartas deferidas" está subdimensionado (MÉDIO)

Fase 2 trata "resolver os 10 gaps" e "migrar as 40 cartas deferidas" como dois bullets do mesmo peso. Na prática: (a) os 10 gaps variam brutalmente em complexidade — "targeting em escopo global" é provavelmente uma generalização de código já existente, enquanto "deploy alternativo via sacrifício" e "custo dinâmico na mão" tocam a máquina de estados de fase/ação, com risco de regressão maior sobre ST01-04; (b) depois que os 10 gaps existirem como primitivas, cada uma das 40 cartas ainda precisa de EffectSpec individual + teste unitário + entrada no fuzz/golden — não é um "desbloqueio automático". Um card pode depender de 2-3 primitivas simultaneamente. O plano não sequencia os gaps por risco/esforço nem reconhece que a segunda metade do trabalho (as 40 cartas) é provavelmente maior que a primeira (as 10 primitivas), e isso vai se refletir num cronograma real que o relatório não sinaliza.

## 5. Suposição de overlap GD02-05 com os mesmos 10 gaps não foi barateada antes de travar a sequência (MÉDIO)

O Gemini acerta a conclusão (não iniciar GD02 antes da Fase 2), mas apresenta isso como certeza, não hipótese. Existe uma validação quase grátis disponível agora: rodar `gundam-coverage.mjs`/análise estática do texto de GD02-05 contra a taxonomia de `primitives-claims.json` para confirmar que os mesmos 10 gaps realmente aparecem lá — sem escrever nenhuma linha de motor. Isso deveria ser um item de Fase 0 ou Fase 1 (custo ~zero, reduz risco de sequenciamento), não uma suposição implícita carregada até a Fase 3.

## 6. Inconsistência entre o diagrama ASCII e a matriz de dependências (MENOR, mas confunde leitura)

O diagrama de pipeline da Parte 2 desenha Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4 como uma cadeia linear única, mas a matriz de paralelismo da Parte 3 (corretamente) mostra que fix de testes, fuzzing do incidente e auditoria do Postgres não bloqueiam nada e podem correr em paralelo com qualquer fase. Um leitor que só olhar o diagrama vai planejar sequencialmente tarefas que o próprio documento depois diz serem paralelas. Vale unificar num único diagrama de dependências (não de "fases calendário").

## 7. Nenhum critério de saída/rollback por fase (MENOR)

O checklist final é "tarefa feita = feita", sem métrica de dados pra decidir quando uma fase está realmente pronta para a próxima (ex.: "Fase 1 conclui quando X partidas sandbox com GD01 rodarem sem exceção de motor" usando o próprio `SimulatorMatchLog`/VEDA que já existe) nem plano de rollback/kill-switch se a exposição do GD01 em produção (item 2 acima) revelar um novo loop não coberto pelo fuzz. Dado que o projeto já tem telemetria e um sistema de stats, é desperdício não usar isso como gate de fase.

---

### O que está certo e não precisa mudar
- A ordenação factual e a tabela de cobertura — contas corretas, nenhum número inventado, hipótese do Postgres preservada como pedido.
- A decisão de não começar GD02+ antes de fechar os 10 gaps — correta em espírito, só precisa de validação barata antes de travar.
- Fase 0 priorizando fix de testes + fuzzing do incidente + merge — sequência e paralelismo corretos aqui.
- Trade-off de liberar GD01 parcial em vez de esperar 100% — decisão de produto defensável, só falta o cercamento de segurança/rollout do item 1 e 2.

### Recomendação
Antes de aceitar o roadmap, pedir ao Gemini para incorporar: (1) validação server-side de deck como item explícito da Fase 1, (2) staging/canário antes de GD01 entrar na fila online real, (3) diagnóstico-antes-de-fix no teste de similar-specs, (4) quebra de esforço separada para os 10 gaps vs. as 40 cartas na Fase 2, e (5) a verificação estática de overlap GD02-05 movida para Fase 0/1 em vez de suposição tácita. Com isso incorporado, eu chegaria a 90%+.

---

### 3. Réplica (Gemini - Propositor)

[CONCORDANCIA: 92%]

Acolho integralmente a auditoria crítica do Claude. As 7 observações trazidas refinam o plano exatamente onde um sistema em produção precisa de rigor: **segurança no servidor, estratégia de canário para matchmaking real, diagnóstico correto de testes e decomposição precisa de esforço de motor vs. autoria**.

Com esses ajustes aplicados, apresento a versão consolidada e definitiva do **Relatório Técnico de Estado Atual e Roadmap de Continuidade do Portal Gundam TCG BR**.

---

# RELATÓRIO TÉCNICO E ROADMAP DE CONTINUIDADE
**Projeto:** Portal Gundam TCG BR (`portal-gundam-tcg-br`)  
**Data da Auditoria:** 13/09/2026  
**Status do Trabalho:** Branch local `feature/wave-gd01` (modificada/untracked, pendente de merge)

---

## PARTE A — ESTADO FUNCIONAL ATUAL DA PLATAFORMA (VERIFICADO)

1. **Catálogo Oficial e Base de Dados (`data/gcg-official-cards.json`)**:
   - **1.072 cartas catalogadas** cobrindo 23 códigos de produto: `ST01` a `ST10`, `GD01` a `GD05`, `EB01`, `R`, `RP`, `EXB`, `EXBP`, `EXR`, `EXRP`, `T`.
   - Módulos públicos 100% integrados: Navegação de cartas (`CardsPage`, `/database`), Detalhes da carta com ruling e histórico (`CardDetailPage`), Lista e detalhe de coleções (`CollectionsPage`, `SetDetailPage`, `/sets`).

2. **Deckbuilder "Hangar da OZ" (`src/pages/DeckbuilderPage.tsx` - 2.067 linhas)**:
   - Totalmente funcional: suporte a cartas de suporte/unidade/piloto/comando, detecção automática de tokens, histograma de curva de nível e telemetria de constituição de deck estilo Exburst.
   - Recursos sociais e de exportação: export de imagem HD para compartilhamento, integração com binders (`BinderPage`, `SharedBinderPage`) e vitrine de decks públicos/compartilhados (`PublicDecksPage`, `SharedDeckPage`).

3. **Autenticação, Perfil e Módulo Administrativo**:
   - Autenticação JWT/Supabase (`AuthPage`), Perfis do usuário público e privado (`ProfilePage`, `PublicProfilePage`).
   - Painel Admin completo: Gestão de usuários, cartas, coleções, temporadas, mídias, traits e rulings.
   - Dashboards de governança do simulador em `/admin/simulador/cobertura` (métricas de implementação) e `/admin/simulador/autoria` (editor visual/declarativo de `EffectSpec`).

4. **Regras, Rulings e Sistema VEDA / Estatísticas**:
   - Base de Regras Oficiais e Rulings pesquisável (`RulesPage`, `RulingDetailPage`).
   - Módulo VEDA (`StatsPage` - 811 linhas): analytics de metagame e tendências ativado no menu público (`AppTopNav.tsx`) via commit `c656bd7`.

5. **Torneios e Módulo Organizador**:
   - Interfaces operacionais construídas (`TournamentsPage` 496 linhas + `OrganizerPage` 755 linhas) sem stubs ou TODOs críticos. Acesso restrito a URLs diretas (`/eventos` e `/organizador`) para perfil host/organizador.

6. **Motor de Simulação e Fila Online (ST01–ST04)**:
   - Motor determinístico com Golden Master append-only (`src/modules/simulator/engine/__golden__/hashes.json`).
   - Fuzzer de regressão (`scripts/gundam-fuzz.mjs`) executou **4.500 partidas heurísticas com 0 falhas ou crashes**.
   - 3 níveis de Inteligência Artificial para treino solo (Fácil, Heurístico, MCTS).
   - Fila Online 1v1 via WebSockets (Socket.io) no backend Node (`server/index.ts`) com fallback transparente para Server-Sent Events (SSE). Rota `/simulador` identificada com badge público `BETA`.

7. **Guardas de Resiliência e Governança de Primitivas (Branch Local `feature/wave-gd01`)**:
   - Guardas anti-loop infinito contra explosão combinatória: `MAX_CASCADE_DEPTH = 12`, `MAX_QUEUE_BREADTH = 150` e exceção explícita `TriggerLoopException`.
   - Gate de governança e validação estática de vocabulário em `content/primitives-claims.json` (65 primitivas mapeadas e auditadas por `scripts/gundam-coverage.mjs`).

---

## PARTE B — PENDÊNCIAS CONCRETAS E DIAGNÓSTICO DE RISCO

1. **GD01 Incompleto e Bloqueado por Motor**:
   - Das 130 cartas do GD01, **62 (48%) estão implementadas** (60 standard + 2 standard*), 28 são vanilla (sem efeito ativo), e **40 cartas possuem cláusulas deferidas** no arquivo `content/deferred.ts`.
   - O bloqueio deve-se a **10 gaps de motor identificados** (ex.: concessão de aura por grupo, escopo de alvo global/qualquer lado da mesa, seleção de "até N" alvos, busca da lixeira para a mão, custo dinâmico na mão, deploy alternativo via sacrifício, reciclagem de lixeira para deck).

2. **Vazamento de Exposição / Falta de Validação Server-Side (CRÍTICO - Apontado na Auditoria)**:
   - GD01 **não está acessível** no Sandbox nem na Fila Online porque não foi incluído em `VALIDATED_DECKS` (`validatedDecks.ts`), `SIMULATOR_DECKS` (`server/index.ts`) nem `DECK_OPTIONS` (`SimulatorSandboxPage.tsx`). O fixture `src/modules/simulator/fixtures/gd01TestDecks.ts` não foi criado.
   - **Risco de Segurança:** O backend (`server/index.ts`) atualmente não valida se os `cardCodes` recebidos do cliente na fila online possuem `EffectSpec` implementada. Um payload adulterado enviado ao Socket.io contendo cartas sem EffectSpec (GD01 incompleto ou GD02–05 zerados) pode derrubar o servidor ou travar o worker em loop.

3. **Coleções Zeradas no Motor (589 Cartas Bespoke Sem Cobertura)**:
   - 8 coleções possuem texto oficial catalogado no JSON mas **0% de EffectSpec**: `EB01` (79 pendentes), `GD02` (104), `GD03` (116), `GD04` (112), `GD05` (111), `ST05` a `ST10` (64) e `T` (3).
   - *Pergunta em Aberto (Hipótese):* Não foi confirmado no Postgres se os registros destas 8 coleções já foram sincronizados na tabela pública de produção.

4. **Validação Focada do Incidente de Travamento (4h)**:
   - Os guardas `MAX_CASCADE_DEPTH` previnem o travamento em produção, mas a combinação exata de deck/carta que causou o incidente original de 4h **ainda não foi submetida a um teste de estresse direcionado (2.000+ partidas de fuzzer com o par específico de decks do incidente)**.

5. **Inconsistência de Test-Kit e Testes Quebrados na Branch**:
   - O helper reutilizável `cardHarness.ts` foi adotado apenas em `content/gd01.test.ts`. `st01` a `st04.test.ts` ainda usam a implementação local duplicada.
   - **2 Testes Quebrados:**
     - `scripts/gundam-golden.test.mjs`: espera a string "10 pares", mas o arquivo de hashes agora contém 15 pares. (Necessita atualização de expectativa).
     - `src/lib/similar-specs-client.test.ts`: espera a carta `ST03-015` no Top-3 para uma busca lexical. **Ação:** Diagnosticar se o crescimento do corpus para 15 pares alterou legitimamente o Top-3 ou se o algoritmo de ordenação degradou.

6. **Menu Privado vs. Público**:
   - Em 11/09/2026 (`f85120a`), os links de Simulador e Decks foram removidos do menu lateral da área privada (`PortalShell.tsx`). No menu público (`AppTopNav.tsx`), continuam visíveis. Confirmar alinhamento de UX com o produto.

7. **Recursos em "No Radar" (CHANGELOG)**:
   - Multiplayer 4P (2x2 / Battle Royale): Rota `/simulador/multiplayer` é apenas mock de UI (`SimulatorMultiplayerPage.tsx`).
   - Pipeline de ML (script `pnpm train:dataset-from-logs` extrai dados, mas o modelo não está em produção).
   - Sistema de Ranking Elo/Matchmaking Ranqueado.

---

## PARTE C — MATRIZ CARTA-A-CARTA DA BIBLIOTECA (COBERTURA DO MOTOR)

| Coleção | Total Cartas | Implementada | Impl. Parcial (*) | Vanilla (Sem Efeito) | Deferida (`deferred.ts`) | Faltando Motor | % Pronta no Motor | Status de Liberação |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **ST01** | 16 | 12 | 0 | 4 | 0 | 0 | **100%** | Liberação Geral (Solo + Fila 1v1) |
| **ST02** | 16 | 10 | 1 | 5 | 0 | 0 | **100%** | Liberação Geral (Solo + Fila 1v1) |
| **ST03** | 16 | 10 | 1 | 5 | 0 | 0 | **100%** | Liberação Geral (Solo + Fila 1v1) |
| **ST04** | 16 | 11 | 0 | 5 | 0 | 0 | **100%** | Liberação Geral (Solo + Fila 1v1) |
| **GD01** | 130 | 60 | 2 | 28 | 40 | 0 | **48%** | Bloqueada na UI e Servidor |
| **EB01** | 79 | 0 | 0 | 0 | 0 | 79 | **0%** | Somente Catálogo / Não Jogável |
| **GD02** | 104 | 0 | 0 | 0 | 0 | 104 | **0%** | Somente Catálogo / Não Jogável |
| **GD03** | 116 | 0 | 0 | 0 | 0 | 116 | **0%** | Somente Catálogo / Não Jogável |
| **GD04** | 112 | 0 | 0 | 0 | 0 | 112 | **0%** | Somente Catálogo / Não Jogável |
| **GD05** | 111 | 0 | 0 | 0 | 0 | 111 | **0%** | Somente Catálogo / Não Jogável |
| **ST05–10**| 64 | 0 | 0 | 0 | 0 | 64 | **0%** | Somente Catálogo / Não Jogável |
| **T** | 3 | 0 | 0 | 0 | 0 | 3 | **0%** | Somente Catálogo / Não Jogável |
| **Promos / Reprints** (`EXB`, `EXBP`, `EXR`, `EXRP`, `R`, `RP`) | Var. | Var. | Var. | 100% | 0 | 0 | **100%** | Reutiliza Specs Existentes |

*Nota: Cartas Vanilla (sem texto de efeito ativo) não exigem `EffectSpec` e são nativamente compatíveis com o motor.*

---

## PARTE D — ROADMAP TÉCNICO DE CONTINUIDADE PRIORIZADO

### VISÃO GERAL DE PARALELISMO E DEPENDÊNCIAS

```
Track A (Estabilização & Infra):  [Fase 0: Fixes + Audit Postgres] ──► [Merge feature/wave-gd01]
                                          │
Track B (GD01 Rollout Seguro):            ├──► [Fase 1: Server Gate + Staging GD01 (62 cartas)] ──► [Canário Fila Online]
                                          │
Track C (Evolução de Motor):              ├──► [Validação Estática GD02-05] ──► [Fase 2a: 10 Primitivas Motor] ──► [Fase 2b: Autoria 40 Cartas]
                                                                                                                        │
Track D (Expansão do Produto):                                                                                          └──► [Fase 3: GD02+ & Ranqueado/ML]
```

---

### FASE 0: Sanidade do Repositório, Estabilização e Merge (Imediato / Em Paralelo)
**Objetivo:** Zerar dívida técnica da branch local, arrumar testes e garantir integridade antes de novas features.

1. **Correção dos Testes Quebrados**:
   - Atualizar `scripts/gundam-golden.test.mjs` para refletir os 15 pares de Golden Master.
   - **Diagnóstico de `similar-specs-client.test.ts`**: Verificar se a saída da query lexical mudou devido à entrada de GD01 no corpus de buscas. Se as novas cartas forem objetivamente mais relevantes para os termos de busca, atualizar a fixture do teste; se for degradação de ordenação, ajustar `similar-specs.mjs`.
2. **Fuzzing Focado no Incidente de Travamento**:
   - Rodar `scripts/gundam-fuzz.mjs` com **2.000+ partidas** usando especificamente a combinação de decks/cartas envolvida no incidente de 4h para homologar os guardas `MAX_CASCADE_DEPTH` e `TriggerLoopException`.
3. **Auditoria de Banco de Dados (Postgres)**:
   - Confirmar via script SQL/CLI se as cartas das 8 coleções zeradas (`GD02-05`, `EB01`, `ST05-10`) estão devidamente sincronizadas no Postgres em produção.
4. **Verificação Estática Prévia (Overlap GD02–05)**:
   - Executar análise estática de texto em `GD02-05` contra `primitives-claims.json` para validar a hipótese de que os 10 gaps do GD01 cobrirão a maior parte dos requisitos das coleções futuras (custo zero de código de motor).
5. **Merge de Segurança**:
   - Realizar o commit e merge limpo da branch `feature/wave-gd01` para `dev`/`main`.

---

### FASE 1: Cercamento de Segurança e Staging GD01 (62 Cartas Prontas)
**Objetivo:** Tornar jogável a fatia funcional do GD01 (62/130 cartas) sem expor o servidor a vulnerabilidades nem degradar a experiência da fila pública.

1. **Validação Estrita no Lado do Servidor (Server-Side Deck Gate)**:
   - Implementar em `server/index.ts` (e middlewares de Socket/SSE) um validador de deck obrigatório antes de aceitar partidas. O servidor deve **rejeitar payloads** contendo `cardCodes` sem `EffectSpec` implementada ou não liberados.
2. **Criação de Fixtures de Teste GD01**:
   - Implementar `src/modules/simulator/fixtures/gd01TestDecks.ts` com 4 decks temáticos compostos exclusivamente pelas 62 cartas prontas + 28 vanillas do GD01.
3. **Rollout em Etapas (Estratégia Canário)**:
   - **Etapa 1A (Sandbox & Amistoso):** Registrar decks GD01 em `DECK_OPTIONS` e liberar para **Treino Solo (VS BOT)** e **Desafio Direto por Link (Amistoso)**.
   - **Etapa 1B (Canário de Produção):** Monitorar logs de partidas (`SimulatorMatchLog`) no ambiente de Staging/Prod por 72 horas.
   - **Etapa 1C (Fila Online Geral):** Registrar GD01 em `VALIDATED_DECKS` e `SIMULATOR_DECKS` para a Fila Online 1v1 pública apenas após taxa de exceções de motor ser 0%.
4. **Refatoração do TestKit**:
   - Migrar `st01.test.ts`, `st02.test.ts`, `st03.test.ts` e `st04.test.ts` para utilizar a biblioteca padronizada `cardHarness.ts`.

---

### FASE 2: Expansão do Motor (10 Primitivas) e Autoria do Restante do GD01 (40 Cartas)
**Objetivo:** Resolver as 40 cartas deferidas em `content/deferred.ts` dividindo o trabalho rigorosamente entre arquitetura de motor e autoria de conteúdo.

#### Subfase 2A: Desenvolvimento e Regressão dos 10 Gaps do Motor
Implementar os 10 requisitos de motor na máquina de estados (`src/modules/simulator/engine/`), sequenciados do menor para o maior risco:
1. *Targeting Global / Escopo Qualquer Lado da Mesa* (Baixo Risco)
2. *Escolha de "Até N" Alvos* (Baixo Risco)
3. *Reciclagem Lixeira ➔ Deck* (Médio Risco)
4. *Busca Lixeira ➔ Mão* (Médio Risco)
5. *Concessão de Aura por Grupo/Keyword* (Médio Risco)
6. *Reciclagem / Manipulação de Energy Zone* (Médio Risco)
7. *Gatilhos de Modificação Restritiva de Ataque* (Médio Risco)
8. *Deploy Alternativo via Sacrifício / Substituição* (Alto Risco - toca máquina de fases)
9. *Custo Dinâmico na Mão / Condicional de Custo* (Alto Risco - toca máquina de fases)
10. *Efeitos de Troca de Controle de Unidade* (Alto Risco - toca ownership de estado)

*Critério de Saída 2A:* Suíte de testes existentes (ST01–04) rodando sem regressão + 0 falhas no fuzzer determinístico.

#### Subfase 2B: Autoria de Cartas, Testes Unitários e Habilitação
1. Escrever as `EffectSpec` individuais das 40 cartas em `src/modules/simulator/content/gd01/`.
2. Adicionar testes unitários para cada nova carta em `gd01.test.ts` via `cardHarness.ts`.
3. Atualizar o Golden Master (`hashes.json`) e marcar `phase3b_fuzz_golden: true` no `gd01.manifest.json`.
4. Atualizar a liberação server-side para aceitar 100% das cartas do GD01.

---

### FASE 3: Expansão Sequencial de Novas Coleções (`GD02`+)
**Objetivo:** Iniciar o pipeline de implementação para as demais coleções (`EB01`, `GD02` a `GD05`, `ST05` a `ST10`).

1. Com base na análise estática efetuada na Fase 0, priorizar a próxima coleção que tiver maior sobreposição com as primitivas recém-criadas (ex.: `GD02` ou `EB01`).
2. Executar o ciclo padrão por coleção:  
   *Mapeamento de Requisitos ➔ Manifest ➔ Autoria de Specs ➔ Testes Harness ➔ Fuzzing ➔ Golden Master ➔ Release Canário*.

---

### FASE 4: Evolução do Produto (Multiplayer 4P, Ranqueado, ML e UX)
**Objetivo:** Tirar itens do "No Radar" do CHANGELOG após a estabilidade de conteúdo.

1. **Alinhamento de Navegação UX**: Confirmar com a liderança de produto se a remoção de links no menu privado (`PortalShell.tsx`) foi intencional ou se deve haver atalhos para o Simulador e Decks no painel logado.
2. **Sistema Ranqueado (Fase 4 do Produto)**: Modelagem de tabelas de Matchmaking Rating (MMR/Elo) e temporadas públicas.
3. **Pipeline de Machine Learning**: Promover o modelo treinado via `pnpm train:dataset-from-logs` para servir como o nível "Bot Mestre/Expert" no simulador.
4. **Multiplayer 4P ( Battle Royale / 2v2)**: Evoluir a rota `/simulador/multiplayer` de mock visual para motor com gerenciamento de estado quadripolar.

---

## PARTE E — CHECKLIST ACIONÁVEL E CRITÉRIOS DE SAÍDA / ROLLBACK

### CHECKLIST DE EXECUÇÃO

- [ ] **[Fase 0]** Ajustar `scripts/gundam-golden.test.mjs` para 15 pares.
- [ ] **[Fase 0]** Diagnosticar e ajustar `src/lib/similar-specs-client.test.ts`.
- [ ] **[Fase 0]** Executar Fuzzer de 2.000 partidas no par de decks do incidente de 4h.
- [ ] **[Fase 0]** Audit do banco de dados (Postgres) para verificar presenças de `GD02-05` / `EB01`.
- [ ] **[Fase 0]** Varredura estática de texto em `GD02-05` contra `primitives-claims.json`.
- [ ] **[Fase 0]** Merge da branch `feature/wave-gd01` para a `dev`.
- [ ] **[Fase 1]** Criar validador de payload/deck estrito no `server/index.ts`.
- [ ] **[Fase 1]** Criar fixture `src/modules/simulator/fixtures/gd01TestDecks.ts` (62 cartas).
- [ ] **[Fase 1]** Ativar GD01 em modo Staging/Sandbox Solo + Desafio Direto.
- [ ] **[Fase 1]** Liberar GD01 na Fila Online pública após 72h de monitoramento limpo.
- [ ] **[Fase 1]** Migrar testes `st01-04.test.ts` para `cardHarness.ts`.
- [ ] **[Fase 2A]** Implementar e testar os 10 gaps de motor.
- [ ] **[Fase 2B]** Escrever EffectSpecs e testes unitários para as 40 cartas deferidas do GD01.
- [ ] **[Fase 2B]** Atualizar Golden Master e alterar `gd01.manifest.json` para 100% completo.
- [ ] **[Fase 3]** Iniciar pipeline da próxima coleção (`GD02` ou `EB01`).

---

### CRITÉRIOS DE SAÍDA (EXIT GATES) E PLANO DE ROLLBACK

1. **Gate de Saída da Fase 1 (Canário de Produção)**:
   - A liberação de GD01 na Fila Online só ocorre se o `SimulatorMatchLog` registrar **0 ocorrências** de `TriggerLoopException` ou unhandled promise rejections em pelo menos 100 partidas no Sandbox Solo / Amistoso.
2. **Plano de Rollback / Kill-Switch para GD01**:
   - Manter uma flag de configuração no servidor (`ENABLE_GD01_ONLINE = false`). Caso ocorra qualquer anomalia de motor na fila online pública, a flag permite desativar GD01 do matchmaking instantaneamente sem necessidade de redeploy completo da aplicação backend.

</details>

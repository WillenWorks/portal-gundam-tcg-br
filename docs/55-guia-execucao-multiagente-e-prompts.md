# Guia Operacional de Execução Multi-Agente, Prompts & Validações (v2.1)

> **Documento Canônico de Execução Incremental**  
> Data: 2026-09-17 | Arquiteto & Engenheiro de Software: Willen, Antigravity (Gemini) & Claude CLI  
> Status: Fase 1 & 2 [CONCLUÍDAS - v2.0] | Fase 3 [PRONTA PARA INICIALIZAÇÃO - v2.1]  
> Referências: [docs/54-plano-mestre-evolucao-sistema-e-zero-system.md](54-plano-mestre-evolucao-sistema-e-zero-system.md), [AI_GUIDE.md](../AI_GUIDE.md), [CHANGELOG.md](../CHANGELOG.md)

---

## 0. Histórico de Conclusão das Fases Anteriores (v2.0)

| Fase / Entrega | Status | Branch Integrada | Destaques Técnicos |
|---|---|---|---|
| **Fase 1: Core GD02 + ST05 + ST06** | `[CONCLUÍDO]` | `dev` (`194b781`) | 245 especificações autoritativas de efeitos indexadas no motor. |
| **Fase 1: Formato Bo3 com Sideboard** | `[CONCLUÍDO]` | `dev` (`194b781`) | `SideboardModal.tsx` com timer de 180s, validação estrita (50 cartas, 2 cores, 10 sideboard). |
| **Fase 1: Universe Hub (Zeta & SEED)** | `[CONCLUÍDO]` | `dev` (`194b781`) | Linha do tempo UC e CE com sinopses, fichas técnicas e cards relacionados (`/series`). |
| **Fase 1: Content Hub & Capas IA** | `[CONCLUÍDO]` | `dev` (`194b781`) | CMS administrativo em `/admin/artigos` com parser `[[GD01-001]]` e gerador de capas. |
| **Fase 1: Apoio Comunitário via Pix** | `[CONCLUÍDO]` | `dev` (`194b781`) | `DonateModal.tsx` com QR Code Pix, chave de cópia rápida e mural de apoiadores. |
| **Fase 2: Motor Suíço LGS & TV Display** | `[CONCLUÍDO]` | `dev` (`194b781`) | `swissEngine.ts` (OMW%, OGW%, Bye, Top Cut) e `LgsTvDisplayPage.tsx` na rota `/admin/lgs-tv/:id`. |
| **Fase 2: Zero System Suite (IA Tática)** | `[CONCLUÍDO]` | `dev` (`194b781`) | `computeBurstThreatMatrix`, Sequencing Advisor, Letal, Análise Hipergeométrica, 4 Personas RAG, `ZeroCoachHud.tsx`, `ZeroCopilotDrawer.tsx` e Hub `/zero`. |

---

## 1. Topologia e Divisão de Trabalho da Fase 3 (v2.1)

Para acelerar o ciclo v2.1 com segurança arquitetural absoluta, a operação multi-agente opera dividida em **três frentes paralelas e assíncronas**:

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │               WILLEN (Lead & Arquiteto)                │
                                  │      Direcionamento Estratégico, Aprovação & Merge     │
                                  └──────────────────────────┬─────────────────────────────┘
                                                             │
                    ┌────────────────────────────────────────┼────────────────────────────────────────┐
                    │                                        │                                        │
       ┌────────────▼────────────┐              ┌────────────▼────────────┐              ┌────────────▼────────────┐
       │     TERMINAL 1 (Core)   │              │   TERMINAL 2 (Hub/4P)   │              │  TERMINAL 3 (Foresight) │
       │   ENGINE GD03 & PILOT   │              │   FRONTEND & ARENA 4P   │              │  MONTE CARLO & REGIONAL │
       ├─────────────────────────┤              ├─────────────────────────┤              ├─────────────────────────┤
       │ • Agente: GEMINI        │              │ • Agente: CLAUDE        │              │ • Agente: GEMINI/CLAUDE │
       │   (Antigravity IDE)     │              │   (Claude Code CLI)     │              │   (Data & AI Specialist)│
       │ • Branch:               │              │ • Branch:               │              │ • Branch:               │
       │   feature/wave-gd03-    │              │   feature/hub2-         │              │   feature/foresight-    │
       │   zeropilot             │              │   multiplayer4p         │              │   regional-meta         │
       │ • Foco: GD03 + ST07/08, │              │ • Foco: Hub 00 & WFM,   │              │ • Foco: 10k Monte Carlo,│
       │   Tokens, Alt Deploy,   │              │   Arena 4P Socket.io    │              │   Projeção Tier Shift,  │
       │   Zero Pilot N4 Personas│              │   (2v2 & FFA Playmats)  │              │   Painel Metagame Reg.  │
       └─────────────────────────┘              └─────────────────────────┘              └─────────────────────────┘
```

### 1.1 Matriz de Aptidão da Fase 3

| Frente / Terminal | Agente Recomendado | Por que este agente é o melhor? |
|---|---|---|
| **Terminal 1: Core GD03 + ST07/08 & Zero Pilot N4** | **Google Gemini** (via Antigravity IDE) | • **Domínio de Álgebra de Regras e Efeitos Complexos**: GD03 introduz custos alternativos de deploy e manipulação de tokens que exigem TDD formal sem regressões no motor autoritativo.<br>• **Integração Profunda com Zero System**: Gemini retém a arquitetura do `zeroTerminalService.ts` e pode construir o algoritmo de montagem dinâmica de counter-decks das 4 Personas. |
| **Terminal 2: Universe Hub Wave 2 & Arena Multiplayer 4P** | **Anthropic Claude** (via Claude Code CLI) | • **Composição de Telas 4P Complexas**: Renderizar múltiplos playmats (2v2 e FFA) com animações fluidas, zoom tático e responsividade exige o refinamento visual avançado do Claude.<br>• **Riqueza Narrativa de Gundam 00 e WFM**: Criação de sinopses imersivas, bio dos Meisters e Suletta Mercury com respeito absoluto ao cânone. |
| **Terminal 3: Zero Foresight Monte Carlo & Regional Meta** | **Google Gemini / Claude** (Data & AI) | • **Computação Estocástica Massiva**: Execução eficiente de simulações Monte Carlo (10.000 iterações em Worker Threads) com cálculo de convergência e desvio padrão.<br>• **Visualização Geoespacial de Metagame**: Interface tática por Estados (SP, RJ, Sul) com filtros por LGS e alertas preditivos de desvio de metagame. |

### Regras de Convivência da Fase 3
1. **Isolamento de Escopo por Arquivo**:
   - O **Terminal 1 (Gemini)** altera **exclusivamente**: `src/modules/simulator/engine/`, `src/modules/simulator/content/gd03/`, `src/modules/simulator/content/st07/`, `src/modules/simulator/content/st08/`, `services/sim-bot/driveBotTurn.mjs` e testes de motor.
   - O **Terminal 2 (Claude)** altera **exclusivamente**: `src/pages/Series*`, `src/pages/multiplayer/`, `src/components/multiplayer/` e rotas Socket de multiplayer 4P em `server/multiplayerStore.ts`.
   - O **Terminal 3 (Data/AI)** altera **exclusivamente**: `server/services/zeroForesightService.ts`, `server/services/regionalMetaService.ts`, `src/pages/RegionalMetaPage.tsx` e componentes de telemetria preditiva.
2. **Branches Isoladas**: Ninguém commita na `dev`. O merge ocorre apenas após validação de tipo (`pnpm check:types`) e suíte de testes verdes (`pnpm test`).

---

## 2. Setup Operacional de Worktrees da Fase 3

O disparo simultâneo dos três terminais é orquestrado pelo script [`scripts/iniciar-fase3.ps1`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/iniciar-fase3.ps1):

| Terminal | Papel | Agente | Branch | Diretório Físico |
|---|---|---|---|---|
| **Terminal 1** | Engine GD03, Tokens, Zero Pilot N4 | **Google Gemini** | `feature/wave-gd03-zeropilot` | `c:\WillenWorks\portal-gundam-tcg-br` (Repo Principal) |
| **Terminal 2** | Universe Hub 2 (00/WFM), Arena 4P (2v2/FFA) | **Anthropic Claude** | `feature/hub2-multiplayer4p` | `..\portal-gundam-tcg-br-worktrees\hub2-multiplayer4p` |
| **Terminal 3** | Zero Foresight (Monte Carlo), Metagame Regional | **Gemini / Claude** | `feature/foresight-regional-meta` | `..\portal-gundam-tcg-br-worktrees\foresight-regional-meta` |

---

## 3. Prompts de Comando para os Agentes da Fase 3

Os prompts canônicos estão salvos individualmente em `scripts/prompts/` para execução programática:

---

### 🟢 Prompt para TERMINAL 1: Core Engine Wave GD03 + ST07/ST08 & Zero Pilot N4
* **Melhor Agente**: **Google Gemini** (via Google Antigravity IDE)  
* **Arquivo Canônico**: [`scripts/prompts/terminal-1-core-gd03-zeropilot.txt`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/prompts/terminal-1-core-gd03-zeropilot.txt)  
* **Branch**: `feature/wave-gd03-zeropilot` | **Diretório**: Repositório Principal  

```text
Você é o Engenheiro Sênior de Regras e Motor de Jogo (Terminal 1) do Portal Gundam TCG BR operando no Google Antigravity (Gemini).
Sua branch de trabalho é: 'feature/wave-gd03-zeropilot' (baseada em 'dev').
Seu escopo exclusivo é o Core Engine com a Wave GD03 + Starter Decks ST07/ST08, as mecânicas de Tokens/Alternative Deploy, e o Zero Pilot Nível 4 (Counter-Decks Dinâmicos por Persona).

Seu Roteiro de Execução em Fases:
1. Ingestão da Wave GD03 + ST07 + ST08:
   - Extrair e catalogar metadados com traduções em pt-BR preservando tokens oficiais em inglês (docs/17-glossario-traducao.md).
   - Implementar CardDefs e EffectSpecs em 'src/modules/simulator/content/gd03/', 'content/st07.ts' e 'content/st08.ts'.
   - Registrar novas primitivas em 'primitives-claims.json'.
2. Mecânicas Avançadas de Motor:
   - Suporte a Tokens de Mobile Suit (criação, ciclo de vida e remoção ao deixar a mesa).
   - Custo Alternativo de Deploy (ex: sacrificar unidades ou descartar cartas como parte do custo de entrada).
3. Zero Pilot Nível 4 (Personas Adaptativas com Anti-Deck):
   - Expandir 'services/sim-bot/driveBotTurn.mjs' e 'zeroTerminalService.ts':
     * Persona Heero Yuy: gera counter-deck cirúrgico focado em controle pesado e remoção direta de peças-chave do jogador.
     * Persona Char Aznable: gera counter-deck agressivo (Red/Zeon Rush) capitalizando em decks lentos.
     * Persona Amuro Ray: gera counter-deck de alta sinergia e resposta em tempo real a Blockers.
     * Persona Treize Khushrenada: gera counter-deck focado em presença de mesa e duelos de alto impacto.

Regras de Ouro Inegociáveis:
- TDD Obrigatório: cada efeito exige teste unitário correspondente no Vitest.
- Keywords oficiais (【Deploy】, 【Attack】, <Blocker>, <Breach>, Lv.X, AP, HP) NUNCA são traduzidas.
- Fuzzing de integridade: 'pnpm gundam:fuzz' (1.000 partidas) e 'pnpm gundam:index' devem terminar 100% verdes.
- Ao concluir, execute 'pnpm check:types' e 'pnpm test', gerando commits semânticos: feat(engine): ..., feat(zeropilot): ...
```

---

### 🎨 Prompt para TERMINAL 2: Universe Hub Wave 2 & Arena Multiplayer 4P
* **Melhor Agente**: **Anthropic Claude** (via Claude Code CLI)  
* **Arquivo Canônico**: [`scripts/prompts/terminal-2-frontend-hub2-multiplayer.txt`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/prompts/terminal-2-frontend-hub2-multiplayer.txt)  
* **Branch**: `feature/hub2-multiplayer4p` | **Diretório**: `..\portal-gundam-tcg-br-worktrees\hub2-multiplayer4p`  

```text
Você é o Dev Sênior Frontend e Especialista de UI/UX (Terminal 2) do Portal Gundam TCG BR operando via Claude Code CLI.
Sua branch de trabalho é: 'feature/hub2-multiplayer4p' (baseada em 'dev').
Seu escopo exclusivo é a expansão do Universe Hub (Wave 2: Gundam 00 e The Witch from Mercury) e a transformação da Arena Multiplayer 4P em engine real Socket.io (2v2 Tag Team e 4P Battle Royale FFA).

Seu Roteiro de Execução em Fases:
1. Universe Hub Wave 2:
   - Expandir 'src/pages/SeriesHubPage.tsx' e 'SeriesDetailPage.tsx' adicionando as timelines:
     * Anno Domini (AD): Mobile Suit Gundam 00 (Celestial Being, Meisters, GN Drives).
     * Ad Stella (AS): Mobile Suit Gundam: The Witch from Mercury (Asticassia Academy, Suletta, Aerial).
   - Enriquecer com fichas técnicas, pilotos, facções e carrossel de cartas integradas do catálogo.
2. Arena Multiplayer 4P Real:
   - Evoluir a rota '/simulador/multiplayer' substituindo o mock visual por arquitetura Socket.io com 4 assentos:
     * Modo 2v2 Tag Team: Duplas com bases/escudos compartilhados e turnos alternados entre pilotos.
     * Modo 4P Battle Royale (Free-for-All): 4 playmats independentes com mira tática em bases adjacentes.
   - Interface com mini-radar da arena, zoom tático no campo focado e chat tático de 4 vias com emotes.

Regras de Ouro:
- Mantenha a identidade militar futurista "Anaheim Hub" com Tailwind CSS v4, Framer Motion e Shadcn/ui.
- Não modifique arquivos de regras de combate em 'src/modules/simulator/engine/' para evitar conflitos com o Terminal 1.
- Garanta total responsividade e execute 'pnpm check:types' e 'pnpm test' antes de cada commit semântico.
```

---

### 📊 Prompt para TERMINAL 3: Zero Foresight & Painel Metagame Regional
* **Melhor Agente**: **Google Gemini / Anthropic Claude** (Dev Sênior Data/AI)  
* **Arquivo Canônico**: [`scripts/prompts/terminal-3-foresight-regional-meta.txt`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/prompts/terminal-3-foresight-regional-meta.txt)  
* **Branch**: `feature/foresight-regional-meta` | **Diretório**: `..\portal-gundam-tcg-br-worktrees\foresight-regional-meta`  

```text
Você é o Engenheiro Sênior de Dados e Inteligência Artificial (Terminal 3) do Portal Gundam TCG BR.
Sua branch de trabalho é: 'feature/foresight-regional-meta' (baseada em 'dev').
Seu escopo exclusivo é o Zero Foresight (Simulador Preditivo Monte Carlo de 10.000 iterações) e o Painel de Metagame Regional Geográfico.

Seu Roteiro de Execução em Fases:
1. Motor Zero Foresight (Simulação Monte Carlo):
   - Criar 'server/services/zeroForesightService.ts':
     * Executar simulações estocásticas massivas (10.000 iterações em background worker) para prever Tier Shift antes de grandes torneios.
     * Calcular taxas de conversão para Top Cut baseadas em arquétipos e matchup spread.
     * Gerar relatórios preditivos de metagame ("Se Red Rush subir 15%, Blue Control sobe 8% em winrate").
2. Painel de Metagame Regional Geográfico:
   - Criar 'src/pages/RegionalMetaPage.tsx' e serviço 'server/services/regionalMetaService.ts':
     * Filtros geográficos: País -> Estado -> Cidade -> Loja Física Parceira (LGS).
     * Métricas locais de cartas mais jogadas, arquétipos dominantes e anomalias regionais.
     * Alertas do Zero System contextualizados por região ("Alerta LGS SP: 42% do meta local usa Blockers verdes").

Regras de Ouro:
- Simulações pesadas devem rodar de forma não bloqueante (Worker Threads / Chunks com `setImmediate`).
- Não modifique o motor de combate puro 'engine/ruleEngine.ts' nem o frontend de séries.
- Valide integridade de tipos com 'pnpm check:types' e testes em Vitest.
```

---

## 4. Matriz de Validações Automatizadas da Fase 3

| Teste / Gate | Comando | Critério de Aceitação |
|---|---|---|
| **Tipagem TypeScript Estrita** | `pnpm check:types` | Zero erros (`tsc -b`). |
| **Suíte Completa Vitest** | `pnpm test` | Todos os testes de unidade e integração aprovados. |
| **Indexação do Catálogo** | `pnpm gundam:index` | specs-signatures.json atualizado com GD03, ST07 e ST08. |
| **Fuzzing Anti-Loop GD03** | `pnpm gundam:fuzz` | 1.000 partidas self-play sem loops ou falhas. |
| **Golden Master Deterministico** | `pnpm gundam:golden` | Hashes de estado final idênticos. |
| **Testes Monte Carlo Zero Foresight** | `pnpm test server/services/zeroForesightService.test.ts` | Convergência estatística válida em 10k iterações. |

---

## 5. Checklists de Validação da Fase 3 [CONCLUÍDO - v2.1]

### Checklist 1: Wave GD03, Tokens & Zero Pilot N4
- [x] No Deckbuilder, criar deck contendo cartas de GD03, ST07 ou ST08 (132 cartas de GD03 + ST07/ST08 validadas).
- [x] Iniciar partida solo contra o Bot selecionando a Persona "Heero Yuy (Nível 4)" ou "Treize Khushrenada (Nível 4)".
- [x] Verificar a geração automática pelo bot de um counter-deck sob medida contra a estratégia do jogador (`zeroCounterDeckBuilder.ts`).
- [x] Ativar efeito gerador de Token de Mobile Suit e verificar auto-exílio ao deixar o campo (`events.ts`, Comprehensive Rules 1.8.0).

### Checklist 2: Universe Hub Wave 2 & Arena 4P
- [x] Acessar `/series` e verificar cards em destaque de *Gundam 00* e *The Witch from Mercury* com carrosséis de cartas e fichas de facções.
- [x] Acessar `/simulador/multiplayer` e criar sala 2v2 Tag Team (`server/simulatorSocket4p.ts`).
- [x] Conectar 4 navegadores/abas nos assentos A, B, C e D e verificar alternância correta de turnos e status compartilhados no radar tático.

### Checklist 3: Zero Foresight & Metagame Regional
- [x] Endpoint `/api/simulator/zero/foresight/simulate` para simulação estocástica de 10.000 iterações Monte Carlo com cálculo de conversão Top Cut.
- [x] Acessar o painel de Metagame Regional (`/metagame/regional`) com radar chart comparando distribuição de cores vs. média nacional, staples e alertas táticos.

---

## 6. Fluxo de Sincronização, PR e Merge da Fase 3

```mermaid
gitGraph
   commit id: "dev v2.0 (Estável)"
   branch "feature/wave-gd03-zeropilot"
   branch "feature/hub2-multiplayer4p"
   branch "feature/foresight-regional-meta"
   checkout "feature/wave-gd03-zeropilot"
   commit id: "T1: Ingestão GD03/ST07/08"
   commit id: "T1: Tokens & Alt Deploy"
   checkout "feature/hub2-multiplayer4p"
   commit id: "T2: Hub 00 & WFM"
   commit id: "T2: Arena 4P Socket.io"
   checkout "feature/foresight-regional-meta"
   commit id: "T3: Monte Carlo 10k Worker"
   commit id: "T3: Painel Regional LGS"
   checkout "feature/wave-gd03-zeropilot"
   commit id: "T1: Zero Pilot N4 Personas"
   checkout dev
   merge "feature/hub2-multiplayer4p" id: "Merge T2 -> dev"
   merge "feature/foresight-regional-meta" id: "Merge T3 -> dev"
   checkout "feature/wave-gd03-zeropilot"
   merge dev id: "Sync dev -> T1"
   checkout dev
   merge "feature/wave-gd03-zeropilot" id: "Merge T1 -> dev (Release v2.1)"
```

1. **Sincronização Diária**: O Terminal 1 sincroniza `git merge dev` regularmente para absorver as novidades de frontend e telemetria.
2. **Merge de T2 (Frontend) e T3 (Data/AI)**: Ocorrem sequencialmente em `dev` após testes unitários e validação de types.
3. **Merge de T1 (Core Engine)**: Conduzido após validação estrita de Golden Master (`pnpm gundam:golden`) e Fuzzing (`pnpm gundam:fuzz`).
4. **Deploy Final**: Promoção da branch `dev` com tag `v2.1.0`.

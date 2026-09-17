# Guia Operacional de Execução Multi-Agente, Prompts & Validações (v2.0)

> **Documento Canônico de Execução Incremental**  
> Data: 2026-09-16 | Arquiteto & Engenheiro de Software: Willen, Antigravity & Claude CLI  
> Status: Pronto para Inicialização  
> Referências: [docs/54-plano-mestre-evolucao-sistema-e-zero-system.md](54-plano-mestre-evolucao-sistema-e-zero-system.md), [AI_GUIDE.md](../AI_GUIDE.md), [PLANEJAMENTO.md](../PLANEJAMENTO.md)

---

## 1. Topologia e Divisão de Trabalho Multi-Agente

Para viabilizar o desenvolvimento paralelo sem risco de conflito no motor autoritativo de regras do simulador, a equipe de desenvolvimento opera dividida em **terminais dedicados, git worktrees isoladas e agentes de IA especializados**:

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │               WILLEN (Lead & Arquiteto)                │
                                  │      Direcionamento Estratégico, Aprovação & Merge     │
                                  └──────────────────────────┬─────────────────────────────┘
                                                             │
                    ┌────────────────────────────────────────┴────────────────────────────────────────┐
                    │                                                                                 │
       ┌────────────▼────────────┐                                                       ┌────────────▼────────────┐
       │     TERMINAL 1 (Core)   │                                                       │   TERMINAL 2 (Features) │
       │   MOTOR, REGRAS & IA    │                                                       │   FRONTEND & CONTEÚDO   │
       ├─────────────────────────┤                                                       ├─────────────────────────┤
       │ • Agente: GEMINI        │                                                       │ • Agente: CLAUDE        │
       │   (Antigravity IDE)     │                                                       │   (Claude Code CLI)     │
       │ • Branch: feature/gd02  │                                                       │ • Branch: feature/hub   │
       │ • Dir: Repo Principal   │                                                       │ • Dir: Worktree /hub    │
       │ • Foco: Ingestão GD02,  │                                                       │ • Foco: Universe Hub,   │
       │   Engine, Bo3, Suíço,   │                                                       │   Editorial + Capas,    │
       │   Zero System & MCTS    │                                                       │   Pastas e Modal Pix    │
       └─────────────────────────┘                                                       └─────────────────────────┘
```

### 1.1 Matriz de Aptidão e Especialização de Agentes (Por que Gemini no Core e Claude no Frontend?)

Cada modelo de IA possui vantagens cognitivas distintas. O pipeline do Portal Gundam TCG BR tira proveito do ápice de cada um:

| Frente / Terminal | Agente Recomendado | Por que este agente é o melhor? |
|---|---|---|
| **Terminal 1: Core Engine, GD02, Bo3 & Zero System** | **Google Gemini** (via Antigravity IDE) | • **Raciocínio Algébrico e Lógica Formal**: Motor de regras exige TDD rigoroso de pilha, custos de energia, resolução determinística de triggers e álgebra de dano sem alucinações.<br>• **Janela de Contexto Massiva (1M+ tokens)**: O Gemini retém todo o catálogo de regras (`ruleEngine.ts`, `primitives-claims.json`, `CardDefs` e `17-glossario-traducao.md`) simultaneamente sem esquecimento.<br>• **Integração Nativa Zero System**: O módulo de inteligência tática consome nativamente o Gemini SDK (`@google/genai`).<br>• **Execução no IDE**: O Antigravity IDE possui integração profunda com terminal, sistema de arquivos e background tasks para fuzzing de 1.000 partidas (`pnpm gundam:fuzz`). |
| **Terminal 2: Universe Hub, Editorial & Social** | **Anthropic Claude** (via Claude Code CLI) | • **Refinamento Estético e UI/UX**: O Claude se destaca na construção de interfaces elegantes e responsivas com Tailwind CSS v4, Glassmorphism militar (Anaheim Hub), Shadcn/ui e Framer Motion.<br>• **Fluidez Textual e Lore**: Ao redigir sinopses de séries (Zeta Gundam, SEED) e artigos do Content Hub, gera textos em pt-BR ricos, imersivos e fiéis à franquia.<br>• **Componentização React sem Overhead**: Cria páginas e componentes complexos com contratos TypeScript limpos e sem poluição visual. |
| **Terminal 3: Torneios LGS & TV Display (Opcional)** | **Claude Code CLI** ou **Gemini** | • **Claude**: Excelente para layout fullscreen tático de lojas físicas (`LgsTvDisplayPage.tsx`).<br>• **Gemini**: Excelente para o algoritmo matemático de pareamento suíço, cálculo de tie-breakers (OMW% e OGW%) e prevenção de rematches. |

### Regras de Ouro da Convivência Multi-Agente
1. **Isolamento de Escopo por Arquivo**:
   - O **Terminal 1 (Gemini / Antigravity)** altera **exclusivamente**: `src/modules/simulator/engine/`, `src/modules/simulator/content/`, `server/matchStore.ts`, `server/services/zero*`, `server/services/swiss*` e testes de motor.
   - O **Terminal 2 (Claude / Claude Code)** altera **exclusivamente**: `src/pages/`, `src/components/`, `src/lib/`, rotas REST de conteúdo em `server/index.ts` (sem tocar no socket do simulador) e estilos visuais.
2. **Nenhum Agente commita direto na `dev` ou `main`**:
   - Cada terminal commita em sua branch (`feature/wave-gd02` e `feature/universe-hub-editorial`).
   - O merge para `dev` só ocorre após suíte de testes verdes (`pnpm check:types` e `pnpm test`).

---

## 2. Setup Operacional dos Worktrees & Automação de Disparo

O projeto automatiza toda a inicialização através do script [`scripts/iniciar-paralelo.ps1`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/iniciar-paralelo.ps1) e do atalho [`iniciar-paralelo.bat`](file:///c:/WillenWorks/portal-gundam-tcg-br/iniciar-paralelo.bat).

### 2.1 Mapeamento de Diretórios

| Terminal | Papel | Agente | Branch | Diretório Físico |
|---|---|---|---|---|
| **Terminal 1** | Core, Engine, GD02, Bo3, Zero System | **Google Gemini** | `feature/wave-gd02` | `c:\WillenWorks\portal-gundam-tcg-br` (Repo Principal) |
| **Terminal 2** | Universe Hub, Editorial, Capas IA, Pix | **Anthropic Claude** | `feature/universe-hub-editorial` | `..\portal-gundam-tcg-br-worktrees\universe-hub-editorial` |
| **Terminal 3 (Opcional)** | Torneios LGS, Suíço & TV Display | **Claude** ou **Gemini** | `feature/lgs-tournaments` | `..\portal-gundam-tcg-br-worktrees\lgs-tournaments` |

### 2.2 Fluxo Automatizado de Inicialização

Ao executar `iniciar-paralelo.bat` ou `.\scripts\iniciar-paralelo.ps1`:
1. **Provisionamento de Worktrees**: O PowerShell verifica ou cria as pastas isoladas em `..\portal-gundam-tcg-br-worktrees\`, copia os arquivos `.env` essenciais e executa `pnpm install` se necessário.
2. **Disparo do Terminal 1 (Gemini / Antigravity)**:
   - O script localiza o `antigravity-ide.cmd` e invoca automaticamente uma sessão em modo agente (`chat -r -m agent`) carregando o prompt canônico de [`scripts/prompts/terminal-1-antigravity-core.txt`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/prompts/terminal-1-antigravity-core.txt) com o contexto deste documento.
3. **Disparo do Terminal 2 (Claude Code CLI)**:
   - O script abre uma aba no **Windows Terminal** (ou janela de PowerShell) apontada para o diretório isolado da worktree e dispara o comando `claude` já injetando o prompt canônico de [`scripts/prompts/terminal-2-claude-hub.txt`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/prompts/terminal-2-claude-hub.txt).
4. **Terminal 3 (Torneios LGS - Opcional)**:
   - Dispara uma terceira aba com o Claude Code já carregando [`scripts/prompts/terminal-3-claude-tournaments.txt`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/prompts/terminal-3-claude-tournaments.txt).

---

## 3. Prompts de Comando para os Agentes (Prompt Engineering)

Os prompts canônicos estão salvos individualmente no diretório [`scripts/prompts/`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/prompts/) para leitura programática e cópia manual quando necessário:

---

### 🟢 Prompt para TERMINAL 1: Core Engine, GD02, Bo3 & Zero System
* **Melhor Agente**: **Google Gemini** (via Google Antigravity IDE)  
* **Arquivo Canônico**: [`scripts/prompts/terminal-1-antigravity-core.txt`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/prompts/terminal-1-antigravity-core.txt)  
* **Branch**: `feature/wave-gd02` | **Diretório**: Repositório Principal  

```text
Você é o Engenheiro Sênior de Regras e Motor de Jogo (Terminal 1) do Portal Gundam TCG BR operando no Google Antigravity (Gemini).
Sua branch de trabalho é obrigatoriamente: 'feature/wave-gd02'.
Seu escopo exclusivo é o Core Engine, a Wave GD02 + ST06, o Formato Bo3 com Sideboard e o Zero System.

Seu Roteiro de Execução em Fases:
1. Wave GD02 + ST06 no Motor:
   - Ingestão dos metadados e tradução pt-BR (preservando tokens oficiais em inglês via docs/17-glossario-traducao.md).
   - Criação dos CardDefs e EffectSpecs em 'src/modules/simulator/content/gd02/' fatiados por cor (unitsBlue, unitsGreen, unitsRed, unitsWhite, pilots, commands, bases) e 'content/st06.ts'.
   - Registrar novas primitivas e filtros em 'primitives-claims.json'. Não criar primitivas ad-hoc sem documentar.
2. Formato Competitivo Bo3 com Sideboard:
   - Criar 'src/modules/simulator/engine/sideboard.ts' com validação estrita (50 cartas principais, máx. 2 cores, máx. 4 cópias, até 10 cartas no Sideboard).
   - Implementar o estado de transição entre jogos 1, 2 e 3 com timer de 180 segundos no 'matchStore.ts'.
3. Zero System (Inteligência Tática):
   - Implementar o 'server/services/zeroTerminalService.ts' usando o SDK híbrido (Gemini 1.5 via @google/genai e Claude via @anthropic-ai/sdk).
   - Implementar o Nível 4 do bot em 'services/sim-bot/driveBotTurn.mjs' (Personas de Piloto que montam dinamicamente decks anti-meta baseados no deck do jogador).

Regras de Ouro Inegociáveis:
- TDD Mandatório: todo efeito novo exige teste que falha antes e passa depois (vitest).
- Keywords oficiais (【Deploy】, 【Attack】, <Blocker>, <Breach>, Lv.X, AP, HP) NUNCA são traduzidas.
- Fuzzing e Golden Master: 'pnpm gundam:fuzz' (1.000 partidas) e 'pnpm gundam:golden' devem permanecer 100% verdes.
- Nunca edite páginas de UI de conteúdo fora do simulador para evitar conflito com o Terminal 2.
- Ao concluir cada lote, rode 'pnpm check:types' e 'pnpm test', gerando commits semânticos: feat(engine): ..., fix(simulator): ...
```

---

### 🎨 Prompt para TERMINAL 2: Frontend, Universe Hub, Editorial & Social
* **Melhor Agente**: **Anthropic Claude** (via Claude Code CLI)  
* **Arquivo Canônico**: [`scripts/prompts/terminal-2-claude-hub.txt`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/prompts/terminal-2-claude-hub.txt)  
* **Branch**: `feature/universe-hub-editorial` | **Diretório**: `..\portal-gundam-tcg-br-worktrees\universe-hub-editorial`  

```text
Você é o Dev Sênior Frontend e Designer de Interfaces (Terminal 2 - Claude CLI) do Portal Gundam TCG BR.
Sua branch de trabalho é obrigatoriamente: 'feature/universe-hub-editorial'.
Seu escopo exclusivo é o Universe Hub (Séries), Módulo Editorial de Artigos, Capas por IA, Pastas de Coleção e Apoio Comunitário via Pix.

Seu Roteiro de Execução em Fases:
1. Universe Hub (Séries & Lore em Waves):
   - Criar as páginas 'src/pages/SeriesHubPage.tsx' e 'SeriesDetailPage.tsx' consumindo TaxonomyEntry (kind: SOURCE_TITLE).
   - Implementar a Wave 1 de Séries: Mobile Suit Zeta Gundam e Mobile Suit Gundam SEED (sinopse, mobile suits, pilotos, curiosidades e grid de cartas relacionadas).
2. Módulo Editorial de Artigos (Content Hub):
   - Criar a página pública 'src/pages/ArticlesPage.tsx' e leitor 'ArticleDetailPage.tsx'.
   - Markdown Parser enriquecido com hovercard de cartas ao detectar sintaxe [[GD01-001]] ou [[Nome da Carta]].
   - CMS Administrativo 'src/pages/admin/AdminArticlesPage.tsx' com preview split-screen e gerador de capas temáticas (Nano Banana / AI Prompt generator) integrando artes oficiais.
3. Apoio Comunitário Imediato via Pix:
   - Criar o componente 'src/components/support/CommunitySupportModal.tsx' com QR Code Pix legível, chave copia-e-cola, mural de apoiadores e insígnia de perfil.
4. Pastas de Coleção Públicas (Binders):
   - Criar 'src/pages/PublicBinderPage.tsx' com modo Fichário 3D, tags "Para Troca" e "Desejo" e link de compartilhamento rápido.

Regras de Ouro Inegociáveis:
- Mantenha a identidade visual militar/sci-fi "Anaheim Hub" com Tailwind CSS v4, shadcn/ui e framer-motion.
- Viewport adaptativo: garanta que tudo seja 100% responsivo em Desktop Full HD, Notebooks e Mobile.
- Não altere arquivos do motor puro em 'src/modules/simulator/engine/' para evitar conflito com o Terminal 1.
- Valide visualmente no navegador com 'pnpm dev' e garanta build limpo com 'pnpm check:types'.
- Ao concluir cada bloco, gere commits semânticos: feat(hub): ..., feat(articles): ..., feat(social): ...
```

---

### 🏆 Prompt para TERMINAL 3 (Opcional): Módulo de Torneios LGS & Suíço
* **Melhor Agente**: **Claude Code CLI** ou **Google Gemini**  
* **Arquivo Canônico**: [`scripts/prompts/terminal-3-claude-tournaments.txt`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/prompts/terminal-3-claude-tournaments.txt)  
* **Branch**: `feature/lgs-tournaments` | **Diretório**: `..\portal-gundam-tcg-br-worktrees\lgs-tournaments`  

```text
Você é o Engenheiro de Software Especialista em Sistemas de Torneios (Terminal 3) do Portal Gundam TCG BR.
Sua branch de trabalho é obrigatoriamente: 'feature/lgs-tournaments'.
Seu escopo é o Motor de Pareamento Suíço e o Painel de Loja (LGS TV Display).

Seu Roteiro de Execução em Fases:
1. Motor Suíço Determinístico:
   - Implementar 'server/services/swissTournamentEngine.ts' baseado nos modelos existentes (HostedEvent, HostedEventRound, HostedEventMatch).
   - Algoritmo de pareamento por pontuação com prevenção estrita de rematches e resolução de BYE para número ímpar.
   - Cálculo oficial de Tie-Breakers: OMW% (Opponent Match Win %) e OGW% (Opponent Game Win %).
   - Suporte a corte para Top Cut (Top 4 / Top 8 / Top 16) com chaveamento eliminatório (Single Elimination).
2. Painel LGS e TV Display:
   - Criar a página fullscreen 'src/pages/tournaments/LgsTvDisplayPage.tsx' otimizada para monitores e projetores de lojas físicas (tabela de pairings, número de mesa, classificação ao vivo e cronômetro de rodada regressivo de 50 minutos com alerta sonoro).
   - Check-in de jogadores via QR Code com travamento de deck (DeckSnapshot).

Regras de Ouro:
- Testes unitários completos do algoritmo suíço em 'swissTournamentEngine.test.ts'.
- Valide build com 'pnpm check:types' e gere commits semânticos: feat(tournaments): ...
```

---

## 4. Matriz de Validações Automatizadas (CI & Comandos)

Cada fase do desenvolvimento possui comandos de verificação automatizada que **devem passar com 100% de sucesso** antes de qualquer PR para `dev`:

| Teste / Gate | Comando | Critério de Aceitação |
|---|---|---|
| **Tipagem TypeScript** | `pnpm check:types` | Zero erros em modo estrito (`tsc -b`). |
| **Suíte Geral Vitest** | `pnpm test` | Todos os testes unitários e de integração aprovados. |
| **Cobertura de Cartas** | `pnpm gundam:coverage:gate --sets=GD02,ST06` | Zero cartas "faltando" ou sem spec implementada. |
| **Fuzzing Anti-Loop** | `pnpm gundam:fuzz` | 1.000 partidas self-play sem `TriggerLoopException` ou crash. |
| **Golden Master** | `pnpm gundam:golden` | Hashes de estado final determinísticos idênticos ao esperado. |
| **Testes de Sideboard** | `pnpm test src/modules/simulator/engine/sideboard.test.ts` | Validações de 50 cartas, 2 cores e 10 cartas no Sideboard. |
| **Testes do Suíço** | `pnpm test server/services/swissTournamentEngine.test.ts` | Pareamento sem rematches, BYE correto e tie-breakers precisos. |

---

## 5. Checklists de Validação Manual (User Experience & QA)

Além dos testes automatizados, o Willen e os agentes devem rodar este roteiro de verificação manual no navegador:

### Checklist 1: Partida Competitiva Bo3 (Simulador)
- [ ] Criar um deck no Hangar contendo 50 cartas principais + 10 cartas no Sideboard.
- [ ] Entrar em partida no simulador (Modo Amistoso ou Treino) e selecionar o formato "Melhor de 3 (Bo3)".
- [ ] Vencer o Jogo 1 (reduzir vida/escudos do oponente a 0).
- [ ] Verificar a transição automática para a tela de **Sideboard Tático**:
  - [ ] Cronômetro de 180 segundos visível e decrementando.
  - [ ] Interface permitindo mover cartas entre Sideboard e Deck Principal.
  - [ ] Trava de validação: botão "Pronto" só habilita se o deck final tiver exatamente 50 cartas respeitando cores e regras de cópias.
- [ ] Confirmar o Sideboard e verificar o início do Jogo 2 com os decks reconfigurados e placar indicando `1 x 0`.

### Checklist 2: Universe Hub (Séries & Lore)
- [ ] Acessar `/series` na navegação principal:
  - [ ] Cards de destaque com banner de *Zeta Gundam* e *Gundam SEED*.
  - [ ] Filtro por linha do tempo (UC, CE, etc.).
- [ ] Acessar `/series/mobile-suit-zeta-gundam`:
  - [ ] Ficha técnica da série, sinopse, pilotos e mobile suits lendários.
  - [ ] Carrossel/Grid de cartas do TCG vinculadas à série carregando com imagens em alta resolução.
  - [ ] Clique em uma carta abre o inspetor de detalhes normalmente.

### Checklist 3: Módulo Editorial & Capas Nano Banana
- [ ] Acessar o painel administrativo em `/admin/artigos` (logado como ADMIN):
  - [ ] Criar novo artigo com título, categoria `GUIDE` e conteúdo Markdown.
  - [ ] Inserir a tag de carta `[[GD01-001]]` e tag de deck `[[deck:cuid_do_deck]]` no texto.
  - [ ] Clicar no botão "Gerar Capa por IA (Nano Banana)":
    - [ ] Selecionar o estilo "Tático Anaheim / Blueprint Militar".
    - [ ] Validar preview da capa gerada e salvar como imagem do post.
  - [ ] Salvar como rascunho e em seguida publicar.
- [ ] Acessar a página pública `/artigos` e abrir o artigo recém-criado:
  - [ ] Passar o mouse sobre `[[GD01-001]]` e verificar a abertura do hovercard com imagem e efeito traduzido em pt-BR.
  - [ ] Widget de deck interativo exibindo curva e botão de cópia.

### Checklist 4: Apoio Comunitário via Pix
- [ ] Clicar no botão "Apoiar o Projeto" na barra superior ou rodapé:
  - [ ] Modal abre com animação suave de vidro (glassmorphism).
  - [ ] QR Code Pix exibido nítido em tamanho adequado para leitura na câmera de celular.
  - [ ] Botão "Copiar Chave Pix" copia com 1 clique e exibe feedback de sucesso ("Chave copiada!").
  - [ ] Mural de Apoiadores do mês exibindo os avatares dos pilotos que contribuíram.

### Checklist 5: Torneio Suíço LGS & TV Display
- [ ] Criar um evento de teste em `/admin/torneios` com 8 participantes cadastrados.
- [ ] Clicar em "Iniciar Torneio (Pareamento Suíço)":
  - [ ] Rodada 1 gerada com 4 mesas balanceadas.
- [ ] Abrir a rota `/torneios/:id/tv-display` em aba anônima (simulando a TV da loja):
  - [ ] Tela cheia escura de alto contraste com lista das 4 mesas (Nome A vs Nome B).
  - [ ] Cronômetro de rodada regressivo de 50:00 rodando no topo com cores táticas (Verde > Amarelo nos 10 min > Vermelho nos 5 min).
- [ ] Lançar os resultados da Rodada 1 no painel e gerar Rodada 2:
  - [ ] O algoritmo emparceira vencedores contra vencedores sem repetir nenhum confronto anterior.
  - [ ] Tabela de classificação atualizada exibindo pontos e OMW%.

---

## 6. Fluxo de Sincronização, PR e Merge

```mermaid
gitGraph
   commit id: "dev (Base Estável)"
   branch "feature/wave-gd02"
   branch "feature/universe-hub-editorial"
   checkout "feature/wave-gd02"
   commit id: "T1: Ingestão GD02/ST06"
   commit id: "T1: Sideboard Bo3 Engine"
   checkout "feature/universe-hub-editorial"
   commit id: "T2: Universe Hub Zeta/Seed"
   commit id: "T2: Artigos CMS + Nano Banana"
   commit id: "T2: Modal Pix Apoio"
   checkout "feature/wave-gd02"
   commit id: "T1: Zero System Persona Adaptativa"
   checkout dev
   merge "feature/universe-hub-editorial" id: "Merge T2 -> dev"
   checkout "feature/wave-gd02"
   merge dev id: "Sync dev -> T1"
   checkout dev
   merge "feature/wave-gd02" id: "Merge T1 -> dev (Release v2.0)"
```

1. **Sincronização Diária**: O Terminal 1 faz `git merge dev` regularmente para absorver as novidades de frontend do Terminal 2 sem quebrar o motor.
2. **Merge de T2 (Frontend) em `dev`**: Roda primeiro, pois adiciona apenas páginas novas e componentes sem interferir no simulador.
3. **Merge de T1 (Engine) em `dev`**: Executado após validação rigorosa de Golden Master e Fuzzing com aprovação do Willen.
4. **Deploy Final (`dev` -> `main`)**: Dispara os pipelines automáticos de build no Render (Backend Web Service) e Vercel (Frontend).

# Arquitetura e Plano Mestre de Desenvolvimento: Gundam TCG BR (Pós-v1.0)

Este plano operacionaliza e detalha todas as diretrizes do arquivo `Instruções.txt`, integrando o documento canônico `PLANEJAMENTO.md`, as evidências e melhorias apontadas no `Feedback.pdf`, e a auditoria técnica da base de código atual.

---

## User Review Required

> [!IMPORTANT]
> **Estratégia de Branches e Paralelismo**:
> - **Branch `dev`**: Base ativa. Receberá as correções pontuais de plataforma (Deckbuilder: Curva de nível e layout de capa de deck do `Feedback.pdf`), o pipeline de Tradução PT-BR e as Waves de cartas (ST03 e ST04) para manter o simulador atual imediatamente alimentado.
> - **Branch `feature/simulator-websocket`**: Derivada de `dev`. Conterá a migração do transporte SSE + HTTP Polling para WebSocket bidirecional nativo, novo lobby, convites diretos por link/amigos e fila de pareamento.
> - **Branch `feature/simulator-layout`**: Derivada de `dev`. Conterá o overhaul visual do tabuleiro (ArenaPlaymat, viewport adaptativo, microinterações, resolução de todos os problemas ergonômicos do `Feedback.pdf`).
> - Sincronização contínua: `dev` será mergeada periodicamente nas duas branches de feature para que ambas sempre testem com as cartas e regras mais recentes.

> [!NOTE]
> **Guia para IA e Claude Code**:
> Criaremos na raiz o arquivo `AI_GUIDE.md` contendo a especificação arquitetural, fluxo de trabalho, convenções de código/commits e checklists atômicos com caixas de seleção (`[ ]` / `[x]`). Qualquer IA ou agente poderá executar uma tarefa específica e checar a caixa correspondente sem perder o contexto geral.

---

## Análise e Planejamento: RAG e MCPs para Desenvolvimento Contínuo

### 1. Papel do RAG (Retrieval-Augmented Generation)

O RAG atuará em duas frentes fundamentais do projeto:

1. **Pipeline de Tradução Consistente de Efeitos (`effectPt`)**:
   - **Corpus de Referência**: Indexação de `docs/17-glossario-traducao.md`, regras oficiais (`Comprehensive Rules`), lista de 88+ rulings oficiais e as cartas já homologadas de ST01 e ST02.
   - **Funcionamento**: Ao traduzir qualquer carta (ex: ST03, ST04 ou futuras coleções), o pipeline consulta via RAG os fragmentos de regras e traduções anteriores com maior similaridade semântica. Isso assegura que o vocabulário permaneça rigorosamente padronizado e que palavras-chave (`【Deploy】`, `<Blocker>`, `Lv.X`, `AP`, `HP`) nunca sejam traduzidas acidentalmente.
2. **Auditoria e Geração de `EffectSpec` para Novas Waves**:
   - **Treinamento de Regras do Motor**: Um agente munido de RAG recupera `EffectSpecs` e `CardDefs` existentes em `content/st01.ts` e `content/st02.ts` que possuam gatilhos ou efeitos semelhantes.
   - Ao receber o texto em inglês de uma carta inédita, o RAG sugere a combinação exata de primitivas (`PrimitiveCall.op`) ou aponta com precisão quando uma mecânica exige uma nova primitiva no motor (`engine/effectSpec.ts`), prevenindo a criação de casos especiais isolados.

### 2. Papel dos MCPs (Model Context Protocol) para Agentes Ativos

Para otimizar o desenvolvimento contínuo sem estourar o contexto dos modelos nos terminais de IA:

1. **MCPs de Desenvolvimento Ativo (Já existentes / Recomendados)**:
   - **Postgres / Supabase MCP**: Permite ao agente inspecionar a tabela `CardModel`, verificar integridade de `effectPt` e testar queries de metagame em tempo de desenvolvimento.
   - **Git MCP**: Automatização de commits convencionais e trocas de contexto entre branches com segurança.
   - **Filesystem & DevTools MCP**: Inspeção de layout, responsividade e DOM em navegadores reais.
2. **Servidor MCP Customizado do Gundam TCG (`scripts/mcp-gundam-engine.mjs`)**:
   - Criação de um servidor MCP local expondo ferramentas operacionais:
     - `get_card_details(cardCode)`: Retorna os dados completos do card e rulings associados.
     - `search_rules(term)`: Busca instantânea nas Comprehensive Rules e Glossário.
     - `run_card_suite(deckCode)`: Executa especificamente os testes de um starter deck (`vitest run content/st03.test.ts`) e devolve os erros formatados.
   - **Benefício**: Em vez de ler arquivos de 50KB a cada iteração, os agentes consultam ferramentas atômicas via MCP, acelerando a execução e reduzindo o consumo de tokens em mais de 70%.

---

## Comportamento e Desenvolvimento Visual do Simulador

O simulador terá como norte os padrões de **Master Duel**, **Magic Arena**, **Hearthstone**, **Wing Table** e **Mobile Suit Arena**, respeitando a ergonomia do playmat oficial:

### 1. Viewport & Responsividade Adaptativa
- **Zero Scroll de Página**: Todo o tabuleiro (`ArenaPlaymat`) é mantido em uma viewport fixa sem scroll horizontal ou vertical.
- **Escalabilidade Dinâmica (`useArenaScale`)**: O container central utiliza escala vetorial (`transform: scale(...)` ou CSS Grid responsivo com unidades `cqw` / `vh`), preservando a proporção exata do playmat de Gundam TCG seja em monitores 1080p, Ultrawide (21:9), notebooks compactos ou dispositivos móveis em modo paisagem (com prompt automático para girar a tela caso esteja em retrato).

### 2. Resolução Completa dos Problemas de HUD (`Feedback.pdf`)
- **Aumento e Clareza das Cartas**: Ajuste no piso de `--card-w` para garantir que as cartas permaneçam legíveis e fáceis de interagir em monitores Full HD.
- **Remoção do Botão "Olhinho"**: O modal de inspeção (`CardInspectorModal`) passa a ser acionado com clique direto em qualquer área neutra da carta. Os botões operacionais da carta (Rest, Atacar, Bloquear, Skill) são destacados nas bordas com espaçamento seguro contra cliques acidentais.
- **Contador de Dano da Base**: Reposicionado para o **canto inferior direito** da carta de Base, em badge com fundo escurecido e alto contraste, sem sobrepor arte ou textos.
- **Empilhamento Inteligente de Recursos**: Substituição da lista expandida com barra de rolagem horizontal por um sistema de **recursos empilhados por código/arte** com contador numérico no topo (ex: badge `x3`, `x5`). Reduz em até 60% o espaço horizontal do Resource Tray.
- **Seta de Ataque Precisa (`CombatLane`)**: Ao declarar ataque contra a Base ou o jogador, a seta SVG curva aponta para o setor esquerdo da mesa (onde se localizam a Base e o Shield Rail), eliminando a dissonância cognitiva de apontar para o centro vazio.
- **Banner de Fase / Ação Central Superior**: Expansão do padding e flexibilidade do container para garantir que a palavra "Ação" ou nomes de fases não sofram corte ou truncamento em nenhuma resolução.

### 3. Microinterações e Feedback Sensorial
- **Compra de Carta (Draw)**: Deslizamento suave da pilha do Deck para a mão do jogador.
- **Revelação de Escudo & Burst**: Carta de escudo destruída sobe ao centro do campo com efeito de brilho e pausa autoritativa para resolução da decisão do jogador.
- **Declaração de Ataque / Bloqueio**: Leve elevação da unidade atacante em direção ao alvo, com pulso na borda e traçado da linha tática.
- **Embaralhamento**: Efeito sutil de intercalação rápida de cartas ao resolver efeitos de busca no deck.

---

## Investigação de Skills e Agentes para Prompts

Utilizando o ecossistema Spartan Toolkit já presente no repositório (`.claude/`):

| Frente | Agente Recomendado | Skills Habilitadas |
|---|---|---|
| **Frente Layout & Visual** | `ai-designer` | `game-development`, `ui-ux-pro-max`, `frontend-design`, `react-best-practices`, `mobile-design` |
| **Frente WebSocket & Multiplayer** | `solution-architect-cto` | `senior-backend`, `backend-api-design`, `senior-fullstack`, `clean-code` |
| **Frente ST03 / ST04 & Engine** | `phase-reviewer` | `game-development`, `testing-strategies`, `clean-code`, `code-reviewer` |
| **Frente Tradução & RAG** | `solution-architect-cto` | `content-engine`, `database-patterns`, `clean-code` |

---

## Prompts de Comando e Regras para Claude Code em Múltiplos Terminais

### Terminal 1: Core, Tradução e Waves ST03/ST04 (Branch `dev`)
```text
Você é o engenheiro especialista em Regras e Motor de Jogo (Gundam TCG Engine).
Atue estritamente na branch 'dev'.
Seu objetivo é implementar as Frentes 1 (Feedback Deckbuilder), 2 (Tradução PT-BR) e 3 (Waves ST03 e ST04).
Regras obrigatórias:
1. Leia 'AI_GUIDE.md' e siga o checklist correspondente.
2. Em traduções, consulte 'docs/17-glossario-traducao.md': keywords oficiais (Deploy, Blocker, Breach, etc.) NUNCA devem ser traduzidas.
3. Para ST03 e ST04, siga o processo carta a carta de 'docs/29-simulador-vv-sprint-v4-processo-carta-nova.md'.
4. TDD é inegociável: crie 'st03.test.ts' e 'st04.test.ts'. Garanta 'npx vitest run src/modules/simulator' 100% verde antes de qualquer commit.
5. Marque os checkboxes concluídos no AI_GUIDE.md ao finalizar cada etapa.
```

### Terminal 2: Layout, Ergonomia e Microinterações (Branch `feature/simulator-layout`)
```text
Você é o Designer e Engenheiro Frontend do Simulador (Simulator UI/UX Lead).
Atue estritamente na branch 'feature/simulator-layout'.
Seu objetivo é executar o overhaul visual do tabuleiro, resolvendo integralmente os problemas do Feedback.pdf.
Regras obrigatórias:
1. Leia 'AI_GUIDE.md' e '.planning/design-config.md'.
2. Adapte o layout para viewport sem scroll em desktop e mobile landscape.
3. Resolva os pontos do Feedback.pdf: remova o botão de olho (inspeção via clique na carta), empilhe recursos com badge numérico, posicione o dano da base no canto inferior direito, e ajuste a seta do CombatLane para mirar a base/escudos à esquerda.
4. Utilize framer-motion para microinterações suaves (draw, reveal de escudo, ataque).
5. Valide no navegador com 'npm run dev' e marque os checkboxes no AI_GUIDE.md.
```

### Terminal 3: WebSocket, Lobby e Matchmaking (Branch `feature/simulator-websocket`)
```text
Você é o Arquiteto de Rede e Multiplayer em Tempo Real (Multiplayer Engine Lead).
Atue estritamente na branch 'feature/simulator-websocket'.
Seu objetivo é migrar o transporte de SSE/HTTP Polling para WebSockets bidirecionais robustos via socket.io.
Regras obrigatórias:
1. Leia 'AI_GUIDE.md' e a especificação de rede em 'docs/39-plano-detalhado-websocket-multiplayer.md'.
2. Integre o Socket.io no Express em 'server/index.ts' com autenticação JWT e fallback automático.
3. Crie salas isoladas por partida e eventos atômicos (match:join, match:action, match:view_update).
4. Desenvolva o suporte a convite direto via link e lista de amigos.
5. Valide reconexões automáticas e latência. Marque os checkboxes no AI_GUIDE.md ao concluir.
```

---

## Geração de Arquivos Específicos para Detalhamento

1. **[`AI_GUIDE.md`](file:///c:/WillenWorks/portal-gundam-tcg-br/AI_GUIDE.md)**: O manual mestre de desenvolvimento e orquestração de IAs na raiz do repositório, contendo checklists detalhados, regras de branches e convenções de commit.
2. **[`PLANEJAMENTO.md`](file:///c:/WillenWorks/portal-gundam-tcg-br/PLANEJAMENTO.md)**: Atualização do planejamento na raiz com a visão holística pós-v1.0.
3. **Planos Específicos de Aprofundamento**:
   - **[`docs/38-plano-detalhado-layout-e-ux.md`](file:///c:/WillenWorks/portal-gundam-tcg-br/docs/38-plano-detalhado-layout-e-ux.md)**: Especificação minuciosa do layout, componentes, tokens, responsividade e microinterações.
   - **[`docs/39-plano-detalhado-websocket-multiplayer.md`](file:///c:/WillenWorks/portal-gundam-tcg-br/docs/39-plano-detalhado-websocket-multiplayer.md)**: Arquitetura de sockets, contratos de mensagens, reconciliação de estado, fila e convites diretos.
   - **[`docs/40-plano-detalhado-traducao-rag-mcp.md`](file:///c:/WillenWorks/portal-gundam-tcg-br/docs/40-plano-detalhado-traducao-rag-mcp.md)**: Estratégia de RAG para assistente de regras, pipeline de tradução assistida e servidor MCP customizado para agentes de dev.
   - **[`docs/41-plano-detalhado-waves-st03-st04.md`](file:///c:/WillenWorks/portal-gundam-tcg-br/docs/41-plano-detalhado-waves-st03-st04.md)**: Auditoria carta a carta de ST03 e ST04, novas primitivas de motor e fixtures de teste.

---

## Proposed Changes (Mapeamento Completo de Arquivos)

### Frente 0: Guias e Orquestração
- [NEW] `AI_GUIDE.md`
- [MODIFY] `PLANEJAMENTO.md`
- [NEW] `docs/38-plano-detalhado-layout-e-ux.md`
- [NEW] `docs/39-plano-detalhado-websocket-multiplayer.md`
- [NEW] `docs/40-plano-detalhado-traducao-rag-mcp.md`
- [NEW] `docs/41-plano-detalhado-waves-st03-st04.md`

### Frente 1: Plataforma & Feedback Pontual (Branch `dev`)
- [MODIFY] `src/pages/DeckDetailPage.tsx` (Curva de nível e nível na mão inicial)
- [MODIFY] `src/pages/DeckBuilderPage.tsx` (Reposicionar estilo visual do deck para o topo)

### Frente 2: Tradução PT-BR (Branch `dev`)
- [NEW] `scripts/translate-card-effects.mjs`
- [MODIFY] `src/modules/simulator/ui/CardInspectorModal.tsx`

### Frente 3: Waves ST03 e ST04 (Branch `dev`)
- [NEW] `src/modules/simulator/fixtures/st03Deck.ts`
- [NEW] `src/modules/simulator/fixtures/st04Deck.ts`
- [MODIFY] `src/modules/simulator/engine/effectSpec.ts`
- [NEW] `src/modules/simulator/content/st03.ts` & `src/modules/simulator/content/st03.test.ts`
- [NEW] `src/modules/simulator/content/st04.ts` & `src/modules/simulator/content/st04.test.ts`
- [MODIFY] `src/pages/SimulatorSandboxPage.tsx`

### Frente 4: Layout e Ergonomia (Branch `feature/simulator-layout`)
- [MODIFY] `src/modules/simulator/ui/useArenaScale.ts` & `ArenaPlaymat.tsx`
- [MODIFY] `src/modules/simulator/ui/CardCornerActions.tsx` & `CardFace.tsx`
- [MODIFY] `src/modules/simulator/ui/BaseCardGauge.tsx`
- [MODIFY] `src/modules/simulator/ui/ResourceMeter.tsx`
- [MODIFY] `src/modules/simulator/ui/CombatLane.tsx`
- [MODIFY] `src/modules/simulator/ui/ActionDock.tsx`

### Frente 5: WebSocket & Multiplayer (Branch `feature/simulator-websocket`)
- [MODIFY] `server/index.ts`
- [MODIFY] `src/modules/simulator/server/matchStore.ts`
- [NEW] `src/modules/simulator/network/socketClient.ts`
- [MODIFY] `src/pages/SimulatorMatchPage.tsx` & `src/pages/SimulatorSandboxPage.tsx`

---

## Verification Plan

### Testes Automatizados
- Execução de testes de motor, conteúdo e rede:
  ```powershell
  npx vitest run src/modules/simulator/engine
  npx vitest run src/modules/simulator/server
  npx vitest run src/modules/simulator/content
  ```
- Validação de tipos TypeScript:
  ```powershell
  npm run check:types
  ```

### Validação Visual & Interativa
- Testes manuais via `npm run dev` no navegador:
  - Inspeção dos novos gráficos no Deckbuilder.
  - Teste do tabuleiro redimensionado em resoluções Full HD, ultrawide e mobile landscape.
  - Inspeção de cards via clique direto sem botão de olho.
  - Empilhamento numérico de recursos e mira lateral da seta de ataque.
  - Conexão e partida via WebSocket entre dois navegadores distintos.

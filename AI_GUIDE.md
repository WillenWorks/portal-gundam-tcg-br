# AI Guide — Portal Gundam TCG BR (Guia Maestro para IAs & Claude Code)

> **Documento de Operação e Orquestração Multi-Agente**  
> Este arquivo é a referência obrigatória para qualquer Inteligência Artificial (Claude Code, Antigravity, etc.) ou desenvolvedor atuando no repositório `portal-gundam-tcg-br`.

---

## 1. Princípios Inegociáveis

1. **Autoridade do Usuário (Willen)**: Cada passo e desenvolvimento estrutural deve ser validado pelo usuário antes de prosseguir. A IA possui autonomia para sugerir melhorias de boas práticas e ergonomia, devidamente documentadas.
2. **TDD é Mandatório**: Nunca crie regras ou mecânicas de jogo sem testes (`Red → Green → Refactor`). Toda alteração de motor exige suíte passando (`npx vitest run src/modules/simulator`).
3. **Vocabulário Oficial Preservado**: Palavras-chave oficiais de jogo (`【Deploy】`, `【When Paired】`, `<Blocker>`, `<Breach>`, `<Support>`, `Lv.X`, `AP`, `HP`) **JAMAIS** são traduzidas para português. Apenas a explicação em texto livre do efeito é traduzida (`effectPt`), seguindo `docs/17-glossario-traducao.md`.
4. **Isolamento de Branches**: Nunca comite alterações diretamente em `main` ou `production`. Respeite a branch específica da tarefa designada.

---

## 2. Mapa de Branches & Fluxo de Integração

```
           ┌─── feature/simulator-layout (Design, HUD, Feedback.pdf) ──┐
dev ───────┤                                                          ├─► dev (Consolidado) ─► main
           └─── feature/simulator-websocket (Socket.io, Lobby, Fila) ──┘
```

| Branch | Responsabilidade Principal |
|---|---|
| **`dev`** | Base contínua. Recebe: Correções de Deckbuilder (`Feedback.pdf`), Pipeline de Tradução PT-BR e Waves de cartas ST03/ST04. |
| **`feature/simulator-layout`** | Reformulação visual do tabuleiro, grid responsivo, microinterações e resolução de ergonomia da HUD. |
| **`feature/simulator-websocket`** | Migração do transporte para WebSockets (`socket.io`), lobby, convites diretos por link e ranqueado. |

**Regra de Sincronização**: Sempre que `dev` receber novas cartas ou regras, realize merge de `dev` para dentro de `feature/simulator-layout` e `feature/simulator-websocket` para mantê-las atualizadas.

---

## 3. RAG e MCPs no Desenvolvimento Contínuo

### 3.1 RAG (Retrieval-Augmented Generation)
- **Tradução Padronizada**: O script `scripts/translate-card-effects.mjs` utiliza um banco de termos e regras oficiais (`docs/17` e `Comprehensive Rules`) para injetar contexto no prompt de tradução, garantindo uniformidade gramatical e proteção a tokens de jogo.
- **Engine Training**: Ao criar `CardDef` de novas coleções, consulte as cartas já implementadas em `src/modules/simulator/content/st01.ts` e `st02.ts` para reaproveitar estruturas de `EffectSpec` comprovadas.

### 3.2 MCPs Recomendados para os Agentes
- **Postgres / Supabase MCP**: Para validação em tempo real de `CardModel` e verificação de integridade dos prints.
- **Chrome DevTools MCP / Browser QA**: Para validação de elementos de tela, viewport scaling e inspeção de layout no simulador.
- **Git MCP**: Para transição limpa de branches e geração de diffs atômicos.

---

## 4. Agentes e Skills Recomendados (Spartan AI Toolkit)

O repositório já conta com o **Spartan AI Toolkit** configurado em `.claude/`. Utilize os agentes e skills mapeados:

| Frente | Agente (`.claude/agents/`) | Skills Habilitadas (`.claude/skills/`) |
|---|---|---|
| **Layout & Visual** | `ai-designer.md` | `game-development`, `ui-ux-pro-max`, `frontend-design`, `react-best-practices`, `mobile-design` |
| **WebSocket & Rede** | `solution-architect-cto.md` | `senior-backend`, `backend-api-design`, `senior-fullstack`, `clean-code` |
| **Waves ST03/04 & Engine** | `phase-reviewer.md` | `game-development`, `testing-strategies`, `clean-code`, `code-reviewer` |
| **Tradução & RAG** | `solution-architect-cto.md` | `content-engine`, `database-patterns`, `clean-code` |

---

## 5. Prompts de Comando para Terminais Paralelos (Claude Code)

Copie e cole o prompt correspondente no Claude Code de acordo com o terminal de trabalho:

### 🟢 Terminal 1: Core, Tradução e Waves ST03/ST04 (Branch: `dev`)
```bash
claude
```
> **Prompt para colar no Terminal 1:**
> ```text
> Você está atuando no TERMINAL 1 do Portal Gundam TCG BR.
> Sua branch de trabalho é obrigatoriamente 'dev'.
> Seu escopo abrange:
> 1. Ajustes do Feedback.pdf no Deckbuilder (Curva de nível e Mão inicial em DeckDetailPage, e posicionamento do estilo visual do deck no topo em DeckBuilderPage).
> 2. Pipeline de Tradução PT-BR (script automatizado preservando keywords em inglês de docs/17-glossario-traducao.md).
> 3. Implementação e validação de ST03 e ST04 conforme docs/29-simulador-vv-sprint-v4-processo-carta-nova.md e docs/41-plano-detalhado-waves-st03-st04.md.
> Regras:
> - Leia AI_GUIDE.md antes de qualquer ação.
> - Execute 'npx vitest run src/modules/simulator' para garantir que os testes continuem verdes.
> - Ao concluir cada subetapa, marque o checklist no AI_GUIDE.md e faça commits semânticos em 'dev'.
> ```

---

### 🎨 Terminal 2: Layout, Ergonomia e Microinterações (Branch: `feature/simulator-layout`)
```bash
claude
```
> **Prompt para colar no Terminal 2:**
> ```text
> Você está atuando no TERMINAL 2 do Portal Gundam TCG BR.
> Sua branch de trabalho é obrigatoriamente 'feature/simulator-layout'.
> Seu escopo abrange o overhaul visual e ergonômico do simulador:
> 1. Adaptação do viewport (zero scroll) para Full HD, Ultrawide e Mobile Landscape via useArenaScale e ArenaPlaymat.
> 2. Resolução integral das dores de Feedback.pdf:
>    - Remoção do botão "olhinho" (inspeção de carta por clique direto na área neutra).
>    - Dano da Base realocado para o canto inferior direito com alto contraste.
>    - Recursos empilhados/agrupados por código com badge numérico (ex: x3, x5) para remover a barra de rolagem horizontal.
>    - Seta de ataque no CombatLane apontando para a esquerda (Base e Shields) ao alvejar jogador.
>    - Banner de ação superior ajustado sem corte de texto.
> 3. Microinterações suaves de draw, reveal de escudo/burst e declaração de combate (docs/38-plano-detalhado-layout-e-ux.md).
> Regras:
> - Leia AI_GUIDE.md e .planning/design-config.md.
> - Valide o resultado no navegador com 'npm run dev'.
> - Marque os checkboxes no AI_GUIDE.md ao concluir cada item.
> ```

---

### ⚡ Terminal 3: WebSocket & Multiplayer Avançado (Branch: `feature/simulator-websocket`)
```bash
claude
```
> **Prompt para colar no Terminal 3:**
> ```text
> Você está atuando no TERMINAL 3 do Portal Gundam TCG BR.
> Sua branch de trabalho é obrigatoriamente 'feature/simulator-websocket'.
> Seu escopo abrange a modernização do transporte de rede e lobby multiplayer:
> 1. Integração do servidor Socket.io ao Express (server/index.ts) com handshake JWT e fallback automático.
> 2. Broadcast de eventos autoritativos de estado (matchStore.ts) via salas dedicadas por partida.
> 3. Cliente frontend socketClient.ts resiliente com reconexão automática e telemetria de ping.
> 4. Criação de convite direto por link (/simulator/match/join?code=...) e fila aprimorada.
> Regras:
> - Leia AI_GUIDE.md e docs/39-plano-detalhado-websocket-multiplayer.md.
> - Garanta que 'npx vitest run src/modules/simulator/server' continue 100% aprovado.
> - Marque os checkboxes no AI_GUIDE.md e comite na branch feature/simulator-websocket.
> ```

---

## 6. Checklists de Execução Atômica

### Frente 1: Plataforma & Feedback Pontual (Branch: `dev`)
- [x] Criar gráfico de Curva de Nível de Units no Deckbuilder (`DeckbuilderPage.tsx`, aba Estatísticas, "Gráfico 04").
- [x] Adicionar estatística de nível na aba de Mão Inicial (tile "Unit de nível baixo na abertura", Lv.1–3 hipergeométrico).
- [x] Mover a seleção de Capa e Estilo Visual do Deck para próximo da barra de salvamento / topo da edição.
- [x] Commit: `feat(deckbuilder): level curve stats and visual style position`

### Frente 2: Pipeline de Tradução PT-BR (Branch: `dev`)
- [x] Criar script `scripts/translate-card-effects.mjs` com proteção léxica a tokens oficiais (tokenizer + validador + Gemini + flags `--dry-run/--resume/--apply/--revalidate`, 14 testes).
- [x] Gerar arquivo de lote de tradução para ST01, ST02, ST03 e ST04 (`data/translations-st01-04.json` — 52 com `effectPt`, 12 sem efeito, 0 rejeitadas pelo validador de tokens). Chave Gemini era free-tier e travou em quota; 51/52 traduzidas à mão seguindo `docs/17` e revalidadas.
- [x] Aplicar traduções no Postgres — via MCP Supabase (projeto `portal-gundam-tcg-br`), 2026-09-05: `CardModel` 52 cartas, `Card` 52 códigos / 188 prints. `effectPt` normalizado pro formato do catálogo (`【X】`→`[X]`, quebra→`<br>`; keywords `<X>` mantidas).
- [x] Validar exibição de `effectPt` no `CardInspectorModal.tsx` / `CardInspectorPanel.tsx` (componente `CardEffectText`, toggle PT/EN quando ambos diferem).
- [x] Commit: `feat(catalog): automated pt-br effect translation pipeline` (`d5d009a`)

### Frente 3: Waves de Cartas ST03 e ST04 (Branch: `dev`)
- [x] Auditar cartas de ST03 e ST04 contra o motor atual (`docs/41-plano-detalhado-waves-st03-st04.md`).
- [x] Implementar novas primitivas no motor (`lookAtTopFilterReveal`, `deployFromHandTriggered`) + `discardNamed`, `TargetRef.pairedUnit`, filtros `ap<=N`/`level>=N`/`hasKeyword:X`, predicados `selfApAtLeast`/`controllerHasOtherLinkUnit`/`pairedPilotLevelAtLeast`/`namedChoiceEquals`/`sourcePairedUnitIsLinkUnit`/`noControllerUnitTokenWithTrait`.
- [x] Criar fixture e CardDefs de ST03: `src/modules/simulator/fixtures/st03Deck.ts` (16 únicas + tokens T-006/T-007).
- [x] Criar specs e testes de ST03: `src/modules/simulator/content/st03.ts` (16 specs, 9 cartas) e `st03.test.ts` (12 testes).
- [x] Criar fixture e CardDefs de ST04: `src/modules/simulator/fixtures/st04Deck.ts` (16 únicas + tokens T-008/T-009/T-010).
- [x] Criar specs e testes de ST04: `src/modules/simulator/content/st04.ts` (19 specs, 11 cartas) e `st04.test.ts` (14 testes).
- [x] Habilitar ST03 e ST04 no seletor de decks (`SimulatorSandboxPage.tsx`) e no servidor (`server/index.ts` `SIMULATOR_DECKS`).
- [x] Rodar testes gerais: `npx vitest run src/modules/simulator` — 456 verdes.
- [x] Commit: `feat(simulator): st03 and st04 deck engine implementation`

**Deferido (precisa de extensão de motor — revisar com Willen, docs/41):**
- ST03-001 Sinanju: gatilho "destrói carta de shield area em batalha → 2 de dano em Unit escolhida" (combat.ts só tem `destroyEnemyInBattle`). O <High-Maneuver> During Pair está como keyword fixa (aproximação).
- ST03-014 The Blue Giant: prevenção de dano de batalha por AP do atacante (só o modo Pilot funciona).
- ST04-011 Athrun Zala: 【When Linked】concessão temporária de "mirar Unit inimiga ativa Lv≤5" (hoje `attackTargetRules` é estático). O 【Burst】 funciona.
- ST04-015 Archangel: cláusula "It can't attack during this turn" do 【Activate･Main】 (o Set active funciona).

### Frente 4: Overhaul Visual & UX do Simulador (Branch: `feature/simulator-layout`)
- [x] Ajustar proporções e piso de `--card-w` em `useArenaScale.ts` e `ArenaPlaymat.tsx` para Full HD e mobile.
- [x] Remover o botão de olho dos cards em `CardCornerActions.tsx` e habilitar inspeção via clique na carta (área neutra do corpo em `BattleSlot`/`BaseCardGauge`/`HandFan`).
- [x] Reposicionar o indicador de dano da Base para o canto inferior direito em `BaseCardGauge.tsx`.
- [x] Implementar empilhamento de recursos com badge numérico em `ResourceMeter.tsx`, removendo o scrollbar.
- [x] Ajustar mira do ataque em `CombatLane.tsx` para apontar para a Base/Escudos na lateral esquerda.
- [x] Corrigir dimensionamento do container de ação superior em `ActionDock.tsx` para evitar cortes.
- [x] Adicionar animações suaves de compra de cartas, revelação de escudo e ataque (tw-animate-css + `motion-reduce`).
- [ ] Commit: `feat(simulator-ui): playmat overhaul and feedback improvements`

### Frente 5: WebSocket & Multiplayer Avançado (Branch: `feature/simulator-websocket`)
- [ ] Instalar e configurar `socket.io` no servidor Express (`server/index.ts`).
- [ ] Adicionar suporte a eventos de sala em `src/modules/simulator/server/matchStore.ts`.
- [ ] Implementar `socketClient.ts` com reconexão automática e heartbeat.
- [ ] Migrar `SimulatorMatchPage.tsx` para consumir eventos do Socket.io.
- [ ] Implementar sistema de desafio direto via link (`/simulator/match/join?code=...`).
- [ ] Executar testes de rede e concorrência (`matchStore.test.ts`).
- [ ] Commit: `feat(simulator-network): socket.io real-time multiplayer engine`

---

## 7. Critérios de Homologação para Merge Final em `dev`

1. Todos os testes de motor, conteúdo e servidor executados e verdes:
   ```bash
   npx vitest run src/modules/simulator
   ```
2. Tipagem TypeScript sem erros:
   ```bash
   npm run check:types
   ```
3. Validação manual em navegador de partida ST03 vs ST04 via convite de WebSocket e conferência dos pontos visuais do `Feedback.pdf`.

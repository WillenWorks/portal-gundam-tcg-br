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

**As 4 cláusulas antes deferidas — FECHADAS (2026-09-05, a partir do texto EN oficial):**
- ✅ ST03-001 Sinanju: gatilho "destrói carta de shield area em batalha → 2 de dano em Unit escolhida" — `CombatTrigger.on` ganhou `"destroyEnemyShieldInBattle"` + `action: "damageChosenEnemyUnit"` (auto-mira a 1ª Unit inimiga legal; não há sistema de decisão em combate). O <High-Maneuver> During Pair segue como keyword fixa (aproximação MANTIDA — `hasKeyword` é consultado sem `state` em ~9 pontos, não vale propagar por 1 carta).
- ✅ ST03-014 The Blue Giant 【Action】: primitiva `preventUnitBattleDamage` + `CombatState.unitDamageProtection` (por Unit, condicionada ao AP efetivo do atacante).
- ✅ ST04-011 Athrun Zala 【When Linked】: primitiva `grantAttackTargetRelax` + `CardInstance.attackTargetRelaxUntilTurn` (concessão temporária consumida por `declareAttack`; dispatch de "When Linked" ligado em `deploy.ts`). Limpo em `CLEAR_TURN_MODIFIERS`.
- ✅ ST04-015 Archangel 【Activate･Main】: primitiva `preventAttackThisTurn` + `CardInstance.cannotAttackUntilTurn` (`declareAttack` barra no mesmo turno). Limpo em `CLEAR_TURN_MODIFIERS`.

**【Destroyed】 fora de combate — FECHADO (2026-09-05, docs/45):**
- ✅ Antes o 【Destroyed】 só disparava no Damage Step. Agora `dispatchTrigger` (dispatcher.ts), depois de aplicar os eventos de cada EffectSpec, chama `dispatchDestroyedFromEffect` (`abilityDispatch.ts`) — Units mortas por dano/destroy direto de efeito (**ST03-013 Close Combat 【Main】**, **ST03-015 Rewloola 【Deploy】**, futuros GD01-044 Kshatriya / GD01-093 Marida Cruz) disparam seu 【Destroyed】. Não-pausante inline (Miguel's Ginn); pausante (Char's Zaku Ⅱ `lookAtTopFilterReveal`) vira `PendingDecision.abilityResolution`, resolvida por `resolveAbility`. `wasPaired` capturado ANTES do `DESTROY_CARD` (gate 【During Pair】). Guarda anti-loop `MAX_DESTROYED_CHAIN`.
- ✅ Edge cross-player (2 Char's Zaku Ⅱ, uma de cada lado, mortas por 1 AoE): FIFO — a do jogador ativo pausa, a do oponente vai em `queuedDestroyed` e é drenada quando a primeira fecha. Nenhuma carta ST01–ST04 chega a produzir esse caso.
- ✅ Confirmado: dano-por-efeito **NÃO** dispara `<Breach>`/`<Suppression>` (essas checam "when this Unit's ATTACK destroys" — `combatTriggerEvents` só roda no Damage Step). Cobertura completa em `docs/45-cobertura-dano-e-condicionais.md`.
- Tests: `engine/destroyedOutOfCombat.test.ts` (7) + regressão `engine/destroyedTrigger.test.ts` (combate).

### Frente 4: Overhaul Visual & UX do Simulador (Branch: `feature/simulator-layout`)
- [x] Ajustar proporções e piso de `--card-w` em `useArenaScale.ts` e `ArenaPlaymat.tsx` para Full HD e mobile.
- [x] Remover o botão de olho dos cards em `CardCornerActions.tsx` e habilitar inspeção via clique na carta (área neutra do corpo em `BattleSlot`/`BaseCardGauge`/`HandFan`).
- [x] Reposicionar o indicador de dano da Base para o canto inferior direito em `BaseCardGauge.tsx`.
- [x] Implementar empilhamento de recursos com badge numérico em `ResourceMeter.tsx`, removendo o scrollbar.
- [x] Ajustar mira do ataque em `CombatLane.tsx` para apontar para a Base/Escudos na lateral esquerda.
- [x] Corrigir dimensionamento do container de ação superior em `ActionDock.tsx` para evitar cortes.
- [x] Adicionar animações suaves de compra de cartas, revelação de escudo e ataque (tw-animate-css + `motion-reduce`).
- [x] Página de preview de layout DEV-only sem auth (`src/pages/SimulatorLayoutPreviewPage.tsx`, rota `/simulador/preview-layout`) — monta o `ArenaPlaymat` completo com fixture estático (cartas ST01/ST02 reais, zero motor/rede) pra validar a F4 em displays reais. Excluída do build de produção (`import.meta.env.DEV`).
- [x] Ajustes 2ª rodada de feedback do Willen: cartas maiores (câmera rotateX 12°, `perspective` 900px, piso `--card-w` 80px, fator `--card-w-std` 0.66); badges/chip de piloto escalam com `clamp(--card-w-std)`; bandeja de pilha (Exílio/Descarte) com largura limitada + fecha no backdrop/Esc + 1 por vez; inspetor no clique fiado na preview; botão de replay renomeado ("animar compra").
- [x] Ajustes 3ª rodada de feedback do Willen: botão ▶ da mão (`cursor-pointer` + z-50 + `stopPropagation` no mousedown; hover-lift migrou pro wrapper da arte); banner de combate/`MatchPrompt` sem `panel-cut` (chanfro cortava o texto); `CardInspectorModal`/`Panel` só mostram AP/HP quando faz sentido (Command → nada, Base → só HP, Pilot → modificador `(mod) +X`); selo "LINK" curto na arte da Unit (sem números — AP/HP final já reflete o buff); badges de recurso sem corte (`overflow-visible` na `ResourceLane`); rodapé da mão menor (fator 1.35); cascata de shields mais junta (subtrai 1.3× a largura); câmera 15° + piso `--card-w` 88px.
- [x] Microinterações (parcial, docs/38 §4): `sim-anim-*` em `src/index.css` (pouso leve / queda pesada / shuffle / deal / return, todas com `prefers-reduced-motion`); `BattleSlot.justDeployed` (light/heavy); `DeckDealAnimation` (shuffle/deal-hand/mulligan/deal-shields) disparável pelo seletor de cenário da preview. **Pendente:** ligar no fluxo real do simulador (início/mulligan/escudos/jogar carta) — precisa de hooks de evento do motor + refs de zona em `ArenaSide`.
- [x] Ajustes 4ª rodada de feedback do Willen:
  - **Deck alinhado / sem vazar o playmat:** o badge de contagem do `CounterChip variant="stack"` e o `xN` do `ResourceMeter` foram do canto de FORA (`-right-1 -top-1`, vazava a coluna `STATION_WIDTH` e o `overflow-hidden` do canvas) pro canto de DENTRO (`right-0 top-0`, `rounded-bl-arena`). `DeckStation` ganhou `stationRef` (igual `ShieldStation`); grupos de estação com `px-2` de folga. Espelhamento 180° do oponente intacto.
  - **Números maiores:** AP/HP/dano do `BattleSlot` (`clamp(--card-w-std*0.17→0.22)`), `xN` do `ResourceMeter` (`*0.2→0.28`), contagem do `CounterChip` stack (era `11px` fixo → `clamp(--card-w-std*0.26)`). Os dois lados usam o mesmo `--card-w-std`; o `OPPONENT_STYLE` continua `scale(0.96)` só cosmético.
  - **Sem `+2/+1` na área do piloto:** `DockedPilot` virou só o rosto + realce âmbar quando Link. O selo curto "LINK" segue na arte da Unit (`BattleSlot`); o AP/HP FINAL já reflete o buff via `effectiveAp/Hp(unit, state, pilot)`.
  - **Animações ligadas nas zonas reais:** `ArenaSide` ganhou `deckStationRef` + `handRef` (`ArenaPlaymat` propaga: `DeckStation` e o rodapé da mão). `DeckDealAnimation` aceita `origin`/`dest` (coords de viewport) — palco ancorado na pilha do deck, cartas viajam até a mão / zona de escudos; sem as props cai no modo centrado (preview antigo). No `SimulatorMatchPage` o disparo é por **heurística de diff de contagem** (o motor não expõe os `GameEvent` de setup ao cliente de forma utilizável — o `eventLog` da view é janelado/traduzido): escudos `0→≥6` no turno 1 ⇒ `deal-shields`; decisão de mulligan que sai de pendente ⇒ `mulligan`; mão `0→≥5` no turno 1 ⇒ `deal-hand`. Deploy: `justDeployed={cost<=3?"light":"heavy"}` pra Unit com `enteredZoneOnTurn === turnNumber`, com `deployedSeenRef` (Set transiente) garantindo 1× por Unit.
  - **Animação de ataque (nova):** `BattleSlot.attacking={{towardX,towardY}}` — vetor em px (centro do slot → centro do alvo, mesma medição de DOM da seta do `CombatLane`). Aplica `translate` capado (~18% da distância, máx. 44px) + rotação ≤7° via `transform` inline (vence as classes de lift); ao limpar, volta pelo `transition-[transform] duration-[240ms]`. `prefers-reduced-motion` checado em JS (`transform` inline não responde a `motion-reduce:`). `SimulatorMatchPage` liga nos steps `attack`/`damage` do combate; preview demonstra com o checkbox "Seta de ataque".
- [ ] Commit: `feat(simulator-ui): playmat overhaul and feedback improvements`

### Frente 5: WebSocket & Multiplayer Avançado (Branch: `feature/simulator-websocket`)
- [x] Instalar e configurar `socket.io` no servidor Express (`server/index.ts` + `server/simulatorSocket.ts`, ao lado do SSE — aditivo).
- [x] Adicionar suporte a eventos de sala em `src/modules/simulator/server/matchStore.ts` (`subscribeAllMatches` — emitter global pro broadcast `match:view_update` por sala/assento).
- [x] Implementar `socketClient.ts` (`src/modules/simulator/network/socketClient.ts`) com reconexão backoff 500ms→10s, reemissão de `match:join`, fila de ações com `actionSeq` e telemetria de ping.
- [ ] Migrar `SimulatorMatchPage.tsx` para consumir eventos do Socket.io. _(diferido: migração total do cliente vem depois, com validação do Willen — SSE segue ativo em paralelo nesta rodada.)_
- [x] Implementar sistema de desafio direto via link (`/simulador?challenge=CÓDIGO` — eventos `challenge:create`/`challenge:accept`/`challenge:ready`, UI em `SimulatorSandboxPage.tsx`).
- [x] Executar testes de rede e concorrência (`src/modules/simulator/server/socketBridge.test.ts`, adições em `matchStore.test.ts`, integração real em `server/simulatorSocket.test.ts`).
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

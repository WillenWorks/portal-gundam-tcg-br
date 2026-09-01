# Roteiro e Prompts de Automação para Agentes de IA (Claude Code / Subagentes)
## Simulador Portal Gundam TCG BR — MVP Visual & Mecânico (ST01/ST02)

Este documento contém o pacote completo de automação e instruções detalhadas para executar a implementação do simulador de jogo através do **Claude Code** ou múltiplos agentes especializados em sequência.

---

## Estratégia de Execução

A implementação é dividida em **4 Sessões Modulares (Agentes Especializados)** com dependências sequenciais:

```
[Agente 1: Motor & DSL] ──► [Agente 2: Fluxo & Modais] ──► [Agente 3: Layout & Playmat] ──► [Agente 4: Sync, QA & Logs]
```

### Instruções de Operação para Claude Code
- **Execução Sequencial**: Execute uma sessão por vez. Ao final de cada sessão, rode a suíte de testes (`pnpm test`) para garantir zero regressões antes de iniciar a seguinte.
- **Princípio da Imutabilidade**: O motor (`engine/`) deve permanecer 100% puro, determinístico e imutável (usando `applyEvent`/`applyEvents`).
- **Verificação Contínua**: Todo passo deve compilar com `pnpm run check:types` (= `tsc -b`, adicionado ao `package.json` em 2026-09-01), passar no `pnpm test` e não introduzir **erros** novos no `pnpm run lint`.
- **Sobre o `pnpm run lint`**: o repo já tinha ~280 avisos pré-existentes fora do módulo do simulador (`no-explicit-any` em `lib/api.ts`/`server/index.ts`/páginas, regras novas de `react-hooks`). Em 2026-09-01 essas regras foram rebaixadas para `warning` no `eslint.config.js` (não `error`), então `pnpm run lint` passa com exit 0. Para checar só o simulador: `pnpm run lint:simulator` (deve ficar 100% limpo, zero avisos).

---

## 🤖 Sessão 1: Motor de Regras, Modificadores Estáticos & DSL Completa

> [!TIP]
> **Alvo de Cópia**: Copie todo o conteúdo delimitado no bloco abaixo e cole no terminal do Claude Code.

<!-- ======================================================================= -->
<!-- INÍCIO DO PROMPT - AGENTE 1 (MOTOR & DSL)                               -->
<!-- ======================================================================= -->

````markdown
Você é o Agente Especialista no Motor de Jogo e DSL de Efeitos (Agent-Engine-Rules) do Portal Gundam TCG BR.

### Seu Objetivo:
Completar a camada de regras e a DSL de efeitos para cobrir 100% das 32 cartas de ST01 ("Heroic Beginnings") e ST02 ("Ruination Ablaze"), resolvendo todas as 8 lacunas de regras documentadas em docs/18.

### Arquivos de Trabalho:
- `src/modules/simulator/engine/types.ts`
- `src/modules/simulator/engine/events.ts`
- `src/modules/simulator/engine/combat.ts`
- `src/modules/simulator/engine/effectSpec.ts`
- `src/modules/simulator/engine/deploy.ts`
- `src/modules/simulator/content/st01.ts`
- `src/modules/simulator/content/st02.ts`
- `src/modules/simulator/engine/*.test.ts`

### Tarefas Específicas:
1. **Modificadores Estáticos e Contínuos (CR 10-2)**:
   - Adicione no `GameState` suporte a modificadores estáticos avaliados dinamicamente em `effectiveAp(card, state)` e `effectiveHp(card, state)`.
   - Implemente o bônus de `【During Pair】` (+1 AP em todas as Units para ST01-001 Gundam) e `【During Link】` (+1 AP/+1 HP para ST02-010 Heero Yuy e Draw em batalha para ST02-011 Zechs).
2. **Geração de Instâncias & Tokens (CR 3-1)**:
   - Crie o evento `SPAWN_TOKEN` em `events.ts` para instanciar cartas a partir de um `CardDef` em tempo de jogo.
   - Implemente o deploy de tokens de Unit da ST01-015 White Base e ST02-016 Corsica Base.
   - Implemente a colocação de 1 EX Resource ativo para ST02-002 Wing Gundam (Bird Mode).
3. **Custos de Recursos em Habilidades Ativadas**:
   - Crie a primitiva `payResourceCost(n)` para cobrar recursos ativos no custo de ativação de ST02-006 Tallgeese.
4. **Alvos Coletivos / Multi-Target**:
   - Estenda `resolveTarget` em `effectSpec.ts` para resolver grupos inteiros de alvos (ex: "all_friendly_link_units" para ST01-016 Asticassia e "all_enemy_units_lv3_or_less" para ST02-003 Heavyarms).
5. **Modificadores de Legalidade e Prevenção de Dano**:
   - Integre a checagem de alvos em `combat.ts`: ST02-001 Wing Gundam pode atacar Units ativas de Lv <= 4; ST01-009 Zowort não pode atacar o jogador.
   - Implemente a prevenção de dano de ST02-013 Peaceful Timbre no Damage Step de `combat.ts`.
6. **Inspeção de Deck / Scry**:
   - Implemente a primitiva `peekAndReorderDeck(player, n)` para ST02-015 Saint Gabriel Institute.
7. **Cobertura 100% de ST01 e ST02**:
   - Atualize `src/modules/simulator/content/st01.ts` e `st02.ts` garantindo que todas as 32 cartas tenham seus EffectSpecs completos e validados por testes unitários.

### Comandos de Validação:
```bash
pnpm test
pnpm run check:types
pnpm run lint
```
````

<!-- ======================================================================= -->
<!-- FIM DO PROMPT - AGENTE 1                                                -->
<!-- ======================================================================= -->

---

## 🤖 Sessão 2: Fluxo de Decisões, Modais & Auto-Pass

> [!TIP]
> **Alvo de Cópia**: Copie todo o conteúdo delimitado no bloco abaixo e cole no terminal do Claude Code.

<!-- ======================================================================= -->
<!-- INÍCIO DO PROMPT - AGENTE 2 (FLUXO & MODAIS)                            -->
<!-- ======================================================================= -->

````markdown
Você é o Agente Especialista em Fluxo de Jogo, Prioridade e Decisões Interativas (Agent-Interaction-Flow) do Portal Gundam TCG BR.

### Seu Objetivo:
Implementar o ciclo interativo completo de decisões do jogador (Modal de Burst, Modal de Ordenação de Gatilhos Simultâneos e Auto-Pass inteligente de prioridade).

### Arquivos de Trabalho:
- `src/modules/simulator/engine/types.ts`
- `src/modules/simulator/engine/actions.ts`
- `src/modules/simulator/engine/dispatcher.ts`
- `src/modules/simulator/engine/viewState.ts`
- `src/modules/simulator/server/matchStore.ts`
- `src/lib/api.ts`
- `src/pages/SimulatorMatchPage.tsx`

### Tarefas Específicas:
1. **Estrutura de Decisão Pendente (`PendingDecision`)**:
   - Em `types.ts`, defina a união `PendingDecision`:
     - `{ kind: "burst", cardInstanceId: string, cardDef: CardDef, choices: string[] }`
     - `{ kind: "triggerOrder", triggers: Array<{ instanceId: string, specId: string, label: string }> }`
     - `{ kind: "targetSelection", sourceInstanceId: string, validTargetIds: string[], count: number }`
   - Adicione `pendingDecision: Record<PlayerId, PendingDecision | null>` no `GameState` e repasse no `viewStateFor`.
2. **Pausa Autoritativa de Burst**:
   - Quando um Shield com Burst for destruído no Damage Step de `dispatcher.ts`, interrompa o avanço do turno e defina a decisão pendente para o defensor.
   - Adicione a ação `resolveBurstDecision: { kind: "resolveBurstDecision", activate: boolean, targets?: Record<string, string[]> }` em `actions.ts`.
3. **Ordenação de Gatilhos Múltiplos**:
   - Se múltiplos triggers dispararem simultaneamente no mesmo evento, pause e emita `triggerOrder` para o jogador ativo.
   - Adicione a ação `resolveTriggerOrder: { kind: "resolveTriggerOrder", orderedSpecIds: string[] }`.
4. **Auto-Pass Inteligente para Action Steps (CR 7-6 e CR 8-4)**:
   - Adicione flag `autoPassActionStep: boolean` no estado do assento.
   - Em `matchStore.ts`, ao entrar no Action Step (combate ou fim de turno), se o jogador com prioridade estiver com `autoPassActionStep: true` E não tiver cartas `【Action】` válidas ou habilidades ativáveis, execute o passe imediatamente sem aguardar o timer de 90s.
5. **Disparo de Habilidades Ativadas**:
   - Crie a `PlayerAction` `activateAbility: { kind: "activateAbility", sourceInstanceId: string, abilityIndex?: number, targets?: Record<string, string[]> }` para permitir ativar habilidades de cartas em campo (`[Activate·Main]` de Tallgeese, White Base, Asticassia e `<Support N>`).

### Comandos de Validação:
```bash
pnpm test
pnpm run check:types
pnpm run lint
```
````

<!-- ======================================================================= -->
<!-- FIM DO PROMPT - AGENTE 2                                                -->
<!-- ======================================================================= -->

---

## 🤖 Sessão 3: Layout Digital "Nível Arena" & Playmat Mobile/Desktop

> [!TIP]
> **Alvo de Cópia**: Copie todo o conteúdo delimitado no bloco abaixo e cole no terminal do Claude Code.

<!-- ======================================================================= -->
<!-- INÍCIO DO PROMPT - AGENTE 3 (LAYOUT & PLAYMAT)                          -->
<!-- ======================================================================= -->

````markdown
Você é o Agente Especialista em Design de UI/UX e Interfaces Digitais de TCG (Agent-Visual-Playmat) do Portal Gundam TCG BR.

### Seu Objetivo:
Redesenhar a interface do simulador para atingir o padrão visual e ergonômico de referências como Mobile Suit Arena e Wing Table TCG, com 6 slots táticos, Piloto acoplado (Docking), bandeja de recursos, modais interativos e suporte tátil móvel.

### Arquivos de Trabalho:
- `src/pages/SimulatorMatchPage.tsx`
- Criar componentes modulares em `src/modules/simulator/ui/`:
  - `BattleSlot.tsx` (slot fixo de Unit com AP/HP e link)
  - `DockedPilot.tsx` (acoplamento visual de Piloto na Unit)
  - `ResourceTray.tsx` (bandeja de recursos ativos/rested/ex)
  - `ShieldStack.tsx` (pilha de shields com feedback de dano)
  - `BaseCardGauge.tsx` (moldura de Base com barra de HP)
  - `BurstModal.tsx` (modal imersivo de Burst)
  - `TriggerOrderModal.tsx` (modal de ordenação de gatilhos)
  - `CardInspectorModal.tsx` (zoom de carta com texto e buffs)
  - `CombatLane.tsx` (vetor de mira e dano flutuante)
  - `MobileHandDrawer.tsx` (gaveta expansível para celular)

### Diretrizes de Layout e Design:
1. **Battle Area com 6 Slots Fixos**:
   - Slots com moldura tática escura e bordas de acento ciano/dourado.
   - Units em campo exibem badges destacados de AP efetivo e HP restante (`effectiveHp - damage`).
   - Cards Rested recebem rotação visual ou overlay escurecido com badge "RESTED".
   - **Piloto Acoplado**: Exibição embutida do Piloto na base da Unit com badge dourado **LINK** brilhante quando a Link Condition for satisfeita.
2. **Bandeja de Recursos (Resource Tray)**:
   - Exibição de cards individuais de recursos: Recursos Ativos (brilhantes/acessíveis), Recursos Rested (opacos) e EX Resource destacado.
   - Display no HUD: `Recursos Ativos: X / Nível: Y (Total em Campo)`.
3. **Pilha de Shields & Base**:
   - Shields renderizados em pilha organizada de 1 a 6 com contador claro.
   - Base com barra de integridade de vida e badge de EX Base.
4. **Modais de Partida Interativos**:
   - `BurstModal`: Pop-up com arte ampliada da carta destruída, badge de Burst e botões claros `[Ativar Efeito]` e `[Enviar ao Descarte]`.
   - `TriggerOrderModal`: Interface simples para arrastar ou clicar na ordem desejada dos efeitos.
   - `CardInspectorModal`: Acionado por hover no desktop ou toque longo (*Long Press*) no mobile, mostrando texto oficial completo, keywords e modificadores ativos.
5. **Combate Visual & Alvos**:
   - Ao declarar ataque ou jogar cartas com alvo, destacar em verde/dourado apenas os alvos legais no tabuleiro.
   - Linha de mira conectando o atacante ao alvo e animação numérica de dano (`-AP`, `-HP`, `DESTRUÍDO`).
6. **Ergonomia Mobile**:
   - Gaveta de mão expansível com swipe. Botões de ação com área mínima de toque de 48px.

### Comandos de Validação:
```bash
pnpm run check:types
pnpm run lint
pnpm run build
```
````

<!-- ======================================================================= -->
<!-- FIM DO PROMPT - AGENTE 3                                                -->
<!-- ======================================================================= -->

---

## 🤖 Sessão 4: Sincronização, Telemetria & Validação QA

> [!TIP]
> **Alvo de Cópia**: Copie todo o conteúdo delimitado no bloco abaixo e cole no terminal do Claude Code.

<!-- ======================================================================= -->
<!-- INÍCIO DO PROMPT - AGENTE 4 (SYNC & QA)                                 -->
<!-- ======================================================================= -->

````markdown
Você é o Agente Especialista em Multiplayer, Telemetria e Garantia de Qualidade (Agent-Sync-QA) do Portal Gundam TCG BR.

### Seu Objetivo:
Implementar o feed de log de batalha em tempo real, a ferramenta de relatório de bugs in-game e executar a suíte completa de validação de ponta a ponta.

### Arquivos de Trabalho:
- `src/modules/simulator/engine/st01VsSt02Match.test.ts`
- `src/modules/simulator/server/matchStore.ts`
- `src/pages/SimulatorMatchPage.tsx`
- `src/modules/simulator/ui/BattleLogDrawer.tsx`
- `src/lib/api.ts`

### Tarefas Específicas:
1. **Feed de Log de Batalha em Tempo Real**:
   - Crie o componente `BattleLogDrawer.tsx` (painel lateral retrátil no desktop e gaveta no mobile).
   - Traduza eventos do `GameEvent` em mensagens legíveis em português (ex.: *"Jogador A jogou Gundam (Custo 3)"*, *"Gundam atacou Jogador B"*, *"Demi Trainer ativou Blocker"*, *"Burst de Amuro Ray ativado"*).
2. **Ferramenta In-Game "Reportar Situação de Regra"**:
   - Adicione um botão discreto no HUD ("Reportar Bug / Dúvida de Regra") que copia ou envia um snapshot do `GameState` atual + histórico de eventos para facilitar diagnósticos.
3. **Suíte Completa de Testes End-to-End**:
   - Atualize `st01VsSt02Match.test.ts` para cobrir uma partida real completa utilizando 100% dos EffectSpecs e decisões de ST01 vs ST02 (incluindo Burst, Link Condition, habilidades ativadas e auto-pass).
4. **Verificação Geral de Performance e Build**:
   - Garanta que não haja memory leaks no stream SSE e que o build final esteja totalmente limpo.

### Comandos de Validação:
```bash
pnpm test
pnpm run check:types
pnpm run lint
pnpm run build
```
````

<!-- ======================================================================= -->
<!-- FIM DO PROMPT - AGENTE 4                                                -->
<!-- ======================================================================= -->

---

## Como Executar no Claude Code

1. Abra o Claude Code no terminal na raiz do projeto `portal-gundam-tcg-br`.
2. Copie o bloco delimitado de **Agente 1** e envie como comando.
3. Ao término dos testes de Agente 1 (`pnpm test`), prossiga para o **Agente 2**.
4. Em seguida, execute o **Agente 3** e finalize com o **Agente 4**.

# Roteiro e Prompts de Automação para Agentes de IA (Claude Code / Subagentes)
## Anaheim System: Simulador Gundam TCG — UI/UX Tática, Combate Fluido e Coreografia Visual

Este documento contém o pacote estruturado de instruções e prompts para serem executados diretamente no **Claude Code** ou por múltiplos agentes autônomos como **Desenvolvedor Sênior Fullstack (React, Tailwind CSS, TypeScript, Vitest e Game Engine)**.

---

## 🎯 Sumário de Sessões de Execução

| Sessão | Foco Principal | Componentes Chave |
| :--- | :--- | :--- |
| **Sessão 1** | Remoção de Modais Bloqueantes e Novo Top HUD Tático | `CenterDecisionModal`, `MatchPrompt`, `ActionDock` |
| **Sessão 2** | Correção do Setup (Draw 5 Cartas) e Cadência de Escudos | `DeckDealAnimation`, `SimulatorMatchPage`, `index.css` |
| **Sessão 3** | Deploy Fluido (Units, Pilotos Bidirecionais, Comandos, Bases) | `SimulatorMatchPage`, `BattleSlot`, `HandFan` |
| **Sessão 4** | Combate Tático (Summoning Sickness, Alvos Verdes, Auto-Pass, Lunge) | `BattleSlot`, `SimulatorMatchPage`, `combat.ts` |
| **Sessão 5** | FX de Descarte/Exílio, Draw de Turno e Modais Superiores Mobile | `CardDepartureAnimation`, `BurstModal`, `AbilityResolution` |

---

## Diretrizes Universais de Execução
1. **Compilação e Verificação:** Ao fim de cada sessão, obrigatoriamente execute:
   ```bash
   pnpm run check:types
   pnpm vitest run src/modules/simulator/
   ```
2. **Imutabilidade e Robustez:** Não chame hooks (`useState`, `useEffect`, `useCallback`) condicionalmente ou após early returns.
3. **Ergonomia Visual (Mobile & Desktop):** O centro do tabuleiro e a mão do jogador **nunca** devem ser obstruídos por modais durante o gameplay regular.

---

## 🤖 Sessão 1: Remoção de Modais Bloqueantes e Novo Top HUD Tático

> [!TIP]
> **Alvo de Cópia**: Copie todo o conteúdo do bloco abaixo e cole no terminal do Claude Code.

<!-- ======================================================================= -->
<!-- INÍCIO DO PROMPT - SESSÃO 1                                              -->
<!-- ======================================================================= -->

```markdown
Você é o Engenheiro de Front-end Sênior e Especialista em UI/UX do Portal Gundam TCG BR.

### Seu Objetivo:
Eliminar completamente os modais centralizados e do canto direito que bloqueiam o tabuleiro durante jogadas regulares (`pending`, `attacking`, `defending`, `actionStep`), substituindo-os por um HUD tático no topo da tela e uma barra de ações flutuante e compacta.

### Arquivos Alvo:
- `src/modules/simulator/ui/CenterDecisionModal.tsx`
- `src/modules/simulator/ui/MatchPrompt.tsx`
- `src/modules/simulator/ui/ActionDock.tsx`
- `src/pages/SimulatorMatchPage.tsx`
- `src/modules/simulator/ui/CenterDecisionModal.test.tsx`
- `src/modules/simulator/ui/MatchPrompt.test.tsx`

### Tarefas Específicas:
1. **Desativar Modais Centrais em Fases de Jogo:**
   - Em `CenterDecisionModal.tsx`, garantir que o componente retorne `null` para os estados `pending`, `attacking`, `defending`, `actionStep` e `idle` (exceto quando `confirmEndTurnOpen === true`).
   - O centro da tela nunca deve renderizar cards bloqueantes durante o pagamento de custos, seleção de alvos ou declaração de ataque/defesa.
2. **Transformar `MatchPrompt.tsx` em TopTacticalHUD:**
   - Expandir `MatchPrompt.tsx` para aceitar botões contextuais inline discretos:
     - `onCancel`: botão "Cancelar" (tecla Esc) para desfazer seleção pendente de carta/alvo/recurso.
     - `onSkipBlock`: botão "Não Bloquear" durante o passo de defesa.
     - `onPassAction`: botão "Passar Ação" durante o passo de ação.
   - Posicionamento: topo centralizado (`fixed top-2 sm:top-3 z-40`), moldura fina com backdrop blur e tipografia militar sci-fi Gundam.
3. **Slim Floating Action Ribbon (`ActionDock.tsx`):**
   - Remover painéis volumosos do canto direito que duplicam logs e textos.
   - Manter apenas um pill horizontal/vertical compacto com os botões essenciais: `Passar Turno` (com confirmação limpa), botão retrátil de `Log`, e indicador discreto de ping/auto-pass.
4. **Atualizar `SimulatorMatchPage.tsx`:**
   - Conectar as ações contextuais ao novo `TopTacticalHUD`.
   - Remover as sobreposições concorrentes.

### Critérios de Aceite:
- Clicar em cartas da mão ou unidades nunca abre um modal no centro da tela.
- O botão de cancelar jogada e botões de passe aparecem no HUD do topo.
- `pnpm run check:types` e `pnpm vitest run src/modules/simulator/ui/CenterDecisionModal.test.tsx src/modules/simulator/ui/MatchPrompt.test.tsx` passam com 100% de sucesso.
```

<!-- ======================================================================= -->
<!-- FIM DO PROMPT - SESSÃO 1                                                 -->
<!-- ======================================================================= -->

---

## 🤖 Sessão 2: Correção do Setup (Draw de 5 Cartas) e Cadência dos Escudos

> [!TIP]
> **Alvo de Cópia**: Copie todo o conteúdo do bloco abaixo e cole no terminal do Claude Code.

<!-- ======================================================================= -->
<!-- INÍCIO DO PROMPT - SESSÃO 2                                              -->
<!-- ======================================================================= -->

```markdown
Você é o Especialista em Animações e Ciclo de Vida do React do Portal Gundam TCG BR.

### Seu Objetivo:
Corrigir a falha de sincronização de estado que impede a animação de saque das 5 cartas iniciais na abertura da partida e ajustar a cadência dos 6 escudos para que cada um voe e empilhe de forma visível e cinematográfica.

### Arquivos Alvo:
- `src/modules/simulator/ui/DeckDealAnimation.tsx`
- `src/pages/SimulatorMatchPage.tsx`
- `src/index.css`
- `src/modules/simulator/ui/DeckDealAnimation.test.tsx`

### Diagnóstico Técnico & Tarefas:
1. **Sincronização de Estado `mode -> phase` em `DeckDealAnimation.tsx`:**
   - O `useState<"return" | "shuffle" | "deal">` inicializa com base no `mode` inicial (`shuffle`), mas quando a prop `mode` muda para `"deal-hand"`, o estado interno não se atualiza sozinho.
   - Adicionar um efeito que reseta a `phase` sempre que `mode` for alterado:
     ```tsx
     useEffect(() => {
       setPhase(mode === "mulligan" ? "return" : mode === "shuffle" ? "shuffle" : "deal");
     }, [mode]);
     ```
   - No `SimulatorMatchPage.tsx`, adicionar a prop `key={setupAnim}` ao `<DeckDealAnimation key={setupAnim} ... />` para assegurar que cada animação tenha montagem limpa e isolada.
2. **Cadência e Visibilidade dos Escudos (`deal-shields`):**
   - Em `DeckDealAnimation.tsx`, alterar o stagger específico para escudos:
     - Definir `SHIELD_STAGGER = 160ms` (em vez de 90ms).
     - Cada um dos 6 escudos terá `animationDelay = `${i * SHIELD_STAGGER}ms``.
     - Ajustar os timers de áudio (`sfx.playCardDraw()`) para acompanhar o novo stagger, e o som final de trava de escudo (`sfx.playShieldBlock()`) ao pousar o 6º escudo.
     - Ajustar o tempo total para segurar os escudos visíveis antes de chamar `onDone`:
       `6 * SHIELD_STAGGER + FLIGHT_MS + 250ms`.
3. **Transição Suave para o `ShieldRail`:**
   - Garantir que o `ShieldRail` real no tabuleiro só apareça após `introStage` mudar para `"complete"` ou `"phase-banner"`, sem sobreposição fantasma ou pulo visual.

### Critérios de Aceite:
- Ao entrar em uma partida solo ou PvP, as 5 cartas saem nitidamente do deck e voam para a mão virando para a face revelada.
- No mulligan, as cartas voltam ao deck, embaralham e 5 novas cartas saem.
- Os 6 escudos viajam sequencialmente de forma visível e audível.
- `pnpm vitest run src/modules/simulator/ui/DeckDealAnimation.test.tsx` passa com 100% de sucesso.
```

<!-- ======================================================================= -->
<!-- FIM DO PROMPT - SESSÃO 2                                                 -->
<!-- ======================================================================= -->

---

## 🤖 Sessão 3: Deploy Fluido de Unidades, Pilotos Bidirecionais, Comandos e Bases

> [!TIP]
> **Alvo de Cópia**: Copie todo o conteúdo do bloco abaixo e cole no terminal do Claude Code.

<!-- ======================================================================= -->
<!-- INÍCIO DO PROMPT - SESSÃO 3                                              -->
<!-- ======================================================================= -->

```markdown
Você é o Desenvolvedor Fullstack Sênior do Portal Gundam TCG BR.

### Seu Objetivo:
Implementar o novo fluxo fluido de jogadas da mão (Deploy e Play) sem telas intermediárias, suportando seleção bidirecional para Pilotos e Comandos, invocação direta de Unidades e Bases, e seletor modal compacto apenas para cartas híbridas (Piloto vs Comando).

### Arquivos Alvo:
- `src/pages/SimulatorMatchPage.tsx`
- `src/modules/simulator/ui/BattleSlot.tsx`
- `src/modules/simulator/ui/ResourceMeter.tsx`
- `src/modules/simulator/ui/HandFan.tsx`

### Tarefas Específicas:
1. **Invocação Fluida de Unidades:**
   - Clicar em "Play" na carta de Unidade na mão:
     - Recursos ativos recebem halo ciano piscante.
     - Slots vazios da Battle Area do jogador piscam em ciano (`emptySlotActive`).
     - Se o custo for 0, invoca imediatamente.
     - Ao pagar o último recurso necessário do custo, a invocação ocorre de forma automática e imediata no primeiro slot vago (ou no slot vazio clicado pelo jogador). Sem modais de confirmação.
2. **Seleção Bidirecional para Pilotos:**
   - Clicar em "Play" no Piloto:
     - Todas as Unidades amigas não pareadas na Battle Area ganham destaque verde/ciano pulsante.
     - Recursos ativos ganham destaque âmbar pulsante.
     - **Fluxo A:** O jogador clica na Unidade desejada e em seguida nos Recursos -> assim que o custo é atingido, pareia e invoca automaticamente!
     - **Fluxo B:** O jogador clica nos Recursos primeiro e depois na Unidade desejada -> no clique da Unidade, pareia e invoca automaticamente!
3. **Seleção Bidirecional para Comandos:**
   - Clicar em "Play" no Comando:
     - Se o comando exigir alvo, os alvos válidos no tabuleiro ganham halo esmeralda.
     - Recursos ativos ganham halo âmbar.
     - O jogador pode escolher o alvo primeiro ou os recursos primeiro. Assim que os dois requisitos estiverem satisfeitos, o comando é disparado!
     - Se o comando não exigir alvo, ao pagar os recursos ele resolve instantaneamente.
4. **Invocação Direta de Bases:**
   - Clicar em "Play" na Base:
     - Pagar os recursos ativos necessários coloca a base diretamente na Base Section.
5. **Cartas Híbridas Piloto / Comando:**
   - Quando uma carta possui mais de um modo jogável (ex: Piloto e Comando):
     - Abrir um seletor suspenso compacto no topo da tela com os botões: `[ Jogar como Piloto ]` e `[ Jogar como Comando ]`.
     - Ao escolher, prosseguir diretamente para o fluxo bidirecional correspondente.
6. **Botão de Cancelar Jogada:**
   - Durante qualquer seleção pendente, exibir no TopTacticalHUD um botão claro `[ Cancelar Jogada (Esc) ]` que limpa as seleções com `clearSelection()`.

### Critérios de Aceite:
- O jogador consegue jogar qualquer carta sem ser interromptado por modais bloqueantes centrais.
- Pilotos aceitam seleção em qualquer ordem (unidade antes de recurso ou recurso antes de unidade).
- Comandos com alvo aceitam seleção em qualquer ordem.
- `pnpm run check:types` e testes do simulador passam sem erros.
```

<!-- ======================================================================= -->
<!-- FIM DO PROMPT - SESSÃO 3                                                 -->
<!-- ======================================================================= -->

---

## 🤖 Sessão 4: Combate Tático, Summoning Sickness, Alvos Verdes, Blockers e Auto-Pass

> [!TIP]
> **Alvo de Cópia**: Copie todo o conteúdo do bloco abaixo e cole no terminal do Claude Code.

<!-- ======================================================================= -->
<!-- INÍCIO DO PROMPT - SESSÃO 4                                              -->
<!-- ======================================================================= -->

```markdown
Você é o Especialista em Regras de Combate e Engenharia de Jogos do Portal Gundam TCG BR.

### Seu Objetivo:
Implementar as regras de enjôo de invocação, seleção de alvos de ataque com halo verde, botão de blocker destacado na unidade, automação de passos vazios (auto-pass de blocker e action), e a coreografia física completa do ataque pós-fase de ação.

### Arquivos Alvo:
- `src/modules/simulator/ui/BattleSlot.tsx`
- `src/modules/simulator/ui/BaseCardGauge.tsx`
- `src/pages/SimulatorMatchPage.tsx`
- `src/modules/simulator/engine/combat.ts`
- `src/modules/simulator/engine/actions.ts`

### Tarefas Específicas:
1. **Enjôo de Invocação (Summoning Sickness):**
   - Uma Unit que entrou na Battle Area no turno atual (`enteredZoneOnTurn === view.turnNumber`) **NÃO** exibe o botão "Atacar", a menos que:
     - Possua a keyword `<Rush>` ou `<Blitz>`; OU
     - Tenha sido pareada com Piloto ativando vínculo de Link que conceda ataque no turno de entrada.
   - Se a unidade estiver descansada (`rested`), nunca exibe o botão de ataque.
2. **Seleção de Alvos com Halo Verde:**
   - Ao clicar no botão "Atacar" de uma Unit válida:
     - A unidade atacante ganha borda vermelha/ciano de ataque.
     - Todos os alvos inimigos legais recebem **glow verde pulsante** (`border-emerald-400 ring-2 ring-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.85)] animate-pulse`):
       - Units inimigas descansadas (`rested`).
       - Base ou Shields do jogador inimigo (se ataque direto for legal).
     - Clicar diretamente sobre a Unit inimiga verde ou sobre a área de Shields/Base inimiga declara o ataque imediatamente! Sem modal intermediária.
3. **Passo de Blocker Inteligente & Auto-Pass:**
   - **Auto-Pass:** Se o jogador defensor **não tiver nenhuma Unit ativa com a keyword `<Blocker>`**, o passo de bloqueio deve ser pulado automaticamente (`runAction({ kind: "skipBlock" })`) sem travar o jogo.
   - **Com Blocker:** As unidades com `<Blocker>` exibem um botão verde saliente **"Blocker"** com escudo (`ShieldCheck`) no topo da carta. Ao clicar nele:
     - Redireciona a seta de combate para a unidade blocker.
     - Toca `sfx.playShieldBlock()`.
     - Aguarda um delay de 300ms de confirmação visual antes de avançar para a fase de ação.
     - Um botão limpo "Não Bloquear" fica disponível no TopTacticalHUD.
4. **Passo de Ação Inteligente & Auto-Pass:**
   - **Auto-Pass:** Se o jogador com prioridade não possuir nenhuma carta na mão com 【Action】 jogável para os recursos disponíveis nem habilidades de campo ativáveis, o passo de ação passa automaticamente (`runAction({ kind: "passAction" })`).
   - **Com Ação:** As cartas jogáveis ganham um **glow amarelo brilhante** (`ring-2 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.85)]`) e botão "Play" habilitado.
5. **Coreografia Física do Golpe de Ataque (Pós-Ação):**
   - Em `SimulatorMatchPage.tsx`, no `applyIncomingView`:
     - Disparar a animação física de ataque sempre que um combate ativo for resolvido ou entrar no Damage Step:
       1. **Avanço (*Advance*)**: Unidade atacante desloca-se velozmente em direção ao alvo real (até 65% do percurso ou 160px).
       2. **Disparo (*Strike*)**: Toca `sfx.playAttackBeam()` (feixe) ou sabre, e se o alvo for o jogador toca `sfx.playShieldBurst()` com tremor visual.
       3. **Recuo (*Return*)**: A unidade atacante retorna suavemente ao seu slot de origem.
       4. **Aplicação do Dano**: Aplica a view recebida no tabuleiro com o novo dano/escudos.

### Critérios de Aceite:
- Unidades recém-jogadas sem Link/Rush não mostram botão de atacar.
- Alvos válidos de ataque piscam em verde e respondem a clique direto.
- Se o bot/jogador não tem blocker, a fase de bloqueio passa imediatamente.
- Se não há ações possíveis, a fase de ação passa imediatamente.
- A animação de ataque executa fisicamente em todos os combates concluídos.
- `pnpm test` e `pnpm run check:types` passam sem erros.
```

<!-- ======================================================================= -->
<!-- FIM DO PROMPT - SESSÃO 4                                                 -->
<!-- ======================================================================= -->

---

## 🤖 Sessão 5: Microinterações de Descarte/Exílio, Draw de Turno e Modais Superiores

> [!TIP]
> **Alvo de Cópia**: Copie todo o conteúdo do bloco abaixo e cole no terminal do Claude Code.

<!-- ======================================================================= -->
<!-- INÍCIO DO PROMPT - SESSÃO 5                                              -->
<!-- ======================================================================= -->

```markdown
Você é o Especialista em Microinterações Visuais e UX Mobile do Portal Gundam TCG BR.

### Seu Objetivo:
Implementar a animação de envio de cartas para o Trash/Exílio, o efeito de compra de 1 carta no início do turno (Draw Phase), e reposicionar modais de escolha (`BurstModal`, `AbilityResolutionModal`, `ZoneOverflowModal`, `TriggerOrderModal`) para a parte superior da tela no formato Mobile-First.

### Arquivos Alvo:
- `src/modules/simulator/ui/DeckDealAnimation.tsx`
- `src/modules/simulator/ui/CardDepartureAnimation.tsx` (novo)
- `src/modules/simulator/ui/BurstModal.tsx`
- `src/modules/simulator/ui/AbilityResolutionModal.tsx`
- `src/modules/simulator/ui/ZoneOverflowModal.tsx`
- `src/modules/simulator/ui/TriggerOrderModal.tsx`
- `src/pages/SimulatorMatchPage.tsx`
- `src/index.css`

### Tarefas Específicas:
1. **Animação de Descarte e Exílio (`CardDepartureAnimation.tsx`):**
   - Detectar via diff de estado cartas que saíram de campo/mão diretamente para o Trash ou Exílio.
   - Renderizar um clone translúcido da carta deslizando da sua posição original em direção à pilha de Trash ou Exílio, com fade-out suave e som de destruição / descarte (`sfx.playExplosion()` para destruição de unidade, slide suave para descarte).
2. **Animação de Draw de 1 Carta por Turno:**
   - Adicionar o modo `single-draw` ao `DeckDealAnimation.tsx`:
     - 1 carta sai do deck e viaja suavemente até a mão do jogador ativo no início de cada turno.
     - Toca `sfx.playCardDraw()`.
     - Duração de 400ms sem bloquear ações subsequentes.
3. **Modais de Decisão Ancoradas no Topo (Mobile & Desktop Friendly):**
   - Para as modais de decisão que exigem seleção de lista:
     - `BurstModal.tsx`: reposicionar para o terço superior (`fixed top-3 sm:top-5 inset-x-0 mx-auto w-[min(94vw,36rem)]`), cobrindo apenas o lado do oponente.
     - `AbilityResolutionModal.tsx`: topo com scroll horizontal compacto caso haja múltiplos alvos.
     - `ZoneOverflowModal.tsx`: barra tática no topo com as unidades elegíveis para descarte.
     - `TriggerOrderModal.tsx`: faixa suspensa no topo com badges arrastáveis ou clicáveis.
   - Isso garante que a Battle Area própria, recursos e mão continuem 100% visíveis durante toda e qualquer resolução de gatilho!

### Critérios de Aceite:
- Destruições e descartes produzem animação suave para a pilha de descarte/exílio.
- Cada início de turno toca a animação de saque de 1 carta.
- Em mobile landscape e desktop, nenhum modal de trigger ou burst tampa as cartas do próprio jogador.
- `pnpm run check:types` e a suíte completa de testes do simulador passam com 100% de sucesso.
```

<!-- ======================================================================= -->
<!-- FIM DO PROMPT - SESSÃO 5                                                 -->
<!-- ======================================================================= -->

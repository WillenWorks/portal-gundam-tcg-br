# Plano de Ação e Implantação: Polimento Visual e Mecânico do Simulador

Este documento detalha o diagnóstico técnico, a arquitetura de solução e a estratégia de execução para as melhorias visuais e mecânicas solicitadas para o simulador do **Portal Gundam TCG BR**.

---

## Sumário Executivo das Correções

1. **Sorteio de Iniciativa vs Bot**: Remoção da inicialização estática `firstPlayer: "A"` nas partidas de treino para um sorteio 50/50 (`Math.random() < 0.5 ? "A" : "B"` ou derivado determinístico de seed).
2. **Harmonização do Tamanho das Cartas (Draw, Mulligan, Shields)**: Eliminação do salto de escala (`84px` / `140px` vs `--card-w-std`) unificando a dimensão de voo e renderização estritamente com a largura medida de `--card-w-std`.
3. **Faixas de Fase e Troca de Turno Recorrentes**: Desacoplamento do `PhaseAnnouncementBanner` do estágio isolado `introStage === "phase-banner"` e enfileiramento automático a cada transição de turno (`Draw Phase` → `Recovery Phase` → `Main Phase`).
4. **Ritmo e Exibição do Draw**: Ajuste da duração do `single-draw` e exibição da carta real comprada sem cortes ou pulos bruscos.
5. **Animação Física de Ataque (Lunge & Return)**: Deslocamento completo e visível da unidade atacante até a unidade inimiga ou base/escudo adversário com impacto sonoro/visual e retorno ao slot de origem.
6. **Destruição de Shield para o Trash e Revelação 3D de Burst**:
   - Detecção de perda de shields em `detectDepartures` gerando animação do trilho de escudos para o Trash.
   - Quando um `Burst` é engatilhado: o card do escudo destaca-se, voa ao centro da tela, vira a face em 3D revelando a arte e só então abre o modal de resolução.
7. **Lançamento e Revelação de Cartas de Comando**: Exibição da carta de comando flutuando e revelada ao centro ao ser jogada da mão antes de ser direcionada ao Trash.
8. **Controle de Velocidade dos Efeitos**: Seletor no menu de configurações (`0.75x Didático`, `1x Normal`, `1.5x Rápido`, `2x Turbo`) persistido em `localStorage`, sincronizando timeouts e variáveis CSS.
9. **Estratégia Paralela com Claude**: Divisão do trabalho em 3 frentes de atuação independentes com prompts prontos para execução simultânea.

---

## User Review Required

> [!IMPORTANT]
> **Fluxo de Animação de Burst e Comandos**: Para que as cartas sejam compreendidas pelo jogador, o efeito de revelação (Burst ou Comando) pausa momentaneamente o fluxo antes do descarte (cerca de 600ms a 900ms a 1x, escalável pela velocidade). Esse tempo garante visibilidade sem travar o ritmo da partida.
>
> **Comportamento do Bot Iniciando**: Quando o Bot vence a iniciativa, ele joga o Turno 1. O simulador já possui fila assíncrona (`maybeEnqueueBotTurn`) que aciona a tomada de decisão do Bot no servidor, garantindo paridade total com o jogador humano.

---

## Diagnóstico Técnico Detalhado

### 1. Sorteio de Iniciativa
- **Causa Raiz**: Em [`trainingMatch.ts`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/server/trainingMatch.ts#L109-L115), a criação da partida estava com `firstPlayer: "A"` fixo:
  ```typescript
  const match = createMatch({
    deckA,
    deckB,
    firstPlayer: "A", // <--- Hardcoded para o jogador humano
    seed: input.seed,
    mode: "training",
  });
  ```
- **Ação**: Tornar dinâmico: se `input.firstPlayer` for passado, respeitá-lo; caso contrário, sortear aleatoriamente entre `"A"` e `"B"`.
- **Nota (precedente já existente no código)**: O fluxo de matchmaking PvP em [`matchStore.ts`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/server/matchStore.ts#L907) já faz exatamente isso hoje — `firstPlayer: Math.random() < 0.5 ? "A" : "B"` — sem nenhuma derivação a partir do `seed`. Recomenda-se **seguir o mesmo padrão** em `trainingMatch.ts` em vez de derivar o sorteio do `seed` via `createRng(input.seed)`: o `seed` já é reaproveitado (com XOR de nonces distintos) para embaralhar o deck e resolver mulligans (ver `engine/setup.ts`, `engine/actions.ts`), e usar o mesmo `seed` cru para decidir o `firstPlayer` correlacionaria as duas decisões (mesma seed → mesma combinação de "quem começa" + "ordem do baralho" sempre), o que atrapalha exatamente os testes de determinismo que essa mudança pretende viabilizar.
  - Melhor abordagem: adicionar um campo opcional `firstPlayer?: PlayerId` em `CreateTrainingMatchInput` (hoje inexistente) para os testes fixarem o lado sem tocar no RNG, e usar `Math.random() < 0.5 ? "A" : "B"` como default em produção — mesma receita do matchmaking PvP.

### 2. Mudança Brusca de Tamanho no Draw / Mulligan / Shields
- **Causa Raiz (corrigida após checagem no código atual)**: A chamada real de `<DeckDealAnimation>` em [`SimulatorMatchPage.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/pages/SimulatorMatchPage.tsx#L2551) **já** passa `cardW={board.rectOf('deckStation:${seat}')?.width}`, e o `DeckStation` no [`ArenaPlaymat.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/ArenaPlaymat.tsx#L251) é dimensionado exatamente por `STATION_WIDTH = "w-[var(--card-w-std,2.17rem)]"`. Ou seja, o fallback `anchored ? 84 : 140` em [`DeckDealAnimation.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/DeckDealAnimation.tsx#L125) **não é o bug** para `deal-hand` / `mulligan-anim` / `deal-shields` — é só uma defesa para quando `cardW` não é passado, e já recebe o valor certo hoje.
  - O salto de escala real e confirmado está em [`MulliganModal.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/MulliganModal.tsx#L36): o componente renderiza `<CardFace size="md" />`, que resolve para a classe Tailwind estática `w-20` (80px, ver [`cardArt.ts`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/cardArt.ts#L15) `CARD_FACE_WIDTH`) — sem nenhuma ligação com `--card-w-std`. Isso contrasta com o [`HandFan.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/HandFan.tsx#L178), que já resolve exatamente esse problema sobrescrevendo o tamanho padrão do `CardFace` com `style={{ width: "var(--card-w-std, 2.17rem)" }}`.
- **Ação**:
  - Em `MulliganModal.tsx`, aplicar o mesmo padrão do `HandFan.tsx`: `style={{ width: "var(--card-w-std, 2.17rem)" }}` em cada `<CardFace>` renderizado (mantendo `size="md"` só como fallback de resolução de imagem, não de layout).
  - Confirmar visualmente que a mão exibida no modal de mulligan bate pixel-a-pixel com o leque real da mão que aparece logo depois.
  - O `cardW` do `DeckDealAnimation` para `single-draw` também precisa continuar vindo do `deckStation` (já está correto) — não requer mudança adicional além do item 4 abaixo (passar `cards`).

### 3. Mensagem Centralizada de Fases e Turno Desaparecendo após o Turno 1
- **Causa Raiz**: Em [`SimulatorMatchPage.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/pages/SimulatorMatchPage.tsx#L2337), o banner só é renderizado na condição:
  ```tsx
  {introStage === "phase-banner" && phaseBannerQueue.length > 0 ? (
    <PhaseAnnouncementBanner ... />
  ) : null}
  ```
  Assim que a abertura termina, `introStage` é fixado em `"complete"` e nunca mais volta.
- **Ação**:
  - Renderizar `PhaseAnnouncementBanner` sempre que `phaseBannerQueue.length > 0`, desacoplado do `introStage`.
  - **Atenção**: só desacoplar a renderização não basta — `introStage` é uma máquina de estados "de abertura", one-shot: uma vez que chega em `"complete"` (via `handlePhaseBannerDone`), nada mais a tira desse estado. É necessário um `useEffect` **novo e independente** (não dependente de `introStage`) escutando mudanças de `turnNumber`/`activePlayer` para popular `phaseBannerQueue` a cada troca de turno subsequente: `"SEU TURNO" / "TURNO DO OPONENTE"`, `"FASE DE COMPRA"`, `"FASE DE RECUPERAÇÃO"` e `"FASE PRINCIPAL"`.
  - Cuidado para esse novo efeito não colidir com o efeito de abertura (`handleSetupAnimDone`) durante o Turno 1 — usar uma referência (`prevTurnNumberRef`) para só enfileirar a partir da 2ª mudança de turno detectada, já que o Turno 1 continua sendo tratado pelo fluxo de abertura existente.

### 4. Animação de Draw Rápida Demais
- **Causa Raiz**: `SINGLE_DRAW_MS = 400` em [`DeckDealAnimation.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/DeckDealAnimation.tsx#L112) e ausência do objeto `cards` para saque individual.
- **Ação**:
  - Passar a carta comprada para o `DeckDealAnimation` no modo `single-draw`.
  - Aumentar a duração base do draw para ~750ms e atrelar ao multiplicador de velocidade de animação.

### 5. Carta Atacando e Retornando ao Lugar (Lunge & Return)
- **Causa Raiz (mecanismo exato confirmado no código)**: Em [`SimulatorMatchPage.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/pages/SimulatorMatchPage.tsx#L581-L586), `executeAttackStrike` só dispara se `prevCombat.step === "action"` **E** a view seguinte tiver `combat` ausente ou `step === "battleEnd"`. O `CombatStep` real é `"attack" | "block" | "action" | "damage" | "battleEnd"` (ver [`types.ts`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/engine/types.ts#L840)) — ou seja, existe um passo `"damage"` intermediário entre `"action"` e `"battleEnd"` que a condição atual não cobre; se o cliente observar esse passo primeiro, a janela de `"action"` já passou e a animação nunca dispara.
  - Mais grave: em [`matchStore.ts`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/server/matchStore.ts#L1035-L1058), `settleAutoPasses` resolve o Action Step **inteiro, dos dois lados, de forma síncrona no servidor**, antes de qualquer resposta chegar ao cliente, sempre que o assento tem `autoPassActionStep: true` (ou é bot). Em [`trainingMatch.ts`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/server/trainingMatch.ts#L122-L141), **tanto o jogador humano quanto o bot** entram com `autoPassActionStep: true` — então em modo treino o passo `"action"` nunca chega a existir do ponto de vista do cliente: a primeira view que ele recebe após declarar o ataque já está em `"damage"` ou além. É por isso que a animação falha consistentemente contra o Bot, mesmo com a condição atual tecnicamente "correta" para o caso raro em que o passo `"action"` fica visível (ex.: PvP sem auto-pass, onde o padrão é `autoPassActionStep: false` — ver `matchStore.ts:245`).
  - Além disso, em [`BattleSlot.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/BattleSlot.tsx#L89), a distância era limitada a 160px com `min(mag * 0.65, 160)`.
- **Ação**:
  - Trocar a condição de disparo em `SimulatorMatchPage.tsx` de "estava em `action`" para algo como: `prevCombat existe e seu step ∈ {"attack", "block", "action"} && (incoming.view.combat ausente || incoming.view.combat.id !== prevCombat.id || incoming.view.combat.step ∈ {"damage", "battleEnd"})`. Os dados necessários (`attackerId`, `currentTarget`, `defendingPlayer`) já existem em `CombatState` desde o passo `"attack"`, então não há bloqueio técnico para isso.
  - Alternativamente (mais robusto a passos futuros), disparar a animação comparando a MUDANÇA do par `(attackerId, step)` — sempre que o `attackerId` do combate anterior deixa de existir no combate atual (ou o combate acaba), execute o strike, independentemente de qual era o `step` anterior exato.
  - Implementar uma animação de deslocamento fluida que faça a unidade avançar em direção às coordenadas do alvo (unidade inimiga ou trilha de escudos/base), executar o impacto (com tremor e SFX) e recuar ao slot.

### 6. Destruição de Shield para o Trash e Revelação de Burst
- **Causa Raiz**:
  - `detectDepartures` em [`SimulatorMatchPage.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/pages/SimulatorMatchPage.tsx#L538-L542) só verificava `wasUnit`, `wasBase` e `wasOwnHand`, ignorando completamente a redução de escudos.
  - `BurstModal` abria direto no topo sem animação de desprendimento do escudo e rotação 3D da carta.
- **Ação**:
  - Incluir detecção de perda de shields em `detectDepartures`: quando o contador de shields diminui e entra uma carta no Trash/Exílio, gerar um clone partindo de `shieldRail:${pid}` em direção a `trashStation:${pid}`.
  - Para Burst: antes de exibir a decisão de ativação, acionar o `BurstRevealStage`: a carta de escudo sai do trilho, amplia ao centro, faz o giro 3D (revelando frente e nome) com brilho dourado e abre a tomada de decisão.

### 7. Comando da Mão: Revelação e Ida pro Trash
- **Causa Raiz**: Jogar comando executava um timeout de 120ms e despachava a ação direto, caindo num descarte simples direto para a pilha de lixo.
- **Ação**:
  - Ao emitir `playCommand`, disparar um estágio visual `CommandCastAnimation`: a carta sobe da mão, posiciona-se no centro da arena iluminada em tom cyan/magenta ("Ativando Comando"), aguarda a leitura tática e viaja suavemente até o Trash.

### 8. Controle de Velocidade das Animações
- **Causa Raiz**: Ausência de controle no `SettingsMenu.tsx` e dependência de tempos estáticos em ms e CSS.
- **Ação**:
  - Criar `animationSpeed.ts` com suporte a `0.75x`, `1x`, `1.5x` e `2x`.
  - Adicionar controle de seleção no [`SettingsMenu.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/SettingsMenu.tsx).
  - Injetar `--sim-anim-speed-mult` no container do playmat para ajustar animações CSS dinamicamente.
  - Fornecer helper `getScaledDuration(baseMs)` para todos os temporizadores `setTimeout`.

---

## Proposta de Mudanças Arquiteturais

```
┌───────────────────────────────────────────────────────────┐
│                     ArenaPlaymat                          │
│  - Define --card-w-std e CSS speed multiplier             │
│  - Renderiza camadas: Board, HandFan, Shields             │
└─────────────────────────────┬─────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ DeckDealAnimation│ │ CombatStrikeAnim │ │CommandCast/Burst │
│ - cardW exato    │ │ - Lunge ao alvo  │ │ - Reveal centro  │
│ - Speed Scaler   │ │ - Return ao slot │ │ - Voo pro Trash  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## Plano de Trabalho Paralelo (Frentes de Execução com Claude)

Para máxima eficiência, o trabalho é estruturado em **3 Agentes Especialistas**, com escopos de arquivos desacoplados:

### Agente 1: Backend & Motor — Iniciativa e Resolução do Bot
- **Responsabilidade**: Sorteio de primeiro jogador nas partidas de treino (50/50), testes de determinismo com seed e garantia de início de turno correto quando o Bot vence.
- **Arquivos**:
  - [`src/modules/simulator/server/trainingMatch.ts`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/server/trainingMatch.ts)
  - [`src/modules/simulator/server/trainingMatch.test.ts`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/server/trainingMatch.test.ts)
  - [`src/modules/simulator/server/matchStore.ts`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/server/matchStore.ts)

### Agente 2: UI Core — Escala, Velocidade e Banners de Turno
- **Responsabilidade**: Controle de velocidade de animação nas configurações, sincronização estrita do tamanho das cartas em `DeckDealAnimation`, `HandFan` e `MulliganModal`, além da exibição contínua dos banners de fase e turno a cada rodada.
- **Arquivos**:
  - [`src/modules/simulator/ui/animationSettings.ts`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/animationSettings.ts) (Novo)
  - [`src/modules/simulator/ui/SettingsMenu.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/SettingsMenu.tsx)
  - [`src/modules/simulator/ui/DeckDealAnimation.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/DeckDealAnimation.tsx)
  - [`src/modules/simulator/ui/PhaseAnnouncementBanner.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/PhaseAnnouncementBanner.tsx)
  - [`src/modules/simulator/ui/MulliganModal.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/MulliganModal.tsx)

### Agente 3: Visual FX — Ataque Físico, Shields/Burst e Comandos
- **Responsabilidade**: Animação de ataque com lunge e retorno, rastreamento de destruição de shields para o Trash, efeito cinemático de Burst 3D e palco de revelação de comandos da mão.
- **Arquivos**:
  - [`src/modules/simulator/ui/BattleSlot.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/BattleSlot.tsx)
  - [`src/modules/simulator/ui/CombatLane.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/CombatLane.tsx)
  - [`src/modules/simulator/ui/CardDepartureAnimation.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/CardDepartureAnimation.tsx)
  - [`src/modules/simulator/ui/BurstModal.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/BurstModal.tsx)
  - [`src/pages/SimulatorMatchPage.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/pages/SimulatorMatchPage.tsx)
  - [`src/index.css`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/index.css)

---

## Prompts para os Agentes Claude

Abaixo estão os prompts prontos para copiar e colar nas instâncias do Claude:

### Prompt — Agente 1 (Backend / Iniciativa 50/50)
````markdown
Você é o Desenvolvedor Senior de Backend responsável pelo motor do simulador do Gundam TCG.
Sua missão é corrigir o sorteio de iniciativa nas partidas contra bot e garantir suporte a testes determinísticos.

Contexto e Requisitos:
1. Atualmente em `src/modules/simulator/server/trainingMatch.ts`, a chamada `createMatch` fixa `firstPlayer: "A"`.
2. Adicione um campo opcional `firstPlayer?: PlayerId` em `CreateTrainingMatchInput`. Se informado, respeite-o (uso principal: testes determinísticos). Caso contrário, sorteie com `Math.random() < 0.5 ? "A" : "B"` — mesmo padrão já usado no matchmaking PvP em `matchStore.ts` (função de fila, linha com `firstPlayer: Math.random() < 0.5 ? "A" : "B"`).
3. NÃO derive o sorteio do `input.seed` — o `seed` já alimenta o RNG de embaralhamento do baralho e de mulligan (`createRng(seed ^ nonce)` em `engine/setup.ts` / `engine/actions.ts`); reutilizar o mesmo seed cru para a decisão de `firstPlayer` correlacionaria as duas coisas e tornaria os testes determinísticos menos confiáveis. Use o novo campo `firstPlayer` explícito para os testes em vez disso.
4. Garanta que quando o bot iniciar ("B"), `maybeEnqueueBotTurn` em `matchStore.ts` processe o turno/mulligan do bot corretamente — esse caminho (bot com decisão pendente, inclusive mulligan) ainda não foi exercitado em produção porque o bot nunca começou uma partida de treino até hoje, então trate como um caminho novo a validar, não apenas reaproveitar.
5. Atualize os testes unitários em `src/modules/simulator/server/trainingMatch.test.ts` validando tanto partidas onde o humano começa (`firstPlayer: "A"`) quanto onde o bot começa (`firstPlayer: "B"`), incluindo o fluxo de mulligan do bot indo primeiro.
6. Execute `pnpm test src/modules/simulator/server/trainingMatch.test.ts` e certifique-se de que todos os testes passem.
````

### Prompt — Agente 2 (UI Core / Velocidade, Banners e Escala)
````markdown
Você é o Desenvolvedor Senior de Front-end responsável pela infraestrutura visual e sincronização de componentes do simulador Gundam TCG.

Sua missão:
1. Controle de Velocidade:
   - Crie `src/modules/simulator/ui/animationSettings.ts` gerenciando o multiplicador de velocidade (0.75x, 1x, 1.5x, 2x) persistido em localStorage (`portal_gundam_sim_anim_speed`).
   - Adicione um seletor no `SettingsMenu.tsx` permitindo ao jogador alternar a velocidade das animações a qualquer momento.
   - Aplique uma variável CSS ou helper `getScaledDuration(ms)` para ajustar durações em JS e CSS.
2. Tamanho Exato das Cartas (Draw / Mulligan / Shields):
   - O `DeckDealAnimation.tsx` já recebe `cardW` correto vindo do `deckStation` em `SimulatorMatchPage.tsx` — não mexa nesse fluxo, exceto se notar alguma regressão pontual.
   - O bug real está em `MulliganModal.tsx`: as cartas usam `<CardFace size="md">` (fixo em 80px via classe Tailwind `w-20`), sem relação com `--card-w-std`. Corrija adicionando `style={{ width: "var(--card-w-std, 2.17rem)" }}` em cada `<CardFace>`, exatamente como já é feito em `HandFan.tsx` (linha com `style={{ width: "var(--card-w-std, 2.17rem)" }}`).
   - Para o `single-draw`, passe a carta real comprada (`cards`) e aumente o tempo base (de 400ms para ~750ms ajustado pela velocidade), permitindo que o saque seja nítido e fluido.
3. Banners Recorrentes de Troca de Turno:
   - `introStage` é uma máquina de estados one-shot de abertura — uma vez em `"complete"` nunca mais volta a `"phase-banner"` sozinha. Desacople a renderização do `PhaseAnnouncementBanner` da condição `introStage === "phase-banner"` (renderize sempre que `phaseBannerQueue.length > 0`) E crie um `useEffect` novo, independente, que observe `turnNumber`/`activePlayer` e popule `phaseBannerQueue` a cada troca de turno a partir do Turno 2 (o Turno 1 já é coberto pelo fluxo de abertura existente — use uma ref pra não duplicar).
   - Sempre que o turno trocar, enfileire: "Seu Turno" / "Turno do Oponente" seguido por "Fase de Compra" -> "Fase de Recuperação" -> "Fase Principal".
4. Execute `pnpm test src/modules/simulator/ui/DeckDealAnimation.test.tsx` e garanta que a suíte passe com 100% de sucesso.
````

### Prompt — Agente 3 (Visual FX / Combate, Shields e Comandos)
````markdown
Você é o Desenvolvedor Senior de Front-end responsável pelas animações de gameplay do simulador Gundam TCG.

Sua missão:
1. Animação de Ataque Físico (Lunge & Return):
   - Causa raiz confirmada: em modo treino, tanto o assento humano quanto o bot entram com `autoPassActionStep: true` (`trainingMatch.ts`), e `settleAutoPasses` (`matchStore.ts`) resolve o Action Step dos dois lados de forma síncrona no servidor ANTES de qualquer resposta chegar ao cliente. Isso significa que o cliente nunca observa `combat.step === "action"` — a primeira view que ele recebe já está em `"damage"` ou além. A condição atual em `applyIncomingView` (`SimulatorMatchPage.tsx`), que só dispara a animação quando `prevCombat.step === "action"`, por isso nunca é satisfeita contra o bot.
   - Corrija ampliando a condição de disparo: dispare `executeAttackStrike` sempre que existia um `prevCombat` com `attackerId` X e o combate atual não tem mais esse `attackerId` ativo (combate ausente, ou trocou de `attackerId`, ou chegou em `"battleEnd"`) — independente de qual era o `step` anterior (`"attack"`, `"block"` ou `"action"`), já que `attackerId`/`currentTarget`/`defendingPlayer` existem em `CombatState` desde o passo `"attack"`.
   - Garanta que a animação aconteça de forma evidente e confiável sempre que um ataque for declarado/resolvido (inclusive contra bots, que é o caso que hoje falha 100% das vezes em modo treino).
   - A carta deve avançar dinamicamente em direção às coordenadas do alvo (unidade inimiga ou trilha de escudos/base), executar o impacto (com tremor e efeito sonoro) e retornar suavemente para seu slot original.
2. Destruição de Shield para o Trash:
   - No método `detectDepartures` de `SimulatorMatchPage.tsx`, adicione a detecção de destruição de shields.
   - Ao perder um escudo, um clone animado deve sair da coordenada de `shieldRail:${pid}` e deslizar visualmente até `trashStation:${pid}`.
3. Revelação Cinemática de Burst:
   - Quando um shield quebrado possuir Burst (`myBurstDecision`), antes de abrir o modal estático, execute a sequência:
     a) O card de shield sai da trilha e viaja até o centro da tela.
     b) Executa um giro 3D (flip de verso para frente) revelando qual é a carta e destacando a palavra "BURST".
     c) Em seguida, o modal de decisão de ativação do Burst é apresentado de forma integrada.
4. Lançamento e Revelação de Cartas de Comando:
   - Ao jogar uma carta de comando da mão (`playCommand`), a carta deve sair da prateleira da mão, posicionar-se no palco central da arena com destaque luminoso ("Ativando Comando"), exibir sua arte e nome por um intervalo (~700ms escalável pela velocidade) e só então voar para a pilha de Trash.
5. Valide no CSS (`src/index.css`) e nos testes unitários relevantes.
````

---

## Plano de Verificação

### Testes Automatizados
- **Iniciativa & Bot**:
  ```bash
  pnpm test src/modules/simulator/server/trainingMatch.test.ts
  ```
- **Animações de Deal & Setup**:
  ```bash
  pnpm test src/modules/simulator/ui/DeckDealAnimation.test.tsx
  ```
- **Componentes de Ação e Slots de Batalha**:
  ```bash
  pnpm test src/modules/simulator/ui/BattleSlot.test.tsx
  pnpm test src/modules/simulator/ui/CardDepartureAnimation.test.tsx
  ```

### Verificação Manual
1. **Sorteio de Iniciativa**: Iniciar 6 partidas seguidas contra o Bot no simulador e verificar que em aproximadamente 50% das vezes o Bot começa no Turno 1 e no restante o jogador começa.
2. **Tamanho das Cartas no Draw e Mulligan**: Observar a compra de mão inicial, mulligan e saque de cada turno. Confirmar que a carta pousa no tamanho idêntico ao das cartas na mão sem nenhum "pulo" de escala.
3. **Banners de Fase**: Passar o turno 1, turno 2 e turno 3. Verificar se as mensagens centrais "Fase de Compra", "Fase de Recuperação" e "Fase Principal" aparecem consistentemente em todos os turnos.
4. **Animação de Ataque**: Declarar ataque contra unidade ou jogador. Confirmar visualmente a carta voando até o alvo, colidindo e retornando.
5. **Shield e Burst**: Tomar ou causar dano de escudo. Confirmar a carta saindo dos escudos pro Trash. Em caso de Burst, confirmar o giro 3D revelando a carta antes da pergunta de ativação.
6. **Cartas de Comando**: Jogar um comando da mão (ex: na Main Phase) e confirmar a revelação centralizada antes do envio ao descarte.
7. **Velocidade dos Efeitos**: Alternar no menu de configurações entre 0.75x, 1x, 1.5x e 2x e verificar a resposta imediata de velocidade em todos os efeitos.

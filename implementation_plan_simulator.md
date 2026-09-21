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
- **Ação**: Tornar dinâmico: se `input.firstPlayer` for passado, respeitá-lo; caso contrário, sortear aleatoriamente entre `"A"` e `"B"` (usando o seed fornecido ou `Math.random() < 0.5`).

### 2. Mudança Brusca de Tamanho no Draw / Mulligan / Shields
- **Causa Raiz**: Em [`DeckDealAnimation.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/DeckDealAnimation.tsx#L125), a largura padrão da carta animada recorre a `anchored ? 84 : 140`. Enquanto isso, o playmat define a escala via `--card-w-std` (`calc(var(--card-w) * 0.66)`), que tipicamente varia entre `40px` e `55px`. Em [`MulliganModal.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/MulliganModal.tsx#L36), o componente usava `size="md"` (`80px`), gerando o contraste imediato.
- **Ação**:
  - Passar a largura exata de `--card-w-std` medida do container do playmat ou do slot alvo.
  - No [`DeckDealAnimation.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/DeckDealAnimation.tsx), sincronizar `w` e `h` com a proporção exata da mão e dos escudos no momento da aterrissagem.
  - Ajustar o espaçamento do leque animado para casar com o leque final do [`HandFan.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/HandFan.tsx).

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
  - Escutar mudanças de turno (`turnNumber` e `activePlayer`) em `useEffect` para enfileirar as transições de fase de cada turno: `"SEU TURNO" / "TURNO DO OPONENTE"`, `"FASE DE COMPRA"`, `"FASE DE RECUPERAÇÃO"` e `"FASE PRINCIPAL"`.

### 4. Animação de Draw Rápida Demais
- **Causa Raiz**: `SINGLE_DRAW_MS = 400` em [`DeckDealAnimation.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/DeckDealAnimation.tsx#L112) e ausência do objeto `cards` para saque individual.
- **Ação**:
  - Passar a carta comprada para o `DeckDealAnimation` no modo `single-draw`.
  - Aumentar a duração base do draw para ~750ms e atrelar ao multiplicador de velocidade de animação.

### 5. Carta Atacando e Retornando ao Lugar (Lunge & Return)
- **Causa Raiz**: Em [`SimulatorMatchPage.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/pages/SimulatorMatchPage.tsx#L581-L586), `executeAttackStrike` só era disparado se `prevCombat.step === "action"`. Em partidas rápidas ou contra o Bot onde os passos de bloco/ação resolvem diretamente, a condição nunca era satisfeita. Além disso, em [`BattleSlot.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/BattleSlot.tsx#L89), a distância era limitada a 160px com `min(mag * 0.65, 160)`.
- **Ação**:
  - Desencadear a animação de ataque assim que o combate entra em resolução de dano (`damage` / `battleEnd`) ou logo após a declaração.
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
2. Altere `createTrainingMatch` para que o primeiro jogador seja sorteado com 50% de chance para "A" e 50% de chance para "B" (Bot), a menos que explicitamente configurado ou determinado por seed em testes.
3. Se `input.seed` for informado, use um gerador de números pseudo-aleatórios determinístico (`createRng(input.seed)`) para decidir o `firstPlayer` mantendo a reprodução de testes. Se não houver seed, use `Math.random() < 0.5 ? "A" : "B"`.
4. Garanta que quando o bot iniciar ("B"), `maybeEnqueueBotTurn` em `matchStore.ts` processe o turno/mulligan do bot corretamente.
5. Atualize os testes unitários em `src/modules/simulator/server/trainingMatch.test.ts` validando tanto partidas onde o humano começa quanto onde o bot começa.
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
   - Elimine o salto de tamanho nas cartas ao final do draw e mulligan em `DeckDealAnimation.tsx`.
   - A animação deve receber e utilizar estritamente a largura de `--card-w-std` medida da arena/mão, sem valores hardcoded como 84px ou 140px.
   - Ajuste `MulliganModal.tsx` para respeitar as proporções da arena em vez de forçar tamanho estático.
   - Para o `single-draw`, passe a carta real comprada e aumente o tempo base (de 400ms para ~750ms ajustado pela velocidade), permitindo que o saque seja nítido e fluido.
3. Banners Recorrentes de Troca de Turno:
   - Modifique `SimulatorMatchPage.tsx` para que o `PhaseAnnouncementBanner` seja exibido em TODOS os turnos subsequentes (Turno 2, 3, etc.), e não apenas no turno 1.
   - Sempre que o turno trocar, enfileire: "Seu Turno" / "Turno do Oponente" seguido por "Fase de Compra" -> "Fase de Recuperação" -> "Fase Principal".
4. Execute `pnpm test src/modules/simulator/ui/DeckDealAnimation.test.tsx` e garanta que a suíte passe com 100% de sucesso.
````

### Prompt — Agente 3 (Visual FX / Combate, Shields e Comandos)
````markdown
Você é o Desenvolvedor Senior de Front-end responsável pelas animações de gameplay do simulador Gundam TCG.

Sua missão:
1. Animação de Ataque Físico (Lunge & Return):
   - Em `SimulatorMatchPage.tsx` e `BattleSlot.tsx`, garanta que a animação de ataque aconteça de forma evidente e confiável sempre que um ataque for declarado/resolvido (inclusive contra bots).
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

# Plano de Ação v2: Ritmo, Velocidade e Alvo Inline do Simulador

Continuação de `implementation_plan_simulator.md` (mesclado em `dev`: commits `879835f`, `fc63616`, `c438cf5`, `922ddff`, `b30a055`). Este documento cobre o feedback do teste manual pós-merge: 1 item já resolvido, 3 itens novos diagnosticados e verificados contra o código atual antes de qualquer correção.

**Status dos itens do feedback:**

| # | Item | Status |
|---|------|--------|
| 0 | Timeout de 300s em `selfPlayHeuristic.test.ts` | ✅ Resolvido (bump pra 600s, commit pendente de push) |
| 1 | Tamanho de carta no Draw/Mulligan/Shield "quase certo" | 🔍 Causa raiz encontrada — plano abaixo |
| 2 | Velocidade 0.75x/1.5x/2x não muda nada visualmente | 🔍 Causa raiz encontrada — plano abaixo |
| 3 | Bot "atropela" as próprias ações, sem dar tempo às animações | 🔍 Causa raiz encontrada — **maior risco/escopo** |
| 4 | Modal de alvo do Mikazuki → glow inline no tabuleiro | 🔍 Escopo definido — **redesenho de UX compartilhado, maior risco/escopo** |

---

## Item 1 — Tamanho de carta ainda "quase certo" no Mulligan

### Causa raiz confirmada
O fix do Agente 2 (`MulliganModal.tsx`) usa `style={{ width: "var(--card-w-std, 2.17rem)" }}`. Isso está estruturalmente correto (inline `style` vence a classe Tailwind de `CardFace`), MAS `--card-w-std` só existe como custom property na raiz do `<ArenaPlaymat>` (`ArenaPlaymat.tsx:167`, `"[--card-w-std:calc(var(--card-w)*0.66)]"` aplicada no próprio `containerRef` do componente). `<MulliganModal>` é renderizado em `SimulatorMatchPage.tsx:2399`, **fora** da subtree do `<ArenaPlaymat>` (que abre em `2268` e fecha em `2327`/`2334`) — é um `fixed inset-0` irmão, não descendente.

Resultado: `var(--card-w-std, 2.17rem)` nunca enxerga o valor real calculado por `useArenaScale` — sempre cai no fallback fixo `2.17rem` (~34.7px a 16px de root). Isso é "quase certo" porque 2.17rem é uma aproximação razoável do valor típico, mas diverge conforme o tamanho de tela/viewport real.

O `DeckDealAnimation` (draw/mulligan-anim/deal-shields) **não tem esse problema** — ele já recebe `cardW` como número medido via `board.rectOf('deckStation:${seat}')?.width` (JS, não CSS var), então sempre bate com o tamanho real da arena.

### Ação
Em vez de depender da CSS var, `MulliganModal` deve receber a largura medida como prop numérica — igual ao `DeckDealAnimation`:
- Adicionar `cardW: number` a `MulliganModalProps`.
- Em `SimulatorMatchPage.tsx`, medir `board.rectOf('deckStation:${seat}')?.width` (mesma fonte já usada pra `DeckDealAnimation`) e passar como `cardW={...}` pro `<MulliganModal>`.
- Trocar `style={{ width: "var(--card-w-std, 2.17rem)" }}` por `style={{ width: cardW || undefined }}` (fallback pro comportamento atual — `CARD_FACE_WIDTH.md` — se por algum motivo a medição falhar antes do primeiro layout).

---

## Item 2 — Controle de velocidade não afeta as animações

### Causa raiz confirmada
`animationSettings.ts` (Agente 2) está corretamente implementado — persiste em `localStorage`, expõe `getScaledDuration(ms)` e escreve `--sim-anim-speed-mult` em `:root`. O problema é que **quase nada consome isso ainda**:

- ✅ Usam `getScaledDuration`: só `DeckDealAnimation.tsx` (via `singleDrawMs`, exclusivo do modo `single-draw`) e `PhaseAnnouncementBanner.tsx`.
- ❌ `DeckDealAnimation.tsx`: `SHUFFLE_MS` (1300), `DEAL_STAGGER` (90), `SHIELD_STAGGER` (160), `FLIGHT_MS` (450), `HAND_REVEAL_HOLD` (340), `SHIELD_STACK_HOLD` (250), `RETURN_MS` (340) — todos hardcoded, usados por `deal-hand`/`mulligan`/`deal-shields`/`shuffle` (os modos mais visíveis).
- ❌ `BattleSlot.tsx` (`lungeStyle`): `transition: "transform 240ms ..."` e `"transform 260ms ..."` hardcoded.
- ❌ `BurstRevealStage.tsx`: `FLY_MS`/`FLIP_MS`/`HOLD_MS` — literalmente comentado `// TODO: escalar por getScaledDuration quando animationSettings.ts existir` (o Agente 3 rodou num worktree paralelo que ainda não tinha o arquivo do Agente 2).
- ❌ `CommandCastAnimation.tsx`: mesmo TODO, `RISE_MS`/`HOLD_MS`/`FLY_MS`.
- ❌ `SimulatorMatchPage.tsx`: TODOS os `setTimeout` hardcoded — `executeAttackStrike` (260/220/280ms), `playCommand` (60/300/120/100/100ms), timers de estágio (994-1100).
- ❌ `src/index.css`: **13 declarações `animation: name Xms ...`** (`sim-anim-card-flip`, `sim-anim-land-soft`, `sim-anim-drop-heavy`, `sim-anim-shuffle*`, `sim-anim-deal`, `sim-anim-return`, `sim-shockwave-*`, `sim-shield-barrier`, `sim-anim-depart*`) — nenhuma referencia `var(--sim-anim-speed-mult)`.

Ou seja: o seletor de velocidade no menu funciona (persiste, atualiza a CSS var), mas ~95% dos efeitos visuais do simulador ignoram completamente o multiplicador.

### Ação
Retrofit mecânico (baixo risco, sem mudar lógica, só escalar durações):
1. **CSS (`index.css`)**: trocar cada `animation: name Xms ...` por `animation: name calc(Xms / var(--sim-anim-speed-mult, 1)) ...`. Cuidado com os `infinite` (`sim-anim-shuffle*`) — o `calc()` funciona igual, só afeta a duração de cada ciclo do loop.
2. **`BattleSlot.tsx`**: trocar os 2 literais de `lungeStyle` por `getScaledDuration(240)`/`getScaledDuration(260)` (importar de `./animationSettings`).
3. **`DeckDealAnimation.tsx`**: escalar `SHUFFLE_MS`, `DEAL_STAGGER`, `SHIELD_STAGGER`, `FLIGHT_MS`, `HAND_REVEAL_HOLD`, `SHIELD_STACK_HOLD`, `RETURN_MS` com `getScaledDuration()` no ponto de uso (não nos `const` do topo do módulo, que são avaliados 1x no import — calcular dentro do componente/função, como já foi feito com `singleDrawMs`).
4. **`BurstRevealStage.tsx` / `CommandCastAnimation.tsx`**: importar `getScaledDuration` de `./animationSettings` (já existe agora, TODO resolvido), escalar `FLY_MS`/`FLIP_MS`/`HOLD_MS`/`RISE_MS` nos `setTimeout` E nos `transition`/`animationDuration` inline.
5. **`SimulatorMatchPage.tsx`**: escalar os `setTimeout` de `executeAttackStrike` (260/220/280) e `playCommand` (60/300/120/100/100) com `getScaledDuration()`. **Não mexer na estrutura de controle** — só envolver os literais numéricos. (Os timers de estágio 994-1100 já são da máquina de abertura/intro, não fazem parte do feedback — deixar como estão a menos que也 sejam facilmente escaláveis sem risco.)

---

## Item 3 — Bot "rusha" as ações, animações não acompanham (MAIOR RISCO)

### Causa raiz confirmada
Duas causas que se somam:

1. **O bot não tem NENHUM ritmo entre ações.** `services/sim-bot/driveBotTurn.mjs:113-126` roda um `for` síncrono chamando `await commit(action)` action após action, sem qualquer delay — em produção `commit` é 1 POST HTTP por ação. Um turno inteiro do bot (comprar, jogar 2-3 unidades, atacar, passar) pode completar em menos de 1 segundo de tempo real.

2. **O cliente não enfileira as atualizações recebidas.** `useMatchTransport` chama `applyIncomingView` diretamente pra cada `match:view_update` que chega (WebSocket, `SimulatorMatchPage.tsx:666-668`). `applyIncomingView` já tem UM mecanismo de espera (o `.then()` do `executeAttackStrike` antes de `setMatchView`, `SimulatorMatchPage.tsx:587-593`), mas é local a essa chamada — se uma 2ª `match:view_update` chegar enquanto a 1ª ainda está com uma animação de ataque pendente, `applyIncomingView` roda de novo, imediatamente, por cima, sem esperar a primeira terminar. Não existe uma fila real: cada mensagem processa por conta própria, correndo em paralelo com qualquer animação ainda em voo.

Resultado combinado: o bot manda 5 atualizações em 800ms, o cliente recebe as 5 quase juntas, e no máximo UMA (a que por acaso já estava com uma promise de animação pendente) segura o `setMatchView` — as outras 4 aplicam o estado final na hora, sem nenhuma animação visível.

### Ação (arquitetural — a mais arriscada deste plano)
Introduzir uma **fila de reprodução serializada** no cliente: toda `match:view_update` recebida entra numa fila; um único "drenador" processa uma de cada vez, esperando a animação completa (ataque, shields→trash, burst reveal, command cast) terminar antes de processar a próxima da fila.

Esboço de implementação:
- Um `useRef<SimulatorMatchView[]>` como fila + um `useRef<boolean>` "processando agora".
- `applyIncomingView` deixa de aplicar view diretamente: só faz `push` na fila e chama um `drainQueue()` (que é no-op se já tiver um drain em andamento).
- `drainQueue` é um loop assíncrono: tira a próxima view da fila, roda TODAS as animações que essa transição dispara (`detectDepartures`, `executeAttackStrike`, abertura de `BurstRevealStage`/`CommandCastAnimation` se aplicável) e só então `setMatchView` + repete pra próxima da fila.
- **Casos de borda que precisam de decisão explícita, não just "codar e ver":**
  - Reconexão/resync REST (fetch completo do estado) não deveria tocar num backlog gigante de animações — provavelmente deve **pular a fila e ir direto pro estado atual** (sem replay), já que resync não é uma sequência de eventos, é um snapshot.
  - Fim de jogo (`gameOver`) deve limpar a fila e não continuar tentando animar depois que a partida já acabou.
  - O jogador consegue continuar interagindo (jogar cartas, etc.) enquanto o bot "está com backlog de animação"? Recomendo que sim pro PRÓPRIO turno do jogador (a fila só afeta a exibição de eventos que já aconteceram no servidor, não trava input do jogador salvo quando for literalmente turno do bot), mas isso precisa ficar claro no prompt pro agente não travar a partida sem querer.
  - Timeout de segurança por item da fila (se uma animação nunca chamar seu `onDone` por bug, a fila não pode travar pra sempre — usar um `Promise.race` com um timeout generoso, tipo 5s, como rede de segurança).

**Recomendação**: implementar isso DEPOIS do Item 2 (retrofit de velocidade) estar mesclado, já que a fila vai orquestrar durações que precisam já estar escaláveis por velocidade — fazer na ordem inversa significaria retrabalhar os pontos de espera duas vezes.

---

## Item 4 — Modal de alvo (Mikazuki e cartas similares) → glow inline no tabuleiro (MAIOR RISCO)

### Causa raiz / contexto
Hoje, QUALQUER efeito com alvo (Mikazuki `ST05-010`, e qualquer outra carta com `【When Paired】`/`【Attack】`/`【Deploy】`/`【Main】`/`【Action】` que escolha alvo) resolve via `AbilityResolutionModal.tsx` (439 linhas) — um painel genérico que lista os alvos legais como pills clicáveis dentro do próprio modal (não no tabuleiro). Esse componente NÃO é exclusivo do Mikazuki: também cobre `handChoice`, `deckReorder`, `enumChoice`, `deckTopReveal`, `trashSearch` — tipos de escolha que não têm um "lugar no tabuleiro" natural pra fazer glow.

O sistema de glow inline JÁ EXISTE pra targeting de ataque: `BattleSlot.tsx` tem os props `legalTarget` (verde, `ring-emerald-400`) e `selected` (azul, `border-primary`). Só que esse sistema tem UMA cor de "alvo legal" só (verde) — nunca precisou diferenciar aliado de inimigo, porque ataque só mira inimigo. O pedido do Willen é uma variação nova: **verde pra alvo aliado legal, vermelho pra alvo inimigo legal**, e o "selecionado" ganha glow por cima da carta inteira — só then confirmar/cancelar num modal enxuto.

A confusão visual relatada ("minhas unidades na primeira linha, do oponente na segunda, mas parece invertido") é, muito provavelmente, um sintoma do modal atual mostrar os alvos como uma LISTA PLANA (sem contexto de tabuleiro/lado), não uma linha real do board. Migrar pro glow inline (que usa o tabuleiro real, já corretamente espelhado pelo redesenho "Nível Arena" — jogador embaixo, oponente em cima) deve eliminar essa confusão como efeito colateral, sem precisar de nenhum fix visual à parte.

### Escopo da mudança (IMPORTANTE: não é "trocar 1 componente", é redesenhar o fluxo de alvo compartilhado)
1. **`BattleSlot.tsx`**: novos props independentes dos existentes (`legalTarget`/`selected` continuam intocados, servem pro ataque) — ex.: `abilityTargetPool?: "ally" | "enemy" | null` (verde/vermelho) e `abilitySelected?: boolean` (glow de seleção, pode reaproveitar o estilo de `selected` ou um novo). NÃO reaproveitar/pintar `legalTarget` de vermelho — isso mudaria a UX de ataque, que não foi pedido.
2. **`AbilityResolutionModal.tsx`**: quando o item atual da fila (`itemFor(specId)`) tiver alvo(s) do tipo Unit (própria E/OU inimiga — como o Mikazuki, que tem `legalTargets` + `secondaryTarget`), NÃO renderizar a lista de pills — renderizar só o header (ordenação de gatilhos simultâneos, se houver) + toggle Ativar/Pular (se opcional) + Confirmar/Cancelar. A seleção em si acontece clicando nas Units no tabuleiro. Pra `handChoice`/`deckReorder`/`enumChoice`/`deckTopReveal`/`trashSearch`, MANTER o modal completo como está — esses não têm equivalente de glow no tabuleiro.
3. **`SimulatorMatchPage.tsx`**: quando `myPendingDecision?.kind === "abilityResolution"` e o item atual da fila for de alvo-em-Unit, rotear cliques nos `BattleSlot` (via `onSelect`, já existe o padrão de clique-pra-selecionar do targeting de ataque) pra alternar seleção/deseleção do alvo (permitir trocar de alvo clicando em outro, ou desfazer clicando de novo no mesmo — igual foi pedido). Isso precisa coexistir com o click handling de ataque já existente sem quebrar um ao outro (usar o mesmo padrão de "modo ativo" — só uma dessas seleções está ativa por vez, nunca as duas ao mesmo tempo).
4. **Mikazuki tem 2 pools de alvo simultâneos** (`legalTargets` = própria Unit, `secondaryTarget.legalTargets` = Unit inimiga) — os dois precisam de glow ativo ao mesmo tempo (verde nas seções aliadas legais, vermelho nas inimigas legais), com seleção independente pra cada pool.

### Recomendação de escopo pra 1ª rodada
Dado o tamanho real disso (é um redesenho de UX que toca TODO efeito com alvo em Unit, não só o Mikazuki), recomendo entregar a 1ª versão cobrindo:
- Alvo único em Unit (a maioria dos casos hoje).
- Alvo duplo simultâneo (Mikazuki) como caso explícito de teste.
- Deixar `handChoice`/`deckReorder`/`enumChoice`/`deckTopReveal`/`trashSearch` exatamente como estão (modal completo) — fora de escopo aqui.

---

## Plano de Execução (ordem importa — ver dependências abaixo)

```
Onda 1 (paralelo, worktree isolado):
  Agente 1 — Item 1 (Mulligan cardW) + Item 2 (retrofit de velocidade)
  Agente 3 — Item 4 (glow inline de alvo)
       ↓ merge dos dois em dev
Onda 2 (sequencial, depende da Onda 1):
  Agente 2 — Item 3 (fila de animação / ritmo do bot)
```

Item 3 depende do retrofit de velocidade (Item 2) já estar mesclado — a fila vai orquestrar durações que precisam estar escaláveis, fazer ao contrário duplicaria trabalho. Item 4 é independente dos outros dois (mexe em seleção de alvo, não em timing/transporte), por isso roda em paralelo com o Agente 1.

### Prompt — Agente 1 (Mulligan cardW + Retrofit de Velocidade)

```markdown
Você é o Desenvolvedor Sênior de Front-end responsável por fechar 2 pendências de polimento visual do simulador Gundam TCG, já com causa raiz confirmada em `implementation_plan_simulator_v2.md` (itens 1 e 2).

Escopo de arquivos:
- src/modules/simulator/ui/MulliganModal.tsx
- src/pages/SimulatorMatchPage.tsx (só a prop nova pro MulliganModal + os setTimeout de executeAttackStrike/playCommand — NÃO mexa em applyIncomingView/useMatchTransport, isso é de outro agente)
- src/modules/simulator/ui/animationSettings.ts (só se precisar adicionar algo, não deveria)
- src/modules/simulator/ui/DeckDealAnimation.tsx
- src/modules/simulator/ui/BattleSlot.tsx (só os 2 literais de duração em `lungeStyle`, nada mais)
- src/modules/simulator/ui/BurstRevealStage.tsx
- src/modules/simulator/ui/CommandCastAnimation.tsx
- src/index.css

Tarefas:

1. MulliganModal (tamanho de carta):
   - `--card-w-std` só existe dentro da subtree do `<ArenaPlaymat>`; `<MulliganModal>` é renderizado como irmão fora dessa subtree em SimulatorMatchPage.tsx, então `var(--card-w-std, 2.17rem)` sempre cai no fallback fixo.
   - Adicione `cardW: number` a `MulliganModalProps`. Em SimulatorMatchPage.tsx, meça `board.rectOf('deckStation:${seat}')?.width` (mesma fonte que já alimenta o DeckDealAnimation) e passe como `cardW={...}`.
   - Em cada `<CardFace>` do modal, troque `style={{ width: "var(--card-w-std, 2.17rem)" }}` por `style={{ width: cardW || undefined }}`.

2. Retrofit de velocidade (getScaledDuration/--sim-anim-speed-mult):
   - `src/index.css`: para cada `animation: nome Xms ...` relacionado ao simulador (sim-anim-card-flip, sim-anim-land-soft, sim-anim-drop-heavy, sim-anim-shuffle/-left/-right/-center, sim-anim-deal, sim-anim-return, sim-shockwave-cyan/-amber, sim-shield-barrier, sim-anim-depart/-destroy), troque `Xms` por `calc(Xms / var(--sim-anim-speed-mult, 1))`.
   - `BattleSlot.tsx`: importe `getScaledDuration` de `./animationSettings`; troque os 2 literais (240ms, 260ms) em `lungeStyle` por `getScaledDuration(240)`/`getScaledDuration(260)`.
   - `DeckDealAnimation.tsx`: escale `SHUFFLE_MS`, `DEAL_STAGGER`, `SHIELD_STAGGER`, `FLIGHT_MS`, `HAND_REVEAL_HOLD`, `SHIELD_STACK_HOLD`, `RETURN_MS` com `getScaledDuration()` no ponto de uso (como já foi feito com `singleDrawMs` — não no `const` do topo do módulo, que só roda 1x no import).
   - `BurstRevealStage.tsx` e `CommandCastAnimation.tsx`: importe `getScaledDuration` de `./animationSettings` (resolva o TODO existente), escale `FLY_MS`/`FLIP_MS`/`HOLD_MS`/`RISE_MS` tanto nos `setTimeout` quanto nos `transition`/`animationDuration` inline.
   - `SimulatorMatchPage.tsx`: em `executeAttackStrike`, escale os 3 `setTimeout` (260/220/280ms). Em `playCommand`, escale os 5 `setTimeout` (60/300/120/100/100ms). Só envolva os literais com `getScaledDuration()` — não mude a estrutura de controle.

3. Rode a suíte de UI (`pnpm test src/modules/simulator/ui`) e garanta que passe. Ajuste testes existentes se alguma asserção dependia de um valor de duração hardcoded que agora é dinâmico (mocke `getScaledDuration` ou `getSavedAnimSpeed` se precisar).
4. `tsc -b` e `eslint` limpos nos arquivos tocados.
5. Commit local no branch do worktree, sem push, sem mexer em dev/main.
```

### Prompt — Agente 2 (Fila de Animação / Ritmo do Bot) — RODAR DEPOIS do Agente 1 mesclado

```markdown
Você é o Desenvolvedor Sênior de Front-end responsável pela correção mais arquitetural deste plano: hoje o bot de treino roda suas ações sem NENHUM ritmo (services/sim-bot/driveBotTurn.mjs faz um `for` síncrono chamando `commit(action)` em sequência sem delay), e o cliente processa cada `match:view_update` recebido imediatamente e sem fila (`useMatchTransport` chama `applyIncomingView` direto pra cada mensagem, SimulatorMatchPage.tsx). O resultado: quando o bot faz várias ações rápido, o cliente recebe várias atualizações quase juntas e a maioria delas pula a animação (só a que por acaso encontrar uma promise de animação pendente segura o `setMatchView`; as outras aplicam o estado final na hora).

Isso já foi analisado e documentado em `implementation_plan_simulator_v2.md`, item 3 — leia a seção completa antes de começar, ela tem a causa raiz exata com os números de linha.

Escopo de arquivos:
- src/pages/SimulatorMatchPage.tsx (aqui é onde a maior parte da mudança acontece — `applyIncomingView`, a integração com `useMatchTransport`, e qualquer estado novo pra fila)
- Não toque nos arquivos que o Agente 1 já retrofit ou de velocidade (DeckDealAnimation.tsx, BattleSlot.tsx, BurstRevealStage.tsx, CommandCastAnimation.tsx, index.css, MulliganModal.tsx) — a menos que precise ADICIONAR uma chamada de espera onde já existe uma, sem mudar as durações que o Agente 1 já escalou.

Tarefas:

1. Implemente uma fila de reprodução serializada pras views recebidas via socket/SSE:
   - Toda `match:view_update` que chega vira um item numa fila (ex.: `useRef<SimulatorMatchView[]>`), em vez de chamar `applyIncomingView` direto.
   - Um "drenador" assíncrono processa 1 item de cada vez: roda TODA a coreografia de animação que aquela transição dispara (detectDepartures, executeAttackStrike, abertura de BurstRevealStage/CommandCastAnimation se for o caso) e só DEPOIS de tudo terminar aplica `setMatchView` e processa o próximo item da fila.
   - Um novo item que chega enquanto o drenador já está processando só entra na fila — não interrompe o item atual.

2. Casos de borda que PRECISAM de tratamento explícito (não pule nenhum):
   - Resync via REST/fetch completo (reconexão) deve pular a fila e aplicar o estado direto — não é uma sequência de eventos pra "reproduzir", é um snapshot do estado atual.
   - `gameOver` deve esvaziar a fila (sem tentar continuar animando eventos que já não importam mais).
   - O jogador precisa continuar conseguindo interagir (jogar carta, atacar) no PRÓPRIO turno mesmo com uma fila de animações do bot ainda drenando de um turno anterior — a fila não pode travar globalmente a página, só pautar a ORDEM em que os efeitos visuais aparecem.
   - Coloque um timeout de segurança por item da fila (ex.: 5s) — se uma animação nunca chamar seu callback de conclusão por causa de algum bug, a fila não pode travar pra sempre; force o avanço e logue um aviso.

3. Escreva testes para a lógica da fila em isolamento (extraia a lógica de "dado uma sequência de views, em que ordem/tempo elas são processadas" pra uma função ou hook testável, se possível, em vez de deixar tudo só dentro do componente gigante — mais fácil de testar e menos arriscado).
4. Rode manualmente contra o bot depois (ou peça pro Willen) — isso é o tipo de mudança que precisa de QA real além de teste automatizado, já que trata de timing perceptível.
5. `tsc -b` e `eslint` limpos. Suíte de UI passando.
6. Commit local no branch do worktree, sem push, sem mexer em dev/main.
```

### Prompt — Agente 3 (Glow Inline de Alvo — Mikazuki e similares)

```markdown
Você é o Desenvolvedor Sênior de Front-end responsável por substituir a seleção de alvo via modal (pra efeitos que miram Units, como ST05-010 Mikazuki Augus — "escolha 1 Unit própria e 1 Unit inimiga, cause 1 de dano em cada") por seleção inline no tabuleiro, reaproveitando o padrão visual já usado no targeting de ataque, mas com uma variação nova de cor por lado.

Leia `implementation_plan_simulator_v2.md`, item 4, antes de começar — tem o escopo exato e os avisos de o que NÃO mexer.

Escopo de arquivos:
- src/modules/simulator/ui/BattleSlot.tsx (props NOVOS, não mexer em `legalTarget`/`selected` existentes — aqueles são do targeting de ataque e não podem mudar de comportamento)
- src/modules/simulator/ui/AbilityResolutionModal.tsx
- src/pages/SimulatorMatchPage.tsx (wiring do clique nos BattleSlot quando há uma decisão de habilidade pendente com alvo em Unit — reaproveite o padrão que já existe pro clique de declarar ataque, não invente um sistema paralelo)

Tarefas:

1. Em `BattleSlot.tsx`, adicione props independentes dos existentes: `abilityTargetPool?: "ally" | "enemy" | null` (verde = ally, vermelho = enemy — reaproveite o glow verde já usado em `legalTarget` como referência de intensidade/estilo pro "ally", crie um equivalente em vermelho/rose pro "enemy") e `abilitySelected?: boolean` (glow por cima da carta inteira quando já selecionada — pode ser um terceiro estilo ou reaproveitar visualmente o de `selected`, sua escolha, mas tem que ser visualmente distinto de `legalTarget`/`selected` pra não confundir com targeting de ataque acontecendo ao mesmo tempo). NÃO repinte `legalTarget` de vermelho — isso mudaria o targeting de ataque, que já funciona e não foi pedido.

2. Em `AbilityResolutionModal.tsx`: quando o item atual da fila de decisão (`itemFor(specId)`) tiver alvo(s) do tipo Unit (`legalTargets` e/ou `secondaryTarget.legalTargets` apontando pra Units, não hand/deck), NÃO renderize a lista de pills desse item — renderize só cabeçalho (ordenação, se houver mais de 1 gatilho simultâneo), toggle Ativar/Pular (se `optional`) e os botões Confirmar/Cancelar. Para os outros tipos (`handChoice`, `deckReorder`, `enumChoice`, `deckTopReveal`, `trashSearch`), mantenha o modal exatamente como está hoje — fora de escopo.

3. Em `SimulatorMatchPage.tsx`: quando `myPendingDecision?.kind === "abilityResolution"` e o item atual da fila for de alvo-em-Unit, ligue os cliques nos `BattleSlot` correspondentes (via `onSelect`, mesmo padrão já usado pro clique de declarar ataque) pra alternar seleção — clicar seleciona, clicar de novo no mesmo desfaz, clicar em outro alvo legal troca a seleção. Isso e o modo de targeting de ataque nunca podem estar ativos ao mesmo tempo (são estados mutuamente exclusivos — a partida só tem 1 decisão pendente por vez de qualquer forma, então isso deveria já vir de graça, mas confirme).

4. Mikazuki tem 2 pools simultâneos (aliado E inimigo) — ambos os glows (verde nas Units aliadas legais, vermelho nas inimigas legais) precisam estar ativos ao mesmo tempo, com seleção independente por pool. Teste esse caso especificamente — é o motivo de esse redesenho ter sido pedido.

5. Escopo desta rodada: cobrir alvo único e alvo duplo simultâneo em Unit (a maioria dos casos hoje, incluindo Mikazuki). NÃO tente cobrir handChoice/deckReorder/enumChoice/deckTopReveal/trashSearch — esses continuam no modal como estão.

6. Rode `pnpm test src/modules/simulator/ui/AbilityResolutionModal.test.tsx src/modules/simulator/ui/BattleSlot.test.tsx` e ajuste/adicione testes cobrindo o novo fluxo (pelo menos: glow aparece nos alvos legais corretos, seleção alterna ao clicar, e o caso de 2 pools simultâneos do Mikazuki).
7. `tsc -b` e `eslint` limpos.
8. Commit local no branch do worktree, sem push, sem mexer em dev/main.
```

---

## Plano de Verificação

### Automatizado
```bash
pnpm test src/modules/simulator/ui
pnpm test src/modules/simulator/ui/AbilityResolutionModal.test.tsx src/modules/simulator/ui/BattleSlot.test.tsx
npx tsc -b
npx eslint src/pages/SimulatorMatchPage.tsx src/modules/simulator/ui/
```

### Manual (Willen)
1. **Mulligan**: abrir uma partida nova, comparar visualmente a mão do modal de mulligan com a mão real logo depois — têm que ser pixel-idênticas em qualquer tamanho de janela.
2. **Velocidade**: trocar entre 0.75x/1x/1.5x/2x no menu e observar TODAS as animações (draw, shuffle, deal-shields, ataque, burst, comando) — todas devem mudar de ritmo perceptivelmente, não só o single-draw.
3. **Ritmo do bot**: passar o turno pro bot várias vezes seguidas, observar se cada ação dele (jogar carta, atacar, etc.) tem tempo de aparecer visualmente antes da próxima começar.
4. **Alvo do Mikazuki**: jogar o Mikazuki (When Paired), confirmar que aparece glow verde na(s) Unit(s) própria(s) elegível(is) e vermelho na(s) inimiga(s), que dá pra trocar/desfazer a seleção antes de confirmar, e que não há mais confusão de "que unidade é de quem".

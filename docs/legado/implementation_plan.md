# Plano de Implementação: Refinamento Arena 3D, Ergonomia e Espelhamento

Baseado na análise forense das 10 imagens enviadas pelo usuário, este plano estabelece os refinamentos críticos para corrigir a dispersão de elementos em monitores widescreen, eliminar colisões verticais na Battle Area e modernizar o inspetor de cartas com suporte a telemetria lateral e hover de pilotos linkados.

---

## User Review Required

> [!IMPORTANT]
> **Decisão Chave 1: Reagrupamento Espacial (Fim do `justify-between`)**
> Os recursos deixam de ficar nas extremidades do canvas e passam a ficar **colados diretamente às suas respectivas Battle Areas** (recursos do oponente logo acima dos slots inimigos; seus recursos logo abaixo dos seus slots), eliminando o abismo central vazio (destacado na Imagem 2).

> [!IMPORTANT]
> **Decisão Chave 2: Espelhamento Completo do Oponente**
> Conforme a Imagem 8: No lado do jogador, Base/Shields ficam na **esquerda** e Deck/Trash na **direita**. No lado do oponente, a disposição é espelhada: Base/Shields na **direita** e Deck/Trash na **esquerda**, simulando a perspectiva real de dois jogadores frente a frente.

> [!IMPORTANT]
> **Decisão Chave 3: Botões de Ação em Overlay**
> Os botões `Atacar`, `Mirar aqui` e `Blocker` no `BattleSlot.tsx` deixam de ser uma div abaixo da carta (que aumentava a altura em 44px e causava a colisão da Imagem 1) e viram **overlays flutuantes no rodapé da própria carta**, mantendo a altura externa travada em `aspect-[63/88]`.

---

## Proposed Changes

### Camada de Apresentação e Tabuleiro (`src/modules/simulator/ui/`)

---

#### [MODIFY] [ArenaPlaymat.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/ArenaPlaymat.tsx)
- Reorganizar a estrutura em 3 colunas principais:
  - **Coluna Esquerda:** Base no topo + Cascata vertical de 6 Shields sobrepostos.
  - **Coluna Central (Teatro de Batalha):**
    - Linha de Recursos do oponente (horizontal, colada no topo dos slots dele).
    - Battle Area do oponente (6 slots).
    - Linha Central (The Seam).
    - Battle Area do jogador (6 slots).
    - Linha de Recursos do jogador (horizontal, colada na base dos slots dele).
  - **Coluna Direita:** Coluna tática vertical com Exílio, Lixo (Trash) e Deck.
- Implementar o espelhamento do oponente (Base/Shields na direita do oponente, Deck na esquerda).
- Elevar a escala base `--card` para `clamp(3.5rem, 6.5vw, 6.2rem)` para preencher o espaço do monitor com impacto visual.

#### [MODIFY] [BattleSlot.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/BattleSlot.tsx)
- Transformar botões de combate em overlay absoluto (`absolute bottom-1 inset-x-1 z-20`) sem alterar a altura do slot.
- Exibir AP e HP nos cantos inferiores da carta sem rótulos textuais redundantes.

#### [MODIFY] [DockedPilot.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/DockedPilot.tsx)
- Posicionar a carta do piloto acoplada por baixo da Unit, mostrando apenas a faixa do rosto e bônus de combate `+AP/+HP` (estilo Mobile Suit Arena).

#### [MODIFY] [ShieldRail.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/ShieldRail.tsx) & [BaseCardGauge.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/BaseCardGauge.tsx)
- Eliminar textos redundantes (`"6 SHIELDS"`, `"BASE EX"`, etc.).
- Cascata vertical sobreposta de 6 escudos de cima para baixo.

#### [MODIFY] [CardInspectorModal.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/CardInspectorModal.tsx)
- Renderizar a arte da carta em tamanho grande no centro da tela (70-80% do viewport).
- Botão flutuante na lateral da carta que abre uma gaveta deslizante (*slide-out*) com telemetria, traits e regras.
- Link de Piloto interativo: passar o mouse sobre o nome do piloto (ex: `Suletta Mercury`) abre um popover flutuante exibindo a carta do piloto correspondente e sinaliza se está disponível no deck do jogador.

#### [MODIFY] [HandFan.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/HandFan.tsx)
- Cartas injogáveis: filtro preto e branco (`grayscale(100%) brightness(0.65)`).
- Cartas jogáveis: cores vivas + glow ciano.
- Clique em cartas de ação direta inicia o deploy/pagamento sem abrir modal intermediário burocrático.

---

## Verification Plan

### Automated Tests
```bash
# Execução da suíte completa de testes (317+ testes devem passar)
pnpm test

# Validação estrita de tipos TypeScript
pnpm run check:types

# Checagem de linter no simulador
pnpm run lint:simulator
```

### Manual Verification
1. **Widescreen e Notebook 14"**: Verificar que o vazio central desapareceu e as cartas preenchem o campo de forma proporcional.
2. **Colisão de Unidades**: Confirmar que o botão "Atacar" não empurra a unidade para a linha central.
3. **Espelhamento do Oponente**: Checar que os Shields e Base do oponente estão no lado direito do campo dele, e o Deck na esquerda.
4. **Deck do Oponente Oculto**: Confirmar que o deck do oponente não exibe contagem numérica de cartas.
5. **Modal com Gaveta Lateral & Pilot Link**: Abrir uma unidade com link (ex: Aerial), alternar a gaveta lateral e passar o mouse sobre o nome do piloto para ver a carta flutuante da Suletta.

---

## Sprint 6: Nova Rodada de Correções (Widescreen, Zonas, Mão, Modal e Bug Urgente de Alvo)

Baseado em 4 screenshots anotados enviados pelo Willen em 2026-09-03 sobre a build
resultante dos Sprints 5.1–5.3 (já mergeados). Detalhamento completo — diagnóstico
por arquivo/linha e os 4 prompts prontos pra Claude Code — está em
`PLANO_REFINAMENTO_ARENA_3D.md`, seção 4. Este registro resume as decisões pra quem
só lê este arquivo.

## User Review Required

> [!IMPORTANT]
> **Decisão Chave 1: Ordem de execução — bug de motor primeiro**
> O PROMPT 1 (Sprint 6) corrige uma jogada real quebrada (parear Amuro Ray ou Gundam
> ST01-002 falha com erro de "alvo não resolvido"). Isso é tratado como prioridade
> alta e roda ANTES dos 3 prompts de layout/CSS — jogadores podem estar perdendo
> jogadas por causa disso agora, diferente dos outros itens que são só estéticos.

> [!IMPORTANT]
> **Decisão Chave 2: o bug do PROMPT 1 é 100% client-side**
> Investigação confirmou que `engine/deploy.ts`/`engine/actions.ts` já suportam
> `pairWithUnitId` (Unit pra parear) e `targets.target` (alvo do efeito 【When
> Paired】) como campos INDEPENDENTES de uma `PlayerAction["deployCard"]`. O bug é
> que `SimulatorMatchPage.tsx` (`confirmPending()`) usa um único array `selected`
> pros dois propósitos — o clique que vira `pairWithUnitId` nunca sobra pra virar
> `targets.target`, então cartas cujo 【When Paired】 pede alvo (Amuro Ray, Gundam
> ST01-002) nunca completam a segunda escolha. **Nenhuma linha do motor muda** —
> a correção é ensinar a tela a pedir e validar o 2º clique quando necessário.

> [!IMPORTANT]
> **Decisão Chave 3: o "Canvas 16:9" travado é a causa do vazio em widescreen**
> O `aspect-[16/9]` fixo do `ArenaPlaymat` (decisão do Sprint 1) sempre deixa sobra
> quando a proporção da janela não é exatamente 16:9 — quanto mais larga a tela em
> relação à altura disponível (depois do HUD), maior a sobra. A correção troca o
> valor fixo por um intervalo (`clamp`/faixa aceitável) e faz as asas laterais
> (`CardInspectorPanel`) crescerem pra ocupar o espaço sobrando, em vez de ficarem
> com largura fixa de 256px.

> [!IMPORTANT]
> **Decisão Chave 4: o botão da gaveta lateral do modal já existe — é um bug de
> `overflow-hidden`, não uma feature faltando**
> O Sprint 5.3 já implementou o botão que abre a telemetria lateral do
> `CardInspectorModal`, mas ele é filho do mesmo container que tem `overflow-hidden`
> (usado pra recortar a arte da carta) e fica posicionado FORA da borda desse
> container — na prática, 0 pixels visíveis. A correção move o botão pra fora do
> container recortado, sem remover o `overflow-hidden` da arte.

---

## Proposed Changes (Sprint 6)

### Camada de Motor/Ação do Cliente (`src/pages/SimulatorMatchPage.tsx`)

#### [MODIFY] [SimulatorMatchPage.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/pages/SimulatorMatchPage.tsx)
- `confirmPending()` (ramo `deploy`): detectar se o Pilot jogado (ou a Unit alvo do
  pareamento) tem EffectSpec de "When Paired" com alvo nomeado `"target"`; se sim,
  avisar que falta um 2º clique (alvo do efeito) e bloquear `runAction` até que
  `targets.target` esteja presente — em vez de deixar o motor rejeitar depois.
- Wiring da mão: novo callback "Ver" (abre `CardInspectorModal` somente-leitura)
  distinto do "Jogar" (`onPeek` atual).
- Asas largas (`isWide`): `CardInspectorPanel`/`BattleLogDrawer` passam de largura
  fixa (`w-64`) pra `flex-1` com teto, ocupando o espaço lateral liberado pelo fix
  de escala do `ArenaPlaymat`.

### Camada de Apresentação e Tabuleiro (`src/modules/simulator/ui/`)

#### [MODIFY] [ArenaPlaymat.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/ArenaPlaymat.tsx)
- Trocar `aspect-[16/9] max-h-full max-w-full` fixo por um intervalo de proporção
  (ex. entre 16:10 e 16:9) derivado do espaço realmente disponível, priorizando
  preencher a altura.
- `ShieldStation`/`DeckStation`: largura explícita e comum por coluna (hoje a
  cascata de Shields, a 0.46×`--card`, e as pilhas de Deck/Trash/Exílio, a 1×
  `--card`, centralizam cada uma na própria largura e não alinham entre si).
- Aproximar ainda mais as duas colunas laterais da Battle Area central.

#### [MODIFY] [HandFan.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/HandFan.tsx)
- Reduzir o corte deliberado da carta em repouso no modo `anchored` (hoje
  `-mb-[calc(var(--card)*0.62)]` esconde ~62% da carta até hover/foco).
- Novo callback `onViewCard` (ou equivalente) separado de `onPeek`, alimentando os
  botões "Jogar"/"Ver" por carta.

#### [MODIFY] [CardInspectorModal.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/CardInspectorModal.tsx)
- Mover o botão de abrir/fechar a gaveta lateral (já implementado) pra fora do
  container `overflow-hidden` da arte da carta, mantendo a posição visual atual.

---

## Verification Plan (Sprint 6)

### Automated Tests
```bash
pnpm test
pnpm run check:types
pnpm run lint:simulator
```

### Manual Verification
1. **Bug de alvo**: parear Amuro Ray (ou Gundam ST01-002) com uma Unit própria e
   escolher o alvo inimigo pedido pelo "When Paired" — confirma sem erro. Parear um
   Pilot sem "When Paired" direcionado continua funcionando com 1 clique só.
2. **Widescreen/Notebook/Ultra-wide**: redimensionar a janela em pelo menos 3
   resoluções e confirmar que não sobra vazio morto relevante nas laterais.
3. **Alinhamento de zonas**: Base+Shields e Exílio+Trash+Deck alinham numa borda
   comum, dos dois lados (espelhamento preservado).
4. **Mão**: a carta em repouso não corta a parte de baixo; em touch (sem hover) dá
   pra ver a carta inteira via "Ver"; "Jogar" e "Ver" respondem separadamente.
5. **Modal**: o botão da gaveta lateral aparece e alterna a telemetria normalmente.

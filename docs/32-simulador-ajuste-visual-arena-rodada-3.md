# 32 — Ajuste visual da arena, rodada 3 (botão expandir, Shield mobile achatado, dock)

**Branch:** `dev` + `main` (a pedido do Willen — deploy imediato pra testar em
ambiente de uso). 2026-09-04. Continuação de
[docs/31](31-simulador-ajuste-visual-arena-rodada-2.md), a partir de 2 prints
novos anotados ("Captura Wide.jpeg", "Mobile Captura.jpeg").

## Feedback recebido

- **Widescreen**: o painel "Detalhes da Carta" (asa esquerda) aparecia
  pequeno e colado no topo da coluna, com muito vazio embaixo — "pode ficar
  centralizado na coluna, ou aumentar um pouco mais." Pedido de feature nova:
  um botão que expande o tabuleiro pra largura total, escondendo o Detalhes
  da Carta, com as cartas/seções crescendo de verdade nesse espaço extra.
- **Mobile**: a caixa de mensagem (Sua vez / Encerrar turno / ataque) tapava
  os botões de ação das cartas da mão, e os números das zonas do topo (lado
  do oponente) ficavam difíceis de ver. Pedido de redesenho: Shield sem
  cascata no mobile — achatado, igual o Deck, com número.

## 1. `CardInspectorPanel` — por que ficava pequeno e no topo

Causa raiz: `self-center` na classe passada pela página fazia a asa encolher
pro tamanho do CONTEÚDO (auto-height) em vez de esticar pela altura da linha
(`items-stretch`, o padrão do container pai). Com isso, o "Nenhuma carta
selecionada" (que internamente já tem `flex-1 items-center justify-center`
pra se centralizar) nunca tinha altura de verdade pra se centralizar DENTRO
— só sobrava do tamanho do próprio texto+ícone, colado no topo da coluna.
**Correção**: removido `self-center` — a asa volta a esticar (`items-stretch`
do pai), e a centralização/preenchimento interno do painel passa a valer.
Também some quando o tabuleiro está expandido (item 2).

## 2. Botão "Expandir tabuleiro" (novo, só no widescreen)

- `SimulatorMatchPage.tsx`: novo estado `boardExpanded`; botão (ícone
  Maximize2/Minimize2, mesmo cluster do ⚙/🐞) só aparece quando `isWide`
  (as asas já existem pra fazer sentido esconder). Ao ligar: esconde
  `CardInspectorPanel` + o espelho invisível, e passa `expanded` pro
  `ArenaPlaymat`.
- `ArenaPlaymat.tsx`: prop `expanded?: boolean` nova — troca `--card-w` pra
  `clamp(3.5rem, min(9vw, 16vh), 10rem)` (era `min(6.5vw,12vh)`/teto
  `7.5rem`). **Por quê precisa trocar a fórmula, não só esconder as asas**:
  simplesmente esconder o Detalhes da Carta deixaria a CAIXA do canvas maior
  (menos concorrência por largura), mas as CARTAS dentro dela continuariam
  do mesmo tamanho (`--card-w` é só função de `vw`/`vh` do viewport, nunca
  soube da largura real do canvas) — sobraria mais vazio ainda, o oposto do
  pedido. Coeficientes/teto mais generosos só neste modo opt-in — o padrão
  (não-expandido), já calibrado em 2 rodadas anteriores (docs/30, docs/31),
  fica intocado, sem risco de regressão.

## 3. `ShieldRail.tsx` mobile — achatado, sem cascata

Rodada 2 (docs/31) tinha aumentado o overlap pra `*0.75` (pilha mais
compacta, mas ainda em cascata visível). Pedido agora é mais direto: **sem
cascata nenhuma no mobile**, igual o Deck (já achatado desde sempre). Trocado
pra `*0.87` (aproximadamente a ALTURA inteira do verso da carta — aspect
63/88, então altura ≈ largura×1,397; a largura da peça já é `card-w*0,62`,
logo altura ≈ `card-w*0,866`, arredondado pra cima) — sobrepõe quase tudo, só
a peça de cima fica visível, exatamente como uma pilha achatada. O badge
numérico (já adicionado na rodada 2) continua cuidando da contagem.

**Ressalva registrada no código**: com `selectable` ativo (Shield é alvo
real de decisão de jogo, `SimulatorMatchPage.tsx` liga isso a
`toggleSelect`), a peça de cima cobre o clique das de baixo nessa faixa —
aceitável pro caso comum (exibição passiva), mas um fluxo de "escolher a
shield debaixo" no mobile ficaria difícil de acertar. Não há esse fluxo
ativo em nenhuma carta de ST01/ST02 hoje — registrado pra se um card futuro
precisar.

## 4. `ActionDock.tsx` — mais folga acima da mão no mobile

Achado ao investigar: o comentário antigo do arquivo mencionava esperar pela
`HandDrawer` (`fixed bottom-0`) pra calcular o offset — mas a `HandDrawer`
foi removida faz tempo (a mão hoje é o `HandFan anchored` dentro do próprio
rodapé do `ArenaPlaymat`, não mais um elemento fixo à parte). O offset
`sm:bottom-14` (56px) ficou desatualizado/curto pra essa realidade — em
celular paisagem (que já cai na faixa `sm:`), o dock ficava perto demais da
fileira de ícones "Jogar/Ver" no topo de cada carta da mão, tapando o
clique. Trocado pra `sm:bottom-20` (mais folga só nessa faixa),
`md:bottom-14` restaura o valor normal a partir de tablet/desktop.
Comentário do arquivo corrigido pra não citar mais a `HandDrawer`.

## Fora de escopo desta rodada — registrado, não implementado

- **Reordenar Base/Shield do lado do oponente**: o pedido citou "ex base no
  topo, shield abaixo" — já é assim pro PRÓPRIO jogador (`ShieldStation`
  não-espelhada); mudar também o lado do oponente reverteria o espelhamento
  180° deliberado de uma sprint anterior. Mantido como está.
- **Área dedicada e simétrica pra mão do oponente** (hoje é uma tira
  compacta com versos + contagem, dentro do `OpponentTheater`, não uma
  "área" própria do tamanho pedido): redesenho maior, mais arriscado sem
  verificação visual ao vivo — registrado como sugestão pra uma próxima
  rodada, não implementado agora.
- **"Não ver os números das zonas no topo, lado do oponente"**: parcialmente
  endereçado por esta rodada (Shield achatado ocupa menos altura, dock
  desce menos por cima) — mas sem confirmação visual ainda de que resolveu
  de vez; fica pra próxima checagem.

## Verificação

`pnpm test` **435/435** (+1 teste novo — `expanded` troca `--card-w`).
`check:types` ✓, `lint:simulator` ✓, `eslint` na página ✓, `pnpm build` ✓.

**Sobe em `dev` E `main`** — pedido explícito do Willen (testar já em
ambiente de uso).

# 34 — Bug da Base + padronização de tamanho/borda/ícones + mobile/widescreen

**Branch:** `dev` + `main` (a pedido do Willen). 2026-09-04. Continuação de
[docs/33](33-simulador-dimensionamento-dinamico-arena.md). 3 exploradores
confirmaram os achados (bug da Base, inventário de tamanho/borda, inventário
de ícones) com `file:line` exato antes desta rodada — resumo abaixo,
detalhe completo no plano aprovado da sessão.

## Etapa 1 — Bug real da Base

`src/modules/simulator/ui/handPlayability.ts` (`playableModes`) nunca teve
um `if` pra `cardType === "BASE"` — só UNIT/PILOT/COMMAND. Resultado: `modes`
ficava `[]` SEMPRE pra qualquer Base na mão, custo/nível/fase não importava
— o botão "Jogar" nunca aparecia, a ação nunca era sequer oferecida (não
era só ficar cinza). O motor (`engine/deploy.ts`, substituição de Base
incluindo a EX Base + disparo do 【Deploy】) já estava CORRETO e testado —
o bug era só a ausência desse branch. Corrigido com o mesmo padrão de
UNIT; **+4 testes novos** em `handPlayability.test.ts` (zero cobertura pra
BASE antes).

## Etapa 2 — Tamanho-padrão único (`--card-w-std`)

Achado: Battle slot/Mão usavam `1× --card-w` (cheio); Shield/Deck/Trash/
Exílio/Base usavam `--card-w × 0.62` cada um reescrevendo a conta à mão;
Recurso ativo usava uma proporção PRÓPRIA (`0.5×0.7`, nem aspect-ratio
real) — 3 tamanhos desencontrados, nenhum "padrão".

Nova variável derivada 1 vez no canvas root do `ArenaPlaymat.tsx`:
`[--card-w-std:calc(var(--card-w)*0.62)]` (Tailwind arbitrary property,
puro CSS). `0.62` porque já era o fator dominante — menos disruptivo que
inventar um número novo. Battle slot (`ArenaPlaymat.tsx`, grid do
`BattleRow`) e carta da mão (`HandFan.tsx`) passaram a referenciar
`--card-w-std` em vez de `--card-w` cheio — **Units/Mão diminuíram pro
tamanho-padrão**, pedido explícito do Willen. `ResourceMeter.tsx` abandonou
a proporção própria e adotou `aspect-[63/88] w-[var(--card-w-std)]` igual a
todo mundo. `useArenaScale.ts` não precisou mudar — mede o grupo real e se
adapta sozinho a qualquer fórmula interna nova.

## Etapa 3 — Corrige o corte do Recurso "virado"

Causa: `rotate-90` girava a MESMA caixa cujo `w`/`h` continuavam sendo os
do estado retrato — o `object-cover` recortava pro formato ERRADO antes do
giro. Correção: a caixa EXTERNA (rested) já nasce em paisagem
(`aspect-[88/63]`, footprint = a caixa retrato rotacionada); só a IMAGEM
por dentro (numa caixa retrato do tamanho normal) gira 90°, preenchendo a
paisagem corretamente — técnica padrão CSS pra "carta deitada".

## Etapa 4 — Borda padronizada (raio 3px = `rounded-arena`)

Achado: `ShieldRail` (peça) e `ResourceMeter` nunca tinham `rounded-arena`;
`CounterChip` (Deck/Trash/Exílio/Recurso) TINHA `rounded-arena` mas SEM
`overflow-hidden` — não recortava nada; `BaseCardGauge` tinha a arte
arredondada por dentro (via `CardFace`) mas a MOLDURA externa (borda de
estado colorida) era reta. Sweep mecânico: `rounded-arena` + `overflow-
hidden` (quando faltava) em todos os 4 — cuidado extra no `CounterChip`
pra não colocar no wrapper externo (quebraria as camadas de profundidade
decorativas que vazam de propósito) e sim no elemento que já tinha
`overflow-hidden`.

## Etapa 5 — Espaço reservado pro Piloto pareado

`DockedPilot` era um overlay `absolute inset-x-0 bottom-0` SOBRE a arte da
Unit (cobria a parte de baixo dela). `BattleSlot.tsx` agora reserva uma
TIRA própria abaixo da arte (`h-[1.1rem]`, mesmo valor já usado antes pro
deslocamento dos badges AP/HP) — a arte fica sempre só `aspect-[63/88]`, o
Piloto nunca mais rouba espaço de dentro dela. A tira é SEMPRE presente
(com ou sem Piloto) pra a fileira do grid não ficar mais alta só quando
ALGUM slot tem Piloto pareado. `DockedPilot.tsx` voltou a ser um elemento
de fluxo normal (não mais `absolute`).

## Etapa 6 — Ícones de ação padronizados

Achado: `BattleSlot` usava `size="sm"` (botão 20px/ícone 12px, dentro do
canto); `HandFan` não passava `size` → caía no default `"md"` (24px/14px,
saltando PRA FORA do canto) — inconsistente, e os dois abaixo do alvo de
toque de 44px já usado em Shield/Recurso. `CardCornerActions.tsx`
unificado: 1 tamanho só (`size-7`/ícone `size-4`, maior que os dois
anteriores) e 1 posição só (SEMPRE dentro do canto, nunca mais salta pra
fora — reduz colisão entre cartas vizinhas). Prop `size` removida (não
precisa mais escolher).

## Etapa 7 — Mobile: dock vertical na esquerda + espaçamento

`ActionDock.tsx`: abaixo de `lg:` (1024px), vira uma coluna VERTICAL fixa
na ESQUERDA (`left-2 top-12`), logo abaixo do cluster ⚙/🐞/expandir — longe
dos botões de ação do próprio celular e dos ícones da mão. A partir de
`lg:` (desktop/tablet genuíno) restaura a caixa ancorada no canto inferior
direito de sempre. **Um limiar só** (`lg:`), reaproveitado — não repete o
erro da rodada 3 (limiares diferentes por arquivo pro mesmo dispositivo).
O estado "idle" (texto+botão) empilha em vez de ficar lado a lado na
coluna estreita; `truncate` removido (deixa quebrar linha em vez de
cortar informação). `BattleRow` ganhou `gap-1.5` (era `gap-1`) — mais
respiro entre slots vizinhos pros ícones (Etapa 6) não arriscarem clicar
no slot errado (`BATTLE_ROW_WIDTH` recalculado pra manter o alinhamento
com a linha de Recursos).

## Etapa 8 — Widescreen: `CardInspectorPanel` abaixo dos botões

O cluster ⚙/🐞/expandir é `absolute` (não empurra ninguém) — por isso o
painel "Detalhes da Carta" (só existe com `isWide`) começava no topo da
linha e ficava ATRÁS dos botões (fundo transparente). A linha do board
ganhou `pt-10` só quando `isWide`, dando respiro suficiente pro painel
começar visualmente abaixo do cluster.

## Verificação

`pnpm test` **449/449** (+7 testes novos: 4 Base em `handPlayability.
test.ts`, 1 `--card-w-std`/estrutura em `ArenaPlaymat.test.tsx`, 1 tamanho
em `CardCornerActions.test.tsx`, 1 posição em `ActionDock.test.tsx` — além
de testes existentes atualizados pra nova estrutura em `BattleSlot.test.
tsx`, `ShieldRail.test.tsx`, `ResourceMeter.test.tsx`). `check:types` ✓,
`lint:simulator` ✓, `eslint` na página ✓, `pnpm build` ✓.

**Sobe em `dev` E `main`** — pedido explícito do Willen, só ao final de
TODAS as 8 etapas.

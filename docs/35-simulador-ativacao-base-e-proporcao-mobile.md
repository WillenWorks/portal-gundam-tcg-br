# 35 — Ativação de habilidade da Base + proporção mobile coesa

**Branch:** `dev` + `main` (a pedido do Willen). 2026-09-04. Continuação de
[docs/34](34-simulador-bug-base-padronizacao-tamanho-borda.md). Achados a
partir de 5 prints reais do Willen (widescreen + mobile paisagem) depois da
rodada anterior: amostra da carta lateral ainda pequena, bug de uso real na
Base (White Base sem botão de ativação), ícones de canto grandes demais no
mobile, pilha de Trash/Exílio "descolada" do resto da escala, e o painel de
Ação cortado em telas curtas.

## Etapa 1 — Bug real: Base sem NENHUM botão de ação

`BaseCardGauge.tsx` era um único `<button>` com `onClick` que só sabia
selecionar (alvo legal) ou inspecionar — nunca teve like `CardCornerActions`,
então não tinha como oferecer 【Activate·Main】 (White Base "②: Deploy token",
Asticassia "Rest this Base: Link Units +1"). O motor (`engine/actions.ts`,
case `activateAbility`) já era genérico — não amarra a zona de origem, então
o bug era 100% de wiring de UI, igual ao padrão do bug da Base em docs/34
(motor certo, front esquecido).

Corrigido: `BaseCardGauge` virou uma `<div>` com o mesmo padrão do
`BattleSlot`/`HandFan` — corpo (`aspect-[63/88]`) só é clicável quando é alvo
legal (seleção); "Ver" e "Ativar" sempre pelo `CardCornerActions` do canto
(nunca dá pra aninhar `<button>` dentro de `<button>`, por isso a mudança de
tag). `SimulatorMatchPage.tsx` (`arenaSide`) ganhou o mesmo cálculo de
`fieldAbilityFor`/`canActivate` que `renderBattleSlots` já fazia pros Units,
agora também pra `base` — reaproveita `startActivateAbility` (já genérico,
funciona pra qualquer `CardInstance`, campo ou Base).

**Achado extra ao revisar Asticassia:** seu custo é "Rest this Base" (sem
gasto de recurso) — se a Base já está `rested`, o custo não pode ser pago de
novo, e o botão continuaria aparecendo (o motor rejeitaria a ação com erro).
`abilityIntent.ts` (`fieldAbilityFor`) ganhou um guard: `card.rested` +
custo com `{ op: "rest", target: { kind: "self" } }` → habilidade
indisponível, sem esperar o servidor recusar.

## Etapa 2 — Ícones de canto proporcionais a `--card-w-std`

`CardCornerActions.tsx` usava `size-7`/ícone `size-4` FIXOS (28px/16px,
docs/34 §6) — não respeitava `--card-w-std`. Em mobile paisagem cramped, a
própria carta pode encolher até o piso de `useArenaScale` (`--card-w-std ≈
27px`, já que `--card-w` tem piso de 44px × fator 0.62) — um botão de 28px
sozinho já é do tamanho da carta INTEIRA, cobrindo a arte (print do Willen:
"os ícones ficaram muito grandes", cartas viravam essencialmente um olho
preto). Trocado por `size-[clamp(1.125rem,calc(var(--card-w-std,2.17rem)*
0.45),1.75rem)]` (botão) e `clamp(0.625rem,...*0.26,1rem)` (ícone dentro) —
acompanha a carta pra baixo no mobile, sem nunca passar do tamanho de antes
no desktop.

## Etapa 3 — Pilha (Trash/Exílio/Deck) "descolada" da escala

`CounterChip` (variant `stack`, usado pelo `PileTray`) e o botão de recurso
selecionável em `ResourceMeter` tinham `min-h-11 min-w-11` (44px) FIXO por
cima da largura já calculada via `--card-w-std` — em telas cramped isso
forçava a pilha a ficar maior que o resto da arena (Battle Area, Shields,
Base), que encolhe livre sem esse piso extra. Removido dos dois — o piso de
toque de verdade já vem de `useArenaScale.DEFAULT_MIN_PX` (44px em
`--card-w`, ~27px em `--card-w-std`), não precisa de um segundo piso
divergente por cima. `CounterChip.test.tsx` cobre só a variant `chip`
(rótulo+número, não carta) — sem mudança nela, o floor ali é intencional e
independente da escala da arena.

## Etapa 4 — Amostra de carta do `CardInspectorPanel` (asa larga)

`size="lg"` do `CardFace` é uma largura FIXA (`w-28`, 112px) — ignorava
quanto a asa (`max-w-[22rem]`) realmente tinha disponível (print anotado do
Willen, "Captura1": a arte real cabia numa fração pequena da caixa
disponível). Agora `className="w-full max-w-[13rem]"` (via `twMerge`, vence
o `w-28` do `size`) — a arte cresce até preencher a coluna de verdade, com
um teto (`13rem`/208px) pra sobrar espaço pras infos (Nível/Custo/AP/HP)
abaixo mesmo numa asa excepcionalmente larga. Também ganhou
`backFallback={isGenericArtCard(...)}` (faltava — só esse componente não
passava, então EX Resource/EX Base/tokens caíam no fallback tipográfico
"nome+código" em vez do verso genérico que todo outro componente usa,
lido pelo Willen como "tamanho diferente").

## Etapa 5 — Painel de Ação cortado no mobile, mesmo com scroll

`ActionDock.tsx` usava `max-h-[60vh]` no mobile (`< lg:`) — `vh` no
navegador mobile mede o viewport GRANDE (antes da barra de endereço
recolher); em paisagem, com a barra visível, 60vh já passa do espaço
realmente visível. Como o painel é `fixed` (não faz parte do fluxo da
página), o excedente ficava inalcançável mesmo tentando rolar — a página
em si não tinha o que rolar. Trocado por
`max-h-[min(60vh,calc(100dvh-4rem))]`: `dvh` é o viewport DINÂMICO (já
desconta a barra de endereço), e o `calc()` desconta também o offset do
`top-12` — o painel nunca mais passa do rodapé realmente visível; o
`overflow-y-auto` que já existia cuida do resto internamente.

## Verificação

`pnpm test` **454/454** (+7 testes novos/reescritos em `BaseCardGauge.
test.tsx` cobrindo a ativação — antes zero cobertura pro botão "Ativar";
`CardCornerActions.test.tsx` atualizado pro tamanho responsivo).
`check:types` ✓, `eslint` nos arquivos tocados ✓, `pnpm build` ✓.

**Sobe em `dev` E `main`** — pedido explícito do Willen.

## Pendente (fora do escopo desta rodada)

QA manual com 2 contas/2 dispositivos reais (mobile físico, não só emulação)
ainda não rodou pra esta rodada — os prints que motivaram as correções já
eram de um dispositivo real, mas a VERIFICAÇÃO pós-fix depende de testes
automatizados + build, sem uma nova rodada de captura de tela do Willen.

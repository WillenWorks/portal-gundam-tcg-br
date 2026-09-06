# 36 — Resources padrão, mão espaçada, inspetor maior, dock medido de verdade

**Branch:** `dev` + `main`. 2026-09-04. Continuação de
[docs/35](35-simulador-ativacao-base-e-proporcao-mobile.md), segunda rodada
de feedback do Willen depois do deploy anterior (sem prints novos desta vez —
achados via leitura de código + retestagem do que já tinha sido "corrigido").

## Etapa 1 — Recursos do oponente ainda tinham proporção própria

`ResourceMeter.tsx` encolhia os recursos `readOnly` (oponente) pra 70% do
`--card-w-std` — resquício de ANTES do docs/34 padronizar tudo numa variável
só; ficou like um "desconto" que nenhuma outra peça do oponente (Deck/Trash/
Base/Battle Area) tem. Bug real (Willen: "as cartas de resources no mobile
não estão no tamanho padrão"). Removido — `--card-w-std` cheio dos dois
lados agora, igual a toda outra peça.

## Etapa 2 — Mão do jogador ainda agrupava com só 6 cartas

`overlapFor()` usava `0.08` (8% de sobreposição) até 6 cartas — pouco, mas
ainda sobreposição de verdade, não espaçamento. Bug real (Willen: "espaçar
mais os cards na mão, para não agrupar demais mesmo quando tem apenas 6
cartas"). Trocado por um valor NEGATIVO (`MIN_OVERLAP = -0.14`) até 6 cartas
— vira margem POSITIVA (gap real), só passa a sobrepor de verdade quando a
mão cresce além disso e precisa caber mais carta na mesma largura.

Achado ao implementar: a fórmula da margem (`calc(var(--card-w-std) *
-${clampedOverlap})`) fazia CONCATENAÇÃO DE STRING pro sinal — com
`clampedOverlap` negativo isso vira `--0.14` (dois hífens, CSS inválido, a
margem simplesmente não aplicava). Corrigido negando o NÚMERO primeiro
(`${-clampedOverlap}`), não a string.

## Etapa 3 — Widescreen: inspetor lateral maior (imagem + texto)

Pedido explícito do Willen: "a carta na lateral e as informações textuais
podem ser aumentadas ainda" — o ajuste do docs/35 (112px → 208px) não foi
longe o suficiente. Nova rodada:
- A própria ASA cresceu: `max-w-[22rem]` → `max-w-[28rem]` no
  `CardInspectorPanel` E no espelho direito (`SimulatorMatchPage.tsx`) —
  os dois têm que ficar em sincronia pra arena continuar centrada.
- A amostra de carta cresceu junto: `max-w-[13rem]` → `max-w-[17rem]`.
- Cada texto subiu um degrau (nome `text-sm`→`text-base`, código/tipo/
  traits/link `text-[10px]`→`text-xs`, valor do stat `text-sm`→`text-lg`,
  rótulo do stat `text-[8px]`→`text-[10px]`, badges de keyword/buff
  `text-[9px]`→`text-[11px]`) — mantém a hierarquia relativa entre eles,
  só aumenta a escala inteira.

## Etapa 4 — Dock do mobile: `dvh` não bastou, agora é medido de verdade

O fix do docs/35 (`max-h-[min(60vh,calc(100dvh-4rem))]`) ainda deixava o
painel "Passar"/"auto-pass" cortado no relato do Willen ("ainda está sendo
escondido no scroll"). `dvh` depende de suporte do browser — se falhar, o
`min()` inteiro vira inválido e o `max-height` cai pro padrão `none` (SEM
teto nenhum, pior que antes). Trocado pelo mesmo princípio que o
`useArenaScale` já usa pro tabuleiro: medir o viewport de VERDADE via JS
(`visualViewport`/`innerHeight`, nunca `vh`/`dvh`) em vez de confiar numa
unidade CSS.

`ActionDock.tsx` é apresentacional puro DE PROPÓSITO — os testes chamam
`ActionDock({...})` como função simples (sem árvore React de verdade), então
um hook ali dentro quebraria TODOS eles ("Invalid hook call"). A medição
mora no PAI (`SimulatorMatchPage.tsx`, `useMobileDockMaxHeight` — mesmo
padrão do `useMediaQuery`/`useArenaScale` já existentes ali), que passa o
resultado como prop nova (`mobileMaxHeightPx`); o `ActionDock` só aplica via
`style` inline quando presente (vence a classe `max-h-[...]`, que fica só
como fallback CSS-only pra quem não passar a prop). `undefined` no desktop
(`isDesktop` via `useMediaQuery("(min-width: 1024px)")`, o mesmo limiar
`lg:` que o dock já usa) — as classes `lg:max-h-none` continuam no controle
lá.

## Dúvida do Willen — pareamento com 4+ testers

`matchStore.ts` (`joinQueue`): a fila é um array simples, FIFO. `while
(queue.length >= 2) { const [first, second] = queue.splice(0, 2); ... }` —
assim que 2 jogadores estão esperando, casam NA HORA (não espera "rodada").
Com 4 pessoas entrando: a 1ª e a 2ª casam assim que a 2ª chama `joinQueue`
(sobra fila vazia); a 3ª fica sozinha até a 4ª chamar `joinQueue`, aí as
duas casam. Ou seja: exatamente como descrito — 1↔2, depois 3↔4, ordem de
chegada, sem preferência nenhuma. Única exceção: a MESMA conta entrando 2x
(2 abas) não casa consigo mesma — a 2ª tentativa volta pro início da fila e
espera um oponente de verdade.

## Verificação

`pnpm test` **456/456** (+2 testes novos em `ActionDock.test.tsx` cobrindo
`mobileMaxHeightPx`; `HandFan.test.tsx` reescrito pra validar o gap real da
mão pequena vs. overlap da mão grande, sinal incluído). `check:types` ✓,
`eslint` nos arquivos tocados ✓, `pnpm build` ✓.

**Sobe em `dev` E `main`** — pedido explícito do Willen.

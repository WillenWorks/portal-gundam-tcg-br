# 30 — Sprint V&V rumo ao v1.0 — V5: ajuste visual da arena (widescreen/zoom/mobile)

**Branch:** `dev` — 2026-09-04. Última etapa da sprint iniciada em
[docs/25](25-simulador-vv-sprint-v0-legalidade-de-alvo.md), a partir de 3
screenshots reais do Willen (Captura0/1/2, raiz do repo): widescreen 1x
"muito espaçado", 150%/175% de zoom no browser (175% com as colunas de
Shield/Deck vazando pra fora do playmat) e uma foto de celular (mesmo
vazamento, em retrato).

## Diagnóstico — causa raiz confirmada por leitura de código, não visual

Toda carta da arena (Battle Row, Shield/Base/Deck/Trash/Exílio — `ShieldRail`,
`BaseCardGauge`, `CounterChip`, `ArenaPlaymat`) é dimensionada a partir da
**mesma** variável CSS, `--card-w`, definida uma vez no canvas
(`ArenaPlaymat.tsx`). Antes desta etapa:
```
"--card-w": "clamp(3.5rem, 6.5vw, 6.2rem)"
```
Só responde à LARGURA do viewport (`vw`). Mas o canvas em si é
`aspect-[16/9] max-h-full max-w-full` — a largura REAL renderizada é
`min(viewportWidth, viewportHeight * 16/9)`. Sempre que a ALTURA disponível
é o fator limitante (zoom alto, mobile retrato, janela mais alta que larga —
exatamente os 3 casos dos prints), a largura real do canvas fica MENOR do
que `6.5vw` supõe, mas `--card-w` não sabe disso — continua pedindo o
tamanho "largura-only". A fileira de colunas (Deck + Battle Row + Shield)
passa a pedir mais espaço do que a caixa real tem e vaza pra fora do
`overflow-hidden` do canvas.

**Uma tentativa de correção foi descartada** antes de codar (registro por
transparência): o plano original cogitava trocar `shrink-0` por
`flex-shrink`/`min-w-0` nos wrappers `DeckStation`/`ShieldStation`. Invalidado
ao ler o código: os elementos FILHOS desses wrappers (`ShieldRail`,
`BaseCardGauge`, `CounterChip`) já têm sua PRÓPRIA largura fixa
`w-[calc(var(--card-w)*0.62)]`, independente do wrapper — deixar só o
wrapper encolher não move a agulha, porque o conteúdo de dentro continua do
mesmo tamanho fixo. A causa raiz é sempre a MESMA variável `--card-w`, então
a correção certa é nela, não nos wrappers.

## Correção

```
"--card-w": "clamp(3.5rem, min(6.5vw, 12vh), 6.5rem)"
```
- **`min(6.5vw, 12vh)`** — `--card-w` passa a responder aos DOIS eixos. Em
  janela largura-dominante (desktop comum, altura ≲ 60% da largura), o termo
  `vh` não amarra nada — comportamento igual a antes, sem regressão. Só entra
  em ação quando o canvas é altura-dominante, encolhendo a escala JUNTO com a
  largura real do canvas — nunca deixando o pedido de espaço ultrapassar a
  caixa.
- **Teto `6.5rem`** (antes `6.2rem`) — ajuste leve pro widescreen 1x
  aproveitar melhor a tela (print "muito espaçado"), sem reescrever o resto
  do layout.
- Piso (`3.5rem`) mantido — o Willen relatou que o mobile "ficou muito bom"
  fora do vazamento pontual das colunas; baixar o piso arriscaria cartas
  ilegíveis num problema que não foi reportado.

## Honestidade sobre o alcance desta correção

Esta é uma correção de FÓRMULA validada por leitura de código (a mesma
variável, a mesma lógica de `min()`, sem introduzir nenhum mecanismo novo) —
não uma correção validada visualmente, porque não há como eu renderizar e
olhar a página. Ela resolve a causa raiz identificada (mismatch entre
`--card-w` e a largura REAL do canvas em situações altura-dominante) pelos
3 cenários relatados, mas números de `vh`/rem exatos são por natureza uma
estimativa sem poder medir o layout renderizado de verdade. **Pedido
explícito, como já combinado no plano**: um novo screenshot (mesmos 3
cenários — widescreen 1x, zoom 175%, mobile) depois deste deploy, pra
confirmar ou ajustar a calibração antes de qualquer nova iteração.

## Fora de escopo (registrado, não implementado)

**Drag-and-drop de cartas** — o próprio Willen achou complexo demais pro MVP
agora; fica anotado só como ideia futura, sem desenho nem estimativa.

## Verificação

`ArenaPlaymat.test.tsx` atualizado pra nova fórmula (asserção exata da
string de `--card-w`). `pnpm test` 432/432, `check:types` ✓,
`lint:simulator` ✓, `pnpm build` ✓.

## Status da sprint V&V

**V0-V5 completos.** Resumo final:
- V0: legalidade de alvo genérica, server-authoritative (docs/25).
- V1: auditoria carta a carta, 32/32 ST01+ST02 (docs/26).
- V2: mecânicas centrais vs. rulings oficiais — limite de 6 Units corrigido
  (docs/27).
- V3: integridade server-authoritative — pagamento de custo exato (docs/28).
- V4: checklist de carta nova (docs/29).
- V5: ajuste visual da arena, aguardando confirmação (este doc).

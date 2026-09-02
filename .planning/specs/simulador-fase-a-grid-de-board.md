# Spec — Simulador Fase A: Grid de board + escala

> Épico: redesenho visual do simulador · Fase 1 de 5 · branch `feature/simulador-fase-a-grid-board`
> Plano visual: <https://claude.ai/code/artifact/430f4738-bd56-4da7-9dc9-62f026fa81a9> (§01–02, §04, §07)

## Objetivo

Trocar a composição atual de **dois playmats espelhados empilhados num container que
rola** por **um único board em grid de 5 faixas que nunca rola**, com as duas Battle
Areas se encontrando numa seam central e o tamanho de carta dirigido por uma variável
`--card` com `clamp()`.

Sem componente novo. É majoritariamente rearranjo e deleção. Nenhuma mudança de
motor / API / `viewState`.

## Fora de escopo (outras fases)

- Action Dock (Fase B) — os cards de decisão centralizados continuam como estão.
- Shield rail, medidor de recursos, chips/bandeja de pilha (Fase C) — `ShieldStack`,
  `ResourceTray`, `renderPile`, `renderDeckTile` continuam com o visual atual.
- Leque de mão, inspetor no painel, eco de log (Fase D).
- Board portrait / remoção da rotação 90° (Fase E) — `useIsPortraitMobile` e o wrapper
  `rotate(90deg)` **permanecem** nesta fase.

## Mudanças de frontend

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/SimulatorMatchPage.tsx` | Reescreve `renderPlaymat` → `renderSide`; troca o container de board (scroll + 2 playmats escalados) pelo grid de 5 faixas com `--card`; ajusta `renderLeftColumn`/`renderRightColumn` para faixa horizontal; mão em faixa própria com scroll horizontal em vez de `flex-wrap`. |
| `src/modules/simulator/ui/BattleSlot.tsx` | Slot vazio passa de `aspect-[63/108]` para `aspect-[63/88]` (alinha com o slot preenchido — hoje a linha "pula" ao deployar/perder unit). |

### Estrutura do board (novo `renderSide` + container)

```
content (flex-col, h-full, overflow-hidden)
├─ HUD bar                        [inalterado nesta fase]
├─ phaseFlash / avisos centrais   [inalterado nesta fase]
└─ BOARD  (mx-auto max-w-[1400px], flex-col, overflow-hidden, style: --card)
   ├─ renderSide(oponente, isSelf=false)   flex-col, flex-1, min-h-0
   │   ├─ header do lado (nome · deck · presença)
   │   ├─ front strip  (flex-wrap, items-end):
   │   │     versos da mão do oponente · Base+Shields+ResourceDeck · Trash+Exílio+Deck ·
   │   │     ResourceTray compact read-only  ← recursos do oponente passam a aparecer
   │   └─ battle wrapper (flex-1, items-END → cartas encostam na seam)
   │         renderBattleArea(oponente, false)  → grid repeat(6, var(--card))
   ├─ SEAM  (h-0.5, gradiente vermelho, largura total)
   └─ renderSide(você, isSelf=true)         flex-col, flex-1, min-h-0
       ├─ battle wrapper (flex-1, items-START → cartas encostam na seam)
       │     renderBattleArea(você, true)
       ├─ front strip (flex-wrap, items-end):
       │     Base+Shields+ResourceDeck · Trash+Exílio+Deck ·
       │     ResourceTray (selecionável no pagamento de custo — mantido)
       ├─ mão  (flex, overflow-x-auto, min-w-max mx-auto — centrada quando cabe,
       │        scroll horizontal quando não; NUNCA quebra em 2 linhas)
       │        [só quando !isPortraitMobile — no retrato continua a MobileHandDrawer]
       └─ header do lado (nome · deck)
```

### Variável de escala

`--card: clamp(2.75rem, 7.5vw, 6.5rem)` no elemento BOARD (via `style`).
`renderBattleArea` passa a usar `gridTemplateColumns: "repeat(6, var(--card))"` +
`justify-center`. `BattleSlot` continua `w-full` dentro da célula → herda `--card`.

### Refs do CombatLane (não pode quebrar)

- `board.register(playerAreaKey(pid))` continua no **wrapper da battle area** de cada
  lado (era o `<div>` do centro no grid antigo; agora é o `battle wrapper`).
- `board.register(unit.instanceId)` continua em cada `BattleSlot` via `registerRef`
  (inalterado — vem de `renderBattleArea`).
- `CombatLane` continua `fixed` fora do container do board. Como o board **deixa de
  rolar**, a matemática da linha de mira fica mais estável (menos `remeasure` no scroll).

### O que é DELETADO

- `overflow-y-auto` + `pb-24` do container de board.
- `<div className="scale-[0.94] opacity-95">` em volta do playmat do oponente.
- A `<div className="grid grid-cols-[auto_1fr_auto] gap-2">` (`boardGrid`) e a função
  `renderPlaymat` inteira (vira `renderSide`).
- `flex-wrap` da mão (vira faixa com scroll horizontal).

## Comportamento de interação

- **Sem mudança funcional.** Seleção por clique, ataque, block, Action Step, pagamento
  de recurso, inspeção — tudo idêntico. Só a posição/tamanho dos elementos muda.
- O board não rola em nenhum breakpoint ≥ S. Se o viewport for muito baixo, as Battle
  Areas encolhem (o `clamp()` tem piso de 44px); abaixo disso o conteúdo da faixa pode
  cortar — aceito nesta fase (Fase E trata telas pequenas de verdade).
- Mão nunca quebra em 2 linhas → não empurra mais o board a cada compra/descarte.

## Estados

| Estado | Comportamento |
|---|---|
| default | board preenchido, 2 frentes na seam |
| loading | inalterado (tela "Conectando ao stream…" / "Carregando arte…") |
| empty (mão 0) | "Mão vazia." na faixa da mão (inalterado) |
| empty (0 units) | 6 slots tracejados do **mesmo tamanho** do slot preenchido (fix do `63/108`) |
| edge (mão 10+) | faixa da mão rola horizontalmente, não quebra |
| edge (6 units + pilotos) | grid `repeat(6, var(--card))` cabe na largura-teto; battle wrapper não rola |
| error / gameOver | overlay central inalterado |

## Breakpoints

| Faixa | Resultado nesta fase |
|---|---|
| XS `<430` retrato | continua girando 90° (Fase E). Dentro do espaço girado, o novo grid aplica. |
| S `430–820` | grid de 5 faixas, `--card` ≈ 2.75–3.4rem. Front strips podem quebrar em 2 linhas (aceito). |
| M `820–1200` | `--card` ≈ 3.4–7rem. |
| L `1200–1700` | `--card` no teto (6.5rem / 104px). Board centrado com `max-w-[1400px]` → aparece margem lateral (log fixo lateral vem na Fase D). |
| XL `>1700` | board fica em 1400px centrado; margem lateral vazia por enquanto (Fase D/XL preenche). |

## Validação

```
pnpm build          # tsc -b + vite build — verde
pnpm test           # vitest — 237 verdes (nenhum toca UI da página, mas garante motor intacto)
pnpm exec eslint src/pages/SimulatorMatchPage.tsx src/modules/simulator/ui/BattleSlot.tsx
```

Checagem manual (redimensionar janela): board não rola em S/M/L/XL · seam alinhada ·
mão não quebra · combate desenha a linha de mira · pagamento de recurso funciona.

# Spec — Simulador Fases C + D (combinadas): zonas + mão

> Épico: redesenho visual do simulador · Fases 3 e 4 de 5 · branch `feature/simulador-fase-cd-zonas-e-mao`
> Plano visual: <https://claude.ai/code/artifact/430f4738-bd56-4da7-9dc9-62f026fa81a9> (§03, §05)
> Componentes já construídos/revisados: `ShieldRail`, `ResourceMeter`, `PileTray`, `CounterChip`, `HandFan`
> (branch `feat/simulador-componentes-bcd`)

## Por que C + D juntas

Ambas são "trocar componente pré-construído + deletar o antigo" no mesmo arquivo
(`SimulatorMatchPage.tsx`), na mesma região (`renderSide`). Fazer separado = 2 rebases no mesmo
arquivo, 2 PRs que se pisam. Juntas = 1 passada coerente, 1 gate-review, 1 PR.

## Objetivo

- **C — ler o estado:** trocar `ShieldStack` → `ShieldRail` (trilha de pips), `ResourceTray` →
  `ResourceMeter` (medidor `◆◆◆◇`), `renderPile` → `PileTray` (chip → bandeja overlay),
  `renderDeckTile` → `CounterChip`. Deletar `ShieldStack.tsx` e `ResourceTray.tsx`.
- **D — mão:** trocar `renderHandCard`/`renderMyHandCards` → `<HandFan>` como conteúdo da
  `HandDrawer`. Deletar `renderHandCard`/`renderMyHandCards`.

Só camada de UI. Nenhuma mudança de motor / API / `viewState`.

## Fora de escopo

- **Opp shields no HUD** (plano §03) — precisa de variante `compact` do `ShieldRail` + rework do HUD
  bar. Diferido; nesta fase o shield do oponente continua na `frontStrip` dele, só que como
  `ShieldRail`.
- **Inspetor no painel lateral do XL** (plano §03, Fase D) — diferido pra Fase E (widescreen).
- **Eco de log** — já foi na Fase B (`ActionDock logTail`).
- **Popover ao tocar `CounterChip` de Deck/Resource Deck** — diferido; o chip fica só leitura por ora.
- Board portrait / rotação 90° (Fase E).

## Mudanças de frontend

### Arquivos

| Arquivo | Mudança |
|---|---|
| `ShieldRail.tsx` · `ResourceMeter.tsx` · `PileTray.tsx` · `CounterChip.tsx` · `HandFan.tsx` (+ testes) | trazidos de `feat/simulador-componentes-bcd` |
| `package.json` / `pnpm-lock.yaml` | devDeps `@testing-library/*` + `jsdom` — **agora usadas** (testes de C/D usam RTL) |
| `src/modules/simulator/ui/index.ts` | exports dos 5 componentes; remove `ShieldStack`, `ResourceTray` |
| `src/pages/SimulatorMatchPage.tsx` | `renderLeftColumn`/`renderRightColumn`/`frontStrip` reescritos com os novos componentes + adapters; `renderHandCard`/`renderMyHandCards` → `<HandFan>`; deleta os helpers antigos |
| `src/modules/simulator/ui/ShieldStack.tsx` · `ResourceTray.tsx` | **deletados** |

### Adapters (o modelo de seleção da página é por `instanceId`)

- **`ShieldRail`** é index-based (`selectedIndexes` / `onSelectIndex`). A página seleciona por
  `instanceId` (`selected[]` + `toggleSelect`). Adapter em `renderSide`:
  `selectedIndexes = player.shields.map((s, i) => selected.includes(s.instanceId) ? i : -1).filter(i => i >= 0)`;
  `onSelectIndex = (i) => { const s = player.shields[i]; if (s) toggleSelect(s.instanceId); }`.
- **`ResourceMeter`** — `resources = player.resourceArea.filter(não-hidden).map(r => ({ instanceId: r.instanceId, rested: r.rested, isEx: r.def.isToken }))`;
  `level = player.counts.resourceArea`; `costProgress = isSelf && pending && pendingCost > 0 ? { paid: selectedResources.length, total: pendingCost } : undefined`;
  `readOnly = !isSelf`.
- **`PileTray`** — `cards = <pile>.filter(não-hidden)`; `onInspect = setInspect`. Trash/Exílio.
- **`CounterChip`** — Deck: `tone = count <= 2 ? "crit" : count <= 5 ? "warn" : "normal"`. Resource Deck: `tone="normal"`.
- **`HandFan`** — `cards = myHandCards.map(c => { const modes = handPlayModes(c); return { card: c, playable: modes.length > 0, blockedReason: <mesma lógica do renderHandCard> }; })`;
  `onPeek = (c) => setPreview({ card: c, blockedReason, modes })` (precisa recomputar `modes`/`blockedReason` no `onPeek`, ou passar um map).

### O que é DELETADO

- `ShieldStack.tsx`, `ResourceTray.tsx` (arquivos).
- `renderHandCard`, `renderMyHandCards`, `renderPile`, `renderDeckTile` (funções na página).
- imports órfãos que sobrarem.

## Comportamento de interação

- **Sem mudança funcional.** Seleção de shield/recurso pra alvo/custo, inspeção de pilha, jogar
  carta da mão — tudo idêntico, só o visual muda.
- `ShieldRail`: contagem grande sempre visível, vermelha em `≤2`. `ResourceMeter`: `◆` ativo / `◇`
  gasto, EX dourado, barra de custo no pagamento. `PileTray`: toca no chip → bandeja de largura
  total com thumbnails (substitui as "até 3 miniaturas" que não dava pra navegar). `HandFan`: leque
  com lift em foco, aresta ciano = jogável.

## Estados

`default` / `loading` / `empty` (mão 0 → `HandFan emptyLabel`; pilha 0 → "Pilha vazia."; sem
shields → "sem shields — dano direto") / `edge` (6 units, mão 10+ → `HandFan` rola horizontal,
`PileTray` com 30+ cartas → grid rolável).

## Breakpoints

Mesma faixa da Fase A — os componentes usam `var(--card, 3.5rem)` e `flex-wrap`. `PileTray` overlay
é `fixed bottom-0 z-50` (acima do dock `z-40` — é modal, tudo bem cobrir).

## Validação

```
pnpm build
pnpm test    # Fase A/B 260 + testes de C (24) + D (7) = ~291
pnpm exec eslint <arquivos tocados>
```

Checagem manual (2 contas): shields legíveis e a contagem some/reaparece sem "pulo"; medidor de
recursos mostra ativo/gasto/EX; pagar custo clicando no medidor; abrir Trash/Exílio e inspecionar
uma carta; leque de mão com 3 e com 10 cartas; jogar carta pelo leque.

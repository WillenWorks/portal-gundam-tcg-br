# Design Config — Portal Gundam TCG BR

Config lido por `/spartan:ux` e pelo agente `ai-designer`. O portal já tem sistema de
tokens em `src/index.css` — este arquivo **aponta** pra ele, não redefine nada.

## Marca / personalidade

HUD tático de cockpit mecha ("nível arena"). Denso, legível, sem enfeite. **Raio
sutil** nas peças pequenas — `rounded-arena` (`--radius-arena: 3px`) em slots, cards,
chips, botões de canto, barras; painéis grandes seguem no chanfro `.panel-cut`
(Sprint B/polimento visual, 2026-09-04 — antes era `rounded-none` puro). Superfícies
escuras com acento ciano; dourado só para destaque
pontual. Referências de HUD/HUB: **Master Duel** (canto de ação único, LP sempre
visível), **Mobile Suit Arena** (barra de comando inferior, estética mecha densa),
**Hearthstone** (corda de fim de turno, cartas que sobem, mana sempre visível).
Distilar, nunca copiar pixel.

## Tokens (fonte: `src/index.css` — NÃO redefinir, só referenciar)

| Papel | Token / classe | Uso |
|-------|----------------|-----|
| Primária | `--primary` (oklch ciano ~215) | estrutura, ativo, alvo legal, links, seam |
| Acento | `--accent` (oklch dourado ~92) | EX Resource, LINK, "a peça a copiar" |
| Superfícies | `.hero-surface` / `.surface-panel` / `.surface-strong` / `.panel-cut` | painéis |
| Semânticas | esmeralda = alvo legal / ok · vermelho = combate / crítico · âmbar = aviso |
| Fundo | `bg-slate-950` / `--background` | ground do board |

## Cores de jogo (`src/lib/gundam-catalog.ts` → `GAME_COLOR_HEX`)

Blue `#3b82f6` · Green `#22c55e` · Red `#ef4444` · Purple `#a855f7` · White `#e2e8f0`

## Tipografia

Herança do portal (`font-heading` / `font-body` / `heading-portal` / `text-soft` /
`text-muted-portal`). Números da arena (AP/HP, custo, contadores, timer) na variante
mono da mesma família: `font-mono` → `--font-mono: "IBM Plex Mono"` (Sprint B, 2026-09-04).
**Não introduzir face fora dessa família.**

## Grid do board (decisão do plano visual)

Um grid, 5 faixas: HUD / frente-oponente / battle-oponente / **SEAM** / battle-você /
recursos+shields / mão + ActionDock. Battle Areas dividem `1fr 1fr`. O board **NUNCA
rola**. Variável única `--card-w: clamp(3.5rem, 6.5vw, 6.2rem)` (renomeada de `--card`
na Sprint B — `--card` é token de cor), `aspect-ratio: 63/88`.
Largura-teto do board `1400px`, centrado.

## Estados obrigatórios por tela (`rules/ux-design/DESIGN_PROCESS.md`)

`default` · `loading` · `empty` · `error` · `edge` (mão 0, mão 10+, 1 shield, 6 units,
sem Base, EX Resource no índice 0).

## Breakpoints

| Faixa | Largura | Tratamento |
|-------|---------|------------|
| XS | `<430px` | retrato compacto (Fase E) |
| S | `430–820px` | grid completo, `--card-w` no piso |
| M | `820–1200px` | grid completo, `--card-w` médio |
| L | `1200–1700px` | `--card-w` alto, board com largura-teto, log fixo lateral |
| XL | `>1700px` | board centrado, laterais viram log + inspetor fixado |

## AI Asset Generation

`GEMINI_API_KEY` em `.spartan/ai.env` (gitignorado). `pip install google-genai Pillow`.
Usar só para ideação de layout/flow — a arte de carta vem do catálogo real (`GET /api/cards`).

---

_Plano visual completo: <https://claude.ai/code/artifact/430f4738-bd56-4da7-9dc9-62f026fa81a9>_
_Guia de agentes: `INSTRUCOES_AGENTES_SIMULADOR.md` na raiz._

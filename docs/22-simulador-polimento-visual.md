# 22 — Simulador: polimento visual (Sprint B)

**Branch:** `feature/simulador-polimento-visual` (sai de `feature/simulador-jogo-remoto`)
**Data:** 2026-09-04
**Escopo:** só skin / token / copy. `engine/*`, `viewState.ts`, `server/*` **intocados**
(a única exceção é uma string de erro em `matchStore.ts` que vazava jargão pro toast).
Layout, grid, espelhamento, `rotateX` da mesa (sem `preserve-3d`), o chanfro
`.panel-cut` dos painéis, o padrão `CardCornerActions` e o z-order **não regridem**.

Decisões do Willen nesta rodada:
- Raio = **sutil** (~3px em peças pequenas), preservando a assinatura militar e o
  chanfro dos painéis.
- Nomenclatura = **limpar tudo, manter "Simulador"** (sem "Beta"). Manter o botão de
  reportar problema, mas reescrever sem "dev"/"logs".
- Sprint C = endurecimento + persistência (feito antes de B; B rebaseou limpo em cima).

---

## B4 — Copy / jargão interno · commit `1839a90`

Passe de texto pra remover termos de teste interno e alinhar com o glossário pt-BR
(`docs/17`). Sem mudança de estrutura.

| Onde | De → Para |
|---|---|
| Nav, breadcrumb, `SimulatorSandboxPage`, `PortalShell`, botão de fila | "Simulador Beta" → **"Simulador"** |
| `CardInspectorPanel` | "Sensor Tático" / "…em Espera" / "carregar a telemetria" → **"Detalhes da carta"** / **"Nenhuma carta selecionada"** / **"ver os detalhes"** |
| `CardInspectorModal` | aria-label "Abrir/Fechar telemetria" → **"Abrir/Fechar detalhes"** |
| `RotateDevicePrompt` | "assumir o cockpit" → **"Gire o aparelho para continuar"**; "Aguardando orientação" → **"Aguardando o giro da tela"** |
| `SimulatorMatchPage` `PHASE_LABEL` | `main: "Main"` → **"Principal"** |
| `SimulatorMatchPage` botão 🐛 + toasts | sem "dev"/"logs" → **"Relatar um problema com esta partida"** / "Problema registrado (#…). Obrigado pelo aviso!" |
| `SimulatorMatchPage` `notMainPhaseReason` / verbos | "Command" → **"Comando"**, "Main Phase" → **"Fase Principal"**, "Jogando Command" → **"Jogando Comando (Principal/Action)"** |
| `CombatLane` `STEP_LABEL` | "Block Step" → **"Bloqueio"**, "Damage Step" → **"Dano"**, "Fim da Batalha" → **"Fim da batalha"** |
| `GameOverOverlay` + `ActionDock` | casing consistente **"Você venceu"** / **"Você perdeu"** (era "Você Venceu" vs "Você venceu!") |
| `battleLog.ts` | `PHASE_PT.main` "Main" → **"Principal"**; "ficou rested" → **"virou rested"**; "abandono (W.O.)" → **"abandono"** |
| `matchStore.ts` (erro de `joinMatch`) | "…use 2 contas diferentes" (vazava "assento") → **"Você já está nesta partida por outro acesso. Uma partida remota precisa de dois jogadores diferentes."** |
| Pontuação em toasts da página | `--` → `—`, `...` → `…` |

Testes de UI/servidor que afirmavam strings exatas foram atualizados junto
(`GameOverOverlay.test`, `ActionDock.test`, `CardInspectorPanel.test`,
`CardInspectorModal.test`, `battleLog.test`, `matchStore.test`).

---

## B1 — Raio sutil + borda hairline consistente · commit `010e516`

**Token novo** em `src/index.css @theme inline`:

```css
--radius-arena: 3px;   /* gera a utilitária `rounded-arena` (border-radius: 3px) */
```

- `rounded-none` → `rounded-arena` em **28 ocorrências / 12 arquivos**:
  `AbilityResolutionModal`, `ActionDock`, `BurstModal`, `CardCornerActions`,
  `CardInspectorModal`, `CounterChip`, `DockedPilot`, `GameOverOverlay`, `PileTray`,
  `SettingsMenu`, `ShieldRail`, `TriggerOrderModal`.
- `CardFace` / `CardBack`: o wrapper (`overflow-hidden`) ganha `rounded-arena` — a arte
  recorta no cantinho.
- `BattleSlot`: frame do slot, slot vazio e moldura interna ganham `rounded-arena`;
  `border-cyan-500/10|20` (cor autorada à mão, quase igual a `--primary`) →
  `border-primary/10|20|25`.
- **Borda hairline única:** `border-white/12` (1×) e `border-white/15` (10×) →
  `border-white/10`. Um só fio em toda a arena.
- **`.panel-cut` mantido** — chanfro de 16px dos painéis grandes é a assinatura.

Verificado: `dist/…css` contém `rounded-arena{border-radius:3px}`.

---

## B2 — Números da arena em IBM Plex Mono · commit `f4f3352`

```css
--font-mono: "IBM Plex Mono", "IBM Plex Sans", ui-monospace, monospace;
```

- `index.html`: `IBM Plex Mono` (wght 500;600;700) somado ao `<link>` do Google Fonts.
- Definir `--font-mono` no `@theme` faz **toda** classe `font-mono` já existente
  (AP/HP, custo, contadores, timer) usar a variante mono da mesma família — dígitos
  tabulares com identidade, não a monoespaçada do S.O. (Courier).
- Afeta também 3 usos de `font-mono` fora do simulador (`chart.tsx`, `AdminPage`,
  `DeckbuilderPage`) — melhoria consistente, sem regressão.

**Decisão deliberada:** NÃO fazer a "purga de caixa-alta" agressiva prevista no plano.
Os micro-rótulos `text-[8px] uppercase` restantes (AP/HP/Nível, carimbo REST, nome no
placeholder de carta sem arte) são **informação visível única**, não decoração
redundante — mexer neles arrisca a assinatura visual que o Willen pediu pra preservar.

---

## B3 — Bug latente `--card` + contraste · commit `e2cb54d`

**`--card` era colisão de nome:** token de COR do design system
(`--color-card: var(--card)`) **e** comprimento redefinido em
`ArenaPlaymat.CANVAS_STYLE` (`clamp(3.5rem, 6.5vw, 6.2rem)`), lido por ~12 componentes
via `calc(var(--card, …))`. Qualquer `bg-card` / `text-card` / `border-card` dentro da
arena pegaria a **largura da carta** como cor. Renomeado o comprimento → **`--card-w`**
(13 usos: `ArenaPlaymat` CANVAS_STYLE + STATION_WIDTH + BATTLE_ROW_WIDTH +
gridTemplateColumns, `BaseCardGauge`, `CounterChip`, `HandFan`, `ResourceMeter`,
`ShieldRail`). `ArenaPlaymat.test` atualizado.

**Deferido (precisa de sign-off do design-critic + QA visual, fora do escopo
"polimento do simulador"):**
- `.surface-panel` (`bg-white/5`) está quase invisível no fundo escuro. É utilitária
  **global** usada em 23 arquivos do portal — subir a opacidade mexe no app inteiro.
- Auditoria da pilha de alpha da arena (`--card`/0.88 + `hero-surface` + `bg-slate-950/40`
  + `panel-cut` + `backdrop-blur`) e contraste 4.5:1 de `text-slate-500/600` sobre o
  gradiente — melhor validar com screenshot nos 5 breakpoints do que ajustar às cegas.

---

## Verificação (todos os passos)

| Check | Status |
|---|---|
| `pnpm run check:types` (`tsc -b`) | ✓ |
| `pnpm run lint:simulator` (eslint) | ✓ 0 erro |
| `pnpm vitest run src/modules/simulator src/pages` | ✓ 384/384 |
| `pnpm build` | ✓ (`rounded-arena` e `font-mono` presentes no CSS gerado) |

**QA visual (lado do Willen):** 2 contas, comparar com os screenshots atuais nos 5
breakpoints (XS/S/M/L/XL) em dark / light / zeon. Confirmar: bordas suaves e cantos
levemente arredondados sem "vazar" a assinatura; nenhum texto interno sobrou; números
legíveis; layout idêntico ao de hoje.

## `.planning/design-config.md`

Atualizado: lock `rounded-none` → "raio sutil `rounded-arena`"; nota de `--font-mono`;
`--card` → `--card-w` na seção do grid.

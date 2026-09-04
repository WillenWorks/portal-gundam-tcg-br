# Plano — espelhamento do playmat, header enxuto, HUD, botões de campo, mão e fim de jogo

Branch: `feature/simulador-pivot-visual-arena`. Continuação da sprint (P0–P4 já feitos, ver `PLANO_CORRECAO_EFEITOS_UX_LIFECYCLE.md`).

## 1. Diagnóstico (do relato + capturas 3–6)

| # | Problema | Onde |
|---|---|---|
| 1 | Linha de recursos com scrollbar visível quebrando o visual; não acompanha a largura da Battle Area | `ResourceMeter.tsx`, `ArenaPlaymat.tsx`, `index.css` |
| 2 | Campo do oponente mal espelhado — deveria ser rotação 180° do playmat, com a Battle Area do oponente colada à seam e os recursos dele no TOPO da tela | `ArenaPlaymat.tsx`, `SimulatorMatchPage.arenaSide` |
| 3 | Header ocupa espaço com botões/textos demais | `SimulatorMatchPage.tsx` (HUD topo) |
| 4 | Info textual redundante (Turno/Fase no topo-centro + badge topo-direita + painel "VEZ DO OPONENTE" no dock). Info de sistema (sincronizado/assento) misturada com info de jogo | `SimulatorMatchPage.tsx`, `ActionDock.tsx` |
| 5 | Avisos/confirmações ficam só no dock do canto — passam despercebidos | novo `CenterAnnounce`, `SimulatorMatchPage.tsx` |
| 6 | Botão de Atacar/Ativar/Blocker no `BattleSlot` aparece mas não clica (o clique de "abrir carta" come o evento); deveriam ficar escondidos e sair pra DIREITA da carta no hover | `BattleSlot.tsx` |
| 7 | Mão: cartas apertadas demais em repouso; botão "Ver" (olho) desnecessário — clicar no meio da carta já abre; "Jogar" deveria ficar escondido, surgir no hover no canto sup. direito | `HandFan.tsx`, `SimulatorMatchPage.tsx` |
| 8 | Fim de jogo precisa registrar vencedor/perdedor + motivo e mostrar "Você Venceu/Perdeu" GRANDE no centro, motivo pequeno abaixo, com textos "Oponente se rendeu / abandonou / sofreu dano / ficou sem cartas" | `engine/types.ts`, `engine/events.ts`, `server/matchStore.ts`, novo `GameOverOverlay`, `SimulatorMatchPage.tsx` |

## 2. Fases

### F1 — Scroll fantasma + recursos na largura da Battle Area
- `index.css`: utilitário `.scrollbar-ghost` — `scrollbar-width: thin` + `scrollbar-color` quase transparente; `::-webkit-scrollbar { height: 4px }`, thumb `rgba(148,163,184,.15)` → `.35` no `:hover`. `.scrollbar-none` pra onde não deve rolar nunca.
- `ResourceMeter`: trilha interna usa `.scrollbar-ghost`; largura alvo = a mesma da `BattleRow` (`calc(var(--card) * 6 + gaps)`), centralizada. Deck de Recursos vira um item da própria linha (à esquerda), não um irmão solto.
- `ArenaPlaymat`: os wrappers `overflow-x-auto` das áreas de recurso ganham `.scrollbar-ghost`; `HandFan` idem.

### F2 — Espelhamento 180° do oponente
Ordem vertical final do canvas:
```
[recursos do oponente]      ← topo
[Battle Area do oponente]
════════ SEAM ════════
[Battle Area do jogador]
[recursos do jogador]
[mão]
```
- `OpponentTheater`: `resources` ACIMA da `battleRow` (battleRow encostada na seam). `handSummary` no topo de tudo.
- `ShieldStation`/`DeckStation`: prop `mirrored` → ordem dos filhos invertida.
  - `DeckStation` normal (jogador, direita): Exílio, Trash, Deck (topo→baixo). `mirrored` (oponente, esquerda): Deck, Trash, Exílio.
  - `ShieldStation` normal (jogador, esquerda): Base, Shields. `mirrored` (oponente, direita): Shields, Base (base encostada na seam).
- Contagem do deck do oponente passa a aparecer (`hideCount={false}` no `deck` e no `resourceDeck` do oponente) — decisão do Willen desta rodada ("pode mostrar a quantidade de cartas no deck").

### F3 — Header enxuto
- Remove a barra do topo inteira (texto Turno/Fase, badges de timer/sync, botão "Sair").
- Sobra um cluster flutuante no canto sup. esquerdo: `[⚙ Config]` `[🐞 Bug]` (ícones, `size-8`).
- `⚙` abre um `Popover` (`SettingsMenu`): toggle "Auto-passar Action Step", botão "Desistir da partida" (com confirmação), e o link "Voltar ao lobby" quando `gameOver`.

### F4 — HUD textual → ícones
- Turno/fase/timer: uma tira compacta e discreta (ícones + número) — reaproveita o `ActionDock` (estado `idle` já mostra fase + timer). Amplia `idle` pra `turno N` + ícone de fase; remove o texto duplicado do topo.
- Sincronizado/assento: chip minúsculo, opaco, canto inf. esquerdo (`RefreshCw` + `A`/`B`) — info de sistema, separada.
- Remove o `logTail` redundante se o `CenterAnnounce` cobrir (mantém — é barato).

### F5 — Avisos no centro da tela
- Novo `CenterAnnounce` (`ui/`): overlay `pointer-events-none`, centro do canvas, texto grande semitransparente que aparece pra: alvo pendente, custo a pagar, "escolha a Unit pra parear", início de combate ("Defenda ou passe"), decisão interativa. Sai sozinho após alguns segundos ou quando o estado muda. Fonte da verdade: os mesmos derivados que hoje alimentam `ActionDock.hint`.

### F6 — Botões de campo escondidos + clicáveis
- `BattleSlot`: `<div>` do slot ganha `group`. A tira de ícones vai pra `absolute left-full top-1/2 -translate-y-1/2 ml-1`, `opacity-0 pointer-events-none` → `group-hover/focus-within: opacity-100 pointer-events-auto`. Slot ganha `hover:z-30 focus-within:z-30` pra a tira passar por cima do slot vizinho.
- `onClick` de cada `IconBtn`: `e.stopPropagation()` (não deixa o clique subir pro handler de inspeção do face).
- `IconBtn` recebe o evento; assinatura `onClick: (e) => void`.

### F7 — Mão
- `HandFan`: `DEFAULT_OVERLAP` menor (0.18) quando `cards.length <= 6`; escala até `MAX_OVERLAP` conforme cresce (`overlap = clamp(0.18, 0.18 + (n-6)*0.06, 0.6)`).
- Remove o botão "Ver" (olho) e a prop `onViewCard`. Clicar no corpo da carta chama `onInspect(card)` (nova prop) — abre o zoom. `onPeek` continua no botão "Jogar".
- Botão "Jogar": `absolute -top-2 -right-2`, `opacity-0` → `group-hover/hc:opacity-100`, mesmo ícone `Play`.
- `SimulatorMatchPage`: `onInspect={(c) => setPreview({card:c, ...describeHandCard(c)})}`; remove `onViewCard`.

### F8 — Fim de jogo: vencedor/perdedor + motivo
- `engine/types.ts`: `GameOverInfo["reason"]` e o evento `GAME_OVER` ganham `"resignation"`.
- `server/matchStore.ts`: `resignMatch` → `reason: "resignation"`. `claimAbandonWin` + auto-forfeit AFK seguem `"abandonment"`. `logGameOverOnce(match)` — `console.info` estruturado com winner/loser/reason na 1ª vez que `gameOver` aparece (via `notify`).
- Client `GameOverOverlay` (`ui/`): overlay centro-tela, `bg-slate-950/80`, "VOCÊ VENCEU" / "VOCÊ PERDEU" (5xl, cor esmeralda/vermelha), motivo pequeno abaixo, botão "Voltar ao lobby (Ns)". Substitui o estado `gameOver` do `ActionDock` como superfície principal (o dock pode sumir no fim de jogo).
- Rótulos de motivo (ponto de vista do viewer):

| reason | venceu | perdeu |
|---|---|---|
| `noShieldsBattleDamage` | "Oponente sofreu dano sem shields" | "Você sofreu dano sem shields" |
| `deckOut` | "Oponente ficou sem cartas no deck" | "Você ficou sem cartas no deck" |
| `resignation` | "Oponente se rendeu" | "Você se rendeu" |
| `abandonment` | "Oponente abandonou a partida" | "Você abandonou a partida" |

## 3. Ordem de execução
F8 (motor→server, base) → F1 → F2 → F6 → F7 → F3 → F4 → F5. Checkpoint verde a cada fase: `pnpm test && pnpm run check:types && pnpm run lint:simulator`; `pnpm build` ao fim. Commit por fase com diff no corpo.

## 3b. Rodada de ajuste (feedback pós-F1–F8, 2026-09-03)

### G1 — Botões de campo no canto sup. direito da carta (float-right), não fly-out
O fly-out (`left-full`, fora da carta) não pega hover de forma confiável e some do
alcance. Novo desenho, igual ao "Jogar" da mão:
- Tira de ícones `absolute -top-2 right-0`, `flex flex-row-reverse` — Atacar no
  canto (mais à direita), Ativar/Blocker/Mirar imediatamente à esquerda dele.
- Escondida (`opacity-0 pointer-events-none`) → aparece no `group-hover/slot` /
  `group-focus-within/slot`, na PRÓPRIA carta (sem vão de hover pra atravessar).
- `translateZ(30px)` mantém o hit-test acima do plano 3D da mesa (ver
  [[simulador-preserve3d-hit-test]]).
- `mirror` deixa de mudar a posição (era `right-full` no oponente) — sempre
  canto sup. direito, como a mão. Prop `mirror` removida.
- Arquivos: `BattleSlot.tsx` (+teste), `SimulatorMatchPage.renderBattleSlots`.

### G2 — Prompt no meio da tela vira painel "modal" que NÃO bloqueia
O `CenterAnnounce` no centro (texto 2xl) tapa visualmente as Units que você
precisa clicar pra parear/mirar — mesmo com `pointer-events-none` o alvo some
atrás do texto. Novo:
- Renomeia `CenterAnnounce` → `MatchPrompt`. Painel compacto estilo modal
  (`panel-cut border border-primary/40 bg-slate-950/95`, ícone + texto `text-sm`),
  fixo no TOPO-centro (`top-3`), fora do caminho visual/clique do tabuleiro.
- `pointer-events-none` no wrapper (reforço) — nunca intercepta clique nem hover.
- Fade-in curto. Sai quando a intenção some.
- Arquivos: `MatchPrompt.tsx` (ex-CenterAnnounce) + `index.ts` + página.

## 3c. 2ª rodada de ajuste (feedback + vídeo, 2026-09-03)

### G3 — Cluster de canto unificado (mão + campo), "Ver" sempre presente
O vídeo mostra que o botão Atacar (no canto da carta) ainda conflita com o clique
de "abrir imagem" — a arte tinha `onClick=onInspect` competindo. Solução do
Willen: unificar o padrão da mão e do campo.
- `CardCornerActions.tsx` (novo): cluster no canto sup. direito. "Ver" (olho)
  SEMPRE ancorado no canto; contexto à esquerda dele. **Sempre visível** (não
  depende de hover). Cada botão faz `stopPropagation`.
- `BattleSlot`: a arte deixa de ser clicável pra inspeção — só vira `<button>` de
  seleção quando é ALVO LEGAL (pareamento/mira). Cluster = `[Atacar? Ativar?
  Blocker? Mirar?] [Ver]`. Removido o badge "BLK" da carta (o botão de escudo já
  identifica o blocker, só aparece quando é hora de bloquear).
- `HandFan`: volta o botão "Ver" (olho) sempre; "Jogar" à esquerda dele quando
  jogável. Corpo da carta não é mais clicável. Filtro P&B move pra um wrapper
  interno (não esmaece os botões do canto).
- Arquivos: `CardCornerActions.tsx` (+teste), `BattleSlot.tsx` (+teste),
  `HandFan.tsx` (+teste), `index.ts`.

## 4. Status

| Fase | Estado | Commit / notas |
|---|---|---|
| F8 — fim de jogo (motivo + overlay) | ✅ | `d156ce7` — reason `resignation` distinto; `GameOverOverlay` centro-tela; `logGameOverOnce`; `CenterAnnounce` |
| F1 — scroll fantasma + largura recursos | ✅ | `7d40cd5` — `.scrollbar-ghost`/`.scrollbar-none`; `ResourceLane` trava recursos na largura da Battle Area |
| F2 — espelhamento 180° do oponente | ✅ | `7d40cd5` — `mirrored` em Shield/DeckStation; recursos do oponente no topo; contagem de deck do oponente visível |
| F6 — botões de campo escondidos/clicáveis | ✅ | `62d2abb` — tira sai pra fora da carta no hover; `translateZ` conserta o hit-test sob `preserve-3d` |
| F7 — mão (espaço, sem olho, jogar escondido) | ✅ | `fb175e4` — `overlapFor(count)`; corpo clicável = `onInspect`; sem "Ver"; "Jogar" escondido no canto |
| F3 — header enxuto (⚙ + 🐞) | ✅ | `SettingsMenu` popover (auto-pass + desistir); barra do topo removida; ⚙ + 🐞 flutuando |
| F4 — HUD textual → ícones | ✅ | turno/fase/timer só no `ActionDock` (idle ganha `turnNumber`); sinc/assento = chip minúsculo canto inf. esq. |
| F5 — avisos no centro da tela | ✅ | `CenterAnnounce` (com F8) — eco da intenção atual grande no meio, `pointer-events-none` |
| G1 — botões de campo no canto (float-right) | ✅ | tira `-top-2 right-0` na própria carta (revisto no G3) |
| G2 — prompt vira painel modal que não bloqueia | ✅ | `CenterAnnounce`→`MatchPrompt`: painel `panel-cut` no topo-centro (`top-3`), `pointer-events-none`, texto `text-sm` — sai do caminho visual/clique do tabuleiro |
| G3 — cluster de canto unificado (mão+campo), "Ver" sempre | ✅ | `CardCornerActions`: "Ver" (olho) sempre no canto + contexto à esquerda; arte não é mais clicável (fim do conflito Atacar↔abrir imagem); badge "BLK" removido; +3 arquivos de teste |

# Instruções de agentes — Redesenho visual do Simulador

Guia operacional para tocar o **redesenho da tela de partida do Simulador Beta**
(`SimulatorMatchPage.tsx` + `src/modules/simulator/ui/`) com Claude Code, skills do
Spartan e mais de um agente.

O **plano visual** (diagnóstico, grid de board, zona a zona, breakpoints, referências
Master Duel / Mobile Suit Arena / Hearthstone, faseamento A–E) está no artifact:
<https://claude.ai/code/artifact/430f4738-bd56-4da7-9dc9-62f026fa81a9>

> Escopo desta task: **só a camada visual/UX**. O motor de regras (`engine/*`), o
> `matchStore.ts` do servidor e as rotas de API **não mudam**.

---

## 1. Invariantes — cole isto em TODO prompt de agente

```
INVARIANTES (redesenho visual do simulador)
- Branch: dev. NUNCA commitar/pushar em main. Sem tocar em produção.
- NÃO alterar: src/modules/simulator/engine/*, src/modules/simulator/server/*,
  server/index.ts (rotas do simulador), viewState.ts. Só camada de UI.
- Fonte de verdade do design: o plano visual (artifact acima) + .planning/design-config.md.
- Tokens: usar as vars do portal em src/index.css (--primary ciano, --accent dourado,
  panel-cut/hero-surface/surface-panel, rounded-none). NUNCA cor Tailwind crua
  (bg-blue-500) nem fonte genérica quando houver token.
- Sem animações obrigatórias. Qualquer transição <= 120ms, opcional, respeitando
  prefers-reduced-motion. Estado tem que ser legível parado.
- Antes de terminar: `pnpm build` (tsc -b + vite build) E `pnpm test` verdes.
  Rodar `pnpm exec eslint <arquivos tocados>` — não pode adicionar erro novo.
- Componentes de UI ficam em src/modules/simulator/ui/. A página só orquestra
  estado/ações e encaminha cliques (padrão já estabelecido em docs/19).
- Toda a saída ao usuário em português.
```

---

## 2. Setup único (fazer ANTES da Fase A)

### 2.1 `.planning/design-config.md`

O comando `/spartan:ux` e o agente `ai-designer` leem este arquivo. O portal já tem
tokens em `src/index.css` — o design-config só aponta pra eles. Crie:

```markdown
# Design Config — Portal Gundam TCG BR

## Marca / personalidade
HUD tático de cockpit mecha ("nível arena"). Denso, legível, sem enfeite.
Cantos retos (rounded-none). Superfícies escuras com acento ciano; dourado só
para destaque pontual. Referências de HUD: Master Duel, Mobile Suit Arena, Hearthstone.

## Tokens (fonte: src/index.css — NÃO redefinir, só referenciar)
| Papel | Token | Uso |
|-------|-------|-----|
| Primária | --primary (oklch ciano ~215) | estrutura, ativo, alvo legal, links |
| Acento | --accent (oklch dourado ~92) | EX Resource, LINK, "a peça a copiar" |
| Superfícies | .hero-surface / .surface-panel / .panel-cut | painéis |
| Semânticas | esmeralda = alvo legal/ok · vermelho = combate/crítico · âmbar = aviso |

## Cores de jogo (src/lib/gundam-catalog.ts → GAME_COLOR_HEX)
Blue #3b82f6 · Green #22c55e · Red #ef4444 · Purple #a855f7 · White #e2e8f0

## Tipografia
Herança do portal (font-heading / font-body). Não introduzir face nova.

## Grid do board (decisão do plano visual)
1 grid, 5 faixas: HUD / frente-oponente / battle-oponente / SEAM / battle-você /
recursos+shields / mão+ActionDock. Battle Areas = 1fr 1fr. Board NUNCA rola.
Variável única `--card: clamp(44px, (100vw - chrome)/8.5, 128px)`, aspect 63/88.

## Estados obrigatórios por tela (rules/ux-design/DESIGN_PROCESS.md)
default · loading · empty · error · edge (mão 0, mão 10+, 1 shield, 6 units)

## Breakpoints
XS <430 (retrato compacto) · S 430–820 · M 820–1200 · L 1200–1700 · XL >1700

## AI Asset Generation
GEMINI_API_KEY em .spartan/ai.env. `pip install google-genai Pillow`.
Usar só para ideação de layout/flow — a arte de carta vem do catálogo real.
```

### 2.2 `.spartan/ai.env` (já no .gitignore)

```
GEMINI_API_KEY=...sua chave...
```

Depois: `pip install google-genai Pillow`. Isso habilita o agente `ai-designer` e a
geração de assets em `/spartan:ux`.

### 2.3 E2E — adaptar o scaffold para Vite

`/spartan:e2e` assume Next.js. Ao rodar, corrigir dois pontos:

- `playwright.config.ts` → `webServer` deve subir **os dois** processos:
  `command: "pnpm dev:full"`, `url: "http://localhost:5173"` (Vite), a API em `:8787`.
- A tela-alvo (`/simulador/partida/:matchId`) **exige uma partida pareada** — precisa
  de 2 contexts de browser logados em contas diferentes entrando na fila
  (`/simulador`), OU uma fixture que crie a partida via as rotas `hosterRequired` de
  debug. Documentar a escolha no `tests/e2e/fixtures/`.

---

## 3. Skills recomendadas (em `.claude/skills/` e `.claude/commands/spartan/`)

| Skill / comando | Papel nesta task | Quando |
|---|---|---|
| **`/spartan:epic`** | Quebra as 5 fases em features ordenadas com dependência | 1× no início |
| **`/spartan:spec`** | Spec por fase → `.planning/specs/` → Gate 1 | início de cada fase |
| **`/spartan:ux prototype`** | Design doc + review dual (designer + `design-critic`); lê o design-config | fases **B, C, E** (têm tela/elemento novo). A e D podem pular. |
| **`/spartan:plan`** | Plano de implementação → `.planning/plans/` → Gate 2 | depois da spec/prototype |
| **`/spartan:build frontend`** | Pipeline completo: entender → plan → TDD → review → PR. Tem modo Agent Teams embutido (ver §4). | motor de cada fase |
| **`/spartan:gate-review`** | Gate 3.5 — `phase-reviewer` avalia; ambos têm que aceitar | antes do PR de cada fase |
| **`/spartan:qa`** | QA browser real (Playwright) — clica pelos fluxos como usuário | depois que cada fase mergeia |
| **`/spartan:e2e`** | Scaffold Playwright | 1× (setup) |
| **`/spartan:pr-ready`** | Rebase em dev, `pnpm build`, checks, gera PR | fim de cada fase |
| **`frontend-design`** (skill, auto) | A craft dos componentes; foge do visual genérico de IA | durante todo o build — **a mais importante pro resultado** |
| **`react-best-practices`** (skill, auto) | O board re-renderiza a cada evento SSE — memo/split/`key` estável | durante o build |
| **`ui-ux-pro-max`** (skill) | Elementos discretos (Action Dock, medidor, bandeja de pilha); traz MCP do shadcn/ui (base de UI do repo) | ao desenhar componente novo |
| **`clean-code`** (skill, auto) | O plano prevê **deleção líquida** (grid tira 2 layouts; dock tira ~180 linhas de condicional) | review |
| **`design-workflow`** (skill) | Guia anti-genérico de IA; complementa `frontend-design` | design gate |
| **`testing-strategies`** / **`webapp-testing`** (skills) | Padrões de teste; interação com app local via Playwright | QA |
| **`game-development`** / **`mobile-design`** (skills) | Consulta pontual — convenções de tabuleiro; toque/perf mobile pra Fase E | Fases A e E |

### NÃO usar (assumem Next.js App Router — o repo é **Vite + React + wouter**)

`/spartan:next-app`, `/spartan:next-feature`, `/spartan:figma-to-code`. O
`/spartan:fe-review` é útil (React, tokens, a11y, null-safety) mas **ignore a seção de
convenções de rota** dele.

---

## 4. Modelo de orquestração — 4 camadas

```
CAMADA 0 — ORQUESTRADOR (você, sessão principal)
  /spartan:epic  →  fila de fases  →  merges em dev  →  checklist deste arquivo
  NÃO escreve código de feature. Só spec/plan e integração.
        │
        ▼  por fase (A → B → C → D → E)
CAMADA 1 — PIPELINE DA FASE
  /spartan:spec  →  [/spartan:ux prototype]  →  /spartan:plan  →  /spartan:build frontend
  O /spartan:build tem multi-agente EMBUTIDO:
    - AGENT_TEAMS=off (padrão): Stage 4 implementa sequencial; Stage 5 spawna 1 revisor.
    - AGENT_TEAMS=on (env CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 ou .spartan/build.yaml):
      Stage 4 cria 1 time `spartan-{slug}`; Stage 5 reusa com 3 revisores paralelos
      (quality + test + a11y/security); Stage 6 apaga o time.
        │                          │
        ▼                          ▼
CAMADA 2 — DESIGN GATE            CAMADA 3 — QA INDEPENDENTE
  (só B, C, E)                     (depois do merge de cada fase)
  ai-designer → design-critic      /spartan:qa  em agente NOVO, sem contexto de código,
  → .planning/design/screens/      testa como usuário. 2 browser contexts p/ parear partida.
```

### Quando abrir agente novo vs. mesma sessão vs. worktree

| Trabalho | Onde roda | Por quê |
|---|---|---|
| `/spartan:epic`, `/spartan:spec`, `/spartan:plan` | **sessão do orquestrador** | Baratos; o plano precisa "lembrar" do épico. |
| `/spartan:build frontend "<fase>"` | **sub-agente novo** (`subagent_type: "claude"` ou `general-purpose`) **OU terminal separado com worktree** | Saída de ferramenta enorme — isola. O `build.md` já suporta modo PARALELO com worktree por terminal. |
| Ideação de design | agente **`ai-designer`** (via `/spartan:ux`) | Precisa do Gemini + lê design-config. |
| Design Gate | agente **`design-critic`** | Pega padrão genérico de IA, quebra de token, a11y, responsivo. |
| Gate 3.5 | agente **`phase-reviewer`** (via `/spartan:gate-review`) | SOLID, clean code, regras do projeto. Nunca auto-revisar. |
| QA pós-merge | agente **novo, genérico** (via `/spartan:qa`) | Sem contexto de código = testa de fora, acha bug de verdade. |

### Paralelismo entre fases — a análise honesta

Depois que **A** mergeia, o diagrama de dependência do plano diz que **B, C e D são
independentes**. MAS **as três editam `SimulatorMatchPage.tsx`** (a página que
orquestra) → worktrees paralelos **vão conflitar nesse arquivo**.

Duas saídas:

- **RECOMENDADO — sequencial, agente novo por fase.** `A → B → C → D → E`, cada uma
  no seu `/spartan:build`, cada uma mergeada em `dev` antes da próxima começar. Zero
  conflito, cada fase é um PR revisável. Custo: ~9–11 dias em série.

- **Paralelo parcial (se quiser velocidade).** Divida cada fase em:
  1. **Componentes puros novos** em `src/modules/simulator/ui/` (ex. `ActionDock.tsx`,
     `ShieldRail.tsx`, `ResourceMeter.tsx`, `PileTray.tsx`, `HandFan.tsx`) — sem tocar
     na página. Vão em **worktrees paralelos**, cada um com um teste/story de fixture.
  2. **Integração na página** — o orquestrador puxa os componentes prontos e faz a
     fiação em `SimulatorMatchPage.tsx` **em série**, um de cada vez.

  Isso paraleliza ~60% do esforço sem conflito. A Fase A e a E ficam sempre em série
  (A é fundação; E remove a rotação e reescreve o container raiz).

---

## 5. Mapa por fase

| Fase | Objetivo | Arquivos principais | Design Gate? | Novos componentes | Custo |
|---|---|---|---|---|---|
| **A — Grid + escala** | Trocar os 2 playmats `auto 1fr auto` pelo grid de 5 faixas; `--card` clamp; corrigir `aspect-[63/108]→63/88`; largura-teto centrada | `SimulatorMatchPage.tsx`, `BattleSlot.tsx`, novo `boardGrid.css`/vars | Não (re-layout) | — (quase só deleção) | ~1–2 d |
| **B — Action Dock** | Colapsar HUD-text + flash de fase + os ~6 cards de decisão centralizados num componente com enum `dockState` | novo `ActionDock.tsx`; `SimulatorMatchPage.tsx` (remove os blocos condicionais) | **Sim** | `ActionDock.tsx` | ~2 d |
| **C — Ler o estado** | Shield rail horizontal (sua + a do oponente no HUD) · medidor de recursos grande · chips de pilha + bandeja overlay de largura total | novos `ShieldRail.tsx`, `ResourceMeter.tsx`, `PileTray.tsx`, `CounterChip.tsx`; substitui `ShieldStack.tsx`/`ResourceTray.tsx`; `SimulatorMatchPage.tsx` | **Sim** | 4 componentes | ~2–3 d |
| **D — Mão + inspetor + log** | Leque plano com lift; inspecionar no painel do XL (não modal); eco da última linha do log sob o dock | novo `HandFan.tsx`; `CardInspectorModal.tsx` (variante painel), `MobileHandDrawer.tsx` (teto 32vh), `BattleLogDrawer.tsx` (tira de eco) | Sim (leve) | `HandFan.tsx` | ~2 d |
| **E — Portrait + fim da rotação** | Board portrait compacto p/ XS; **deletar** `MOBILE_ROTATE_QUERY` e o `transform: rotate(90deg)` | `SimulatorMatchPage.tsx` (container raiz), novo `PortraitBoard.tsx` | **Sim** | `PortraitBoard.tsx` | ~1–2 d |

Ordem obrigatória: **A primeiro** (introduz grid + `--card`). B/C/D em qualquer ordem
depois de A. **E por último** (mexe no container raiz que todas as outras assumem).

---

## 6. Prompts prontos por agente

> Em todos: colar o bloco de **Invariantes** do §1 no topo.

### 6.1 Orquestrador — kickoff do épico (sessão principal)

```
/spartan:epic redesenho visual do simulador de partida

Base: o plano visual em
https://claude.ai/code/artifact/430f4738-bd56-4da7-9dc9-62f026fa81a9
e este arquivo (INSTRUCOES_AGENTES_SIMULADOR.md).

5 features na ordem A→B→C→D→E do §5 deste arquivo. Dependências: A desbloqueia
B/C/D; E é sempre a última. Uma branch por feature saindo de dev, um PR por feature.
Não gerar spec/plan agora — só o épico e a fila.
```

### 6.2 Spec por fase (sessão principal)

```
/spartan:spec Simulador — Fase {X}: {título da fase do §5}

Contexto: {objetivo do §5}. Arquivos previstos: {lista do §5}.
Fonte de design: plano visual (artifact) seção correspondente + .planning/design-config.md.

A spec DEVE ter a seção "Frontend Changes" (rules/backend-micronaut/API_DESIGN.md):
todos os componentes, mudanças de tipo, layout (em qual faixa do grid entra), estado
(novo? usa estado existente da página?), e comportamento de interação.
DEVE listar os estados obrigatórios (default/loading/empty/error/edge) desta tela.
DEVE listar o comportamento nos 5 breakpoints (XS/S/M/L/XL).
Sem mudança de motor/API — se a spec precisar de dado novo, PARE e me avise.
```

### 6.3 Design prototype — fases B, C, E (agente `ai-designer` via comando)

```
/spartan:ux prototype

Feature: Simulador — Fase {X}: {título}.
Track: Quick (system já existe em .planning/design-config.md → ir direto pro prototype).
Ler .planning/design-config.md e a spec em .planning/specs/.
Referências de HUD/HUB: Master Duel (canto de ação, LP sempre visível), Mobile Suit
Arena (barra de comando inferior, estética mecha densa), Hearthstone (corda de fim de
turno, cartas que sobem, mana sempre visível). Distilar, não copiar pixel.

Entregar: .planning/design/screens/simulador-fase-{x}/prototype.html com os 5 estados
e os 5 breakpoints. Rodar o loop com design-critic até ambos aceitarem.
Restrições: sem animação obrigatória; cantos retos; tokens do portal; nada de
gradiente roxo, fonte genérica ou "tudo centralizado".
```

### 6.4 design-critic — se invocado direto (fora do `/spartan:ux`)

```
Você é o design-critic. Avalie o prototype em
.planning/design/screens/simulador-fase-{x}/prototype.html contra:
- Padrões genéricos de IA (roxo/gradiente, fonte safe, emoji de seção, tudo card).
- Conformidade de token com .planning/design-config.md e src/index.css (falha dura
  se usar cor Tailwind crua ou fonte fora do portal).
- Acessibilidade: contraste 4.5:1, alvo de toque >=44px, foco visível, estado não só
  por cor (forma tem que carregar: rested=girado, shield quebrado=pip vazio).
- Responsivo real nos 5 breakpoints; o board NÃO pode rolar; a seam central tem que
  bater nos dois lados.
- Coerência com o plano visual (artifact).
Verdito: ACEITO / AJUSTAR (com lista) / REJEITADO. Discuta com o designer até aceitar.
```

### 6.5 Build por fase — o motor (sub-agente novo OU terminal com worktree)

```
/spartan:build frontend Simulador — Fase {X}: {título}

Spec: .planning/specs/{arquivo}.  Plano: .planning/plans/{arquivo}.
{Se B/C/E:} Design: .planning/design/screens/simulador-fase-{x}/prototype.html.

Fases do build:
- Stage 1–2: já feitas (spec/plan existem) — pular pra implementação.
- Stage 4 (implement): componentes novos em src/modules/simulator/ui/; a página só
  orquestra. Seguir o grid de 5 faixas e a var --card. TDD onde fizer sentido
  (lógica de dockState, cálculo de pips, seleção de recurso).
- Stage 5 (review): NUNCA auto-revisar — spawnar phase-reviewer.
- Stage 6: parar antes do PR (o /spartan:pr-ready é passo separado do orquestrador).

Ao terminar: `pnpm build` e `pnpm test` verdes; eslint sem erro novo; diff resume o
que foi DELETADO (esta task é redução líquida de código).
{Fase A:} corrigir aspect-[63/108] → aspect-[63/88] no BattleSlot.
{Fase E:} deletar MOBILE_ROTATE_QUERY, useIsPortraitMobile e o wrapper rotate(90deg).
```

### 6.6 Build paralelo — só componente puro (worktree isolado)

```
Você constrói UM componente isolado, sem tocar em SimulatorMatchPage.tsx.

Componente: src/modules/simulator/ui/{Nome}.tsx  (Fase {X}).
Contrato (props) definido na spec .planning/specs/{arquivo} seção "Frontend Changes".
Entregar junto: {Nome}.test.tsx com fixtures cobrindo os estados
(default/empty/edge) — sem depender de partida real.
Seguir --card / grid do design-config. Tokens do portal. Sem animação.
NÃO importar nem editar a página nem outros componentes desta fase — só o seu +
o teste. A fiação é feita depois pelo orquestrador.
`pnpm exec vitest run src/modules/simulator/ui/{Nome}.test.tsx` verde ao final.
```

### 6.7 Gate 3.5 (agente `phase-reviewer` via comando)

```
/spartan:gate-review Fase {X}

Diff: as mudanças não commitadas da branch feature/{slug}.
Checklist Gate 3.5 + regras do projeto (rules/frontend-react/FRONTEND.md,
rules/ux-design/DESIGN_PROCESS.md). Focos específicos desta task:
- Motor intocado? (engine/*, viewState.ts, server/index.ts do simulador)
- É redução de código? (deletou o que prometeu?)
- --card / grid de 5 faixas seguidos? board não rola em nenhum breakpoint?
- Estado por forma, não só cor? alvo de toque >=44px?
- Sem `!!`, sem workaround, sem cor Tailwind crua, sem fonte genérica.
- Sem layout shift por evento de jogo (slot vazio mantém tamanho, leque fixo).
{Se AGENT_TEAMS on e diff >= 10 arquivos:} time de review (quality + test + a11y).
```

### 6.8 QA pós-merge (agente novo, genérico)

```
/spartan:qa http://localhost:5173/simulador simulador — Fase {X}

Suba `pnpm dev:full`. Entre com DUAS contas de teste em contexts separados, ambas
na fila em /simulador, deixe parear, navegue pra /simulador/partida/:matchId.
Teste como jogador: jogar carta com custo (pagar recurso), declarar ataque, defender,
Action Step, encerrar turno, quebrar shield, inspecionar carta inimiga.
Nos 5 breakpoints (redimensione a janela): o board rola? a seam bate? o Action Dock
sempre responde "o que fazer"? shields e recursos legíveis? algum elemento cobre
carta clicável?
Screenshots em tests/e2e/screenshots/fase-{x}/. Reportar bugs com passos.
```

### 6.9 PR por fase (sessão principal)

```
/spartan:pr-ready

Feature: Simulador — Fase {X}. Rebase em dev. `pnpm build` + `pnpm test` + eslint.
PR contra dev (NUNCA main). Descrição: o que mudou visualmente, o que foi deletado,
antes/depois (link do screenshot do QA), quais breakpoints validados.
Rodapé de atribuição conforme configuração da sessão.
```

---

## 7. Ordem de execução

```
SETUP  ── design-config.md ── .spartan/ai.env + pip ── /spartan:e2e (adaptar Vite)
   │
   ▼
FASE A ── spec ─────────────── plan ── build(agente) ── gate-review ── qa ── pr-ready ──► merge dev
   │
   ▼
FASE B ── spec ── ux/critic ── plan ── build(agente) ── gate-review ── qa ── pr-ready ──► merge dev
   │
   ▼
FASE C ── spec ── ux/critic ── plan ── build(agente) ── gate-review ── qa ── pr-ready ──► merge dev
   │              (C pode paralelizar os 4 componentes puros em worktrees — §4)
   ▼
FASE D ── spec ─────────────── plan ── build(agente) ── gate-review ── qa ── pr-ready ──► merge dev
   │
   ▼
FASE E ── spec ── ux/critic ── plan ── build(agente) ── gate-review ── qa ── pr-ready ──► merge dev
   │
   ▼
FECHO  ── /spartan:magic-doc docs/18 e docs/19 (atualiza o histórico do simulador)
       ── (opcional) escrever docs/20-simulador-redesenho-visual.md
```

## 8. Checklist de PR por fase

- [ ] Só arquivos de UI no diff — nada de `engine/*`, `server/*`, `viewState.ts`
- [ ] `pnpm build` verde · `pnpm test` verde · `pnpm exec eslint` sem erro novo
- [ ] Board **não rola** em XS / S / M / L / XL
- [ ] Seam central alinhada nos dois lados
- [ ] `--card` dirige todos os tamanhos de carta (nenhum `w-9`/`w-11`/`w-20` fixo novo)
- [ ] Estado por forma, não só cor (rested girado, shield/recurso legíveis)
- [ ] Alvo de toque ≥ 44px em tudo clicável
- [ ] Sem layout shift ao comprar carta / perder unit
- [ ] Nenhum overlay cobre carta que precisa ser clicada
- [ ] Design Gate aceito (B/C/E) · Gate 3.5 aceito
- [ ] QA com 2 contas passou · screenshots anexados
- [ ] Diff mostra o que foi **deletado**
- [ ] PR contra **dev**

---

## 9. Status

| Fase | Estado | Branch | Notas |
|---|---|---|---|
| Setup | ✅ feito | — | `.planning/design-config.md`, `.planning/specs/` criados. `.spartan/ai.env` = usuário. `/spartan:e2e` pendente. |
| **A — Grid + escala** | ✅ **MERGEADA em `dev`** — PR #4, merge `fa6715a` (2026-09-02). Gate 3.5 ✅, QA ✅. | — (branch apagada) | — |
| **B — Action Dock** | 🟡 **componente pré-construído** (`ActionDock.tsx` + teste). Falta: spec → ux/critic → plan → **fiação na página** → gate-review → PR. | `feat/simulador-componentes-bcd` | ver §11 |
| **C — Ler o estado** | 🟡 **componentes pré-construídos** (`CounterChip`, `ShieldRail`, `ResourceMeter`, `PileTray` + testes). Falta: mesmo pipeline + trocar `ShieldStack`/`ResourceTray`. | `feat/simulador-componentes-bcd` | itens 1–2 do Gate 3.5 da Fase A podem ir junto |
| **D — Mão + inspetor + log** | 🟡 `HandFan.tsx` **pré-construído** (+ teste). Falta: pipeline + fiação (`HandFan` como conteúdo da `HandDrawer`, depois leque sempre-visível) + inspetor no painel XL + eco de log. | `feat/simulador-componentes-bcd` | — |
| E — Portrait + fim da rotação | ⬜ sempre por último | — | — |

### Fase A — o que foi feito (commitado)

- Spec: `.planning/specs/simulador-fase-a-grid-de-board.md` (inclui a seção "Desvio" da mão).
- `SimulatorMatchPage.tsx`: `renderPlaymat` → `renderSide`; board vira grid de 5 faixas
  **sem rolagem** (`--card: clamp(2.75rem, 7.5vw, 6.5rem)`, `max-w-[1400px]` centrado, seam
  central); `renderLeftColumn`/`renderRightColumn` horizontais; **recursos do oponente
  agora aparecem** (read-only). `renderMyHandCards` recebe as cartas prontas (dedupe).
- `BattleSlot.tsx`: slot vazio `aspect-[63/108]` → `aspect-[63/88]`.
- **Mão** → `HandDrawer` (renomeada de `MobileHandDrawer`, agora em **toda tela**):
  gaveta de 44 px na base, sobe por cima do board, recolhe sozinha ao jogar uma carta.
  Transições da gaveta ≤ 120 ms + `motion-reduce:transition-none`.
- Removido: o container que rolava (`overflow-y-auto`+`pb-24`), wrapper `scale-[0.94]`,
  grid `grid-cols-[auto_1fr_auto]`, `flex-wrap` da mão, `renderPlaymat`,
  `MobileHandDrawer.tsx`. Saldo em `src/`: **≈ +53 linhas** (o `renderSide` é mais
  explícito que o `renderPlaymat`; a `HandDrawer` ganhou `subtitle` + `motion-reduce`).
- Motor / `viewState` / `server` **não tocados**. **Sem mudança funcional** — seleção,
  ataque, block, pagamento de custo, refs do `CombatLane` intactos.
- Verificação: `pnpm build` ✅ · `pnpm test` 237/237 ✅ · `eslint` limpo ✅ · Gate 3.5 ✅.
- Registro também em `docs/18-simulador-fase1-motor-e-dsl.md`.

### Gate 3.5 — issues aceitas como estão / deferidas

| # | Sev | Item | Decisão |
|---|---|---|---|
| 1 | rec | `myHandCards` duplicava filtro de `renderMyHandCards` | **corrigido** (arg) |
| 2 | rec | `handPlayModes(c)` avaliado 2×/carta/render | deferido — impacto baixo (poucas cartas), Fase D reescreve `renderHandCard` |
| 3 | rec | transições da `HandDrawer` > 120 ms, sem `prefers-reduced-motion` | **corrigido** |
| 4 | nit | nomes `renderLeftColumn`/`renderRightColumn` stale | deferido — Fase C substitui |
| 5 | nit | `HandDrawer` × `BattleLogDrawer` z-40 no canto | deferido — Fase B/D mexe no z-stack |
| 6 | nit | `overflow-hidden` no `battle` corta rodapé em viewport baixo | aceito na spec — Fase E |

---

## 10. QA visual — Fase A  ✅ concluído (mantido como referência p/ o QA das próximas fases)

A Fase A só mexeu em layout/CSS — risco **100% visual**, tela só renderiza com match pareado.

> **Status:** 1ª rodada (2026-09-02) achou 1 bug — a mão espremia/cobria a Battle Area
> no notebook. Corrigido: mão → `HandDrawer` (gaveta na base). Re-QA da gaveta OK.
> **PR #4 mergeado em `dev`** (`fa6715a`). Roteiro abaixo continua válido como base
> pro QA das Fases B–E.

### Subir o ambiente
1. `pnpm dev:full`  (Vite `:5173` + API `:8787`)
2. Dois navegadores — ou uma aba normal + uma anônima — logados em **duas contas
   diferentes**.
3. Nos dois: `/simulador` → escolher deck → entrar na fila. Ao parear, os dois vão
   pra `/simulador/partida/:matchId`.

### Roteiro (redimensionar a janela em ~800 / ~1100 / ~1440 / ~1920 px)
- [ ] Board **não rola** (nem scrollbar vertical) em nenhuma das 4 larguras.
- [ ] A seam vermelha central alinha as duas Battle Areas — sua frente e a do oponente
      se "encaram" no meio.
- [ ] Em 1440/1920 o board fica **centrado com margem lateral** (esperado — a Fase D
      preenche as laterais). Não pode esticar até as bordas.
- [ ] Slots de unidade: vazios e preenchidos têm a **mesma altura** (nada "pula" ao
      deployar / perder unit).
- [ ] **Battle Area do seu lado NÃO é coberta** por nada — a mão está recolhida na aba
      da base (`✋ Mão (N) · M jogáveis`), não em cima do campo.
- [ ] Aba da mão: tocar/clicar/arrastar pra cima abre a gaveta por cima do board;
      arrastar pra baixo (ou tocar de novo) fecha. Com 7+ cartas, a gaveta rola na
      horizontal.
- [ ] Ao clicar "Jogar" numa carta, a gaveta **recolhe sozinha** e a base do board
      (Recursos/Base/Shields) fica visível pra pagar o custo.
- [ ] `prefers-reduced-motion` ligado (DevTools → Rendering): a gaveta abre/fecha
      **sem** animação de slide.
- [ ] Recursos do oponente aparecem (bandeja read-only na faixa dele).
- [ ] Jogar carta com custo: abrir a mão → clicar carta → "Jogar" → clicar recursos
      ativos → Confirmar.
- [ ] Declarar ataque: a **linha de mira** (SVG vermelho tracejado) liga o atacante ao
      alvo. Testar mirar unit rested do oponente e "o jogador".
- [ ] Do outro lado: Blocker / "Não bloquear" funcionam.
- [ ] Action Step de fim de turno: aviso central aparece, "Passar" funciona.
- [ ] Clicar carta do board → abre o modal de zoom (inspetor).
- [ ] Trocar de turno → flash de fase aparece.
- [ ] Celular retrato (DevTools <430px): a tela ainda gira 90° — **isso é da Fase E,
      não é bug**. Dentro do espaço girado, o novo grid deve aplicar.

### Se algo quebrar
Screenshot em `tests/e2e/screenshots/fase-a/` + passos. Bug de **layout puro**
(cortado / sobreposto / ilegível) → corrigir na própria branch antes do PR. Bug
**funcional** (clique não responde, ação falha) → provavelmente não é da Fase A
(nenhuma lógica mudou), mas reportar mesmo assim.

---

## 11. Componentes B/C/D pré-construídos — branch `feat/simulador-componentes-bcd`

3 agentes paralelos (worktrees) construíram só os **componentes novos de `ui/`** —
**sem fiação na página**. Commit `d60b12c`, pushado. `pnpm build` ✅ · `pnpm test`
291/291 ✅ · `eslint` limpo nos 12 arquivos.

| Fase | Componente(s) | API (resumo) |
|---|---|---|
| B | `ActionDock.tsx` | prop `state`: união de 8 `kind` (`idle · pending · attacking · defending · actionStep · oppDecision · abandonAvailable · gameOver`) + `busy?` + `logTail?` + callbacks. Sem import do motor — a página extrai as strings do `CardInstance` e monta o `state`. |
| C | `CounterChip` · `ShieldRail` · `ResourceMeter` · `PileTray` | `ShieldRail`: `{count, max?, selectable?, selectedIndexes?, onSelectIndex?, justBroken?}`. `ResourceMeter`: `{resources:{instanceId,rested,isEx}[], level, selectable?, selectedIds?, onSelect?, readOnly?, costProgress?}`. `PileTray`: `{label, count, icon?, tone?, cards, art, onInspect?}` (abre overlay). `CounterChip`: `{label, count, tone?, icon?, onClick?}`. |
| D | `HandFan.tsx` | `{cards:{card,playable,blockedReason?}[], art, onPeek, overlap?, emptyLabel?}`. Leque plano, lift em foco, aresta ciano = jogável. |

### Infra de teste (decisão desta rodada)

O projeto declarava "Vitest + Testing Library" mas **não tinha RTL instalado** (só
testes de engine em `.test.ts`). Adicionado como devDeps na branch:
`@testing-library/react` · `@testing-library/dom` · `@testing-library/jest-dom` ·
`jsdom`. Testes de componente usam `// @vitest-environment jsdom` por arquivo
(`vitest.config.ts` intacto). O `ActionDock.test.tsx` (agente B) usa
`renderToStaticMarkup` + walker, sem RTL — inconsistente com os outros; normalizar
no gate-review da Fase B.

### Como cada fase consome isto

O pipeline normal de cada fase continua valendo (spec → `/spartan:ux prototype` →
plan → build → gate-review → PR próprio contra `dev`). Na etapa de **build**, em vez
de criar o componente do zero, o agente:
1. Branca de `dev`, faz `git checkout feat/simulador-componentes-bcd -- <arquivos da fase>` (ou merge da branch).
2. **Ajusta a API** se a spec/prototype pedir diferente (esses componentes são rascunho).
3. **Faz a fiação** em `SimulatorMatchPage.tsx` + `ui/index.ts` + remove o componente antigo (`ShieldStack`/`ResourceTray`/os cards de decisão/etc.).
4. Gate 3.5 + QA + PR.

### Polimento já identificado (pro gate-review de cada fase)

- `ShieldRail`: em modo `selectable` os pips viram `<button>` e quebram o `role="list"/listitem`.
- `PileTray`: `role="dialog"` sem focus-trap / Escape / backdrop.
- `CounterChip`/`ResourceMeter`: `aria-label` em `<div>` não-interativo (ignorado por leitores).
- `ResourceMeter`: peça `pickable` fica 44×44 e destoa visualmente da peça não-clicável (menor).

### DÍVIDA — z-stack do canto inferior (Fase A #5, Fase B #1)

`HandDrawer`, `ActionDock` e `BattleLogDrawer` são todos `fixed` perto de `bottom-0` **em
`z-40`**, sem offset combinado — empate de z-index resolvido só por ordem de DOM → colisões
recorrentes. Fase B mitigou (dock em `bottom-11`/`sm:bottom-14`, acima da aba da mão). A **Fase
C** (que reformula o HUD) deve resolver de vez: um sistema de z + offsets explícito pros 3
(ex.: hand `z-40`, dock `z-45` acima da aba, log `z-50` como overlay).

---

_Gerado como apoio ao redesenho visual do Simulador Beta. Plano completo no artifact
linkado no topo. Branch de trabalho: dev._

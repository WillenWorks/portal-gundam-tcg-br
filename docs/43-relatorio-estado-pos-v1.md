# Relatório de Estado — Execução Pós-v1.0 (Frentes 1–5)

> Gerado em 2026-09-05 ao fim da rodada de execução paralela orquestrada.
> Referências: [AI_GUIDE.md](../AI_GUIDE.md), [PLANEJAMENTO.md](../PLANEJAMENTO.md), docs/38–42.

---

## 1. Resumo executivo

| Frente | Branch | Estado | Testes | Push |
|---|---|---|---|---|
| **F1** Deckbuilder (curva de nível + mão inicial + estilo visual) | `dev` | ✅ 4/4 | +8 | ✅ `origin/dev` |
| **F2** Pipeline de tradução PT-BR | `dev` | 🟡 4/5 (falta `--apply` no banco) | +28 | ✅ `origin/dev` |
| **F3** Waves ST03 + ST04 no motor | `dev` | ✅ 8/8 + 4 cláusulas deferidas | +33 | ✅ `origin/dev` |
| **F4** Overhaul visual/UX do simulador | `feature/simulator-layout` | ✅ 7/7 | 433 verdes | ❌ local (6 commits) |
| **F5** WebSocket & multiplayer | `feature/simulator-websocket` | 🟡 5/7 (migração do cliente + prod diferidos) | 488 verdes | ❌ local (3 commits) |

`dev` HEAD: `d5d009a`. Suíte completa em `dev`: **515 testes verdes**, `tsc -b` + `vite build` OK.

Commits em `dev` (novos nesta rodada):
- `7f068f7` chore(scripts): execução paralela via git worktrees
- `5dd1e19` feat(deckbuilder): level curve stats and visual style position — **F1**
- `81acadc` feat(simulator): primitivas lookAtTopFilterReveal e deployFromHandTriggered — **F3**
- `41c5770` feat(simulator): st03 and st04 deck engine implementation — **F3**
- `d5d009a` feat(catalog): automated pt-br effect translation pipeline — **F2**

---

## 2. Como o `.bat` operou — procedimentos usados

### 2.1 Cadeia de inicialização
`iniciar-paralelo.bat` → `scripts/iniciar-paralelo.ps1` (reescrito nesta rodada para usar **git worktrees**):
1. Garante `dev` no repo principal.
2. Cria worktrees `../portal-gundam-tcg-br-worktrees/{simulator-layout,simulator-websocket}` (uma pasta por branch → `git checkout` numa aba não afeta as outras — problema do script original).
3. `pnpm install` (via `corepack`, fallback embutido — `pnpm` puro não está no PATH deste ambiente) em cada worktree novo.
4. Abre 3 abas do Windows Terminal, uma por frente, cada uma com `claude` + instrução de rodar `/iniciar-execucao`.

`parar-paralelo.bat` / `.ps1` (novos): removem os worktrees ao encerrar (branches e commits preservados).

### 2.2 Skill `/iniciar-execucao`
Lê a branch atual, mapeia o escopo (Seção 6 do AI_GUIDE) e entra em modo contínuo. Nesta execução:
- A **sessão principal** (`dev`) rodou `/iniciar-execucao`, assumiu F1+F2+F3.
- F2 e F3 têm arquivos disjuntos → F2 despachada como **subagente** (mesma worktree `dev`), F3 executada na thread principal.
- F4 e F5 foram despachadas como **subagentes operando diretamente nas worktrees** `simulator-layout` / `simulator-websocket` (não havia sessão de terminal viva pra `SendMessage`). Antes: `dev → merge` (fast-forward) nas duas branches para carregarem os docs 38–42.

### 2.3 Orquestração multi-agente (o que rodou em paralelo)
| Executor | Frente | Worktree | Arquivos |
|---|---|---|---|
| Sessão principal | F3 | `dev` | `engine/`, `content/`, `fixtures/`, `SimulatorSandboxPage`, `server/index.ts` |
| Subagente `general-purpose` | F2 | `dev` | `scripts/translate-*`, `data/translations-*`, `CardInspector*` |
| Subagente `ai-designer` | F4 | `simulator-layout` | `src/modules/simulator/ui/*` |
| Subagente `general-purpose` | F5 | `simulator-websocket` | `server/*`, `src/modules/simulator/{server,network}/*` |

Sem colisão de arquivos entre executores. Cada subagente commitou na sua própria branch (F4/F5) ou devolveu os arquivos pra a sessão principal commitar (F2).

---

## 3. MCP e RAG — o que os planos pediam × o que foi feito

**Resumo honesto: nenhum servidor MCP foi configurado no repo e o `scripts/mcp-gundam-engine.mjs` sugerido nunca foi criado. O "RAG" dos planos foi implementado na forma de _grounding_ (contexto canônico injetado no prompt / lido do código), não como vetor/embeddings.**

### 3.1 MCP

| Item do plano | Onde | Estado |
|---|---|---|
| MCP Postgres/Supabase (AI_GUIDE §3.2) | validar `CardModel`, aplicar traduções | **Não usado ainda.** Disponível via connector claude.ai (`mcp__claude_ai_Supabase__*`). É o próximo passo (F2 `--apply`). |
| MCP Chrome DevTools / Browser QA (AI_GUIDE §3.2) | validar viewport/layout no simulador | **Não usado.** F4 foi validada só com testes de componente (vitest + Testing Library). É o que a página de teste visual (seção 7) resolve. |
| MCP Git (AI_GUIDE §3.2) | transição de branches, diffs | **Não usado** — usei `git` CLI direto (worktrees + `git -C`), equivalente. |
| Servidor MCP custom `scripts/mcp-gundam-engine.mjs` (docs/40 §4, PLANEJAMENTO §5) — ferramentas `gundam_get_card` / `gundam_search_glossary` / `gundam_verify_engine` | acelerador de contexto pros agentes | **Não construído.** É tooling-sobre-tooling, apresentado nos planos como economizador de tokens, não como entregável de frente. Trabalhei com leitura direta de arquivo + subagentes com escopo restrito. Custo/benefício de construí-lo + fiar nos subagentes não compensou nesta rodada. Fica como melhoria opcional. |
| `.mcp.json` no repo / `~/.claude.json` mcpServers | — | Ambos ausentes/vazios. Os MCPs de plataforma (Supabase, Render, Vercel, GitHub) vêm dos connectors da conta claude.ai, não do repo. |

### 3.2 RAG

| Item do plano | O que foi feito |
|---|---|
| RAG p/ tradução — "indexação de docs/17 + Comprehensive Rules pra grounding terminológico" (docs/40 §2.1, §5; PLANEJAMENTO §5) | ✅ **na forma de grounding embutido.** O `scripts/translate-card-effects.mjs` tem a constante `GLOSSARY_GROUNDING` — resumo das regras do `docs/17` + tabela de termos protegidos + guia gramatical imperativo pt-BR — injetada em **todo** prompt do Gemini. Não é vetor/busca semântica; é o contexto canônico inteiro no prompt (viável porque `docs/17` é pequeno). |
| RAG p/ motor — "recuperar EffectSpecs similares pra reaproveitar a DSL em vez de inventar propriedades" (docs/40 §3; AI_GUIDE §3.1 "Engine Training") | ✅ **manualmente.** Antes de autorar ST03/ST04 li `content/st01.ts`, `content/st02.ts`, `engine/effectSpec.ts`, `engine/types.ts`, `content/predicates.ts` e reaproveitei os padrões existentes (`EffectSpec`, `PrimitiveCall`, `TargetRef`, `PredicateResolver`, `TargetFilterResolver`). Toda extensão nova segue a convenção "novo membro da union / novo caso no resolver", nunca uma reescrita. Não houve retriever automatizado — foi leitura dirigida. |
| Validador de integridade de tokens (docs/40 §2.2) | ✅ implementado (`validate()` — multiset EN×PT + varredura de `【】`/`<>`/`[]`/stat residual). Roda em toda tradução (LLM ou manual, via `--revalidate`). |

**Conclusão da seção:** a intenção dos planos ("não deixar a IA alucinar termo de jogo nem inventar DSL fora do padrão") foi cumprida, mas por injeção direta de contexto + revisão de código existente, não pela infra de RAG/MCP descrita. Se quiser a infra de verdade (MCP server + retriever), é uma frente própria.

---

## 4. Checklists — item a item

### Frente 1 — Deckbuilder (`dev`) — 4/4 ✅
- [x] Curva de nível de Units — `DeckbuilderPage.tsx`, aba Estatísticas, "Gráfico 04", clicável, Lv.6+ agrupado.
- [x] Estatística de nível na Mão Inicial — tile "Unit de nível baixo na abertura" (Lv.1–3, hipergeométrico).
- [x] Estilo visual / capa movido pra logo abaixo da barra de salvamento.
- [x] Commit `5dd1e19`.
- Base: `src/lib/deck-level-stats.ts` (helpers puros) + 8 testes.

### Frente 2 — Tradução PT-BR (`dev`) — 4/5 🟡
- [x] Script `scripts/translate-card-effects.mjs` — tokenizer léxico, grounding docs/17, motor Gemini `gemini-3.6-flash`, validador de tokens, flags `--dry-run/--resume/--apply/--revalidate`. 14 testes.
- [x] Lote `data/translations-st01-04.json` — 64 cartas ST01–ST04: 52 com `effectPt`, 12 sem efeito (OK vazias), **0 rejeitadas** pelo validador.
- [ ] **`--apply` no Postgres — PENDENTE.** `node scripts/translate-card-effects.mjs --apply` gera `BEGIN; UPDATE "CardModel" ...; UPDATE "Card" ...; COMMIT;`. Rodar via MCP Supabase ou Postgres local.
- [x] Exibição no simulador — `CardInspectorModal`/`Panel` ganharam o componente `CardEffectText` (PT por padrão, toggle PT/EN quando `effectPt` e `effectEn` chegam e diferem). 14 testes.
- [x] Commit `d5d009a`.
- **Nota:** a chave Gemini fornecida é free-tier e travou em `429 RESOURCE_EXHAUSTED` após ~1 carta. 1/52 traduzida pelo Gemini (ST01-010), 51/52 traduzidas à mão seguindo `docs/17` e revalidadas com `--revalidate`. Decisão do Willen: manter as traduções como estão. `Rest`/`Active` ficaram como token literal (regra docs/17) → gera "Coloque-a em Rest".
- **Follow-up:** `SimulatorMatchPage.tsx` passa hoje só `effectText={cardText[code]}` (que já resolve `effectPt || effectEn`); pra o toggle PT/EN aparecer no simulador falta um ajuste de 1–2 linhas nessa página (passar `effectPt`/`effectEn` separados). Catálogo (`CardDetailPage`/`CardsPage`) ainda não consome `effectPt` — depende do `--apply`.

### Frente 3 — Waves ST03 + ST04 (`dev`) — 8/8 ✅ + 4 deferidos
- [x] Auditoria carta a carta (docs/41).
- [x] Primitivas de motor: `lookAtTopFilterReveal`, `deployFromHandTriggered`, `discardNamed`; `TargetRef.pairedUnit`; filtros `ap<=N`/`level>=N`/`hasKeyword:X`; predicados `selfApAtLeast`/`controllerHasOtherLinkUnit`/`pairedPilotLevelAtLeast`/`namedChoiceEquals`/`sourcePairedUnitIsLinkUnit`/`noControllerUnitTokenWithTrait`.
- [x] `fixtures/st03Deck.ts` — 16 únicas + tokens T-006/T-007. `content/st03.ts` — 16 EffectSpecs / 9 cartas. `st03.test.ts` — 12 testes.
- [x] `fixtures/st04Deck.ts` — 16 únicas + tokens T-008/T-009/T-010. `content/st04.ts` — 19 EffectSpecs / 11 cartas. `st04.test.ts` — 14 testes.
- [x] Habilitados no sandbox (`SimulatorSandboxPage` DECK_OPTIONS) e no servidor (`server/index.ts` `SIMULATOR_DECKS`).
- [x] `npx vitest run src/modules/simulator` verde (456 na época; 484 com `src/lib`).
- [x] Commits `81acadc` + `41c5770`.
- **4 cláusulas deferidas** (autorizadas pelo Willen p/ implementação a partir do texto EN):
  1. **ST03-001 Sinanju** — gatilho "destrói carta de shield area em batalha → escolhe Unit inimiga, 2 de dano". `combat.ts` só tem `destroyEnemyInBattle`; falta `destroyEnemyShieldInBattle` + escolha de alvo em combate. (O `<High-Maneuver>` During Pair está como keyword fixa — aproximação.)
  2. **ST03-014 The Blue Giant** — "não pode receber dano de batalha de Unidades inimigas com 2 ou menos de AP nesta batalha". Prevenção de dano condicional por AP do atacante, análoga a `preventShieldDamage` mas por Unit.
  3. **ST04-011 Athrun Zala** — 【When Linked】concessão temporária de "mirar Unit inimiga ativa Lv≤5". Hoje `attackTargetRules` é campo estático de `CardDef`.
  4. **ST04-015 Archangel** — cláusula "It can't attack during this turn" do 【Activate･Main】 (o `Set active` funciona).

### Frente 4 — Overhaul visual (`feature/simulator-layout`) — 7/7 ✅
- [x] Piso de `--card-w` 44px→64px em `useArenaScale`/`ArenaPlaymat`, `overflow-hidden` no canvas.
- [x] Botão `<Eye>` removido; inspeção por clique/Enter na área neutra da carta (`BattleSlot`/`BaseCardGauge`/`HandFan`). — `CardFace.tsx` é puramente apresentacional; o wrapper de cada componente de tabuleiro dispara `onInspect` (mesmo padrão do `legalTarget`).
- [x] Dano da Base no canto inferior direito — `BaseCardGauge`, badge `rgba(0,0,0,0.85)`, borda vermelha, `font-mono`.
- [x] Recursos empilhados com badge `xN` em `ResourceMeter`, sem `overflow-x`.
- [x] Seta de ataque mira a coluna Base/Escudos real à esquerda (`ShieldStation` registra `playerShieldKey`, `CombatLane` consome); pulso no escudo sob mira.
- [x] Banner `ActionDock` `lg:w-fit` + `lg:whitespace-nowrap` — "Fase Principal · Ação" não trunca no desktop.
- [x] Microinterações (draw, revelação de Burst, ataque/bloqueio +6px, embaralhamento) via `tw-animate-css` + `motion-reduce`.
- [ ] "Commit único" — foram **6 commits semânticos** (`47a9265`, `21901da`, `bee39f1`, `e2a86ad`, `1fcdb49`, `682ecdb`). Willen decide se quer squash no merge.
- **Decisão do subagente:** usou `tw-animate-css` (já no projeto) em vez de `framer-motion` — motivo técnico: `motion.div` grava `transform` inline e mata o `:hover` do lift da mão. `framer-motion` continua disponível.
- **Pendente:** validação visual em navegador real (nenhum browser foi aberto — só testes de componente).

### Frente 5 — WebSocket (`feature/simulator-websocket`) — 5/7 🟡
- [x] `socket.io` + `socket.io-client` 4.8.3; `io` na mesma porta HTTP (`server/index.ts` + `server/simulatorSocket.ts`), **ao lado do SSE** (aditivo, SSE intacto).
- [x] `matchStore.ts` — `subscribeAllMatches()` (emitter global; broadcast `match:view_update` redigido por assento), `queuePositionFor()`. Timers autoritativos mantidos.
- [x] `src/modules/simulator/network/socketClient.ts` — singleton, reconexão backoff 500ms→10s, reemissão de `match:join`, fila de ações com `actionSeq`, telemetria de ping.
- [ ] **Migração de `SimulatorMatchPage.tsx` SSE→socket.io — DIFERIDA** (instrução do Willen: "a migração total do cliente vem depois, com validação"). SSE segue ativo.
- [x] Desafio direto por link — `challenge:create`/`accept`/`ready`, UI em `SimulatorSandboxPage` ("Jogar com um amigo", código `GC-####`, fluxo `/simulador?challenge=CÓDIGO`). Rota adaptada ao hash-router `wouter` (o `/simulator/match/join?code=` do doc não existe no app).
- [x] Testes de rede/concorrência — `socketBridge.test.ts`, adições em `matchStore.test.ts`, integração real com sockets em `server/simulatorSocket.test.ts` (10 testes).
- [ ] "Commit único" — foram **3 commits** (`510ced7`, `d27a705`, `d295ca0`).
- **Não coberto nesta rodada:** matchmaking ranqueado (evento `queue:join {mode:"ranked"}` é aceito mas sem caminho próprio); "em produção" (depende de deploy + migração do cliente).

---

## 5. Critérios de Sucesso (PLANEJAMENTO §2)

| Critério | Estado |
|---|---|
| Textos de efeito traduzidos ST01–04, exibidos no simulador e catálogo, keywords intactas | 🟡 traduções ✅ + validador ✅ + inspetor do simulador ✅; **catálogo + banco pendem do `--apply`**; toggle no `SimulatorMatchPage` pende de follow-up de 1–2 linhas |
| ST03/ST04 jogáveis ponta a ponta, `vitest src/modules/simulator` 100% | ✅ 515 verdes; cartas jogáveis (4 cláusulas deferidas não impedem partida) |
| Tabuleiro adaptável a qualquer resolução, sem scroll, recursos empilhados, mira à esquerda | 🟡 código ✅ (F4); **falta validação visual em navegador real** |
| Motor WebSocket em produção, salas, reconexão, convite por link | 🟡 infra ✅ (F5); **não em produção, cliente do tabuleiro não migrado** |
| Deckbuilder com curva de nível + cálculo na mão inicial | ✅ |

## 6. Critérios de Homologação para merge em `dev` (AI_GUIDE §7)

| Critério | Estado |
|---|---|
| `vitest src/modules/simulator` verde | ✅ em `dev` (515); F4 (433) e F5 (488) verdes independentemente nas suas branches. **Falta a run combinada pós-merge.** |
| `check:types` sem erro | ✅ em `dev`; ✅ nas branches independentemente |
| Validação manual em navegador — partida ST03 vs ST04 via convite WebSocket + conferência do `Feedback.pdf` | ❌ **não feito** |

---

## 7. Próximos passos (autorizados nesta rodada)

1. **F2 `--apply`** — rodar o SQL de tradução via MCP Supabase (ou Postgres local/Docker). Após isso, o catálogo passa a exibir `effectPt`.
2. **Página de teste visual cru** — rota dev-only (`import.meta.env.DEV`, sem auth) na branch `feature/simulator-layout` que renderiza o playmat/arena com dados de amostra estáticos (cartas sample, campos fixos), pra validar F4 em navegadores/displays reais sem logar nem entrar no simulador.
3. **F3 — 4 cláusulas deferidas** — estender o motor a partir do texto EN das cartas (Sinanju shield-trigger, The Blue Giant, Athrun 【When Linked】, Archangel "can't attack").
4. **Aguardando decisão do Willen:** push das branches `feature/*`; ordem de merge; squash dos commits de F4/F5; migração do cliente do simulador pra socket.io (F5); infra real de MCP/RAG (opcional).

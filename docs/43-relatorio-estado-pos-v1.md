# Relatório de Estado — Execução Pós-v1.0 (Frentes 1–5)

> Gerado em 2026-09-05 ao fim da rodada de execução paralela orquestrada.
> Referências: [AI_GUIDE.md](../AI_GUIDE.md), [PLANEJAMENTO.md](../PLANEJAMENTO.md), docs/38–42.

---

## 1. Resumo executivo

| Frente | Branch | Estado | Push |
|---|---|---|---|
| **F1** Deckbuilder (curva de nível + mão inicial + estilo visual) | `dev` | ✅ 4/4 | ✅ `origin/dev` |
| **F2** Pipeline de tradução PT-BR | `dev` | ✅ 5/5 (traduções aplicadas no banco via MCP Supabase) | ✅ `origin/dev` |
| **F3** Waves ST03 + ST04 no motor | `dev` | ✅ 8/8 + as 4 cláusulas antes deferidas **fechadas 100%** | ✅ `origin/dev` |
| **F4** Overhaul visual/UX do simulador + página de preview | `feature/simulator-layout` | ✅ 7/7 + preview DEV-only | ❌ local (8 commits) |
| **F5** WebSocket & multiplayer | `feature/simulator-websocket` | 🟡 5/7 (migração do cliente + prod diferidos) | ❌ local (3 commits) |

`dev` HEAD: `0965587`. Suíte completa em `dev`: **531 testes verdes**, `tsc -b` + `vite build` OK.

Commits em `dev` (novos nesta rodada):
- `7f068f7` chore(scripts): execução paralela via git worktrees
- `5dd1e19` feat(deckbuilder): level curve stats and visual style position — **F1**
- `81acadc` feat(simulator): primitivas lookAtTopFilterReveal e deployFromHandTriggered — **F3**
- `41c5770` feat(simulator): st03 and st04 deck engine implementation — **F3**
- `d5d009a` feat(catalog): automated pt-br effect translation pipeline — **F2**
- `c15f597` docs: relatório de estado pos-v1 + checklist F2
- `5a5f273` feat(catalog): --apply normaliza effectPt + aplicado no banco — **F2**
- `60222ff` feat(simulator): fecha as 4 cláusulas de carta ST03/ST04 antes deferidas — **F3**
- `0965587` chore(simulator): remove import não usado

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

### Frente 2 — Tradução PT-BR (`dev`) — 5/5 ✅
- [x] Script `scripts/translate-card-effects.mjs` — tokenizer léxico, grounding docs/17, motor Gemini `gemini-3.6-flash`, validador de tokens, flags `--dry-run/--resume/--apply/--revalidate`. 17 testes.
- [x] Lote `data/translations-st01-04.json` — 64 cartas ST01–ST04: 52 com `effectPt`, 12 sem efeito (OK vazias), **0 rejeitadas** pelo validador.
- [x] **`--apply` no Postgres — FEITO (2026-09-05, via MCP Supabase, projeto `portal-gundam-tcg-br`).** `CardModel` 52 cartas, `Card` 52 códigos / 188 prints. `effectPt` normalizado pro formato do catálogo: `【X】`→`[X]` (com espaço), quebra→`<br>`; keywords `<X>`, nomes `[X]`, blocos `((X))` intactos (0/52 cartas ST01-04 usavam `【】` no `effectEn` do banco). As 12 sem efeito seguem `NULL`.
- [x] Exibição no simulador — `CardInspectorModal`/`Panel` ganharam o componente `CardEffectText` (PT por padrão, toggle PT/EN quando `effectPt` e `effectEn` chegam e diferem). 14 testes.
- [x] Commits `d5d009a` + `5a5f273`.
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
- **4 cláusulas antes deferidas — FECHADAS (2026-09-05, a partir do texto EN oficial):**
  1. ✅ **ST03-001 Sinanju** — gatilho "destrói carta de shield area em batalha → escolhe Unit inimiga, 2 de dano". `CombatTrigger` ganhou `on: "destroyEnemyShieldInBattle"` + `action: { kind: "damageChosenEnemyUnit" }`; disparado em `combat.ts/resolveDamageStep` quando o ataque direto ao jogador consome shield. **Decisão documentada:** sem sistema de escolha de alvo em combate, o motor auto-mira a 1ª Unit inimiga legal na Battle Area (determinístico/testável). `<High-Maneuver>` During Pair segue como keyword fixa — aproximação MANTIDA (`hasKeyword` sem `state` em ~9 call sites; não vale propagar por 1 carta).
  2. ✅ **ST03-014 The Blue Giant** 【Action】 — primitiva `preventUnitBattleDamage` + `CombatState.unitDamageProtection` (por Unit, condicionada ao AP EFETIVO do atacante; o atacante ainda recebe o dele). `THE_BLUE_GIANT_ACTION` em `content/st03.ts`.
  3. ✅ **ST04-011 Athrun Zala** 【When Linked】 — primitiva `grantAttackTargetRelax` + `CardInstance.attackTargetRelaxUntilTurn` (concessão temporária na Unit pareada, só no turno atual). `declareAttack` passou a considerar essa concessão além do `attackTargetRules` estático. Dispatch de `"When Linked"` ligado em `deploy.ts` (quando o pareamento forma Link Unit). Limpo em `CLEAR_TURN_MODIFIERS`.
  4. ✅ **ST04-015 Archangel** 【Activate･Main】 — primitiva `preventAttackThisTurn` + `CardInstance.cannotAttackUntilTurn`; `declareAttack` lança se `=== state.turnNumber`. Adicionada a `ARCHANGEL_ACTIVATE_MAIN.actions` depois do `setActive`. Limpo em `CLEAR_TURN_MODIFIERS`.

  Suíte: **497 verdes** em `src/modules/simulator` + `src/lib` (era 484; +13). `check:types` + `build` OK.

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
| Textos de efeito traduzidos ST01–04, exibidos no simulador e catálogo, keywords intactas | ✅ traduções ✅ + validador ✅ + inspetor do simulador ✅ + **banco aplicado** (`CardModel`/`Card`, catálogo já exibe pt-BR). Follow-up menor: toggle PT/EN no `SimulatorMatchPage` pende de ajuste de 1–2 linhas (passar `effectPt`/`effectEn` separados). |
| ST03/ST04 jogáveis ponta a ponta, `vitest src/modules/simulator` 100% | ✅ 531 verdes na suíte completa; partida ST03 vs ST04 inicia sem erro; 0 cláusula deferida |
| Tabuleiro adaptável a qualquer resolução, sem scroll, recursos empilhados, mira à esquerda | ✅ código (F4) + página de preview DEV-only (`/simulador/preview-layout`) pra validar em navegador sem logar. **Falta o Willen abrir e conferir.** |
| Motor WebSocket em produção, salas, reconexão, convite por link | 🟡 infra ✅ (F5); **não em produção, cliente do tabuleiro não migrado** (diferido) |
| Deckbuilder com curva de nível + cálculo na mão inicial | ✅ |

## 6. Critérios de Homologação para merge em `dev` (AI_GUIDE §7)

| Critério | Estado |
|---|---|
| `vitest src/modules/simulator` verde | ✅ em `dev` (531 na suíte completa); F4 (496) e F5 (488) verdes independentemente nas suas branches. **Falta a run combinada pós-merge das feature branches.** |
| `check:types` sem erro | ✅ em `dev`; ✅ nas branches independentemente |
| Validação manual em navegador — partida ST03 vs ST04 via convite WebSocket + conferência do `Feedback.pdf` | 🟡 página de preview de layout pronta (F4); partida real ST03 vs ST04 + WebSocket ainda dependem do Willen rodar |

---

## 7. Próximos passos

**Feito nesta rodada (2026-09-05):**
1. ✅ **F2 `--apply`** — traduções aplicadas via MCP Supabase (`CardModel` 52, `Card` 188 prints). Catálogo já exibe `effectPt`.
2. ✅ **Página de preview de layout** — `/simulador/preview-layout` (hash-router), DEV-only, sem auth, dados estáticos. Commit `8d3ced4` em `feature/simulator-layout`.
3. ✅ **F3 — 4 cláusulas antes deferidas** — fechadas 100% (ver §4 F3). Commit `60222ff` em `dev`, pushado.

**Aguardando decisão do Willen:**
- Push das branches `feature/simulator-layout` (8 commits) e `feature/simulator-websocket` (3 commits).
- Ordem de merge (`dev` já tem F1–F3; sincronizar `dev → feature/*` de novo antes de mergear de volta).
- Squash dos commits de F4/F5 no merge (foram 8 / 3, não 1).
- Migração do cliente do simulador (`SimulatorMatchPage.tsx`) de SSE → socket.io (F5) — `socketClient` pronto.
- Toggle PT/EN de `effectPt`/`effectEn` no `SimulatorMatchPage` (ajuste de 1–2 linhas).
- Infra real de MCP/RAG (opcional — hoje é grounding embutido, ver §3).
- Revisão visual da partida real ST03 vs ST04 + WebSocket em navegador.

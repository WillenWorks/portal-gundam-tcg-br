# Plano Detalhado: RAG, MCP, Bot do Simulador e Pipeline de Correção (Doc 44)

> **Fase**: Pós-v1.1 (evolução de plataforma)
> **Branch base**: `dev`
> **Documento de desenho** — nada codado ainda. Referências: docs/40 (RAG/MCP original), docs/41 (motor ST03/ST04), docs/43 (estado atual), `AI_GUIDE.md`.

---

## 1. Contexto e decisões tomadas com o Willen (2026-09-05)

Na rodada Pós-v1.0 a intenção de RAG/MCP dos planos foi cumprida como *grounding* embutido (contexto canônico no prompt + leitura dirigida de código), não como infra dedicada — ver `docs/43` §3. Esta fase constrói a infra de verdade e dois produtos em cima dela: um **bot de treino** e um **pipeline de report → correção**.

| # | Decisão | Escolha |
|---|---|---|
| 1 | Bot do simulador | Começar **heurístico** (TS puro), validar, **depois LLM como diferencial** ("modo comentado" / IA de verdade) |
| 2 | Pipeline de autofix | **Depois do MCP** — o MCP `sim` é pré-requisito do fuzzing que dá confiança pro autofix |
| 3 | Fix classificado como "rápido" | **Pode commitar em `dev`** (sempre via PR + teste de repro; sem exigir review humana no rápido) |
| 4 | Onde o MCP roda | **Já expõe HTTP** pro frontend chamar o bot — além do stdio pro Claude Code |
| 5 | Formalizar | Este documento |

---

## 2. Fundação que já existe (torna tudo viável)

| Peça | Localização | Habilita |
|---|---|---|
| Motor puro e determinístico (`GameState` → `applyEvents` → estado) | `src/modules/simulator/engine/` | replay exato, self-play, rollouts de busca |
| `GameState` 100% serializável (`Json` no Postgres) | `matchStore.ts`, `SimulatorMatch.state` (`prisma/schema.prisma:712`) | salvar/recarregar partida inteira, reproduzir bug |
| DSL revisável (`EffectSpec` / `PrimitiveCall`) + `ALL_EFFECT_SPECS` + `computeLegalTargets` | `content/`, `engine/effectSpec.ts` | bot só precisa "dado estado + ações legais, escolher uma" |
| Captura de report (parcial) | `reportSituation()` `matchStore.ts:428` + rota `POST /api/simulator/matches/:id/report` `server/index.ts:3352` | hoje só loga `{reportId, matchId, seat, note, state}` no servidor — falta **persistir** |
| Battle log derivado de eventos | `buildBattleLog()` / `describeEvent()` `ui/battleLog.ts` | narrativa legível do bug |
| Suíte TDD + `vitest run src/modules/simulator` | 531 testes | todo fix nasce de um teste que reproduz o bug |
| Cobertura de cartas ST01–ST04 (35 EffectSpecs, 0 deferidos) | `content/st0{1..4}.ts` | dataset `ST05–ST09` já em `data/gcg-official-cards.json` pra próxima leva |

---

## 3. Fase 1 — MCP server `mcp-gundam`

**Um servidor só** (`scripts/mcp-gundam/`), dois transportes:
- **stdio** — pro Claude Code (autoria de carta, self-play de teste, verificação).
- **HTTP** (`/mcp` no Express existente, atrás de `authRequired` + escopo) — pro frontend do produto chamar o bot e o `sim`.

Stack: `@modelcontextprotocol/sdk` (novo dep), reusa `express` 5 e o `prisma` client já configurados. O motor é importado direto de `src/modules/simulator/` (mesmo processo — sem cópia de lógica).

### 3.1 Grupo `catalog` (o `mcp-gundam-engine.mjs` que docs/40 §4 pediu)

| Tool | Retorno |
|---|---|
| `gundam_get_card(code)` | `CardModel` (Postgres) + `CardDef` (fixture) + `EffectSpec` (se houver) + status de cobertura |
| `gundam_search_glossary(term)` | trecho de `docs/17` + termos correlatos |
| `gundam_coverage(set?)` | tabela `carta / vanilla / EffectSpec / deferida / faltando` — hoje calculada à mão |
| `gundam_similar_specs(effectEn)` | as 3 `EffectSpec` mais próximas + o código (ver §6, RAG de autoria) |

### 3.2 Grupo `sim` (motor como ferramenta)

| Tool | Uso |
|---|---|
| `sim_new(deckA, deckB, seed)` → `matchId` | cria partida efêmera (in-memory, TTL curto — não usa `SimulatorMatch`) |
| `sim_view(matchId, seat)` | visão redigida (mesmo `matchViewFor`) |
| `sim_legal(matchId, seat)` | enumeração de ações legais (deploy/attack/block/activate/pass) — reusa `computeLegalTargets` + enumerador novo por fase |
| `sim_act(matchId, action)` | aplica ação, devolve novo estado + eventos |
| `sim_selfplay(deckA, deckB, games, policyA, policyB)` | roda N partidas bot-vs-bot, devolve `{crashes[], illegalStates[], avgTurns, winrateA, seedsQuebrados[]}` |
| `sim_verify_card(code, scenarios[])` | monta cenário, dispara efeito, checa asserts — acelera autoria sem ler 5 arquivos |

### 3.3 O enumerador de ações legais (peça nova, pré-requisito de tudo)

Hoje `computeLegalTargets` cobre alvo de efeito. Falta `enumerateLegalActions(state, seat)` → `LegalAction[]`:
- **main phase**: cada carta jogável da mão (`canPayLevel` + tipo), cada Unit active que pode atacar (`declareAttack` sem lançar), cada habilidade `Activate·Main` disponível, `passPhase`.
- **block step**: cada `<Blocker>` elegível, `skipBlock`.
- **pending decision**: as opções da decisão pendente (alvo, mulligan, reorder…).
Vive em `engine/legalActions.ts`, testado isoladamente. É a fundação do bot **e** do fuzzing **e** do futuro MCTS.

### 3.4 Entregas da Fase 1
- `scripts/mcp-gundam/` (server stdio + rota HTTP `/mcp`)
- `engine/legalActions.ts` + testes
- `sim_selfplay` com **policy `random-legal`** (escolhe uniforme entre `sim_legal`) → **fuzzing de regressão**: `pnpm gundam:fuzz` roda 500 partidas de cada par de decks validados e falha o CI se achar crash / estado ilegal
- `.mcp.json` no repo registrando o server pro Claude Code
- `docs/` de uso

---

## 4. Fase 2 — Bot heurístico + modo treino solo

### 4.1 Bot nível 1 — `engine/bot/heuristicPolicy.ts`

Função pura `chooseAction(view, legalActions, rng) → LegalAction`. Sem LLM, determinística dado o seed. Heurística inicial (iterável):

- **Recursos**: sempre compra recurso na Resource Phase.
- **Deploy**: joga a Unit de maior `AP+HP` que cabe no nível; prioriza formar Link (parear Pilot que satisfaz `link`); Base só se não tiver nenhuma.
- **Ataque**: ataca Unit inimiga rested se `AP_meu ≥ HP_efetivo_dela` e `AP_dela < HP_meu` (troca favorável); ataca o jogador/escudo se não há Unit boa pra trocar e sobra AP.
- **Bloqueio**: bloqueia com `<Blocker>` se o bloqueio salva uma Unit de valor maior que o bloqueador, ou protege a Base em perigo.
- **Efeitos**: usa efeito de remoção/bounce contra a maior ameaça; buff antes de atacar; `Activate·Main` quando o EV é claramente positivo (heurística simples de "vale o custo").
- **Alvo** (`ctx.targets`): sempre o "melhor" pelo mesmo critério de valor.

Testes: cenários fixos (`bot deve bloquear aqui`, `bot não deve atacar o jogador com a Base morrendo`), + `sim_selfplay` heurístico-vs-heurístico não trava e termina em < 40 turnos.

### 4.2 Modo treino solo no produto

- Rota `/simulador/treino` (autenticada): escolhe deck + dificuldade (`fácil` = heurística "burra", `normal` = heurística cheia). Sem fila, sem oponente humano.
- Server: `POST /api/simulator/training/new` cria uma `SimulatorMatch` com `seats.B = { bot: "heuristic", level }`. O tick do bot roda no servidor (mesmo `matchStore`, autoridade total) — quando é o turno do bot, `advanceBot(matchId)` aplica as ações via a policy.
- **Só decks validados** (ver §7.1) — o bot recusa carta sem cobertura.
- Reusa 100% da UI de partida (`SimulatorMatchPage`), inclusive o `socketClient` da F5 se já migrado.

### 4.3 Golden-master tests (entra junto)

`engine/__snapshots__/` — bot-vs-bot com seed fixo por par de decks, snapshot do `GameState` final (normalizado: sem timestamps). Qualquer mudança de motor que altere um resultado aparece no diff do PR e força justificativa. `pnpm gundam:golden`.

---

## 5. Fase 3 — Pipeline report → correção autônoma

### 5.1 Captura (completa o que já existe)

Novo model Prisma:

```prisma
model SimulatorBugReport {
  id            String   @id @default(cuid())
  shortCode     String   @unique          // "BUG-A1B2C3"
  matchId       String
  reporterId    String
  seat          String
  note          String?
  engineVersion String                    // git sha do motor no momento
  gameState     Json                      // GameState completo (repro)
  battleLog     Json                      // buildBattleLog(view) no momento
  lastAction    Json?                     // a ação que o jogador achou bugada
  cardsInvolved String[]                  // codes em jogo — pra triagem/RAG
  status        String   @default("new")  // new | triaging | reproducing | fixing | pr_open | needs_approval | fixed | wontfix | dev_deployed
  triage        Json?                     // { complexity, filesGuess, reproTestPath, planMd }
  prUrl         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([status])
  @@index([createdAt])
}
```

`reportSituation()` passa a **persistir** isso (hoje só `console.log`). A UI ganha um campo "o que aconteceu?" e mostra o `shortCode` pro jogador acompanhar.

### 5.2 Agente de triagem

Disparado por um cron / worker ao ver `status: "new"` (ou manualmente `pnpm gundam:triage BUG-XXXX`):

1. Carrega `gameState` num `createGame`-equivalente de hidratação (`hydrateMatch(json)` — precisa existir; hoje o servidor já reidrata de `SimulatorMatch.state`).
2. Reexecuta `lastAction`. Compara com o que o jogador esperou (do `note` + heurística).
3. **Escreve um teste que FALHA** reproduzindo: `src/modules/simulator/repro/BUG-XXXX.test.ts` — carrega o estado, aplica a ação, `expect` o comportamento correto. Se **não conseguir um teste estável** → `complexity: "complex"` automático (não adivinha).
4. Classifica:

| Classe | Critério | Ação |
|---|---|---|
| **RÁPIDO** | repro isolável **E** fix previsto só em `content/*.ts` / `fixtures/*.ts` / `content/predicates.ts` **E** motor (`engine/`) intacto **E** ≤ 3 arquivos | segue direto pro fix |
| **COMPLEXO** | toca `engine/**`, `server/**`, `matchStore` · OU repro não determinístico · OU muda outcome de golden-masters · OU o agente não tem confiança | posta plano + teste de repro, **para**, espera `/aprovar` do Willen |

**Regra dura: qualquer toque em `engine/` é COMPLEXO, sem exceção.**

### 5.3 Agente de correção

- TDD: o teste de repro é o Red. Implementa o fix. Green. Roda `vitest run src/modules/simulator` + `check:types` + `build` + golden-masters + `gundam:fuzz` reduzido (100 partidas). Tudo verde ou volta pra COMPLEXO.
- Commit semântico + **abre PR pra `dev`** (nunca `git push` direto): `fix(simulator): BUG-XXXX <resumo>`, corpo com link do report + o teste de repro.
- **RÁPIDO**: CI verde → merge automático em `dev`. Notifica o Willen (não bloqueia).
- **COMPLEXO**: PR fica aberto marcado `needs_approval`; Willen revisa e mergeia.

### 5.4 Gates de deploy

| Alvo | Gate |
|---|---|
| `dev` | automático (CI verde) — inclusive fixes RÁPIDOS |
| `main` / `production` | **sempre** autorização explícita do Willen (aprova o PR `dev → main` ou roda `/spartan:deploy`). Nenhum caminho autônomo pra prod. |

### 5.5 Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Fix errado entra em `dev` | teste de repro obrigatório + suíte 100% + golden-masters + é PR com histórico, revertível |
| "RÁPIDO" mal classificado | regra conservadora (engine = sempre complexo); em dúvida → complexo |
| Repro não determinístico | vira COMPLEXO automático, não tenta adivinhar |
| Fix quebra partida antiga | golden-master tests pegam e forçam revisão manual |
| Report malicioso / spam | rate-limit por usuário; `gameState` validado contra schema antes de hidratar; agente roda em sandbox de teste, nunca toca prod |
| Loop de fix (fix gera bug) | cada `BUG-XXXX` gera no máximo 1 tentativa autônoma; 2ª ocorrência do mesmo sintoma → COMPLEXO |

---

## 6. Fase 4 — RAG de autoria + registro de deferimentos + dashboard

### 6.1 RAG de autoria (leve, sem vetor externo)

Corpus pequeno (~algumas centenas de cartas). Índice local gerado por script:
- Pra cada `EffectSpec` de `content/*.ts`: extrai a "assinatura" — sequência de `op` dos `PrimitiveCall`, `trigger`, `targetScope`, `condition.predicate`, `targetFilter` — + o `sourceText`.
- `gundam_similar_specs(effectEn)` → tokeniza o texto EN, rankeia specs por sobreposição de tokens de mecânica ("look at top", "deal N damage", "return to hand", "deploy token"…) e devolve as 3 melhores + o trecho de código.
- Zero embeddings / zero serviço externo. Um `.json` versionado, regenerado por `pnpm gundam:index`.

### 6.2 Registro tipado de deferimentos

`src/modules/simulator/content/deferred.ts`:

```ts
export const DEFERRED_CLAUSES = [
  // exemplo do formato — a lista real fica vazia após a rodada de docs/43 §4
  // { cardCode: "GDxx-yyy", clause: "…texto EN…", reason: "…", blockedBy: "engine:…" },
] as const;
```

Teste `deferred.test.ts`: pra cada entrada, garante que o `EffectSpec` correspondente **não** cobre a cláusula (senão o item devia ter saído da lista) — impede "carta deferida silenciosamente marcada como pronta".

### 6.3 Dashboard de cobertura

`pnpm gundam:coverage` gera `docs/_generated/coverage.md` (tabela por set: implementada / vanilla / deferida / faltando) + expõe em `/admin` uma view. `gundam_coverage` do MCP usa a mesma fonte. Roda no CI — PR que adiciona carta sem cobertura nem entrada em `deferred.ts` falha.

---

## 7. Fase 5 (opcional) — bots avançados

### 7.1 Registro de decks validados

`src/modules/simulator/content/validatedDecks.ts` — decks liberados pro bot: passam `computeDeckLegality` **E** toda carta tem cobertura (EffectSpec, vanilla, ou o motor trata via keyword). O bot e o modo treino só aceitam esses. Hoje: ST01–ST04. Cresce conforme ST05+ entram.

### 7.2 Bot nível 2 — MCTS / rollouts

O motor é puro → `simulateToEnd(state, policyRollout)` roda partidas até o fim. MCTS raso (algumas centenas de rollouts com policy `random-legal` ou heurística) escolhe a jogada de melhor EV. Sem LLM. Dificuldade "difícil" no produto.

### 7.3 Bot nível 3 — LLM (o diferencial)

Agente lê `sim_view` + `sim_legal` via MCP e decide, com um prompt que explica o estado e pede raciocínio + jogada. Usos:
- **"IA comentada"** no produto — o bot explica por que jogou (feature de aprendizado, casa com o objetivo do `Feedback.pdf` de ensinar o jogo).
- **QA exploratório** — Claude joga 20 partidas variando estilo e reporta situações estranhas (alimenta o pipeline da Fase 3).
- Caro e lento → nunca é o caminho padrão de gameplay em tempo real; é modo premium / ferramenta de dev.

---

## 8. Boas práticas transversais

### 8.1 CI (`.github/workflows/ci.yml`)

| Evento | Checks |
|---|---|
| PR → `dev` | `pnpm check:types` · `pnpm test` · `pnpm build` · `gundam:coverage` (falha se carta sem cobertura/deferimento) · `gundam:golden` · `gundam:fuzz` (curto, 100 partidas/par) |
| PR → `main` | tudo acima + exige que todo `repro/BUG-*.test.ts` referenciado no PR passe + **review do Willen obrigatória** (branch protection) |
| push `dev` | deploy staging (Railway) automático |
| push `main` | deploy prod (AWS) — só via PR aprovado |

### 8.2 Runbook de orquestração multi-agente

Documentar o padrão que funcionou nesta rodada (`docs/45-runbook-orquestracao.md` ou seção no `AI_GUIDE`):
- `scripts/iniciar-paralelo.ps1` cria worktree por branch; cada frente = 1 subagente com escopo de arquivos restrito e explícito.
- Frentes na mesma branch (`dev`) → subagentes só se os arquivos são disjuntos; senão sequencial na thread principal.
- Merge `dev → feature/*` antes de cada frente começar; sync de novo antes do merge de volta.
- Subagente commita na própria branch (feature) ou devolve arquivos pra a thread principal commitar (mesma branch).
- Cada subagente: TDD, `corepack pnpm` (não `pnpm` puro), rodapé de commit padrão, sem push/merge.

### 8.3 Higiene de dados do catálogo

Auditar `effectEn` do Postgres — há inconsistências (gatilho `[X]` vs `【X】`, `<br>` vs `\n`, e ao menos 1 carta `GD01-090` com PT no campo `effectEn`). Um `pnpm gundam:audit-catalog` que lista divergências. Não bloqueia nada agora, mas some com a dívida antes de ST05+.

### 8.4 Versionamento do motor

Expor `ENGINE_VERSION` (git sha curto no build) no `GameState` e no `SimulatorBugReport` — um report de motor v-antigo pode já estar corrigido; a triagem checa isso primeiro.

---

## 9. Roadmap

```
Fase 1  MCP mcp-gundam (catalog + sim + HTTP) + legalActions + fuzzing + CI base
   │
Fase 2  Bot heurístico + modo treino solo + golden-master tests
   │
Fase 3  Pipeline report → autofix (captura persistida + triagem + gates)
   │
Fase 4  RAG de autoria + deferred.ts + dashboard de cobertura
   │
Fase 5  (opcional) Bot MCTS · Bot LLM "comentado" / QA
```

Cada fase entra em `dev` por conta própria, com testes. Fase 1 destrava o resto (o `sim` MCP + `legalActions` são base do bot, do fuzzing e do MCTS; o fuzzing dá a confiança pro autofix da Fase 3).

---

## 10. Decisões ainda em aberto

1. **Bug report é público ou só logado?** Convidado (guest da F5) pode reportar? (sugiro: sim, com rate-limit mais apertado)
2. **Onde roda o worker de triagem/fix?** GitHub Actions (por evento de webhook do report) · cron no servidor · Claude Code agendado (`/schedule`). Cada um tem trade-off de latência/custo/observabilidade.
3. **Bot no servidor: tick síncrono no `matchStore` ou job separado?** (síncrono é mais simples; job separado escala melhor se muitos treinos simultâneos)
4. **`@modelcontextprotocol/sdk` como dep** — ok adicionar? (é o caminho padrão; alternativa é implementar o protocolo à mão, não recomendo)
5. **Snapshot dos golden-masters no repo** — pode inflar o git. Alternativa: hash do estado final em vez do estado inteiro. (sugiro hash + um punhado de estados completos "canônicos")

# docs/23 — Simulador: jogo remoto entre 2 usuários — análise + hardening

**Sprint:** Jogo remoto (2ª das 3 frentes de 2026-09-04).
**Branch:** `feature/simulador-jogo-remoto`.
**Decisão do Willen:** endurecimento + **persistência** (Supabase JSONB), NÃO reescrita
para WebSocket (essa fica pra Fase 3, quando/se — ver docs/18 §Fase 3).

---

## 1. Análise estrutural — o que existe

### Topologia
```
Vercel (front estático, Vite)  ──HTTPS──►  Render (Node API, `tsx server/index.ts`, :8787)
        │  EventSource (SSE, ?token=jwt)              │
        └──────────────────────────────────────────► │  Prisma  ──►  Supabase (Postgres)
                                                     │  (o simulador NÃO usava o DB até agora)
```

### Caminho de uma ação
```
cliente: POST /api/simulator/matches/:id/actions  { kind: "declareAttack", ... }
  → server/index.ts (authRequired) 
  → matchStore.applyAction(id, userId, action)          ← ÚNICO ponto onde o motor roda
      → seatFor / guard gameOver
      → applyPlayerAction(state, seat, action, SPECS)    ← motor puro, server-autoritativo
      → match.state = next ; version++ ; lastSeenAt ; armTurnTimer
      → notify(match)  → pra cada listener SSE: send("state", viewStateFor(state, seat))
  → resposta HTTP: matchViewFor(match, seat)  (mesma coisa que o SSE vai mandar)
cliente A e cliente B: recebem o `state` novo pelo SSE (snapshot completo redigido)
```
Cliente **nunca** avalia regra. Não há estado otimista — a UI trava (`busy`) e espera.

### Infra que já existe e funciona
- Motor server-autoritativo (só roda em `applyAction`).
- Redação por jogador (`viewStateFor` — testado por serialização JSON, cartas ocultas nunca vazam).
- SSE fan-out: `state` = snapshot completo redigido, heartbeat de 20s, cleanup no `req.on("close")`.
- Matchmaking FIFO automático (`joinQueue`), idempotente, guard de auto-pareamento, reconecta em partida ativa.
- Timer de 90s **por decisão** (`decisionOwner` + `defaultActionFor`), auto-pass de Action Step vazio, auto-forfeit em 5min de AFK, W.O. manual em 3min, resign imediato.
- Presença (ping do cliente a cada 15s, só com aba visível) → `lastSeenAt`.
- GC oportunista de partida terminada (10min) e não-ocupada (15min).
- ~412 testes, incluindo 3 partidas E2E completas de motor.

---

## 2. Matriz de risco — 2 usuários remotos (antes desta sprint)

| Cenário | O que acontece hoje | Gravidade |
|---|---|---|
| Deploy no Render no meio da partida | **Partida some** (store em memória). Cliente fica com board congelado, "conectando". | 🔴 alto |
| Render free-plan idle (~15min sem tráfego) | Idem. Durante uma partida ativa (SSE + ping 15s = tráfego) não idle — risco só entre partidas ou em pausa longa. | 🟡 médio |
| Cliente perde wifi 30s e volta | `EventSource` nativo re-conecta sozinho e recebe snapshot fresco. Geralmente ok. Se a reconexão nativa falhar, board congela sem recovery. | 🟡 médio |
| JWT (7 dias) expira no meio | Browser re-tenta o SSE em silêncio pra sempre; board congela; nenhum aviso. | 🟡 médio |
| Clock do cliente 2min adiantado | Timer e "oponente inativo há Xs" ficam distorcidos (compara `turnDeadlineAt` epoch com `Date.now()` local, sem offset). | 🟡 médio |
| Os 2 jogam quase ao mesmo tempo | Server é autoritativo e serializa; mas a resposta do POST e um snapshot SSE mais antigo podem chegar fora de ordem no cliente → estado velho **sobrescreve** o novo (o `version` é mandado e **nunca comparado**). | 🟡 médio |
| 1 instância só / escala horizontal | `Map` + `setTimeout` em processo — SSE e ações poderiam cair em instâncias diferentes. Render roda 1 hoje. | 🟢 baixo (documentar) |
| Espectador | SSE rejeita quem não tem assento (403). Sem replay/observação. | 🟢 baixo (fora de escopo) |
| Token JWT na URL do SSE | Vai pro log de acesso do Render / histórico do browser. | 🟢 baixo (anotar) |

---

## 3. Plano de hardening

### C1 — Persistência (Supabase / Prisma)
- Modelo `SimulatorMatch` (`prisma/schema.prisma` + migration `10_simulator_match_persistence`):
  `id`, `state Json`, `seats Json`, `deckKeys Json`, `version Int`, `phase String`,
  `turnDeadlineAt BigInt?`, `lastSeenAt Json`, `gameOver Json?`, `finishedAt DateTime?`,
  `createdAt`, `updatedAt`. Índice em `updatedAt` e `finishedAt`.
- `matchStore.ts`: injeção de um `MatchPersistence` (`{ upsert, load, delete }`). `null` por
  padrão (testes) = no-op. `server/index.ts` injeta a impl Prisma no boot.
  - **write-through** (fire-and-forget, não bloqueia o motor): `applyAction`, `joinMatch`,
    `onTurnTimeout`, `claimAbandonWin`, `resignMatch` chamam `void persist(match)`.
  - **hydrate lazy**: `hydrateIfMissing(id)` async — se o `Map` não tem a partida, carrega do
    DB, recria o `MatchRecord`, **re-arma `armTurnTimer`** (deadline fresco de 90s). As
    rotas que podem pegar uma partida "fria" (`stream`, `matches/:id`, `actions`, `ping`,
    `resign`, `claim-abandon-win`) fazem `await hydrateIfMissing(id)` antes das funções sync.
  - `deleteMatch` / sweep também apagam a linha (`void persistence.delete(id)`).
- Fila de matchmaking (`queue`/`pendingMatches`): **não** persiste (efêmera).
- O `GameState` já é JSON puro; o `seed` (Sprint A) persiste junto → re-shuffle do mulligan
  continua determinístico depois de um restart.

### C2 — Reconexão robusta (cliente)
- `SimulatorMatchPage`: máquina de conexão `connecting | live | reconnecting | dead`.
  Ao `onerror`: `source.close()` → backoff (1s,2s,4s,8s, teto 15s) → `new EventSource` +
  `api.getSimulatorMatch(id)` de resync (fecha o buraco se o SSE nativo não voltar).
- 401 no resync → toast "Sessão expirada" + redirect pro login.
- `server/index.ts` stream: `res.write("retry: 3000\n\n")` no início.
- UI: banner discreto "Reconectando… (tentativa N)" quando `reconnecting`; "Conexão perdida"
  quando `dead`.

### C3 — Reconciliação de versão + relógio
- `matchViewFor` inclui `serverNow: Date.now()`.
- Cliente: `clockOffset = serverNow - Date.now()` na 1ª mensagem; usa `Date.now() + clockOffset`
  no countdown do timer e no cálculo de "oponente inativo".
- Cliente: no handler SSE e na resposta do POST, **ignora** `matchView` com
  `version <= atual` (fim do clobber por snapshot atrasado).

### C4 — Auditoria do motor vs Comprehensive Rules
Ver §4 abaixo (checklist).

### C5 — Testes
- `matchStore.test.ts` (+2): fake `MatchPersistence` → "cada ação persiste; limpar o
  Map + `loadMatch` re-hidrata o estado e re-arma o timer" · "sem persistência, `loadMatch`
  só olha o Map".
- `pendingDecision.test.ts` (+3): `resolveTriggerOrder` — ordem inválida rejeitada,
  oponente bloqueado, ordem válida limpa a pendência e dispara os efeitos (fecha o ⚠ da
  auditoria — o caminho não tinha teste porque nenhum card ST01/ST02 o dispara).
- Roteiro manual (2 máquinas) no §5.

---

## 6. Status de execução

| Item | Estado | Commit |
|---|---|---|
| C0 — análise estrutural + matriz de risco + auditoria | ✅ | este doc |
| C2 — reconexão robusta (backoff, resync, 401, banner) | ✅ | `62fa965` |
| C3 — reconciliação de versão + offset de relógio (`serverNow`) | ✅ | `62fa965` |
| C1 — persistência (Supabase/Prisma, write-through + hydrate lazy) | ✅ | (este commit) |
| C4 — auditoria: teste sintético de `resolveTriggerOrder` | ✅ | (este commit) |
| C4 — reconciliar EX Base HP com o PDF v1.8.0 | ⬜ backlog | — |
| C4 — `【Pilot】[X]` play-gate | ⬜ backlog | — |
| C4 — ponte deckbuilder → simulador | ⬜ backlog (Fase 2/3) | — |

`pnpm test` **417 ✓** · `check:types` ✓ · `lint:simulator` 0 erros · `build` ✓.

### Como aplicar em produção (Render)
1. `pnpm exec prisma migrate deploy` roda no `start` do servidor — a migration
   `10_simulator_match_persistence` cria a tabela `SimulatorMatch` no Supabase.
2. Nada de env novo. A persistência é transparente: se o `DATABASE_URL` responder,
   grava; se falhar, só loga um `console.warn` e a partida segue em memória.
3. Render free-plan segue derrubando o processo no idle/deploy — mas agora a
   próxima ação/reconexão **re-hidrata** a partida do banco.

---

## 4. Auditoria do motor vs Comprehensive Rules (v1.8.0 — reconciliar data)

| Área | Regra | Status | Evidência |
|---|---|---|---|
| Início (CR 6-2) | Sorteio de iniciativa antes de olhar a mão | ✅ | `joinQueue` `Math.random()`; revelado (Sprint A) |
| | Mão de 5, mulligan único sequencial (P1→P2) | ✅ | Sprint A · `engine/mulligan.test.ts` |
| | 6 shields, EX Base (0/3), EX Resource só pro 2º | ✅ | `finishGameSetup` · `setup.test.ts` |
| | 1º jogador COMPRA no turno 1 (≠ Magic) | ✅ | confirmado Willen 2026-09-04; tentativa de pular foi revertida |
| | EX Base = 3 HP | ⚠ | fonte de comunidade, não o PDF — **reconciliar** |
| Fases (CR 7) | Start re-ativa · Draw · Resource só ativo · End Action Step · limite de mão 10 | ✅ | `phases.ts` · `phases.test.ts` |
| Combate (CR 3-2) | 5 steps · Blocker/First Strike/High-Maneuver/Breach/Suppression · "recém-deployada não ataca" + exceção Link · Piloto segue Unit destruída · `attackTargetRules` | ✅ | `combat.ts` · `combat.test.ts` · `agente1Additions.test.ts` |
| Jogar carta (CR 3-1/3-3) | custo = rest N recursos · nível = `resourceArea.length` · cap 6 Units · pareamento obrigatório de Piloto | ✅ | `deploy.ts` · `deploy.test.ts` |
| | `【Pilot】[X]` como PRÉ-REQUISITO de jogar a carta | ❌ | fora de escopo até hoje (não é gatilho→ação) — backlog |
| Keywords (8 oficiais) | Blocker, First Strike, High-Maneuver, Breach, Suppression, Support, Repair, Once per Turn | ✅ | `combat.ts` / `keywords.ts` |
| Gatilhos simultâneos cross-card | `resolveTriggerOrder` | ⚠ | tipo pronto, nenhum card ST01/ST02 dispara → **caminho não testado** — adicionar teste sintético |
| Redação de info | deck/resourceDeck/shields + mão do oponente = `HiddenCard` | ✅ | `viewState.ts` · `viewState.test.ts` (serialização) |
| Deck-out (CR 1-2-2-2) | perde quem compra sem carta | ✅ | `phases.ts` · `phases.test.ts` |
| Dano sem shield (CR 1-2-2-1) | perde quem toma dano de batalha com 0 shields | ✅ | `combat.ts` · `st01VsSt02Match.test.ts` |
| Escopo de decks | só ST01 / ST02 (fixtures) | ⚠ | sem boosters, sem ponte do deckbuilder → backlog explícito |

**Itens de ação desta auditoria:**
1. ⚠ Reconciliar EX Base HP com o Comprehensive Rules PDF mais recente.
2. ⚠ Adicionar 1 teste sintético de `resolveTriggerOrder` (2 cards com gatilho no mesmo evento).
3. ❌ `【Pilot】[X]` play-gate → backlog (item de sprint próprio se um card assim entrar).
4. ⚠ Ponte deckbuilder → simulador → backlog (Fase 2/3).

---

## 5. Roteiro de verificação (2 máquinas reais, redes diferentes)

1. `pnpm dev:full` local OU deploy. 2 contas.
2. Fila → parear → mulligan → jogar uma partida ST01×ST02 inteira até `GAME_OVER`.
3. **Queda de conexão:** no meio do turno de A, B fecha a aba 40s e reabre `/simulador/partida/:id`
   → deve voltar no estado atual, sem perder o turno.
4. **Wifi:** A desliga o wifi 20s e religa → banner "Reconectando", depois volta sozinho.
5. **Deploy no meio:** `git push` → Render redeploy durante a partida → após o cold start,
   qualquer ação/reconexão **re-hidrata** a partida do banco e ela continua.
6. Anotar: latência observada (ação → aparecer no outro cliente), se o timer bate nos 2 lados.

# Plano de Correção — Layout lateral, artes corretas e resolução de efeitos

> **Branch:** `feature/simulador-pivot-visual-arena`
> **Origem:** Captura1.png (vão lateral no notebook) + Captura2.png (Tallgeese "Set active") + relato do Willen (2026-09-03).
> **Invariante:** só o SERVIDOR roda o motor (`server/matchStore.ts` → `src/modules/simulator/engine`). O cliente é UI pura + `deployIntent.ts` (heurística de alvo). Qualquer regra nova vai no motor compartilhado (sem fork cliente/servidor).

---

## 1. Diagnóstico

### 1.1 Vão grande entre as colunas laterais e o campo (Captura 1)
`ArenaPlaymat` — `OpponentTheater`/`SelfTheater` são `flex-1`, então o teatro central engole toda a largura livre e empurra `ShieldStation`/`DeckStation` pras bordas da tela. O `BattleRow` interno é `mx-auto` (centrado no teatro gigante) → sobra um vão enorme entre os 6 slots e as colunas laterais. **Não é overflow** — é o `flex-1` do teatro.
**Correção:** teatro deixa de ser `flex-1`; o grupo `[station][teatro][station]` é `justify-center` com gap pequeno.

### 1.2 Shields sem imagem do verso
`ShieldRail` (orientação vertical) desenha cada pip como `<span>` com borda + cor, **sem `<img>`**. Shields são cartas viradas pra baixo → devem mostrar `gundam-card-back.png`.

### 1.3 EX Base / EX Resource sem imagem · recursos "virados para cima" com a arte do verso (ERRADO)
O `useCardArtLookup` só busca `ST01`/`ST02`. Os códigos que o motor usa pra genéricos NÃO existem nesses sets:

| Código do motor (fixtures/engine) | Código real no catálogo | Set |
|---|---|---|
| `ST01-RESOURCE` / `ST02-RESOURCE` | `R-001` ("Resource") | GD01 / DBB-FA |
| `TOKEN-EX-BASE` | `EXB-001` ("EX Base") | GD01 |
| `TOKEN-EX-RESOURCE` | `EXR-001` ("EX Resource") | GD01 |
| `T-001` / `T-002` / `T-003` (White Base tokens) | `T-001..003` | GD01 ✓ (já bate) |
| `T-004` / `T-005` (Leo / Tallgeese) | `T-004..005` | GD01 ✓ (já bate) |

Como `artSrc` volta vazio, a mudança da rodada anterior fez cair no verso (`backFallback`). Resultado: recurso face-up com arte de verso (errado — recurso é carta **virada pra cima**, mostra a arte de recurso).

**Correção:** buscar o set `GD01` só pra resolver arte genérica + mapear os aliases acima. Com arte real resolvida, `backFallback` nunca dispara pra recurso/EX/token. O verso fica só pra: shields, deck, mão do oponente (cartas viradas pra baixo de verdade).

### 1.4 Ativar efeito de carta já em campo (Captura 2 — Tallgeese "④ Set this Unit as active")
O motor **já suporta**: `PlayerAction { kind: "activateAbility", sourceInstanceId, abilityIndex?, targets? }` → despacha o EffectSpec de trigger `Activate·Main` (`actions.ts:194`). `TALLGEESE_ACTIVATE_MAIN` existe (`content/st02.ts:38`, custo `④`, `setActive` em self).
**Falta:** botão na UI (BattleSlot / inspetor) pra disparar `activateAbility` nas Units/Pilots próprios, na Main Phase, sem combate. Custo `④` hoje é auto-escolhido pelo motor (`payResourceCostEvents` pega os N primeiros active) → mesmo risco do EX Resource ser gasto sem querer.
**Correção:** botão "Ativar" + `activateAbility` ganha `resourceInstanceIds?` (threading no dispatcher/`payResourceCost`), reusando a bandeja de seleção de recursos que o deploy já tem.

### 1.5 When Paired resolve junto com a escolha da Unit (deveria ser 2 tempos)
Hoje o cliente exige os 2 cliques (Unit pra parear + alvo inimigo) ANTES de mandar UM `deployCard`; o motor pareia e dispara `When Paired` na mesma ação (`deploy.ts:126-127`). Não há "momento de ativação" separado.
O Willen quer: **parear → resolver o vínculo → aí sim** o prompt do `When Paired` (com alvo), considerando **optativo** ("você pode") vs **mandatório** (resolve logo após o vínculo).
Também: **cada efeito é uma instância separada** — se um ataque dispara o efeito da Unit E do Piloto, os dois acontecem "ao mesmo tempo" mas **o jogador escolhe a ordem e se ativa cada um**. Não é cadeia, é **ordenação de eventos**.

**Estado do motor:** os tipos `PendingDecision` já têm `kind: "triggerOrder"` e `kind: "targetSelection"`, e `resolveTriggerOrder` está implementado (`actions.ts:249`). MAS `dispatchTrigger` nunca pausa — resolve tudo na hora com `opts.targets`. `EffectSpec` não tem campo `optional`. Nenhum efeito de ST01/ST02 é "you may" (todos mandatórios).

**Correção (feature de motor):** `dispatchTrigger` passa a poder PAUSAR:
- vários specs simultâneos do mesmo momento → `pendingDecision: triggerOrder` (jogador ordena + escolhe ativar cada um);
- spec que precisa de alvo e não recebeu → `pendingDecision: targetSelection`;
- `EffectSpec.optional` (novo, default `false`) → prompt "Ativar / Pular".
Novo `PlayerAction: resolvePendingAbility` (ordem + alvos + ativar/pular). `deploy.ts` para de passar `opts.targets` pro `When Paired` e deixa o dispatcher pausar.

---

## 2. Etapas (executar em ordem, validar + commitar cada)

| # | Escopo | Arquivos | Risco | Validação |
|---|---|---|---|---|
| **1** | Fecha o vão lateral | `ArenaPlaymat.tsx` (+teste) | baixo | `pnpm test && check:types` |
| **2** | Artes: verso nos shields; `R-001`/`EXB-001`/`EXR-001` via alias GD01; recurso face-up com arte de recurso | `SimulatorMatchPage` (`useCardArtLookup`), `cardArt.ts`, `ShieldRail`, `ResourceMeter`, `BaseCardGauge` (+testes) | baixo-médio | `pnpm test && check:types && lint:simulator` |
| **3** | Botão "Ativar" pra 【Activate·Main】 de carta em campo (Tallgeese etc.) + `resourceInstanceIds` em `activateAbility` | `engine/actions.ts` + `engine/dispatcher.ts` + `engine/effectSpec.ts` (threading de custo), `BattleSlot.tsx`, `SimulatorMatchPage.tsx` (+testes) | médio | `pnpm test` (motor + UI) `&& check:types && lint:simulator` |
| **4** | When Paired em 2 tempos + `optional` + ordenação de efeitos simultâneos | `engine/dispatcher.ts`, `engine/actions.ts`, `engine/types.ts`, `engine/deploy.ts`, `content/*` (marca `optional`), `deployIntent.ts`, `SimulatorMatchPage.tsx` + novo modal (+testes de motor e UI) | alto | suíte completa + e2e de motor (`st01VsSt02*`) |

Etapa 4 é a maior; se estourar o escopo de uma sessão, para no checkpoint verde e retoma.

---

## 3. Notificação de alterações entre ambientes

- **Cliente e servidor importam o MESMO** `src/modules/simulator/engine/*` — mudança de motor vale automaticamente pros dois. Não há build separado do motor.
- O único código de regra que vive só no cliente é `src/modules/simulator/ui/deployIntent.ts` (heurística "este pareamento precisa de alvo?"). A Etapa 4 move essa decisão pro motor (o dispatcher pausa sozinho) e o `deployIntent.ts` fica só com o aviso de UI — some o risco de divergência.
- Nenhuma mudança em `server/matchStore.ts`, `viewState.ts` (serialização) nas Etapas 1–3. Etapa 4 adiciona 1 `kind` de `PendingDecision` e 1 `PlayerAction` — ambos já viajam pelo `ViewGameState`/`SimulatorMatchView` existentes (o `pendingDecision` já é serializado).

---

## 4. Status

| Etapa | Estado | Commit |
|---|---|---|
| 1 — vão lateral | ✅ | `2eb...` (ArenaPlaymat: teatro `shrink-0` + `justify-center`) |
| 2 — artes | ✅ | verso p/ shields/deck/mão do oponente; alias GD01 (R-001/EXB-001/EXR-001); recurso face-up = arte real |
| 3 — ativar efeito em campo | ✅ | `activateAbility` + `resourceInstanceIds` (motor); botão "Ativar" no BattleSlot; `ui/abilityIntent.ts` |
| 4 — When Paired 2 tempos + ordenação | ✅ | `PendingDecision.whenPaired` + `PlayerAction.resolveWhenPaired` (motor); `deploy.ts` pausa; `WhenPairedModal` |

### Follow-ups conhecidos (fora do escopo desta rodada)
- **Deploy direcionado (não-pareamento)** — `deployCard` ainda resolve o 【Deploy】 direcionado (GUNTANK) na hora com o alvo mandado pelo cliente. Não há card assim jogável hoje no fluxo (o cliente não pede clique de alvo pra Deploy). Migrar pro mesmo `PendingDecision` quando entrar um card que precise.
- **Gatilhos de combate (Unit + Pilot num ataque)** — `ZECHS_MERQUISE` combat trigger ("During Link ... draw 1") resolve automático em `combat.ts`. A ordenação/opt-in por efeito (mesma ideia do `whenPaired`) fica pra quando houver 2 combat triggers simultâneos de cartas diferentes.
- **`EffectSpec.optional`** — campo criado, default `false`. Nenhum efeito de ST01/ST02 é "you may"; marcar quando entrar um.
- **Legalidade de alvo por predicado** — "enemy Unit with 5 or less HP" hoje não é validada pelo motor (confia no cliente, como sempre foi). O `WhenPairedModal` oferece todas as Units inimigas.

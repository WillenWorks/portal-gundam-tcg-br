# 25 — Sprint V&V rumo ao v1.0 — V0: legalidade de alvo genérica

**Branch:** `dev` (a pedido do Willen — 2026-09-04)
**Gatilho:** ao investigar o fix do Guntank (docs/24), o Willen apontou o
problema de fundo com um exemplo concreto (Suletta Mercury): nenhuma carta
tem sua restrição de alvo validada pelo motor além da categoria ampla
(inimigo/aliado/recurso) — e o único caso hoje era resolvido com um filtro
**hardcoded na página do cliente**, só pra aquela carta. Pediu uma sprint de
Verificação e Validação (V&V) pro simulador rumo ao v1.0, começando por essa
correção estrutural. Plano completo aprovado em modo de planejamento — ver
`.claude/plans` da sessão. Este doc cobre a **V0** (fundação); V1-V5 seguem
em passos seguintes.

---

## 1. Auditoria (2 exploradores em paralelo, motor + layout)

Confirmado, com `file:line` exato: **31 EffectSpec** em ST01+ST02.
- **5 cartas** têm restrição de alvo NUMÉRICA/de estado no `sourceText` que
  nunca foi validada em código algum: Guntank (HP≤2, Deploy), Aerial Score
  Six (Lv≤5, When Paired), Amuro Ray (HP≤5, When Paired), Siege Ploy (HP≤5,
  Main/Action/Burst), Thoroughly Damaged (rested, Main).
- **Suletta Mercury** (Attack, "Set 1 Resource as active") tinha o único
  filtro real do jogo — `.filter(r => r.rested)` — **hardcoded na página**
  (`SimulatorMatchPage.tsx`), nunca no `EffectSpec`.
- **2 bugs de `targetScope` real** (não é só filtro faltando — é escopo
  ERRADO): Kai's Resolve (ST01-013) e Simultaneous Fire (ST02-012) dizem
  "sua Unit"/"of your Units" no texto, mas caíam no default `enemyUnit` —
  deixavam escolher Unit **inimiga** num efeito que é pra ser na própria.
- **1 gatilho "invisível"**: Saint Gabriel Institute (ST02-015-Deploy,
  "look at the top 2... return 1 to top and 1 to bottom") usa alvos nomeados
  `toTop`/`toBottom`, não `"target"` — o detector `specNeedsNamedTarget` só
  reconhece o nome literal `"target"`, então esse gatilho NUNCA dispara a
  decisão (o reorder nunca é perguntado). Registrado como **backlog**
  (formato de decisão diferente — peek 2 → reordenar, não "escolher 1
  alvo" — não cabe no mesmo mecanismo sem risco de generalização errada).
- **2 famílias de dispatch de alvo**, achado importante pro desenho:
  `deferOrDispatchAbilities` (Deploy/When Paired/Attack, PAUSA e pergunta) e
  `dispatchTrigger` direto (Command Main/Action/Burst/Activate·Main, SEM
  pausa — cliente já manda o alvo escolhido na mesma ação). Qualquer
  mecanismo genérico precisa cobrir as duas.
- **`resolveAbility` confiava cegamente** no `targetIds` que o cliente
  mandava de volta — zero checagem de que era um alvo realmente legal.
  Mesma falta nos 2 dispatches diretos.
- `PendingDecision.targetSelection` (com `validTargetIds: string[]`) estava
  **morto** — zero uso no repo além da própria definição de tipo. Reaproveitado
  (não descartado) como o campo novo `legalTargets` do `abilityResolution`.
- Pools de candidato são sempre pequenos (≤6 Units, ≤~15 Recursos) — custo
  bruto irrelevante; o cuidado real é computar **uma vez por decisão**, nunca
  dentro de um loop de render (achado: `handPlayability`/`describeHandCard`
  já rodam ~3x por render sem memoização — não piorado, só reaproveitado).

## 2. Mecanismo (fundação, não gambiarra por carta)

- **`EffectSpec.targetFilter?: string`** (`engine/effectSpec.ts`) — mesmo
  padrão do `condition.predicate` já em uso (id-string + resolver
  registrado), só que avaliado **por candidato**, não pelo efeito inteiro.
- **`TargetFilterResolver`** + **`defaultTargetFilterResolver`**
  (`content/predicates.ts`, mesmo arquivo do `defaultPredicateResolver` —
  "única fonte, reusada por testes e servidor"). 3 famílias hoje:
  `hp<=N`, `level<=N`, `rested`. Nova carta com restrição nova = 1 `case`
  novo aqui, nunca um hack na UI.
- **`computeLegalTargets(state, spec, controller, resolveFilter?)`**
  (`engine/effectSpec.ts`) — única fonte de verdade: enumera o pool de
  `targetScope` e aplica `targetFilter`. Lança se o spec declara filtro mas
  ninguém passou o resolver (mesma postura de `resolveEffectSpec` pra
  `condition` — falhar alto, nunca aplicar em silêncio).
- **Caminho PAUSADO** (`deferOrDispatchAbilities`): `queue[i].legalTargets`
  calculado no servidor ao montar a fila. `resolveAbility` valida que o que
  o cliente manda de volta é subconjunto disso — fecha o gap de confiança.
- **Caminho DIRETO** (`playCommand`, `activateAbility`,
  `resolveBurstDecision` — novo helper `filterDispatchableSpecs`): filtra
  os specs ANTES de despachar. Alvo legal existe mas não foi escolhido/foi
  escolhido errado → lança. Nenhum alvo legal agora → o spec sai do lote
  (efeito não ativa), **sem lançar** — a carta/ação em si nunca é bloqueada
  pelo próprio efeito de alvo (confirmado contra a ruling oficial já
  importada: "the effect simply doesn't activate at all").
- **Cliente**: `AbilityResolutionModal` lê `q.legalTargets` direto (só
  resolve o RÓTULO via `resolveLabel`, nunca decide quem é legal) — tira o
  hack do Suletta. `handPlayability.blockedByMissingTarget` idem —
  `PlayabilityContext` trocou a contagem bruta `targetCounts` por
  `state`+`controller`, chamando a MESMA `computeLegalTargets`.

## 3. Correções de conteúdo (junto com a fundação)

`content/st01.ts` / `content/st02.ts`:
- `targetFilter` adicionado: `GUNTANK_DEPLOY` (hp<=2), `AERIAL_SCORE_SIX_WHEN_PAIRED`
  (level<=5), `AMURO_RAY_WHEN_PAIRED` (hp<=5), `THOROUGHLY_DAMAGED_MAIN`
  (rested), `SIEGE_PLOY_BURST`/`MAIN`/`ACTION` (hp<=5), `SULETTA_MERCURY_ATTACK`
  (rested — tira o hack do cliente).
- `targetScope: "friendlyUnit"` corrigido em `KAIS_RESOLVE_MAIN` e
  `SIMULTANEOUS_FIRE_MAIN` (bug real de gameplay, não só filtro faltando).

## 4. Testes

+9 testes novos (`abilityDispatch`/`effectSpec` via `deploy.test.ts`,
`handPlayability.test.ts` com estado real ao invés de contagem mockada,
`AbilityResolutionModal.test.tsx` com `legalTargets` pronto). Todos os
call-sites de teste que exercitam as 5 cartas com filtro novo passaram a
threadar `defaultTargetFilterResolver` (mesma convenção já existente pro
`predicateResolver`).

`pnpm test` 426/426 ✓ · `check:types` ✓ · `lint:simulator` ✓ · `build` ✓.

## 5. Backlog explícito (não é V0, registrado pra não esquecer)

1. **Saint Gabriel Institute (ST02-015-Deploy)** — reorder de deck nunca é
   perguntado (formato de decisão diferente de "escolher 1 alvo").
2. **`resolveTriggerOrder`** (gatilhos simultâneos de cards DIFERENTES) não
   passa pela filtragem de alvo — nenhum EffectSpec de ST01/ST02 dispara 2
   triggers de cartas diferentes no mesmo evento hoje, então nunca é
   exercitado na prática; documentado no código como próximo passo se uma
   carta futura precisar.
3. **V1-V5** do plano da sprint (auditoria carta a carta, mecânicas centrais
   contra o Comprehensive Rules oficial, casos de uso do jogador, processo
   de carta nova, ajuste visual leve) — próximos passos, reportados um a um.

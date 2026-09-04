# 28 — Sprint V&V rumo ao v1.0 — V3: integridade server-authoritative

**Branch:** `dev` — 2026-09-04. Continuação de [docs/25](25-simulador-vv-sprint-v0-legalidade-de-alvo.md)/[docs/26](26-simulador-vv-sprint-v1-auditoria-carta-a-carta.md)/[docs/27](27-simulador-vv-sprint-v2-mecanicas-centrais.md).

## Método

Auditoria de **toda** `PlayerAction` — não só alvo (isso já foi o V0) — nas 3
dimensões que o plano definiu: **ownership** (a carta/decisão é mesmo de
quem age?), **fase/turno** (a ação é legal AGORA?) e **pagamento de custo**
(o custo é validado de verdade, não só assumido?). Usando `activateSupport`
(`keywords.ts:16`) como referência do "bom padrão" já existente no próprio
código — checagem completa de fase, combate, dono, zona, rested, keyword,
alvo, `oncePerTurn`, tudo antes de qualquer evento.

Cada `case` de `applyPlayerAction` (`actions.ts`) e a função de motor que ele
chama foram lidos e comparados contra esse padrão: `deployCard`/`playCommand`
(`deploy.ts`), `declareAttack`/`activateBlocker`/`skipBlock`/`passAction`
(`combat.ts`), `passEndPhaseAction`/`beginEndPhaseActionStep` (`phases.ts`),
`activateAbility`/`resolveBurstDecision`/`resolveTriggerOrder`/
`resolveAbility`/`resolveMulligan`/`resolveZoneOverflow` (`actions.ts`).

## Achado real — custo de recurso aceitava MAIS ids do que o necessário

`payResourceCostEvents` (`costs.ts`) — compartilhada por `deployCard`,
`playCommand` E a primitiva `payResourceCost` (Tallgeese "④", White Base
"②") — validava só `payWith.length < n` (recursos DE MENOS). Um
`resourceInstanceIds` explícito com **mais** ids do que o custo passava
calado e o motor restava/exilava TODOS os recursos enviados, não só os N
necessários — o custo virava "N ou mais", nunca validado como "exatamente
N". Duplicatas no mesmo array também não eram rejeitadas.

Não é um bug alcançável pela UI hoje (o cliente sempre manda a quantidade
certa, com `resourcesReady` gating o Confirmar) — mas é exatamente o tipo de
confiança implícita no cliente que o V0 já tinha fechado do lado de alvo
(`resolveAbility` validando `legalTargets`) e ficou faltando do lado de
custo. Fechado com o mesmo princípio: **servidor nunca confia, mesmo que o
cliente hoje sempre mande certo.**

**Correção**: `payResourceCostEvents` agora rejeita `payWith.length > n`
("Custo de N recurso(s) precisa de exatamente N id(s)") e ids repetidos no
mesmo array. Por ser a única função de pagamento de custo do motor inteiro
(nenhum outro caminho paga recurso), a correção cobre `deployCard`,
`playCommand` E qualquer `EffectSpec` com `payResourceCost` de uma vez.

## Resto da superfície — sem achado, já sólida

- **`deployCard`/`playCommand`**: fase (`main`, sem combate em andamento pra
  `deployCard`/Command 【Main】; Action Step certo pra Command 【Action】),
  jogador ativo/prioridade, dono da carta, zona (`hand`), tipo de carta
  compatível com a função, nível (`resourceArea.length >= level`, requisito
  PRÉVIO e separado do custo) — tudo checado antes de qualquer evento.
- **`declareAttack`**: dono, zona (`battleArea`), não-rested, fase, sem
  combate já em andamento, regra de "não pode atacar no turno em que entrou
  em campo" (exceto Link Unit), `attackTargetRules` (Zowort/Wing Gundam).
- **`activateBlocker`/`skipBlock`/`passAction`**: `combat.defendingPlayer`/
  `combat.actionPriority` checados — `actions.ts` valida `actingPlayer`
  ANTES de chamar, as funções do motor validam de novo internamente
  (`activateBlocker`/`passAction`) ou dependem só do wrapper (`skipBlock`,
  única função sem `player` como parâmetro próprio — hoje seguro porque
  `applyPlayerAction` é o único caller e já valida, registrado aqui só como
  nota de estilo, não como achado — não haveria como um 2º caminho chamar
  `skipBlock` sem passar por esse wrapper hoje).
- **`passEndPhaseAction`**: `endPhaseAction.priority` checado.
- **`activateAbility`**: dono, fase (`main`, sem combate) OU prioridade do
  Action Step de combate; `filterDispatchableSpecs` (V0) valida alvo;
  `<Support>` como fallback usa `activateSupport` (o próprio padrão de
  referência).
- **`resolveBurstDecision`/`resolveTriggerOrder`/`resolveAbility`/
  `resolveMulligan`/`resolveZoneOverflow`**: todas gated por
  `state.pendingDecision[actingPlayer]` — só quem TEM a decisão pendente
  consegue resolvê-la (chave é o próprio `PlayerId`, sem forma de um
  jogador resolver a decisão do outro). `resolveAbility`/`resolveZoneOverflow`
  (V0/V2) validam alvo/instanceId contra `legalTargets` calculado no
  servidor.

## Verificação

`pnpm test` **432/432** (+2 testes novos em `deploy.test.ts` — custo
recusa excesso de ids e recusa id repetido). `check:types` ✓,
`lint:simulator` ✓, `pnpm build` ✓.

## Próximo passo

V4 — checklist curto + `EffectSpec` de exemplo comentado documentando como
adicionar uma carta nova sem tocar `abilityDispatch.ts`/`dispatcher.ts`/UI
(inclui os 2 gaps já registrados que viram itens do checklist: `keywordValue`
não soma múltiplas fontes de `<Repair N>`, e `resolveTriggerOrder` nunca foi
exercitado com alvo nomeado).

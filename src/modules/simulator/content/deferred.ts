/**
 * Registro tipado de CLÁUSULAS DEFERIDAS (docs/44 §6.2, docs/48).
 *
 * Cada entrada marca um trecho do texto oficial EN de uma carta que o motor
 * ainda NÃO cobre — de propósito, não por esquecimento. Serve de checkpoint
 * honesto de cobertura: impede que uma carta com cláusula deferida seja
 * marcada como "pronta" só porque tem um EffectSpec parcial (o `catalog:coverage`
 * mostra `implementada*` = tem cobertura mas com deferimento).
 *
 * `deferred.test.ts` valida cada entrada; `scripts/gundam-coverage.mjs` consome.
 *
 * Populado na Lane 1B (revalidação carta a carta de ST01–ST04, docs/47 §4.1B).
 * Toda entrada nasceu de um teste de repro rodado contra o caminho real do
 * motor (`applyPlayerAction` / `deployCard` / `dispatchTrigger`), não de leitura
 * de código — ver o relatório da lane.
 */
export interface DeferredClause {
  /** código da carta (ex. "ST03-001"), ou "*" para um gap de motor transversal (sem carta específica). */
  cardCode: string;
  /** trecho literal do texto EN oficial da carta (deve ser substring do `effect` em data/gcg-official-cards.json). Livre quando `cardCode === "*"`. */
  clause: string;
  /** o que o motor faz hoje em vez do texto. */
  reason: string;
  /** identificador curto do bloqueio, prefixo `engine:` — o que teria de mudar no motor pra fechar. */
  blockedBy: string;
}

export const DEFERRED_CLAUSES: readonly DeferredClause[] = [
  // Classe A — escolha nomeada sem camada de decisão — FECHADA (docs/47 Lane 1D):
  // `discardNamed` (ST04-002), `moveWithinDeck` nomeado (ST02-015) e a nova
  // primitiva `spawnTokenChoice` (ST04-012) entraram em `ChoicePrimitive` /
  // `specNeedsChoice`; `abilityDispatch.ts` monta `handDiscard` / `deckReorder` /
  // `enumChoice` na fila e `resolveAbility` valida + injeta em `ctx.targets`.
  // `playCommand` passou a PAUSAR quando o spec tem escolha (Command vai pro
  // trash em `resolveAbility`, CR 3-4-4). Sub-caso (ST02-015 via Burst) fechado
  // na revalidação (docs/47 Fase 4, ver Classe B abaixo).

  // Classe B — 【Burst】Deploy this card não dispara o 【Deploy】 da Base — FECHADA
  // (docs/47 Lane 1D): primitiva `deployThisCard` (aplica a regra de 1 Base) +
  // `dispatcher.ts` encadeia o 【Deploy】 logo após. Sub-caso fechado na
  // revalidação (docs/47 Fase 4): o encadeamento agora usa
  // `deferOrDispatchAbilities` (mesmo helper de `deployCard`/`playCommand`) em
  // vez de auto-mirar 1 alvo e chamar `dispatchTrigger` direto — Saint Gabriel
  // (ST02-015, reordenação de deck) e Rewloola (ST03-015, escolha real de alvo
  // de dano) agora PAUSAM via Burst igual a uma jogada normal, em vez de
  // pular a cláusula ou auto-mirar. Achado: mesmo sem nenhum alvo legal, o
  // spec ainda entra na fila (`legalTargets: []`) — não é um dead-end,
  // `resolveAbility` já aceitava `targetIds: []` pra esse caso (actions.ts).

  // ─────────────────────────────────────────────────────────────────────────
  // Classe C — ST03-001 Sinanju: aproximações aceitas (docs/43 §4).
  // 【During Pair】"gains <High-Maneuver>" fechada na revalidação (docs/47): já
  // era StaticAbility condicional viável (`hasKeyword`/`keywordValue` recebem
  // `state` em todos os call sites reais) — fixture atualizada em st03Deck.ts.
  // "choose 1 enemy Unit. Deal 2 damage to it." fechada (docs/47 Fase 6):
  // `damageChosenEnemyUnit` deixou de auto-mirar — `combat.pendingTriggerChoices`
  // (populado em `combatTriggerEvents`/`resolveDamageStep`) vira
  // `PendingDecision.abilityResolution` de verdade em `actions.ts`
  // (`finishDamageStep`/`pauseForCombatTriggerChoices`), DEPOIS de Burst e
  // Destroyed resolverem (mesma ordem FIFO já usada pros outros 2).
  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // Classe D — gap de motor transversal (não amarrado a 1 carta). FECHADA
  // (docs/47 Fase 2): `pairedPilotFollowEvents` movida de `combat.ts` (local,
  // não-exportada) pra `types.ts` (exportada) e chamada também por
  // `compilePrimitive` (`destroy`/`damageUnit` letal em effectSpec.ts) e por
  // `deployCard` (sacrifício de Link Unit em GD01-002, deploy.ts). Achado
  // ADICIONAL ao fechar: os 2 kinds de `CombatTrigger.action` que matam uma
  // Unit (`damageAllEnemyUnits`/`damageChosenEnemyUnit`, combat.ts) também não
  // chamavam `pairedPilotFollowEvents` — mesma causa raiz, mesmo fix, corrigido
  // junto (Sinanju/Heavyarms já produziam esse caso e nunca tinham teste
  // cobrindo alvo pareado).
  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // Classe E — Wave GD01: Mecânicas avançadas, bounce, auras e custos dinâmicos (Fase 2 Claude).
  // GD01-001 "All your (White Base Team) Units gain <Repair 1>" fechada na
  // revalidação (docs/47): `StaticAbility` já suportava `scope:"allFriendlyUnits"`
  // + `targetCondition:{kind:"traitIs"}` + concessão de keyword — não precisava
  // de nenhuma primitiva nova, só apontar a aura pra esse formato em unitsBlue.ts.
  // GD01-066 "…It may attack on the turn it is deployed." fechada (docs/47 Fase 3):
  // `condition.predicate: "selfIsPaired"` (já existente, mesmo padrão de
  // GD01-073/082 — tempo real, não precisa do `duringPair`/`wasPaired` de
  // Destroyed) + keyword sintética `AttackOnDeployTurn` via `grantKeyword`
  // (endOfTurn), aceita em `combat.ts`/`declareAttack` como equivalente a Link
  // Unit. Filtro `isToken` novo em `predicates.ts`. Nenhuma "nova primitiva de
  // motor genuína" foi necessária, ao contrário do que a entrada antiga dizia.
  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // Classe F — Wave ST05: retrieve de trash via combate.
  // ST05-011 Akihiro Altland 【During Link】"...choose 1 (Tekkadan) Unit card
  // that is Lv.2 or lower from your trash. Add it to your hand." FECHADA
  // (docs/47 Fase 6): `CombatTrigger.action` ganhou o kind `retrieveFromTrash`
  // (mesmo `CardDefFilter`/`matchesCardDefFilter` já usados por
  // `searchTrashToHand`), resolvido via `combat.pendingTriggerChoices` +
  // `PendingDecision.abilityResolution` (mesmo mecanismo do Sinanju acima,
  // reusando o widget `trashSearch` já existente na UI).
  // ─────────────────────────────────────────────────────────────────────────
  // ST05-010 Mikazuki Augus 【When Paired】"Choose 1 of your Units and 1 enemy
  // Unit. Deal 1 damage to them." FECHADA (docs/47 Fase 5): `AbilityQueueEntry`
  // ganhou `secondaryTarget` (irmão de `legalTargets`), `resolveAbility` ganhou
  // `resolution.secondaryTargetIds`, `legalActions.ts` enumera o produto de
  // pool primário × secundário — mesmo `EffectSpec.secondaryTarget` já usado
  // por Command (GD01-103/112), agora também no caminho de fila.
] as const;

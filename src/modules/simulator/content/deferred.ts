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
  // trash em `resolveAbility`, CR 3-4-4). Sub-caso ainda deferido:
  {
    cardCode: "ST02-015",
    clause: "look at the top 2 cards of your deck and return 1 to the top and 1 to the bottom",
    reason:
      "Só quando o 【Deploy】 vem por JOGADA NORMAL (deployCard → camada de decisão). Via 【Burst】 (Burst→Base Deploy encadeado no dispatcher, Classe B) o 'Add 1 Shield' roda mas a reordenação não — o caminho encadeado não passa por `deferOrDispatchAbilities`. Auto-decidir a ordem mid-combat seria pior que pular (deck fica como está).",
    blockedBy: "engine:burst-deploy-nao-tem-camada-de-decisao",
  },

  // Classe B — 【Burst】Deploy this card não dispara o 【Deploy】 da Base — FECHADA
  // (docs/47 Lane 1D): primitiva `deployThisCard` (aplica a regra de 1 Base) +
  // `dispatcher.ts` encadeia o 【Deploy】 logo após. Rewloola (【Deploy】 com alvo
  // de dano) auto-mira mid-combat, igual Sinanju (ver Classe C). Saint Gabriel:
  // o "Add 1 Shield" dispara; a reordenação do topo do deck via Burst continua
  // pulada (o caminho encadeado não passa pela camada de decisão — só o 【Deploy】
  // por jogada normal reordena; ver Classe A ST02-015).

  // ─────────────────────────────────────────────────────────────────────────
  // Classe C — ST03-001 Sinanju: aproximações aceitas (docs/43 §4).
  // 【During Pair】"gains <High-Maneuver>" fechada na revalidação (docs/47): já
  // era StaticAbility condicional viável (`hasKeyword`/`keywordValue` recebem
  // `state` em todos os call sites reais) — fixture atualizada em st03Deck.ts.
  // ─────────────────────────────────────────────────────────────────────────
  {
    cardCode: "ST03-001",
    clause: "when this Unit destroys an enemy shield area card with battle damage, choose 1 enemy Unit. Deal 2 damage to it.",
    reason:
      "O `combatTrigger` `destroyEnemyShieldInBattle` AUTO-mira a 1ª Unit inimiga legal na Battle Area — não há sistema de escolha de alvo durante o combate. Determinístico e testável, mas não é a escolha do jogador.",
    blockedBy: "engine:sem-escolha-de-alvo-em-combate",
  },

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
  // ─────────────────────────────────────────────────────────────────────────
  {
    cardCode: "GD01-066",
    clause: "【During Pair】【Attack】Choose 1 of your (Triple Ship Alliance) Unit tokens. It may attack on the turn it is deployed.",
    reason:
      "A 1ª cláusula (【Deploy】Deploy 1 [Fatum-00] token) já foi resolvida (`JUSTICE_GUNDAM_DEPLOY`, `TOKEN_FATUM_00`). Esta 2ª cláusula concede exceção de \"pode atacar no turno em que foi deployada\" a um token ESCOLHIDO, fora da regra nativa de Link Unit (`enteredZoneOnTurn`/combat.ts) — não existe primitiva pra isso.",
    blockedBy: "engine:atacar-no-turno-do-deploy-fora-de-link",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Classe F — Wave ST05: retrieve de trash via combate.
  // ─────────────────────────────────────────────────────────────────────────
  {
    cardCode: "ST05-011",
    clause:
      "【During Link】During your turn, when this Unit destroys an enemy Unit with battle damage, choose 1 (Tekkadan) Unit card that is Lv.2 or lower from your trash. Add it to your hand.",
    reason:
      "`CombatTrigger.action` só cobre `draw` / `damageAllEnemyUnits` / `damageChosenEnemyUnit` — não há kind pra buscar carta do trash com filtro (trait + level) e devolver pra mão. A 1ª cláusula da carta (【Burst】Add this card to your hand) está implementada (`AKIHIRO_ALTLAND_BURST`, content/st05.ts).",
    blockedBy: "engine:combat-trigger-sem-retrieve-trash",
  },
  {
    cardCode: "ST05-010",
    clause: "【When Paired】Choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them.",
    reason:
      "`EffectSpec.secondaryTarget` (2º alvo nomeado) só é resolvido no caminho especial de Command 【Main】 jogada da mão (`legalActions.ts` `mainPhaseCandidates`, precedente GD01-103/112). O dispatcher genérico de gatilho automático (`abilityDispatch.ts` → `pendingDecision.abilityResolution`) não carrega um 2º alvo nomeado na fila da decisão — achado no fuzzing da wave ST05 (partida travava em `pendingDecision` esperando um alvo que a UI/enumeração nunca oferecia). A 1ª cláusula da carta (【Burst】Add this card to your hand) está implementada (`MIKAZUKI_AUGUS_BURST`, content/st05.ts).",
    blockedBy: "engine:secondaryTarget-fora-de-command-main-da-mao",
  },
] as const;

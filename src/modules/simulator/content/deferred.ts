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
  // ─────────────────────────────────────────────────────────────────────────
  {
    cardCode: "ST03-001",
    clause: "【During Pair】This Unit gains <High-Maneuver>.",
    reason:
      "Modelado como keyword FIXA (`effectKeywords: ['High-Maneuver']` em st03Deck.ts) em vez de condicional a 【During Pair】. `hasKeyword` é consultado sem `state` em ~9 pontos do motor; propagar `state` por 1 carta não compensa. Sinanju tem Link e quase sempre ataca pareada — a diferença só apareceria atacando sem Pilot.",
    blockedBy: "engine:hasKeyword-sem-state",
  },
  {
    cardCode: "ST03-001",
    clause: "when this Unit destroys an enemy shield area card with battle damage, choose 1 enemy Unit. Deal 2 damage to it.",
    reason:
      "O `combatTrigger` `destroyEnemyShieldInBattle` AUTO-mira a 1ª Unit inimiga legal na Battle Area — não há sistema de escolha de alvo durante o combate. Determinístico e testável, mas não é a escolha do jogador.",
    blockedBy: "engine:sem-escolha-de-alvo-em-combate",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Classe D — gap de motor transversal (não amarrado a 1 carta).
  // ─────────────────────────────────────────────────────────────────────────
  {
    cardCode: "*",
    clause: "Pilot pareado seguir a Unit destruída por dano/destroy de EFEITO (fora de combate).",
    reason:
      "`compilePrimitive` (`damageUnit`/`destroy`) emite só o `DESTROY_CARD` da Unit; só `combat.ts` emite `pairedPilotFollowEvents`. CR 3-3-6: o Pilot deveria ir junto pro trash. Nenhuma carta ST01–ST04 produz esse caso hoje (Close Combat/Rewloola miram Units, não Link Units específicas), mas GD/EB produzem.",
    blockedBy: "engine:pilot-follow-so-em-combate",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Classe E — Wave GD01: Mecânicas avançadas, bounce, auras e custos dinâmicos (Fase 2 Claude).
  // ─────────────────────────────────────────────────────────────────────────
  {
    cardCode: "GD01-001",
    clause: "All your (White Base Team) Units gain <Repair 1>",
    reason: "Aura contínua que concede keyword em grupo depende do pipeline de Layers/Auras da Fase 2.",
    blockedBy: "engine:aura-concessao-keyword-grupo",
  },
  {
    cardCode: "GD01-002",
    clause: "destroy 1 of your Link Units with \"Unicorn Mode\" in its card name that is Lv.5. If you do, play this card as if it has 0 Lv. and cost",
    reason: "Deploy alternativo com custo 0 e Lv.0 por sacrifício de Link Unit específica.",
    blockedBy: "engine:deploy-alternativo-sacrificio",
  },
  {
    cardCode: "GD01-003",
    clause: "Choose 12 cards from your trash. Return them to their owner's deck and shuffle it",
    reason: "Reciclagem de 12 cartas da lixeira para o deck com shuffle.",
    blockedBy: "engine:reciclagem-lixeira-deck",
  },
  {
    cardCode: "GD01-005",
    clause: "【During Link】【Destroyed】Return this Unit's paired Pilot to its owner's hand. Then, discard 1.",
    reason:
      "2 gaps empilhados: (1) não existe snapshot `wasLinkUnit` equivalente a `wasPaired` — 【During Link】 não dá pra checar depois que a Unit já foi pro trash (perdeu `pairedPilotId`); (2) mesmo com o gate, a ação precisaria do instanceId do Pilot ex-pareado, que `DESTROY_CARD` já limpou antes do 【Destroyed】 disparar — falta threadear esse id como alvo implícito.",
    blockedBy: "engine:during-link-e-alvo-implicito-pos-destroy",
  },
  {
    cardCode: "GD01-014",
    clause: "【During Link】【Activate･Action】【Once per Turn】Choose 1 Unit. It recovers 1 HP.",
    reason:
      "\"Choose 1 Unit\" (sem \"enemy\"/\"friendly\") precisa de um `targetScope` que enxergue os 2 lados — só existe \"enemyUnit\"/\"friendlyUnit\"/\"ownResource\" hoje. Mesmo gap de GD01-058.",
    blockedBy: "engine:target-scope-qualquer-lado",
  },
  {
    cardCode: "GD01-016",
    clause: "While you have 2 or more (Earth Federation) Units in play, this card in your hand gets cost -1.",
    reason: "Cálculo de modificador dinâmico de custo de cartas na mão antes do deploy (Layer 3).",
    blockedBy: "engine:custo-dinamico-na-mao",
  },
  {
    cardCode: "GD01-019",
    clause: "While 4 or more enemy Units are in play, this Unit gains <Blocker>.",
    reason:
      "`StaticAbility` (types.ts) só reavalia bônus de STAT (`ap`/`hp`) sob condição `duringPair`/`duringLink` — não concede KEYWORD, e não suporta condição de contagem de board arbitrária (\"4+ enemy Units\"). Precisa de uma 2ª variante de static ability (keyword grant) + um novo tipo de condição além de duringPair/duringLink.",
    blockedBy: "engine:static-ability-keyword-condicao-generica",
  },
  {
    cardCode: "GD01-023",
    clause: "【Activate･Main】Discard 1 (Zeon)/(Neo Zeon) Unit card：If a Pilot is not paired with this Unit, choose 1 (Newtype) Pilot card that is Lv.3 or lower from your trash. Pair it with this Unit.",
    reason:
      "3 mecanismos ausentes ao mesmo tempo: custo de descarte de carta ESPECÍFICA por trait (não é `discardNamed` genérico), busca/escolha de carta na LIXEIRA (não mão nem topo do deck), e parear um Pilot escolhido com a própria fonte fora do fluxo normal de `deployCard`.",
    blockedBy: "engine:busca-lixeira-e-pareamento-por-efeito",
  },
  {
    cardCode: "GD01-024",
    clause: "【Deploy】Deal 3 damage to all Units that are Lv.5 or lower.",
    reason:
      "\"all Units\" no texto oficial é AMBAS as bordas (não só inimigas) — `TargetGroup` só tem `allEnemyUnits`, falta uma variante que atinja os dois lados (com maxLevel).",
    blockedBy: "engine:target-group-todas-as-units-dos-2-lados",
  },
  {
    cardCode: "GD01-027",
    clause: "【Deploy】If there are 10 or more (Zeon)/(Neo Zeon) Unit cards in your trash, deal 4 damage to all Units with <Blocker>.",
    reason:
      "\"all Units with <Blocker>\" é AMBAS as bordas (mesmo gap de GD01-024) — falta `TargetGroup` que filtre por keyword nos dois lados, além do predicate de contagem de trash por trait (esse é trivial, mesmo padrão de `enemyUnitCountAtLeast`).",
    blockedBy: "engine:target-group-todas-as-units-dos-2-lados",
  },
  {
    cardCode: "GD01-034",
    clause: "【During Pair】This Unit gains <Breach 3>.",
    reason:
      "Mesmo gap de GD01-019 — `StaticAbility` não concede KEYWORD, só bônus de stat, mesmo já suportando a condição `duringPair` em si (só falta o tipo de concessão).",
    blockedBy: "engine:static-ability-keyword-condicao-generica",
  },
  {
    cardCode: "GD01-039",
    clause: "【Deploy】Look at the top card of your deck. Return it to the top or bottom of your deck.",
    reason:
      "`moveWithinDeck` (nomeado) exige a posição (top/bottom) FIXA por chamada, decidida por quem autora — aqui é o JOGADOR quem escolhe, em tempo de resolução, pra qual lado vai a única carta revelada. Padrão de ST02-015 não serve (lá são 2 cartas, 1 pra cada posição fixa); aqui é 1 carta com posição variável.",
    blockedBy: "engine:escolha-de-posicao-para-1-carta-revelada",
  },
  {
    cardCode: "GD01-043",
    clause: "【Deploy】Choose 1 of your green Units. During this turn, it may choose an active enemy Unit with 4 or less AP as its attack target.",
    reason:
      "`grantAttackTargetRelax` (e `CardInstance.attackTargetRelaxUntilTurn`) só guardam `maxLevel` — o texto aqui filtra por AP, não nível. Precisa de um 2º campo (`maxAp`) ou um discriminante de critério na mesma primitiva.",
    blockedBy: "engine:relaxamento-alvo-por-ap-nao-so-nivel",
  },
  {
    cardCode: "GD01-044",
    clause: "【When Paired･(Cyber-Newtype)/(Newtype) Pilot】Choose 1 to 2 enemy Units. Deal 1 damage to them.",
    reason:
      "Escolha de CONTAGEM VARIÁVEL (\"1 to 2\") não existe — `TargetRef` \"named\" resolve 1 alvo fixo (`resolveTarget`) e \"group\" é automático (todo mundo que casa o padrão), sem meio-termo de \"até N, escolhidos pelo jogador\".",
    blockedBy: "engine:escolha-de-ate-n-alvos",
  },
  {
    cardCode: "GD01-045",
    clause: "【When Paired】Look at the top 3 cards of your deck. You may deploy 1 (ZAFT) Unit card that is Lv.4 or lower among them. Return the remaining cards randomly to the bottom of your deck.",
    reason:
      "`lookAtTopFilterReveal` só ADICIONA a carta revelada À MÃO — aqui o efeito quer DEPLOYAR direto do topo do deck (não passa pela mão), mais o retorno aleatório do resto (`lookAtTopFilterReveal` devolve em ordem fixa, não embaralhada).",
    blockedBy: "engine:deploy-direto-do-topo-do-deck",
  },
  {
    cardCode: "GD01-046",
    clause: "【During Pair･(Coordinator) Pilot】【Once per Turn】When you use this Unit's <Support> to increase a (ZAFT) Unit's AP, set this Unit as active.",
    reason:
      "Gatilho ligado ao ATO de usar a própria keyword <Support> (não a um trigger de carta como Deploy/Attack/Destroyed) — `keywords.ts` aplica <Support> diretamente, sem emitir um evento que `abilityDispatch.ts` possa escutar depois.",
    blockedBy: "engine:gatilho-por-uso-de-keyword",
  },
  {
    cardCode: "GD01-048",
    clause: "【Deploy】Look at the top card of your deck. If it is a (Zeon)/(Neo Zeon) Unit card, you may reveal it and add it to your hand. Return any remaining card to the bottom of your deck.",
    reason: "Busca no topo do deck com filtro de trait múltiplo.",
    blockedBy: "engine:busca-topo-deck-filtro-especifico",
  },
  {
    cardCode: "GD01-054",
    clause: "While this Unit has 5 or more AP, it gains <Breach 3>.",
    reason: "Mesmo gap de GD01-019/034 (concessão de keyword) SOMADO a uma condição de STAT PRÓPRIO (AP>=5), não coberta por `StaticAbility.condition` (só duringPair/duringLink).",
    blockedBy: "engine:static-ability-keyword-condicao-generica",
  },
  {
    cardCode: "GD01-058",
    clause: "【Activate･Action】【Once per Turn】①：Choose 1 Unit that is Lv.4 or higher. It gets AP+1 during this battle.",
    reason: "\"Choose 1 Unit\" (ambos os lados) — mesmo gap de GD01-014 (`targetScope` não tem opção \"qualquer lado\").",
    blockedBy: "engine:target-scope-qualquer-lado",
  },
  {
    cardCode: "GD01-063",
    clause: "During your turn, while this Unit is battling an enemy Unit that is Lv.2 or lower, it gains <First Strike>.",
    reason:
      "Condicional a ESTAR EM COMBATE agora (não é duringPair/duringLink nem contagem de board) — nem `StaticAbility` nem `CombatTrigger` cobrem \"ganha keyword enquanto batalhando contra alvo que casa filtro X\".",
    blockedBy: "engine:keyword-condicional-a-combate-especifico",
  },
  {
    cardCode: "GD01-065",
    clause: "【During Pair】【Once per Turn】When you pair a Pilot with this Unit or one of your white Units, choose 1 enemy Unit. It gets AP-2 during this turn.",
    reason:
      "Gatilho ligado ao EVENTO de parear (PAIR_CARDS), não a um trigger de carta já pareada — `abilityDispatch.ts` não escuta `PAIR_CARDS`. Também mira \"this Unit OR one of your white Units\" (2 fontes possíveis por color), fora do modelo de 1 fonte por EffectSpec.",
    blockedBy: "engine:gatilho-por-evento-de-pareamento",
  },
  {
    cardCode: "GD01-066",
    clause: "【During Pair】【Attack】Choose 1 of your (Triple Ship Alliance) Unit tokens. It may attack on the turn it is deployed.",
    reason:
      "A 1ª cláusula (【Deploy】Deploy 1 [Fatum-00] token) já foi resolvida (`JUSTICE_GUNDAM_DEPLOY`, `TOKEN_FATUM_00`). Esta 2ª cláusula concede exceção de \"pode atacar no turno em que foi deployada\" a um token ESCOLHIDO, fora da regra nativa de Link Unit (`enteredZoneOnTurn`/combat.ts) — não existe primitiva pra isso.",
    blockedBy: "engine:atacar-no-turno-do-deploy-fora-de-link",
  },
  {
    cardCode: "GD01-067",
    clause: "【When Paired】Choose 1 Command card that is Lv.5 or lower from your trash. Add it to your hand.",
    reason: "Busca/escolha de carta na LIXEIRA pra adicionar à mão — só existe busca no topo do deck (`lookAtTopFilterReveal`) e na mão (`deployFromHandTriggered`/`discardNamed`), nenhuma na trash.",
    blockedBy: "engine:busca-lixeira-para-mao",
  },
  {
    cardCode: "GD01-070",
    clause: "While there are 4 or more Command cards in your trash, this card in your hand gets cost -2.",
    reason: "Cálculo de modificador dinâmico de custo de cartas na mão antes do deploy (Layer 3).",
    blockedBy: "engine:custo-dinamico-na-mao",
  },
  {
    cardCode: "GD01-076",
    clause: "While there are 4 or more Command cards in your trash, this Unit gets AP+1 and HP+1.",
    reason:
      "`StaticAbility.condition` só aceita `duringPair`/`duringLink` — \"4+ Command cards no trash\" é uma condição de board totalmente diferente, sem tipo de condição genérico.",
    blockedBy: "engine:static-ability-condicao-generica",
  },
  {
    cardCode: "GD01-081",
    clause: "While you have another (Triple Ship Alliance) Unit in play, this Unit gets AP+1 and <Blocker>.",
    reason: "Mesmo gap de GD01-076 (condição de board genérica) SOMADO ao gap de GD01-019/034 (concessão de keyword, não só stat) — os dois juntos na mesma carta.",
    blockedBy: "engine:static-ability-keyword-condicao-generica",
  },
  {
    cardCode: "GD01-087",
    clause: "While this Unit is blue, it gains <Repair 1>.",
    reason: "Modificador contínuo condicionado à COR impressa do próprio Pilot (não duringPair/duringLink nem contagem de board) — `StaticAbility` não tem esse tipo de condição, e concede keyword, não stat.",
    blockedBy: "engine:aura-piloto-condicional",
  },
  {
    cardCode: "GD01-089",
    clause: "While this Unit has <Repair>, it gets AP+1.",
    reason: "Condicional à PRÓPRIA keyword do Pilot (auto-referência) — `StaticAbility` não reavalia condição por keyword própria, só duringPair/duringLink.",
    blockedBy: "engine:aura-piloto-condicional",
  },
  {
    cardCode: "GD01-090",
    clause: "【During Link】This Unit's AP can't be reduced by enemy effects.",
    reason: "Imunidade/proteção contra redução de stat por efeito inimigo — mecanismo novo, motor não tem conceito de \"imune a modificador negativo\" (só soma modificadores, não filtra por origem/sinal).",
    blockedBy: "engine:imunidade-a-reducao-de-stat",
  },
  {
    cardCode: "GD01-091",
    clause: "During your turn, while this Unit has <Breach>, it can't receive battle damage from enemy Units with 3 or less AP.",
    reason: "`preventUnitBattleDamage` existe mas é um EVENTO disparado por efeito pontual (ST03-014), não uma proteção CONTÍNUA condicionada a ter a própria keyword <Breach> + ser seu turno.",
    blockedBy: "engine:protecao-continua-condicional",
  },
  {
    cardCode: "GD01-092",
    clause: "While this Unit is (Zeon), it gains <Breach 1>.",
    reason: "Mesmo gap de GD01-087 — condição por trait do próprio Pilot, `StaticAbility` concede só stat.",
    blockedBy: "engine:aura-piloto-condicional",
  },
  {
    cardCode: "GD01-093",
    clause: "【During Link】【Attack】Choose 1 enemy Unit whose Lv. is equal to or lower than this Unit. Deal 1 damage to it.",
    reason: "`targetFilter` só compara contra um número LITERAL na string (ex. \"level<=3\") — aqui o limite é o nível da PRÓPRIA fonte, relativo, não um valor fixo. `TargetFilterResolver` nem recebe o instanceId da fonte, só `{state}`.",
    blockedBy: "engine:target-filter-relativo-a-propria-carta",
  },
  {
    cardCode: "GD01-094",
    clause: "【Once per Turn】 When an enemy Link Unit is destroyed with damage while this Unit is attacking, draw 1.",
    reason: "`CombatTrigger.on` só tem `destroyEnemyInBattle`/`destroyEnemyShieldInBattle` — nenhum filtra especificamente \"era Link Unit\" no momento da destruição.",
    blockedBy: "engine:combat-trigger-filtro-link-unit",
  },
  {
    cardCode: "GD01-095",
    clause: "【When Linked】Discard 1. If you do, draw 1.",
    reason: "\"If you do\" — o `draw` só deveria rodar se o `discardNamed` anterior realmente descartou algo (mão pode estar vazia). Motor não tem branching condicionado ao RESULTADO de uma primitiva anterior na mesma cadeia.",
    blockedBy: "engine:condicional-a-resultado-de-primitiva-anterior",
  },
  {
    cardCode: "GD01-096",
    clause: "While this Unit is white, it gains <Blocker>.",
    reason: "Mesmo gap de GD01-087 — condição por cor do próprio Pilot.",
    blockedBy: "engine:aura-piloto-condicional",
  },
  {
    cardCode: "GD01-103",
    clause: "【Main】Choose 1 active friendly (Earth Federation) Unit and 1 active enemy Unit. Rest them.",
    reason: "2 alvos nomeados de ESCOPOS DIFERENTES (1 amigo + 1 inimigo) no mesmo spec — `targetScope`/`targetFilter` são únicos por EffectSpec, não dá pra ter 1 escopo por alvo nomeado.",
    blockedBy: "engine:multiplos-escopos-de-alvo-no-mesmo-spec",
  },
  {
    cardCode: "GD01-108",
    clause: "【Main】Deal 2 damage to all Units with <Blocker>.",
    reason: "\"all Units with <Blocker>\" é AMBAS as bordas — mesmo gap de GD01-024/027 (`TargetGroup` só filtra 1 lado por vez).",
    blockedBy: "engine:target-group-todas-as-units-dos-2-lados",
  },
  {
    cardCode: "GD01-109",
    clause: "【Main】Look at the top 5 cards of your deck. You may reveal 1 (Operation Meteor)/(G Team) Unit card/Pilot card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
    reason: "Busca no topo do deck com filtro de trait múltiplo.",
    blockedBy: "engine:busca-topo-deck-filtro-especifico",
  },
  {
    cardCode: "GD01-110",
    clause: "【Main】/【Action】Choose 1 Unit that is Lv.4 or higher. During this turn, it may choose an active enemy Unit with 6 or less AP as its attack target.",
    reason: "\"Choose 1 Unit\" (ambos os lados) + `grantAttackTargetRelax` por AP, não nível — mesmos 2 gaps de GD01-014/043 empilhados na mesma carta.",
    blockedBy: "engine:target-scope-qualquer-lado",
  },
  {
    cardCode: "GD01-112",
    clause: "【Main】Choose 2 of your active Units. Rest them. If you do, choose 1 enemy Unit. Deal 3 damage to it.",
    reason: "\"Choose 2\" (contagem exata, mesmo gap de GD01-044/114) ENCADEADO com um 2º efeito condicionado ao resultado do 1º (\"if you do\", mesmo gap de GD01-095) — 2 gaps na mesma carta.",
    blockedBy: "engine:escolha-de-ate-n-alvos",
  },
  {
    cardCode: "GD01-114",
    clause: "【Action】Choose 2 friendly Units. They get AP+1 during this turn.",
    reason: "Escolha de contagem EXATA (\"2 friendly Units\", diferente de \"group\" automático) — mesmo gap de GD01-044.",
    blockedBy: "engine:escolha-de-ate-n-alvos",
  },
  {
    cardCode: "GD01-122",
    clause: "If you have a Link Unit in play, choose 1 enemy Unit with 4 or less HP instead.",
    reason:
      "O bounce em si (`moveZone` toZone hand) já é suportado (ver GD01-068/073/075/080/117/129). O gap real é o `targetFilter` MUDAR condicionalmente (hp<=2 sem Link Unit, hp<=4 com) — `EffectSpec.targetFilter` é 1 string fixa por spec, não dá pra alternar por condição sem arriscar `computeLegalTargets` calcular a lista errada.",
    blockedBy: "engine:filtro-alvo-condicional",
  },
] as const;

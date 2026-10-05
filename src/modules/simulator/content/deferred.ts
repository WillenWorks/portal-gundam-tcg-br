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
  /** "approximation" = o efeito acontece com uma diferença registrada (não fica sem efeito) */
  kind?: "approximation";
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
  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // Classe G — Sprint 2 GD02: 3 gaps de motor genuínos, achados fechando o backlog
  // de cobertura GD02 (varredura de 2026-09-19). FECHADA (Sprint 2 Lote 11,
  // 2026-09-19, revalidação "engenheiro sênior" a pedido do Willen — a
  // reanálise achou que 2 das 3 razões de bloqueio originais estavam ERRADAS):
  // - GD02-011 Moebius: a razão original ("DESTROY_CARD pularia o Burst") era
  //   INCORRETA — `burstEligibleShieldIds` (dispatcher.ts) é um DIFF puro entre
  //   `before.shields` e `after.trash`, não olha QUAL evento moveu a carta;
  //   `DESTROY_CARD`/`MOVE_CARD` produzem o mesmo efeito de zona, então o Burst
  //   já dispara certinho. Fechada com `targetScope: "battlingBaseOrShield"`
  //   novo (lê `state.combat`) + primitiva `damageBattlingBaseOrShield` (Base
  //   acumula dano normal — `DAMAGE_UNIT`/`DAMAGE_BASE` são o MESMO evento na
  //   prática —, Shield "tem 1 HP" e destrói direto). Custo "Destroy this
  //   Unit:" = `cost: [{op:"destroy", target:{kind:"self"}}]`, já suportado.
  //   ACHADO ADICIONAL ao validar o custo "destroy self": `resolveDamageStep`
  //   (combat.ts) não checava se o ATACANTE ainda estava em `battleArea` antes
  //   de causar dano — um atacante autodestruído no próprio Action Step (via
  //   esta carta, ou qualquer custo futuro parecido) ainda estourava 1 Shield
  //   "de graça" no Damage Step seguinte, porque `shieldDamageEvents` quebra
  //   por CONTAGEM fixa (1, ou 2 com <Suppression>), nunca proporcional ao AP —
  //   nem um atacante com AP efetivo 0 (caso de Moebius) escapava disso. Bug
  //   real, não hipotético — corrigido na causa raiz (guard `attacker.zone !==
  //   "battleArea"` no topo de `resolveDamageStep`, sem atacante = sem dano de
  //   NENHUM lado), não só documentado — cobre também qualquer carta GD03
  //   futura com o mesmo padrão de autodestruição durante o próprio ataque.
  //   ACHADO 2: `onlyDefenderFirstStrike` tinha `allyCombatTriggerEvents(...,
  //   "destroyEnemyInBattle")` DUPLICADO (2 linhas idênticas, artefato de um
  //   `replace_all` de um lote anterior) — disparava GD02-001/002 2x quando o
  //   defensor tem <First Strike> mas ainda morre na troca. Corrigido junto.
  // - GD02-096 Desil Galette / GD02-110 Awakened Power: razão original
  //   ("precisa de pipeline de deploy paralelo") ainda procede — `deployCard`
  //   genuinamente não reusa (exige `card.zone === "hand"`) —, mas a simplificação
  //   ACEITA por `deployFromHandTriggered`/`deployFromTopFilterReveal` (deploy
  //   sem encadear o 【Deploy】 da carta recém-jogada, precedente já em produção
  //   desde ST03-010/GD01-045) também resolve este caso: nova primitiva
  //   `deployFromTrashPayingCost` paga `effectiveCost` da carta ESCOLHIDA (não
  //   um `n` fixo do EffectSpec) via `payResourceCostEvents` (fallback já
  //   auto-seleciona os N primeiros Recursos active), sem checar nível do
  //   jogador (não é a jogada normal da Main Phase, CR 7 só amarra nível à
  //   jogada da mão) e sem reusar `deployCard`.
  // ─────────────────────────────────────────────────────────────────────────

  // Achados da auditoria por cláusula (W0.3) — cláusulas que nunca tiveram efeito no motor e
  // dependem dos pacotes de capacidade do plano "simulador até GD05" (C1 gatilhos reativos,
  // C2 camada de dano). Registradas aqui em vez de parecer "cobertas" por outro spec da carta.
  {
    cardCode: "ST06-015",
    clause: "【Once per Turn】When a friendly (Clan) Unit links, it gains <Breach 3> during this turn.",
    reason: "não há gatilho reativo de \"quando uma Unit aliada linka\" — o efeito não acontece",
    blockedBy: "engine:reactive-trigger-bus (C1)",
  },
  {
    cardCode: "ST08-011",
    clause: "When you draw with an effect, if this is a blue Unit, it gains <High-Maneuver> during this turn.",
    reason: "não há gatilho reativo de \"quando você compra por efeito\" — o efeito não acontece",
    blockedBy: "engine:reactive-trigger-bus (C1)",
  },
  {
    cardCode: "GD02-073",
    clause: "During your opponent's turn, the enemy Unit battling this Unit gains <First Strike>.",
    reason: "efeito contínuo que concede keyword à Unit INIMIGA em batalha ainda não existe — o spec antigo dava First Strike à própria Unit (removido)",
    blockedBy: "engine:attack-rule-extensions (C4)",
  },
  // W0.5 — ordem de efeitos simultâneos (CR 10-1-6). O motor já segue 10-1-6-8 (【Burst】 antes de
  // todos) e 10-1-6-6 (efeitos do jogador ativo antes dos do standby — `dispatchDestroyedTriggers`);
  // efeitos com escolha (alvo, "you may", mão/deck) já vão pra fila em que o jogador escolhe a ordem.
  {
    cardCode: "*",
    clause: "10-1-6-5. If multiple effects belonging to you trigger, they do so simultaneously, and you resolve them in the order you decide.",
    reason:
      "efeitos AUTOMÁTICOS (sem escolha) de cartas diferentes do mesmo jogador resolvem na ordem em que dispararam, e antes dos que têm escolha — perguntar a ordem pararia a partida a cada coincidência, mesmo quando a ordem não muda o resultado",
    blockedBy: "engine:simultaneous-automatic-trigger-order (aproximação aceita)",
  },
  // W5 — aproximações aceitas (o efeito acontece, com a diferença descrita)
  {
    cardCode: "GD04-069",
    clause:
      "【During Link】At the end of a turn where you have paid ① or more for one of your other (Militia)/(Dianna Counter) Units' effects, choose 1 of your (Militia) Units. Set it as active.",
    reason: "\"choose 1\" no fim do turno vira automático: a 1ª Unit (Militia) descansada fica ativa (o fim do turno não pausa pra escolha)",
    blockedBy: "engine:end-of-turn-choice (aproximação aceita)",
    kind: "approximation",
  },
  {
    cardCode: "GD04-033",
    clause: "【During Link】All your Units gain (Neo Zeon).",
    reason: "o trait concedido vale nos filtros de alvo e de reação (`hasTrait`); condições de board e custos ainda leem o trait impresso",
    blockedBy: "engine:trait-grant-everywhere (aproximação aceita)",
    kind: "approximation",
  },
  // W7 (C10) — decidido com o usuário em 2026-10-04 (sem Q&A oficial da carta)
  {
    cardCode: "GD05-049",
    clause: "【Attack】You may choose 1 of your Units. Destroy it.",
    reason: "\"1 of your Units\" não oferece o próprio Sazabi (o texto não exclui; sem ruling, ficou de fora para o 【Attack】 não destruir o atacante)",
    blockedBy: "engine:ruling-pendente-GD05-049 (aproximação aceita)",
    kind: "approximation",
  },
  // Auditoria A6 — CR 10-2-2-1 / ruling Q194: em "choose N … from your trash. Exile them" o JOGADOR escolhe.
  {
    cardCode: "*",
    clause: "Exilar N cartas do trash (custo ou efeito \"choose N … from your trash. Exile them\")",
    reason:
      "o motor exila as N primeiras cartas elegíveis do trash em vez de o jogador escolher (GD02-111, GD03-009/015/035/050/054/059, GD04-049/065/071/130) — muda o resultado só quando a identidade das cartas importa depois (contagens por nome/trait no trash, GD04-067)",
    blockedBy: "engine:exile-choice-from-trash (aproximação aceita; escolha entra com o C3 Development N, W9)",
    kind: "approximation",
  },
  // W2c — GD03: o que ainda depende de motor novo (pacotes C1/C2/C5/C8/C9 das próximas waves).
  {
    cardCode: "GD03-079",
    clause: "When you rest your Base with one of your Units' effects, you may rest this Unit instead.",
    reason: "substituição \"rest this Unit instead\" do custo de restar a Base ainda não existe",
    blockedBy: "engine:replacement-rest-cost (C2)",
  },
  {
    cardCode: "GD03-097",
    clause: "【During Link】【Once per Turn】During your turn, when this Unit destroys an enemy Unit with battle damage, look at the top 2 cards of your deck and return 1 to the top. Place the remaining card into your trash.",
    reason: "olhar o topo e escolher qual volta a partir de reação de combate ainda não existe",
    blockedBy: "engine:reaction-deck-look-choose (C9)",
  },
  {
    cardCode: "GD03-099",
    clause: "【During Link】【Destroyed】If a friendly white Base is in play, choose 1 enemy Unit whose Lv. is equal to or lower than this Unit. Return it to its owner's hand.",
    reason: "Lv. da Unit destruída do Piloto como limite de alvo (\"equal to or lower than this Unit\") ainda não existe",
    blockedBy: "engine:destroyed-pilot-unit-level-filter (C5)",
  },
] as const;

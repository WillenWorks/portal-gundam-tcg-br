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
  // ─────────────────────────────────────────────────────────────────────────
  // Classe A — primitivas de ESCOLHA NOMEADA sem camada de decisão.
  // `deferOrDispatchAbilities` só pausa pra `optional`, `specNeedsNamedTarget`
  // ("target") ou `specNeedsChoice` (`deployFromHandTriggered`/`lookAtTopFilterReveal`).
  // `discardNamed`, `moveWithinDeck` (nomeado) e a escolha binária de
  // `namedChoiceEquals` NÃO estão nessa lista → o efeito resolve inline sem os
  // `ctx.targets` e vira no-op / branch default. Fechar = adicionar essas
  // primitivas a `ChoicePrimitive`/`specNeedsChoice` + fila de decisão
  // (`handChoice`/`deckReveal`-like) em `abilityDispatch.ts` + `resolveAbility`.
  // ─────────────────────────────────────────────────────────────────────────
  {
    cardCode: "ST04-002",
    clause: "Then, discard 1.",
    reason:
      "O 【Deploy】 resolve inline (não é interativo): a compra acontece, o descarte não. `discardNamed` lê `ctx.targets.discard`, que ninguém preenche — sem UI de escolha e sem pausa do dispatcher.",
    blockedBy: "engine:discardNamed-sem-camada-de-decisao",
  },
  {
    cardCode: "ST02-015",
    clause: "Then, look at the top 2 cards of your deck and return 1 to the top and 1 to the bottom.",
    reason:
      "Só o 'Add 1 of your Shields to your hand' dispara. `moveWithinDeck` com alvo nomeado (`toTop`/`toBottom`) vira no-op sem `ctx.targets` — `specNeedsChoice` não reconhece `moveWithinDeck`, então o 【Deploy】 não pausa pra reordenação.",
    blockedBy: "engine:moveWithinDeck-sem-camada-de-decisao",
  },
  {
    cardCode: "ST04-012",
    clause: "deploy 1 [Sword Strike Gundam]((Earth Alliance)･AP4･HP2･<Blocker>) or 1 [Launcher Strike Gundam]",
    reason:
      "A escolha Sword/Launcher (`strikerChoice`) não tem camada de decisão — `namedChoiceEquals`/`namedChoiceNotEquals` são predicados, não escolhas interativas. O 【Main】 resolve inline e sempre invoca Sword (o branch `namedChoiceNotEquals`, que é verdadeiro quando nada foi escolhido).",
    blockedBy: "engine:namedChoice-sem-camada-de-decisao",
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
] as const;

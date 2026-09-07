import type { EffectSpec, PrimitiveCall } from "../engine/effectSpec";
import { TOKEN_GUNCANNON, TOKEN_GUNDAM, TOKEN_GUNTANK } from "../fixtures/st01Deck";

/**
 * Passo 3 do plano incremental (docs/18): EffectSpec real, autorada carta a
 * carta contra o `effect` oficial em inglês de `data/gcg-official-cards.json`
 * (nunca a tradução — ver docs/18, "Cobertura de idioma"). Cobre agora as 10
 * cartas com efeito bespoke das 16 únicas do ST01 (as outras 6 são vanilla ou
 * só-keyword-automática, o motor já cobre sozinho sem EffectSpec) — cobertura
 * 100%, fechando as lacunas de DSL antes documentadas aqui (ver "8 lacunas"
 * em docs/18): ST01-001 Gundam (`staticAbilities`, 【During Pair】) e
 * ST01-009 Zowort (`attackTargetRules`) são modeladas como campo estruturado
 * de `CardDef`, não como `EffectSpec` (não são gatilho→ação, são modificador
 * contínuo/restrição de legalidade — ver `st01Deck.ts`). ST01-012/013 são
 * cards Command/Pilot: o EffectSpec aqui cobre só o lado 【Main】; o lado
 * 【Pilot】[X] é o modo alternativo de jogo (parear como o Pilot nomeado),
 * modelado em `CardDef.pilotMode` + `deployCard`, não como EffectSpec.
 *
 * Nenhum disparo automático existe ainda no sentido de "descobrir sozinho
 * qual EffectSpec rodar" fora do que `dispatcher.ts` já cobre — os testes
 * deste arquivo continuam chamando `resolveEffectSpec` diretamente com um
 * `EffectContext` montado à mão, do mesmo jeito que `effectSpec.test.ts` já
 * testava o exemplo sintético — só que agora contra texto de carta real.
 */

// ST01-002 Gundam (MA Form) — 【When Paired･(White Base Team) Pilot】Draw 1.
export const GUNDAM_MA_FORM_WHEN_PAIRED: EffectSpec = {
  id: "ST01-002-WhenPaired",
  cardCode: "ST01-002",
  trigger: "When Paired",
  condition: {
    // resolvido externamente — checa se o Piloto pareado com esta Unit tem o trait "White Base Team"
    predicate: "pairedPilotHasTrait:White Base Team",
    then: [{ op: "draw", player: "controller", n: 1 }],
  },
  actions: [],
  sourceText: "【When Paired･(White Base Team) Pilot】Draw 1.",
};

// ST01-004 Guntank — 【Deploy】Choose 1 enemy Unit with 2 or less HP. Rest it.
export const GUNTANK_DEPLOY: EffectSpec = {
  id: "ST01-004-Deploy",
  cardCode: "ST01-004",
  trigger: "Deploy",
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  targetFilter: "hp<=2",
  sourceText: "【Deploy】Choose 1 enemy Unit with 2 or less HP. Rest it.",
};

// ST01-006 Gundam Aerial (Permet Score Six) — 【When Paired】Choose 1 enemy
// Unit that is Lv.5 or lower. It gets AP-3 during this turn.
export const AERIAL_SCORE_SIX_WHEN_PAIRED: EffectSpec = {
  id: "ST01-006-WhenPaired",
  cardCode: "ST01-006",
  trigger: "When Paired",
  actions: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -3, duration: "endOfTurn" }],
  targetFilter: "level<=5",
  sourceText: "【When Paired】Choose 1 enemy Unit that is Lv.5 or lower. It gets AP-3 during this turn.",
};

// ST01-010 Amuro Ray — 【Burst】Add this card to your hand.
export const AMURO_RAY_BURST: EffectSpec = {
  id: "ST01-010-Burst",
  cardCode: "ST01-010",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST01-010 Amuro Ray — 【When Paired】Choose 1 enemy Unit with 5 or less HP. Rest it.
export const AMURO_RAY_WHEN_PAIRED: EffectSpec = {
  id: "ST01-010-WhenPaired",
  cardCode: "ST01-010",
  trigger: "When Paired",
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  targetFilter: "hp<=5",
  sourceText: "【When Paired】Choose 1 enemy Unit with 5 or less HP. Rest it.",
};

// ST01-011 Suletta Mercury — 【Burst】Add this card to your hand.
export const SULETTA_MERCURY_BURST: EffectSpec = {
  id: "ST01-011-Burst",
  cardCode: "ST01-011",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST01-011 Suletta Mercury — 【Attack】【Once per Turn】Choose 1 of your
// Resources. Set it as active.
export const SULETTA_MERCURY_ATTACK: EffectSpec = {
  id: "ST01-011-Attack",
  cardCode: "ST01-011",
  trigger: "Attack",
  // 【Once per Turn】é responsabilidade de quem despacha o efeito (checar/
  // marcar usedKeywordsThisTurn na instância, igual `keywords.ts` já faz
  // pra `<Support N>`) — o EffectSpec em si não teria como se auto-impedir.
  actions: [{ op: "setActive", target: { kind: "named", name: "target" } }],
  targetScope: "ownResource",
  // o texto não escreve "rested" explicitamente, mas "Set it as active" só faz
  // sentido num Recurso já descansado (ativar o que já está ativo é no-op) —
  // antes disso era um filtro hardcoded só pra esta carta na página do
  // cliente (`SimulatorMatchPage.tsx`); agora é dado do EffectSpec, igual a
  // qualquer outra restrição de alvo (docs/25).
  targetFilter: "rested",
  sourceText: "【Attack】【Once per Turn】Choose 1 of your Resources. Set it as active.",
};

// ST01-012 Thoroughly Damaged — 【Main】Choose 1 rested enemy Unit. Deal 1 damage to it.
export const THOROUGHLY_DAMAGED_MAIN: EffectSpec = {
  id: "ST01-012-Main",
  cardCode: "ST01-012",
  trigger: "Main",
  // O lado 【Pilot】[Hayato Kobayashi] é modo de jogo alternativo (pilotMode),
  // não afeta esta seção 【Main】.
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 }],
  targetFilter: "rested",
  sourceText: "【Main】Choose 1 rested enemy Unit. Deal 1 damage to it.",
};

// ST01-013 Kai's Resolve — 【Main】Choose 1 friendly Unit. It recovers 3 HP.
export const KAIS_RESOLVE_MAIN: EffectSpec = {
  id: "ST01-013-Main",
  cardCode: "ST01-013",
  trigger: "Main",
  actions: [{ op: "heal", target: { kind: "named", name: "target" }, amount: 3 }],
  // bug real achado na auditoria V0 (docs/25): faltava declarar o escopo —
  // sem isso, `targetScope` caía no default `enemyUnit`, deixando escolher
  // Unit INIMIGA num efeito que o texto diz ser só na sua própria Unit.
  targetScope: "friendlyUnit",
  sourceText: "【Main】Choose 1 friendly Unit. It recovers 3 HP.",
};

// ST01-014 Unforeseen Incident — as 3 seções (Burst/Main/Action) resolvem
// pra exatamente a mesma ação ("【Burst】Activate this card's 【Main】" +
// "【Main】/【Action】... AP-3 during this turn"), então compartilham o mesmo
// array de PrimitiveCall.
const UNFORESEEN_INCIDENT_ACTIONS: PrimitiveCall[] = [
  { op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -3, duration: "endOfTurn" },
];

export const UNFORESEEN_INCIDENT_BURST: EffectSpec = {
  id: "ST01-014-Burst",
  cardCode: "ST01-014",
  trigger: "Burst",
  actions: UNFORESEEN_INCIDENT_ACTIONS,
  sourceText: "【Burst】Activate this card's 【Main】.",
};

export const UNFORESEEN_INCIDENT_MAIN: EffectSpec = {
  id: "ST01-014-Main",
  cardCode: "ST01-014",
  trigger: "Main",
  actions: UNFORESEEN_INCIDENT_ACTIONS,
  sourceText: "【Main】/【Action】Choose 1 enemy Unit. It gets AP-3 during this turn.",
};

export const UNFORESEEN_INCIDENT_ACTION: EffectSpec = {
  id: "ST01-014-Action",
  cardCode: "ST01-014",
  trigger: "Action",
  actions: UNFORESEEN_INCIDENT_ACTIONS,
  sourceText: "【Main】/【Action】Choose 1 enemy Unit. It gets AP-3 during this turn.",
};

// ST01-015 White Base — 【Burst】Deploy this card.
export const WHITE_BASE_BURST: EffectSpec = {
  id: "ST01-015-Burst",
  cardCode: "ST01-015",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};

// ST01-015 White Base — 【Deploy】Add 1 of your Shields to your hand.
export const WHITE_BASE_DEPLOY: EffectSpec = {
  id: "ST01-015-Deploy",
  cardCode: "ST01-015",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// ST01-015 White Base — 【Activate･Main】【Once per Turn】②：Deploy 1 [Gundam]
// token se 0 Units em campo, [Guncannon] token se 1 Unit, ou [Guntank] token
// se 2+ Units. Fecha docs/18 lacuna #3 (criar instância nova) + #4 (custo de
// recurso genérico) — 【Once per Turn】 é responsabilidade de quem despacha
// (dispatcher.ts), igual às outras cartas com essa tag.
export const WHITE_BASE_ACTIVATE_MAIN: EffectSpec = {
  id: "ST01-015-ActivateMain",
  cardCode: "ST01-015",
  trigger: "Activate·Main",
  cost: [{ op: "payResourceCost", player: "controller", n: 2 }],
  actions: [
    {
      op: "spawnTokenByOwnUnitCount",
      player: "controller",
      zone: "battleArea",
      thresholds: [
        { maxUnits: 0, def: TOKEN_GUNDAM },
        { maxUnits: 1, def: TOKEN_GUNCANNON },
        { maxUnits: Infinity, def: TOKEN_GUNTANK },
      ],
    },
  ],
  sourceText:
    "【Activate･Main】【Once per Turn】②：Deploy 1 [Gundam]((White Base Team)･AP3･HP3) Unit token if you have no Units in play, deploy 1 [Guncannon]((White Base Team)･AP2･HP2) Unit token if you have only 1 Unit in play, or deploy 1 [Guntank]((White Base Team)･AP1･HP1) Unit token if you have 2 or more Units in play.",
};

// ST01-016 Asticassia — 【Burst】Deploy this card.
export const ASTICASSIA_BURST: EffectSpec = {
  id: "ST01-016-Burst",
  cardCode: "ST01-016",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};

// ST01-016 Asticassia — 【Deploy】Add 1 of your Shields to your hand.
export const ASTICASSIA_DEPLOY: EffectSpec = {
  id: "ST01-016-Deploy",
  cardCode: "ST01-016",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// ST01-016 Asticassia — 【Activate･Main】Rest this Base：All friendly Link
// Units get AP+1 during this turn. Fecha docs/18 lacuna #5 (alvo em grupo) —
// `TargetRef.kind: "group"` resolve "All friendly Link Units" dinamicamente.
export const ASTICASSIA_ACTIVATE_MAIN: EffectSpec = {
  id: "ST01-016-ActivateMain",
  cardCode: "ST01-016",
  trigger: "Activate·Main",
  cost: [{ op: "rest", target: { kind: "self" } }],
  actions: [
    { op: "modifyStat", target: { kind: "group", group: { kind: "allFriendlyLinkUnits" } }, stat: "ap", amount: 1, duration: "endOfTurn" },
  ],
  sourceText: "【Activate･Main】Rest this Base：All friendly Link Units get AP+1 during this turn.",
};

export const ST01_EFFECT_SPECS: EffectSpec[] = [
  GUNDAM_MA_FORM_WHEN_PAIRED,
  GUNTANK_DEPLOY,
  AERIAL_SCORE_SIX_WHEN_PAIRED,
  AMURO_RAY_BURST,
  AMURO_RAY_WHEN_PAIRED,
  SULETTA_MERCURY_BURST,
  SULETTA_MERCURY_ATTACK,
  THOROUGHLY_DAMAGED_MAIN,
  KAIS_RESOLVE_MAIN,
  UNFORESEEN_INCIDENT_BURST,
  UNFORESEEN_INCIDENT_MAIN,
  UNFORESEEN_INCIDENT_ACTION,
  WHITE_BASE_BURST,
  WHITE_BASE_DEPLOY,
  WHITE_BASE_ACTIVATE_MAIN,
  ASTICASSIA_BURST,
  ASTICASSIA_DEPLOY,
  ASTICASSIA_ACTIVATE_MAIN,
];

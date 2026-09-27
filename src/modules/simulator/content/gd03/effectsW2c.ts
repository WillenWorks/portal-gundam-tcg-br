import type { EffectSpec, PrimitiveCall } from "../../engine/effectSpec";
import type { CardDefFilter } from "../../engine/effectSpec";
import { TOKEN_GRAZE_CUSTOM, TOKEN_BARBATOS_4TH_FORM } from "./tokens";

/**
 * Wave W2c (GD03) — fecha o set: custo/escolha de exilar do trash (C3), quantidades por contagem
 * (C7, `amountFrom`), filtro condicional "… instead" (`cond(…)`), Piloto pareado como alvo
 * (`pairedPilotOf`) e o resto das cláusulas que o vocabulário já cobria.
 *
 * "Choose N … cards from your trash. Exile them. If you do, …" SEM dois-pontos não é custo no texto;
 * no 【Activate】 vira `cost` mesmo assim (sem as N cartas a habilidade não é oferecida — ativar sem
 * efeito nenhum só deixaria o bot repetir a jogada). Nos gatilhos automáticos segue o padrão da
 * GD02-111: `condition` "N+ cartas elegíveis" → exilar + efeito.
 */

const target = { kind: "named", name: "target" } as const;
const exile = (count: number, filter: CardDefFilter): PrimitiveCall => ({
  op: "moveZone",
  target: { kind: "group", group: { kind: "firstNInTrash", count, filter } },
  toZone: "exile",
});

const GD03_109_MAIN: EffectSpec = {
  id: "GD03-109-Main",
  cardCode: "GD03-109",
  trigger: "Main",
  actions: [{ op: "damageUnit", target, amount: 3 }],
  targetScope: "enemyUnit",
  targetFilter: "cond(controllerTrashCardCountNamedAtLeast:Improved Technique:2||level<=4)",
  sourceText: "【Main】/【Action】Choose 1 enemy Unit that is Lv.4 or lower. Deal 3 damage to it. If there are 2 or more cards with \"Improved Technique\" in their card name in your trash, choose 1 enemy Unit instead.",
};
const GD03_110_MAIN: EffectSpec = {
  id: "GD03-110-Main",
  cardCode: "GD03-110",
  trigger: "Main",
  actions: [{ op: "destroy", target: { kind: "pairedPilotOf", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "paired;level<=5",
  sourceText: "【Main】/【Action】Choose 1 Pilot paired with an enemy Unit that is Lv.5 or lower. Destroy it.",
};
const GD03_114_ACTION: EffectSpec = {
  id: "GD03-114-Action",
  cardCode: "GD03-114",
  trigger: "Action",
  actions: [{ op: "destroy", target }],
  targetScope: "enemyUnit",
  targetFilter: "cond(controllerTrashCountAtLeast:10|active;level<=4|active;level<=2)",
  sourceText: "【Action】Choose 1 active enemy Unit that is Lv.2 or lower. Destroy it. If there are 10 or more cards in your trash, choose 1 active enemy Unit that is Lv.4 or lower instead.",
};

export const GD03_W2C_EFFECT_SPECS: EffectSpec[] = [
  // GD03-009
  {
    id: "GD03-009-Deploy",
    cardCode: "GD03-009",
    trigger: "Deploy",
    optional: true,
    condition: {
      predicate: "controllerTrashCardCountWithAnyTraitAtLeast:Titans:2",
      then: [exile(2, { anyTrait: ["Titans"] }), { op: "rest", target }],
    },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=4",
    sourceText: "【Deploy】You may choose 2 (Titans) cards from your trash. Exile them from the game. If you do, choose 1 enemy Unit that is Lv.4 or lower. Rest it.",
  },
  // GD03-015
  {
    id: "GD03-015-ActivateMain",
    cardCode: "GD03-015",
    trigger: "Activate·Main",
    oncePerTurn: true,
    cost: [exile(3, { anyTrait: ["Titans"] })],
    actions: [{ op: "grantKeyword", target: { kind: "self" }, keyword: "Breach 4", duration: "endOfTurn" }],
    sourceText: "【Activate･Main】【Once per Turn】Exile 3 (Titans) cards from your trash: This Unit gains <Breach 4> during this turn.",
  },
  // GD03-033 ("for each 4 AP": AP efetivo na hora do 【Attack】)
  {
    id: "GD03-033-Attack",
    cardCode: "GD03-033",
    trigger: "Attack",
    actions: [{ op: "damageUnit", target, amount: 1, amountFrom: { kind: "selfApDiv", div: 4 } }],
    targetScope: "enemyUnit",
    sourceText: "【Attack】Choose 1 enemy Unit. Deal 1 damage to it for each 4 AP this Unit has.",
  },
  // GD03-035 (o 【When Linked】 está na W2b)
  {
    id: "GD03-035-ActivateMain",
    cardCode: "GD03-035",
    trigger: "Activate·Main",
    oncePerTurn: true,
    cost: [{ op: "payResourceCost", player: "controller", n: 1 }, exile(1, { cardType: "PILOT" })],
    actions: [{ op: "damageUnit", target: { kind: "group", group: { kind: "allEnemyUnits" } }, amount: 1 }],
    sourceText: "【Activate･Main】【Once per Turn】①, exile 1 Pilot card from your trash: Deal 1 damage to all enemy Units.",
  },
  // GD03-039 ("Rest it. If you do" = havia uma Unit (Clan) ativa pra restar)
  {
    id: "GD03-039-Deploy",
    cardCode: "GD03-039",
    trigger: "Deploy",
    condition: {
      predicate: "chosenNonEmpty:target",
      then: [{ op: "damageUnit", target: { kind: "named", name: "enemyTarget" }, amount: 2 }],
    },
    actions: [{ op: "rest", target }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Clan;active;notSelf",
    secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit", targetFilter: "ap<=2" },
    sourceText: "【Deploy】Choose 1 other active friendly (Clan) Unit. Rest it. If you do, choose 1 enemy Unit with 2 or less AP. Deal 2 damage to it.",
  },
  // GD03-050
  {
    id: "GD03-050-ActivateMain",
    cardCode: "GD03-050",
    trigger: "Activate·Main",
    cost: [exile(3, { cardType: "UNIT", anyTrait: ["Tekkadan", "Teiwaz"] })],
    actions: [{ op: "damageUnit", target, amount: 2 }],
    targetScope: "enemyUnit",
    sourceText: "【Activate･Main】Choose 3 (Tekkadan)/(Teiwaz) Unit cards from your trash. Exile them from the game. If you do, choose 1 enemy Unit. Deal 2 damage to it.",
  },
  // GD03-054
  {
    id: "GD03-054-WhenPaired",
    cardCode: "GD03-054",
    trigger: "When Paired",
    optional: true,
    condition: {
      predicate: "pairedPilotHasTrait:X-Rounder;controllerTrashCardCountWithAnyTraitAtLeast:Vagan:4",
      then: [exile(4, { anyTrait: ["Vagan"] }), { op: "destroy", target }],
    },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=4",
    sourceText: "【When Paired･(X-Rounder) Pilot】You may choose 4 (Vagan) cards from your trash. Exile them from the game. If you do, choose 1 enemy Unit that is Lv.4 or lower. Destroy it.",
  },
  // GD03-059
  {
    id: "GD03-059-Attack",
    cardCode: "GD03-059",
    trigger: "Attack",
    optional: true,
    condition: {
      predicate: "controllerTrashCardCountWithAnyTraitAtLeast:Vagan:1",
      then: [exile(1, { anyTrait: ["Vagan"] }), { op: "modifyStat", target, stat: "ap", amount: 2, duration: "endOfTurn" }],
    },
    actions: [],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Vagan",
    sourceText: "【Attack】You may choose 1 (Vagan) card from your trash. Exile it from the game. If you do, choose 1 of your (Vagan) Units. It gets AP+2 during this turn.",
  },
  // GD03-071
  {
    id: "GD03-071-Deploy",
    cardCode: "GD03-071",
    trigger: "Deploy",
    actions: [
      {
        op: "modifyStat",
        target,
        stat: "ap",
        amount: -1,
        duration: "endOfTurn",
        amountFrom: { kind: "controllerTrashCount", filter: { cardType: "UNIT", anyTrait: ["AEUG"] } },
      },
    ],
    targetScope: "enemyUnit",
    sourceText: "【Deploy】Choose 1 enemy Unit. For each (AEUG) Unit card in your trash, it gets AP-1 during this turn.",
  },
  // GD03-073
  {
    id: "GD03-073-ActivateAction",
    cardCode: "GD03-073",
    trigger: "Activate·Action",
    duringLink: true,
    oncePerTurn: true,
    condition: {
      predicate: "controllerTrashCardCountWithAnyTraitAtLeast:Gjallarhorn:6",
      then: [{ op: "modifyStat", target, stat: "ap", amount: -3, duration: "thisBattle" }],
    },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "battlingSelf",
    sourceText: "【During Link】【Activate･Action】【Once per Turn】If there are 6 or more (Gjallarhorn) cards in your trash, choose 1 enemy Unit battling this Unit. It gets AP-3 during this battle.",
  },
  // GD03-078 (mesmo padrão da GD01-005: alvo implícito `formerPairedPilot`)
  {
    id: "GD03-078-Destroyed",
    cardCode: "GD03-078",
    trigger: "Destroyed",
    duringLink: true,
    actions: [{ op: "moveZone", target: { kind: "named", name: "formerPairedPilot" }, toZone: "hand" }],
    sourceText: "【During Link】【Destroyed】Return the card paired with this Unit to your hand.",
  },
  // GD03-084
  {
    id: "GD03-084-WhenLinked",
    cardCode: "GD03-084",
    trigger: "When Linked",
    condition: { predicate: "chosenHasTrait:target:Jupitris", then: [{ op: "draw", player: "controller", n: 1 }] },
    actions: [{ op: "grantKeyword", target, keyword: "Repair 2", duration: "endOfTurn" }],
    targetScope: "friendlyUnit",
    targetFilter: "notSelfUnit",
    sourceText: "【When Linked】Choose 1 of your other Units. It gains <Repair 2> during this turn. Then, if it is a (Jupitris) Unit, draw 1.",
  },
  // GD03-092 — a condição é avaliada ANTES das `actions` (cost→condition→actions): olha a carta do
  // topo que o `millToTrash` vai moer em seguida.
  {
    id: "GD03-092-WhenLinked",
    cardCode: "GD03-092",
    trigger: "When Linked",
    condition: { predicate: "topOfDeckHasAnyTrait:1:Zeon,Clan", then: [{ op: "damageUnit", target, amount: 1 }] },
    actions: [{ op: "millToTrash", player: "controller", count: 1 }],
    targetScope: "enemyUnit",
    sourceText: "【When Linked】Place the top card of your deck into your trash. If you placed a (Zeon)/(Clan) card with this effect, choose 1 enemy Unit. Deal 1 damage to it.",
  },
  // GD03-094 — idem, com as 2 do topo
  {
    id: "GD03-094-WhenPaired",
    cardCode: "GD03-094",
    trigger: "When Paired",
    condition: {
      predicate: "topOfDeckHasAnyTrait:2:Vagan",
      then: [{ op: "modifyStat", target, stat: "ap", amount: -2, duration: "endOfTurn" }],
    },
    actions: [{ op: "millToTrash", player: "controller", count: 2 }],
    targetScope: "enemyUnit",
    sourceText: "【When Paired】Place the top 2 cards of your deck into your trash. If you placed a (Vagan) card with this effect, choose 1 enemy Unit. It gets AP-2 during this turn.",
  },
  // GD03-102 (o 【Burst】 Draw 1 já existia)
  {
    id: "GD03-102-Action",
    cardCode: "GD03-102",
    trigger: "Action",
    actions: [{ op: "setActive", target }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Titans;linkUnit;battlingUnit",
    sourceText: "【Action】Choose 1 of your (Titans) Link Units battling an enemy Unit. Set it as active.",
  },
  // GD03-107
  {
    id: "GD03-107-Main",
    cardCode: "GD03-107",
    trigger: "Main",
    actions: [{ op: "damageUnit", target, amount: 1, amountFrom: { kind: "friendlyUnitTokenCount" } }],
    targetScope: "enemyUnit",
    targetFilter: "level<=5",
    sourceText: "【Main】Choose 1 enemy Unit that is Lv.5 or lower. Deal damage to it equal to the number of friendly Unit tokens in play.",
  },
  // GD03-109 — "If there are 2 or more … instead": o filtro condicional troca "Lv.4 or lower" por "qualquer"
  { ...GD03_109_MAIN, id: "GD03-109-Burst", trigger: "Burst", sourceText: "【Burst】Activate this card's 【Main】." },
  GD03_109_MAIN,
  { ...GD03_109_MAIN, id: "GD03-109-Action", trigger: "Action" },
  // GD03-110
  GD03_110_MAIN,
  { ...GD03_110_MAIN, id: "GD03-110-Action", trigger: "Action" },
  // GD03-114
  { ...GD03_114_ACTION, id: "GD03-114-Burst", trigger: "Burst", sourceText: "【Burst】Activate this card's 【Action】." },
  GD03_114_ACTION,
  // GD03-117 — "1 to 4" / "5 or more" (com 0 Units inimigas nada acontece)
  {
    id: "GD03-117-Main",
    cardCode: "GD03-117",
    trigger: "Main",
    condition: {
      predicate: "enemyUnitCountAtLeast:1;enemyUnitCountAtMost:4",
      then: [{ op: "spawnToken", def: TOKEN_GRAZE_CUSTOM, player: "controller", zone: "battleArea" }],
    },
    condition2: {
      predicate: "enemyUnitCountAtLeast:5",
      then: [{ op: "spawnToken", def: TOKEN_BARBATOS_4TH_FORM, player: "controller", zone: "battleArea" }],
    },
    actions: [],
    sourceText: "【Main】If 1 to 4 enemy Units are in play, deploy 1 [Graze Custom]((Tekkadan)･AP2･HP2) Unit token. If 5 or more are in play, deploy 1 [Gundam Barbatos 4th Form]((Tekkadan)･AP4･HP4) Unit token.",
  },
];

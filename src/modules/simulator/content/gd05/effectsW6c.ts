import type { EffectSpec, PrimitiveCall } from "../../engine/effectSpec";
import { EX_RESOURCE_TOKEN } from "../../engine/setup";
import { mainAndAction } from "../standardSpecs";

/**
 * Wave W6 (GD05) — lote C: Commands e Base, só com o vocabulário que o motor já tem.
 * Fora deste arquivo (falta vocabulário, ver o relatório da W6c):
 * - GD05-107 【Main】 "Destroy the first 2 cards in that player's shield area": a 1ª carta da área de
 *   escudo é a Base (se houver) — não há predicado "o inimigo tem Base" nem primitiva de destruir N
 *   cartas da área de escudo; e o 【Burst】 de Shield destruído por EFEITO não é oferecido (só no Damage Step).
 * - GD05-109 "Then, if it is paired with a Pilot that is Lv.3 or lower": falta predicado sobre o
 *   Piloto pareado do alvo escolhido (`chosenPairedPilotLevelAtMost`).
 * - GD05-110 "if you have a Unit with \"Master Gundam\" in its card name in play": falta predicado de
 *   Unit sua em jogo por nome (`controllerUnitNameContainsInPlay`); o 【Burst】 depende do 【Main】.
 */

const target = { kind: "named", name: "target" } as const;
const placeEx: PrimitiveCall = { op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea" };

const DEFENSE_ORIENTED_MAIN: Omit<EffectSpec, "id" | "trigger"> = {
  cardCode: "GD05-105",
  actions: [{ op: "moveZone", target, toZone: "hand" }],
  targetScope: "enemyUnit",
  targetFilter: "level<=3",
  sourceText: "【Main】/【Action】Choose 1 enemy Unit that is Lv.3 or lower. Return it to its owner's hand.",
};

export const GD05_W6C_EFFECT_SPECS: EffectSpec[] = [
  // GD05-103 Not with Scattershot!
  ...mainAndAction({
    cardCode: "GD05-103",
    actions: [
      { op: "heal", target, amount: 1 },
      { op: "modifyStat", target, stat: "ap", amount: 2, duration: "endOfTurn" },
    ],
    targetScope: "friendlyUnit",
    sourceText: "【Main】/【Action】Choose 1 friendly Unit. It recovers 1 HP and gets AP+2 during this turn.",
  }),
  // GD05-105 Exclusively Defense-Oriented Policy
  ...mainAndAction(DEFENSE_ORIENTED_MAIN),
  { ...DEFENSE_ORIENTED_MAIN, id: "GD05-105-Burst", trigger: "Burst", sourceText: "【Burst】Activate this card's 【Main】." },
  // GD05-107 Interwoven Blessings — só o 【Burst】 (o 【Main】 falta vocabulário, ver acima)
  {
    id: "GD05-107-Burst",
    cardCode: "GD05-107",
    trigger: "Burst",
    actions: [placeEx],
    sourceText: "【Burst】Place 1 EX Resource.",
  },
  // GD05-111 Airframe Seizure ("If you do" = a escolha do descarte não veio vazia, mesmo padrão de GD01-095)
  {
    id: "GD05-111-Main",
    cardCode: "GD05-111",
    trigger: "Main",
    condition: { predicate: "chosenNonEmpty:discard", then: [{ op: "draw", player: "controller", n: 2 }] },
    actions: [{ op: "discardNamed", player: "controller", name: "discard", n: 1 }],
    sourceText: "【Main】Discard 1. If you do, draw 2.",
  },
  // GD05-114 Widespread Annihilation ("all Units" = os 2 lados)
  {
    id: "GD05-114-Main",
    cardCode: "GD05-114",
    trigger: "Main",
    actions: [{ op: "destroy", target: { kind: "group", group: { kind: "allUnits", maxLevel: 4 } } }],
    sourceText: "【Main】Destroy all Units that are Lv.4 or lower.",
  },
  // GD05-115 Newtype Labs Director
  {
    id: "GD05-115-Burst",
    cardCode: "GD05-115",
    trigger: "Burst",
    actions: [{ op: "draw", player: "controller", n: 1 }],
    sourceText: "【Burst】Draw 1.",
  },
  {
    id: "GD05-115-Main",
    cardCode: "GD05-115",
    trigger: "Main",
    actions: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "PILOT", anyTrait: ["Neo Zeon"] } }],
    sourceText: "【Main】Choose 1 (Neo Zeon) Pilot card from your trash. Add it to your hand.",
  },
  // GD05-116 Veteran's Pride
  ...mainAndAction({
    cardCode: "GD05-116",
    actions: [{ op: "destroy", target }],
    targetScope: "enemyUnit",
    targetFilter: "level<=2",
    sourceText: "【Main】/【Action】Choose 1 enemy Unit that is Lv.2 or lower. Destroy it.",
  }),
  // GD05-117 Become a Shield ("Choose 1 of your Units and 1 enemy Unit" = 2º alvo, mesmo padrão de GD01-103)
  ...mainAndAction({
    cardCode: "GD05-117",
    actions: [
      { op: "damageUnit", target, amount: 1 },
      { op: "damageUnit", target: { kind: "named", name: "enemyTarget" }, amount: 1 },
    ],
    targetScope: "friendlyUnit",
    secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit" },
    sourceText: "【Main】/【Action】Choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them.",
  }),
  // GD05-118 Incendiary Spark (mesmo predicado de GD04-106/108)
  {
    id: "GD05-118-Main",
    cardCode: "GD05-118",
    trigger: "Main",
    condition: { predicate: "selfPaidWithEx", then: [{ op: "rest", target }] },
    actions: [{ op: "modifyStat", target, stat: "ap", amount: -2, duration: "endOfTurn" }],
    targetScope: "enemyUnit",
    sourceText: "【Main】Choose 1 enemy Unit. It gets AP-2 during this turn. If you use an EX Resource to play this card, rest the enemy Unit.",
  },
  // GD05-120 Shining Finger — "Then, you may choose …" = 2º alvo sequencial e opcional (vazio = não escolheu)
  ...mainAndAction({
    cardCode: "GD05-120",
    condition: {
      predicate: "chosenNonEmpty:shining",
      then: [{ op: "grantKeyword", target: { kind: "named", name: "shining" }, keyword: "First Strike", duration: "endOfTurn" }],
    },
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=4",
    secondaryTarget: { name: "shining", targetScope: "friendlyUnit", targetFilter: "nameContains:Shining Gundam", sequential: true },
    sourceText:
      "【Main】/【Action】Choose 1 enemy Unit with 4 or less HP. Rest it. Then, you may choose 1 of your Units with \"Shining Gundam\" in its card name. It gets <First Strike> during this turn.",
  }),
  // GD05-125 Ra Cailum (Base) — redução de dano inimigo durante o turno (camada de dano, scope "turn")
  {
    id: "GD05-125-ActivateMain",
    cardCode: "GD05-125",
    trigger: "Activate·Main",
    cost: [{ op: "rest", target: { kind: "self" } }],
    actions: [{ op: "grantDamageModifier", target, amount: 1, scope: "turn", enemyOnly: true }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Londo Bell",
    sourceText: "【Activate･Main】Rest this Base：Choose 1 friendly (Londo Bell) Unit. During this turn, when it receives enemy damage, reduce it by 1.",
  },
];

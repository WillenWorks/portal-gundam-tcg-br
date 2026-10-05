import type { EffectSpec } from "../../engine/effectSpec";
import { mainAndAction } from "../standardSpecs";

/**
 * W7 (C9) — deferidas do GD03 que dependiam de continuação ("If you do, …"/"Then, …" com escolha própria):
 * a 1ª parte do efeito roda e a continuação (`Then:1`) pede a própria escolha depois.
 */

const target = { kind: "named", name: "target" } as const;

const HUMAN_KARMA_TEXT = "【Main】/【Action】Choose 1 active friendly Unit. Rest it.";

export const GD03_W7_EFFECT_SPECS: EffectSpec[] = [
  // GD03-064 Defurse
  {
    id: "GD03-064-Deploy",
    cardCode: "GD03-064",
    trigger: "Deploy",
    optional: true,
    actions: [{ op: "searchTrashToHand", player: "controller", filter: { anyTrait: ["X-Rounder"] } }],
    condition: { predicate: "chosenNonEmpty:trashSearch", then: [{ op: "thenTrigger", trigger: "Then:1" }] },
    sourceText: "【Deploy】You may choose 1 (X-Rounder) card from your trash and add it to your hand.",
  },
  {
    id: "GD03-064-Then",
    cardCode: "GD03-064",
    trigger: "Then:1",
    actions: [{ op: "discardNamed", player: "controller", name: "discard", n: 1 }],
    sourceText: "If you do, discard 1.",
  },

  // GD03-113 Human Karma — o Lv. da Unit descansada (alvo do 1º passo) limita o 2º alvo
  ...mainAndAction({
    cardCode: "GD03-113",
    actions: [
      { op: "rest", target },
      { op: "thenTrigger", trigger: "Then:1" },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "active",
    sourceText: HUMAN_KARMA_TEXT,
  }),
  {
    id: "GD03-113-Then",
    cardCode: "GD03-113",
    trigger: "Then:1",
    actions: [{ op: "damageUnit", target, amount: 3 }],
    targetScope: "enemyUnit",
    targetFilter: "level<=previousTarget",
    sourceText: "If you do, choose 1 enemy Unit whose Lv. is equal to or lower than the Unit rested with this ability. Deal 3 damage to it.",
  },

  // GD03-118 Awakened Potential — a 2ª parte só se houver 2+ "Awakened Potential" no trash (a própria carta ainda
  // está resolvendo, não conta)
  {
    id: "GD03-118-Action",
    cardCode: "GD03-118",
    trigger: "Action",
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    condition: {
      predicate: "controllerTrashCardCountNamedAtLeast:Awakened Potential:2",
      then: [{ op: "thenTrigger", trigger: "Then:1" }],
    },
    targetScope: "enemyUnit",
    targetFilter: "rested;level<=4",
    sourceText: "【Action】Choose 1 rested enemy Unit that is Lv.4 or lower. Return it to its owner's hand.",
  },
  {
    id: "GD03-118-Then",
    cardCode: "GD03-118",
    trigger: "Then:1",
    optional: true,
    actions: [{ op: "grantKeyword", target, keyword: "Blocker", duration: "endOfTurn" }],
    targetScope: "friendlyUnit",
    sourceText:
      'Then, if there are 2 or more cards with "Awakened Potential" in their card name in your trash, you may choose 1 friendly Unit. It gains <Blocker> during this turn.',
  },
];

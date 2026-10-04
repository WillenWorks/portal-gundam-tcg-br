import type { EffectSpec } from "../../engine/effectSpec";

/**
 * Wave W7a (C9) — escolha de modo, efeito concedido e escolhas encadeadas do GD05.
 * "choose 1 of the following effects": o spec da carta só tem o `chooseMode`; cada ■ é um spec com gatilho
 * `Mode:<n>` (o alvo do modo é pedido depois da escolha do modo, pelo mesmo caminho dos outros gatilhos).
 */

const target = { kind: "named", name: "target" } as const;

const MODE_HEADER = "When playing this card, choose 1 of the following effects and activate it:";

export const GD05_W7A_EFFECT_SPECS: EffectSpec[] = [
  // GD05-102 Wings of Light
  {
    id: "GD05-102-Action",
    cardCode: "GD05-102",
    trigger: "Action",
    actions: [
      {
        op: "chooseMode",
        key: "mode",
        options: [
          { value: "1", label: "Devolver à mão 1 Unit inimiga com 5 ou menos de HP" },
          { value: "2", label: "1 Unit recupera 3 de HP" },
        ],
      },
    ],
    sourceText: `【Action】${MODE_HEADER}`,
  },
  {
    id: "GD05-102-Mode1",
    cardCode: "GD05-102",
    trigger: "Mode:1",
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=5",
    sourceText: "■Choose 1 enemy Unit with 5 or less HP. Return it to its owner's hand.",
  },
  {
    id: "GD05-102-Mode2",
    cardCode: "GD05-102",
    trigger: "Mode:2",
    actions: [{ op: "heal", target, amount: 3 }],
    targetScope: "anyUnit",
    sourceText: "■Choose 1 Unit. It recovers 3 HP.",
  },

  // GD05-106 Mutual Attraction
  {
    id: "GD05-106-Main",
    cardCode: "GD05-106",
    trigger: "Main",
    actions: [
      {
        op: "chooseMode",
        key: "mode",
        options: [
          { value: "1", label: "Colocar 1 Resource descansado" },
          { value: "2", label: "Pilot Lv.5+ do trash para a mão" },
        ],
      },
    ],
    sourceText: `【Main】${MODE_HEADER}`,
  },
  {
    id: "GD05-106-Mode1",
    cardCode: "GD05-106",
    trigger: "Mode:1",
    actions: [{ op: "placeResourceFromDeck", player: "controller", rested: true }],
    sourceText: "■Place 1 rested Resource.",
  },
  {
    id: "GD05-106-Mode2",
    cardCode: "GD05-106",
    trigger: "Mode:2",
    actions: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "PILOT", minLevel: 5 } }],
    sourceText: "■Choose 1 Pilot card that is Lv.5 or higher from your trash. Add it to your hand.",
  },
];

import type { EffectSpec } from "../../engine/effectSpec";

/**
 * Wave W7b (C10) — decisões do oponente. A continuação (`thenTrigger`/opção de `chooseMode` com
 * `decidedBy: "opponent"`) põe a `PendingDecision` no oponente; o efeito continua sendo do controlador
 * (`player: "opponent"` nas primitivas = o oponente de quem jogou a carta).
 * AFK/timeout: a 1ª opção do enum é o padrão — por isso "não descartar" vem primeiro no "may" do oponente.
 */

const target = { kind: "named", name: "target" } as const;

const GAIA_KEEP: Omit<EffectSpec, "id" | "trigger"> = {
  cardCode: "GD05-034",
  optional: true,
  actions: [{ op: "deployFromHandTriggered", player: "controller", filter: { cardType: "UNIT", anyTrait: ["Phantom Pain"], maxLevel: 4 } }],
  sourceText: "If they don't discard with this effect, you may deploy 1 (Phantom Pain) Unit card that is Lv.4 or lower from your hand.",
};

export const GD05_W7B_EFFECT_SPECS: EffectSpec[] = [
  // GD05-034 Gaia Gundam
  {
    id: "GD05-034-Reaction",
    cardCode: "GD05-034",
    trigger: "Reaction:destroyedShieldInBattle",
    reaction: { event: "destroyedShieldInBattle", subject: "self" },
    duringPair: true,
    oncePerTurn: true,
    actions: [{ op: "thenTrigger", trigger: "Then:1", decidedBy: "opponent" }],
    sourceText: "【During Pair】【Once per Turn】When this Unit destroys an enemy shield area card with battle damage,",
  },
  {
    id: "GD05-034-Choice",
    cardCode: "GD05-034",
    trigger: "Then:1",
    condition: {
      predicate: "opponentHandCountAtLeast:1",
      then: [
        {
          op: "chooseMode",
          key: "mode",
          options: [
            { value: "keep", label: "Não descartar (o oponente pode deployar)", decidedBy: "controller" },
            { value: "discard", label: "Descartar 1", decidedBy: "opponent" },
          ],
        },
      ],
      // mão vazia: não tem como descartar — vale o "If they don't discard"
      else: [{ op: "thenTrigger", trigger: "Then:2" }],
    },
    actions: [],
    sourceText: "that enemy player may discard 1.",
  },
  {
    id: "GD05-034-Discard",
    cardCode: "GD05-034",
    trigger: "Mode:discard",
    actions: [{ op: "discardNamed", player: "opponent", name: "discard", n: 1 }],
    sourceText: "that enemy player may discard 1.",
  },
  { id: "GD05-034-Keep", trigger: "Mode:keep", ...GAIA_KEEP },
  { id: "GD05-034-NoHand", trigger: "Then:2", ...GAIA_KEEP },

  // GD05-046 Abyss Gundam (MA Mode) — no 1v1, "1 enemy player with 4 or more cards" é o oponente (se tiver 4+)
  {
    id: "GD05-046-WhenPaired",
    cardCode: "GD05-046",
    trigger: "When Paired",
    condition: { predicate: "pairedPilotHasTrait:Phantom Pain", then: [{ op: "thenTrigger", trigger: "Then:1", decidedBy: "opponent" }] },
    actions: [],
    sourceText: "【When Paired･(Phantom Pain) Pilot】Choose 1 enemy player with 4 or more cards in their hand.",
  },
  {
    id: "GD05-046-Discard",
    cardCode: "GD05-046",
    trigger: "Then:1",
    condition: { predicate: "opponentHandCountAtLeast:4", then: [{ op: "discardNamed", player: "opponent", name: "discard", n: 1 }] },
    actions: [],
    sourceText: "They discard 1.",
  },

  // GD05-107 Interwoven Blessings — no 1v1 "Choose 1 enemy player" é o oponente (sem escolha). Base primeiro, depois
  // escudos do topo; escudo destruído oferece 【Burst】 ao dono.
  {
    id: "GD05-107-Main",
    cardCode: "GD05-107",
    trigger: "Main",
    actions: [{ op: "destroyFirstShieldAreaCards", player: "opponent", count: 2 }],
    sourceText: "【Main】Choose 1 enemy player. Destroy the first 2 cards in that player's shield area.",
  },

  // GD05-049 Sazabi — aproximação registrada: a Unit destruída por você não pode ser o próprio Sazabi
  {
    id: "GD05-049-Attack",
    cardCode: "GD05-049",
    trigger: "Attack",
    optional: true,
    actions: [
      { op: "destroy", target },
      { op: "thenTrigger", trigger: "Then:1", decidedBy: "opponent" },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "notSelf",
    sourceText: "【Attack】You may choose 1 of your Units. Destroy it.",
  },
  {
    id: "GD05-049-Then",
    cardCode: "GD05-049",
    trigger: "Then:1",
    actions: [{ op: "destroy", target }],
    targetScope: "enemyUnit",
    targetFilter: "notBattling",
    sourceText: "If you do, all enemy players each choose 1 of their non-battling Units. Destroy them.",
  },
];

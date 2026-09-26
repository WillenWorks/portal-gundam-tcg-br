import type { CardDef } from "../../engine/types";

export const PILOTS: Record<string, CardDef> = {
  "GD01-087": {
    code: "GD01-087",
    structuredSourceText: {
      staticAbilities: "While this Unit is blue, it gains <Repair 1>.",
    },
    nameEn: "Sayla Mass",
    cardType: "PILOT",
    color: "blue",
    level: 3,
    cost: 1,
    ap: 1,
    hp: 1,
    traits: ["Earth Federation","White Base Team","Newtype"],
    triggerKeywords: ["Burst"],
    // "While this Unit is blue, it gains <Repair 1>." — Lote 3 (docs/debates 2026-09-13).
    // "This Unit" = a Unit PAREADA com este Piloto, não o Piloto (aura-piloto-condicional).
    // Era effectKeywords/keywordTags fixos na PRÓPRIA CardDef do Piloto na Fase 1 (inerte —
    // nada checa hasKeyword numa instância de Piloto — mas incorreto como dado).
    staticAbilities: [
      { condition: "duringPair", scope: "pairedUnit", keyword: "Repair", keywordValue: 1, targetCondition: { kind: "colorIs", color: "blue" } },
    ],
    hasBurst: true,
  },
  "GD01-088": {
    code: "GD01-088",
    nameEn: "Banagher Links",
    cardType: "PILOT",
    color: "blue",
    level: 5,
    cost: 1,
    ap: 2,
    hp: 2,
    traits: ["Civilian","Newtype"],
    triggerKeywords: ["When Linked","Burst"],
    hasBurst: true,
  },
  "GD01-089": {
    code: "GD01-089",
    structuredSourceText: {
      staticAbilities: "While this Unit has <Repair>, it gets AP+1.",
    },
    nameEn: "Riddhe Marcenas",
    cardType: "PILOT",
    color: "blue",
    level: 3,
    cost: 1,
    ap: 1,
    hp: 1,
    traits: ["Earth Federation"],
    triggerKeywords: ["Burst"],
    // "While this Unit has <Repair>, it gets AP+1." — Lote 3. "This Unit" = a
    // Unit pareada; a condição é sobre a KEYWORD PRÓPRIA dela (impressa ou
    // concedida por outro efeito), não a do Piloto.
    staticAbilities: [{ condition: "duringPair", scope: "pairedUnit", stat: "ap", amount: 1, targetCondition: { kind: "hasKeyword", keyword: "Repair" } }],
    hasBurst: true,
  },
  "GD01-090": {
    code: "GD01-090",
    structuredSourceText: {
      innateStatReductionImmunity: "【During Link】This Unit's AP can't be reduced by enemy effects.",
    },
    nameEn: "Duo Maxwell",
    cardType: "PILOT",
    color: "green",
    level: 4,
    cost: 1,
    ap: 1,
    hp: 2,
    traits: ["Operation Meteor"],
    // "【During Link】This Unit's AP can't be reduced by enemy effects." — Lote 5. "this Unit"
    // = a Unit pareada (mesma convenção de GD01-087/089/092/096/091).
    innateStatReductionImmunity: { stat: "ap", duringLinkOnly: true },
    triggerKeywords: ["During Link","Burst"],
    hasBurst: true,
  },
  "GD01-091": {
    code: "GD01-091",
    structuredSourceText: {
      innateDamageProtection: "During your turn, while this Unit has <Breach>, it can't receive battle damage from enemy Units with 3 or less AP.",
    },
    nameEn: "Chang Wufei",
    cardType: "PILOT",
    color: "green",
    level: 4,
    cost: 1,
    ap: 2,
    hp: 1,
    traits: ["Operation Meteor"],
    triggerKeywords: ["Burst"],
    // "During your turn, while this Unit has <Breach>, it can't receive battle damage
    // from enemy Units with 3 or less AP." — Lote 5. "this Unit" = a Unit pareada
    // (mesma convenção de GD01-087/089/092/096, Lote 3) — `effectKeywords: ["Breach"]`
    // fixo aqui era outro achado de dado da Fase 1 (não existe cláusula incondicional de
    // Breach na Piloto; o único "Breach" no texto oficial é sobre a Unit pareada, e é
    // CONDIÇÃO, não concessão) — removido.
    innateDamageProtection: { maxAttackerAp: 3, requiresOwnKeyword: "Breach", duringYourTurnOnly: true },
    hasBurst: true,
  },
  "GD01-092": {
    code: "GD01-092",
    structuredSourceText: {
      staticAbilities: "While this Unit is (Zeon), it gains <Breach 1>.",
    },
    nameEn: "M'Quve",
    cardType: "PILOT",
    color: "green",
    level: 3,
    cost: 1,
    ap: 1,
    hp: 1,
    traits: ["Zeon"],
    triggerKeywords: ["Burst"],
    // "While this Unit is (Zeon), it gains <Breach 1>." — Lote 3. "This Unit" = a Unit pareada.
    staticAbilities: [
      { condition: "duringPair", scope: "pairedUnit", keyword: "Breach", keywordValue: 1, targetCondition: { kind: "traitIs", trait: "Zeon" } },
    ],
    hasBurst: true,
  },
  "GD01-093": {
    code: "GD01-093",
    nameEn: "Marida Cruz",
    cardType: "PILOT",
    color: "red",
    level: 4,
    cost: 1,
    ap: 2,
    hp: 1,
    traits: ["Neo Zeon","Cyber-Newtype"],
    triggerKeywords: ["Attack","During Link","Burst"],
    hasBurst: true,
  },
  "GD01-094": {
    code: "GD01-094",
    structuredSourceText: {
      combatTriggers: "【Once per Turn】 When an enemy Link Unit is destroyed with damage while this Unit is attacking, draw 1.",
    },
    nameEn: "Yzak Jule",
    cardType: "PILOT",
    color: "red",
    level: 3,
    cost: 1,
    ap: 1,
    hp: 1,
    traits: ["ZAFT","Coordinator"],
    triggerKeywords: ["Burst"],
    // "【Once per Turn】 When an enemy Link Unit is destroyed with damage while this Unit
    // is attacking, draw 1." — Lote 5 (docs/debates 2026-09-13). "this Unit" = a Unit
    // pareada (During Pair implícito — sem prefixo explícito no texto oficial, mas sem
    // sentido sem par, mesma convenção de ST02-003 Heavyarms).
    combatTriggers: [
      { condition: "duringPair", on: "destroyEnemyInBattle", requiresLinkUnitEnemy: true, oncePerTurn: true, action: { kind: "draw", amount: 1 } },
    ],
    hasBurst: true,
  },
  "GD01-095": {
    code: "GD01-095",
    nameEn: "Dearka Elthman",
    cardType: "PILOT",
    color: "red",
    level: 3,
    cost: 1,
    ap: 1,
    hp: 1,
    traits: ["ZAFT","Coordinator"],
    triggerKeywords: ["When Linked","Burst"],
    hasBurst: true,
  },
  "GD01-096": {
    code: "GD01-096",
    structuredSourceText: {
      staticAbilities: "While this Unit is white, it gains <Blocker>.",
    },
    nameEn: "Cagalli Yula Athha",
    cardType: "PILOT",
    color: "white",
    level: 4,
    cost: 1,
    ap: 1,
    hp: 1,
    traits: ["Orb"],
    triggerKeywords: ["Burst"],
    // "While this Unit is white, it gains <Blocker>." — Lote 3. "This Unit" = a Unit pareada.
    staticAbilities: [{ condition: "duringPair", scope: "pairedUnit", keyword: "Blocker", targetCondition: { kind: "colorIs", color: "white" } }],
    hasBurst: true,
  },
  "GD01-097": {
    code: "GD01-097",
    nameEn: "Guel Jeturk",
    cardType: "PILOT",
    color: "white",
    level: 3,
    cost: 1,
    ap: 1,
    hp: 1,
    traits: ["Academy"],
    triggerKeywords: ["Activate·Main","Burst"],
    hasBurst: true,
    oncePerTurn: true,
  },
  "GD01-098": {
    code: "GD01-098",
    nameEn: "Elan Ceres (Enhanced Person Number 4)",
    cardType: "PILOT",
    color: "white",
    level: 4,
    cost: 1,
    ap: 2,
    hp: 1,
    traits: ["Academy"],
    triggerKeywords: ["Activate·Action","Burst"],
    hasBurst: true,
    oncePerTurn: true,
  },
};

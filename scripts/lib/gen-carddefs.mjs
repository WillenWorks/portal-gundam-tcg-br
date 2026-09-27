/**
 * Lógica pura de `scripts/gundam-gen-carddefs.mjs` (texto oficial + stats do apitcg → CardDef),
 * separada pra teste (`scripts/gundam-gen-carddefs.test.mjs`). Importa o clauseAudit (TS): rode
 * via tsx/vitest.
 */
import { splitClauses } from "../../src/modules/simulator/content/coverage/clauseAudit.ts";

const int = (v) => {
  const n = Number(String(v ?? "").replace(/^\+/, ""));
  return Number.isFinite(n) ? n : undefined;
};

export function buildCardDef(card, stats) {
  if (!stats) throw new Error(`${card.code}: sem stats no apitcg`);
  const cardType = card.cardType;
  const def = {
    code: card.code,
    nameEn: card.name,
    cardType,
    color: String(stats.Color ?? "").toLowerCase(),
    level: int(stats.Level),
    cost: int(stats.Cost),
  };
  if (cardType === "UNIT" || cardType === "BASE" || cardType === "PILOT") {
    def.ap = int(stats["Attack Points"]) ?? 0;
    def.hp = int(stats["Hit Points"]) ?? 0;
  }
  if ((card.traits ?? []).length) def.traits = [...card.traits];

  const link = card.link && card.link !== "-" ? card.link : null;
  if (link) {
    const names = [...link.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
    const traits = [...link.matchAll(/\(([^)]+)\)/g)].map((m) => m[1].trim());
    // "(Trinity) Trait / [Ali al-Saachez]" — nome OU trait (CardDef.link.orTraits)
    def.link = names.length ? { kind: "pilotName", values: names, ...(traits.length ? { orTraits: traits } : {}) } : { kind: "trait", values: traits };
  }

  const clauses = splitClauses(card.effect ?? "");
  const effectKeywords = [];
  const keywordTags = [];
  const triggers = [];
  for (const c of clauses) {
    for (const t of c.triggers) if (!triggers.includes(t)) triggers.push(t);
    // só keyword CONTÍNUA vira effectKeywords — "【Deploy】<Repair 2>" (com gatilho) é efeito, autoria à mão
    if (c.kind === "keyword" && c.triggers.length === 0) {
      for (const m of c.body.matchAll(/<([A-Za-z][A-Za-z -]*?)(?:\s+(\d+))?>/g)) {
        const name = m[1].trim();
        if (!effectKeywords.includes(name)) effectKeywords.push(name);
        if (m[2]) keywordTags.push(`${name} ${m[2]}`);
      }
    }
    if (c.kind === "pilotMode" && c.pilotName) {
      def.pilotMode = { pilotName: c.pilotName, ap: int(stats["Attack Points"]) ?? 0, hp: int(stats["Hit Points"]) ?? 0 };
      // mesma convenção dos Commands de GD01–GD03: AP/HP do modo Piloto também no próprio def
      def.ap = def.pilotMode.ap;
      def.hp = def.pilotMode.hp;
    }
  }
  if (effectKeywords.length) def.effectKeywords = effectKeywords;
  if (keywordTags.length) def.keywordTags = keywordTags;
  if (triggers.length) def.triggerKeywords = triggers;
  if (triggers.includes("Burst")) def.hasBurst = true;
  return def;
}


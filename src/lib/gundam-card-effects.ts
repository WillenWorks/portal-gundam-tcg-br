/* Parser v9.2 — interpreta keywords oficiais entre <> e gera metadados úteis para catálogo e simulador. */
const TRIGGER_SET = new Set([
  "Burst",
  "Deploy",
  "Attack",
  "Destroyed",
  "When Paired",
  "During Pair",
  "When Linked",
  "During Link",
  "Main",
  "Action",
  "Activate Main",
  "Activate Action",
]);

const EFFECT_SET = new Set([
  "Blocker",
  "High-Maneuver",
  "Suppression",
  "Repair",
  "Breach",
  "Raid",
  "Support",
  "First Strike",
  "Link",
  "Once per Turn",
]);

function normalizeKeywordToken(raw: string) {
  const cleaned = raw
    .replace(/[【】<>]/g, "")
    .replace(/[･·]/g, " ")
    .replace(/[_-]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const upper = cleaned.toUpperCase();
  if (!upper) return "";
  if (upper === "HIGH MANOUVER" || upper === "HIGH-MANOUVER" || upper === "HIGH MANEUVER" || upper === "HIGH-MANEUVER") return "High-Maneuver";
  if (upper === "SUPRESSION" || upper === "SUPPRESSION") return "Suppression";
  if (upper === "BLOCKER") return "Blocker";
  if (upper === "BREACH") return "Breach";
  if (upper === "RAID") return "Raid";
  if (upper === "SUPPORT") return "Support";
  if (upper === "FIRST STRIKE") return "First Strike";
  if (upper === "LINK") return "Link";
  if (upper === "BURST") return "Burst";
  if (upper === "DEPLOY") return "Deploy";
  if (upper === "ATTACK") return "Attack";
  if (upper === "DESTROYED") return "Destroyed";
  if (upper === "WHEN PAIRED") return "When Paired";
  if (upper === "WHILE PAIRED" || upper === "DURING PAIR") return "During Pair";
  if (upper === "WHEN LINKED") return "When Linked";
  if (upper === "DURING LINK") return "During Link";
  if (upper === "MAIN") return "Main";
  if (upper === "ACTION") return "Action";
  if (upper === "ACTIVATE MAIN" || upper === "ACTIVATE-MAIN") return "Activate Main";
  if (upper === "ACTIVATE ACTION" || upper === "ACTIVATE-ACTION") return "Activate Action";
  if (upper === "ONCE PER TURN") return "Once per Turn";

  const repair = upper.match(/^REPAIR\s*([1-9])$/);
  if (repair) return `Repair ${repair[1]}`;
  if (upper === "REPAIR") return "Repair";

  return cleaned;
}

export function parseCardEffects(effectText: string, burstText: string) {
  const source = [burstText, effectText].filter(Boolean).join("\n");
  const matches = Array.from(source.matchAll(/<([^>]+)>/g)).map((match) => normalizeKeywordToken(match[1] || "")).filter(Boolean);
  const deduped = Array.from(new Set(matches));

  const triggerKeywords = deduped.filter((item) => TRIGGER_SET.has(item));
  const effectKeywords = deduped.filter((item) => EFFECT_SET.has(item) || item.startsWith("Repair "));
  const keywordTags = Array.from(new Set([...triggerKeywords, ...effectKeywords]));

  return {
    triggerKeywords,
    effectKeywords,
    keywordTags,
    hasBurst: burstText.trim().length > 0 || keywordTags.includes("Burst"),
    hasMain: keywordTags.includes("Main") || keywordTags.includes("Activate Main"),
    hasAction: keywordTags.includes("Action") || keywordTags.includes("Activate Action"),
    oncePerTurn: keywordTags.includes("Once per Turn"),
    sections: [
      ...(burstText.trim() ? [{ kind: "burst", label: "Burst", textPt: burstText.trim(), textEn: "" }] : []),
      ...(effectText.trim() ? [{ kind: "effect", label: "Effect", textPt: effectText.trim(), textEn: "" }] : []),
    ],
  };
}

export function extractLinkSuggestions(cards: Array<{ cardType?: string; pilotName?: string | null; nameEn?: string | null; namePt?: string | null; traits?: string[] | null }>) {
  const values = new Set<string>();
  cards.forEach((card) => {
    if (["PILOT", "COMMAND_PILOT"].includes(String(card.cardType || ""))) {
      if (card.pilotName) values.add(card.pilotName);
      if (card.namePt) values.add(card.namePt);
      if (card.nameEn) values.add(card.nameEn);
    }
    (card.traits || []).forEach((item) => values.add(`${item} trait`));
  });
  return Array.from(values).filter(Boolean).sort();
}

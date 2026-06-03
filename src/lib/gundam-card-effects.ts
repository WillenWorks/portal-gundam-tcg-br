/* Parser v9.3 — interpreta keywords oficiais entre <> e gera metadados úteis para catálogo e simulador. */

export type ParsedKeyword = {
  raw: string;
  normalized: string;
  base: string;
  value: number | null;
  kind: "trigger" | "effect";
};

export type ParsedSection = {
  label: string;
  text: string;
  keywords: ParsedKeyword[];
};

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

  const breach = upper.match(/^BREACH\s*([1-9])$/);
  if (breach) return `Breach ${breach[1]}`;

  const oncePerTurn = upper.match(/^ONCE PER TURN\s*([1-9])$/);
  if (oncePerTurn) return `Once per Turn ${oncePerTurn[1]}`;

  const activateMain = upper.match(/^ACTIVATE[\s-]*MAIN\s*([1-9])$/);
  if (activateMain) return `Activate Main ${activateMain[1]}`;

  const activateAction = upper.match(/^ACTIVATE[\s-]*ACTION\s*([1-9])$/);
  if (activateAction) return `Activate Action ${activateAction[1]}`;

  if (upper === "REPAIR") return "Repair";

  return cleaned;
}

function splitKeywordValue(normalized: string): { base: string; value: number | null } {
  const match = normalized.match(/^(Repair|Breach|Once per Turn|Activate Main|Activate Action)\s+([1-9])$/);
  if (match) {
    return {
      base: match[1],
      value: Number(match[2]),
    };
  }

  return {
    base: normalized,
    value: null,
  };
}

function classifyKeyword(base: string): "trigger" | "effect" {
  if (TRIGGER_SET.has(base)) return "trigger";
  return "effect";
}

function extractKeywordsFromText(text: string): ParsedKeyword[] {
  const matches = Array.from(text.matchAll(/<([^>]+)>/g));

  return matches
    .map((match) => normalizeKeywordToken(match[1] || ""))
    .filter(Boolean)
    .map((normalized) => {
      const { base, value } = splitKeywordValue(normalized);
      return {
        raw: normalized,
        normalized,
        base,
        value,
        kind: classifyKeyword(base),
      } satisfies ParsedKeyword;
    });
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueKeywordObjects(values: ParsedKeyword[]) {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = `${item.kind}:${item.normalized}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSections(effectText: string, burstText: string): ParsedSection[] {
  const sections: ParsedSection[] = [];

  if (burstText.trim()) {
    sections.push({
      label: "Burst",
      text: burstText.trim(),
      keywords: extractKeywordsFromText(burstText),
    });
  }

  if (effectText.trim()) {
    const lines = effectText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return sections;

    for (const line of lines) {
      sections.push({
        label: "Effect",
        text: line,
        keywords: extractKeywordsFromText(line),
      });
    }
  }

  return sections;
}

export function parseCardEffects(effectText: string, burstText: string) {
  const sections = buildSections(effectText, burstText);

  const nativeKeywords = uniqueKeywordObjects(
    sections.flatMap((section) => section.keywords.filter((keyword) => {
      const text = section.text.trim();
      const token = keyword.raw;
      return text === `<${token}>` || text.startsWith(`<${token}> `) || text.startsWith(`<${token}>.`);
    })),
  );

  const conditionalKeywords = uniqueKeywordObjects(
    sections.flatMap((section) => section.keywords.filter((keyword) => {
      const text = section.text.trim();
      const token = keyword.raw;
      return !(text === `<${token}>` || text.startsWith(`<${token}> `) || text.startsWith(`<${token}>.`));
    })),
  );

  const allKeywords = uniqueKeywordObjects(sections.flatMap((section) => section.keywords));

  const triggerKeywords = uniqueStrings(allKeywords.filter((item) => item.kind === "trigger").map((item) => item.normalized));
  const effectKeywords = uniqueStrings(allKeywords.filter((item) => item.kind === "effect").map((item) => item.normalized));
  const keywordTags = uniqueStrings(allKeywords.map((item) => item.normalized));

  const nativeKeywordTags = uniqueStrings(nativeKeywords.map((item) => item.normalized));
  const conditionalKeywordTags = uniqueStrings(conditionalKeywords.map((item) => item.normalized));

  return {
    triggerKeywords,
    effectKeywords,
    keywordTags,

    nativeKeywordTags,
    conditionalKeywordTags,

    keywordMeta: allKeywords.map((item) => ({
      keyword: item.normalized,
      base: item.base,
      value: item.value,
      kind: item.kind,
      native: nativeKeywordTags.includes(item.normalized),
      conditional: conditionalKeywordTags.includes(item.normalized),
    })),

    hasBurst: burstText.trim().length > 0 || keywordTags.some((item) => item.startsWith("Burst")),
    hasMain: keywordTags.some((item) => item === "Main" || item.startsWith("Activate Main")),
    hasAction: keywordTags.some((item) => item === "Action" || item.startsWith("Activate Action")),
    oncePerTurn: keywordTags.some((item) => item.startsWith("Once per Turn")),

    sections: [
      ...(burstText.trim()
        ? [{ kind: "burst", label: "Burst", textPt: burstText.trim(), textEn: "" }]
        : []),
      ...(effectText.trim()
        ? [{ kind: "effect", label: "Effect", textPt: effectText.trim(), textEn: "" }]
        : []),
    ],

    sectionMeta: sections.map((section) => ({
      label: section.label,
      text: section.text,
      keywords: section.keywords.map((item) => ({
        keyword: item.normalized,
        base: item.base,
        value: item.value,
        kind: item.kind,
      })),
    })),
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

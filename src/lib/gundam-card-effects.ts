/* Parser v9.4 — interpreta tags de carta, identidade visual/semântica e metadados úteis para simulador. */

export type ParsedKeyword = {
  raw: string;
  normalized: string;
  base: string;
  value: number | null;
  qualifier: string | null;
  kind: "trigger" | "effect";
  delimiter: "angle" | "square";
  native: boolean;
  style: {
    shape: "diamond" | "square";
    tone: "neutral" | "pink" | "blue" | "blueGreen" | "yellow" | "red";
  };
};

export type ParsedSection = {
  label: string;
  text: string;
  keywords: ParsedKeyword[];
};

const BASE_KEYWORDS = [
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
] as const;

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

const ANGLE_EFFECT_SET = new Set([
  "Repair",
  "Suppression",
  "Blocker",
  "Breach",
  "First Strike",
  "High-Maneuver",
  "Support",
  "Raid",
  "Link",
]);

function normalizeKeywordToken(raw: string) {
  const cleaned = raw
    .replace(/[【】<>[\]]/g, "")
    .replace(/[･·]/g, " · ")
    .replace(/[_-]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const upper = cleaned.toUpperCase();
  if (!upper) return "";

  if (upper.startsWith("HIGH MANOUVER") || upper.startsWith("HIGH-MANOUVER") || upper.startsWith("HIGH MANEUVER") || upper.startsWith("HIGH-MANEUVER")) return cleaned.replace(/^[^·]+/, "High-Maneuver");
  if (upper.startsWith("SUPRESSION") || upper.startsWith("SUPPRESSION")) return cleaned.replace(/^[^·]+/, "Suppression");
  if (upper.startsWith("BLOCKER")) return cleaned.replace(/^[^·]+/, "Blocker");
  if (upper.startsWith("BREACH")) return cleaned.replace(/^[^·]+/, cleaned.match(/^\s*Breach\s*[1-9]?/i)?.[0]?.trim() || "Breach");
  if (upper.startsWith("RAID")) return cleaned.replace(/^[^·]+/, "Raid");
  if (upper.startsWith("SUPPORT")) return cleaned.replace(/^[^·]+/, "Support");
  if (upper.startsWith("FIRST STRIKE")) return cleaned.replace(/^[^·]+/, "First Strike");
  if (upper.startsWith("LINK")) return cleaned.replace(/^[^·]+/, "Link");
  if (upper.startsWith("BURST")) return cleaned.replace(/^[^·]+/, "Burst");
  if (upper.startsWith("DEPLOY")) return cleaned.replace(/^[^·]+/, "Deploy");
  if (upper.startsWith("ATTACK")) return cleaned.replace(/^[^·]+/, "Attack");
  if (upper.startsWith("DESTROYED")) return cleaned.replace(/^[^·]+/, "Destroyed");
  if (upper.startsWith("WHEN PAIRED")) return cleaned.replace(/^[^·]+/, "When Paired");
  if (upper.startsWith("WHILE PAIRED") || upper.startsWith("DURING PAIR")) return cleaned.replace(/^[^·]+/, "During Pair");
  if (upper.startsWith("WHEN LINKED")) return cleaned.replace(/^[^·]+/, "When Linked");
  if (upper.startsWith("DURING LINK")) return cleaned.replace(/^[^·]+/, "During Link");
  if (upper.startsWith("MAIN")) return cleaned.replace(/^[^·]+/, "Main");
  if (upper.startsWith("ACTION")) return cleaned.replace(/^[^·]+/, "Action");
  if (upper.startsWith("ACTIVATE MAIN") || upper.startsWith("ACTIVATE-MAIN")) return cleaned.replace(/^[^·]+/, cleaned.match(/^\s*Activate(?:\s|-)*Main\s*[1-9]?/i)?.[0]?.replace(/(?:\s|-)+/g, " ").trim() || "Activate Main");
  if (upper.startsWith("ACTIVATE ACTION") || upper.startsWith("ACTIVATE-ACTION")) return cleaned.replace(/^[^·]+/, cleaned.match(/^\s*Activate(?:\s|-)*Action\s*[1-9]?/i)?.[0]?.replace(/(?:\s|-)+/g, " ").trim() || "Activate Action");
  if (upper.startsWith("ONCE PER TURN")) return cleaned.replace(/^[^·]+/, cleaned.match(/^\s*Once\s+Per\s+Turn\s*[1-9]?/i)?.[0]?.trim() || "Once per Turn");
  if (upper.startsWith("REPAIR")) return cleaned.replace(/^[^·]+/, cleaned.match(/^\s*Repair\s*[1-9]?/i)?.[0]?.trim() || "Repair");

  return cleaned;
}

function splitKeywordValueAndQualifier(normalized: string): { base: string; value: number | null; qualifier: string | null } {
  const patterns = [
    /^(Repair)\s+([1-9])(?:\s*·\s*(.+))?$/i,
    /^(Breach)\s+([1-9])(?:\s*·\s*(.+))?$/i,
    /^(Once per Turn)\s+([1-9])(?:\s*·\s*(.+))?$/i,
    /^(Activate Main)\s+([1-9])(?:\s*·\s*(.+))?$/i,
    /^(Activate Action)\s+([1-9])(?:\s*·\s*(.+))?$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return {
        base: match[1],
        value: Number(match[2]),
        qualifier: match[3]?.trim() || null,
      };
    }
  }

  for (const base of BASE_KEYWORDS) {
    const regex = new RegExp(`^${base.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(?:\\s*·\\s*(.+))?$`, "i");
    const match = normalized.match(regex);
    if (match) {
      return {
        base,
        value: null,
        qualifier: match[1]?.trim() || null,
      };
    }
  }

  return {
    base: normalized,
    value: null,
    qualifier: null,
  };
}

function classifyKeyword(base: string): "trigger" | "effect" {
  return TRIGGER_SET.has(base) ? "trigger" : "effect";
}

export function getKeywordStyle(base: string, delimiter: "angle" | "square") {
  if (delimiter === "angle" || ANGLE_EFFECT_SET.has(base)) return { shape: "diamond", tone: "neutral" } as const;
  if (base === "When Paired" || base === "During Pair") return { shape: "square", tone: "pink" } as const;
  if (base === "Deploy" || base === "Attack" || base === "Destroyed") return { shape: "square", tone: "blueGreen" } as const;
  if (base === "When Linked" || base === "During Link") return { shape: "square", tone: "yellow" } as const;
  if (base === "Activate Main" || base === "Activate Action" || base === "Main" || base === "Action") return { shape: "square", tone: "blue" } as const;
  if (base === "Once per Turn") return { shape: "square", tone: "red" } as const;
  return { shape: delimiter === "square" ? "square" : "diamond", tone: "neutral" } as const;
}

function extractKeywordsFromText(text: string): ParsedKeyword[] {
  const matches = Array.from(text.matchAll(/<([^>]+)>|\[([^\]]+)\]|【([^】]+)】/g));

  return matches
    .map((match) => {
      const rawInside = match[1] || match[2] || match[3] || "";
      const delimiter: "angle" | "square" = match[1] ? "angle" : "square";
      const normalized = normalizeKeywordToken(rawInside);
      if (!normalized) return null;
      const { base, value, qualifier } = splitKeywordValueAndQualifier(normalized);
      const style = getKeywordStyle(base, delimiter);
      return {
        raw: rawInside.trim(),
        normalized,
        base,
        value,
        qualifier,
        kind: classifyKeyword(base),
        delimiter,
        native: false,
        style,
      } satisfies ParsedKeyword;
    })
    .filter(Boolean) as ParsedKeyword[];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueKeywordObjects(values: ParsedKeyword[]) {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = `${item.kind}:${item.normalized}:${item.delimiter}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSections(effectText: string, burstText: string): ParsedSection[] {
  const sections: ParsedSection[] = [];

  if (burstText.trim()) {
    sections.push({ label: "Burst", text: burstText.trim(), keywords: extractKeywordsFromText(burstText) });
  }

  if (effectText.trim()) {
    const lines = effectText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      sections.push({ label: "Effect", text: line, keywords: extractKeywordsFromText(line) });
    }
  }

  return sections;
}

function isNativeKeywordInSection(section: ParsedSection, keyword: ParsedKeyword) {
  const text = section.text.trim();
  const opening = keyword.delimiter === "angle" ? "<" : "[";
  const closing = keyword.delimiter === "angle" ? ">" : "]";
  const token = `${opening}${keyword.raw}${closing}`;
  return text === token || text.startsWith(`${token} `) || text.startsWith(`${token}.`) || text.startsWith(`${token}:`) || text.startsWith(`${token}・`) || text.startsWith(`${token}·`);
}

function buildLinkRequirementSummary(keywords: ParsedKeyword[]) {
  return keywords
    .filter((item) => ["When Paired", "During Pair", "When Linked", "During Link"].includes(item.base) && item.qualifier)
    .map((item) => ({ keyword: item.base, qualifier: item.qualifier }))
    .filter((item, index, array) => array.findIndex((other) => other.keyword === item.keyword && other.qualifier === item.qualifier) === index);
}

export function parseCardEffects(effectText: string, burstText: string) {
  const sections = buildSections(effectText, burstText);

  const nativeKeywords = uniqueKeywordObjects(
    sections.flatMap((section) => section.keywords.filter((keyword) => isNativeKeywordInSection(section, keyword))).map((item) => ({ ...item, native: true })),
  );

  const conditionalKeywords = uniqueKeywordObjects(
    sections.flatMap((section) => section.keywords.filter((keyword) => !isNativeKeywordInSection(section, keyword))).map((item) => ({ ...item, native: false })),
  );

  const allKeywords = uniqueKeywordObjects(
    sections.flatMap((section) => section.keywords).map((item) => ({
      ...item,
      native: nativeKeywords.some((native) => native.normalized === item.normalized && native.delimiter === item.delimiter),
    })),
  );

  const triggerKeywords = uniqueStrings(allKeywords.filter((item) => item.kind === "trigger").map((item) => item.normalized));
  const effectKeywords = uniqueStrings(allKeywords.filter((item) => item.kind === "effect").map((item) => item.normalized));
  const keywordTags = uniqueStrings(allKeywords.map((item) => item.normalized));
  const nativeKeywordTags = uniqueStrings(nativeKeywords.map((item) => item.normalized));
  const conditionalKeywordTags = uniqueStrings(conditionalKeywords.map((item) => item.normalized));
  const linkRequirements = buildLinkRequirementSummary(allKeywords);

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
      qualifier: item.qualifier,
      kind: item.kind,
      delimiter: item.delimiter,
      native: item.native,
      conditional: !item.native,
      style: item.style,
    })),
    hasBurst: burstText.trim().length > 0 || keywordTags.some((item) => item.startsWith("Burst")),
    hasMain: keywordTags.some((item) => item === "Main" || item.startsWith("Activate Main")),
    hasAction: keywordTags.some((item) => item === "Action" || item.startsWith("Activate Action")),
    oncePerTurn: keywordTags.some((item) => item.startsWith("Once per Turn")),
    sections: [
      ...(burstText.trim() ? [{ kind: "burst", label: "Burst", textPt: burstText.trim(), textEn: "" }] : []),
      ...(effectText.trim() ? [{ kind: "effect", label: "Effect", textPt: effectText.trim(), textEn: "" }] : []),
    ],
    sectionMeta: sections.map((section) => ({
      label: section.label,
      text: section.text,
      keywords: section.keywords.map((item) => ({
        keyword: item.normalized,
        base: item.base,
        value: item.value,
        qualifier: item.qualifier,
        kind: item.kind,
        delimiter: item.delimiter,
        style: item.style,
      })),
    })),
    linkRequirements,
  };
}

function normalizeTraitForSuggestion(value: string) {
  return value
    .replace(/[()]/g, "")
    .split(/[;,/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function extractLinkSuggestions(cards: Array<{ cardType?: string; pilotName?: string | null; nameEn?: string | null; namePt?: string | null; traits?: string[] | null; keywordMeta?: Array<{ qualifier?: string | null }> | null }>) {
  const values = new Set<string>();

  cards.forEach((card) => {
    if (["PILOT", "COMMAND_PILOT"].includes(String(card.cardType || ""))) {
      if (card.pilotName) values.add(card.pilotName);
      if (card.namePt) values.add(card.namePt);
      if (card.nameEn) values.add(card.nameEn);
    }

    (card.traits || []).forEach((item) => {
      normalizeTraitForSuggestion(item).forEach((trait) => values.add(`${trait} trait`));
    });

    (card.keywordMeta || []).forEach((item) => {
      if (!item?.qualifier) return;
      normalizeTraitForSuggestion(item.qualifier).forEach((qualifier) => {
        if (/pilot$/i.test(qualifier)) values.add(qualifier);
        else values.add(`${qualifier} trait`);
      });
    });
  });

  return Array.from(values).filter(Boolean).sort();
}

export function getKeywordIcon(keyword: { base?: string; delimiter?: "angle" | "square"; style?: { shape: "diamond" | "square"; tone: string } } | string) {
  const style = typeof keyword === "string"
    ? getKeywordStyle(keyword, ANGLE_EFFECT_SET.has(keyword) ? "angle" : "square")
    : (keyword.style || getKeywordStyle(keyword.base || "", keyword.delimiter || "square"));
  return style.shape === "diamond" ? "◆" : "■";
}

export function getKeywordStyleClass(keyword: { base?: string; delimiter?: "angle" | "square"; style?: { shape: "diamond" | "square"; tone: string } } | string) {
  const style = typeof keyword === "string" ? getKeywordStyle(keyword, ANGLE_EFFECT_SET.has(keyword) ? "angle" : "square") : (keyword.style || getKeywordStyle(keyword.base || "", keyword.delimiter || "square"));
  return style.tone === "pink"
    ? "border-fuchsia-200/80 bg-fuchsia-300 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
    : style.tone === "blueGreen"
      ? "border-cyan-200/80 bg-cyan-300 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]"
      : style.tone === "yellow"
        ? "border-yellow-200/90 bg-yellow-300 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
        : style.tone === "blue"
          ? "border-sky-200/80 bg-sky-300 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]"
          : style.tone === "red"
            ? "border-red-300/90 bg-red-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
            : "border-white/20 bg-slate-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]";
}

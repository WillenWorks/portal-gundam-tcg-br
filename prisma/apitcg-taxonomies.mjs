/* Taxonomias derivadas do catálogo API TCG e mídias curadas pelo projeto. */
import { TaxonomyKind } from "@prisma/client";

export const CURATED_SOURCE_TITLES = [
  { name: "Mobile Suit Gundam SEED" },
  { name: "Mobile Suit Gundam Unicorn" },
  { name: "Mobile Suit Gundam" },
  { name: "Mobile Suit Gundam Wing" },
  { name: "Mobile Suit Gundam: The Witch from Mercury" },
  { name: "Mobile Suit Gundam: Iron-Blooded Orphans", aliases: ["Mobile Suit Gundam IRON-BLOODED ORPHANS"] },
  { name: "Mobile Suit Gundam GQuuuuuuX" },
  { name: "Mobile Suit Gundam: Hathaway's Flash" },
  { name: "Mobile Suit Gundam 00" },
  { name: "Mobile Suit Gundam: Iron-Blooded Orphans Urdr-Hunt" },
  { name: "Mobile Suit Gundam 0080: War in the Pocket" },
  { name: "Mobile Suit Victory Gundam" },
  { name: "Turn A Gundam" },
  { name: "Mobile Fighter G Gundam" },
  { name: "Mobile Suit Gundam SEED Destiny" },
  { name: "Mobile Suit Gundam Wing: Endless Waltz" },
  { name: "Mobile Suit Gundam Char's Counterattack" },
];

const TRAIT_ALIASES = new Map([
  ["Cyber Newtype", "Cyber-Newtype"],
  ["CyberNewtype", "Cyber-Newtype"],
]);

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function traitsFrom(value) {
  const raw = String(value || "").trim();
  const parenthesized = Array.from(raw.matchAll(/\(([^)]+)\)/g), (match) => match[1].trim()).filter(Boolean);
  return parenthesized.length ? parenthesized : raw ? [raw] : [];
}

function buildTraitEntries(dataset) {
  const entries = new Map();
  for (const card of dataset.cards || []) {
    if (!card.attributes?.CardType) continue;
    for (const rawTrait of traitsFrom(card.attributes?.Trait)) {
      const trimmed = rawTrait.trim();
      if (!trimmed || trimmed === "-") continue;
      const canonicalName = TRAIT_ALIASES.get(trimmed) || trimmed;
      const current = entries.get(canonicalName) || { name: canonicalName, aliases: new Set(), cardCount: 0 };
      current.cardCount += 1;
      if (trimmed !== canonicalName) current.aliases.add(trimmed);
      entries.set(canonicalName, current);
    }
  }
  return Array.from(entries.values()).sort((a, b) => a.name.localeCompare(b.name, "en"));
}

async function upsertTaxonomy(prisma, { kind, name, aliases = [], metadataJson }) {
  const existing = await prisma.taxonomyEntry.findFirst({
    where: {
      kind,
      OR: [{ name }, { slug: slugify(name) }],
    },
  });
  const data = {
    kind,
    name,
    slug: slugify(name),
    metadataJson,
    isActive: true,
    deletedAt: null,
  };
  if (existing) {
    await prisma.taxonomyEntry.update({
      where: { id: existing.id },
      data: {
        ...data,
        description: existing.description,
      },
    });
    return { created: false, aliases };
  }
  await prisma.taxonomyEntry.create({ data });
  return { created: true, aliases };
}

export async function seedApiTcgTaxonomies(prisma, dataset) {
  const traits = buildTraitEntries(dataset);
  let createdTraits = 0;
  let createdSourceTitles = 0;

  for (const trait of traits) {
    const result = await upsertTaxonomy(prisma, {
      kind: TaxonomyKind.TRAIT,
      name: trait.name,
      aliases: Array.from(trait.aliases).sort(),
      metadataJson: {
        source: "API TCG dataset",
        origin: "attributes.Trait",
        aliases: Array.from(trait.aliases).sort(),
        cardCount: trait.cardCount,
      },
    });
    if (result.created) createdTraits += 1;
  }

  for (const media of CURATED_SOURCE_TITLES) {
    const result = await upsertTaxonomy(prisma, {
      kind: TaxonomyKind.SOURCE_TITLE,
      name: media.name,
      aliases: media.aliases || [],
      metadataJson: {
        source: "Projeto — lista curada",
        aliases: media.aliases || [],
        verified: false,
        note: "Cadastro de referência. O vínculo mídia-carta exige curadoria posterior.",
      },
    });
    if (result.created) createdSourceTitles += 1;
  }

  return {
    traits: traits.length,
    sourceTitles: CURATED_SOURCE_TITLES.length,
    createdTraits,
    createdSourceTitles,
  };
}

export function inspectApiTcgTaxonomies(dataset) {
  const traits = buildTraitEntries(dataset);
  return {
    traits: traits.length,
    sourceTitles: CURATED_SOURCE_TITLES.length,
    aliases: traits.reduce((total, trait) => total + trait.aliases.size, 0),
  };
}

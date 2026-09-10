import type { PrismaClient } from "@prisma/client";
import { classifyMetaCard, computePairwiseLift, computeSlotRigidity } from "../src/lib/meta-analytics.ts";
import { NON_STATS_SECTIONS, NON_STATS_CARD_TYPES } from "../src/lib/deck-legality.ts";
import { VALIDATED_DECKS } from "../src/modules/simulator/content/validatedDecks.ts";

export interface SignatureCardInfo {
  id: string;
  code: string;
  name: string;
  namePt: string | null;
  nameEn: string;
  imageUrl: string | null;
  imageMediumUrl: string | null;
  color: string | null;
  rarity: string | null;
  cost: number | null;
  level: number | null;
  cardType: string;
}

export interface ArchetypeSummary {
  key: string;
  name: string;
  colors: string[];
  signatureCard: SignatureCardInfo;
  deckCount: number;
  share: number;
}

export interface ClassifiedMetaCard {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  namePt: string | null;
  imageUrl: string | null;
  imageMediumUrl: string | null;
  color: string | null;
  cardType: string;
  rarity: string | null;
  cost: number | null;
  level: number | null;
  traits: string[];
  inclusionRate: number; // 0..1
  colorInclusionRate: number; // 0..1
  affinity: number; // ratio
  meanCopies: number;
  stdDevCopies: number;
  modeCopies: number;
  slotRigidity: number; // 0..1
  quadrant: "CORE" | "STAPLE" | "FLEX" | "TECH";
}

interface RawDeckData {
  id: string;
  name: string;
  items: Array<{
    quantity: number;
    card: {
      id: string;
      code: string;
      nameEn: string;
      namePt: string | null;
      imageUrl: string | null;
      imageMediumUrl: string | null;
      color: string | null;
      cardType: string;
      rarity: string | null;
      cost: number | null;
      level: number | null;
      traits: string[];
    };
  }>;
}

/**
 * Carrega todos os decks elegíveis para análise de metagame.
 * Combina decks públicos do banco com os decks oficiais validados (ST01-ST04)
 * para garantir amostragem estatística mesmo em ambientes locais com poucos dados.
 */
async function fetchEligibleDecks(prisma: PrismaClient): Promise<RawDeckData[]> {
  const publicDecks = await prisma.deck.findMany({
    where: { visibility: "PUBLIC" },
    include: {
      items: {
        where: { section: "main" },
        include: {
          card: {
            select: {
              id: true,
              code: true,
              nameEn: true,
              namePt: true,
              imageUrl: true,
              imageMediumUrl: true,
              color: true,
              cardType: true,
              rarity: true,
              cost: true,
              level: true,
              traits: true,
            },
          },
        },
      },
    },
  });

  const eligible: RawDeckData[] = publicDecks.map((d) => ({
    id: d.id,
    name: d.name,
    items: d.items
      .filter((i) => !NON_STATS_SECTIONS.includes(i.section as any) && !NON_STATS_CARD_TYPES.includes(i.card.cardType as any))
      .map((i) => ({ quantity: i.quantity, card: i.card })),
  })).filter((d) => d.items.length > 0);

  // Se houver menos de 4 decks no banco, complementa com os decks validados do simulador
  if (eligible.length < 4) {
    for (const starter of Object.values(VALIDATED_DECKS)) {
      const existing = eligible.find((d) => d.name === starter.label);
      if (!existing) {
        const deckList = starter.build();
        const mainCards = deckList.main || [];
        const countMap = new Map<string, number>();
        for (const c of mainCards) {
          countMap.set(c.code, (countMap.get(c.code) || 0) + 1);
        }
        const codes = Array.from(countMap.keys());
        const cardsFound = await prisma.card.findMany({
          where: { code: { in: codes } },
          distinct: ["code"],
        });
        const cardMap = new Map(cardsFound.map((c) => [c.code, c]));
        const items: RawDeckData["items"] = [];

        for (const [code, count] of countMap.entries()) {
          const card = cardMap.get(code);
          if (card) {
            items.push({
              quantity: count,
              card: {
                id: card.id,
                code: card.code,
                nameEn: card.nameEn,
                namePt: card.namePt,
                imageUrl: card.imageMediumUrl || card.imageUrl,
                imageMediumUrl: card.imageMediumUrl || card.imageUrl,
                color: card.color,
                cardType: card.cardType,
                rarity: card.rarity,
                cost: card.cost,
                level: card.level,
                traits: card.traits,
              },
            });
          }
        }

        if (items.length > 0) {
          eligible.push({
            id: `validated-${starter.id}`,
            name: starter.label,
            items,
          });
        }
      }
    }
  }

  return eligible;
}

/**
 * Extrai a assinatura do arquétipo (cores + carta de maior destaque).
 */
function identifyDeckArchetype(deck: RawDeckData): {
  archetypeKey: string;
  archetypeName: string;
  colors: string[];
  signatureCard: SignatureCardInfo;
} {
  const colorSet = new Set<string>();
  deck.items.forEach((item) => {
    if (item.card.color) colorSet.add(item.card.color);
  });
  const colors = Array.from(colorSet).sort();

  // Encontra a melhor carta assinatura:
  // 1. Unidade LR de maior custo/nível
  // 2. Unidade de maior raridade/custo
  // 3. Carta com mais cópias
  const units = deck.items
    .filter((i) => i.card.cardType === "UNIT")
    .sort((a, b) => {
      const isLrA = (a.card.rarity || "").includes("LR") || (a.card.rarity || "").includes("Legend");
      const isLrB = (b.card.rarity || "").includes("LR") || (b.card.rarity || "").includes("Legend");
      if (isLrA && !isLrB) return -1;
      if (!isLrA && isLrB) return 1;
      const rA = (a.card.rarity || "").includes("R") ? 2 : 1;
      const rB = (b.card.rarity || "").includes("R") ? 2 : 1;
      if (rA !== rB) return rB - rA;
      return (b.card.cost ?? 0) - (a.card.cost ?? 0) || b.quantity - a.quantity;
    });

  const bestItem = units[0] || deck.items[0];
  const sig = bestItem.card;
  const sigInfo: SignatureCardInfo = {
    id: sig.id,
    code: sig.code,
    name: sig.namePt || sig.nameEn,
    namePt: sig.namePt,
    nameEn: sig.nameEn,
    imageUrl: sig.imageMediumUrl || sig.imageUrl,
    imageMediumUrl: sig.imageMediumUrl || sig.imageUrl,
    color: sig.color,
    rarity: sig.rarity,
    cost: sig.cost,
    level: sig.level,
    cardType: sig.cardType,
  };

  const colorTag = colors.length ? colors.join("/") : "Neutral";
  const archetypeKey = `${sig.code}||${colors.join(",")}`;
  const archetypeName = `${sigInfo.name} (${colorTag})`;

  return { archetypeKey, archetypeName, colors, signatureCard: sigInfo };
}

/**
 * Obtém a lista consolidada de arquétipos do metagame com contagem e share.
 */
export async function getMetaArchetypes(prisma: PrismaClient): Promise<ArchetypeSummary[]> {
  const decks = await fetchEligibleDecks(prisma);
  if (!decks.length) return [];

  const archetypeMap = new Map<string, {
    name: string;
    colors: string[];
    signatureCard: SignatureCardInfo;
    decks: RawDeckData[];
  }>();

  for (const deck of decks) {
    const { archetypeKey, archetypeName, colors, signatureCard } = identifyDeckArchetype(deck);
    const existing = archetypeMap.get(archetypeKey);
    if (!existing) {
      archetypeMap.set(archetypeKey, {
        name: archetypeName,
        colors,
        signatureCard,
        decks: [deck],
      });
    } else {
      existing.decks.push(deck);
    }
  }

  const totalDecks = decks.length;
  const summaries: ArchetypeSummary[] = Array.from(archetypeMap.entries()).map(([key, data]) => ({
    key,
    name: data.name,
    colors: data.colors,
    signatureCard: data.signatureCard,
    deckCount: data.decks.length,
    share: Number((data.decks.length / totalDecks).toFixed(4)),
  }));

  return summaries.sort((a, b) => b.deckCount - a.deckCount);
}

/**
 * Realiza a análise estatística profunda de um arquétipo específico,
 * classificando todas as cartas em Core, Staples, Flex e Techs.
 */
export async function getArchetypeBreakdown(
  prisma: PrismaClient,
  archetypeKey: string,
): Promise<{
  summary: ArchetypeSummary;
  core: ClassifiedMetaCard[];
  staples: ClassifiedMetaCard[];
  flex: ClassifiedMetaCard[];
  techs: ClassifiedMetaCard[];
} | null> {
  const allDecks = await fetchEligibleDecks(prisma);
  if (!allDecks.length) return null;

  // Separa os decks do arquétipo
  const archetypeDecks: RawDeckData[] = [];
  let detectedInfo: ReturnType<typeof identifyDeckArchetype> | null = null;

  for (const deck of allDecks) {
    const info = identifyDeckArchetype(deck);
    if (info.archetypeKey === archetypeKey) {
      archetypeDecks.push(deck);
      if (!detectedInfo) detectedInfo = info;
    }
  }

  if (!archetypeDecks.length || !detectedInfo) return null;

  const totalArchetypeDecks = archetypeDecks.length;
  const archetypeColors = new Set(detectedInfo.colors);

  // Decks que compartilham pelo menos uma cor com o arquétipo
  const colorDecks = allDecks.filter((d) =>
    d.items.some((i) => i.card.color && archetypeColors.has(i.card.color)),
  );
  const totalColorDecks = Math.max(1, colorDecks.length);

  // Mapeamento das cartas no arquétipo
  const cardDataMap = new Map<string, {
    card: RawDeckData["items"][0]["card"];
    quantitiesInArchetype: number[];
  }>();

  for (const deck of archetypeDecks) {
    for (const item of deck.items) {
      const code = item.card.code;
      const existing = cardDataMap.get(code);
      if (!existing) {
        cardDataMap.set(code, {
          card: item.card,
          quantitiesInArchetype: [item.quantity],
        });
      } else {
        existing.quantitiesInArchetype.push(item.quantity);
      }
    }
  }

  // Presença global na cor
  const colorCardDeckCount = new Map<string, number>();
  for (const deck of colorDecks) {
    const seenInDeck = new Set<string>();
    for (const item of deck.items) {
      seenInDeck.add(item.card.code);
    }
    for (const code of seenInDeck) {
      colorCardDeckCount.set(code, (colorCardDeckCount.get(code) || 0) + 1);
    }
  }

  const classifiedCards: ClassifiedMetaCard[] = [];

  for (const [code, { card, quantitiesInArchetype }] of cardDataMap.entries()) {
    const decksWithCardInArch = quantitiesInArchetype.length;
    const inclusionRate = decksWithCardInArch / totalArchetypeDecks;

    const decksWithCardInColor = colorCardDeckCount.get(code) || decksWithCardInArch;
    const colorInclusionRate = decksWithCardInColor / totalColorDecks;

    const affinity = Number((inclusionRate / Math.max(0.05, colorInclusionRate)).toFixed(2));

    // Média de cópias
    const sum = quantitiesInArchetype.reduce((acc, q) => acc + q, 0);
    const meanCopies = Number((sum / decksWithCardInArch).toFixed(1));

    // Desvio padrão
    const variance =
      quantitiesInArchetype.reduce((acc, q) => acc + Math.pow(q - meanCopies, 2), 0) /
      decksWithCardInArch;
    const stdDevCopies = Number(Math.sqrt(variance).toFixed(2));

    // Moda
    const freq = new Map<number, number>();
    quantitiesInArchetype.forEach((q) => freq.set(q, (freq.get(q) || 0) + 1));
    let modeCopies = 4;
    let maxFreq = 0;
    freq.forEach((count, q) => {
      if (count > maxFreq) {
        maxFreq = count;
        modeCopies = q;
      }
    });

    const slotRigidity = computeSlotRigidity(meanCopies, stdDevCopies);

    const quadrant = classifyMetaCard({
      inclusionRate,
      affinity,
      colorInclusionRate,
      meanCopies,
      stdDevCopies,
    });

    classifiedCards.push({
      id: card.id,
      code: card.code,
      name: card.namePt || card.nameEn,
      nameEn: card.nameEn,
      namePt: card.namePt,
      imageUrl: card.imageMediumUrl || card.imageUrl,
      imageMediumUrl: card.imageMediumUrl || card.imageUrl,
      color: card.color,
      cardType: card.cardType,
      rarity: card.rarity,
      cost: card.cost,
      level: card.level,
      traits: card.traits || [],
      inclusionRate: Number(inclusionRate.toFixed(4)),
      colorInclusionRate: Number(colorInclusionRate.toFixed(4)),
      affinity,
      meanCopies,
      stdDevCopies,
      modeCopies,
      slotRigidity,
      quadrant,
    });
  }

  // Separação em 4 listas organizadas
  const core = classifiedCards.filter((c) => c.quadrant === "CORE").sort((a, b) => b.inclusionRate - a.inclusionRate || b.affinity - a.affinity);
  const staples = classifiedCards.filter((c) => c.quadrant === "STAPLE").sort((a, b) => b.colorInclusionRate - a.colorInclusionRate || b.inclusionRate - a.inclusionRate);
  const flex = classifiedCards.filter((c) => c.quadrant === "FLEX").sort((a, b) => b.inclusionRate - a.inclusionRate);
  const techs = classifiedCards.filter((c) => c.quadrant === "TECH").sort((a, b) => b.inclusionRate - a.inclusionRate);

  const summary: ArchetypeSummary = {
    key: archetypeKey,
    name: detectedInfo.archetypeName,
    colors: detectedInfo.colors,
    signatureCard: detectedInfo.signatureCard,
    deckCount: totalArchetypeDecks,
    share: Number((totalArchetypeDecks / allDecks.length).toFixed(4)),
  };

  return { summary, core, staples, flex, techs };
}

/**
 * Gera recomendações preditivas de cartas baseadas em co-ocorrência (Lift)
 * e compensação de sinergia para o Deckbuilder.
 */
export async function getMetaRecommendations(
  prisma: PrismaClient,
  cardCodes: string[],
  colors?: string[],
): Promise<{
  synergy: ClassifiedMetaCard[];
  staples: ClassifiedMetaCard[];
  techs: ClassifiedMetaCard[];
}> {
  const allDecks = await fetchEligibleDecks(prisma);
  if (!allDecks.length) {
    return { synergy: [], staples: [], techs: [] };
  }

  const inputCodesSet = new Set(cardCodes);
  const colorFilter = colors && colors.length ? new Set(colors) : null;

  // Filtra decks relevantes (mesma cor ou que compartilham cartas)
  const candidateDecks = allDecks.filter((deck) => {
    if (colorFilter && !deck.items.some((i) => i.card.color && colorFilter.has(i.card.color))) {
      return false;
    }
    return true;
  });

  const totalCandidates = Math.max(1, candidateDecks.length);

  // Calcula frequências individuais de cada carta do input
  const inputFrequency = new Map<string, number>();
  for (const deck of candidateDecks) {
    const codesInDeck = new Set(deck.items.map((i) => i.card.code));
    for (const code of inputCodesSet) {
      if (codesInDeck.has(code)) {
        inputFrequency.set(code, (inputFrequency.get(code) || 0) + 1);
      }
    }
  }

  // Calcula co-ocorrência de outras cartas com as cartas do input
  const otherCardData = new Map<string, {
    card: RawDeckData["items"][0]["card"];
    appearances: number;
    coOccurrences: Map<string, number>;
  }>();

  for (const deck of candidateDecks) {
    const codesInDeck = new Set(deck.items.map((i) => i.card.code));
    const activeInputMatches = Array.from(inputCodesSet).filter((c) => codesInDeck.has(c));

    for (const item of deck.items) {
      const code = item.card.code;
      if (inputCodesSet.has(code)) continue; // não recomenda o que já está no deck

      let entry = otherCardData.get(code);
      if (!entry) {
        entry = {
          card: item.card,
          appearances: 0,
          coOccurrences: new Map<string, number>(),
        };
        otherCardData.set(code, entry);
      }
      entry.appearances++;

      for (const inputCode of activeInputMatches) {
        entry.coOccurrences.set(inputCode, (entry.coOccurrences.get(inputCode) || 0) + 1);
      }
    }
  }

  // Calcula o score de Lift ponderado
  const scoredCards: Array<{
    card: RawDeckData["items"][0]["card"];
    liftScore: number;
    appearances: number;
  }> = [];

  for (const [, { card, appearances, coOccurrences }] of otherCardData.entries()) {
    let totalLift = 0;
    let matchCount = 0;

    for (const [inputCode, coCount] of coOccurrences.entries()) {
      const pA = (inputFrequency.get(inputCode) || 1) / totalCandidates;
      const pB = appearances / totalCandidates;
      const pBoth = coCount / totalCandidates;
      const lift = computePairwiseLift(pBoth, pA, pB);
      totalLift += lift;
      matchCount++;
    }

    const avgLift = matchCount > 0 ? totalLift / matchCount : 1.0;
    scoredCards.push({ card, liftScore: avgLift, appearances });
  }

  // Ordena os resultados
  const synergyCards = scoredCards
    .filter((s) => s.liftScore >= 1.2)
    .sort((a, b) => b.liftScore - a.liftScore || b.appearances - a.appearances)
    .slice(0, 8)
    .map((s) => mapToClassified(s.card, s.appearances / totalCandidates, s.liftScore, "CORE"));

  const stapleCards = scoredCards
    .sort((a, b) => b.appearances - a.appearances)
    .slice(0, 8)
    .map((s) => mapToClassified(s.card, s.appearances / totalCandidates, s.liftScore, "STAPLE"));

  const techCards = scoredCards
    .filter((s) => s.appearances / totalCandidates < 0.35 && s.appearances / totalCandidates > 0.08)
    .sort((a, b) => b.liftScore - a.liftScore)
    .slice(0, 8)
    .map((s) => mapToClassified(s.card, s.appearances / totalCandidates, s.liftScore, "TECH"));

  return {
    synergy: synergyCards,
    staples: stapleCards,
    techs: techCards,
  };
}

function mapToClassified(
  card: RawDeckData["items"][0]["card"],
  inclusionRate: number,
  affinity: number,
  quadrant: ClassifiedMetaCard["quadrant"],
): ClassifiedMetaCard {
  return {
    id: card.id,
    code: card.code,
    name: card.namePt || card.nameEn,
    nameEn: card.nameEn,
    namePt: card.namePt,
    imageUrl: card.imageMediumUrl || card.imageUrl,
    imageMediumUrl: card.imageMediumUrl || card.imageUrl,
    color: card.color,
    cardType: card.cardType,
    rarity: card.rarity,
    cost: card.cost,
    level: card.level,
    traits: card.traits || [],
    inclusionRate: Number(inclusionRate.toFixed(4)),
    colorInclusionRate: Number(inclusionRate.toFixed(4)),
    affinity: Number(affinity.toFixed(2)),
    meanCopies: 3.5,
    stdDevCopies: 0.5,
    modeCopies: 4,
    slotRigidity: 0.85,
    quadrant,
  };
}

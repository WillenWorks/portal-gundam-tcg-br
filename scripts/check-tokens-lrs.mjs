import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const lrCards = await prisma.card.findMany({
    where: { rarity: { in: ['LR', 'Legend Rare', 'LR+', 'LR++'] }, cardType: 'UNIT' },
    select: { id: true, code: true, nameEn: true, namePt: true, cost: true, level: true, color: true, imageUrl: true, imageMediumUrl: true, thumbUrl: true },
    distinct: ['nameEn'],
    orderBy: { code: 'asc' },
    take: 60
  });
  console.log('Total LR Units:', lrCards.length);
  console.log('Sample LRs:', lrCards.slice(0, 5));

  // Check token cards
  const tokenCards = await prisma.card.findMany({
    where: {
      OR: [
        { nameEn: { contains: 'Token', mode: 'insensitive' } },
        { namePt: { contains: 'Token', mode: 'insensitive' } },
        { rarity: { contains: 'Token', mode: 'insensitive' } },
        { code: { contains: 'TK', mode: 'insensitive' } },
        { code: { contains: 'T0', mode: 'insensitive' } }
      ]
    },
    select: { id: true, code: true, nameEn: true, namePt: true, cardType: true, imageUrl: true, imageMediumUrl: true, thumbUrl: true, effectEn: true },
    take: 20
  });
  console.log('Token cards found:', tokenCards.length);
  console.log(tokenCards.map(c => ({ code: c.code, name: c.nameEn, type: c.cardType, img: c.imageUrl || c.imageMediumUrl })));

  // Check cards with "Token" in their effect text
  const cardsGeneratingTokens = await prisma.card.findMany({
    where: {
      OR: [
        { effectEn: { contains: 'token', mode: 'insensitive' } },
        { effectPt: { contains: 'token', mode: 'insensitive' } }
      ]
    },
    select: { code: true, nameEn: true, effectEn: true },
    take: 15
  });
  console.log('Cards with token in effect:', cardsGeneratingTokens.length);
  console.log(cardsGeneratingTokens.slice(0, 5));
}

main().finally(() => prisma.$disconnect());

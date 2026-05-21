const { PrismaClient, UserRole } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const cards = [
  {
    code: "GD01-001",
    nameEn: "Aile Strike Gundam",
    namePt: "Aile Strike Gundam",
    cardType: "Unit",
    color: "Blue",
    level: 4,
    cost: 3,
    ap: 4,
    hp: 3,
    rarity: "R",
    trait: "Earth Alliance",
    series: "Mobile Suit Gundam SEED",
    effectEn: "When deployed, draw 1 card if you control another blue card.",
    effectPt: "Ao entrar em jogo, compre 1 carta se você controla outra carta azul.",
    keywordTags: ["Breach", "Deploy"],
    imageUrl: null,
    imageSourceUrl: null,
  },
  {
    code: "GD01-014",
    nameEn: "Char's Zaku II",
    namePt: "Zaku II do Char",
    cardType: "Unit",
    color: "Red",
    level: 3,
    cost: 2,
    ap: 3,
    hp: 2,
    rarity: "R",
    trait: "Zeon",
    series: "Mobile Suit Gundam",
    effectEn: "This unit gets +1 AP while attacking alone.",
    effectPt: "Esta unidade recebe +1 AP enquanto ataca sozinha.",
    keywordTags: ["Raid"],
    imageUrl: null,
    imageSourceUrl: null,
  },
  {
    code: "GD02-004",
    nameEn: "Wing Gundam Zero",
    namePt: "Wing Gundam Zero",
    cardType: "Unit",
    color: "Green",
    level: 6,
    cost: 5,
    ap: 5,
    hp: 4,
    rarity: "LR",
    trait: "Operation Meteor",
    series: "Gundam Wing",
    effectEn: "Can attack immediately if deployed from an effect.",
    effectPt: "Pode atacar imediatamente se entrar em jogo por efeito.",
    keywordTags: ["High-Maneuver"],
    imageUrl: null,
    imageSourceUrl: null,
  },
];

const rulings = [
  {
    sourceType: "OFFICIAL_RULES",
    title: "Estrutura padrão do deck",
    questionPt: "Qual é a estrutura padrão do deck no formato construído?",
    answerPt: "O deck principal usa 50 cartas e o resource deck usa 10 cartas, respeitando restrições do formato.",
    questionEn: "What is the standard deck structure in constructed?",
    answerEn: "The main deck uses 50 cards and the resource deck uses 10 cards, respecting format restrictions.",
    examplePlayPt: "Use esta regra como validação base do deckbuilder.",
    relatedKeyword: null,
    relatedPhase: null,
    translationStatus: "reviewed",
  },
  {
    sourceType: "OFFICIAL_FAQ",
    title: "O que significa Link",
    questionPt: "Como funciona Link entre Pilot e Unit?",
    answerPt: "Link indica a relação entre Pilot e Unit e ativa benefícios conforme a carta.",
    questionEn: "How does Link work between Pilot and Unit?",
    answerEn: "Link indicates the relation between Pilot and Unit and unlocks benefits according to card text.",
    examplePlayPt: "Pareie o piloto correto para habilitar o bônus descrito.",
    relatedKeyword: "Link",
    relatedPhase: null,
    translationStatus: "reviewed",
  },
];

const tournaments = [
  {
    name: "Operation Jaburo Cup",
    season: "GD02",
    format: "constructed",
    participantCount: 48,
    dateStart: new Date("2026-04-20T00:00:00.000Z"),
  },
  {
    name: "Luna II Local Showdown",
    season: "GD02",
    format: "constructed",
    participantCount: 24,
    dateStart: new Date("2026-05-04T00:00:00.000Z"),
  },
];

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@gundambr.local";
  const password = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      displayName: "Administrador Portal BR",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  for (const card of cards) {
    await prisma.card.upsert({
      where: { code: card.code },
      update: card,
      create: card,
    });
  }

  for (const ruling of rulings) {
    const exists = await prisma.ruling.findFirst({ where: { title: ruling.title } });
    if (!exists) await prisma.ruling.create({ data: ruling });
  }

  for (const tournament of tournaments) {
    const exists = await prisma.tournament.findFirst({ where: { name: tournament.name } });
    if (!exists) await prisma.tournament.create({ data: tournament });
  }

  const starterCard = await prisma.card.findUnique({ where: { code: "GD01-001" } });
  if (starterCard) {
    const existingDeck = await prisma.deck.findFirst({ where: { userId: admin.id, name: "Aile Strike Midrange" } });
    if (!existingDeck) {
      await prisma.deck.create({
        data: {
          userId: admin.id,
          name: "Aile Strike Midrange",
          format: "constructed",
          visibility: "PRIVATE",
          isPrimary: true,
          items: {
            create: [{ cardId: starterCard.id, quantity: 4, section: "main" }],
          },
        },
      });
    }
  }

  console.log("Seed concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

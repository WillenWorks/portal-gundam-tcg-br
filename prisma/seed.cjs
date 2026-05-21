const { PrismaClient, UserRole } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const setSeeds = [
  { code: "GD01", nameEn: "Newtype Rising", namePt: "Newtype Rising", officialUrl: "https://www.gundam-gcg.com/en/cards/" },
  { code: "ST01", nameEn: "Heroic Beginnings", namePt: "Heroic Beginnings", officialUrl: "https://www.gundam-gcg.com/en/cards/" },
];

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
    thumbUrl: null,
    imageSourceUrl: null,
    officialUrl: "https://www.gundam-gcg.com/en/cards/",
    setCode: "GD01",
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
    thumbUrl: null,
    imageSourceUrl: null,
    officialUrl: "https://www.gundam-gcg.com/en/cards/",
    setCode: "GD01",
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
    thumbUrl: null,
    imageSourceUrl: null,
    officialUrl: "https://www.gundam-gcg.com/en/cards/",
    setCode: "GD01",
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
    originalUrl: "https://www.gundam-gcg.com/en/pdf/comprehensiverules_en.pdf?260515",
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
    originalUrl: "https://www.gundam-gcg.com/en/rules/faqs/",
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
    sourceUrl: "https://egmanevents.com/gundam",
    dateStart: new Date("2026-04-20T00:00:00.000Z"),
  },
  {
    name: "Luna II Local Showdown",
    season: "GD02",
    format: "constructed",
    participantCount: 24,
    sourceUrl: "https://egmanevents.com/gundam",
    dateStart: new Date("2026-05-04T00:00:00.000Z"),
  },
];

async function seedUser({ email, displayName, username, password, role, bio }) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash, displayName, username, role, bio },
    create: { email, displayName, username, passwordHash, role, bio },
  });
}

async function main() {
  const admin = await seedUser({
    email: process.env.SEED_ADMIN_EMAIL || "admin@gundambr.local",
    password: process.env.SEED_ADMIN_PASSWORD || "admin123",
    displayName: "Administrador Portal BR",
    username: "admin-portal",
    role: UserRole.ADMIN,
    bio: "Conta seed administrativa do portal.",
  });

  const user = await seedUser({
    email: "pilot@gundambr.local",
    password: "pilot123",
    displayName: "Usuário Exemplo",
    username: "pilot-example",
    role: UserRole.USER,
    bio: "Perfil seed para testar área do usuário e decks públicos.",
  });

  const setMap = {};
  for (const set of setSeeds) {
    const saved = await prisma.cardSet.upsert({ where: { code: set.code }, update: set, create: set });
    setMap[set.code] = saved.id;
  }

  for (const card of cards) {
    const { setCode, ...data } = card;
    await prisma.card.upsert({
      where: { code: card.code },
      update: { ...data, setId: setMap[setCode] },
      create: { ...data, setId: setMap[setCode] },
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
    const adminDeck = await prisma.deck.findFirst({ where: { userId: admin.id, name: "Aile Strike Midrange" } });
    if (!adminDeck) {
      await prisma.deck.create({
        data: {
          userId: admin.id,
          name: "Aile Strike Midrange",
          format: "constructed",
          visibility: "PRIVATE",
          isPrimary: true,
          notes: "Deck seed administrativo.",
          items: { create: [{ cardId: starterCard.id, quantity: 4, section: "main" }] },
        },
      });
    }

    const publicDeck = await prisma.deck.findFirst({ where: { userId: user.id, name: "Public Seed Deck" } });
    if (!publicDeck) {
      await prisma.deck.create({
        data: {
          userId: user.id,
          name: "Public Seed Deck",
          format: "constructed",
          visibility: "PUBLIC",
          isPrimary: true,
          notes: "Deck seed público para validar share link e área pública.",
          items: { create: [{ cardId: starterCard.id, quantity: 4, section: "main" }] },
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

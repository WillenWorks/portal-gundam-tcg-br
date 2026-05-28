const { PrismaClient, UserRole, CardLanguage, BinderKind, SetKind } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const setSeeds = [
  {
    code: "GD01",
    nameEn: "Newtype Rising",
    namePt: "Newtype Rising",
    officialUrl: "https://www.gundam-gcg.com/en/cards/",
    releaseDate: new Date("2025-07-12T00:00:00.000Z"),
    coverImage: null,
    shortDescription: "Primeira coleção base para testes do portal.",
    setType: SetKind.BOOSTER,
  },
  {
    code: "ST01",
    nameEn: "Heroic Beginnings",
    namePt: "Heroic Beginnings",
    officialUrl: "https://www.gundam-gcg.com/en/cards/",
    releaseDate: new Date("2025-07-12T00:00:00.000Z"),
    coverImage: null,
    shortDescription: "Starter deck introdutório com lista fixa.",
    setType: SetKind.STARTER,
  },
  {
    code: "ST02",
    nameEn: "Zeon Assault",
    namePt: "Zeon Assault",
    officialUrl: "https://www.gundam-gcg.com/en/cards/",
    releaseDate: new Date("2026-08-20T00:00:00.000Z"),
    coverImage: null,
    shortDescription: "Starter futuro para validar comunicação de lançamento.",
    setType: SetKind.STARTER,
  },
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
    code: "ST01-001",
    nameEn: "Gundam RX-78-2",
    namePt: "Gundam RX-78-2",
    cardType: "Unit",
    color: "White",
    level: 4,
    cost: 3,
    ap: 4,
    hp: 4,
    rarity: "SR",
    trait: "Federation",
    series: "Mobile Suit Gundam",
    effectEn: "When linked, this unit gains +1 HP.",
    effectPt: "Quando linkada, esta unidade recebe +1 HP.",
    keywordTags: ["Link"],
    imageUrl: null,
    thumbUrl: null,
    imageSourceUrl: null,
    officialUrl: "https://www.gundam-gcg.com/en/cards/",
    setCode: "ST01",
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

async function seedUser({ email, displayName, username, password, role, bio }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      displayName,
      username,
      role,
      bio,
      isActive: true,
      preferredCardLanguage: CardLanguage.PT_BR,
      preferredTheme: "dark",
    },
    create: {
      email,
      displayName,
      username,
      passwordHash,
      role,
      bio,
      isActive: true,
      preferredCardLanguage: CardLanguage.PT_BR,
      preferredTheme: "dark",
    },
  });

  await prisma.cardBinder.upsert({
    where: { userId_kind: { userId: user.id, kind: BinderKind.WISHLIST } },
    update: { name: "Lista de Desejos", isPublic: true },
    create: { userId: user.id, kind: BinderKind.WISHLIST, name: "Lista de Desejos", description: "Cartas que quero adquirir.", isPublic: true },
  });

  await prisma.cardBinder.upsert({
    where: { userId_kind: { userId: user.id, kind: BinderKind.OWNED } },
    update: { name: "Cartas Possuídas", isPublic: true },
    create: { userId: user.id, kind: BinderKind.OWNED, name: "Cartas Possuídas", description: "Cartas que já tenho.", isPublic: true },
  });

  return user;
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
    email: process.env.SEED_USER_EMAIL || "pilot@gundambr.local",
    password: process.env.SEED_USER_PASSWORD || "pilot123",
    displayName: "Usuário Exemplo",
    username: "pilot-example",
    role: UserRole.USER,
    bio: "Perfil seed para testar área do usuário, decks e binders compartilháveis.",
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

  const starterCard = await prisma.card.findUnique({ where: { code: "GD01-001" } });
  const starterCard2 = await prisma.card.findUnique({ where: { code: "ST01-001" } });

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
          items: {
            create: [
              { cardId: starterCard.id, quantity: 4, section: "main" },
              ...(starterCard2 ? [{ cardId: starterCard2.id, quantity: 2, section: "main" }] : []),
            ],
          },
        },
      });
    }
  }

  const wishlist = await prisma.cardBinder.findUnique({ where: { userId_kind: { userId: user.id, kind: BinderKind.WISHLIST } } });
  const owned = await prisma.cardBinder.findUnique({ where: { userId_kind: { userId: user.id, kind: BinderKind.OWNED } } });
  if (wishlist && starterCard2) {
    await prisma.cardBinderItem.upsert({
      where: { binderId_cardId: { binderId: wishlist.id, cardId: starterCard2.id } },
      update: { quantity: 1 },
      create: { binderId: wishlist.id, cardId: starterCard2.id, quantity: 1 },
    });
  }
  if (owned && starterCard) {
    await prisma.cardBinderItem.upsert({
      where: { binderId_cardId: { binderId: owned.id, cardId: starterCard.id } },
      update: { quantity: 2 },
      create: { binderId: owned.id, cardId: starterCard.id, quantity: 2 },
    });
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

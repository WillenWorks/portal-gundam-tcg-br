/* Universe Hub — Wave 1: popula TaxonomyEntry (kind=SOURCE_TITLE) com o conteúdo rico de
 * lore (sinopse, mobile suits, pilotos, curiosidades) consumido por SeriesHubPage/SeriesDetailPage.
 * `name` usa a grafia exata do dataset oficial (`sourceTitle` em data/gcg-official-cards.json)
 * pra bater com o filtro `listCards({ series })` (match exato, não fuzzy) — ver server/index.ts
 * (GET /api/cards, `media`/`series`). Rodar com: node prisma/seed-series-wave1.mjs
 */
import { PrismaClient, TaxonomyKind } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

/** @type {Array<{ name: string; description: string; coverImage?: string; officialUrl?: string; metadataJson: object }>} */
const seriesWave1 = [
  {
    name: "Mobile Suit Z Gundam",
    description:
      "Ano U.C. 0087. Um ano após a Guerra de Um Ano, a facção militar radical Titans oprime as colônias espaciais com mão de ferro. O jovem Kamille Bidan se envolve por acaso na fuga do protótipo Gundam Mk-II e acaba se juntando à AEUG, movimento de resistência liderado por Bright Noa, numa guerra que vai revelar até onde a humanidade está disposta a ir para provar sua evolução como Newtype.",
    coverImage: "/images/unicorn_blueprint_banner.png",
    officialUrl: "https://en.wikipedia.org/wiki/Mobile_Suit_Zeta_Gundam",
    metadataJson: {
      alias: "Zeta Gundam",
      era: "U.C. 0087 – 0088",
      synopsis:
        "Um ano após a Guerra de Um Ano, a organização militar Titans assume o controle da Federação Terrestre e passa a reprimir violentamente as colônias espaciais. Kamille Bidan, revoltado com a truculência dos Titans, ajuda a roubar o Gundam Mk-II e se junta à AEUG (Liga Anti-Terra), braço armado que resiste à opressão. A guerra escala rapidamente, revelando o poder dos Newtypes e o custo humano de um conflito que corrompe até os ideais mais nobres.",
      mobileSuits: [
        { name: "MSZ-006 Zeta Gundam", pilot: "Kamille Bidan", faction: "AEUG", description: "Transformável (Wave Rider), o primeiro Gundam Transformável da série — símbolo da nova geração de mobile suits." },
        { name: "RX-178 Gundam Mk-II", pilot: "Kamille Bidan / Emma Sheen", faction: "AEUG (roubado dos Titans)", description: "Protótipo desenvolvido pelos Titans, capturado no início da série e reaproveitado pela AEUG." },
        { name: "MSN-00100 Hyaku Shiki", pilot: "Quattro Bajeena (Char Aznable)", faction: "AEUG", description: "Unidade dourada de comando pilotada por Char sob o pseudônimo Quattro Bajeena." },
        { name: "PMX-003 The O", pilot: "Paptimus Scirocco", faction: "Neo Zeon / Jupitris", description: "Mobile suit de comando de Scirocco, com armamento pesado e blindagem reforçada." },
        { name: "RMS-099 Rick Dias", pilot: "Vários pilotos da AEUG", faction: "AEUG", description: "Mobile suit de produção em massa da AEUG, base tecnológica para o próprio Zeta Gundam." },
      ],
      pilots: [
        { name: "Kamille Bidan", affiliation: "AEUG", description: "Protagonista, jovem prodígio de engenharia e Newtype em despertar; piloto do Zeta Gundam." },
        { name: "Char Aznable (Quattro Bajeena)", affiliation: "AEUG", description: "O lendário 'Ás Vermelho' retorna sob um pseudônimo, atuando como comandante e mentor." },
        { name: "Emma Sheen", affiliation: "Titans → AEUG", description: "Ex-piloto dos Titans que deserta e se junta à AEUG, pilotando o Gundam Mk-II." },
        { name: "Jerid Messa", affiliation: "Titans", description: "Piloto rival de Kamille, símbolo do orgulho e da rigidez militar dos Titans." },
        { name: "Bright Noa", affiliation: "AEUG", description: "Veterano da Guerra de Um Ano, agora capitão da nave Argama e líder militar da AEUG." },
      ],
      trivia: [
        "Zeta Gundam introduziu o conceito de mobile suits 'Transformáveis' (Variable), que se tornaria marca registrada da era U.C.",
        "A série é considerada uma das mais sombrias da franquia, abordando temas de trauma de guerra e o colapso psicológico de Newtypes.",
        "Char Aznable retorna sob o disfarce 'Quattro Bajeena' — uma das reviravoltas mais icônicas do universo Gundam.",
        "O final da série é frequentemente citado como um dos desfechos mais chocantes e ambíguos de toda a franquia.",
        "Zeta Gundam foi dirigido por Yoshiyuki Tomino, criador original da franquia, retornando à cadeira de diretor após Gundam ZZ ainda estar em produção.",
      ],
      galleryImages: [],
    },
  },
  {
    name: "Mobile Suit Gundam SEED",
    description:
      "Ano Cosmic Era 71. A guerra entre a Earth Alliance e a nação espacial ZAFT chega à colônia neutra Heliopolis, arrastando o jovem Kira Yamato — um Coordinator pacifista — para o cockpit do protótipo Strike Gundam. Ao lado de amigos, inimigos e do idealismo da nação neutra ORB, Kira precisa decidir que tipo de força está disposto a usar para proteger quem ama.",
    coverImage: "/images/shining_vs_destiny_space_arena.jpg",
    officialUrl: "https://en.wikipedia.org/wiki/Mobile_Suit_Gundam_SEED",
    metadataJson: {
      alias: "SEED",
      era: "Cosmic Era 71 – 73",
      synopsis:
        "Na era Cosmic Era, humanos geneticamente aprimorados (Coordinators) e humanos naturais convivem em tensão constante entre a Earth Alliance e a nação espacial ZAFT. Quando a guerra invade a colônia neutra Heliopolis, o estudante Kira Yamato — um Coordinator que nunca quis lutar — é forçado a pilotar o protótipo GAT-X105 Strike Gundam para proteger seus amigos, entrando em rota de colisão com seu melhor amigo de infância, Athrun Zala, agora soldado da ZAFT.",
      mobileSuits: [
        { name: "GAT-X105 Strike Gundam", pilot: "Kira Yamato", faction: "Earth Alliance / ORB", description: "Protótipo modular da Earth Alliance com sistema de Striker Packs intercambiáveis." },
        { name: "ZGMF-X10A Freedom Gundam", pilot: "Kira Yamato", faction: "ZAFT / ORB", description: "Sucessor do Strike, equipado com o motor Nuclear e o sistema de armas Full Burst Mode." },
        { name: "ZGMF-X09A Justice Gundam", pilot: "Athrun Zala", faction: "ZAFT", description: "Unidade irmã do Freedom, pilotada por Athrun na reta final do conflito." },
        { name: "ZGMF-X13A Providence Gundam", pilot: "Rau Le Creuset", faction: "ZAFT", description: "Mobile suit de combate com o sistema DRAGOON de armas remotas guiadas por rede neural." },
        { name: "GAT-X303 Aegis Gundam", pilot: "Athrun Zala", faction: "ZAFT", description: "Protótipo capaz de Mobile Armor Mode, um dos cinco Gundams originais roubados pela ZAFT." },
      ],
      pilots: [
        { name: "Kira Yamato", affiliation: "Earth Alliance → ORB", description: "Protagonista Coordinator, piloto do Strike e depois do Freedom Gundam." },
        { name: "Athrun Zala", affiliation: "ZAFT", description: "Melhor amigo de infância de Kira, agora inimigo em lados opostos da guerra." },
        { name: "Cagalli Yula Athha", affiliation: "ORB", description: "Líder da nação neutra Orb Union e futura Chefe de Estado, irmã gêmea de Kira." },
        { name: "Lacus Clyne", affiliation: "ZAFT / PLANT", description: "Ícone pop da ZAFT e voz pacifista que se torna figura-chave na resolução do conflito." },
        { name: "Murrue Ramius", affiliation: "Earth Alliance / ORB", description: "Capitã da nave Archangel, responsável por proteger a tripulação civil e os pilotos do Gundam." },
      ],
      trivia: [
        "Gundam SEED foi criado para celebrar os 25 anos da franquia, reintroduzindo Gundam para uma nova geração de fãs no início dos anos 2000.",
        "A série reimagina temas clássicos da Guerra de Um Ano (Coordinators vs. Naturals) sob uma nova ambientação, a Cosmic Era.",
        "Gundam SEED foi um fenômeno comercial no Japão, impulsionando um dos maiores volumes de model kits (Gunpla) da história da franquia.",
        "A trilha sonora e as aberturas da série (como 'Invoke' e 'Moment') se tornaram extremamente populares fora do Japão.",
        "A sequência direta, Mobile Suit Gundam SEED DESTINY, é uma série separada no catálogo — não confundir os pools de cartas.",
      ],
      galleryImages: [],
    },
  },
];

async function main() {
  for (const entry of seriesWave1) {
    const slug = slugify(entry.name);
    const saved = await prisma.taxonomyEntry.upsert({
      where: { kind_name: { kind: TaxonomyKind.SOURCE_TITLE, name: entry.name } },
      update: {
        description: entry.description,
        coverImage: entry.coverImage ?? null,
        officialUrl: entry.officialUrl ?? null,
        metadataJson: entry.metadataJson,
        isActive: true,
        deletedAt: null,
      },
      create: {
        kind: TaxonomyKind.SOURCE_TITLE,
        name: entry.name,
        slug,
        description: entry.description,
        coverImage: entry.coverImage ?? null,
        officialUrl: entry.officialUrl ?? null,
        metadataJson: entry.metadataJson,
      },
    });
    console.log(`Série sincronizada: ${saved.name} (/series/${saved.slug})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

/* Universe Hub — Wave 2 (Terminal 2 / Fase 3): popula TaxonomyEntry (kind=SOURCE_TITLE) com o
 * conteúdo rico de lore (sinopse, mobile suits, pilotos, curiosidades) consumido por
 * SeriesHubPage/SeriesDetailPage. `name` usa a grafia exata do dataset oficial (`sourceTitle`
 * em data/gcg-official-cards.json) pra bater com o filtro `listCards({ series })` (match exato,
 * não fuzzy) — ver server/index.ts (GET /api/cards, `media`/`series`).
 *
 * Wave 2 cobre as duas linhas temporais do roteiro Fase 3: Anno Domini (Mobile Suit Gundam 00)
 * e Ad Stella (Mobile Suit Gundam: The Witch from Mercury). Capas reaproveitam os covers oficiais
 * de booster já baixados em public/images/sets (GD03 "Steel Requiem" é o set-base de 00; GD01
 * "Newtype Rising" é o set-base de Witch from Mercury — ver data/verified-set-covers.json).
 *
 * Rodar com: node prisma/seed-series-wave2.mjs
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
const seriesWave2 = [
  {
    name: "Mobile Suit Gundam 00",
    description:
      "Ano Anno Domini 2307. A organização armada privada Celestial Being surge à sombra da ONU com um único objetivo declarado: erradicar a guerra do mundo pela força, pilotando os lendários Gundams movidos a reator GN Drive. Quatro Gundam Meisters — Setsuna F. Seiei, Lockon Stratos, Allelujah Haptism e Tieria Erde — se tornam símbolos de medo e esperança, intervindo em conflitos armados ao redor do globo até que a verdadeira intenção por trás do plano de Aeolia Schenberg comece a se revelar.",
    coverImage: "/images/sets/gd03.webp",
    officialUrl: "https://en.wikipedia.org/wiki/Mobile_Suit_Gundam_00",
    metadataJson: {
      alias: "Gundam 00",
      era: "Anno Domini (A.D.) 2307 – 2314",
      synopsis:
        "No ano 2307, a humanidade está dividida em três blocos econômicos rivais que disputam os recursos limitados de energia solar. À margem da ONU, a organização armada privada Celestial Being surge com uma missão radical: erradicar a guerra do mundo através da intervenção armada direta, usando os Gundams — mobile suits movidos por reatores de partículas GN, tecnologia gerada a partir do legado do cientista Aeolia Schenberg. Os quatro Gundam Meisters (Setsuna, Lockon, Allelujah e Tieria) intervêm em conflitos ao redor do planeta sob o comando de Sumeragi Lee Noriega, sendo vistos ora como terroristas, ora como salvadores, enquanto a verdadeira escala do Plano Aeolia — unir a humanidade sob uma consciência compartilhada, os Innovators — começa a se revelar.",
      mobileSuits: [
        { name: "GN-001 Gundam Exia", pilot: "Setsuna F. Seiei", faction: "Celestial Being", description: "Unidade de combate corpo a corpo de altíssima mobilidade, o Gundam de assalto do time e o mais icônico da 1ª temporada." },
        { name: "GN-002 Gundam Dynames", pilot: "Lockon Stratos", faction: "Celestial Being", description: "Especializado em combate à longa distância, com GN Sniper Rifle e sistema de mira Trans-Am compartilhado com o grupo." },
        { name: "GN-003 Gundam Kyrios", pilot: "Allelujah Haptism", faction: "Celestial Being", description: "Unidade transformável (modo MS/MA) voltada para reconhecimento e suporte tático de média distância." },
        { name: "GN-004 Gundam Virtue", pilot: "Tieria Erde", faction: "Celestial Being", description: "Unidade de assalto pesado com o canhão GN Bazooka, depois reconstruído como GN-005 Gundam Nadleeh / Seravee." },
        { name: "GN-0000 00 Gundam", pilot: "Setsuna F. Seiei", faction: "Celestial Being", description: "Sucessor definitivo do Exia na 2ª temporada, equipado com Twin Drive System — dois reatores GN em paralelo, poder sem precedentes." },
      ],
      pilots: [
        { name: "Setsuna F. Seiei", affiliation: "Celestial Being", description: "Protagonista, ex-soldado infantil do Curdemos Krieg; piloto do Exia e, depois, do 00 Gundam. Busca redenção através da guerra contra a guerra." },
        { name: "Lockon Stratos (Neil Dylandy)", affiliation: "Celestial Being", description: "Atirador de elite movido por vingança contra o terrorismo que dizimou sua família; piloto do Dynames." },
        { name: "Tieria Erde", affiliation: "Celestial Being", description: "Innovator artificial criado para supervisionar o Plano Aeolia; piloto do Virtue/Seravee, guardião da verdadeira missão da Celestial Being." },
        { name: "Allelujah Haptism", affiliation: "Celestial Being", description: "Ex-cobaia de experimentos genéticos militares com uma segunda personalidade (Hallelujah); piloto do Kyrios." },
        { name: "Graham Aker", affiliation: "Forças da União", description: "Ás da União obcecado em provar seu valor como piloto contra Setsuna, tornando-se seu rival mais persistente ao longo da série." },
      ],
      trivia: [
        "Gundam 00 foi a primeira série da franquia ambientada num futuro próximo e realista (sem espaço colonizado), abordando geopolítica de energia e terrorismo diretamente.",
        "É a primeira série de TV a receber uma sequência direta em formato de filme (Mobile Suit Gundam 00 The Movie: A Wakening of the Trailblazer, 2010).",
        "O conceito de Innovators e do Plano Aeolia Schenberg trata diretamente do tema recorrente da franquia: Newtypes como próximo passo evolutivo da humanidade.",
        "O 00 Gundam com Twin Drive System foi um marco técnico da série — dois reatores GN sincronizados em vez de apenas um, aumentando exponencialmente o poder de saída.",
        "A trilha sonora e o character design (Yun Kouga) deram à série uma identidade visual distinta dentro da franquia, mais próxima do design de mangá shoujo do que os Gundams clássicos.",
      ],
      galleryImages: [],
    },
  },
  {
    name: "Mobile Suit Gundam the Witch from Mercury",
    description:
      "Ano Ad Stella 122. Suletta Mercury, uma garota interiorana criada em Mercúrio, chega à prestigiada Academia Asticassia pilotando um misterioso mobile suit banido — o Gundam Aerial, equipado com o proibido sistema GUND-Format. Ao vencer um duelo de robôs (o sistema de arbitragem de disputas da escola) contra a arrogante herdeira Miorine Rembran, Suletta se vê comprometida em um noivado repentino que a lança direto no centro de uma teia de conspirações corporativas, tecnologia proibida e o legado sombrio por trás do Gundam que ela pilota.",
    coverImage: "/images/sets/gd01.jpg",
    officialUrl: "https://en.wikipedia.org/wiki/Mobile_Suit_Gundam:_The_Witch_from_Mercury",
    metadataJson: {
      alias: "Witch from Mercury",
      era: "Ad Stella (A.S.) 122",
      synopsis:
        "No ano Ad Stella 122, os colonos espaciais vivem sob o domínio de megacorporações que controlam a tecnologia de mobile suits através do GUND-Format — um sistema banido após o desastroso incidente conhecido como Bloqueio de Vanádis. Suletta Mercury, jovem prodígio vinda de Mercúrio, ingressa na Academia Asticassia (ligada à poderosa Benerit Group) pilotando o Gundam Aerial, unidade que carrega o legado GUND proibido. Ao vencer acidentalmente um duelo de robôs contra Miorine Rembran, filha do presidente da Benerit Group, Suletta fica noiva dela por tradição da escola — união que a arrasta para o centro de disputas corporativas, o passado obscuro do Projeto Aerial e o preço real de pilotar uma máquina viva.",
      mobileSuits: [
        { name: "XVX-016 Gundam Aerial", pilot: "Suletta Mercury", faction: "Grupo Mercury", description: "Gundam de combate próximo equipado com o sistema GUND-Format banido — reage às emoções de sua piloto, um dos poucos mobile suits sobreviventes do incidente de Vanádis." },
        { name: "XVX-016RN Gundam Aerial Rebuild", pilot: "Suletta Mercury", faction: "Grupo Mercury", description: "Reconstrução do Aerial após a 2ª temporada, adaptado para operar sem depender da conexão neural perigosa do GUND-Format original." },
        { name: "XGF-02 Gundam Lfrith", pilot: "Suletta Mercury (treino) / Elan Ceres", faction: "Grupo Mercury", description: "Protótipo de treino da linhagem GUND-Format usado por Suletta antes do Aerial, posteriormente reaproveitado pela sinistra unidade Ceres." },
        { name: "Gundam Calibarn", pilot: "Miorine Rembran / Suletta Mercury", faction: "Benerit Group", description: "Gundam lendário do Projeto Aerial original, revelado como arma decisiva na reta final da 2ª temporada." },
        { name: "Dilanza / Demeter", pilot: "Alunos da Asticassia (padrão)", faction: "Asticassia", description: "Mobile suits de produção usados nos duelos escolares regulamentados da Asticassia, base do sistema de arbitragem por combate." },
      ],
      pilots: [
        { name: "Suletta Mercury", affiliation: "Grupo Mercury", description: "Protagonista, prodígio tímida criada isolada em Mercúrio por sua mãe; piloto do Gundam Aerial e vencedora acidental do duelo que muda sua vida." },
        { name: "Miorine Rembran", affiliation: "Benerit Group", description: "Herdeira rebelde do presidente da Benerit Group; torna-se noiva/parceira de Suletta e figura central nas disputas corporativas da série." },
        { name: "Guel Jeturk", affiliation: "Asticassia", description: "Herdeiro orgulhoso de uma família de fabricantes de mobile suits, rival inicial de Suletta que evolui ao longo da trama." },
        { name: "Elan Ceres (Nika Nanaura)", affiliation: "VanadisIfrit", description: "Aluno de transferência enigmático ligado ao passado obscuro do Projeto Vanádis — uma das reviravoltas centrais da série." },
        { name: "Prospera Mercury", affiliation: "Grupo Mercury", description: "Mãe adotiva de Suletta e verdadeira arquiteta por trás do retorno do GUND-Format, movida por vingança contra a Benerit Group." },
      ],
      trivia: [
        "Witch from Mercury é a primeira série de TV mainline da franquia Gundam a ter uma protagonista feminina como piloto titular.",
        "O 'duelo de robôs' da Asticassia (sistema de arbitragem por combate estudantil) é uma homenagem direta ao MS Girl de Turn A Gundam e às academias militares clássicas da franquia.",
        "O GUND-Format é uma reinterpretação do conceito clássico de Newtype/Psycommu — aqui via interface neural literal entre piloto e máquina, com riscos físicos reais.",
        "A relação entre Suletta e Miorine foi amplamente noticiada como um marco de representatividade queer numa série mainline da franquia Gundam.",
        "A série é ambientada na era Ad Stella, uma linha do tempo totalmente nova e independente do Universal Century — sem conexão direta com Amuro, Char ou os eventos da Guerra de Um Ano.",
      ],
      galleryImages: [],
    },
  },
];

async function main() {
  for (const entry of seriesWave2) {
    const slug = slugify(entry.name);

    // O import automático do catálogo oficial (`prisma:seed:apitcg`) já cria uma
    // TaxonomyEntry SOURCE_TITLE por mídia distinta — às vezes com grafia levemente
    // diferente da usada em `sourceTitle` nas cartas (ex: com dois-pontos: "Mobile Suit
    // Gundam: The Witch from Mercury"). Isso colide no slug truncado (40 chars) com o
    // `name` exato que este seed precisa usar pra bater com `listCards({ series })`.
    // Corrige a entrada existente (rename) em vez de tentar criar uma duplicada.
    const collision = await prisma.taxonomyEntry.findFirst({
      where: { kind: TaxonomyKind.SOURCE_TITLE, slug, NOT: { name: entry.name } },
    });
    if (collision) {
      console.log(`Corrigindo grafia divergente: "${collision.name}" -> "${entry.name}"`);
      await prisma.taxonomyEntry.update({ where: { id: collision.id }, data: { name: entry.name } });
    }

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

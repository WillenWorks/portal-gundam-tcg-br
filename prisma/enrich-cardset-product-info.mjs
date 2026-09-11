/*
 * Enriquecimento de metadados de produto (CardSet) a partir das páginas oficiais
 * gundam-gcg.com/en/products/*.html — preenche MSRP, resumo de conteúdo (EN/PT-BR),
 * resumo de raridade, notas do produto e obras de origem (sourceTitles) pros sets
 * que ainda estavam sem esses campos (ver GD01/ST01 como referência de qualidade já
 * preenchida manualmente pelo admin).
 *
 * Fonte: fetch manual de cada página oficial de produto (17-18/set/2026) + busca web
 * pros tokens promocionais (EXBP/EXRP/RP), que não têm página de produto própria
 * (distribuídos em evento/torneio, não vendidos em booster). Nenhum dado foi
 * inventado -- campos sem informação oficial disponível ficam de fora (null),
 * em vez de estimar um número.
 *
 * Só preenche campos que estão VAZIOS no banco (nunca sobrescreve o que já foi
 * curado manualmente, ex: GD01 e ST01) -- roda quantas vezes quiser sem risco.
 *
 * Modos:
 *   node prisma/enrich-cardset-product-info.mjs           -> dry-run (padrão).
 *   node prisma/enrich-cardset-product-info.mjs --apply   -> aplica de verdade.
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

/** @type {Record<string, {
 *   msrpUsd?: number;
 *   shortDescription?: string;
 *   contentSummaryEn?: string;
 *   contentSummaryPt?: string;
 *   raritySummary?: string;
 *   productNotes?: string;
 *   sourceTitles?: string[];
 * }>} */
const PRODUCT_INFO = {
  "DBB-FA": {
    msrpUsd: 39.99,
    shortDescription: "Deck Build Box com 125 cartas reimpressas para montar deck combinando duas cores, mais 4 packs de Freedom Ascension [GD05].",
    contentSummaryEn: "125 reprinted non-foil cards (25 per color x 5 colors), 4 packs of Freedom Ascension [GD05], 1 half storage box, 10 resource cards, 2 token cards, 1 bonus pack, 1 rule/playsheet, 1 paper damage counter.",
    contentSummaryPt: "125 cartas reimpressas sem foil (25 por cor x 5 cores), 4 packs de Freedom Ascension [GD05], 1 meia caixa organizadora, 10 cartas de recurso, 2 cartas token, 1 bonus pack, 1 regra/playsheet, 1 marcador de dano de papel.",
    productNotes: "O bonus pack contém 1 de 3 cartas EX Base exclusivas com ilustração única, disponíveis somente neste produto.",
  },
  EB01: {
    msrpUsd: 4.99,
    shortDescription: "Booster pack em colaboração com o app SD Gundam G Generation Eternal, reunindo pilotos e mobile suits SD de várias séries Gundam.",
    contentSummaryEn: "1 pack includes 12 cards. Collaboration set with the mobile game SD Gundam G Generation Eternal (7M+ downloads), designed for Team Battle and Battle Royale formats (up to 4 players).",
    contentSummaryPt: "1 booster contém 12 cartas. Set colaborativo com o game mobile SD Gundam G Generation Eternal (mais de 7 milhões de downloads), pensado para os formatos Team Battle e Battle Royale (até 4 jogadores).",
    productNotes: "Lançado junto com o Starter Deck Generation Pulse [ST10].",
    sourceTitles: ["SD Gundam G Generation Eternal"],
  },
  EXBP: {
    shortDescription: "Tokens promocionais de EX Base distribuídos em eventos, torneios oficiais e campanhas promocionais -- não vendidos em booster.",
    contentSummaryEn: "Distributed through official events, store tournaments and promotional campaigns rather than sold in booster packs.",
    contentSummaryPt: "Distribuídos através de eventos oficiais, torneios de loja e campanhas promocionais -- não vendidos em booster.",
    productNotes: "Identificados pelo código EXBP; associados a eventos como o Newtype Challenge.",
  },
  EXRP: {
    shortDescription: "Tokens promocionais de EX Resource distribuídos em eventos, torneios oficiais e campanhas promocionais -- não vendidos em booster.",
    contentSummaryEn: "Distributed through official events, store tournaments and promotional campaigns rather than sold in booster packs.",
    contentSummaryPt: "Distribuídos através de eventos oficiais, torneios de loja e campanhas promocionais -- não vendidos em booster.",
    productNotes: "Identificados pelo código EXRP; associados a eventos como o Newtype Challenge e premiações de campeonato oficial.",
  },
  RP: {
    shortDescription: "Cartas de recurso promocionais distribuídas em eventos e como recompensa de participação/torneio, muitas com arte alternativa ou acabamento holográfico.",
    contentSummaryEn: "Special-edition resource cards released at events or as participation/tournament rewards rather than in standard packs.",
    contentSummaryPt: "Cartas de recurso especiais lançadas em eventos ou como recompensa de participação/torneio, fora dos boosters padrão.",
    productNotes: "Distribuídas em eventos, participação em torneios e marcos comemorativos.",
  },
  "GCG-PR": {
    shortDescription: "Coleção agregadora de cartas promocionais oficiais distribuídas em diferentes eventos, torneios e ações do Gundam Card Game ao longo do tempo -- não é um produto único.",
    productNotes: "Inclui, entre outras, o Premium Card Collection [EVX05]: 6 cartas (1 de cada), distribuído no BANDAI CARD GAMES Fest 25-26 por US$ 15.00 (13/12/2025).",
  },
  GD01_b: {
    msrpUsd: 69.99,
    shortDescription: "Caixa de edição limitada Beta, produto de entrada com tudo para jogar e montar decks, lançada antes do lançamento oficial do jogo.",
    contentSummaryEn: "16 booster packs (9 cards each), 1 Legend Rare card, and 1 56-card set, totaling 200 cards, plus accessories.",
    contentSummaryPt: "16 boosters (9 cartas cada), 1 carta Legend Rare avulsa e 1 conjunto de 56 cartas, totalizando 200 cartas, além de acessórios.",
    productNotes: "Distribuição limitada a BANDAI CARD GAMES Fests, lojas parceiras Bandai TCG+ e Premium Bandai USA (residentes dos EUA). Lançada em 07/12/2024.",
    sourceTitles: ["Mobile Suit Gundam", "Mobile Suit Gundam Wing", "Mobile Suit Gundam SEED", "Mobile Suit Gundam Unicorn", "Mobile Suit Gundam: The Witch from Mercury"],
  },
  GD02: {
    msrpUsd: 4.99,
    shortDescription: "Segundo booster pack principal do jogo, reunindo quatro franquias Gundam clássicas e modernas.",
    contentSummaryEn: "1 pack includes 12+1 cards. 130+13 card types: 50 Common, 36 Uncommon, 32 Rare, 12 Legend Rare, 3 Token, 10 Resource.",
    contentSummaryPt: "1 booster contém 12+1 cartas. 130+13 tipos de carta: 50 Common, 36 Uncommon, 32 Rare, 12 Legend Rare, 3 Token, 10 Resource.",
    raritySummary: "50 Common, 36 Uncommon, 32 Rare, 12 Legend Rare, 3 Token, 10 Resource (130+13 tipos no total).",
    productNotes: "Detalhes e arte do produto sujeitos a alteração.",
    sourceTitles: ["After War Gundam X", "Mobile Suit Gundam AGE", "Mobile Suit Z Gundam", "Mobile Suit Gundam Iron-Blooded Orphans"],
  },
  GD03: {
    msrpUsd: 4.99,
    shortDescription: "Terceiro booster pack, com reimpressões poderosas em nova arte de séries já destacadas no jogo.",
    contentSummaryEn: "1 pack includes 12+1 cards. 139+20 card types: 50 Common, 36 Uncommon, 34 Rare, 12 Legend Rare, 7 Special, 10 Token, 10 Resource.",
    contentSummaryPt: "1 booster contém 12+1 cartas. 139+20 tipos de carta: 50 Common, 36 Uncommon, 34 Rare, 12 Legend Rare, 7 Special, 10 Token, 10 Resource.",
    raritySummary: "50 Common, 36 Uncommon, 34 Rare, 12 Legend Rare, 7 Special, 10 Token, 10 Resource (139+20 tipos no total).",
    productNotes: "Traz 'Special Cards' reimpressas com nova arte. Houve correção de errata no texto de algumas cartas deste set após o lançamento.",
    sourceTitles: ["Mobile Suit Gundam: Iron-Blooded Orphans Urdr-Hunt", "Mobile Suit Gundam 0080: War in the Pocket"],
  },
  GD04: {
    msrpUsd: 4.99,
    shortDescription: "Quarto booster pack, com foco em Mobile Suit Victory Gundam e Turn A Gundam.",
    contentSummaryEn: "1 pack includes 12+1 cards.",
    contentSummaryPt: "1 booster contém 12+1 cartas.",
    productNotes: "Imagens de produto em desenvolvimento podem diferir do produto final.",
    sourceTitles: ["Mobile Suit Victory Gundam", "Turn A Gundam"],
  },
  GD05: {
    msrpUsd: 4.99,
    shortDescription: "Booster de 1º aniversário do jogo, introduzindo a rarity Link Rare e recorde de 5 cartas LR++.",
    contentSummaryEn: "1 pack includes 12 cards. 138+10 card types: 50 Common, 36 Uncommon, 32 Rare, 12 Legend Rare, 8 Special, 2 Token, 8 Special EX Resource.",
    contentSummaryPt: "1 booster contém 12 cartas. 138+10 tipos de carta: 50 Common, 36 Uncommon, 32 Rare, 12 Legend Rare, 8 Special, 2 Token, 8 EX Resource Special.",
    raritySummary: "50 Common, 36 Uncommon, 32 Rare, 12 Legend Rare, 8 Special, 2 Token, 8 EX Resource Special (138+10 tipos no total).",
    productNotes: "Estreia da rarity 'Link Rare' (paralelas de pareamentos icônicos). 8 cartas SP EX Resource com personagens femininas, 8 SP de pilotos e recorde de 5 tipos de LR++. Booster comemorativo de 1º aniversário do jogo.",
    sourceTitles: ["Mobile Fighter G Gundam", "Mobile Suit Gundam Wing: Endless Waltz", "Mobile Suit Gundam: Char's Counterattack", "Mobile Suit Gundam SEED Destiny"],
  },
  ST05: {
    msrpUsd: 15.99,
    shortDescription: "Starter deck focado em Mobile Suit Gundam: Iron-Blooded Orphans, introduzindo a cor Roxo.",
    contentSummaryEn: "50-card pre-constructed deck, 10 resource cards, 2 token cards, paper damage counter, rule/playsheet, bonus pack.",
    contentSummaryPt: "Deck pré-construído de 50 cartas, 10 cartas de recurso, 2 cartas token, marcador de dano de papel, regra/playsheet e bonus pack.",
    raritySummary: "2 Legend Rare e 14 Common na composição do starter.",
    productNotes: "Introduz a nova cor Roxo ao jogo. Todas as caixas têm cartas duplicadas (padrão de starter deck).",
    sourceTitles: ["Mobile Suit Gundam: Iron-Blooded Orphans"],
  },
  ST06: {
    msrpUsd: 15.99,
    shortDescription: "Starter deck de Mobile Suit Gundam GQuuuuuuX, especializado em ataque nas cores Verde e Vermelho.",
    contentSummaryEn: "50-card pre-constructed deck, 10 resource cards, 2 token cards, paper damage counter, rule/playsheet, bonus pack.",
    contentSummaryPt: "Deck pré-construído de 50 cartas, 10 cartas de recurso, 2 cartas token, marcador de dano de papel, regra/playsheet e bonus pack.",
    raritySummary: "2 Legend Rare e 14 Common na composição do starter.",
    productNotes: "Todas as caixas têm cartas duplicadas (padrão de starter deck).",
    sourceTitles: ["Mobile Suit Gundam GQuuuuuuX"],
  },
  ST07: {
    msrpUsd: 15.99,
    shortDescription: "Starter deck focado em Mobile Suit Gundam 00.",
    contentSummaryEn: "50-card pre-constructed deck, 10 resource cards, 2 token cards, paper damage counter, rule/playsheet, bonus pack.",
    contentSummaryPt: "Deck pré-construído de 50 cartas, 10 cartas de recurso, 2 cartas token, marcador de dano de papel, regra/playsheet e bonus pack.",
    raritySummary: "2 Legend Rare e 14 Common na composição do starter.",
    productNotes: "Todas as caixas têm cartas duplicadas (padrão de starter deck).",
    sourceTitles: ["Mobile Suit Gundam 00"],
  },
  ST08: {
    msrpUsd: 15.99,
    shortDescription: "Starter deck de Mobile Suit Gundam: Hathaway's Flash, combinando dano em Vermelho com suporte balanceado em Azul.",
    contentSummaryEn: "50-card pre-constructed deck, 10 resource cards, 2 token cards, paper damage counter, rule/playsheet, bonus pack.",
    contentSummaryPt: "Deck pré-construído de 50 cartas, 10 cartas de recurso, 2 cartas token, marcador de dano de papel, regra/playsheet e bonus pack.",
    raritySummary: "2 Legend Rare e 14 Common na composição do starter.",
    productNotes: "Todas as caixas têm cartas duplicadas (padrão de starter deck).",
    sourceTitles: ["Mobile Suit Gundam: Hathaway's Flash"],
  },
  ST09: {
    msrpUsd: 39.99,
    shortDescription: "Starter deck premium de Mobile Suit Gundam SEED Destiny, combinando as forças de Kira, Athrun e Shinn.",
    contentSummaryEn: "1 ready-to-play 50-card deck, 10 resource cards, 22 extra cards, 2 token cards, 6 damage counter dice, rule/playsheet, bonus pack.",
    contentSummaryPt: "1 deck pré-construído de 50 cartas, 10 cartas de recurso, 22 cartas extras, 2 cartas token, 6 dados marcadores de dano, regra/playsheet e bonus pack.",
    productNotes: "Deck premium com 22 cartas extras além do deck de 50 -- maior MSRP entre os starters.",
    sourceTitles: ["Mobile Suit Gundam SEED Destiny"],
  },
  ST10: {
    msrpUsd: 15.99,
    shortDescription: "Starter deck em colaboração com o app SD Gundam G Generation Eternal, com pilotos e mobile suits SD de várias séries.",
    contentSummaryEn: "1 ready-to-play 50-card deck, 10 resource cards, 2 token cards, paper damage counter, rule/playsheet, bonus pack.",
    contentSummaryPt: "1 deck pré-construído de 50 cartas, 10 cartas de recurso, 2 cartas token, marcador de dano de papel, regra/playsheet e bonus pack.",
    productNotes: "Lançado junto com o booster Eternal Nexus [EB01]. Pensado para os formatos Team Battle e Battle Royale (até 4 jogadores).",
    sourceTitles: ["SD Gundam G Generation Eternal"],
  },
};

async function main() {
  const prisma = new PrismaClient();
  const codes = Object.keys(PRODUCT_INFO);
  const sets = await prisma.cardSet.findMany({ where: { code: { in: codes } } });
  const byCode = new Map(sets.map((s) => [s.code, s]));

  let updatedCount = 0;
  for (const code of codes) {
    const set = byCode.get(code);
    if (!set) {
      console.log(`[skip] ${code}: não encontrado no banco.`);
      continue;
    }
    const info = PRODUCT_INFO[code];
    const data = {};
    if (info.msrpUsd !== undefined && set.msrpUsd == null) data.msrpUsd = info.msrpUsd;
    if (info.shortDescription && !set.shortDescription) data.shortDescription = info.shortDescription;
    if (info.contentSummaryEn && !set.contentSummaryEn) data.contentSummaryEn = info.contentSummaryEn;
    if (info.contentSummaryPt && !set.contentSummaryPt) data.contentSummaryPt = info.contentSummaryPt;
    if (info.raritySummary && !set.raritySummary) data.raritySummary = info.raritySummary;
    if (info.productNotes && !set.productNotes) data.productNotes = info.productNotes;
    if (info.sourceTitles?.length && !set.sourceTitles?.length) data.sourceTitles = info.sourceTitles;

    if (Object.keys(data).length === 0) {
      console.log(`[skip] ${code}: já preenchido, nada a fazer.`);
      continue;
    }

    console.log(`[${APPLY ? "apply" : "dry-run"}] ${code}: ${Object.keys(data).join(", ")}`);
    if (APPLY) {
      await prisma.cardSet.update({ where: { id: set.id }, data });
    }
    updatedCount += 1;
  }

  console.log(`\n${updatedCount} coleção(ões) ${APPLY ? "atualizada(s)" : "seriam atualizada(s)"}.`);
  if (!APPLY) console.log("Rode com --apply para gravar de verdade.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

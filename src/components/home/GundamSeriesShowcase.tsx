import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BookOpen, ChevronDown, Compass, Dices, Eye, Layers, RefreshCw, Sparkles, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SeriesInfo = {
  id: string;
  dbName: string;
  name: string;
  jpName?: string;
  timeline: string;
  year: string;
  cardCount: number;
  highlightMecha: string;
  startersOrPacks: string;
  description: string;
  tcgStyle: string;
  colorAccent: string;
};

export const GUNDAM_SERIES_CATALOG: SeriesInfo[] = [
  {
    id: "msg-0079",
    dbName: "Mobile Suit Gundam",
    name: "Mobile Suit Gundam",
    jpName: "機動戦士ガンダム (0079)",
    timeline: "Universal Century (U.C. 0079)",
    year: "1979",
    cardCount: 171,
    highlightMecha: "RX-78-2 Gundam & Char's Gelgoog / Zaku II",
    startersOrPacks: "ST01, ST02, ST03, GD01, GD02, GD04, GD05",
    description:
      "A lendária Guerra de Um Ano entre a Federação Terrestre e o Principado de Zeon. O jovem civil Amuro Ray pilota o protótipo RX-78-2 e desperta suas habilidades Newtype diante do temido 'Cometa Vermelho' Char Aznable.",
    tcgStyle: "Fundamento do jogo: equilíbrio clássico, sinergia militar da Federação e investidas táticas agressivas de Zeon.",
    colorAccent: "border-blue-500/40 hover:border-blue-400 text-blue-300",
  },
  {
    id: "zeta-gundam",
    dbName: "Mobile Suit Zeta Gundam",
    name: "Mobile Suit Zeta Gundam",
    jpName: "機動戦士Ζガンダム",
    timeline: "Universal Century (U.C. 0087)",
    year: "1985",
    cardCount: 101,
    highlightMecha: "MSZ-006 Zeta Gundam & Psycho Gundam / Hyaku-Shiki",
    startersOrPacks: "ST10, GD02, GD03, GD04, GD05",
    description:
      "Sete anos após a Guerra de Um Ano, a tropa militarista de elite Titans oprime as colônias espaciais. Kamille Bidan junta-se à resistência AEUG ao lado de Quattro Bajeena (Char Aznable).",
    tcgStyle: "Morfologia transformável Wave Rider, Bio-Sensor ativado sob pressão crítica e alto poder de contra-ataque.",
    colorAccent: "border-sky-500/40 hover:border-sky-400 text-sky-300",
  },
  {
    id: "gundam-0080",
    dbName: "Mobile Suit Gundam 0080: War in the Pocket",
    name: "Gundam 0080: War in the Pocket",
    jpName: "機動戦士ガンダム0080 ポケットの中の戦争",
    timeline: "Universal Century (U.C. 0079 / 0080)",
    year: "1989",
    cardCount: 31,
    highlightMecha: "RX-78NT-1 Gundam 'Alex' & MS-18E Kämpfer",
    startersOrPacks: "GD03 & Promocionais GCG-PR",
    description:
      "Nos dias finais da Guerra de Um Ano na colônia neutra Libot, a equipe secreta 'Cyclops' de Zeon tenta sabotar o protótipo Newtype Gundam NT-1 Alex, enquanto o jovem Al testemunha o custo humano da guerra ao lado de Bernie.",
    tcgStyle: "Infiltrações velozes com Kämpfer, blindagem Chobham Armor protetora e gatilhos de emboscada em curta distância.",
    colorAccent: "border-indigo-500/40 hover:border-indigo-400 text-indigo-300",
  },
  {
    id: "chars-counterattack",
    dbName: "Mobile Suit Gundam Char's Counterattack",
    name: "Char's Counterattack",
    jpName: "機動戦士ガンダム 逆襲のシャア",
    timeline: "Universal Century (U.C. 0093)",
    year: "1988",
    cardCount: 41,
    highlightMecha: "ν Gundam (Nu Gundam) & MSN-04 Sazabi",
    startersOrPacks: "GD05, EXBP, RP",
    description:
      "O confronto final entre Amuro Ray e Char Aznable. Determinado a forçar a humanidade a migrar para o espaço para deixar a Terra descansar, Char tenta lançar o asteroide Axis em rota de colisão contra o planeta.",
    tcgStyle: "Fin Funnels teleguiados de longo alcance, armadura com ressonância Psycoframe e finalizações letais de alto custo.",
    colorAccent: "border-red-500/40 hover:border-red-400 text-red-300",
  },
  {
    id: "hathaways-flash",
    dbName: "Mobile Suit Gundam: Hathaway's Flash",
    name: "Gundam: Hathaway's Flash",
    jpName: "機動戦士ガンダム 閃光のハサウェイ",
    timeline: "Universal Century (U.C. 0105)",
    year: "2021",
    cardCount: 47,
    highlightMecha: "RX-105 Ξ Gundam (Xi) & RX-104FF Penelope",
    startersOrPacks: "ST08 (Hathaway Purple), GD03, GD04",
    description:
      "Doze anos após a rebelião de Char, o governo federal afundou na corrupção. Hathaway Noa assume a identidade secreta de 'Mafty Navue Erin', liderando uma resistência armada contra a tirania da elite terrena.",
    tcgStyle: "Voo atmosférico por Minovsky Craft, bombardeio com Funnel Missiles supersônicos e controle absoluto de altitude.",
    colorAccent: "border-purple-500/40 hover:border-purple-400 text-purple-300",
  },
  {
    id: "gundam-unicorn",
    dbName: "Mobile Suit Gundam Unicorn",
    name: "Mobile Suit Gundam Unicorn",
    jpName: "機動戦士ガンダムUC",
    timeline: "Universal Century (U.C. 0096)",
    year: "2010",
    cardCount: 137,
    highlightMecha: "RX-0 Unicorn Gundam, Banshee & MSN-06S Sinanju",
    startersOrPacks: "ST03, GD01, GD02, GD03, GD04, GD05",
    description:
      "A sangrenta corrida pela 'Caixa de Laplace', segredo milenar capaz de derrubar a Federação Terrestre. Banagher Links desperta o Unicorn Gundam e seu misterioso sistema NT-D (Newtype Destroyer).",
    tcgStyle: "Transição explosiva para Destroy Mode, gatilhos de eliminação e sinergias pesadas de Mobile Armors.",
    colorAccent: "border-rose-500/40 hover:border-rose-400 text-rose-300",
  },
  {
    id: "victory-gundam",
    dbName: "Mobile Suit Victory Gundam",
    name: "Mobile Suit Victory Gundam",
    jpName: "機動戦士Vガンダム",
    timeline: "Universal Century (U.C. 0153)",
    year: "1993",
    cardCount: 32,
    highlightMecha: "LM314V21 Victory 2 Gundam (V2) & V-Dash Gundam",
    startersOrPacks: "GD04, GD05, GCG-PR",
    description:
      "No século mais avançado do Século Universal, o Império Zanscare invade a Terra com guilhotinas e fanatismo religioso. O jovem Uso Ewin pilota o Victory Gundam na milícia rebelde Liga Militaire.",
    tcgStyle: "Peças modulares intercambiáveis, efeito devastador 'Wings of Light' (Asas de Luz) e mobilidade acrobática.",
    colorAccent: "border-blue-400/40 hover:border-blue-300 text-blue-200",
  },
  {
    id: "g-gundam",
    dbName: "Mobile Fighter G Gundam",
    name: "Mobile Fighter G Gundam",
    jpName: "機動武闘伝Gガンダム",
    timeline: "Future Century (F.C. 60)",
    year: "1994",
    cardCount: 34,
    highlightMecha: "Shining Gundam, Master Gundam & God Gundam",
    startersOrPacks: "GD05, EXBP, RP",
    description:
      "Guerras entre nações espaciais foram substituídas pelo lendário 'Gundam Fight', um torneio global de artes marciais entre mechas. Domon Kasshu luta pelo Neo Japão buscando o paradeiro de seu irmão e do Dark Gundam.",
    tcgStyle: "Combate corpo a corpo supremo, golpes marciais devastadores (Sekiha Tenkyoken) e buffs explosivos de AP no duelo.",
    colorAccent: "border-amber-400/40 hover:border-amber-300 text-amber-200",
  },
  {
    id: "gundam-wing",
    dbName: "Mobile Suit Gundam Wing",
    name: "Mobile Suit Gundam Wing",
    jpName: "新機動戦記ガンダムW",
    timeline: "After Colony (A.C. 195)",
    year: "1995",
    cardCount: 134,
    highlightMecha: "Wing Gundam Zero, Deathscythe & Tallgeese",
    startersOrPacks: "ST02, GD01, GD02, GD03, GD05",
    description:
      "Cinco jovens pilotos são enviados das colônias espaciais na 'Operação Meteoro' para livrar a Terra do jugo militarista da Fundação Treize e da organização OZ usando Mobile Suits de liga Gundanium indestrutíveis.",
    tcgStyle: "Disparos colossais de Buster Rifle em área, evasão sorrateira de Deathscythe e gatilhos Burst explosivos.",
    colorAccent: "border-yellow-500/40 hover:border-yellow-400 text-yellow-300",
  },
  {
    id: "wing-endless-waltz",
    dbName: "Mobile Suit Gundam Wing: Endless Waltz",
    name: "Gundam Wing: Endless Waltz",
    jpName: "新機動戦記ガンダムW Endless Waltz",
    timeline: "After Colony (A.C. 196)",
    year: "1997",
    cardCount: 22,
    highlightMecha: "Wing Gundam Zero (EW) & Tallgeese III",
    startersOrPacks: "GD05, EXBP",
    description:
      "Um ano após o fim da guerra, o Exército de Mariemaia desafia o desarmamento mundial sequestrando Relena Peacecraft. Heero Yuy e os pilotos de Gundam voltam à ação em seus mechas com asas angelicais definitivas.",
    tcgStyle: "Asas angelicais de altíssima manobrabilidade aérea, precisão cirúrgica de disparo e resistência lendária.",
    colorAccent: "border-cyan-400/40 hover:border-cyan-300 text-cyan-200",
  },
  {
    id: "gundam-x",
    dbName: "After War Gundam X",
    name: "After War Gundam X",
    jpName: "機動新世紀ガンダムX",
    timeline: "After War (A.W. 0015)",
    year: "1996",
    cardCount: 64,
    highlightMecha: "GX-9900 Gundam X & GX-9901-DX Gundam Double X",
    startersOrPacks: "GD02, GD03, GD04, ST09, GCG-PR",
    description:
      "Quinze anos após a queda de centenas de colônias espaciais devastar a Terra num inverno pós-apocalíptico, Garrod Ran encontra o Gundam X e protege a jovem vidente Newtype Tiffa Adill dos abutres e da Nova Federação.",
    tcgStyle: "Canhão Satélite carregado por micro-ondas da base lunar, aniquilação em massa e sinergia com Newtypes.",
    colorAccent: "border-emerald-400/40 hover:border-emerald-300 text-emerald-200",
  },
  {
    id: "turn-a-gundam",
    dbName: "Turn A Gundam",
    name: "Turn A Gundam",
    jpName: "∀ガンダム (Turn A Gundam)",
    timeline: "Correct Century (C.C. 2345)",
    year: "1999",
    cardCount: 20,
    highlightMecha: "System-∀99 ∀ Gundam (Turn A) & Concept-X Turn X",
    startersOrPacks: "GD04, GD05, RP",
    description:
      "Milênios após todas as eras de Gundam convergirem no apocalipse da História Negra, a civilização da Terra vive em tecnologia rural e pacífica até a chegada dos povos lunares Moonrace. Loran Cehack desenterra o misterioso 'Bigode Branco' Turn A.",
    tcgStyle: "Efeito lendário Moonlight Butterfly (Borboleta do Luar), regeneração nanotecnológica e anulação de recursos do oponente.",
    colorAccent: "border-slate-300/40 hover:border-slate-200 text-slate-100",
  },
  {
    id: "gundam-seed",
    dbName: "Mobile Suit Gundam SEED",
    name: "Mobile Suit Gundam SEED",
    jpName: "機動戦士ガンダムSEED",
    timeline: "Cosmic Era (C.E. 71)",
    year: "2002",
    cardCount: 184,
    highlightMecha: "GAT-X105 Strike & ZGMF-X10A Freedom Gundam",
    startersOrPacks: "ST04, GD01, GD02, GD03, GD04, GD05",
    description:
      "A sangrenta guerra racial entre a Federação Terrestre (Naturais) e a ZAFT (Coordenadores geneticamente aprimorados). Os amigos de infância Kira Yamato e Athrun Zala colidem em lados opostos pilotando os Mobile Suits G-Weapons.",
    tcgStyle: "Blindagem Phase Shift Armor imune a dano físico balístico, múltiplos disparos com Hi-MAT e ataques coordenados.",
    colorAccent: "border-cyan-500/40 hover:border-cyan-400 text-cyan-300",
  },
  {
    id: "gundam-seed-destiny",
    dbName: "Mobile Suit Gundam SEED Destiny",
    name: "Gundam SEED Destiny",
    jpName: "機動戦士ガンダムSEED DESTINY",
    timeline: "Cosmic Era (C.E. 73)",
    year: "2004",
    cardCount: 85,
    highlightMecha: "ZGMF-X42S Destiny & ZGMF-X20A Strike Freedom",
    startersOrPacks: "ST09, ST10, GD04, GD05",
    description:
      "Dois anos após a Batalha de Jachin Due, a tensão reacende com o atentado em Armory ONE. O jovem piloto da ZAFT Shinn Asuka luta para proteger inocentes enquanto o mundo descarrilha no Plano Destiny de Gilbert Durandal.",
    tcgStyle: "Ativação do Modo SEED, asas de energia luminosa (Wings of Light) e ataques letais contínuos de altíssimo dano.",
    colorAccent: "border-blue-600/40 hover:border-blue-500 text-blue-300",
  },
  {
    id: "gundam-00",
    dbName: "Mobile Suit Gundam 00",
    name: "Mobile Suit Gundam 00",
    jpName: "機動戦士ガンダム00",
    timeline: "Anno Domini (A.D. 2307)",
    year: "2007",
    cardCount: 122,
    highlightMecha: "GN-001 Gundam Exia & GN-0000 00 Raiser",
    startersOrPacks: "ST07, GD03, GD04, GD05",
    description:
      "A organização paramilitar Celestial Being realiza intervenções armadas pontuais pelo globo com quatro Gundams movidos a GN Drives semi-perpétuos, visando erradicar conflitos armados e unificar a humanidade.",
    tcgStyle: "Aceleração de recursos com Partículas GN, pico de poder ofensivo com modo Trans-Am e ataques múltiplos cirúrgicos.",
    colorAccent: "border-emerald-500/40 hover:border-emerald-400 text-emerald-300",
  },
  {
    id: "gundam-age",
    dbName: "Mobile Suit Gundam AGE",
    name: "Mobile Suit Gundam AGE",
    jpName: "機動戦士ガンダムAGE",
    timeline: "Advanced Generation (A.G. 115 - 164)",
    year: "2011",
    cardCount: 50,
    highlightMecha: "Gundam AGE-1 Normal / Spallow & Gundam AGE-2 Normal",
    startersOrPacks: "GD02, GD03, GD05",
    description:
      "Uma saga épica geracional que atravessa três gerações da família Asuno (Flit, Asemu e Kio) enfrentando os misteriosos 'Vagan'. O mecha evolui dinamicamente durante as batalhas graças ao lendário Sistema AGE.",
    tcgStyle: "Sistema AGE adaptativo: substituição instantânea de 'Wears' táticos, evolução contínua e flexibilidade contra qualquer ameaça.",
    colorAccent: "border-lime-500/40 hover:border-lime-400 text-lime-300",
  },
  {
    id: "gundam-gquuuuuux",
    dbName: "Mobile Suit Gundam GQuuuuuuX",
    name: "Mobile Suit Gundam GQuuuuuuX",
    jpName: "機動戦士ガンダム GQuuuuuuX",
    timeline: "Original TCG Timeline / Psycommu Omega",
    year: "2025",
    cardCount: 119,
    highlightMecha: "GQuuuuuuX (Omega Psycommu), GFreD & Red Gundam",
    startersOrPacks: "ST06 (Red Assemble), GD02, GD03, GD04, GD05",
    description:
      "Linha original criada para expandir as fronteiras do Gundam Card Game. Máquinas experimentais equipadas com o misterioso sistema Omega Psycommu capazes de dobrar as regras convencionais de combate mecha.",
    tcgStyle: "Mecânicas experimentais revolucionárias, manipulação da zona de recursos e combos imprevisíveis com Omega Psycommu.",
    colorAccent: "border-fuchsia-500/40 hover:border-fuchsia-400 text-fuchsia-300",
  },
  {
    id: "iron-blooded-orphans",
    dbName: "Mobile Suit Gundam: Iron-Blooded Orphans",
    name: "Iron-Blooded Orphans",
    jpName: "機動戦士ガンダム 鉄血のオルフェンズ",
    timeline: "Post Disaster (P.D. 323)",
    year: "2015",
    cardCount: 154,
    highlightMecha: "Gundam Barbatos (1st/4th/Lupus/Rex) & Gusion Rebake",
    startersOrPacks: "ST05, GD02, GD03, GD04, GD05",
    description:
      "Em Marte três séculos após a Calamity War, crianças-soldado formam a companhia mercenária Tekkadan para escoltar a ativista Kudelia Aina Bernstein até a Terra. O implacável Mikazuki Augus pilota a relíquia Gundam Barbatos.",
    tcgStyle: "Combate físico visceral sem feixes ópticos, armadura Nanolaminate de alta absorção e dano contundente com maças e garras.",
    colorAccent: "border-orange-500/40 hover:border-orange-400 text-orange-300",
  },
  {
    id: "witch-from-mercury",
    dbName: "Mobile Suit Gundam the Witch from Mercury",
    name: "The Witch from Mercury",
    jpName: "機動戦士ガンダム 水星の魔女",
    timeline: "Ad Stella (A.S. 122)",
    year: "2022",
    cardCount: 110,
    highlightMecha: "XVX-016 Gundam Aerial, Aerial Rebuild & Calibarn",
    startersOrPacks: "ST01, GD01, GD02, GD04, GD05",
    description:
      "Na prestigiada Academia Asticassia de Tecnologia, disputas comerciais e corporativas são decididas em duelos de Mobile Suits. Suletta Mercury chega de Mercúrio pilotando o misterioso Aerial com tecnologia GUND proibida.",
    tcgStyle: "Sinergia de GUND-Format com Bit Staves: alternância fluida entre escudo impenetrável e rajadas teleguiadas direcionadas.",
    colorAccent: "border-teal-500/40 hover:border-teal-400 text-teal-300",
  },
  {
    id: "sd-gundam-eternal",
    dbName: "SD Gundam G Generation ETERNAL",
    name: "SD Gundam G Generation ETERNAL",
    jpName: "SDガンダム ジージェネレーション エターナル",
    timeline: "Multi-Verse / SD Digital Frontier",
    year: "2024",
    cardCount: 142,
    highlightMecha: "Phoenix Gundam (Power Unleashed), Psycho Haro & Hi-Nu (EX)",
    startersOrPacks: "ST10 (SD Extra), EB01 (Extra Booster 01)",
    description:
      "O encontro de todas as eras, pilotos e mechas da história de Gundam em formato Super Deformed tático. Pilote desde lendas clássicas do Século Universal até máquinas icônicas de universos alternativos.",
    tcgStyle: "Habilidades EX universais, combinação livre de pilotos e Mobile Suits de qualquer linha temporal e versatilidade tática.",
    colorAccent: "border-pink-500/40 hover:border-pink-400 text-pink-300",
  },
];

// Função determinística para sortear n itens aleatórios
function getRandomSample<T>(array: T[], size: number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, size);
}

export function GundamSeriesShowcase() {
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [randomSeed, setRandomSeed] = useState(0);

  // Sorteia 6 séries aleatórias da lista de 20
  const displayedSeries = useMemo(() => {
    if (showAll) return GUNDAM_SERIES_CATALOG;
    // O randomSeed força a recomputação do sorteio
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    randomSeed;
    return getRandomSample(GUNDAM_SERIES_CATALOG, 6);
  }, [showAll, randomSeed]);

  const handleShuffle = () => {
    setRandomSeed((prev) => prev + 1);
  };

  const toggleAccordion = (id: string) => {
    setSelectedSeries((prev) => (prev === id ? null : id));
  };

  return (
    <section id="conheca-gundam" className="border-t border-white/10 bg-slate-950/80 py-12 sm:py-18">
      <div className="mx-auto max-w-[1760px] px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Cabeçalho da Seção */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="rounded-none border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300">
                Universo & Lore
              </Badge>
              <span className="text-xs text-slate-400 font-mono">
                {GUNDAM_SERIES_CATALOG.length} Linhas Temporais Oficiais no Card Game
              </span>
            </div>
            <h2 className="heading-portal font-heading text-3xl sm:text-4xl uppercase mt-2 text-white">
              Conheça as Séries de Gundam
            </h2>
            <p className="text-soft text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed">
              Cada carta do Gundam Card Game é inspirada em batalhas históricas, pilotos memoráveis e Mobile Suits lendários.
              Abaixo listamos uma <strong>seleção rotativa</strong> das séries já presentes no jogo — e prepare-se para a futura <strong>Wiki Completa</strong> da Anaheim HUB!
            </p>
          </div>

          {/* Controles: Sortear Novas Séries / Ver Todas */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!showAll && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleShuffle}
                className="h-9 rounded-none border-white/15 bg-white/5 text-slate-200 hover:border-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 text-xs font-mono tracking-wider transition-all"
                title="Sortear 6 séries aleatórias da lista de 20"
              >
                <Dices className="mr-1.5 size-4 text-cyan-400" />
                Sortear outras
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAll((prev) => !prev)}
              className="h-9 rounded-none border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-500/20 text-xs font-mono tracking-wider transition-all"
            >
              {showAll ? (
                <>
                  <Dices className="mr-1.5 size-4" />
                  Voltar ao sorteio (6)
                </>
              ) : (
                <>
                  <Layers className="mr-1.5 size-4" />
                  Ver todas as {GUNDAM_SERIES_CATALOG.length} séries
                </>
              )}
            </Button>

            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 px-3 py-1 font-mono text-[11px] text-cyan-300">
              <Compass className="size-3.5 text-cyan-400 animate-spin" style={{ animationDuration: "12s" }} />
              Wiki em Construção
            </span>
          </div>
        </div>

        {/* Indicador de Status */}
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>
            Exibindo <strong className="text-cyan-300">{displayedSeries.length}</strong> de{" "}
            <strong>{GUNDAM_SERIES_CATALOG.length}</strong> sagas catalogadas
            {!showAll && " (selecionadas aleatoriamente para manter a página compacta)"}
          </span>
        </div>

        {/* Grade de Séries com Acordeão Interativo */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedSeries.map((series) => {
            const isOpen = selectedSeries === series.id;

            return (
              <div
                key={series.id}
                className={cn(
                  "group relative rounded-xl border bg-slate-950/90 transition-all duration-300 shadow-lg overflow-hidden flex flex-col justify-between",
                  series.colorAccent.split(" ")[0],
                  isOpen ? "border-cyan-400/70 shadow-[0_0_24px_rgba(6,182,212,0.2)]" : "hover:border-white/20"
                )}
              >
                <div className="p-5 space-y-3">
                  {/* Topo do Card da Série */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                        {series.timeline}
                      </span>
                      <h3 className="font-heading text-xl uppercase text-white mt-0.5 group-hover:text-cyan-300 transition-colors">
                        {series.name}
                      </h3>
                      {series.jpName && (
                        <p className="text-[11px] text-slate-400 font-sans">{series.jpName}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-300 border border-white/10">
                        {series.year}
                      </span>
                      <span className="font-mono text-[10px] text-cyan-400 font-medium">
                        {series.cardCount} cartas
                      </span>
                    </div>
                  </div>

                  {/* Resumo Rápido */}
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                    {series.description}
                  </p>

                  {/* Destaque Mecha e Presença no TCG */}
                  <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs">
                    <div className="flex items-center gap-2">
                      <Swords className="size-3.5 text-cyan-400 shrink-0" />
                      <span className="text-slate-400 text-[11px]">Destaques:</span>
                      <span className="text-white font-medium text-[11px] truncate">{series.highlightMecha}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Layers className="size-3.5 text-cyan-400 shrink-0" />
                      <span className="text-slate-400 text-[11px]">No TCG:</span>
                      <span className="text-cyan-300 text-[11px] truncate">{series.startersOrPacks}</span>
                    </div>
                  </div>

                  {/* Conteúdo Expandido do Acordeão */}
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-cyan-500/20 space-y-2.5 animate-in fade-in-50 duration-200">
                      <div className="rounded-lg bg-cyan-950/30 border border-cyan-500/20 p-3 text-xs">
                        <p className="font-semibold text-cyan-300 uppercase tracking-wider text-[10px]">
                          Estilo de Jogo no TCG:
                        </p>
                        <p className="mt-1 text-slate-300 text-[11px] leading-relaxed">{series.tcgStyle}</p>
                      </div>

                      <div className="rounded-lg bg-white/[0.02] border border-white/10 p-3 text-xs">
                        <p className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                          Futura Enciclopédia & Wiki:
                        </p>
                        <p className="mt-1 text-slate-400 text-[11px] leading-relaxed">
                          Ficha técnica de Mobile Suits, biografias de pilotos, relações de docking e guias de facções em português.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Rodapé com Ações */}
                <div className="p-3.5 px-5 border-t border-white/10 bg-slate-900/40 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => toggleAccordion(series.id)}
                    className="font-semibold uppercase tracking-wider text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
                  >
                    {isOpen ? "Menos Detalhes" : "Mais Detalhes"}
                    <ChevronDown className={cn("size-3.5 transition-transform duration-200", isOpen && "rotate-180")} />
                  </button>

                  <Link
                    href={`/cards?series=${encodeURIComponent(series.dbName)}&sort=code_asc`}
                    className="font-semibold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 text-[11px]"
                    title={`Ver as ${series.cardCount} cartas de ${series.name} no banco de dados`}
                  >
                    Ver Cartas ({series.cardCount}) <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Banner Informativo sobre a Futura Wiki */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-400 shrink-0">
              <BookOpen className="size-6" />
            </div>
            <div>
              <h4 className="font-heading text-lg uppercase text-white">
                Enciclopédia Wiki Anaheim HUB — Em Breve
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                Uma central temática completa com fichas de Mobile Suits, especificações de canhões e feixes,
                histórico de pilotos e árvores de linhagem de cada saga da franquia.
              </p>
            </div>
          </div>

          <Button asChild variant="outline" className="rounded-none border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 text-xs uppercase tracking-[0.14em] shrink-0">
            <Link href="/cards">
              Explorar Todas no Database <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

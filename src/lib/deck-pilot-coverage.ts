/* ---------------------------------------------------------------------------
 * Cobertura de Piloto de Link (ponte deckbuilder -> simulador) — ver
 * docs/48b-pilot-prerequisito.md.
 *
 * Regra oficial (Comprehensive Rules 3-2-6): uma Unit com Link Condition por
 * NOME de Piloto (ex.: Guntank ST01-004 -> "[Hayato Kobayashi]") só forma
 * "Link Unit" quando pareada com aquele Piloto nomeado. Isso NÃO é pré-requisito
 * pra jogar a carta — o Gundam GCG não tem "play-gate" nenhum (FASE 0 do
 * docs/48b conferiu as 1072 cartas oficiais: nenhuma diz "you can only play
 * this if ..."). Mas um deck que traz a Unit sem nenhuma fonte daquele Piloto
 * nunca vai conseguir o bônus de Link. É um check de COMPLETUDE de deck, não de
 * legalidade (docs/14 § "Validação de link condition ... é sobre jogabilidade")
 * — por isso vive fora de deck-legality.ts e gera AVISO, nunca erro.
 *
 * Fonte de um Piloto nomeado no deck:
 *  - carta PILOT nativa cujo nome CONTÉM o nome pedido (mesmo casamento por
 *    substring de satisfiesLinkCondition em engine/types.ts, regra 3-2-6-4);
 *  - carta Command/Pilot (【Pilot】[X] no rodapé) cujo pilotName (ou o [X] no
 *    texto) CONTÉM o nome pedido — jogável no modo Pilot, pareando como X.
 *
 * Pura, sem rede/Prisma — roda no navegador (deckbuilder) e em teste.
 * ------------------------------------------------------------------------- */

export interface PilotCoverageCard {
  code: string;
  /** Nome em inglês da carta (casamento por substring, igual satisfiesLinkCondition). */
  name: string;
  /** "UNIT" | "PILOT" | "COMMAND" | "COMMAND_PILOT" | "BASE" | "RESOURCE" | ... */
  cardType: string;
  /** Link Condition impressa: "[Amuro Ray]", "[A]/[B]", "(OZ) Trait", null/undefined. */
  linkText?: string | null;
  /** Command/Pilot: nome do Piloto que a carta pode parear no modo Pilot. */
  pilotName?: string | null;
  /** Texto de efeito — fallback pra extrair 【Pilot】[X] quando pilotName vier vazio. */
  effect?: string | null;
}

export interface PilotCoverageGap {
  /** code da Unit cujo Piloto de Link não tem fonte no deck. */
  unitCode: string;
  unitName: string;
  /** nome(s) de Piloto que a Link Condition pede (uma Unit pode listar "[A]/[B]"). */
  pilotNames: string[];
  /** aviso pronto pra exibir (pt-BR). */
  message: string;
}

const PILOT_TYPES = new Set(["PILOT"]);
const COMMAND_PILOT_TYPES = new Set(["COMMAND", "COMMAND_PILOT"]);

/**
 * Nomes entre colchetes de uma Link Condition por nome de Piloto.
 * "(OZ) Trait" / "(Neo Zeon) Trait" -> [] (link por trait, nunca gera aviso).
 */
export function parsePilotLinkNames(linkText: string | null | undefined): string[] {
  if (!linkText) return [];
  return [...linkText.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim()).filter(Boolean);
}

/**
 * Nome do Piloto que uma carta Command/Pilot pode parear. Prefere o campo
 * pilotName; cai pro [X] logo após 【Pilot】 no texto do efeito.
 */
function commandPilotName(card: PilotCoverageCard): string | null {
  if (card.pilotName && card.pilotName.trim()) return card.pilotName.trim();
  const match = (card.effect ?? "").match(/【Pilot】\s*\[([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

/**
 * Devolve as Units cujo Piloto de Link (por nome) não tem nenhuma fonte no deck.
 * Uma entrada por code de Unit (deck com 4 Guntank -> 1 aviso, não 4).
 */
export function computeDeckPilotCoverage(cards: PilotCoverageCard[]): PilotCoverageGap[] {
  const pilotSources: string[] = [];
  for (const card of cards) {
    if (PILOT_TYPES.has(card.cardType)) {
      if (card.name && card.name.trim()) pilotSources.push(card.name.trim());
    } else if (COMMAND_PILOT_TYPES.has(card.cardType)) {
      const paired = commandPilotName(card);
      if (paired) pilotSources.push(paired);
    }
  }

  // Mesma direção de satisfiesLinkCondition: o NOME DA FONTE contém o nome pedido.
  const isCovered = (wanted: string) => pilotSources.some((source) => source.includes(wanted));

  const gaps: PilotCoverageGap[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    if (card.cardType !== "UNIT") continue;
    const wanted = parsePilotLinkNames(card.linkText);
    if (wanted.length === 0) continue;
    // "[A]/[B]" — basta uma fonte pra qualquer um dos nomes.
    if (wanted.some(isCovered)) continue;
    if (seen.has(card.code)) continue;
    seen.add(card.code);
    gaps.push({
      unitCode: card.code,
      unitName: card.name,
      pilotNames: wanted,
      message: `[${card.name}] quer o Piloto ${wanted.map((n) => `[${n}]`).join(" ou ")} pra formar Link, mas não há fonte dele no deck.`,
    });
  }
  return gaps;
}

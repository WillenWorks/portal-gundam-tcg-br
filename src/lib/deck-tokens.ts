/* Motor de Detecção de Tokens de Decks — Portal Gundam TCG Brasil
 * Analisa as cartas do deck e identifica automaticamente se alguma delas gera
 * Tokens em campo, vinculando à carta de Token oficial (T-001 a T-020) com arte real. */

export interface DetectedToken {
  tokenCode: string;
  tokenName: string;
  tokenNamePt?: string | null;
  imageUrl?: string | null;
  imageMediumUrl?: string | null;
  ap?: number | null;
  hp?: number | null;
  color?: string | null;
  trait?: string | null;
  generatedBy: Array<{
    code: string;
    name: string;
    quantity: number;
  }>;
}

interface DeckCardLike {
  code?: string;
  name?: string;
  namePt?: string | null;
  effect?: string | null;
  quantity?: number;
}

interface OfficialTokenCard {
  id?: string;
  code: string;
  nameEn: string;
  namePt?: string | null;
  ap?: number | null;
  hp?: number | null;
  color?: string | null;
  trait?: string | null;
  imageUrl?: string | null;
  imageMediumUrl?: string | null;
  thumbUrl?: string | null;
}

/** Mapeamento de padrões comuns de texto de efeito para códigos canônicos de Token */
const TOKEN_PATTERNS: Array<{ pattern: RegExp; tokenCode: string; defaultName: string }> = [
  { pattern: /fatum-00/i, tokenCode: "T-011", defaultName: "Fatum-00 Token" },
  { pattern: /char'?s\s+zaku/i, tokenCode: "T-006", defaultName: "Char's Zaku II Token" },
  { pattern: /(?<!char'?s\s*)zaku\s*(?:ii|\s|\()/i, tokenCode: "T-007", defaultName: "Zaku II Token" },
  { pattern: /tallgeese/i, tokenCode: "T-005", defaultName: "Tallgeese Token" },
  { pattern: /aile\s+strike/i, tokenCode: "T-008", defaultName: "Aile Strike Gundam Token" },
  { pattern: /sword\s+strike/i, tokenCode: "T-010", defaultName: "Sword Strike Gundam Token" },
  { pattern: /launcher\s+strike/i, tokenCode: "T-009", defaultName: "Launcher Strike Gundam Token" },
  { pattern: /guncannon/i, tokenCode: "T-002", defaultName: "Guncannon Token" },
  { pattern: /guntank/i, tokenCode: "T-003", defaultName: "Guntank Token" },
  { pattern: /leo/i, tokenCode: "T-004", defaultName: "Leo Token" },
  { pattern: /daughtress/i, tokenCode: "T-012", defaultName: "Daughtress Token" },
  { pattern: /hy-gogg/i, tokenCode: "T-013", defaultName: "Hy-Gogg Token" },
  { pattern: /red\s+gundam/i, tokenCode: "T-018", defaultName: "Red Gundam Token" },
  { pattern: /gquuuuuux/i, tokenCode: "T-019", defaultName: "GQuuuuuuX Token" },
  { pattern: /gfred/i, tokenCode: "T-020", defaultName: "GFreD Token" },
  { pattern: /gundam\b/i, tokenCode: "T-001", defaultName: "Gundam Token" },
];

/**
 * Detecta quais tokens o deck é capaz de gerar.
 * Devolve apenas se houver pelo menos uma carta geradora.
 */
export function detectDeckTokens(
  deckCards: DeckCardLike[],
  officialTokens: OfficialTokenCard[] = []
): DetectedToken[] {
  const tokenMap = new Map<string, DetectedToken>();
  const officialByCode = new Map(officialTokens.map((t) => [t.code.toUpperCase(), t]));

  for (const card of deckCards) {
    const effect = (card.effect || "").toLowerCase();
    // Checa se a carta tem a palavra token
    if (!effect.includes("token")) continue;

    // Procura por quais tokens são gerados no efeito
    for (const entry of TOKEN_PATTERNS) {
      if (entry.pattern.test(effect)) {
        const official = officialByCode.get(entry.tokenCode.toUpperCase());
        const tokenCode = entry.tokenCode;

        if (!tokenMap.has(tokenCode)) {
          tokenMap.set(tokenCode, {
            tokenCode,
            tokenName: official?.namePt || official?.nameEn || entry.defaultName,
            tokenNamePt: official?.namePt,
            imageUrl: official?.imageMediumUrl || official?.imageUrl || null,
            imageMediumUrl: official?.imageMediumUrl || official?.imageUrl || null,
            ap: official?.ap ?? undefined,
            hp: official?.hp ?? undefined,
            color: official?.color ?? undefined,
            trait: official?.trait ?? undefined,
            generatedBy: [],
          });
        }

        const token = tokenMap.get(tokenCode)!;
        const exists = token.generatedBy.some((g) => g.code === card.code);
        if (!exists && card.code) {
          token.generatedBy.push({
            code: card.code,
            name: card.namePt || card.name || card.code,
            quantity: card.quantity || 1,
          });
        }
      }
    }
  }

  return Array.from(tokenMap.values());
}

/*
 * RAG de autoria (docs/44 §6.1) — dado o texto EN do efeito de uma carta nova,
 * rankeia os EffectSpec já autorados por semelhança de MECÂNICA, pra reaproveitar
 * o padrão da DSL em vez de inventar.
 *
 * Zero embeddings, zero serviço externo. Duas evidências somadas, ambas
 * explicáveis:
 *
 *   1. sobreposição de n-gramas de mecânica conhecidos (números normalizados
 *      pra `*`) entre o texto da query e o `sourceText` de cada spec, ponderada
 *      pelo nº de palavras do n-grama (match mais específico pesa mais);
 *   2. sobreposição de trigramas literais (números PRESERVADOS) — desempata a
 *      favor de quem casa o texto exato, inclusive a contagem ("top 3" ≠ "top 2").
 *
 * Consumido por `catalog.mjs` (tool MCP `gundam_similar_specs`) e testado
 * isoladamente em `similar-specs.test.mjs`.
 */

/** n-gramas de mecânica conhecidos — texto já minúsculo e com números -> `*`. */
export const MECHANIC_NGRAMS = [
  // deck / mão
  "look at the top",
  "cards of your deck",
  "bottom of your deck",
  "top of your deck",
  "your deck",
  "add this card to your hand",
  "return it to its owner's hand",
  "return it to",
  "to your hand",
  "your hand",
  "add * of your shields",
  "of your shields",
  "you may reveal",
  "you may deploy",
  "you may",
  // dano / combate
  "deal * damage",
  "damage to it",
  "battle damage",
  "can't be blocked",
  "can't receive battle damage",
  "can't attack during this turn",
  "during this turn",
  "during this battle",
  "end of your turn",
  // alvo
  "choose * enemy unit",
  "choose * friendly unit",
  "choose * of your units",
  "choose * of your resources",
  "choose * rested enemy unit",
  "enemy unit",
  "friendly unit",
  "this unit",
  "if this unit",
  "when this unit",
  "this unit gets",
  // stats
  "ap+",
  "ap-",
  "hp+",
  "hp-",
  "gets ap",
  "recovers * hp",
  "it recovers",
  // keywords
  "high-maneuver",
  "first strike",
  "blocker",
  "breach",
  "support",
  // recursos / tokens
  "set it as active",
  "set this unit as active",
  "as active",
  "rest it",
  "rest this",
  "deploy this card",
  "deploy * rested",
  "unit token",
  "rested",
  "place * ex resource",
  "ex resource",
  "activate this card's",
  // draw / discard
  "draw",
  "discard",
];

function collapse(text) {
  return String(text)
    .toLowerCase()
    .replace(/[【】<>()[\]:：･・/]/g, " ")
    .replace(/["'.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumbers(text) {
  return text.replace(/\d+/g, "*");
}

const wordCount = (ngram) => ngram.split(" ").length;

/** Conjunto de n-gramas de mecânica presentes no texto (números -> `*`). */
export function mechanicTokens(text) {
  const hay = ` ${normalizeNumbers(collapse(text))} `;
  const found = new Set();
  for (const ngram of MECHANIC_NGRAMS) {
    if (hay.includes(ngram)) found.add(ngram);
  }
  return found;
}

/** Trigramas de palavras, com os números PRESERVADOS (sinal de desempate). */
export function literalTrigrams(text) {
  const words = collapse(text).split(" ").filter(Boolean);
  const grams = [];
  for (let i = 0; i + 2 < words.length; i++) {
    grams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return grams;
}

export function scoreSignature(queryTokens, queryTrigrams, signature) {
  const specTokens = mechanicTokens(signature.sourceText);
  const matchedTokens = [];
  let tokenScore = 0;
  for (const token of queryTokens) {
    if (specTokens.has(token)) {
      matchedTokens.push(token);
      tokenScore += wordCount(token);
    }
  }

  const specTrigrams = new Set(literalTrigrams(signature.sourceText));
  let sharedTrigrams = 0;
  for (const gram of queryTrigrams) {
    if (specTrigrams.has(gram)) sharedTrigrams += 1;
  }

  const score = Math.round((tokenScore + 0.5 * sharedTrigrams) * 100) / 100;
  return { score, matchedTokens, sharedTrigrams };
}

/**
 * @param {Array<{id:string,cardCode:string,trigger:string,ops?:string[],sourceText:string}>} signatures
 * @param {string} effectEn
 * @param {number} [limit=3]
 */
export function rankSimilarSpecs(signatures, effectEn, limit = 3) {
  const queryTokens = mechanicTokens(effectEn);
  const queryTrigrams = literalTrigrams(effectEn);
  const n = Math.max(1, Math.min(50, Math.floor(Number(limit)) || 3));

  const ranked = signatures
    .map((signature) => {
      const { score, matchedTokens, sharedTrigrams } = scoreSignature(queryTokens, queryTrigrams, signature);
      return {
        id: signature.id,
        cardCode: signature.cardCode,
        trigger: signature.trigger,
        sourceText: signature.sourceText,
        ops: signature.ops ?? [],
        score,
        matchedTokens,
        sharedTrigrams,
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    query: effectEn,
    queryTokens: [...queryTokens],
    count: Math.min(n, ranked.length),
    results: ranked.slice(0, n),
  };
}

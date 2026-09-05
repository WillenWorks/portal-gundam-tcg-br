/*
 * Frente 2 -- Pipeline de traducao PT-BR do texto de efeito das cartas (docs/40).
 *
 * Fluxo (ver docs/40, secao 2.1):
 *
 *   data/gcg-official-cards.json (cards ST01..ST04)
 *          |
 *          v
 *   tokenize()  -> protege TODO token que nao pode ser traduzido (docs/17):
 *                  gatilhos 【 ... 】, keywords < ... >, nomes de carta [ ... ],
 *                  traits ( ... ), blocos de stat de ficha (( ... )), custos
 *                  circulados, e termos soltos de estatistica (AP/HP/Lv.X/Rest...).
 *                  Cada token vira um placeholder "§N§".
 *          |
 *          v
 *   buildPrompt() -> injeta o grounding do glossario (docs/17) + regras de estilo
 *                    gramatical pt-BR (imperativo: "Compre 1 carta", "Escolha 1
 *                    Unidade inimiga", ...).
 *          |
 *          v
 *   translateCard() -> Google Gemini REST (gemini-3.6-flash, temperature 0.15),
 *                      1 request por carta, retry com backoff em 429/5xx/timeout
 *                      (respeita o retryDelay que a API devolve no 429).
 *          |
 *          v
 *   restore() -> troca os "§N§" de volta pelos tokens originais.
 *          |
 *          v
 *   validate() -> compara o multiset de tokens protegidos EN x PT. Se um token
 *                 sumiu, duplicou, foi traduzido, ou sobrou placeholder ->
 *                 status "REJEITADO" com motivo.
 *          |
 *          +--> data/translations-st01-04.json  (lote pra revisao humana)
 *          +--> --apply: le o JSON e imprime os UPDATE SQL (nao conecta no banco)
 *
 * Modos:
 *   node scripts/translate-card-effects.mjs             -> roda o lote real (chama Gemini)
 *   node scripts/translate-card-effects.mjs --resume    -> igual, mas mantem as cartas
 *        que ja estao "OK" no JSON e so re-traduz as pendentes (util quando a quota
 *        do free tier estoura no meio -- rodar de novo depois retoma de onde parou)
 *   node scripts/translate-card-effects.mjs --dry-run   -> roda tokenizer+validador com
 *        traducao fake (identidade), sem gastar API -- so pra testar o encanamento
 *   node scripts/translate-card-effects.mjs --push      -> aplica as traducoes DIRETO
 *        no Postgres via Prisma Client (DATABASE_URL do .env). SEM shell/pipe ->
 *        UTF-8 intacto. E o modo recomendado pra aplicar localmente.
 *   node scripts/translate-card-effects.mjs --apply     -> le data/translations-st01-04.json
 *        e imprime os UPDATE SQL das traducoes OK (nao conecta no banco). CUIDADO:
 *        `--apply | psql` / `| prisma db execute` no Windows PowerShell corrompe
 *        UTF-8 (【 】 ･ e acentos viram "?"). Use `--apply > x.sql` (UTF-8) + rodar
 *        o arquivo, ou prefira `--push`.
 *   node scripts/translate-card-effects.mjs --revalidate -> re-roda o validador de
 *        tokens sobre o effectPt atual de cada linha do JSON (pra quando as
 *        traducoes foram preenchidas/editadas a mao) e reescreve status/motivo
 *
 * Env: GEMINI_MODEL (default gemini-3.6-flash), TRANSLATE_DELAY_MS (pausa entre cartas,
 *      default 500 -- suba pra ~15000 se o free tier reclamar de rate limit).
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_PATH = `${ROOT}data/gcg-official-cards.json`;
const OUTPUT_PATH = `${ROOT}data/translations-st01-04.json`;
const AI_ENV_PATH = `${ROOT}.spartan/ai.env`;

const SET_CODE_REGEX = /^ST0[1234]-/;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_500;
// 429 e comum no free tier do Gemini (limite por minuto). Da mais folego e respeita
// o retryDelay que a propria API devolve no corpo do erro.
const MAX_RETRIES_429 = 3;
const RETRY_429_FALLBACK_MS = 35_000;
// Depois de N cartas seguidas falhando por quota, para o lote (nao adianta insistir).
const QUOTA_ABORT_THRESHOLD = 3;
const BETWEEN_CARDS_DELAY_MS = Number(process.env.TRANSLATE_DELAY_MS ?? 500);

// ---------------------------------------------------------------------------
// 1. Grounding RAG leve -- resumo das regras do docs/17 embutido no prompt.
// ---------------------------------------------------------------------------

/** Termos que NUNCA sao traduzidos (docs/17). O tokenizer ja os protege, mas a
 *  lista tambem vai no prompt como reforco pro modelo. */
export const PROTECTED_TERMS = [
  // Gatilhos (entre 【 】)
  "Deploy", "Burst", "When Paired", "During Pair", "During Link", "When Linked",
  "Once per Turn", "Activate", "Main", "Action", "Attack", "Destroyed", "Deployed", "Pilot",
  // Keywords de efeito (entre < >)
  "Blocker", "Breach", "Repair", "Support", "First Strike", "High-Maneuver", "Suppression",
  // Estatisticas e atributos
  "AP", "HP", "Lv.", "Rest", "Active", "Cost", "Shield",
];

export const GLOSSARY_GROUNDING = `Voce e um tradutor tecnico do card game Gundam Trading Card Game para portugues do Brasil.
Traduz APENAS o texto livre que explica o que a carta faz. As palavras-chave oficiais do
jogo (Deploy, Burst, When Paired, During Pair, During Link, Once per Turn, Activate, Main,
Action, Blocker, Breach, Repair, Support, First Strike, High-Maneuver, Suppression, AP, HP,
Lv.X, Rest, Active, Cost, Shield) JAMAIS sao traduzidas -- jogadores usam esses termos em
ingles em torneio. Neste texto elas ja foram substituidas por marcadores no formato §N§
(§0§, §1§, ...). REGRAS ABSOLUTAS sobre os marcadores:
- Todo marcador §N§ do texto de entrada DEVE aparecer no texto traduzido, exatamente igual,
  a mesma quantidade de vezes. Nao invente, nao remova, nao renumere, nao traduza marcador.
- Marcadores representam substantivos ou nomes de jogo congelados. Encaixe a gramatica
  portuguesa ao redor deles.

ESTILO gramatical pt-BR (regras de carta, modo imperativo, conciso):
- "Draw X" -> "Compre X carta(s)".
- "Choose 1 enemy Unit" -> "Escolha 1 Unidade inimiga".
- "Choose 1 friendly Unit" -> "Escolha 1 Unidade aliada".
- "Deal X damage to it" -> "Cause X de dano a ela".
- "It gets AP+1 during this turn" -> "Ela recebe AP+1 durante este turno".
- "this Unit" -> "esta Unidade"; "that opponent" -> "aquele oponente".
- "Unit" traduz para "Unidade"; "Base" continua "Base"; "shield area" -> "area de escudo";
  "deck" continua "deck"; "hand" -> "mao"; "trash" -> "lixo"; "Resource" -> "Recurso";
  "Unit token" -> "ficha de Unidade"; "Link Unit" -> "Unidade com Link".
- "recovers X HP" -> "recupera X de HP".
- "At the end of your turn" -> "No fim do seu turno".
- "during this turn" -> "durante este turno"; "during this battle" -> "durante esta batalha".
- Use "voce" (nunca "tu"). Frases curtas, terminando em ponto final.
- Preserve a quebra de linha entre secoes de efeito (uma secao por linha).

Responda SOMENTE com o texto traduzido, sem aspas, sem comentario, sem rotulo.`;

// ---------------------------------------------------------------------------
// 2. Tokenizer lexico.
// ---------------------------------------------------------------------------

/** Decide se um conteudo entre parenteses e um trait / nome proprio (protege) ou
 *  texto explicativo (traduz). Regra docs/40: protege so quando e 1-3 palavras
 *  capitalizadas sem verbo (ex: "Zeon", "Neo Zeon", "White Base Team", "OZ"). */
export function isProperNounParen(inner) {
  const trimmed = inner.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/[\s･]+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return false;
  return words.every((word) => /^[A-Z][A-Za-z0-9'’-]*$/.test(word));
}

/** Protetores aplicados EM ORDEM sobre a string de trabalho. Cada um recebe o
 *  texto atual e um `push(original) -> "§N§"`, e devolve o texto com os tokens
 *  protegidos ja substituidos por placeholders. */
const PROTECTORS = [
  // Gatilhos entre 【 】 -- protege o conteudo inteiro (inclui 【Activate･Main】,
  // 【When Paired･(White Base Team) Pilot】, 【Main】/【Action】 vira 2 tokens).
  (text, push) => text.replace(/【[^】]*】/g, (m) => push(m)),
  // Nomes proprios / referencias de carta entre [ ] (sempre nome nesse jogo).
  (text, push) => text.replace(/\[[^\]]*\]/g, (m) => push(m)),
  // Blocos de stat de ficha: (( trait )･APx･HPx[･<...>] ) -- protege inteiro.
  (text, push) => text.replace(/\(\([^()]*\)[^()]*\)/g, (m) => push(m)),
  // Keywords de efeito entre < >.
  (text, push) => text.replace(/<[^>]*>/g, (m) => push(m)),
  // Custos circulados (①..⑳) usados em 【Activate･Main】②：...
  (text, push) => text.replace(/[①-⑳]/g, (m) => push(m)),
  // Parenteses: trait / nome proprio protege; texto explicativo fica pra traduzir.
  (text, push) =>
    text.replace(/\([^()]*\)/g, (m) => {
      const inner = m.slice(1, -1);
      return isProperNounParen(inner) ? push(m) : m;
    }),
  // Estatisticas soltas: AP / HP com valor colado (AP+1, AP-3, HP3) ou sozinhas.
  (text, push) => text.replace(/\b(?:AP|HP)(?:[+\-]?\d+)?\b/g, (m) => push(m)),
  // Nivel: Lv.1 .. Lv.9
  (text, push) => text.replace(/\bLv\.\d\b/g, (m) => push(m)),
  // Termos de estado / atributo (case-sensitive -- so a forma oficial capitalizada).
  (text, push) => text.replace(/\b(?:Rest|Active|Cost|Shield)\b/g, (m) => push(m)),
];

/**
 * Isola os tokens protegidos de `effectEn`.
 * @returns {{ masked: string, tokens: string[] }}
 */
export function tokenize(effectEn) {
  const tokens = [];
  const push = (original) => {
    const index = tokens.length;
    tokens.push(original);
    return `§${index}§`;
  };
  let masked = effectEn;
  for (const protector of PROTECTORS) {
    masked = protector(masked, push);
  }
  return { masked, tokens };
}

/** Recompoe o texto traduzido trocando cada "§N§" pelo token original. */
export function restore(maskedTranslation, tokens) {
  return maskedTranslation.replace(/§(\d+)§/g, (whole, digits) => {
    const index = Number(digits);
    return index >= 0 && index < tokens.length ? tokens[index] : whole;
  });
}

// ---------------------------------------------------------------------------
// 3. Validador de integridade de tokens.
// ---------------------------------------------------------------------------

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}

/**
 * Valida a traducao restaurada contra o texto EN original.
 * @returns {{ ok: boolean, motivo?: string }}
 */
export function validate(effectEn, effectPt, tokens) {
  if (/§\d*§/.test(effectPt)) {
    return { ok: false, motivo: "placeholder §N§ nao restaurado no texto traduzido" };
  }

  // Consome cada token do texto PT (do maior pro menor, pra "AP+1" sair antes de
  // "AP"). Se um token nao for achado -> sumiu ou foi traduzido.
  let residual = effectPt;
  const consumeOrder = [...tokens].sort((a, b) => b.length - a.length);
  for (const token of consumeOrder) {
    const at = residual.indexOf(token);
    if (at === -1) {
      return { ok: false, motivo: `token protegido ausente ou traduzido: "${token}"` };
    }
    residual = residual.slice(0, at) + residual.slice(at + token.length);
  }

  // Multiset EN x PT: cada token distinto tem que aparecer a mesma qtd de vezes.
  for (const token of new Set(tokens)) {
    const inEn = countOccurrences(effectEn, token);
    const inPt = countOccurrences(effectPt, token);
    if (inEn !== inPt) {
      return {
        ok: false,
        motivo: `token "${token}" aparece ${inPt}x no PT vs ${inEn}x no EN (sumiu ou duplicou)`,
      };
    }
  }

  // Depois de remover todos os tokens conhecidos, nao pode sobrar marca de
  // gatilho / keyword / nome / placeholder -- se sobrou, o modelo criou ou
  // traduziu um token (ex: 【Implantar】, <Bloqueador>).
  if (/[【】]/.test(residual)) {
    return { ok: false, motivo: "sobrou gatilho 【...】 nao reconhecido (token extra ou traduzido)" };
  }
  if (/<[^\s>]/.test(residual)) {
    return { ok: false, motivo: "sobrou keyword <...> nao reconhecida (token extra ou traduzido)" };
  }
  if (/\[[^\]]+\]/.test(residual)) {
    return { ok: false, motivo: "sobrou referencia [...] nao reconhecida (token extra ou traduzido)" };
  }
  if (/\b(?:AP|HP)\b/.test(residual) || /\bLv\.\d\b/.test(residual)) {
    return { ok: false, motivo: "sobrou estatistica (AP/HP/Lv.) extra no texto traduzido" };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 4. Motor de traducao (Google Gemini REST).
// ---------------------------------------------------------------------------

async function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const raw = await readFile(AI_ENV_PATH, "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith("GEMINI_API_KEY="));
  if (!line) throw new Error(`GEMINI_API_KEY nao encontrado em ${AI_ENV_PATH}`);
  return line.slice("GEMINI_API_KEY=".length).trim();
}

export function buildPrompt(maskedEn) {
  return `${GLOSSARY_GROUNDING}\n\nTexto de efeito (em ingles, com marcadores §N§) para traduzir:\n---\n${maskedEn}\n---\nTraducao em portugues do Brasil:`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/** Extrai o retryDelay (ex: "27s") do corpo de erro 429 do Gemini, em ms. */
function parseRetryDelayMs(errorText) {
  const match = errorText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Math.ceil(Number(match[1]) * 1000) : null;
}

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.15 },
  };

  let lastError;
  let attempt = 0;
  let seen429 = 0;
  for (;;) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const is429 = response.status === 429;
        const budget = is429 ? MAX_RETRIES_429 : MAX_RETRIES;
        const tries = is429 ? (seen429 += 1) : attempt;
        if (isRetryableStatus(response.status) && tries < budget) {
          lastError = new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
          const wait = is429
            ? (parseRetryDelayMs(text) ?? RETRY_429_FALLBACK_MS) + Math.floor(Math.random() * 2_000)
            : RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
          await sleep(wait);
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      const json = await response.json();
      const parts = json?.candidates?.[0]?.content?.parts;
      const textOut = Array.isArray(parts) ? parts.map((p) => p?.text ?? "").join("").trim() : "";
      if (!textOut) throw new Error(`resposta sem texto: ${JSON.stringify(json).slice(0, 300)}`);
      return textOut;
    } catch (error) {
      lastError = error;
      if (/HTTP \d/.test(String(error?.message))) throw error;
      const retryable = error?.name === "AbortError" || error?.code === "ENOTFOUND" || error?.code === "ECONNRESET";
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Limpa cercas de codigo / aspas que o modelo as vezes envolve na resposta. */
function cleanModelOutput(text) {
  let out = text.trim();
  const fence = out.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
  if (fence) out = fence[1].trim();
  return out;
}

// ---------------------------------------------------------------------------
// 5. Orquestracao do lote.
// ---------------------------------------------------------------------------

async function loadSourceCards() {
  const parsed = JSON.parse(await readFile(SOURCE_PATH, "utf8"));
  const cards = Array.isArray(parsed) ? parsed : parsed.cards;
  if (!Array.isArray(cards)) throw new Error(`formato inesperado em ${SOURCE_PATH}`);
  return cards
    .filter((c) => SET_CODE_REGEX.test(c.code ?? ""))
    .map((c) => ({
      code: c.code,
      name: c.name ?? c.nameEn ?? "",
      set: c.setCode ?? c.code.slice(0, 4),
      cardType: c.cardType ?? "",
      effectEn: typeof c.effect === "string" ? c.effect.trim() : "",
    }));
}

/** @param {(maskedEn: string) => Promise<string>} translateFn */
async function translateCard(card, translateFn) {
  const hasEffect = card.effectEn && card.effectEn !== "-";
  if (!hasEffect) {
    return {
      code: card.code,
      name: card.name,
      set: card.set,
      effectEn: card.effectEn,
      effectPt: null,
      status: "OK",
      motivo: "carta sem texto de efeito (nada a traduzir)",
      tokens: [],
    };
  }

  const { masked, tokens } = tokenize(card.effectEn);
  try {
    const rawTranslation = await translateFn(masked);
    const maskedPt = cleanModelOutput(rawTranslation);
    const effectPt = restore(maskedPt, tokens);
    const verdict = validate(card.effectEn, effectPt, tokens);
    return {
      code: card.code,
      name: card.name,
      set: card.set,
      effectEn: card.effectEn,
      effectPt,
      status: verdict.ok ? "OK" : "REJEITADO",
      ...(verdict.ok ? {} : { motivo: verdict.motivo }),
      tokens,
    };
  } catch (error) {
    return {
      code: card.code,
      name: card.name,
      set: card.set,
      effectEn: card.effectEn,
      effectPt: null,
      status: "REJEITADO",
      motivo: `erro na traducao: ${String(error?.message ?? error).slice(0, 200)}`,
      tokens,
    };
  }
}

/** No --resume, uma carta so conta como "pronta" se: nao tem efeito (nada a traduzir),
 *  ou foi traduzida DE VERDADE (status OK e effectPt != effectEn -- descarta o
 *  identity do --dry-run e casos onde o modelo devolveu o texto sem mexer). */
function isResolvedResult(row) {
  if (!row || row.status !== "OK") return false;
  if (!row.effectPt) return true;
  return row.effectPt.trim() !== (row.effectEn ?? "").trim();
}

/** Monta o array completo (ordem do source) pra gravacao incremental: usa o que ja
 *  foi processado nesta rodada e completa o resto com o JSON anterior, se houver. */
function mergeResults(cards, processed, previousByCode) {
  const processedByCode = new Map(processed.map((r) => [r.code, r]));
  const out = [];
  for (const card of cards) {
    const row = processedByCode.get(card.code) ?? previousByCode.get(card.code);
    if (row) out.push(row);
  }
  return out;
}

async function loadExistingResults() {
  try {
    const parsed = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function runBatch({ dryRun, resume }) {
  const cards = await loadSourceCards();
  console.log(`Cartas ST01-ST04 encontradas: ${cards.length}`);

  const previousByCode = new Map();
  if (resume) {
    const previous = await loadExistingResults();
    for (const row of previous) previousByCode.set(row.code, row);
    const done = [...previousByCode.values()].filter(isResolvedResult).length;
    console.log(`Modo --resume: ${done} cartas ja resolvidas no JSON existente, so re-traduz as pendentes.`);
  }

  let translateFn;
  if (dryRun) {
    console.log("Modo --dry-run: traducao identidade (nao chama a API).");
    translateFn = async (maskedEn) => maskedEn;
  } else {
    const apiKey = await loadApiKey();
    console.log(`Modo real: Gemini ${GEMINI_MODEL}, temperature 0.15, 1 request/carta.`);
    translateFn = async (maskedEn) => callGemini(apiKey, buildPrompt(maskedEn));
  }

  const results = [];
  let consecutiveQuotaFails = 0;
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    const cached = previousByCode.get(card.code);
    if (resume && isResolvedResult(cached)) {
      results.push(cached);
      console.log(`  [keep] ${card.code} ${card.name} (ja resolvida)`);
      continue;
    }
    const result = await translateCard(card, translateFn);
    results.push(result);

    const quotaFail = result.status === "REJEITADO" && /HTTP 429|RESOURCE_EXHAUSTED|quota/i.test(result.motivo ?? "");
    consecutiveQuotaFails = quotaFail ? consecutiveQuotaFails + 1 : 0;
    if (consecutiveQuotaFails >= QUOTA_ABORT_THRESHOLD) {
      console.log("");
      console.log(`Abortando: ${consecutiveQuotaFails} falhas seguidas de quota (free tier esgotado).`);
      console.log("Rode 'node scripts/translate-card-effects.mjs --resume' de novo quando a quota resetar.");
      for (let j = i + 1; j < cards.length; j += 1) {
        const next = cards[j];
        const pending = previousByCode.get(next.code);
        if (pending) {
          results.push(pending);
          continue;
        }
        const noEffect = !next.effectEn || next.effectEn === "-";
        results.push({
          code: next.code,
          name: next.name,
          set: next.set,
          effectEn: next.effectEn,
          effectPt: null,
          status: noEffect ? "OK" : "REJEITADO",
          motivo: noEffect ? "carta sem texto de efeito (nada a traduzir)" : "nao processada -- lote abortado por quota (rode --resume)",
          tokens: noEffect ? [] : tokenize(next.effectEn).tokens,
        });
      }
      break;
    }
    const tag = result.status === "OK" ? "OK " : "REJ";
    console.log(`  [${tag}] ${result.code} ${result.name}${result.motivo ? ` -- ${result.motivo}` : ""}`);
    // Grava incremental -- se a quota estourar no meio, o progresso nao se perde.
    await writeFile(OUTPUT_PATH, `${JSON.stringify(mergeResults(cards, results, previousByCode), null, 2)}\n`, "utf8");
    if (!dryRun && i < cards.length - 1) await sleep(BETWEEN_CARDS_DELAY_MS);
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf8");

  const ok = results.filter((r) => r.status === "OK").length;
  const rejected = results.filter((r) => r.status === "REJEITADO").length;
  const translated = results.filter((r) => r.status === "OK" && r.effectPt).length;
  console.log("");
  console.log(`Resumo: ${ok} OK (${translated} com texto traduzido), ${rejected} REJEITADAS.`);
  console.log(`Arquivo gerado: ${OUTPUT_PATH}`);
  if (rejected > 0) {
    console.log("Revise as REJEITADAS no JSON antes de rodar --apply.");
  }
}

// ---------------------------------------------------------------------------
// 6. --apply: le o JSON e imprime os UPDATE SQL (nao conecta no banco).
// ---------------------------------------------------------------------------

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

/**
 * O JSON guarda os gatilhos no formato oficial 【...】 (mesma fonte que o
 * simulador usa). O catalogo no Postgres, porem, guarda effectEn com gatilho
 * entre colchetes [ ... ] e quebra de linha como <br> (0 de 52 cartas ST01-04
 * usam 【】). Pra o effectPt ficar consistente com o effectEn exibido lado a
 * lado, --apply converte: 【X】 -> [X], quebra de linha -> <br>. Keywords <X>
 * ficam como estao (forma oficial, mantida na maioria das cartas). */
export function normalizeForCatalog(effectPt) {
  return effectPt
    .replace(/\r?\n/g, "<br>")
    // 【X】 -> [X] com 1 espaco depois (o catalogo escreve "[Deploy] Escolha ..."),
    // menos quando ja vem <br> ou "/" logo apos.
    .replace(/【([^】]*)】(?!<br>|\/)\s*/g, "[$1] ")
    .replace(/【([^】]*)】/g, "[$1]");
}

async function runApply() {
  const results = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
  const applicable = results.filter((r) => r.status === "OK" && r.effectPt);
  console.error(`-- Traducoes OK com texto: ${applicable.length} (de ${results.length} no lote)`);
  console.error("-- Rode este SQL no Postgres do catalogo. Atualiza CardModel e os prints (Card).");
  console.error("-- effectPt normalizado pro formato do catalogo: 【X】 -> [X], quebra -> <br>.");
  console.log("BEGIN;");
  for (const row of applicable) {
    const value = sqlEscape(normalizeForCatalog(row.effectPt));
    const code = sqlEscape(row.code);
    console.log(`UPDATE "CardModel" SET "effectPt" = '${value}' WHERE code = '${code}';`);
    console.log(`UPDATE "Card" SET "effectPt" = '${value}' WHERE code = '${code}';`);
  }
  console.log("COMMIT;");
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 7. --revalidate: re-roda validate() sobre o effectPt atual de cada linha do
//    JSON (util quando as traducoes foram editadas/preenchidas a mao) e
//    reescreve status/motivo. Nao chama a API.
// ---------------------------------------------------------------------------

async function runRevalidate() {
  const rows = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
  let ok = 0;
  let rejected = 0;
  const out = rows.map((row) => {
    const hasEffect = row.effectEn && row.effectEn !== "-";
    if (!hasEffect) {
      ok += 1;
      return { ...row, status: "OK", motivo: "carta sem texto de efeito (nada a traduzir)", effectPt: null };
    }
    if (!row.effectPt) {
      rejected += 1;
      return { ...row, status: "REJEITADO", motivo: "effectPt vazio" };
    }
    const tokens = tokenize(row.effectEn).tokens;
    const verdict = validate(row.effectEn, row.effectPt, tokens);
    if (verdict.ok) {
      ok += 1;
      const { motivo, ...rest } = row;
      void motivo;
      return { ...rest, status: "OK", tokens };
    }
    rejected += 1;
    return { ...row, status: "REJEITADO", motivo: verdict.motivo, tokens };
  });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  const translated = out.filter((r) => r.status === "OK" && r.effectPt).length;
  console.log(`Revalidacao: ${ok} OK (${translated} com texto), ${rejected} REJEITADAS.`);
  for (const r of out.filter((r) => r.status === "REJEITADO")) {
    console.log(`  [REJ] ${r.code} ${r.name} -- ${r.motivo}`);
  }
}

// ---------------------------------------------------------------------------
// 8. --push: aplica as traducoes DIRETO no Postgres via Prisma Client.
//    Usa DATABASE_URL do .env. NAO passa por shell/pipe -> nao corrompe UTF-8
//    (o `--apply | psql` no Windows vira mojibake: 【 】 ･ acentos viram "?").
//    Prefira ESTE modo pra aplicar localmente.
// ---------------------------------------------------------------------------

async function runPush() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const rows = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    const applicable = rows.filter((r) => r.status === "OK" && r.effectPt);
    console.log(`Aplicando ${applicable.length} traducoes via Prisma (DATABASE_URL do .env)...`);
    let models = 0;
    let prints = 0;
    for (const row of applicable) {
      const pt = normalizeForCatalog(row.effectPt);
      const m = await prisma.cardModel.updateMany({ where: { code: row.code }, data: { effectPt: pt } });
      const c = await prisma.card.updateMany({ where: { code: row.code }, data: { effectPt: pt } });
      models += m.count;
      prints += c.count;
    }
    console.log(`OK: CardModel ${models} linhas, Card ${prints} prints.`);
    if (models === 0) {
      console.log("AVISO: 0 CardModel atualizado -- o catalogo ST01-04 esta semeado neste banco? (pnpm run catalog:bootstrap)");
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--push")) {
    await runPush();
    return;
  }
  if (args.has("--apply")) {
    await runApply();
    return;
  }
  if (args.has("--revalidate")) {
    await runRevalidate();
    return;
  }
  await runBatch({ dryRun: args.has("--dry-run"), resume: args.has("--resume") });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

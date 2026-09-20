import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDef } from "../src/modules/simulator/engine/types.ts";
import type { DeckList } from "../src/modules/simulator/engine/setup.ts";
import { ALL_EFFECT_SPECS } from "../src/modules/simulator/content/index.ts";
import { buildDeckListFromUserDeck, UserDeckSimulatorError, type UserDeckInput } from "../src/modules/simulator/content/userDeckBuilder.ts";

/**
 * Gate de segurança server-side (docs/debates 2026-09-13 — achado da auditoria
 * do Claude: liberar GD01 só em VALIDATED_DECKS/DECK_OPTIONS no cliente não
 * basta, porque Treino Solo aceita QUALQUER deck do próprio jogador via
 * `buildDeckListFromUserDeck` — um deck montado no deckbuilder com cartas de
 * GD02+ (0% de cobertura) ou de uma cláusula GD01 ainda deferida chegaria
 * direto no motor sem checagem nenhuma, o mesmo tipo de estado sem regra que
 * já causou o travamento real de ~4h relatado em playtest manual.
 *
 * Mesmo critério de `scripts/gundam-coverage.mjs` (status "vanilla" /
 * "implementada" / "implementada*" = jogável; "deferida" / "faltando" =
 * bloqueado) — reimplementado aqui (não importado do script, que é uma CLI
 * standalone) e mantido server-only de propósito: lê `data/gcg-official-cards.json`
 * via `node:fs`, algo que não pode entrar em `src/modules/simulator/content/`
 * porque esses módulos também são bundlados pro cliente (Vite/browser não
 * tem `fs`).
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface OfficialCard {
  code: string;
  effect?: string;
}

const OFFICIAL_CARDS_PATH = path.join(REPO_ROOT, "data/gcg-official-cards.json");

let OFFICIAL_CARDS: OfficialCard[];
try {
  OFFICIAL_CARDS = JSON.parse(readFileSync(OFFICIAL_CARDS_PATH, "utf8")).cards;
} catch (err) {
  // Falha aqui derruba o boot do processo inteiro (é dado crítico do gate de
  // segurança — não dá pra mascarar rodando sem catálogo), mas sem essa
  // mensagem específica o erro cru (ENOENT/SyntaxError do JSON.parse) chega
  // ao operador como um stack trace genérico difícil de diagnosticar às
  // pressas.
  const reason = err instanceof Error ? err.message : String(err);
  throw new Error(
    `Falha ao carregar catálogo oficial de cartas em ${OFFICIAL_CARDS_PATH} — verifique se o arquivo existe e é um JSON válido. Causa: ${reason}`,
    { cause: err },
  );
}

const EFFECT_TEXT_BY_CODE = new Map(OFFICIAL_CARDS.map((c) => [c.code, c.effect ?? ""]));
const CODES_WITH_SPEC = new Set(ALL_EFFECT_SPECS.map((s) => s.cardCode));
/** Códigos reais do catálogo (`data/gcg-official-cards.json`) — inclui Units/Pilots/Commands/Bases E tokens (T-XXX), mas NUNCA os placeholders sintéticos de recurso (`<SET>-RESOURCE`), que não são cartas catalogadas de propósito. */
const KNOWN_CODES = new Set(OFFICIAL_CARDS.map((c) => c.code));

/** Mesma heurística de `scripts/gundam-coverage.mjs` — `true` se o texto tem regra além de keyword automática / 【Pilot】[X] / vazio. */
function hasBespokeText(effect: string): boolean {
  if (!effect || effect.trim() === "-" || effect.trim() === "") return false;
  let s = effect
    .replace(/【Pilot】\s*\[[^\]]*\]/g, " ")
    .replace(/【[^】]*】/g, " ")
    .replace(/<[^>]+>/g, " ");
  let prev: string;
  do {
    prev = s;
    s = s.replace(/\([^()]*\)/g, " ");
  } while (s !== prev);
  return s.replace(/[［］[\]･・、。.,\s]+/g, " ").trim().length > 0;
}

/**
 * `true` se o motor cobre `def` o bastante pra entrar numa partida real:
 * sem texto bespoke (vanilla — keyword automática já tratada em combat.ts/
 * keywords.ts), OU tem EffectSpec cadastrado (implementada/implementada*),
 * OU tem campo estruturado (staticAbilities/combatTriggers/attackTargetRules).
 * `false` = "deferida"/"faltando" — bloqueia a carta.
 *
 * Códigos que não existem no catálogo oficial são bloqueados EXPLICITAMENTE
 * (nunca tratados como "vanilla por padrão" — achado da auditoria: sem essa
 * checagem, um `cardCode` forjado/inexistente no payload passaria como
 * jogável só por não ter texto de efeito pra classificar). Exceção: as
 * cartas de recurso genéricas (`cardType: "RESOURCE"`, ex. `GD01-RESOURCE`)
 * não são catalogadas de propósito (são um placeholder do motor, não uma
 * carta real) — sempre jogáveis.
 */
export function isCardPlayable(def: Pick<CardDef, "code" | "cardType" | "staticAbilities" | "combatTriggers" | "attackTargetRules">): boolean {
  if (def.cardType === "RESOURCE") return true;
  if (!KNOWN_CODES.has(def.code)) return false;
  const effect = EFFECT_TEXT_BY_CODE.get(def.code) ?? "";
  if (!hasBespokeText(effect)) return true;
  if (CODES_WITH_SPEC.has(def.code)) return true;
  if (def.staticAbilities?.length || def.combatTriggers?.length || def.attackTargetRules) return true;
  return false;
}

export interface DeckPayloadValidation {
  valid: boolean;
  /** códigos únicos, ordenados, de cartas sem cobertura suficiente no motor. */
  unplayableCards: string[];
}

/** Rejeita o deck se QUALQUER carta (principal ou de recurso) não tiver cobertura no motor. */
export function validateDeckPayload(deck: DeckList): DeckPayloadValidation {
  const unplayable = new Set<string>();
  for (const card of [...deck.main, ...deck.resources]) {
    if (!isCardPlayable(card)) unplayable.add(card.code);
  }
  return { valid: unplayable.size === 0, unplayableCards: [...unplayable].sort() };
}

export interface UserDeckCoverage {
  valid: boolean;
  /** códigos sem cobertura no motor — tanto os que `buildDeckListFromUserDeck` nem reconhece quanto os que `validateDeckPayload` rejeita por cláusula ainda não implementada. */
  unplayableCards: string[];
  /** motivo legível quando `buildDeckListFromUserDeck` falha por um jeito que não é "carta sem cobertura" (ex.: contagem de cartas errada). */
  reason?: string;
  /** `DeckList` já montada, presente sempre que `buildDeckListFromUserDeck` não lançou (mesmo quando `valid` é `false` por cobertura). */
  list?: DeckList;
}

/**
 * Mesmo gate de `validateDeckPayload`, só que a partir de um deck CRU do
 * banco (Prisma `Deck` + `DeckItem[]`/`Card`) — usado pra sinalizar
 * verde/vermelho os decks do próprio jogador nas telas do simulador
 * (Fila Online, Convite Direto, Treino Solo) e pra bloquear no servidor caso
 * o cliente insista em mandar um deck vermelho mesmo assim (docs/debates
 * 2026-09-14, pedido do Willen — "permita que o usuário use o seu próprio
 * deck... impeça decks com cartas não mapeadas").
 */
export function checkUserDeckSimulatorCoverage(deck: UserDeckInput): UserDeckCoverage {
  let list: DeckList;
  try {
    list = buildDeckListFromUserDeck(deck);
  } catch (err) {
    if (err instanceof UserDeckSimulatorError) {
      return { valid: false, unplayableCards: err.unsupportedCodes ?? [], reason: err.message };
    }
    throw err;
  }
  const validation = validateDeckPayload(list);
  return { valid: validation.valid, unplayableCards: validation.unplayableCards, list };
}

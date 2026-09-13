import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDef } from "../src/modules/simulator/engine/types.ts";
import type { DeckList } from "../src/modules/simulator/engine/setup.ts";
import { ALL_EFFECT_SPECS } from "../src/modules/simulator/content/index.ts";

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

const OFFICIAL_CARDS: OfficialCard[] = JSON.parse(
  readFileSync(path.join(REPO_ROOT, "data/gcg-official-cards.json"), "utf8"),
).cards;

const EFFECT_TEXT_BY_CODE = new Map(OFFICIAL_CARDS.map((c) => [c.code, c.effect ?? ""]));
const CODES_WITH_SPEC = new Set(ALL_EFFECT_SPECS.map((s) => s.cardCode));

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
  return s.replace(/[［］\[\]･・、。.,\s]+/g, " ").trim().length > 0;
}

/**
 * `true` se o motor cobre `def` o bastante pra entrar numa partida real:
 * sem texto bespoke (vanilla — keyword automática já tratada em combat.ts/
 * keywords.ts), OU tem EffectSpec cadastrado (implementada/implementada*),
 * OU tem campo estruturado (staticAbilities/combatTriggers/attackTargetRules).
 * `false` = "deferida"/"faltando" — bloqueia a carta.
 */
export function isCardPlayable(def: Pick<CardDef, "code" | "staticAbilities" | "combatTriggers" | "attackTargetRules">): boolean {
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

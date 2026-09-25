import type { DeckList } from "../src/modules/simulator/engine/setup.ts";
import type { UserDeckInput } from "../src/modules/simulator/content/userDeckBuilder.ts";
import type { PoolFileDeck } from "../src/modules/simulator/fixtures/benchmarkDeckPools.ts";
import { validateGeneratedDeckLegality } from "../src/modules/simulator/engine/bot/zeroCounterDeckBuilder.ts";
import { checkUserDeckSimulatorCoverage } from "./deckCoverageGate.ts";

/**
 * Pool de decks do bot a partir dos dados cadastrados (spec bot-dados-pool): listas
 * de torneio (`TournamentEntry → DeckSnapshot`) e decks públicos viram decks da
 * matriz de confrontos do Zero System. Só entram listas que o motor joga (mesmo
 * gate do Treino Solo) e legais; a mesma lista em vários lugares vira uma só.
 */

export interface DbDeckCandidate {
  id: string;
  label: string;
  source: "tournament" | "public";
  archetype?: string | null;
  placement?: number | null;
  deck: UserDeckInput;
}

export interface RejectedDeck {
  id: string;
  label: string;
  reason: string;
}

export interface BotDeckPoolResult {
  decks: PoolFileDeck[];
  rejected: RejectedDeck[];
  duplicates: number;
}

function signature(list: DeckList): string {
  return [...list.main.map((c) => c.code)].sort().join(",") + "|" + [...list.resources.map((c) => c.code)].sort().join(",");
}

/** torneio antes de público; dentro do torneio, melhor colocação primeiro */
function priority(c: DbDeckCandidate): number {
  if (c.source === "tournament") return c.placement ?? 999;
  return 10_000;
}

export function buildBotDeckPool(candidates: DbDeckCandidate[], opts: { max: number }): BotDeckPoolResult {
  const rejected: RejectedDeck[] = [];
  const bySignature = new Map<string, { candidate: DbDeckCandidate; list: DeckList }>();
  let duplicates = 0;

  for (const candidate of [...candidates].sort((x, y) => priority(x) - priority(y))) {
    const coverage = checkUserDeckSimulatorCoverage(candidate.deck);
    if (!coverage.valid || !coverage.list) {
      const reason = coverage.reason ?? `cartas sem cobertura no motor: ${coverage.unplayableCards.join(", ")}`;
      rejected.push({ id: candidate.id, label: candidate.label, reason });
      continue;
    }
    const legality = validateGeneratedDeckLegality(coverage.list);
    if (!legality.valid) {
      rejected.push({ id: candidate.id, label: candidate.label, reason: `lista ilegal: ${legality.issues.join("; ")}` });
      continue;
    }
    const sig = signature(coverage.list);
    if (bySignature.has(sig)) {
      duplicates++;
      continue; // ordem por prioridade: a primeira já é a de melhor colocação
    }
    bySignature.set(sig, { candidate, list: coverage.list });
  }

  const decks = [...bySignature.values()].slice(0, opts.max).map(({ candidate, list }) => ({
    id: candidate.id,
    label: candidate.label,
    source: candidate.source,
    archetype: candidate.archetype ?? null,
    placement: candidate.placement ?? null,
    list: { main: list.main.map((c) => c.code), resources: list.resources.map((c) => c.code) },
  }));
  return { decks, rejected, duplicates };
}

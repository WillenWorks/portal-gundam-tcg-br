import type { ZeroCounterSummary } from "@/modules/simulator/engine/bot/zeroCounter";

const PERSONA_LABEL: Record<ZeroCounterSummary["persona"], string> = {
  amuro: "Amuro",
  char: "Char",
  heero: "Heero",
  treize: "Treize",
};

const ARCHETYPE_LABEL: Record<ZeroCounterSummary["archetype"], string> = {
  aggro: "agressivo",
  control: "controle",
  midrange_synergy: "midrange",
  tempo: "tempo",
};

/**
 * Aviso do início da partida. NÃO cita o deck escolhido: o nome de um deck do pool
 * (receita pública) já entrega a lista, que só aparece no fim da partida.
 */
export function zeroCounterNotice(summary: Pick<ZeroCounterSummary, "persona" | "archetype" | "fallback">): string {
  if (summary.fallback) {
    return "O Zero System não achou um counter melhor que um deck meta contra o seu e vai jogar com esse deck meta.";
  }
  return `O Zero System montou um counter do seu deck — postura ${PERSONA_LABEL[summary.persona]} contra deck ${ARCHETYPE_LABEL[summary.archetype]}.`;
}

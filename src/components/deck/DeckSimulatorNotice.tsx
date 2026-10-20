import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardPlayabilityBadge } from "@/components/catalog/CardPlayabilityBadge";
import type { CardRecord } from "@/modules/core/types";
import type { CardStatusEntry, PlayabilityStatus } from "@/lib/api";
import { useSiteLanguage } from "@/i18n/siteLanguage";

export interface UnplayableCardSummary {
  card: CardRecord;
  entry: CardStatusEntry | null;
  count: number;
  status: PlayabilityStatus;
  motivo?: string;
  missingClauses?: string[];
}

export interface DeckSimulatorNoticeProps {
  unplayableCards: UnplayableCardSummary[];
  totalUnplayableCopies: number;
  mainDeckCount: number;
  expectedDeckSize?: number;
  className?: string;
}

/**
 * Aviso de compatibilidade do deck com o simulador (A3 Fase 3).
 *
 * Explica com clareza ao jogador se o deck pode ser usado no simulador ou quais cartas
 * ainda estão em revisão no motor de regras com cláusulas pendentes.
 */
export function DeckSimulatorNotice({
  unplayableCards,
  totalUnplayableCopies,
  mainDeckCount,
  expectedDeckSize = 50,
  className = "",
}: DeckSimulatorNoticeProps) {
  const { tr } = useSiteLanguage();
  const isComplete = mainDeckCount === expectedDeckSize;
  const hasUnplayable = unplayableCards.length > 0;

  if (hasUnplayable) {
    return (
      <div
        data-testid="deck-simulator-unplayable-notice"
        className={`mt-4 border border-amber-500/40 bg-amber-950/25 p-4 rounded-none ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-400" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
              {tr(`Aviso de Cobertura do Simulador · ${unplayableCards.length} carta(s) em revisão`, `Simulator Coverage Notice · ${unplayableCards.length} card(s) under review`)}
            </p>
          </div>
          <Badge className="rounded-none border border-amber-400/40 bg-amber-400/10 text-[10px] text-amber-300 font-mono">
            {totalUnplayableCopies} {tr("cópia(s) afetada(s)", "copy(ies) affected")}
          </Badge>
        </div>

        <p className="mt-2 text-sm leading-6 text-amber-200/90 font-medium">
          {tr("Este deck não pode ser usado no simulador ainda:", "This deck can't be used in the simulator yet:")}{" "}
          {unplayableCards.length === 1
            ? tr("1 carta está em revisão no motor de regras.", "1 card is under review in the rules engine.")
            : tr(`${unplayableCards.length} cartas estão em revisão no motor de regras.`, `${unplayableCards.length} cards are under review in the rules engine.`)}
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {unplayableCards.map(({ card, entry, count, status, missingClauses }) => (
            <div
              key={card.code}
              data-testid={`unplayable-card-item-${card.code}`}
              className="flex items-center justify-between gap-2 border border-amber-500/30 bg-slate-950/90 p-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-bold text-amber-300 shrink-0">{card.code}</span>
                <span className="truncate text-slate-200 font-medium" title={card.namePt || card.name}>
                  {card.namePt || card.name}
                </span>
                <span className="text-[11px] text-amber-400/70 font-mono shrink-0">({count}x)</span>
              </div>
              <CardPlayabilityBadge
                code={card.code}
                entry={entry}
                status={status}
                missingClauses={missingClauses}
                size="xs"
                showMissingCount
                className="shrink-0"
              />
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs leading-5 text-amber-200/60">
          {tr(
            "Você pode salvar e testar normalmente no deckbuilder. O deck será liberado automaticamente no simulador assim que a equipe do motor implementar as cláusulas pendentes.",
            "You can save and test it in the deckbuilder as usual. The deck will be unlocked in the simulator automatically once the pending clauses are implemented.",
          )}
        </p>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div
        data-testid="deck-simulator-playable-notice"
        className={`mt-4 border border-emerald-500/30 bg-emerald-950/15 p-3.5 flex flex-wrap items-center justify-between gap-2 rounded-none ${className}`}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          <span className="text-xs uppercase tracking-[0.16em] text-emerald-300 font-semibold">
            100% Apto para o Simulador
          </span>
        </div>
        <span className="text-xs text-emerald-200/70">
          {tr(`Todas as ${mainDeckCount} cartas do deck principal estão implementadas no motor.`, `All ${mainDeckCount} main deck cards are implemented in the engine.`)}
        </span>
      </div>
    );
  }

  return null;
}

/**
 * Pílula compacta de status do simulador para a barra superior do deck.
 */
export function DeckSimulatorPill({
  isPlayable,
  unplayableCount,
  unplayableCodes,
}: {
  isPlayable: boolean;
  unplayableCount: number;
  unplayableCodes: string[];
}) {
  const { tr } = useSiteLanguage();
  if (isPlayable) {
    return (
      <div
        data-testid="deck-simulator-pill-playable"
        className="inline-flex items-center gap-1.5 rounded-none border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-emerald-300 select-none"
        title={tr("Todas as cartas adicionadas estão 100% aptas para partidas no simulador.", "Every card added is fully ready for simulator matches.")}
      >
        <span className="inline-flex size-2 rounded-full bg-emerald-400" />
        <span>{tr("Simulador: Apto", "Simulator: Ready")}</span>
      </div>
    );
  }

  return (
    <div
      data-testid="deck-simulator-pill-unplayable"
      className="inline-flex items-center gap-1.5 rounded-none border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-amber-300 select-none"
      title={tr(`Este deck não pode entrar no simulador ainda: ${unplayableCount} carta(s) em revisão no motor (${unplayableCodes.join(", ")}).`, `This deck can't be used in the simulator yet: ${unplayableCount} card(s) under review (${unplayableCodes.join(", ")}).`)}
    >
      <span className="inline-flex size-2 rounded-full bg-amber-400 animate-pulse" />
      <span>{tr("Simulador", "Simulator")}: {unplayableCount} {tr("em revisão", "under review")}</span>
    </div>
  );
}

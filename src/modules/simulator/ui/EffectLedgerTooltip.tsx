/* Spec simulador-efeitos-na-mesa (E) — balão do hover numa carta do campo: os efeitos deste turno que estão NELA
 * (quem causou, o que faz, até quando) e os que ela causou em outras. A linha neon de cada fonte é desenhada pela
 * página (`AbilityTargetLane`); aqui fica só o texto, ao lado da carta, sem pegar clique. */
import { Sparkles } from "lucide-react";
import { useSiteLanguage } from "@/i18n/siteLanguage";
import { describeLedgerEffect, ledgerScopeLabel, ledgerSourceLabel, type LedgerEntry } from "../scene/effectLedger";

interface EffectLedgerTooltipProps {
  /** a carta com o mouse em cima */
  cardId: string;
  entries: LedgerEntry[];
  anchor: DOMRect | null;
  nameOf: (instanceId: string) => string | undefined;
}

const WIDTH = 288;

export function EffectLedgerTooltip({ cardId, entries, anchor, nameOf }: EffectLedgerTooltipProps) {
  const { tr } = useSiteLanguage();
  const onIt = entries.filter((e) => e.targetId === cardId);
  const caused = entries.filter((e) => e.source?.instanceId === cardId && e.targetId !== cardId);
  if (!anchor || onIt.length + caused.length === 0) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const gap = 10;
  const right = anchor.right + gap + WIDTH <= vw;
  const left = right ? anchor.right + gap : Math.max(gap, anchor.left - gap - WIDTH);
  const top = Math.min(Math.max(gap, anchor.top), vh - 160);

  return (
    <div
      role="tooltip"
      data-testid="effect-ledger-tooltip"
      className="pointer-events-none fixed z-[45] rounded-arena border border-cyan-400/60 bg-slate-950/95 p-2.5 text-xs text-slate-100 shadow-[0_0_18px_rgba(34,211,238,0.35)] backdrop-blur-sm"
      style={{ left, top, width: WIDTH }}
    >
      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
        <Sparkles className="size-3" aria-hidden /> {tr("Efeitos neste turno", "Effects this turn")}
      </p>
      <ul className="space-y-1.5">
        {onIt.map((e) => (
          <li key={e.id} className="leading-snug">
            <span className="font-bold text-amber-200">{ledgerSourceLabel(e.source, nameOf, tr)}</span>
            <span className="text-slate-400"> → </span>
            <span className="font-semibold">{describeLedgerEffect(e.effect, tr)}</span>
            <span className="text-slate-400"> · {ledgerScopeLabel(e.scope, tr)}</span>
          </li>
        ))}
        {caused.map((e) => (
          <li key={e.id} className="leading-snug">
            <span className="text-slate-400">{tr("Causou em ", "Applied to ")}</span>
            <span className="font-bold text-amber-200">{nameOf(e.targetId) ?? tr("Carta", "Card")}</span>
            <span className="text-slate-400">: </span>
            <span className="font-semibold">{describeLedgerEffect(e.effect, tr)}</span>
            <span className="text-slate-400"> · {ledgerScopeLabel(e.scope, tr)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

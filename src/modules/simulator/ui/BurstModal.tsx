/* docs/19, Sessão 3 / Refinamento — Top Tactical Dock de 【Burst】
 * Em vez de uma modal central gigante bloqueando a visão do campo de batalha,
 * o Burst é apresentado como uma fita tática compacta ancorada no topo da tela.
 * O tabuleiro inteiro permanece 100% visível e interativo para alvos e inspeção. */
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";
import type { PendingDecision } from "@/modules/simulator/engine/types";
import { useCardLanguage } from "@/i18n/useCardLanguage";

interface BurstModalProps {
  decision: Extract<PendingDecision, { kind: "burst" }>;
  art: ArtLookup;
  busy?: boolean;
  onResolve: (activate: boolean) => void;
}

export function BurstModal({ decision, art, busy, onResolve }: BurstModalProps) {
  const { language } = useCardLanguage();
  const isEn = language === "EN";

  const queueSuffix =
    decision.queuedInstanceIds?.length > 0
      ? isEn
        ? ` (+${decision.queuedInstanceIds.length} in queue)`
        : ` (+${decision.queuedInstanceIds.length} na fila)`
      : "";

  return (
    <div className="pointer-events-none fixed top-3 inset-x-0 z-[80] flex justify-center px-3 animate-in slide-in-from-top-3 fade-in duration-200 motion-reduce:animate-none">
      <div className="pointer-events-auto panel-cut hero-surface mx-auto flex w-[min(96vw,44rem)] flex-wrap items-center justify-between gap-3 border-2 border-amber-400 bg-slate-950/95 px-3.5 py-2.5 shadow-[0_4px_28px_rgba(0,0,0,0.9),0_0_30px_rgba(251,191,36,0.45)] backdrop-blur-md sm:flex-nowrap">
        {/* Lado Esquerdo: Miniatura da carta + Informação Tática */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-12 w-9 shrink-0 overflow-hidden rounded border border-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.5)]">
            <CardFace
              nameEn={decision.cardDef?.nameEn ?? ""}
              code={decision.cardDef?.code ?? ""}
              art={art}
              size="sm"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                <Sparkles className="size-3 text-amber-400" /> Burst
              </span>
              <p className="truncate text-xs font-bold text-white">{decision.cardDef?.nameEn ?? "Carta"}</p>
            </div>
            <p className="mt-0.5 truncate text-[10px] text-amber-200/80">
              {isEn ? "Shield broken. Activate Burst effect?" : "Sua shield foi quebrada. Ativar o efeito de Burst?"}
              {queueSuffix}
            </p>
          </div>
        </div>

        {/* Lado Direito: Ações Imediatas */}
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <Button
            className="min-h-11 flex-1 rounded-arena bg-amber-400 px-3.5 text-xs font-black text-black shadow-[0_0_14px_rgba(251,191,36,0.5)] hover:bg-amber-300 sm:h-8 sm:min-h-0 sm:flex-initial"
            disabled={busy}
            onClick={() => onResolve(true)}
          >
            {isEn ? "Activate effect" : "Ativar efeito"}
          </Button>
          <Button
            variant="outline"
            className="min-h-11 flex-1 rounded-arena border-white/20 px-3 text-xs text-slate-300 hover:border-white/40 hover:bg-white/5 sm:h-8 sm:min-h-0 sm:flex-initial"
            disabled={busy}
            onClick={() => onResolve(false)}
          >
            {isEn ? "Send to trash" : "Mandar pro trash"}
          </Button>
        </div>
      </div>
    </div>
  );
}

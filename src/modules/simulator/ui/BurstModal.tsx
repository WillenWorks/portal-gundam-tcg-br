/* docs/19, Sessão 3 — modal imersivo de 【Burst】 (extraído de
 * SimulatorMatchPage.tsx, onde nasceu na Sessão 2). Arte ampliada da shield
 * quebrada + botões claros. Indica a fila quando mais de uma shield com
 * Burst caiu no mesmo Damage Step. */
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";
import type { PendingDecision } from "@/modules/simulator/engine/types";

interface BurstModalProps {
  decision: Extract<PendingDecision, { kind: "burst" }>;
  art: ArtLookup;
  busy?: boolean;
  onResolve: (activate: boolean) => void;
}

export function BurstModal({ decision, art, busy, onResolve }: BurstModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-200 motion-reduce:animate-none">
      {/* Frente 4 (docs/38 §4.2) — revelação de escudo/Burst: o painel entra
          com "pop" (zoom) e a carta ganha pulso de luz neon dourado. */}
      <div className="panel-cut hero-surface w-full max-w-xs border border-amber-500/50 p-4 animate-in zoom-in-90 fade-in duration-300 ease-out motion-reduce:animate-none">
        <p className="flex items-center justify-center gap-1.5 text-center text-sm font-black uppercase tracking-[0.2em] text-amber-300">
          <Sparkles className="size-4" /> Burst
        </p>
        <CardFace
          nameEn={decision.cardDef.nameEn}
          code={decision.cardDef.code}
          art={art}
          size="lg"
          className="mx-auto my-3 border border-amber-400/60 shadow-[0_0_28px_rgba(251,191,36,0.65)] animate-pulse motion-reduce:animate-none"
        />
        <p className="text-center text-sm font-semibold text-soft">{decision.cardDef.nameEn}</p>
        <p className="text-center text-[10px] text-muted-portal">
          Sua shield foi quebrada — o 【Burst】 pode ser ativado agora.
          {decision.queuedInstanceIds.length > 0 ? ` (+${decision.queuedInstanceIds.length} na fila)` : ""}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button className="h-11 rounded-arena bg-amber-500 text-black hover:bg-amber-400" disabled={busy} onClick={() => onResolve(true)}>
            Ativar efeito
          </Button>
          <Button variant="outline" className="h-11 rounded-arena" disabled={busy} onClick={() => onResolve(false)}>
            Enviar ao descarte
          </Button>
        </div>
      </div>
    </div>
  );
}

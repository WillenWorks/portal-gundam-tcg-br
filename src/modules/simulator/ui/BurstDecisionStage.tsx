/* Spec simulador-cadencia-de-mesa (P5) — a decisão do 【Burst】 como na mesa: a shield revelada fica no centro e um
 * modal simples pergunta se ativa. Modal e banner só avisam; o alvo é escolhido no campo.
 *  - "decide": a carta grande no centro + "Ativar o 【Burst】?";
 *  - ativou: a carta some com zoom (usada). Sem alvo, a ativação vai na hora. Com alvo, aparece o banner pequeno do
 *    topo com o texto do efeito, a mesa fica livre (a página recolhe mão/painel/log) e o alvo é clicado no campo;
 *  - não ativou: a carta cai na lixeira.
 * Fica no ritmo cinemático; o "Rápido" segue com a faixa antiga (`BurstModal`). */
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PendingDecision } from "@/modules/simulator/engine/types";
import { useSiteLanguage } from "@/i18n/siteLanguage";
import { SCENE_MS } from "../scene/sceneTiming";
import { getScaledDuration } from "./animationSettings";
import { isGenericArtCard, type ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";
import { centerCardWidth, type TravelPoint } from "./CardTravel";
import type { BurstTargetChoice } from "./BurstModal";

type Phase = "decide" | "used" | "target" | "trash";

interface BurstDecisionStageProps {
  decision: Extract<PendingDecision, { kind: "burst" }>;
  art: ArtLookup;
  /** o trecho 【Burst】 do texto da carta (banner do alvo) */
  effectText: string | null;
  target: BurstTargetChoice | null;
  selectedCount: number;
  busy?: boolean;
  /** para onde a carta cai quando não é ativada (a lixeira do dono) */
  trashAt: TravelPoint | null;
  trashW: number;
  /** a página liga o alvo no campo e libera a mesa enquanto o jogador escolhe */
  onTargetingChange: (targeting: boolean) => void;
  onResolve: (activate: boolean) => void;
}

export function BurstDecisionStage({ decision, art, effectText, target, selectedCount, busy, trashAt, trashW, onTargetingChange, onResolve }: BurstDecisionStageProps) {
  const { tr } = useSiteLanguage();
  const [phase, setPhase] = useState<Phase>("decide");
  // P6 — sem movimento: a carta não voa nem amplia (a decisão segue igual)
  const [reduced] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
  const needsTarget = Boolean(target && target.legalTargetIds.length > 0);
  const min = target?.min ?? 0;
  const name = decision.cardDef?.nameEn ?? tr("Carta", "Card");
  const usedMs = getScaledDuration(SCENE_MS.play.used);
  const trashMs = getScaledDuration(SCENE_MS.combat.shield.toTrash);

  // a carta usada some e então: sem alvo, ativa; com alvo, abre a escolha no campo
  useEffect(() => {
    if (phase !== "used") return;
    const t = setTimeout(() => {
      if (needsTarget) {
        setPhase("target");
        onTargetingChange(true);
      } else onResolve(true);
    }, usedMs);
    return () => clearTimeout(t);
    // o callback é estável na página; reagendar a cada render reiniciaria o tempo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "trash") return;
    const t = setTimeout(() => onResolve(false), trashMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = centerCardWidth(vw, vh);
  const h = Math.round(w * (88 / 63));

  if (phase === "target") {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex justify-center px-3" data-testid="burst-target-banner">
        <div className="pointer-events-auto panel-cut flex w-[min(96vw,40rem)] flex-wrap items-center gap-x-3 gap-y-2 border border-amber-400/80 bg-slate-950/95 px-3 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.85),0_0_22px_rgba(251,191,36,0.35)] backdrop-blur-md animate-in slide-in-from-top-2 fade-in duration-200">
          <p className="min-w-0 flex-1 text-xs text-amber-100">
            <span className="mr-1.5 inline-flex items-center gap-1 font-black uppercase tracking-wider text-amber-300">
              <Sparkles className="size-3" aria-hidden /> {name}
            </span>
            {effectText ?? tr("Escolha o alvo no campo.", "Choose the target on the board.")}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tabular-nums text-amber-200/90">
              {tr("No campo", "On the board")}: {selectedCount}/{target?.max ?? 1}
            </span>
            <Button
              size="sm"
              className="h-8 rounded-arena bg-amber-400 px-3 text-xs font-black text-black hover:bg-amber-300"
              disabled={busy || selectedCount < min}
              onClick={() => {
                onTargetingChange(false);
                onResolve(true);
              }}
            >
              {tr("Confirmar", "Confirm")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-arena border-white/20 px-2.5 text-xs text-slate-300"
              disabled={busy}
              onClick={() => {
                onTargetingChange(false);
                setPhase("decide");
              }}
            >
              {tr("Voltar", "Back")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const trashing = phase === "trash" && trashAt;
  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" data-testid="burst-decision" data-phase={phase}>
      <div className="absolute inset-0 bg-slate-950/45" />
      <div
        className="absolute"
        style={{
          left: trashing ? trashAt.x - trashW / 2 : vw / 2 - w / 2,
          top: trashing ? trashAt.y - (trashW * (88 / 63)) / 2 : vh / 2 - h / 2 - 40,
          width: trashing ? trashW : w,
          height: trashing ? Math.round(trashW * (88 / 63)) : h,
          opacity: phase === "used" ? 0 : 1,
          transform: phase === "used" ? "scale(1.35)" : "scale(1)",
          transition: reduced
            ? undefined
            : `left ${trashMs}ms ease-in, top ${trashMs}ms ease-in, width ${trashMs}ms ease-in, height ${trashMs}ms ease-in, opacity ${usedMs}ms ease-out, transform ${usedMs}ms ease-out`,
        }}
      >
        <div className="h-full w-full overflow-hidden rounded-arena border-2 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.55)]">
          <CardFace
            nameEn={decision.cardDef?.nameEn ?? ""}
            code={decision.cardDef?.code ?? ""}
            art={art}
            size="lg"
            style={{ width: "100%", height: "100%" }}
            className="!h-full !w-full"
            backFallback={decision.cardDef?.cardType ? isGenericArtCard(decision.cardDef.cardType, decision.cardDef.isToken) : false}
          />
        </div>
      </div>
      {phase === "decide" ? (
        <div className="absolute inset-x-0 flex justify-center px-3" style={{ top: vh / 2 + h / 2 - 28 }}>
          <div className="pointer-events-auto panel-cut flex w-[min(92vw,22rem)] flex-col items-center gap-2 border border-amber-400/70 bg-slate-950/95 px-3 py-2.5 text-center shadow-[0_6px_24px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-200">
            <p className="flex items-center gap-1.5 text-sm font-black uppercase tracking-wider text-amber-300">
              <Sparkles className="size-4" aria-hidden /> {tr("Ativar o 【Burst】?", "Activate 【Burst】?")}
            </p>
            {effectText ? <p className="text-[11px] leading-snug text-amber-100/85">{effectText}</p> : null}
            <div className="flex w-full gap-2">
              <Button
                className={cn("h-10 flex-1 rounded-arena bg-amber-400 text-xs font-black text-black hover:bg-amber-300")}
                disabled={busy}
                onClick={() => setPhase("used")}
              >
                {tr("Ativar", "Activate")}
              </Button>
              <Button
                variant="outline"
                className="h-10 flex-1 rounded-arena border-white/20 text-xs text-slate-300"
                disabled={busy}
                onClick={() => setPhase("trash")}
              >
                {tr("Mandar pro cemitério", "Send to trash")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

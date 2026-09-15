/* PhaseAnnouncementBanner.tsx — Banner tático de transição e anúncio de fases
 * Apresenta anúncios cinematográficos ("FASE DE COMPRA", "FASE DE RECUPERAÇÃO", "FASE PRINCIPAL")
 * com estilo HUD mecha/Gundam, brilhos de neon e sincronia de som procedural.
 */
import { useEffect, useState } from "react";
import { sfx } from "../audio/soundEffects";

export interface PhaseAnnouncementBannerProps {
  phase: string;
  sub?: string;
  durationMs?: number;
  onDone?: () => void;
}

export function PhaseAnnouncementBanner({
  phase,
  sub = "SISTEMA TÁTICO ATIVO",
  durationMs = 1200,
  onDone,
}: PhaseAnnouncementBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    sfx.playTurnStartAlert();
    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, Math.max(300, durationMs - 250));

    const doneTimer = setTimeout(() => {
      onDone?.();
    }, durationMs);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(doneTimer);
    };
  }, [phase, durationMs, onDone]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px]"
      aria-live="assertive"
    >
      <div className="relative flex flex-col items-center px-10 py-5 text-center animate-in zoom-in-95 fade-in duration-200">
        {/* Linha decorativa superior de energia */}
        <div className="h-[2px] w-48 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(34,211,238,1)]" />

        <div className="my-2 rounded-arena border border-cyan-400/40 bg-slate-950/90 px-8 py-4 shadow-[0_0_35px_rgba(6,182,212,0.35)] backdrop-blur-md">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-cyan-300/80">
            {sub}
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-[0.15em] text-white drop-shadow-[0_0_16px_rgba(34,211,238,0.7)] sm:text-3xl">
            {phase}
          </h2>
        </div>

        {/* Linha decorativa inferior de energia */}
        <div className="h-[2px] w-48 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(34,211,238,1)]" />
      </div>
    </div>
  );
}

/* PhaseAnnouncementBanner.tsx — Banner tático de transição e anúncio de fases
 * Apresenta anúncios cinematográficos ("FASE DE COMPRA", "FASE DE RECUPERAÇÃO", "FASE PRINCIPAL")
 * com estilo HUD mecha/Gundam, brilhos de neon e sincronia de som procedural.
 */
import { useEffect, useRef, useState } from "react";
import { getScaledDuration } from "./animationSettings";
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
  // docs/56 (revisão do plano) — sem `durationMs` explícito, escala pela
  // velocidade escolhida em `SettingsMenu` (0.75x segura mais, 2x quase não pausa).
  durationMs = getScaledDuration(1200),
  onDone,
}: PhaseAnnouncementBannerProps) {
  const [visible, setVisible] = useState(true);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    sfx.playTurnStartAlert();
    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, Math.max(300, durationMs - 250));

    const doneTimer = setTimeout(() => {
      onDoneRef.current?.();
    }, durationMs);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(doneTimer);
    };
  }, [phase, durationMs]);

  if (!visible) return null;

  let displaySub = sub;
  if (sub === "SISTEMA TÁTICO ATIVO") {
    if (phase === "FASE DE AÇÕES") displaySub = "PASSO DE INTERVENÇÃO / RESPOSTA";
    else if (phase === "FIM DE TURNO") displaySub = "ENCERRAMENTO DE TURNO";
    else if (phase === "SEU TURNO") displaySub = "INICIATIVA DE COMBATE";
    else if (phase === "TURNO DO OPONENTE") displaySub = "POSTURA DEFENSIVA";
  }

  const isActionPhase = phase === "FASE DE AÇÕES";
  const isEndTurn = phase === "FIM DE TURNO";

  const borderClass = isActionPhase
    ? "border-amber-400/60 shadow-[0_0_35px_rgba(245,158,11,0.45)]"
    : isEndTurn
      ? "border-slate-400/40 shadow-[0_0_30px_rgba(148,163,184,0.3)]"
      : "border-cyan-400/40 shadow-[0_0_35px_rgba(6,182,212,0.35)]";

  const beamClass = isActionPhase
    ? "via-amber-400 shadow-[0_0_12px_rgba(245,158,11,1)]"
    : isEndTurn
      ? "via-slate-400 shadow-[0_0_12px_rgba(148,163,184,0.8)]"
      : "via-cyan-400 shadow-[0_0_12px_rgba(34,211,238,1)]";

  const subClass = isActionPhase
    ? "text-amber-300/90"
    : isEndTurn
      ? "text-slate-300/80"
      : "text-cyan-300/80";

  const titleClass = isActionPhase
    ? "text-amber-100 drop-shadow-[0_0_16px_rgba(245,158,11,0.7)]"
    : isEndTurn
      ? "text-slate-100 drop-shadow-[0_0_16px_rgba(148,163,184,0.6)]"
      : "text-white drop-shadow-[0_0_16px_rgba(34,211,238,0.7)]";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px]"
      aria-live="assertive"
    >
      <div className="relative flex flex-col items-center px-10 py-5 text-center animate-in zoom-in-95 fade-in duration-200">
        {/* Linha decorativa superior de energia */}
        <div className={`h-[2px] w-48 bg-gradient-to-r from-transparent ${beamClass} to-transparent`} />

        <div className={`my-2 rounded-arena border bg-slate-950/90 px-8 py-4 backdrop-blur-md ${borderClass}`}>
          <p className={`text-[10px] font-mono font-bold uppercase tracking-[0.3em] ${subClass}`}>
            {displaySub}
          </p>
          <h2 className={`mt-1 text-2xl font-black uppercase tracking-[0.15em] sm:text-3xl ${titleClass}`}>
            {phase}
          </h2>
        </div>

        {/* Linha decorativa inferior de energia */}
        <div className={`h-[2px] w-48 bg-gradient-to-r from-transparent ${beamClass} to-transparent`} />
      </div>
    </div>
  );
}

/* docs/44 Fase 3 §5.1 — captura de bug report de dentro da partida. O jogador
 * descreve rapidamente o que aconteceu; o servidor congela o GameState
 * completo (repro) + battleLog + cartas em jogo e devolve um `shortCode`
 * ("BUG-XXXXXX") pra acompanhar. Mesmo padrão visual dos outros modais do
 * simulador (ZoneOverflowModal / TriggerOrderModal). */
import { useState } from "react";
import { Bug, Check } from "lucide-react";

interface BugReportModalProps {
  busy?: boolean;
  /** preenchido depois do envio — troca o modal pra tela de confirmação com o código. */
  shortCode?: string | null;
  onSubmit: (note: string) => void;
  onClose: () => void;
}

export function BugReportModal({ busy, shortCode, onSubmit, onClose }: BugReportModalProps) {
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
      <div className="panel-cut hero-surface w-full max-w-sm border border-amber-500/40 p-4">
        {shortCode ? (
          <>
            <p className="flex items-center justify-center gap-1.5 text-center text-sm font-black uppercase tracking-[0.2em] text-amber-400">
              <Check className="size-4" /> Relato registrado
            </p>
            <p className="mt-2 text-center text-xs text-soft">
              <span className="select-all font-mono text-sm font-bold text-amber-300">{shortCode}</span>
              <br />
              acompanhe por esse código
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full border border-white/10 bg-black/40 px-2 py-1.5 text-xs font-semibold text-soft transition hover:border-primary/60 hover:bg-primary/10"
            >
              Fechar
            </button>
          </>
        ) : (
          <>
            <p className="flex items-center justify-center gap-1.5 text-center text-sm font-black uppercase tracking-[0.2em] text-amber-400">
              <Bug className="size-4" /> Reportar situação
            </p>
            <p className="mt-1 text-center text-[10px] text-muted-portal">
              O estado completo da partida é anexado automaticamente — descreva só o que aconteceu.
            </p>
            <label htmlFor="bug-report-note" className="sr-only">
              O que aconteceu?
            </label>
            <textarea
              id="bug-report-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
              autoFocus
              rows={4}
              maxLength={2000}
              placeholder="O que aconteceu?"
              className="mt-3 w-full resize-none border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-soft outline-none transition focus:border-amber-500/60 disabled:opacity-40"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 border border-white/10 bg-black/40 px-2 py-1.5 text-xs font-semibold text-muted-portal transition hover:border-white/30 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => onSubmit(note.trim())}
                disabled={busy}
                className="flex-1 border border-amber-500/50 bg-amber-500/10 px-2 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-40"
              >
                {busy ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

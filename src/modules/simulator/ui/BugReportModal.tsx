/* Bug Report In-Game enriquecido com snapshot e screenshot para triagem por agentes de IA.
 * Mostra preview do print capturado, dados contextuais (turno, fase, bot/jogador),
 * campo de texto para o relato e botão de descarte (Cancelar) ou envio. */
import { useState } from "react";
import { Bug, Check, Camera, RefreshCw, AlertCircle, Bot, User, Shield } from "lucide-react";
import type { BugReportSnapshot } from "./captureSnapshot";

export interface BugReportModalProps {
  busy?: boolean;
  capturing?: boolean;
  shortCode?: string | null;
  snapshot?: BugReportSnapshot | null;
  onSubmit: (note: string) => void;
  onClose: () => void;
}

export function BugReportModal({
  busy,
  capturing,
  shortCode,
  snapshot,
  onSubmit,
  onClose,
}: BugReportModalProps) {
  const [note, setNote] = useState("");
  const [showScreenshotPreview, setShowScreenshotPreview] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-sm animate-fade-in">
      <div className="panel-cut hero-surface w-full max-w-md border border-amber-500/40 p-4 shadow-2xl">
        {shortCode ? (
          <div className="space-y-3 py-2 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <Check className="size-5" />
            </div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400">
              Relatório Arquivado
            </p>
            <div className="rounded border border-amber-500/30 bg-black/50 p-2.5">
              <span className="select-all font-mono text-base font-extrabold tracking-wider text-amber-300">
                {shortCode}
              </span>
              <p className="mt-1 text-[11px] text-slate-400">
                O print da tela, o log de combate e o estado de jogo foram salvos no servidor para análise dos agentes.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full border border-white/20 bg-slate-900 px-3 py-2 text-xs font-semibold text-soft transition hover:border-primary/60 hover:bg-primary/10"
            >
              Fechar
            </button>
          </div>
        ) : capturing ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <RefreshCw className="size-8 animate-spin text-amber-400" />
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Capturando snapshot e print da tela…
            </p>
            <p className="text-[10px] text-muted-portal">
              Congelando a cena visual e os dados táticos do simulador.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
              <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.16em] text-amber-400">
                <Bug className="size-4" /> Reportar Problema no Simulador
              </p>
              {snapshot?.isAgainstBot ? (
                <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-500/30">
                  <Bot className="size-3" /> Partida vs Bot
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 border border-white/10">
                  <User className="size-3" /> PvP Humano
                </span>
              )}
            </div>

            {/* Resumo do Snapshot Capturado */}
            {snapshot ? (
              <div className="mt-2.5 rounded border border-white/10 bg-black/40 p-2 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between text-slate-300">
                  <span>
                    <strong>Turno {snapshot.turnNumber}</strong> · Fase <code className="text-amber-300">{snapshot.phase}</code>
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Shield className="size-3 text-cyan-400" /> {snapshot.myShieldCount} vs {snapshot.oppShieldCount}
                  </span>
                </div>

                {snapshot.screenshotBase64 ? (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowScreenshotPreview((v) => !v)}
                      className="flex items-center gap-1.5 text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
                    >
                      <Camera className="size-3" />
                      {showScreenshotPreview ? "Ocultar print anexado" : "Ver print anexado da tela"}
                    </button>
                    {showScreenshotPreview ? (
                      <div className="mt-1.5 max-h-40 overflow-hidden rounded border border-cyan-500/30 bg-black">
                        <img
                          src={snapshot.screenshotBase64}
                          alt="Screenshot da Partida"
                          className="w-full object-contain"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="flex items-center gap-1 text-[10px] text-slate-500">
                    <AlertCircle className="size-3" /> Print da tela não gerado (dados textuais preservados)
                  </p>
                )}
              </div>
            ) : null}

            <p className="mt-2 text-[10px] text-muted-portal leading-relaxed">
              O log completo e as cartas em jogo serão anexados automaticamente. Descreva abaixo o que aconteceu de incorreto:
            </p>

            <label htmlFor="bug-report-note" className="sr-only">
              Descrição do bug
            </label>
            <textarea
              id="bug-report-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
              autoFocus
              rows={3}
              maxLength={2000}
              placeholder="Ex: O bot não passou a prioridade; ou o dano da unidade não considerou o Link..."
              className="mt-2 w-full resize-none rounded border border-white/10 bg-black/60 px-2.5 py-1.5 text-xs text-soft outline-none transition focus:border-amber-500/60 disabled:opacity-40"
            />

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 rounded border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/30 hover:bg-white/5 disabled:opacity-40"
              >
                Cancelar (Descartar)
              </button>
              <button
                type="button"
                onClick={() => onSubmit(note.trim())}
                disabled={busy}
                className="flex-1 rounded border border-amber-500/60 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-40"
              >
                {busy ? "Enviando…" : "Enviar Relatório"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

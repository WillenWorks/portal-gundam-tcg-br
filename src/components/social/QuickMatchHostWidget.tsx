/* Caixinha no Canto Inferior Direito do Anfitrião (Quick Match Host Loading Widget)
 * Exibida na tela de quem convidou um amigo para a partida rápida, aguardando resposta.
 * Possui loading tático, contagem regressiva de 45s e botão de cancelamento imediato. */
import { useEffect, useState } from "react";
import { Swords, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickMatchHostWidgetProps {
  guestUsername: string;
  guestDisplayName?: string;
  status: "INVITING" | "DECLINED" | "EXPIRED";
  onCancel: () => void;
}

export function QuickMatchHostWidget({
  guestUsername,
  status,
  onCancel,
}: QuickMatchHostWidgetProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(45);

  useEffect(() => {
    if (status !== "INVITING") return;
    setSecondsRemaining(45);
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  return (
    <div className="fixed bottom-4 right-4 z-[999] w-80 animate-in slide-in-from-bottom-5 duration-300">
      <div className="panel-cut rounded-none border border-primary/40 bg-slate-950/95 p-4 shadow-[0_0_30px_rgba(6,182,212,0.3)] backdrop-blur-md text-white">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Swords className="size-4 text-primary animate-pulse" />
            <span className="font-heading text-xs uppercase tracking-wider text-primary">
              Partida Rápida
            </span>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-white transition p-0.5"
            title="Cancelar convite"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="py-3 space-y-2.5">
          {status === "INVITING" ? (
            <>
              <div className="flex items-center gap-3">
                <div className="relative flex size-8 items-center justify-center bg-primary/10 border border-primary/30 text-primary shrink-0">
                  <Loader2 className="size-4 animate-spin" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs text-slate-200 font-medium truncate">
                    Convidando <strong className="text-white">@{guestUsername}</strong>
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Aguardando confirmação ({secondsRemaining}s)...
                  </p>
                </div>
              </div>

              {/* Barra de progresso regressiva */}
              <div className="w-full bg-slate-800 h-1 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-1000"
                  style={{ width: `${(secondsRemaining / 45) * 100}%` }}
                />
              </div>

              <div className="pt-1 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCancel}
                  className="rounded-none h-6 px-2.5 text-[10px] uppercase font-mono tracking-wider border-white/20 hover:bg-white/10 text-slate-300"
                >
                  Cancelar
                </Button>
              </div>
            </>
          ) : status === "DECLINED" ? (
            <div className="flex items-center gap-2.5 py-1 text-red-400 text-xs">
              <AlertCircle className="size-4 shrink-0" />
              <span>O piloto @{guestUsername} recusou o desafio.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 py-1 text-amber-400 text-xs">
              <AlertCircle className="size-4 shrink-0" />
              <span>Tempo de resposta esgotado.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

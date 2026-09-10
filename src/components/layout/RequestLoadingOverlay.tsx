/* RequestLoadingOverlay — sobreposição de carregamento tática em tela cheia
 * para requisições assíncronas (login, cadastro, uploads, transições de estado).
 * Evita cliques múltiplos e a sensação de página congelada. */
import { cn } from "@/lib/utils";

interface RequestLoadingOverlayProps {
  visible: boolean;
  label?: string;
  sublabel?: string;
  className?: string;
}

export function RequestLoadingOverlay({
  visible,
  label = "Autenticando piloto...",
  sublabel = "Estabelecendo comunicação com a base",
  className,
}: RequestLoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md transition-opacity duration-200 animate-in fade-in",
        className,
      )}
    >
      <div className="panel-cut relative max-w-sm w-full border border-primary/40 bg-slate-950/95 p-8 text-center shadow-[0_0_50px_rgba(0,190,255,0.2)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        
        <div className="mx-auto flex flex-col items-center justify-center gap-4">
          <div className="relative h-16 w-16">
            <span className="absolute inset-0 rounded-none border-2 border-primary/30 border-t-primary animate-spin" />
            <span className="absolute inset-[6px] rounded-none border border-accent/40 border-b-accent animate-[spin_1.4s_linear_reverse_infinite]" />
            <span className="absolute inset-[18px] bg-primary/80 shadow-[0_0_20px_rgba(34,211,238,0.7)] animate-pulse" />
          </div>

          <div className="space-y-1">
            <p className="font-heading text-2xl uppercase tracking-wider text-white">{label}</p>
            {sublabel ? (
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{sublabel}</p>
            ) : null}
          </div>

          <div className="mt-2 h-1 w-32 overflow-hidden bg-slate-800">
            <div className="h-full w-full bg-gradient-to-r from-primary via-cyan-300 to-accent animate-[pulse_1s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    </div>
  );
}

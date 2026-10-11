import { AlertCircle, Database, RefreshCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VedaLoadingView({
  label = "Sincronizando com o Veda System...",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={`py-16 text-center space-y-4 ${className}`}>
      <div className="flex justify-center">
        <div className="relative size-12">
          <div className="absolute inset-0 border-2 border-primary/20 animate-ping rounded-none" />
          <div className="absolute inset-0 border-2 border-primary border-t-transparent animate-spin rounded-none" />
          <div className="flex items-center justify-center h-full">
            <Database className="size-5 text-primary animate-pulse" />
          </div>
        </div>
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
    </div>
  );
}

export function VedaEmptyView({
  title = "Nenhum registro encontrado",
  description = "Nenhum torneio ou dado corresponde aos filtros selecionados.",
  actionLabel,
  onAction,
  className = "",
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={`panel-cut border border-white/10 bg-slate-950/60 p-8 text-center space-y-3 ${className}`}>
      <div className="flex justify-center">
        <div className="p-3 bg-white/5 border border-white/10">
          <SearchX className="size-8 text-slate-400" />
        </div>
      </div>
      <h3 className="font-heading text-lg uppercase text-white tracking-wide">{title}</h3>
      <p className="text-xs text-slate-400 max-w-md mx-auto">{description}</p>
      {actionLabel && onAction && (
        <div className="pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onAction}
            className="rounded-none border-primary/40 bg-primary/10 text-xs font-mono uppercase text-primary hover:bg-primary/20"
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export function VedaErrorView({
  title = "Falha de comunicação",
  error = "Não foi possível carregar os dados do Veda System.",
  onRetry,
  className = "",
}: {
  title?: string;
  error?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`panel-cut border border-red-500/30 bg-red-950/20 p-6 text-center space-y-3 ${className}`}>
      <div className="flex justify-center">
        <AlertCircle className="size-8 text-red-400" />
      </div>
      <h3 className="font-heading text-lg uppercase text-red-200 tracking-wide">{title}</h3>
      <p className="text-xs text-red-300/80 max-w-md mx-auto font-mono">{error}</p>
      {onRetry && (
        <div className="pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="rounded-none border-red-400/40 bg-red-500/10 text-xs font-mono uppercase text-red-200 hover:bg-red-500/20"
          >
            <RefreshCw className="size-3 mr-1.5" />
            Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );
}

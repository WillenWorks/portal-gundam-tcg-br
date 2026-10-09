import { Link } from "wouter";
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { useCardPlayability } from "@/components/catalog/useCardPlayability";
import { cn } from "@/lib/utils";

export interface CardInspectorPlayabilityBadgeProps {
  code?: string;
  className?: string;
  showIcon?: boolean;
}

/**
 * Selo compacto do inspector/deckbuilder. O veredito vem SEMPRE do endpoint do A3 (`/api/simulator/card-status`,
 * mesmo critério do `isCardPlayable`), pelo cache compartilhado `useCardPlayability` — sem lista fixa de sets e
 * sem "chute" enquanto carrega (antes um set desconhecido aparecia como "Apta" se a requisição falhasse).
 */
export function CardInspectorPlayabilityBadge({
  code,
  className,
  showIcon = true,
}: CardInspectorPlayabilityBadgeProps) {
  const { entry, isLoading } = useCardPlayability(code);

  if (!code?.trim() || isLoading || !entry) return null;

  const { status, missingClauses } = entry;

  if (status === "apta") {
    return (
      <Link
        href="/rules"
        onClick={(e) => e.stopPropagation()}
        title="Carta 100% implementada no motor do simulador"
        className={cn(
          "inline-flex items-center gap-1 border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300 transition-colors hover:bg-emerald-500/20",
          className,
        )}
      >
        {showIcon ? <CheckCircle2 className="size-2.5" /> : null}
        <span>Apta no simulador</span>
      </Link>
    );
  }

  if (status === "revisao") {
    const missingCount = missingClauses?.length ?? 0;
    const title = missingCount > 0
      ? `Em revisão: ${missingCount} cláusula(s) em implementação no motor`
      : "Em revisão: conjunto em implementação no motor";

    return (
      <Link
        href="/rules"
        onClick={(e) => e.stopPropagation()}
        title={title}
        className={cn(
          "inline-flex items-center gap-1 border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/20",
          className,
        )}
      >
        {showIcon ? <AlertTriangle className="size-2.5" /> : null}
        <span>Em revisão</span>
      </Link>
    );
  }

  return (
    <span
      title="Carta fora do catálogo ativo do simulador"
      className={cn(
        "inline-flex items-center gap-1 border border-slate-600/40 bg-slate-800/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400",
        className,
      )}
    >
      {showIcon ? <HelpCircle className="size-2.5" /> : null}
      <span>Fora do simulador</span>
    </span>
  );
}

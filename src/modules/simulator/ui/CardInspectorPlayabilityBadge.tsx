import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { getSingleCardPlayability, type CardStatusEntry, type PlayabilityStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

// Cache em memória compartilhado para evitar chamadas de rede repetidas no inspetor
const playabilityCache = new Map<string, CardStatusEntry>();

// Conjuntos oficialmente fechados no gate (CONTRATO-MOTOR.md §2)
const CLOSED_GATED_SETS = new Set([
  "ST01", "ST02", "ST03", "ST04", "ST05", "ST06", "ST07", "ST08", "ST09", "ST10",
  "GD01", "GD02", "GD03", "GD04", "GD05",
]);

export interface CardInspectorPlayabilityBadgeProps {
  code?: string;
  className?: string;
  showIcon?: boolean;
}

export function CardInspectorPlayabilityBadge({
  code,
  className,
  showIcon = true,
}: CardInspectorPlayabilityBadgeProps) {
  const cleanCode = code?.trim() || "";
  const setPrefix = cleanCode.split("-")[0]?.toUpperCase() || "";

  // Heurística inicial síncrona
  const initialStatus: PlayabilityStatus = CLOSED_GATED_SETS.has(setPrefix)
    ? "apta"
    : setPrefix === "EB01"
      ? "revisao"
      : "apta";

  const [entry, setEntry] = useState<CardStatusEntry | null>(() => {
    if (!cleanCode) return null;
    return playabilityCache.get(cleanCode) || {
      code: cleanCode,
      set: setPrefix,
      status: initialStatus,
    };
  });

  useEffect(() => {
    if (!cleanCode) return;
    if (playabilityCache.has(cleanCode)) {
      setEntry(playabilityCache.get(cleanCode)!);
      return;
    }

    let isCancelled = false;
    getSingleCardPlayability(cleanCode)
      .then((res) => {
        if (!isCancelled && res) {
          playabilityCache.set(cleanCode, res);
          setEntry(res);
        }
      })
      .catch(() => {
        // Fallback para a classificação baseada no set
      });

    return () => {
      isCancelled = true;
    };
  }, [cleanCode]);

  if (!cleanCode || !entry) return null;

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

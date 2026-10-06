import React from "react";
import { Link } from "wouter";
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CardStatusEntry, PlayabilityStatus } from "@/lib/api";
import { useCardPlayability } from "./useCardPlayability";

export interface CardPlayabilityBadgeProps {
  /** Código da carta (ex.: 'ST01-001', 'EB01-003'). */
  code?: string;
  /** Objeto de status já carregado (opcional, evita lookup). */
  entry?: CardStatusEntry | null;
  /** Status forçado (opcional). */
  status?: PlayabilityStatus;
  /** Cláusulas faltantes (opcional). */
  missingClauses?: string[];
  /** Tamanho visual do selo. Padrão: 'sm'. */
  size?: "xs" | "sm" | "md";
  /** Exibe o ícone de status. Padrão: true. */
  showIcon?: boolean;
  /** Exibe o texto do status. Padrão: true. */
  showLabel?: boolean;
  /** Se em revisão, exibe a contagem de cláusulas pendentes no rótulo. Padrão: false. */
  showMissingCount?: boolean;
  /** Habilita tooltip explicativo em pt-BR. Padrão: true. */
  showTooltip?: boolean;
  /** Se deve renderizar como link para a base de regras (/rules). Padrão: false. */
  asLink?: boolean;
  /** Classes CSS adicionais. */
  className?: string;
  /** Callback ao clicar. */
  onClick?: (e: React.MouseEvent) => void;
}

export function CardPlayabilityBadge({
  code,
  entry: propEntry,
  status: propStatus,
  missingClauses: propMissingClauses,
  size = "sm",
  showIcon = true,
  showLabel = true,
  showMissingCount = false,
  showTooltip = true,
  asLink = false,
  className,
  onClick,
}: CardPlayabilityBadgeProps) {
  const query = useCardPlayability(propEntry || propStatus ? undefined : code);

  const entry = propEntry || query.entry;
  const status: PlayabilityStatus = propStatus || entry?.status || query.status || "fora";
  const missingClauses = propMissingClauses || entry?.missingClauses || query.missingClauses || [];
  const missingCount = missingClauses.length;

  const sizeClasses = {
    xs: "px-1 py-0.2 text-[8.5px] font-mono tracking-wider gap-0.5",
    sm: "px-1.5 py-0.5 text-[9.5px] font-mono tracking-wider gap-1",
    md: "px-2 py-1 text-[11px] font-sans font-medium tracking-wide gap-1.5",
  }[size];

  const iconSizes = {
    xs: "size-2.5",
    sm: "size-3",
    md: "size-3.5",
  }[size];

  // Configuração por status
  let statusBadgeStyle: string;
  let iconNode: React.ReactNode;
  let labelText: string;
  let tooltipText: string;

  if (status === "apta") {
    statusBadgeStyle =
      "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 backdrop-blur-xs transition-colors hover:bg-emerald-500/25 dark:text-emerald-300 light:border-emerald-600/30 light:bg-emerald-50 light:text-emerald-700";
    iconNode = <CheckCircle2 className={iconSizes} aria-hidden />;
    labelText = size === "xs" ? "Apta" : "Apta para jogar";
    tooltipText = "Apta para jogar no simulador: 100% implementada e testada no motor de regras.";
  } else if (status === "revisao") {
    statusBadgeStyle =
      "border-amber-500/40 bg-amber-500/15 text-amber-300 backdrop-blur-xs transition-colors hover:bg-amber-500/25 dark:text-amber-300 light:border-amber-600/30 light:bg-amber-50 light:text-amber-800";
    iconNode = <AlertTriangle className={iconSizes} aria-hidden />;
    labelText =
      showMissingCount && missingCount > 0 ? `Em revisão (${missingCount})` : "Em revisão";
    tooltipText =
      missingCount > 0
        ? `Ainda em revisão no simulador: ${missingCount} cláusula(s) pendente(s) de implementação no motor.`
        : entry?.motivo ||
          "Ainda em revisão no simulador: algumas cláusulas desta carta não foram implementadas.";
  } else {
    statusBadgeStyle =
      "border-slate-500/40 bg-slate-800/80 text-slate-400 backdrop-blur-xs dark:text-slate-400 light:border-slate-400/40 light:bg-slate-100 light:text-slate-600";
    iconNode = <HelpCircle className={iconSizes} aria-hidden />;
    labelText = "Fora do simulador";
    tooltipText =
      entry?.motivo || "Fora do simulador: carta ainda não catalogada no motor do simulador.";
  }

  const badgeContent = (
    <span
      className={cn(
        "inline-flex items-center select-none rounded-none border font-semibold uppercase leading-none shadow-xs",
        sizeClasses,
        statusBadgeStyle,
        className,
      )}
      onClick={onClick}
    >
      {showIcon ? iconNode : null}
      {showLabel ? <span>{labelText}</span> : null}
    </span>
  );

  let wrappedElement = badgeContent;

  if (asLink) {
    wrappedElement = (
      <Link
        href="/rules"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        className="inline-flex cursor-pointer transition-transform hover:scale-105"
      >
        {badgeContent}
      </Link>
    );
  }

  if (!showTooltip) {
    return wrappedElement;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        asChild
        onClick={(e) => {
          // Evita disparar cliques de elementos pais (como cards com Links)
          e.stopPropagation();
        }}
      >
        <span
          className="inline-flex cursor-help"
          title={tooltipText} // fallback nativo de acessibilidade
        >
          {wrappedElement}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        className="max-w-xs border border-white/20 bg-slate-900/95 p-2 text-xs text-slate-100 shadow-xl backdrop-blur-sm"
      >
        <div className="space-y-1">
          <p className="font-semibold text-white">
            {status === "apta"
              ? "Apta no Simulador"
              : status === "revisao"
                ? "Em Revisão no Simulador"
                : "Fora do Simulador"}
          </p>
          <p className="text-slate-300 text-[11px] leading-relaxed">{tooltipText}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default CardPlayabilityBadge;

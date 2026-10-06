import type { ReactNode } from "react";
import { Link } from "wouter";
import { HelpCircle, ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCardLanguage } from "./useCardLanguage";
import { getKeywordDefinition } from "./keywords";

export interface KeywordTooltipProps {
  /** Tag ou nome da keyword/mecânica, ex: "<Breach 2>", "【Deploy】", "Link". */
  keyword: string;
  /** Conteúdo visual disparador. Se omitido, renderiza um chip de keyword estilizado. */
  children?: ReactNode;
  /** Classes CSS adicionais para o elemento disparador. */
  className?: string;
  /** Exibe link para a base de regras oficial (/rules). Padrão true. */
  showLink?: boolean;
}

export function KeywordTooltip({
  keyword,
  children,
  className,
  showLink = true,
}: KeywordTooltipProps) {
  const { isPt } = useCardLanguage();
  const def = getKeywordDefinition(keyword, isPt ? "PT_BR" : "EN");

  // Se não encontrar definição no dicionário, apenas renderiza o conteúdo sem tooltip
  if (!def) {
    return <>{children ?? <span className={className}>{keyword}</span>}</>;
  }

  const categoryLabel = {
    effect_keyword: isPt ? "Keyword de efeito" : "Effect keyword",
    trigger_keyword: isPt ? "Gatilho de ativação" : "Trigger keyword",
    mechanic: isPt ? "Mecânica de jogo" : "Game mechanic",
    phase_or_step: isPt ? "Fase / Etapa" : "Phase / Step",
  }[def.category];

  const description = isPt ? def.descriptionPt : def.descriptionEn;
  const example = isPt ? def.examplePt : def.exampleEn;
  const rulesLink = `/rules?relatedKeyword=${encodeURIComponent(def.name.split(" ")[0])}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children ? (
          <span
            tabIndex={0}
            className={cn("inline-flex cursor-help items-center gap-0.5 border-b border-dotted border-primary/50", className)}
          >
            {children}
          </span>
        ) : (
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:border-primary hover:bg-primary/20",
              className,
            )}
          >
            <span>{def.raw || keyword}</span>
            <HelpCircle className="size-3 opacity-60" aria-hidden />
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        className="max-w-xs space-y-1.5 rounded-none border border-primary/40 bg-slate-950 p-3 text-left shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
          <span className="font-heading text-xs font-bold text-soft">{def.name}</span>
          <span className="text-[9px] uppercase tracking-wider text-primary">{categoryLabel}</span>
        </div>

        <p className="text-xs leading-relaxed text-slate-300">{description}</p>

        {example ? (
          <p className="text-[11px] leading-relaxed text-slate-400">
            <span className="font-semibold text-slate-500">{isPt ? "Exemplo:" : "Example:"}</span> {example}
          </p>
        ) : null}

        <div className="flex items-center justify-between border-t border-white/10 pt-1.5 text-[10px] text-slate-400">
          {def.rulesSection ? (
            <span className="font-mono text-slate-500">{def.rulesSection}</span>
          ) : (
            <span />
          )}

          {showLink ? (
            <Link
              href={rulesLink}
              className="inline-flex items-center gap-1 text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <span>{isPt ? "Ver regras" : "View rules"}</span>
              <ExternalLink className="size-2.5" />
            </Link>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

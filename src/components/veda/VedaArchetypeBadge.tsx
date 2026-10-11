import { Link } from "wouter";
import { VedaColorPills } from "@/components/veda/VedaColorPills";
import type { VedaArchetypeRef } from "@/lib/veda/types";

export interface VedaArchetypeBadgeProps {
  archetype?: VedaArchetypeRef | null;
  showColors?: boolean;
  className?: string;
  fallbackText?: string;
  asLink?: boolean;
}

export function VedaArchetypeBadge({
  archetype,
  showColors = true,
  className = "",
  fallbackText = "Não categorizado",
  asLink = true,
}: VedaArchetypeBadgeProps) {
  if (!archetype) {
    return <span className={`text-slate-500 font-mono text-xs ${className}`}>{fallbackText}</span>;
  }

  const content = (
    <span className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {showColors && archetype.colors && archetype.colors.length > 0 && (
        <VedaColorPills colors={archetype.colors} size="xs" />
      )}
      <span className="font-heading uppercase tracking-wide text-white group-hover:text-primary transition-colors">
        {archetype.name}
      </span>
    </span>
  );

  if (asLink && archetype.slug) {
    return (
      <Link
        href={`/arquetipos/${archetype.slug}`}
        className="group inline-flex items-center hover:opacity-90 transition-opacity"
        title={`Ver estatísticas do arquétipo ${archetype.name}`}
      >
        {content}
      </Link>
    );
  }

  return content;
}

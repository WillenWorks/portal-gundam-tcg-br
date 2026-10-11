import { User } from "lucide-react";
import { Link } from "wouter";
import type { VedaPlayerRef } from "@/lib/veda/types";

export interface VedaPlayerLinkProps {
  player?: VedaPlayerRef | null;
  name?: string;
  slug?: string;
  showIcon?: boolean;
  className?: string;
  fallbackText?: string;
}

export function VedaPlayerLink({
  player,
  name: directName,
  slug: directSlug,
  showIcon = false,
  className = "",
  fallbackText = "Jogador anônimo",
}: VedaPlayerLinkProps) {
  const name = player?.name || directName;
  const slug = player?.slug || directSlug;

  if (!name) {
    return <span className={`text-slate-500 font-mono text-xs ${className}`}>{fallbackText}</span>;
  }

  const content = (
    <span className={`inline-flex items-center gap-1.5 font-medium text-slate-200 group-hover:text-primary transition-colors ${className}`}>
      {showIcon && <User className="size-3 text-slate-400 group-hover:text-primary shrink-0" />}
      <span className="truncate">{name}</span>
    </span>
  );

  if (slug) {
    return (
      <Link
        href={`/jogadores/${slug}`}
        className="group inline-flex items-center max-w-full"
        title={`Ver histórico e estatísticas de ${name}`}
      >
        {content}
      </Link>
    );
  }

  return content;
}

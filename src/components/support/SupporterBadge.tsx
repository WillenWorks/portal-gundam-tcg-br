/* Insígnia "Apoiador Anaheim Hub" — mesma peça visual usada no mural do CommunitySupportModal
 * e no preview do que aparece no perfil de quem apoia. Puramente CSS/SVG, sem asset externo. */
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export function SupporterBadge({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  const dims = size === "sm" ? "h-5 px-2 text-[9px] gap-1" : "h-7 px-2.5 text-[10px] gap-1.5";
  const iconSize = size === "sm" ? "size-2.5" : "size-3.5";
  return (
    <span className={cn("inline-flex items-center border border-primary/50 bg-gradient-to-r from-primary/20 to-accent/10 font-mono uppercase tracking-[0.14em] text-primary", dims, className)}>
      <ShieldCheck className={iconSize} />
      Apoiador Anaheim Hub
    </span>
  );
}

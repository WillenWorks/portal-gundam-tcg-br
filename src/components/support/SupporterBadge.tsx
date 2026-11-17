/* Insígnia "Apoiador Anaheim Hub" — mesma peça visual usada no mural (/apoie e CommunitySupportModal), no perfil e nos
 * comentários. Com patente (src/lib/supporters.ts), mostra "Apoiador · Piloto" com o ícone da patente. Puramente CSS. */
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { supporterTierInfo } from "@/lib/supporters";
import { useSiteLanguage } from "@/i18n/siteLanguage";

export function SupporterBadge({ size = "md", tier, className }: { size?: "sm" | "md"; tier?: string | null; className?: string }) {
  const { tr } = useSiteLanguage();
  const dims = size === "sm" ? "h-5 px-2 text-[9px] gap-1" : "h-7 px-2.5 text-[10px] gap-1.5";
  const iconSize = size === "sm" ? "size-2.5" : "size-3.5";
  const info = supporterTierInfo(tier);
  const label = info ? `${tr("Apoiador", "Supporter")} · ${tr(info.label, info.labelEn)}` : tr("Apoiador Anaheim Hub", "Anaheim Hub Supporter");
  return (
    <span
      title={info ? tr(`Apoia o Anaheim Hub a partir de R$ ${info.minMonthly}/mês`, `Supports Anaheim Hub from R$ ${info.minMonthly}/month`) : undefined}
      className={cn("inline-flex items-center border border-primary/50 bg-gradient-to-r from-primary/20 to-accent/10 font-mono uppercase tracking-[0.14em] text-primary", dims, className)}
    >
      {info ? <span aria-hidden="true">{info.icon}</span> : <ShieldCheck className={iconSize} />}
      {label}
    </span>
  );
}

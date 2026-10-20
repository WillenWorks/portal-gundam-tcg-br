/* Seletor de idioma: interface do site e texto das cartas, independentes. Fica no topo do site e no
 * simulador; logado, a escolha vai para a conta (vale em qualquer aparelho). */
import { Globe } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCardLanguage } from "@/i18n/useCardLanguage";
import { useSiteLanguage, type SiteLanguage } from "@/i18n/siteLanguage";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { lang, setLanguage, tr } = useSiteLanguage();
  const { language: cardLang, setLanguage: setCardLanguage } = useCardLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={tr("Idioma do site e das cartas", "Site and card language")}
          title={tr("Idioma", "Language")}
          className={cn(
            "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-none border border-white/20 bg-white/5 px-2 text-xs font-semibold uppercase text-slate-200 transition-colors hover:bg-white/10 hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-800",
            className,
          )}
        >
          <Globe className="size-4" />
          {!compact && <span>{lang === "en" ? "EN" : "PT"}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="z-[70] min-w-[200px] rounded-none">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{tr("Idioma do site", "Site language")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={lang} onValueChange={(value) => setLanguage(value as SiteLanguage)}>
          <DropdownMenuRadioItem value="pt-BR">Português (Brasil)</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">{tr("Texto das cartas", "Card text")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={cardLang} onValueChange={(value) => setCardLanguage(value as "PT_BR" | "EN")}>
          <DropdownMenuRadioItem value="PT_BR">Português</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="EN">English</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* Aviso discreto para quem chega de um navegador de fora (idioma que não é português): oferece o site em
 * inglês. Some depois de qualquer escolha. Robôs de busca não veem (o site indexado segue em português). */
import { useEffect, useState } from "react";
import { Globe, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { browserPrefersEnglish, useSiteLanguage } from "@/i18n/siteLanguage";
import { useCardLanguage } from "@/i18n/useCardLanguage";

export function LanguageSuggestion() {
  const { hasChosen, lang, setLanguage } = useSiteLanguage();
  const { setLanguage: setCardLanguage } = useCardLanguage();
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // conta logada já tem idioma salvo; só visitante sem escolha recebe a sugestão
    setShow(!user && !hasChosen && lang === "pt-BR" && browserPrefersEnglish(typeof navigator !== "undefined" ? navigator : undefined));
  }, [user, hasChosen, lang]);

  if (!show) return null;

  return (
    <div role="region" aria-label="Language" className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-lg items-center gap-3 border border-primary/40 bg-slate-950/95 px-4 py-3 text-sm text-slate-100 shadow-2xl backdrop-blur light:bg-white light:text-slate-900">
      <Globe className="size-5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1">This site is in Portuguese. Would you like to use it in English?</p>
      <button
        type="button"
        className="shrink-0 bg-primary px-3 py-1.5 text-xs font-semibold uppercase text-primary-foreground hover:bg-primary/90"
        onClick={() => {
          setLanguage("en");
          setCardLanguage("EN");
          setShow(false);
        }}
      >
        English
      </button>
      <button type="button" aria-label="Manter em português / Keep Portuguese" className="shrink-0 p-1 text-slate-400 hover:text-white" onClick={() => { setLanguage("pt-BR"); setShow(false); }}>
        <X className="size-4" />
      </button>
    </div>
  );
}

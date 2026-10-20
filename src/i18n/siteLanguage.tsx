/* Idioma da interface do site ("pt-BR" | "en").
 *
 * Separado do idioma do TEXTO DAS CARTAS (useCardLanguage): dá para usar o site em inglês e ler as cartas em
 * português, ou o contrário.
 *
 * - Conta logada: vale o que está salvo na conta (`preferredSiteLanguage`); trocar no seletor salva na conta.
 * - Visitante: vale o que foi escolhido neste navegador (localStorage); sem escolha, português.
 * - O endereço não muda (não existe /en): o Google segue vendo o site em português.
 *
 * Uso nos componentes: `const { tr } = useSiteLanguage(); tr("Salvar", "Save")`.
 * Fora de componentes (toasts, mensagens de erro): `tr()` exportado, que lê o idioma atual. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

import {
  normalizeSiteLanguage,
  pick,
  readStoredLanguage,
  setCurrentSiteLanguage,
  siteLocale,
  storeLanguage,
  SITE_LANGUAGE_STORAGE_KEY,
  type SiteLanguage,
  type Translate,
} from "./siteLanguageCore";

export * from "./siteLanguageCore";

type SiteLanguageValue = {
  lang: SiteLanguage;
  isEn: boolean;
  locale: string;
  tr: Translate;
  setLanguage: (lang: SiteLanguage) => void;
  /** Visitante que ainda não escolheu idioma neste navegador. */
  hasChosen: boolean;
};

const SiteLanguageContext = createContext<SiteLanguageValue | null>(null);

export function SiteLanguageProvider({ children }: { children: ReactNode }) {
  const { user, setCurrentUser } = useAuth();
  const [guestLang, setGuestLang] = useState<SiteLanguage>(() => readStoredLanguage() ?? "pt-BR");
  const [hasChosen, setHasChosen] = useState(() => readStoredLanguage() !== null);

  const lang: SiteLanguage = user?.preferredSiteLanguage ? normalizeSiteLanguage(user.preferredSiteLanguage) : guestLang;
  setCurrentSiteLanguage(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // outra aba trocou o idioma
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SITE_LANGUAGE_STORAGE_KEY && (event.newValue === "en" || event.newValue === "pt-BR")) setGuestLang(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLanguage = useCallback(
    (next: SiteLanguage) => {
      setCurrentSiteLanguage(next);
      setGuestLang(next);
      setHasChosen(true);
      storeLanguage(next);
      if (user && user.preferredSiteLanguage !== next) {
        setCurrentUser({ ...user, preferredSiteLanguage: next });
        api.updateMe({ preferredSiteLanguage: next }).catch(() => {
          /* fica valendo neste navegador; a conta tenta de novo na próxima troca */
        });
      }
    },
    [user, setCurrentUser],
  );

  const value = useMemo<SiteLanguageValue>(
    () => ({
      lang,
      isEn: lang === "en",
      locale: siteLocale(lang),
      tr: (pt, en) => pick(lang, pt, en),
      setLanguage,
      hasChosen: hasChosen || Boolean(user?.preferredSiteLanguage && user.preferredSiteLanguage !== "pt-BR"),
    }),
    [lang, setLanguage, hasChosen, user?.preferredSiteLanguage],
  );

  return <SiteLanguageContext.Provider value={value}>{children}</SiteLanguageContext.Provider>;
}

const FALLBACK: SiteLanguageValue = {
  lang: "pt-BR",
  isEn: false,
  locale: "pt-BR",
  tr: (pt) => pick("pt-BR", pt),
  setLanguage: () => {},
  hasChosen: true,
};

/** Idioma da interface. Fora do provider (testes de componente isolado) responde em português. */
export function useSiteLanguage(): SiteLanguageValue {
  return useContext(SiteLanguageContext) ?? FALLBACK;
}

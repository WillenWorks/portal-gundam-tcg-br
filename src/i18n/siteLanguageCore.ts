/* Núcleo do idioma do site, sem React nem dependências: tipos, `tr` para código fora de componentes
 * (toasts, contexto de login) e detecção do navegador. O provider e o hook ficam em siteLanguage.tsx. */
export type SiteLanguage = "pt-BR" | "en";

/** Texto nos dois idiomas, para listas e dados fora dos componentes: `{ pt: "Regras", en: "Rules" }`. */
export type Localized = { pt: string; en: string };

/** `tr("pt", "en")` ou `tr({ pt, en })`. */
export type Translate = (pt: string | Localized, en?: string) => string;

export function pick(lang: SiteLanguage, pt: string | Localized, en?: string): string {
  if (typeof pt === "object") return lang === "en" ? pt.en : pt.pt;
  return lang === "en" ? (en ?? pt) : pt;
}

export const SITE_LANGUAGE_STORAGE_KEY = "portal_gundam_site_lang";

let currentLanguage: SiteLanguage = readStoredLanguage() ?? "pt-BR";

export function readStoredLanguage(): SiteLanguage | null {
  try {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(SITE_LANGUAGE_STORAGE_KEY) : null;
    return saved === "en" || saved === "pt-BR" ? saved : null;
  } catch {
    return null;
  }
}

export function storeLanguage(lang: SiteLanguage) {
  try {
    window.localStorage.setItem(SITE_LANGUAGE_STORAGE_KEY, lang);
  } catch {
    /* navegador sem armazenamento: vale só nesta visita */
  }
}

export function normalizeSiteLanguage(value: unknown): SiteLanguage {
  return value === "en" ? "en" : "pt-BR";
}

/** Texto no idioma atual — para código fora de componentes. Em componentes, prefira o `tr` do hook. */
export const tr: Translate = (pt, en) => pick(currentLanguage, pt, en);

export function getSiteLanguage(): SiteLanguage {
  return currentLanguage;
}

/** Locale para datas e números ("pt-BR" | "en-US"). */
export function siteLocale(lang: SiteLanguage = currentLanguage): string {
  return lang === "en" ? "en-US" : "pt-BR";
}

/** O navegador é de fora do Brasil/Portugal (e não é robô de busca)? Usado só para sugerir o inglês. */
export function browserPrefersEnglish(nav: { language?: string; languages?: readonly string[]; userAgent?: string } | undefined): boolean {
  if (!nav) return false;
  if (/bot|crawler|spider|crawling|lighthouse|headless/i.test(nav.userAgent ?? "")) return false;
  const langs = [...(nav.languages ?? []), nav.language ?? ""].filter(Boolean).map((l) => l.toLowerCase());
  if (langs.length === 0) return false;
  return !langs.some((l) => l.startsWith("pt"));
}

/** Usado pelo provider a cada render: mantém o `tr` fora de componentes no idioma atual. */
export function setCurrentSiteLanguage(lang: SiteLanguage) {
  currentLanguage = lang;
}

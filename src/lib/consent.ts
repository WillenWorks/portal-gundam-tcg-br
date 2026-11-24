/* Consentimento de cookies (LGPD) para o Google Analytics 4 e os anúncios personalizados do AdSense.
 *
 * O padrão "negado" entra antes de qualquer script do Google, por public/consent-default.js (mesma chave e
 * versão daqui). Este módulo guarda a escolha da pessoa, avisa o Google (Consent Mode v2) e só carrega o GA4
 * depois do "Aceitar". Recusar apaga os cookies _ga e deixa o AdSense em anúncio não personalizado. */
import { useSyncExternalStore } from "react";

export const CONSENT_STORAGE_KEY = "anaheimhub:consent";
export const CONSENT_VERSION = 1;

/** ID público da propriedade GA4 (vai no HTML de qualquer jeito); VITE_GA_MEASUREMENT_ID no build sobrescreve. */
const DEFAULT_GA_MEASUREMENT_ID = "";
const GA_SRC = "https://www.googletagmanager.com/gtag/js";
const PRODUCTION_HOSTS = new Set(["anaheimhub.com", "www.anaheimhub.com"]);
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;

export type ConsentChoice = { v: number; analytics: boolean; ads: boolean; at: string };
export type ConsentState = { choice: ConsentChoice | null; panelOpen: boolean };

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readConsent(store: Storage | null = storage()): ConsentChoice | null {
  try {
    const raw = store?.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentChoice> | null;
    if (!parsed || parsed.v !== CONSENT_VERSION) return null;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.ads !== "boolean") return null;
    return { v: CONSENT_VERSION, analytics: parsed.analytics, ads: parsed.ads, at: String(parsed.at ?? "") };
  } catch {
    return null;
  }
}

export function gaMeasurementId(): string {
  const id = ((import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) || DEFAULT_GA_MEASUREMENT_ID).trim();
  return MEASUREMENT_ID.test(id) ? id : "";
}

export function isProductionHost(hostname: string): boolean {
  return PRODUCTION_HOSTS.has(hostname);
}

/** O aviso aparece em produção; em desenvolvimento só com VITE_CONSENT_PREVIEW=1. */
export function consentBannerEnabled(hostname = typeof window === "undefined" ? "" : window.location.hostname): boolean {
  return isProductionHost(hostname) || import.meta.env.VITE_CONSENT_PREVIEW === "1";
}

function gtag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    // o gtag.js só aceita o objeto `arguments` na fila, não um array
    window.gtag = function gtagQueue() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
  window.gtag(...args);
}

export function loadGoogleAnalytics(id = gaMeasurementId(), hostname = typeof window === "undefined" ? "" : window.location.hostname): boolean {
  if (typeof document === "undefined" || !id || !isProductionHost(hostname)) return false;
  if (document.querySelector(`script[src^="${GA_SRC}"]`)) return true;
  gtag("js", new Date());
  // as trocas de rota da SPA contam como visualização pela "medição otimizada" do GA4 (eventos de histórico)
  gtag("config", id);
  const script = document.createElement("script");
  script.async = true;
  script.src = `${GA_SRC}?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  return true;
}

export function clearAnalyticsCookies(hostname = typeof window === "undefined" ? "" : window.location.hostname): void {
  if (typeof document === "undefined") return;
  const bare = hostname.replace(/^www\./, "");
  const domains = ["", `; domain=${hostname}`, `; domain=.${bare}`];
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name || !name.startsWith("_ga")) continue;
    for (const domain of domains) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
  }
}

function applyConsent(choice: ConsentChoice): void {
  if (typeof window === "undefined") return;
  const ads = choice.ads ? "granted" : "denied";
  gtag("consent", "update", {
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
    analytics_storage: choice.analytics ? "granted" : "denied",
  });
  const queue = (window.adsbygoogle = window.adsbygoogle || []) as unknown[] & { requestNonPersonalizedAds?: number };
  queue.requestNonPersonalizedAds = choice.ads ? 0 : 1;
  if (choice.analytics) loadGoogleAnalytics();
  else clearAnalyticsCookies();
}

let state: ConsentState = { choice: readConsent(), panelOpen: false };
const listeners = new Set<() => void>();

function setState(next: ConsentState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function saveConsent(accepted: boolean, now = new Date()): ConsentChoice {
  const choice: ConsentChoice = { v: CONSENT_VERSION, analytics: accepted, ads: accepted, at: now.toISOString() };
  try {
    storage()?.setItem(CONSENT_STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // sem localStorage a escolha vale só nesta visita
  }
  applyConsent(choice);
  setState({ choice, panelOpen: false });
  return choice;
}

export function openConsentPreferences(): void {
  setState({ ...state, panelOpen: true });
}

export function closeConsentPreferences(): void {
  setState({ ...state, panelOpen: false });
}

/** Na abertura do app: quem já aceitou volta a ter o GA4 (o padrão negado/aceito já veio do consent-default.js). */
export function initConsent(): void {
  const choice = readConsent();
  state = { choice, panelOpen: false };
  if (choice?.analytics) loadGoogleAnalytics();
}

export function useConsentState(): ConsentState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}

/** O aviso de cookies está na tela (outros avisos fixos no rodapé esperam ele sair). */
export function useConsentBannerVisible(): boolean {
  const { choice, panelOpen } = useConsentState();
  return consentBannerEnabled() && (!choice || panelOpen);
}

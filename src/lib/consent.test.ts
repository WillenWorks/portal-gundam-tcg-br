// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  clearAnalyticsCookies,
  loadGoogleAnalytics,
  readConsent,
  saveConsent,
} from "./consent";

const GA_SCRIPT = 'script[src^="https://www.googletagmanager.com/gtag/js"]';
type Queue = unknown[] & { requestNonPersonalizedAds?: number };

function consentCalls() {
  return (window.dataLayer ?? [])
    .map((entry) => Array.from(entry as ArrayLike<unknown>))
    .filter((args) => args[0] === "consent");
}

describe("consent", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.dataLayer;
    delete window.gtag;
    delete window.adsbygoogle;
  });
  afterEach(() => document.head.querySelectorAll("script").forEach((s) => s.remove()));

  it("lê só escolha válida da versão atual", () => {
    expect(readConsent()).toBeNull();
    localStorage.setItem(CONSENT_STORAGE_KEY, "{quebrado");
    expect(readConsent()).toBeNull();
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ v: 0, analytics: true, ads: true }));
    expect(readConsent()).toBeNull();
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ v: CONSENT_VERSION, analytics: "sim", ads: true }));
    expect(readConsent()).toBeNull();
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ v: CONSENT_VERSION, analytics: true, ads: false, at: "x" }));
    expect(readConsent()).toEqual({ v: CONSENT_VERSION, analytics: true, ads: false, at: "x" });
  });

  it("recusar avisa o Google, pede anúncio não personalizado e não carrega o GA4", () => {
    saveConsent(false, new Date("2026-11-24T12:00:00Z"));
    expect(readConsent()).toMatchObject({ analytics: false, ads: false, at: "2026-11-24T12:00:00.000Z" });
    expect(consentCalls().at(-1)).toEqual([
      "consent",
      "update",
      { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" },
    ]);
    expect((window.adsbygoogle as Queue).requestNonPersonalizedAds).toBe(1);
    expect(document.querySelector(GA_SCRIPT)).toBeNull();
  });

  it("aceitar libera tudo; a fila do gtag recebe o objeto arguments", () => {
    saveConsent(true);
    const last = (window.dataLayer ?? []).at(-1);
    expect(Array.isArray(last)).toBe(false);
    expect(consentCalls().at(-1)?.[2]).toMatchObject({ ad_personalization: "granted", analytics_storage: "granted" });
    expect((window.adsbygoogle as Queue).requestNonPersonalizedAds).toBe(0);
  });

  it("GA4 só carrega em produção e com ID válido, uma vez só", () => {
    expect(loadGoogleAnalytics("", "anaheimhub.com")).toBe(false);
    expect(loadGoogleAnalytics("G-ABC1234", "localhost")).toBe(false);
    expect(document.querySelector(GA_SCRIPT)).toBeNull();
    expect(loadGoogleAnalytics("G-ABC1234", "anaheimhub.com")).toBe(true);
    expect(loadGoogleAnalytics("G-ABC1234", "anaheimhub.com")).toBe(true);
    const scripts = document.head.querySelectorAll(GA_SCRIPT);
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toBe("https://www.googletagmanager.com/gtag/js?id=G-ABC1234");
  });

  it("revogar apaga os cookies _ga e mantém os outros", () => {
    document.cookie = "_ga=GA1.1.123; path=/";
    document.cookie = "_ga_ABC1234=GS1.1.1; path=/";
    document.cookie = "tema=escuro; path=/";
    clearAnalyticsCookies("localhost");
    expect(document.cookie).toBe("tema=escuro");
  });

  it("public/consent-default.js usa a mesma chave e versão e nega por padrão", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../../public/consent-default.js"), "utf8");
    expect(source).toContain(`"${CONSENT_STORAGE_KEY}"`);
    expect(source).toContain(`choice.v === ${CONSENT_VERSION}`);
    // roda o script: sem escolha salva, tudo negado
    new Function(source)();
    expect(consentCalls()[0]?.[1]).toBe("default");
    expect(consentCalls()[0]?.[2]).toMatchObject({ ad_storage: "denied", analytics_storage: "denied" });
    expect((window.adsbygoogle as Queue).requestNonPersonalizedAds).toBe(1);
  });

  it("index.html carrega o padrão de consentimento antes do AdSense", () => {
    const html = fs.readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
    const consent = html.indexOf('<script src="/consent-default.js"></script>');
    expect(consent).toBeGreaterThan(-1);
    expect(consent).toBeLessThan(html.indexOf("adsbygoogle.js"));
  });
});

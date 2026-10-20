// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { browserPrefersEnglish, normalizeSiteLanguage, pick, siteLocale, tr, setCurrentSiteLanguage, useSiteLanguage } from "../siteLanguage";

describe("idioma do site — núcleo", () => {
  beforeEach(() => setCurrentSiteLanguage("pt-BR"));

  it("tr escolhe o texto do idioma atual, com string ou objeto", () => {
    expect(tr("Salvar", "Save")).toBe("Salvar");
    expect(tr({ pt: "Regras", en: "Rules" })).toBe("Regras");
    setCurrentSiteLanguage("en");
    expect(tr("Salvar", "Save")).toBe("Save");
    expect(tr({ pt: "Regras", en: "Rules" })).toBe("Rules");
    expect(pick("en", "só português")).toBe("só português");
  });

  it("normaliza o valor salvo e o locale", () => {
    expect(normalizeSiteLanguage("en")).toBe("en");
    expect(normalizeSiteLanguage("xx")).toBe("pt-BR");
    expect(normalizeSiteLanguage(undefined)).toBe("pt-BR");
    expect(siteLocale("en")).toBe("en-US");
    expect(siteLocale("pt-BR")).toBe("pt-BR");
  });

  it("sugere inglês só para navegador de fora e que não seja robô", () => {
    expect(browserPrefersEnglish({ language: "en-US", languages: ["en-US", "en"], userAgent: "Mozilla/5.0 Chrome" })).toBe(true);
    expect(browserPrefersEnglish({ language: "ja-JP", languages: ["ja-JP"], userAgent: "Mozilla/5.0" })).toBe(true);
    expect(browserPrefersEnglish({ language: "pt-BR", languages: ["pt-BR", "en"], userAgent: "Mozilla/5.0" })).toBe(false);
    expect(browserPrefersEnglish({ language: "en-US", languages: ["en-US", "pt-PT"], userAgent: "Mozilla/5.0" })).toBe(false);
    expect(browserPrefersEnglish({ language: "en-US", userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" })).toBe(false);
    expect(browserPrefersEnglish({ language: "en-US", userAgent: "Mozilla/5.0 HeadlessChrome/140" })).toBe(false);
    expect(browserPrefersEnglish(undefined)).toBe(false);
  });

  it("fora do provider o hook responde em português", () => {
    function Probe() {
      const { tr: t, lang } = useSiteLanguage();
      return <p>{lang} · {t("Entrar", "Sign in")}</p>;
    }
    act(() => { render(<Probe />); });
    expect(screen.getByText("pt-BR · Entrar")).toBeTruthy();
  });
});

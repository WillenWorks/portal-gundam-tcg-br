import { describe, expect, it } from "vitest";
import { getCardMarketLinks, getSetMarketLinks } from "./marketplace";

describe("marketplace helpers", () => {
  it("gera URLs corretas para cartas avulsas com código", () => {
    const links = getCardMarketLinks({
      code: "ST01-001",
      nameEn: "Gundam",
      namePt: "Gundam",
    });

    expect(links.ligaGundamUrl).toContain("ligagundam.com.br");
    expect(links.ligaGundamUrl).toContain("ST01-001");

    expect(links.myPcardsUrl).toContain("mypcards.com/gundam");
    expect(links.myPcardsUrl).toContain("ST01-001");

    expect(links.mercadoLivreUrl).toContain("mercadolivre.com.br");
    expect(links.mercadoLivreUrl).toContain("ST01-001");

    expect(links.amazonUrl).toContain("amazon.com.br");
    expect(links.amazonUrl).toContain("ST01-001");
  });

  it("gera URLs com fallback para nome caso não haja código", () => {
    const links = getCardMarketLinks({
      nameEn: "Wing Gundam Zero",
    });

    expect(links.ligaGundamUrl).toContain("Wing%20Gundam%20Zero");
    expect(links.myPcardsUrl).toContain("Wing%20Gundam%20Zero");
  });

  it("gera URLs corretas para produtos selados (Starter Decks e Booster Boxes)", () => {
    const starterLinks = getSetMarketLinks("ST01", "Zeon Starter Deck");
    expect(starterLinks.mercadoLivreUrl.toLowerCase()).toContain("starter%20deck");
    expect(starterLinks.amazonUrl).toContain("ST01");

    const boosterLinks = getSetMarketLinks("GD01", "Newtype Rising");
    expect(boosterLinks.mercadoLivreUrl.toLowerCase()).toContain("booster%20box");
    expect(boosterLinks.amazonUrl).toContain("GD01");
  });
});

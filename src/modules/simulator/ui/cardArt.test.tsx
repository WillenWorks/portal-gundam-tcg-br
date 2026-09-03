// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { artSrc, cardBackUrl, isGenericArtCard } from "./cardArt";
import { CardBack, CardFace } from "./CardFace";

afterEach(cleanup);

describe("isGenericArtCard", () => {
  it("recursos, EX base/resource e tokens usam a arte padrão", () => {
    expect(isGenericArtCard("RESOURCE")).toBe(true);
    expect(isGenericArtCard("BASE", true)).toBe(true); // EX Base
    expect(isGenericArtCard("UNIT", true)).toBe(true); // token unit
  });

  it("cartas normais NÃO são genéricas", () => {
    expect(isGenericArtCard("UNIT")).toBe(false);
    expect(isGenericArtCard("PILOT")).toBe(false);
    expect(isGenericArtCard("BASE")).toBe(false);
  });
});

describe("CardFace / CardBack — verso padrão", () => {
  it("CardBack renderiza a imagem do verso", () => {
    render(<CardBack />);
    expect(screen.getByRole("img", { name: "Verso da carta" })).toHaveAttribute("src", cardBackUrl);
  });

  it("sem arte + backFallback: usa o verso em vez do fallback tipográfico", () => {
    render(<CardFace nameEn="Resource" code="ST01-RESOURCE" art={{}} backFallback />);
    expect(screen.getByRole("img", { name: "Resource" })).toHaveAttribute("src", cardBackUrl);
    expect(screen.queryByText("ST01-RESOURCE")).toBeNull();
  });

  it("sem arte e sem backFallback: fallback tipográfico (nome + código)", () => {
    render(<CardFace nameEn="Gundam" code="ST01-001" art={{}} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("ST01-001")).toBeInTheDocument();
  });

  it("arte real do catálogo tem prioridade sobre o verso", () => {
    const art = { "ST01-RESOURCE": { imageUrl: "custom.png" } };
    expect(artSrc(art, "ST01-RESOURCE", "sm")).toBe("custom.png");
    render(<CardFace nameEn="Resource" code="ST01-RESOURCE" art={art} backFallback />);
    expect(screen.getByRole("img", { name: "Resource" })).toHaveAttribute("src", "custom.png");
  });
});

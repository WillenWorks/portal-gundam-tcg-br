// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VedaSampleNote } from "@/components/veda/VedaSampleNote";
import { VedaSourceCredit } from "@/components/veda/VedaSourceCredit";
import { VedaPlacementBadge } from "@/components/veda/VedaPlacementBadge";

describe("Veda Components", () => {
  describe("VedaSampleNote", () => {
    it("exibe a contagem de listas e torneios", () => {
      render(
        <VedaSampleNote
          sample={{ lists: 42, tournaments: 5, from: null, to: null, small: false }}
        />,
      );
      expect(screen.getByText(/42 listas de 5 torneios/i)).toBeDefined();
    });

    it("sinaliza amostra pequena quando small é true", () => {
      render(
        <VedaSampleNote
          sample={{ lists: 6, tournaments: 1, from: null, to: null, small: true }}
        />,
      );
      expect(screen.getByText(/poucos dados/i)).toBeDefined();
    });
  });

  describe("VedaSourceCredit", () => {
    it("exibe crédito obrigatório da DigiLab com link", () => {
      render(
        <VedaSourceCredit
          source={{ id: "digilab", name: "DigiLab", attribution: "Dados: DigiLab (digilab.cards)", url: "https://digilab.cards/event/123" }}
          sourceUrl="https://digilab.cards/event/123"
        />,
      );
      const link = screen.getByRole("link", { name: /Fonte: DigiLab/i });
      expect(link).toBeDefined();
      expect(link.getAttribute("href")).toBe("https://digilab.cards/event/123");
      expect(link.getAttribute("target")).toBe("_blank");
    });

    it("exibe crédito da Egman Events", () => {
      render(
        <VedaSourceCredit
          source={{ id: "egman", name: "Egman Events", attribution: "Fonte: Egman Events", url: null }}
        />,
      );
      expect(screen.getByText(/Fonte: Egman Events/i)).toBeDefined();
    });
  });

  describe("VedaPlacementBadge", () => {
    it("destaca campeão (1º lugar)", () => {
      render(<VedaPlacementBadge placement={1} placementLabel="1º" />);
      expect(screen.getByText("1º")).toBeDefined();
    });
  });
});

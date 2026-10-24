import { describe, expect, it } from "vitest";
import { adminTabFromHash } from "./adminTabs";

describe("adminTabFromHash", () => {
  it("o link do aviso do Discord (/admin#social) abre direto a aba de redes sociais", () => {
    expect(adminTabFromHash("#social")).toBe("social");
  });

  it("sem âncora ou com âncora desconhecida, abre a visão geral", () => {
    expect(adminTabFromHash("")).toBe("overview");
    expect(adminTabFromHash("#qualquer")).toBe("overview");
  });
});

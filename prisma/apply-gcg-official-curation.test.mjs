import { describe, expect, it } from "vitest";
import { normalizeSourceTitle } from "./apply-gcg-official-curation.mjs";

describe("normalizeSourceTitle", () => {
  it("retorna null pra valores vazios ou marcador de ausência ('-')", () => {
    expect(normalizeSourceTitle(null)).toBeNull();
    expect(normalizeSourceTitle(undefined)).toBeNull();
    expect(normalizeSourceTitle("")).toBeNull();
    expect(normalizeSourceTitle("-")).toBeNull();
  });

  it("mantém títulos que já vêm no formato canônico", () => {
    expect(normalizeSourceTitle("Mobile Suit Gundam SEED")).toBe("Mobile Suit Gundam SEED");
    expect(normalizeSourceTitle("Mobile Suit Gundam Unicorn")).toBe("Mobile Suit Gundam Unicorn");
    expect(normalizeSourceTitle("Mobile Suit Gundam GQuuuuuuX")).toBe("Mobile Suit Gundam GQuuuuuuX");
  });

  it("corrige as variações de grafia conhecidas do scrape oficial (ver docs/10)", () => {
    expect(normalizeSourceTitle("Mobile Suit Gundam IRON-BLOODED ORPHANS")).toBe("Mobile Suit Gundam: Iron-Blooded Orphans");
    expect(normalizeSourceTitle("Mobile Suit Gundam SEED DESTINY")).toBe("Mobile Suit Gundam SEED Destiny");
    expect(normalizeSourceTitle("Mobile Suit Gundam: Char's Counterattack")).toBe("Mobile Suit Gundam Char's Counterattack");
    expect(normalizeSourceTitle("Mobile Suit V Gundam")).toBe("Mobile Suit Victory Gundam");
    expect(normalizeSourceTitle("∀ Gundam")).toBe("Turn A Gundam");
    expect(normalizeSourceTitle("Mobile Suit Z Gundam")).toBe("Mobile Suit Zeta Gundam");
  });

  it("normaliza aspas curvas pra aspas retas antes de comparar", () => {
    // aspas curvas (\u2019) apareciam em algumas linhas do scrape; sem essa normalização
    // "Hathaway\u2019s Flash" nunca bateria com a entrada canônica que usa aspas retas.
    expect(normalizeSourceTitle("Mobile Suit Gundam: Hathaway\u2019s Flash")).toBe("Mobile Suit Gundam: Hathaway's Flash");
  });

  it("descarta linhas com bug de concatenação (vários títulos grudados numa carta genérica)", () => {
    // caso real: EXR-006 "EX Resource" veio com 2 source titles colados no scrape.
    const concatenado = "Mobile Suit Gundam: Char's Counterattack Mobile Suit Gundam: Hathaway's Flash";
    expect(normalizeSourceTitle(concatenado)).toBeNull();
  });

  it("remove prefixo duplicado quando só repete 'Mobile Suit Gundam' colado", () => {
    expect(normalizeSourceTitle("Mobile Suit Gundam Mobile Suit Gundam GQuuuuuuX")).toBe("Mobile Suit Gundam GQuuuuuuX");
  });

  it("não mexe em títulos que não têm correção mapeada", () => {
    expect(normalizeSourceTitle("SD Gundam G Generation ETERNAL")).toBe("SD Gundam G Generation ETERNAL");
    expect(normalizeSourceTitle("After War Gundam X")).toBe("After War Gundam X");
  });
});

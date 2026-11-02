import { describe, expect, it } from "vitest";
import { safeImageSrc } from "./safeImageSrc";

describe("safeImageSrc", () => {
  it("aceita http(s) e caminho do próprio site", () => {
    expect(safeImageSrc("https://anaheimhub.com/capa.jpg")).toBe("https://anaheimhub.com/capa.jpg");
    expect(safeImageSrc("http://exemplo.com/a.png")).toBe("http://exemplo.com/a.png");
    expect(safeImageSrc(" /uploads/media/capa.jpg ")).toBe("/uploads/media/capa.jpg");
  });

  it("recusa outros esquemas, host sem esquema e valores vazios", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,oi", "//host.com/a.png", "capa.jpg", "", null, undefined]) {
      expect(safeImageSrc(value)).toBe("");
    }
  });

  it("remove os caracteres que permitiriam sair do atributo", () => {
    expect(safeImageSrc('/a.png"><script>')).toBe("/a.pngscript");
  });
});

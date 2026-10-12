import { describe, expect, it } from "vitest";
import { cleanPathToHash } from "./cleanPathToHash";

describe("cleanPathToHash", () => {
  it("leva o endereço limpo para a rota com hash, mantendo a query", () => {
    expect(cleanPathToHash("/redefinir-senha", "?token=abc", "")).toBe("/?token=abc#/redefinir-senha");
    expect(cleanPathToHash("/privacidade/", "", "")).toBe("/#/privacidade");
  });
  it("não mexe na raiz, em rotas com hash, na API nem em arquivos", () => {
    expect(cleanPathToHash("/", "?x=1", "")).toBeNull();
    expect(cleanPathToHash("/login", "", "#/login")).toBeNull();
    expect(cleanPathToHash("/api/health", "", "")).toBeNull();
    expect(cleanPathToHash("/sitemap.xml", "", "")).toBeNull();
  });
});

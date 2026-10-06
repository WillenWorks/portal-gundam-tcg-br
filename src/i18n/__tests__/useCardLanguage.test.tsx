// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authContext from "@/contexts/AuthContext";
import { useCardLanguage } from "../useCardLanguage";

describe("useCardLanguage hook", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("retorna PT_BR por padrão para visitante sem login", () => {
    const { result } = renderHook(() => useCardLanguage());
    expect(result.current.language).toBe("PT_BR");
    expect(result.current.isPt).toBe(true);
    expect(result.current.isEn).toBe(false);

    expect(result.current.getPhaseStep("start_phase")).toBe("Fase de Início");
  });

  it("permite ao visitante alternar para EN e persiste em localStorage", () => {
    const { result } = renderHook(() => useCardLanguage());

    act(() => {
      result.current.setLanguage("EN");
    });

    expect(result.current.language).toBe("EN");
    expect(result.current.isPt).toBe(false);
    expect(result.current.isEn).toBe(true);
    expect(localStorage.getItem("portal_gundam_card_lang")).toBe("EN");
    expect(result.current.getPhaseStep("start_phase")).toBe("Start Phase");
  });

  it("respeita preferredCardLanguage === 'EN' do usuário autenticado", () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: {
        id: "u1",
        email: "pilot@anaheim.org",
        displayName: "Amuro",
        preferredCardLanguage: "EN",
      } as any,
      isAuthenticated: true,
      login: vi.fn(),
      loginWithGoogle: vi.fn(),
      register: vi.fn(),
      refreshMe: vi.fn(),
      setCurrentUser: vi.fn(),
      logout: vi.fn(),
    });

    const { result } = renderHook(() => useCardLanguage());
    expect(result.current.language).toBe("EN");
    expect(result.current.isPt).toBe(false);
    expect(result.current.isEn).toBe(true);

    const card = {
      code: "ST01-001",
      effectEn: "Draw 1.",
      effectPt: "Compre 1.",
    };
    expect(result.current.cardText(card).text).toBe("Draw 1.");
  });

  it("respeita preferredCardLanguage === 'PT_BR' do usuário autenticado", () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: {
        id: "u2",
        email: "char@zeon.org",
        displayName: "Char",
        preferredCardLanguage: "PT_BR",
      } as any,
      isAuthenticated: true,
      login: vi.fn(),
      loginWithGoogle: vi.fn(),
      register: vi.fn(),
      refreshMe: vi.fn(),
      setCurrentUser: vi.fn(),
      logout: vi.fn(),
    });

    const { result } = renderHook(() => useCardLanguage());
    expect(result.current.language).toBe("PT_BR");
    expect(result.current.isPt).toBe(true);
    expect(result.current.isEn).toBe(false);

    const card = {
      code: "ST01-001",
      effectEn: "Draw 1.",
      effectPt: "Compre 1.",
    };
    expect(result.current.cardText(card).text).toBe("Compre 1.");
    expect(result.current.getKeyword("<Blocker>")?.descriptionPt).toContain("mudar o alvo do ataque para ela");
  });
});

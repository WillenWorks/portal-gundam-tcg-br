/**
 * Hook `useCardLanguage` para consumo da preferência de idioma da conta do usuário.
 *
 * REGRA DO PROJETO:
 * - Usuário com preferredCardLanguage === "EN": tudo em inglês.
 * - Usuário com preferredCardLanguage === "PT_BR": tudo traduzido para português.
 * - Visitante sem login: padrão "PT_BR" (padrão do site), com persistência em localStorage para conveniência.
 * - Mudanças na preferência no perfil refletem imediatamente sem necessidade de recarregar a partida.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cardText } from "./cardText";
import { getKeywordDefinition, getPhaseStepLabel } from "./keywords";
import type { CardLanguage, CardTextInput, CardTextResult, KeywordDefinition } from "./types";

const GUEST_STORAGE_KEY = "portal_gundam_card_lang";

export interface CardLanguageHook {
  /** Idioma ativo para cartas e termos ("PT_BR" | "EN"). */
  language: CardLanguage;
  /** True quando o idioma atual é português (padrão do portal). */
  isPt: boolean;
  /** True quando o idioma atual é inglês. */
  isEn: boolean;
  /** Altera o idioma ativo (se autenticado, deve ser persistido via ProfilePage). */
  setLanguage: (lang: CardLanguage) => void;
  /** Helper utilitário acoplado ao idioma atual da sessão. */
  cardText: (card: CardTextInput | null | undefined, trigger?: string) => CardTextResult;
  /** Consulta definição de keyword/mecânica no idioma ativo. */
  getKeyword: (keywordOrTag: string) => KeywordDefinition | undefined;
  /** Consulta rótulo amigável de fase ou etapa no idioma ativo. */
  getPhaseStep: (stepOrPhase: string) => string;
}

export function useCardLanguage(): CardLanguageHook {
  // Obtém o usuário de forma segura caso o hook seja invocado fora de AuthProvider em testes
  let authUser: { preferredCardLanguage?: "PT_BR" | "EN" } | null = null;
  try {
    const auth = useAuth();
    authUser = auth?.user ?? null;
  } catch {
    // Isolamento para testes unitários ou renderizações puras
    authUser = null;
  }

  // Estado local para convidados/visitantes
  const [guestLang, setGuestLang] = useState<CardLanguage>(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = window.localStorage.getItem(GUEST_STORAGE_KEY);
      if (saved === "EN" || saved === "PT_BR") return saved;
    }
    return "PT_BR";
  });

  // Escuta alterações de storage entre abas
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === GUEST_STORAGE_KEY && (e.newValue === "EN" || e.newValue === "PT_BR")) {
        setGuestLang(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Determina o idioma efetivo:
  // 1. Se logado, prioridade absoluta para a preferência da conta do usuário.
  // 2. Se visitante (não logado), usa o estado local/localStorage com padrão PT_BR.
  const language: CardLanguage = useMemo(() => {
    if (authUser && authUser.preferredCardLanguage) {
      return authUser.preferredCardLanguage === "EN" ? "EN" : "PT_BR";
    }
    return guestLang;
  }, [authUser, guestLang]);

  const isPt = language === "PT_BR";
  const isEn = language === "EN";

  const setLanguage = useCallback((nextLang: CardLanguage) => {
    setGuestLang(nextLang);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(GUEST_STORAGE_KEY, nextLang);
    }
  }, []);

  const boundCardText = useCallback(
    (card: CardTextInput | null | undefined, trigger?: string) => cardText(card, trigger, language),
    [language],
  );

  const boundGetKeyword = useCallback(
    (keywordOrTag: string) => getKeywordDefinition(keywordOrTag, language),
    [language],
  );

  const boundGetPhaseStep = useCallback(
    (stepOrPhase: string) => getPhaseStepLabel(stepOrPhase, language),
    [language],
  );

  return {
    language,
    isPt,
    isEn,
    setLanguage,
    cardText: boundCardText,
    getKeyword: boundGetKeyword,
    getPhaseStep: boundGetPhaseStep,
  };
}

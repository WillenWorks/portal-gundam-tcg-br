import { useEffect, useState } from "react";
import {
  getCardPlayabilityStatus,
  getSingleCardPlayability,
  type CardStatusEntry,
  type CardStatusResponse,
  type PlayabilityStatus,
  type SetStatusSummary,
  type OverallStatusSummary,
} from "@/lib/api";

// Cache em memória compartilhado em nível de módulo para evitar requisições redundantes
let memoryStatusResponse: CardStatusResponse | null = null;
let inFlightAllPromise: Promise<CardStatusResponse> | null = null;
const singleCardCache = new Map<string, CardStatusEntry>();
const inFlightSingleMap = new Map<string, Promise<CardStatusEntry>>();

/**
 * Carrega todos os status de cartas do simulador de forma otimizada (com deduplicação de requisição).
 */
export async function fetchAllPlayability(): Promise<CardStatusResponse> {
  if (memoryStatusResponse) {
    return memoryStatusResponse;
  }
  if (inFlightAllPromise) {
    return inFlightAllPromise;
  }

  inFlightAllPromise = getCardPlayabilityStatus()
    .then((res) => {
      memoryStatusResponse = res;
      if (res?.cards) {
        for (const [code, entry] of Object.entries(res.cards)) {
          singleCardCache.set(code.toUpperCase(), entry);
        }
      }
      return res;
    })
    .finally(() => {
      inFlightAllPromise = null;
    });

  return inFlightAllPromise;
}

/**
 * Consulta síncrona do cache em memória. Retorna null se ainda não foi carregado.
 */
export function getPlayabilitySync(code: string): CardStatusEntry | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (singleCardCache.has(normalized)) {
    return singleCardCache.get(normalized)!;
  }
  if (memoryStatusResponse?.cards?.[normalized]) {
    const entry = memoryStatusResponse.cards[normalized];
    singleCardCache.set(normalized, entry);
    return entry;
  }
  return null;
}

/**
 * Busca o status de uma carta específica de forma assíncrona, usando o cache se disponível.
 */
export async function fetchCardPlayability(code: string): Promise<CardStatusEntry> {
  const normalized = code.trim().toUpperCase();
  const cached = getPlayabilitySync(normalized);
  if (cached) return cached;

  if (inFlightSingleMap.has(normalized)) {
    return inFlightSingleMap.get(normalized)!;
  }

  const promise = getSingleCardPlayability(normalized)
    .then((entry) => {
      if (entry) {
        singleCardCache.set(normalized, entry);
      }
      return entry;
    })
    .finally(() => {
      inFlightSingleMap.delete(normalized);
    });

  inFlightSingleMap.set(normalized, promise);
  return promise;
}

/**
 * Hook para obter o status de jogabilidade de uma única carta.
 */
export function useCardPlayability(code?: string): {
  entry: CardStatusEntry | null;
  status: PlayabilityStatus;
  isLoading: boolean;
  motivo?: string;
  missingClauses?: string[];
} {
  const cleanCode = code?.trim().toUpperCase() || "";
  const initialEntry = cleanCode ? getPlayabilitySync(cleanCode) : null;

  const [entry, setEntry] = useState<CardStatusEntry | null>(initialEntry);
  const [isLoading, setIsLoading] = useState<boolean>(!initialEntry && Boolean(cleanCode));

  useEffect(() => {
    if (!cleanCode) {
      setEntry(null);
      setIsLoading(false);
      return;
    }

    const cached = getPlayabilitySync(cleanCode);
    if (cached) {
      setEntry(cached);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    fetchCardPlayability(cleanCode)
      .then((res) => {
        if (isMounted) {
          setEntry(res);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          // Fallback gracioso se a API falhar
          const fallbackEntry: CardStatusEntry = {
            code: cleanCode,
            status: "fora",
            motivo: "Não foi possível verificar a jogabilidade da carta no momento.",
            set: cleanCode.includes("-") ? cleanCode.split("-")[0] : "OUTROS",
          };
          setEntry(fallbackEntry);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [cleanCode]);

  const status: PlayabilityStatus = entry?.status ?? "fora";

  return {
    entry,
    status,
    isLoading,
    motivo: entry?.motivo,
    missingClauses: entry?.missingClauses,
  };
}

/**
 * Hook para obter o catálogo completo de status de jogabilidade e sumários por set.
 */
export function useAllCardsPlayability(): {
  cards: Record<string, CardStatusEntry>;
  sets: Record<string, SetStatusSummary>;
  summary: OverallStatusSummary | null;
  isLoading: boolean;
  isReady: boolean;
} {
  const [data, setData] = useState<CardStatusResponse | null>(memoryStatusResponse);
  const [isLoading, setIsLoading] = useState<boolean>(!memoryStatusResponse);

  useEffect(() => {
    if (memoryStatusResponse) {
      setData(memoryStatusResponse);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    fetchAllPlayability()
      .then((res) => {
        if (isMounted) {
          setData(res);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    cards: data?.cards ?? {},
    sets: data?.sets ?? {},
    summary: data?.summary ?? null,
    isLoading,
    isReady: Boolean(data),
  };
}

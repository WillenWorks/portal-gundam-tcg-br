import { useCallback, useEffect, useState } from "react";
import { api, type SimulatorDeckOption } from "@/lib/api";

/**
 * Decks salvos do usuário + veredito de cobertura do simulador (verde/vermelho
 * — docs/debates 2026-09-14). Compartilhado por todas as telas que deixam o
 * jogador escolher "meu próprio deck" (Fila Online, Convite Direto, Treino
 * Solo) pra não duplicar o fetch/estado em cada página.
 */
export function useMySimulatorDecks() {
  const [decks, setDecks] = useState<SimulatorDeckOption[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listMySimulatorDecks();
      setDecks(Array.isArray(list) ? list : []);
    } catch {
      setDecks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listMySimulatorDecks();
        if (!cancelled) setDecks(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setDecks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { decks, loading, refresh };
}

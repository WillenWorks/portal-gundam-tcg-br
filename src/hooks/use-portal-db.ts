import { useEffect, useState } from "react";

import {
  getDashboardMetrics,
  getDeck,
  listCards,
  listRules,
  listTournaments,
  loadPortalDb,
  subscribePortalDb,
  type PortalDbState,
} from "@/lib/portal-db";

export function usePortalDb() {
  const [state, setState] = useState<PortalDbState>(() => loadPortalDb());

  useEffect(() => {
    setState(loadPortalDb());
    return subscribePortalDb(() => setState(loadPortalDb()));
  }, []);

  return {
    state,
    cards: state.cards,
    rules: state.rules,
    tournaments: state.tournaments,
    deck: state.deck,
    metrics: getDashboardMetrics(),
    reload: () => setState(loadPortalDb()),
    readers: {
      listCards,
      listRules,
      listTournaments,
      getDeck,
    },
  };
}

/* Perfil visual (facção) — dimensão independente do dark/light. Mesmo padrão de
 * ThemeContext.tsx (classe no <html>, persistido em localStorage), mas essa aqui
 * troca a IDENTIDADE de cor (primary/accent), nao o brilho/contraste geral. As duas
 * classes coexistem: <html class="dark faction-zeon"> é um estado válido. */
import * as React from "react";

type Faction = "hangar" | "zeon";
const STORAGE_KEY = "portal-gundam-tcg-br:faction";

interface FactionContextType {
  faction: Faction;
  setFaction: (faction: Faction) => void;
}

const FactionContext = React.createContext<FactionContextType | undefined>(undefined);

export function FactionProvider({ children, defaultFaction = "hangar" }: { children: React.ReactNode; defaultFaction?: Faction }) {
  const [faction, setFactionState] = React.useState<Faction>(() => {
    if (typeof window === "undefined") return defaultFaction;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "hangar" || stored === "zeon" ? stored : defaultFaction;
  });

  React.useEffect(() => {
    document.documentElement.classList.remove("faction-hangar", "faction-zeon");
    document.documentElement.classList.add(`faction-${faction}`);
    window.localStorage.setItem(STORAGE_KEY, faction);
  }, [faction]);

  const setFaction = (next: Faction) => setFactionState(next);

  return <FactionContext.Provider value={{ faction, setFaction }}>{children}</FactionContext.Provider>;
}

export function useFaction() {
  const context = React.useContext(FactionContext);
  if (!context) throw new Error("useFaction must be used within FactionProvider");
  return context;
}

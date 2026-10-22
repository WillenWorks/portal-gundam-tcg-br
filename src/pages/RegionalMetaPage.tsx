/* Painel de Metagame Regional Geográfico (docs/54 §8.3, "Zero Local Intelligence") --
 * Drill-down País -> Estado -> Cidade -> Loja Parceira sobre a mesma fonte de "resultado
 * real" (TournamentEntry/HostedEventParticipant travado em DeckSnapshot) usada pelo
 * Sistema VEDA. */
import { useState } from "react";
import { VedaShell } from "@/components/veda/VedaShell";
import { RegionalMetaPanel } from "@/components/stats/RegionalMetaPanel";

function urlParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name)?.trim() ?? "";
}

export default function RegionalMetaPage() {
  const [selectedState] = useState<string>(() => urlParam("uf").toUpperCase());
  const [selectedCity] = useState<string>(() => urlParam("cidade"));
  const [selectedStore] = useState<string>(() => urlParam("loja"));

  return (
    <VedaShell
      title="Metagame Regional & Inteligência Geográfica"
      description="Compare a distribuição de cores, cartas mais jogadas e anomalias regionais por País, Estado (UF), Cidade e Loja Parceira a partir de resultados oficiais."
      breadcrumbs={[{ label: "Metagame Regional" }]}
    >
      <RegionalMetaPanel
        initialState={selectedState}
        initialCity={selectedCity}
        initialStore={selectedStore}
      />
    </VedaShell>
  );
}

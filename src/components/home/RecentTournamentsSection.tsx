import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Calendar, Clock, MapPin, Trophy, Swords, Medal, ExternalLink, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

type TournamentPodiumEntry = {
  placement: number;
  playerName: string;
  deckName: string;
  deckArchetype?: string;
  score: string;
  color?: string;
};

type TournamentDisplay = {
  id: string;
  name: string;
  date: string;
  time: string;
  venueName: string;
  location: string;
  format: string;
  totalPlayers: number;
  podium: TournamentPodiumEntry[];
};

const SAMPLE_TOURNAMENTS: TournamentDisplay[] = [
  {
    id: "sample-1",
    name: "Torneio Inaugural Anaheim HUB",
    date: "06 Set 2026",
    time: "14:00",
    venueName: "Epic Game Store Hangar",
    location: "São Paulo / SP",
    format: "Constructed Oficial (4 Rodadas)",
    totalPlayers: 24,
    podium: [
      {
        placement: 1,
        playerName: "AmuroRay_BR",
        deckName: "RX-78-2 Core Aggro",
        deckArchetype: "Federation White",
        score: "4-0-0 (12 pts)",
        color: "bg-blue-600/30 text-blue-300 border-blue-500/40",
      },
      {
        placement: 2,
        playerName: "Char_Aznable",
        deckName: "Zeon Red Pressure",
        deckArchetype: "Zeon Red",
        score: "3-1-0 (9 pts)",
        color: "bg-red-600/30 text-red-300 border-red-500/40",
      },
      {
        placement: 3,
        playerName: "Kira_Yamato",
        deckName: "Freedom Strike Control",
        deckArchetype: "SEED Blue",
        score: "3-1-0 (9 pts)",
        color: "bg-cyan-600/30 text-cyan-300 border-cyan-500/40",
      },
    ],
  },
  {
    id: "sample-2",
    name: "Clash de Starters & Pilotos SP",
    date: "30 Ago 2026",
    time: "15:30",
    venueName: "Taverna do Newtype",
    location: "Campinas / SP",
    format: "Starters ST01-ST04 Fechado",
    totalPlayers: 18,
    podium: [
      {
        placement: 1,
        playerName: "Suletta_Mercury",
        deckName: "Aerial Tech Burst",
        deckArchetype: "Witch Green",
        score: "4-0-0 (12 pts)",
        color: "bg-emerald-600/30 text-emerald-300 border-emerald-500/40",
      },
      {
        placement: 2,
        playerName: "Zechs_Marquise",
        deckName: "Tallgeese High Mobility",
        deckArchetype: "Zeon Red",
        score: "3-1-0 (9 pts)",
        color: "bg-red-600/30 text-red-300 border-red-500/40",
      },
      {
        placement: 3,
        playerName: "Setsuna_00",
        deckName: "Exia Burst Protocol",
        deckArchetype: "Federation White",
        score: "3-1-0 (9 pts)",
        color: "bg-blue-600/30 text-blue-300 border-blue-500/40",
      },
    ],
  },
  {
    id: "sample-3",
    name: "Regional Cup Gundam TCG Brasil",
    date: "23 Ago 2026",
    time: "13:00",
    venueName: "Arena Mecha Play",
    location: "Curitiba / PR",
    format: "Suíço 5 Rodadas + Top Cut",
    totalPlayers: 32,
    podium: [
      {
        placement: 1,
        playerName: "Heero_Yuy",
        deckName: "Wing Zero Burst Annihilation",
        deckArchetype: "Wing Red/Blue",
        score: "5-0-0 (15 pts)",
        color: "bg-red-600/30 text-red-300 border-red-500/40",
      },
      {
        placement: 2,
        playerName: "Athrun_Zala",
        deckName: "Justice Aegis Fortress",
        deckArchetype: "SEED Blue",
        score: "4-1-0 (12 pts)",
        color: "bg-cyan-600/30 text-cyan-300 border-cyan-500/40",
      },
      {
        placement: 3,
        playerName: "Bright_Noa",
        deckName: "White Base Vanguard Swarm",
        deckArchetype: "Federation White",
        score: "4-1-0 (12 pts)",
        color: "bg-blue-600/30 text-blue-300 border-blue-500/40",
      },
    ],
  },
];

export function RecentTournamentsSection() {
  const [tournaments, setTournaments] = useState<TournamentDisplay[]>(SAMPLE_TOURNAMENTS);

  useEffect(() => {
    // Tenta carregar do backend se existirem torneios cadastrados com entries
    api
      .listTournaments()
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted: TournamentDisplay[] = data.slice(0, 3).map((t) => {
            const dateObj = t.dateStart ? new Date(t.dateStart) : new Date();
            const dateStr = dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
            const timeStr = dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

            const entries = Array.isArray(t.entries) ? t.entries : [];
            const sortedEntries = [...entries].sort((a, b) => (a.placement || 99) - (b.placement || 99));

            const podium: TournamentPodiumEntry[] = sortedEntries.slice(0, 3).map((e, idx) => ({
              placement: e.placement || idx + 1,
              playerName: e.playerName || e.user?.displayName || "Piloto Convidado",
              deckName: e.deck?.name || e.archetype || "Deck Personalizado",
              deckArchetype: e.archetype || "Gundam TCG",
              score: `${e.wins ?? 0}-${e.losses ?? 0}-${e.draws ?? 0} (${((e.wins ?? 0) * 3) + (e.draws ?? 0)} pts)`,
            }));

            return {
              id: t.id,
              name: t.name,
              date: dateStr,
              time: timeStr,
              venueName: t.organizer || "Hangar Competitivo",
              location: `${t.city || "São Paulo"} / ${t.country || "Brasil"}`,
              format: t.format ? t.format.toUpperCase() : "CONSTRUCTED",
              totalPlayers: t.participantCount || entries.length || 16,
              podium: podium.length >= 3 ? podium : SAMPLE_TOURNAMENTS[0].podium,
            };
          });
          setTournaments(formatted);
        }
      })
      .catch(() => {
        // Fallback garantido para SAMPLE_TOURNAMENTS
      });
  }, []);

  const getPlacementBadge = (placement: number) => {
    if (placement === 1) {
      return (
        <span className="flex size-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/50 text-xs font-bold shadow-[0_0_12px_rgba(245,158,11,0.35)]">
          1º
        </span>
      );
    }
    if (placement === 2) {
      return (
        <span className="flex size-7 items-center justify-center rounded-full bg-slate-300/20 text-slate-300 border border-slate-300/50 text-xs font-bold">
          2º
        </span>
      );
    }
    return (
      <span className="flex size-7 items-center justify-center rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/50 text-xs font-bold">
        3º
      </span>
    );
  };

  return (
    <section id="ultimos-eventos" className="border-t border-white/10 bg-slate-950/70 py-12 sm:py-16">
      <div className="mx-auto max-w-[1760px] px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Cabeçalho da Seção */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="rounded-none border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.24em] text-amber-400">
                Competitivo
              </Badge>
              <span className="text-xs text-slate-400 font-mono">Metagame & Torneios</span>
            </div>
            <h2 className="heading-portal font-heading text-3xl sm:text-4xl uppercase mt-2 text-white">
              Últimos Eventos
            </h2>
            <p className="text-soft text-xs sm:text-sm mt-1 max-w-2xl">
              Confira os relatórios dos confrontos recentes pelo Brasil, pódios oficiais, decks campeões e pontuação dos pilotos.
            </p>
          </div>

          <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.14em] shrink-0">
            <Link href="/stats">
              Ver Metagame Completo <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </div>

        {/* Grid com os Torneios */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {tournaments.map((tournament) => (
            <Card
              key={tournament.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-amber-400/40 hover:shadow-[0_0_28px_rgba(245,158,11,0.18)]"
            >
              <CardContent className="p-5 sm:p-6 space-y-5">
                {/* Cabeçalho do Card */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="inline-flex items-center gap-1.5 rounded-xs border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase text-slate-300">
                      {tournament.format}
                    </span>
                    <span className="text-slate-400 text-[11px] font-mono">
                      {tournament.totalPlayers} pilotos
                    </span>
                  </div>

                  <h3 className="font-heading text-xl uppercase tracking-wide text-white group-hover:text-amber-300 transition-colors">
                    {tournament.name}
                  </h3>

                  {/* Informações de Local e Horário */}
                  <div className="mt-3 space-y-1.5 text-xs text-slate-300 border-y border-white/10 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-3.5 text-amber-400 shrink-0" />
                      <span className="font-mono text-[11px]">{tournament.date}</span>
                      <span className="text-slate-500">·</span>
                      <Clock className="size-3.5 text-amber-400 shrink-0 ml-1" />
                      <span className="font-mono text-[11px]">{tournament.time}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <MapPin className="size-3.5 text-amber-400 shrink-0" />
                      <span className="font-semibold text-slate-200">{tournament.venueName}</span>
                      <span className="text-slate-500">({tournament.location})</span>
                    </div>
                  </div>
                </div>

                {/* Bloco Top 3 */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-400 flex items-center gap-1.5">
                    <Trophy className="size-3.5" /> Pódio & Decks Usados
                  </p>

                  <div className="space-y-2">
                    {tournament.podium.map((pod) => (
                      <div
                        key={pod.placement}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-2.5 transition hover:bg-white/[0.05] hover:border-white/15"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {getPlacementBadge(pod.placement)}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-white">
                              {pod.playerName}
                            </p>
                            <p className="truncate text-[11px] text-slate-400">
                              {pod.deckName}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block rounded border border-white/15 bg-black/50 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                            {pod.score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>

              {/* Rodapé do Torneio */}
              <div className="border-t border-white/10 bg-slate-900/40 p-3.5 px-6 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 font-mono">
                  Súmula Homologada
                </span>
                <Link
                  href="/stats"
                  className="font-semibold uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 text-[11px]"
                >
                  Ver Metagame <ArrowRight className="size-3" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Calendar, Clock, MapPin, Trophy, Swords, Medal, ExternalLink, ArrowRight, ShieldAlert } from "lucide-react";
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
    <section id="ultimos-eventos" className="relative border-t border-red-950/50 bg-slate-950/80 py-12 sm:py-16 overflow-hidden">
      {/* Camada 1: Conteúdo Original dos Torneios (visível sob o filtro, mas desabilitado) */}
      <div className="mx-auto max-w-[1760px] px-4 sm:px-6 lg:px-8 space-y-6 select-none pointer-events-none opacity-30 grayscale-[50%] blur-[0.6px]">
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

      {/* Camada 2: Barreira de Contenção & Shading Holográfico */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {/* Shading escuro profundo e vinheta avermelhada */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/65 to-slate-950/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.1)_0%,rgba(15,23,42,0.7)_65%,rgba(11,15,25,0.95)_100%)]" />

        {/* Listras diagonais de isolamento tático / campo de força */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(239,68,68,0.06)_0px,rgba(239,68,68,0.06)_16px,transparent_16px,transparent_32px)]" />

        {/* Scanlines & Grid cibernético de contenção */}
        <div className="absolute inset-0 bg-scanlines opacity-30" />
        <div className="absolute inset-0 bg-grid-tech opacity-20" />

        {/* Feixes de laser de contenção no topo e base */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_15px_rgba(239,68,68,0.9)]" />
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_15px_rgba(239,68,68,0.9)]" />
      </div>

      {/* Camada 3: Painel Central de Alerta Vermelho "Bloqueado" */}
      <div className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6 pointer-events-auto">
        <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border-2 border-red-500/80 bg-slate-950/95 p-6 sm:p-8 text-center shadow-[0_0_80px_rgba(239,68,68,0.45),inset_0_0_30px_rgba(239,68,68,0.15)] backdrop-blur-2xl">
          {/* Feixe de luz de emergência vermelha no topo */}
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 size-44 rounded-full bg-red-600/30 blur-3xl" />

          {/* Marcadores táticos nos quatro cantos */}
          <div className="pointer-events-none absolute top-2.5 left-2.5 size-2.5 border-t-2 border-l-2 border-red-500/80" />
          <div className="pointer-events-none absolute top-2.5 right-2.5 size-2.5 border-t-2 border-r-2 border-red-500/80" />
          <div className="pointer-events-none absolute bottom-2.5 left-2.5 size-2.5 border-b-2 border-l-2 border-red-500/80" />
          <div className="pointer-events-none absolute bottom-2.5 right-2.5 size-2.5 border-b-2 border-r-2 border-red-500/80" />

          <div className="relative z-10 flex flex-col items-center">
            {/* Badge com indicador pulsante de restrição */}
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-3.5 py-1 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-red-400 shadow-[0_0_16px_rgba(239,68,68,0.25)]">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-red-500" />
              </span>
              <ShieldAlert className="size-3.5 text-red-400" />
              Acesso Restrito · Anaheim Hub
            </div>

            {/* Título "BLOQUEADO" em destaque vermelho vibrante */}
            <h3 className="mt-3 font-heading text-4xl sm:text-5xl uppercase tracking-wider text-red-500 drop-shadow-[0_0_24px_rgba(239,68,68,0.7)]">
              Bloqueado
            </h3>

            {/* Linha divisória tática */}
            <div className="my-3 flex w-36 items-center gap-1.5">
              <div className="h-[1px] flex-1 bg-red-500/40" />
              <div className="size-1.5 rotate-45 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <div className="h-[1px] flex-1 bg-red-500/40" />
            </div>

            {/* Texto explicativo */}
            <p className="text-xs sm:text-sm leading-relaxed text-slate-300 max-w-md">
              Área de torneios e súmulas em calibração operacional. O registro e ranking oficial de eventos presenciais e nacionais do Gundam TCG será liberado em breve.
            </p>

            {/* Tags técnicas de status */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-red-500/20 text-[10px] font-mono uppercase tracking-wider text-red-400/90">
              <span className="px-2.5 py-1 rounded-xs border border-red-500/30 bg-red-950/50">
                Status: Indisponível
              </span>
              <span className="px-2.5 py-1 rounded-xs border border-red-500/30 bg-red-950/50">
                Temporada 2026
              </span>
              <span className="px-2.5 py-1 rounded-xs border border-red-500/30 bg-red-950/50">
                Homologação Pendente
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

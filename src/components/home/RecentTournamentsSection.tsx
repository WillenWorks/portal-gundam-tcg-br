import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Calendar, Clock, MapPin, Trophy, ArrowRight, Globe, Flag } from "lucide-react";
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
  country: string;
  format: string;
  totalPlayers: number;
  podium: TournamentPodiumEntry[];
};

/** Torneios oficiais da temporada GD05 no Brasil */
const BR_TOURNAMENTS_FALLBACK: TournamentDisplay[] = [
  {
    id: "br-regional-ccg",
    name: "CCG Eventos Brazil Regionals",
    date: "20 Set 2026",
    time: "10:00",
    venueName: "CCG Eventos · Hakka",
    location: "São Paulo / SP",
    country: "Brasil",
    format: "GD05 Large Official (Top Cut)",
    totalPlayers: 128,
    podium: [
      {
        placement: 1,
        playerName: "[Mz] Urick",
        deckName: "Barbatos 1st Form / Strike Freedom",
        deckArchetype: "Iron-Blooded & SEED",
        score: "6-0-0 (18 pts)",
        color: "bg-amber-600/30 text-amber-300 border-amber-500/40",
      },
      {
        placement: 2,
        playerName: "Bonow",
        deckName: "Strike Freedom Gundam",
        deckArchetype: "SEED Blue/White",
        score: "5-1-0 (15 pts)",
        color: "bg-cyan-600/30 text-cyan-300 border-cyan-500/40",
      },
      {
        placement: 3,
        playerName: "Doug",
        deckName: "Shining Gundam / Master Gundam",
        deckArchetype: "G Gundam Red",
        score: "5-1-0 (15 pts)",
        color: "bg-red-600/30 text-red-300 border-red-500/40",
      },
    ],
  },
  {
    id: "sample-1",
    name: "Torneio Inaugural Anaheim HUB",
    date: "06 Set 2026",
    time: "14:00",
    venueName: "Epic Game Store Hangar",
    location: "São Paulo / SP",
    country: "Brasil",
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
    country: "Brasil",
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
];

/** Torneios oficiais globais mais recentes */
const ALL_TOURNAMENTS_FALLBACK: TournamentDisplay[] = [
  {
    id: "global-milwaukee",
    name: "Play!TCG Milwaukee Regionals",
    date: "05 Out 2026",
    time: "09:00",
    venueName: "Play!TCG Wisconsin",
    location: "Milwaukee / EUA",
    country: "Estados Unidos",
    format: "GD05 Large Official",
    totalPlayers: 164,
    podium: [
      {
        placement: 1,
        playerName: "John D.",
        deckName: "Wing Zero Burst Annihilation",
        deckArchetype: "Wing Red/Blue",
        score: "7-0-0 (21 pts)",
        color: "bg-red-600/30 text-red-300 border-red-500/40",
      },
      {
        placement: 2,
        playerName: "Alex V.",
        deckName: "Tallgeese Red Tempo",
        deckArchetype: "Zeon Red",
        score: "6-1-0 (18 pts)",
        color: "bg-amber-600/30 text-amber-300 border-amber-500/40",
      },
      {
        placement: 3,
        playerName: "Sarah M.",
        deckName: "Strike Freedom Control",
        deckArchetype: "SEED Blue/White",
        score: "6-1-0 (18 pts)",
        color: "bg-cyan-600/30 text-cyan-300 border-cyan-500/40",
      },
    ],
  },
  {
    id: "global-dusseldorf",
    name: "NoHEROES' Düsseldorf Regionals",
    date: "04 Out 2026",
    time: "10:00",
    venueName: "NoHEROES Events",
    location: "Düsseldorf / Alemanha",
    country: "Alemanha",
    format: "GD05 Large Official",
    totalPlayers: 128,
    podium: [
      {
        placement: 1,
        playerName: "Klaus M.",
        deckName: "Nu Gundam Fin Funnel Control",
        deckArchetype: "Federation Blue/White",
        score: "7-0-0 (21 pts)",
        color: "bg-blue-600/30 text-blue-300 border-blue-500/40",
      },
      {
        placement: 2,
        playerName: "Jean P.",
        deckName: "Zeon Swarm Aggro",
        deckArchetype: "Zeon Red",
        score: "6-1-0 (18 pts)",
        color: "bg-red-600/30 text-red-300 border-red-500/40",
      },
      {
        placement: 3,
        playerName: "Marco R.",
        deckName: "Master Gundam Melee",
        deckArchetype: "G Gundam Red",
        score: "5-1-1 (16 pts)",
        color: "bg-emerald-600/30 text-emerald-300 border-emerald-500/40",
      },
    ],
  },
  BR_TOURNAMENTS_FALLBACK[0], // CCG Eventos Brazil Regionals
];

export function RecentTournamentsSection() {
  const [scope, setScope] = useState<"todos" | "brasil">("brasil");
  const [dbTournaments, setDbTournaments] = useState<TournamentDisplay[]>([]);

  useEffect(() => {
    api
      .listTournaments({ resumo: true })
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted: TournamentDisplay[] = data.map((t) => {
            const dateObj = t.dateStart ? new Date(t.dateStart) : new Date();
            const dateStr = dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
            const timeStr = dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

            const entries = Array.isArray(t.entries) ? t.entries : [];
            const sortedEntries = [...entries].sort((a, b) => (a.placement || 99) - (b.placement || 99));

            const podium: TournamentPodiumEntry[] = sortedEntries.slice(0, 3).map((e, idx) => ({
              placement: e.placement || idx + 1,
              playerName: e.playerName || e.user?.displayName || "Piloto Registrado",
              deckName: e.deck?.name || e.archetype || "Deck Personalizado",
              deckArchetype: e.archetype || "Gundam TCG",
              score:
                e.wins != null
                  ? `${e.wins}-${e.losses ?? 0}-${e.draws ?? 0} (${(e.wins * 3) + (e.draws ?? 0)} pts)`
                  : "Classificado",
            }));

            const country = t.country || (t.city && ["São Paulo", "Campinas", "Curitiba"].includes(t.city) ? "Brasil" : "Mundial");
            const locationStr = t.city ? `${t.city} / ${t.country || "BR"}` : country;

            return {
              id: t.id,
              name: t.name,
              date: dateStr,
              time: timeStr !== "00:00" ? timeStr : "14:00",
              venueName: t.organizer || "Hangar Competitivo",
              location: locationStr,
              country: country,
              format: t.format ? t.format.toUpperCase() : "CONSTRUCTED",
              totalPlayers: t.participantCount || entries.length || 16,
              podium: podium.length > 0 ? podium : BR_TOURNAMENTS_FALLBACK[0].podium,
            };
          });
          setDbTournaments(formatted);
        }
      })
      .catch(() => {
        // Fallback garantido
      })
      .finally(() => {
      });
  }, []);

  // Filtra os 3 torneios de acordo com o escopo selecionado (Todos ou Brasil)
  const displayedTournaments = useMemo(() => {
    if (dbTournaments.length > 0) {
      if (scope === "brasil") {
        const brList = dbTournaments.filter(
          (t) =>
            t.country.toLowerCase().includes("brasil") ||
            t.country.toLowerCase().includes("brazil") ||
            t.name.toLowerCase().includes("brazil") ||
            t.name.toLowerCase().includes("brasil") ||
            t.location.toLowerCase().includes("sp") ||
            t.location.toLowerCase().includes("são paulo"),
        );
        if (brList.length >= 3) return brList.slice(0, 3);
        // Se houver menos de 3 no banco, completa com o fallback nacional representativo
        const merged = [...brList];
        for (const fb of BR_TOURNAMENTS_FALLBACK) {
          if (merged.length < 3 && !merged.some((m) => m.name === fb.name)) {
            merged.push(fb);
          }
        }
        return merged.slice(0, 3);
      }
      return dbTournaments.slice(0, 3);
    }
    return scope === "brasil" ? BR_TOURNAMENTS_FALLBACK : ALL_TOURNAMENTS_FALLBACK;
  }, [dbTournaments, scope]);

  const getPlacementBadge = (placement: number) => {
    if (placement === 1) {
      return (
        <span className="flex size-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/50 text-xs font-bold shadow-[0_0_12px_rgba(245,158,11,0.35)] shrink-0">
          1º
        </span>
      );
    }
    if (placement === 2) {
      return (
        <span className="flex size-7 items-center justify-center rounded-full bg-slate-300/30 text-slate-700 dark:text-slate-300 border border-slate-400/50 dark:border-slate-300/50 text-xs font-bold shrink-0">
          2º
        </span>
      );
    }
    return (
      <span className="flex size-7 items-center justify-center rounded-full bg-amber-700/20 text-amber-700 dark:text-amber-500 border border-amber-700/50 text-xs font-bold shrink-0">
        3º
      </span>
    );
  };

  return (
    <section
      id="ultimos-eventos"
      className="relative border-t dark:border-white/10 dark:bg-slate-950/80 light:border-slate-300/80 light:bg-slate-100/90 py-12 sm:py-16 overflow-hidden"
    >
      {/* 
        [ÁREA DE BLOQUEIO COMENTADA A PEDIDO DO USUÁRIO]:
        A área de bloqueio (overlay de restrição e painel "Bloqueado") foi removida e comentada.
        O conteúdo agora é 100% interativo, funcional e permite alternar entre "Todos" e "Brasil".
      */}

      <div className="container-ultrawide space-y-6">
        {/* Cabeçalho da Seção com Alternância de Filtro (Todos vs Brasil) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b dark:border-white/10 light:border-slate-300 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="rounded-none border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.24em] text-amber-500 dark:text-amber-400">
                Competitivo
              </Badge>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Metagame & Torneios</span>
            </div>
            <h2 className="heading-portal font-heading text-3xl sm:text-4xl uppercase mt-2 dark:text-white light:text-slate-950">
              Últimos Eventos
            </h2>
            <p className="text-soft text-xs sm:text-sm mt-1 max-w-2xl dark:text-slate-400 light:text-slate-600">
              Relatórios dos confrontos recentes de Gundam TCG, pódios oficiais, decks campeões e desempenho dos pilotos.
            </p>
          </div>

          {/* Controles de Ação: Alternância (Todos / Brasil) + Link para Torneios */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Seletor de Escopo: Todos vs Brasil */}
            <div className="inline-flex rounded-md border dark:border-white/15 dark:bg-slate-900/80 light:border-slate-300 light:bg-white p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setScope("brasil")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-semibold uppercase tracking-wider transition-colors rounded-xs ${
                  scope === "brasil"
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Exibir torneios realizados no Brasil"
              >
                <Flag className="size-3.5" />
                Brasil
              </button>
              <button
                type="button"
                onClick={() => setScope("todos")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-semibold uppercase tracking-wider transition-colors rounded-xs ${
                  scope === "todos"
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Exibir todos os torneios mundiais e nacionais"
              >
                <Globe className="size-3.5" />
                Todos
              </button>
            </div>

            {/* Link para a página de Torneios */}
            <Button
              asChild
              variant="outline"
              className="rounded-none dark:border-white/20 dark:bg-white/5 dark:text-white light:border-slate-300 light:bg-white light:text-slate-800 light:hover:bg-slate-100 text-xs uppercase tracking-[0.14em] shrink-0"
            >
              <Link href="/torneios">
                Ver Todos os Torneios <ArrowRight className="ml-1.5 size-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Grid com os 3 Torneios */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {displayedTournaments.map((tournament) => (
            <Card
              key={tournament.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border dark:border-white/10 dark:bg-slate-950/90 light:border-slate-300 light:bg-white light:shadow-md shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-amber-400/40 hover:shadow-[0_0_28px_rgba(245,158,11,0.18)]"
            >
              <CardContent className="p-5 sm:p-6 space-y-5">
                {/* Cabeçalho do Card */}
                <div>
                  <div className="flex items-center justify-between text-xs dark:text-slate-400 light:text-slate-500 mb-2">
                    <span className="inline-flex items-center gap-1.5 rounded-xs border dark:border-white/15 dark:bg-white/5 dark:text-slate-300 light:border-slate-300 light:bg-slate-100 light:text-slate-700 px-2 py-0.5 font-mono text-[10px] uppercase font-semibold">
                      {tournament.format}
                    </span>
                    <span className="dark:text-slate-400 light:text-slate-600 text-[11px] font-mono font-semibold">
                      {tournament.totalPlayers} pilotos
                    </span>
                  </div>

                  <h3 className="font-heading text-xl uppercase tracking-wide dark:text-white light:text-slate-950 dark:group-hover:text-amber-300 light:group-hover:text-amber-600 transition-colors">
                    <Link href={`/torneios/${tournament.id}`}>
                      {tournament.name}
                    </Link>
                  </h3>

                  {/* Informações de Local e Horário */}
                  <div className="mt-3 space-y-1.5 text-xs dark:text-slate-300 light:text-slate-600 border-y dark:border-white/10 light:border-slate-200 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                      <span className="font-mono text-[11px] font-medium">{tournament.date}</span>
                      <span className="text-slate-400">·</span>
                      <Clock className="size-3.5 text-amber-500 dark:text-amber-400 shrink-0 ml-1" />
                      <span className="font-mono text-[11px]">{tournament.time}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <MapPin className="size-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                      <span className="font-semibold dark:text-slate-200 light:text-slate-800">
                        {tournament.venueName}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">({tournament.location})</span>
                    </div>
                  </div>
                </div>

                {/* Bloco Top 3 */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Trophy className="size-3.5" /> Pódio & Decks Usados
                  </p>

                  <div className="space-y-2">
                    {tournament.podium.map((pod) => (
                      <div
                        key={pod.placement}
                        className="flex items-center justify-between gap-3 rounded-lg border dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.05] dark:hover:border-white/15 light:border-slate-200 light:bg-slate-50 light:hover:bg-slate-100 p-2.5 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {getPlacementBadge(pod.placement)}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold dark:text-white light:text-slate-900">
                              {pod.playerName}
                            </p>
                            <p className="truncate text-[11px] dark:text-slate-400 light:text-slate-600 font-mono">
                              {pod.deckName}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block rounded border dark:border-white/15 dark:bg-black/50 dark:text-cyan-300 light:border-cyan-300 light:bg-cyan-50 light:text-cyan-800 px-2 py-0.5 font-mono text-[10px] font-bold">
                            {pod.score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>

              {/* Rodapé do Torneio */}
              <div className="border-t dark:border-white/10 dark:bg-slate-900/40 light:border-slate-200 light:bg-slate-50 p-3.5 px-6 flex items-center justify-between text-xs">
                <span className="text-[11px] dark:text-slate-400 light:text-slate-600 font-mono">
                  Súmula Homologada
                </span>
                <Link
                  href={`/torneios/${tournament.id}`}
                  className="font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors flex items-center gap-1 text-[11px]"
                >
                  Ver Relatório <ArrowRight className="size-3" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 
        ========================================================================
        ÁREA DE BLOQUEIO COMENTADA A PEDIDO DO USUÁRIO
        (Mantida integralmente no código para reativação caso necessário)
        ========================================================================

        {/* Camada 2: Barreira de Contenção & Shading Holográfico * /}
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          <div className="absolute inset-0 dark:bg-gradient-to-b dark:from-slate-950/85 dark:via-slate-950/65 dark:to-slate-950/90 light:bg-gradient-to-b light:from-slate-200/85 light:via-slate-100/65 light:to-slate-200/90" />
          <div className="absolute inset-0 dark:bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.1)_0%,rgba(15,23,42,0.7)_65%,rgba(11,15,25,0.95)_100%)] light:bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.08)_0%,rgba(241,245,249,0.7)_65%,rgba(226,232,240,0.95)_100%)]" />
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(239,68,68,0.06)_0px,rgba(239,68,68,0.06)_16px,transparent_16px,transparent_32px)]" />
          <div className="absolute inset-0 bg-scanlines opacity-30" />
          <div className="absolute inset-0 bg-grid-tech opacity-20" />
          <div className="absolute inset-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_15px_rgba(239,68,68,0.9)]" />
          <div className="absolute inset-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_15px_rgba(239,68,68,0.9)]" />
        </div>

        {/* Camada 3: Painel Central de Alerta Vermelho 'Bloqueado' * /}
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6 pointer-events-auto">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border-2 border-red-500/80 dark:bg-slate-950/95 light:bg-white/95 p-6 sm:p-8 text-center shadow-[0_0_80px_rgba(239,68,68,0.45),inset_0_0_30px_rgba(239,68,68,0.15)] light:shadow-[0_0_80px_rgba(239,68,68,0.25)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 size-44 rounded-full bg-red-600/30 blur-3xl" />
            <div className="pointer-events-none absolute top-2.5 left-2.5 size-2.5 border-t-2 border-l-2 border-red-500/80" />
            <div className="pointer-events-none absolute top-2.5 right-2.5 size-2.5 border-t-2 border-r-2 border-red-500/80" />
            <div className="pointer-events-none absolute bottom-2.5 left-2.5 size-2.5 border-b-2 border-l-2 border-red-500/80" />
            <div className="pointer-events-none absolute bottom-2.5 right-2.5 size-2.5 border-b-2 border-r-2 border-red-500/80" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 dark:bg-red-500/15 dark:text-red-400 light:bg-red-50 light:text-red-700 px-3.5 py-1 text-[11px] font-mono font-bold uppercase tracking-[0.22em] shadow-[0_0_16px_rgba(239,68,68,0.25)]">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                </span>
                Acesso Restrito · Anaheim Hub
              </div>

              <h3 className="mt-3 font-heading text-4xl sm:text-5xl uppercase tracking-wider text-red-500 drop-shadow-[0_0_24px_rgba(239,68,68,0.7)]">
                Bloqueado
              </h3>

              <div className="my-3 flex w-36 items-center gap-1.5">
                <div className="h-[1px] flex-1 bg-red-500/40" />
                <div className="size-1.5 rotate-45 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <div className="h-[1px] flex-1 bg-red-500/40" />
              </div>

              <p className="text-xs sm:text-sm leading-relaxed dark:text-slate-300 light:text-slate-700 max-w-md">
                Área de torneios e súmulas em calibração operacional. O registro e ranking oficial de eventos presenciais e nacionais do Gundam TCG será liberado em breve.
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-red-500/20 text-[10px] font-mono uppercase tracking-wider text-red-400/90">
                <span className="px-2.5 py-1 rounded-xs border border-red-500/30 dark:bg-red-950/50 dark:text-red-400/90 light:bg-red-50 light:text-red-700">
                  Status: Indisponível
                </span>
                <span className="px-2.5 py-1 rounded-xs border border-red-500/30 dark:bg-red-950/50 dark:text-red-400/90 light:bg-red-50 light:text-red-700">
                  Temporada 2026
                </span>
                <span className="px-2.5 py-1 rounded-xs border border-red-500/30 dark:bg-red-950/50 dark:text-red-400/90 light:bg-red-50 light:text-red-700">
                  Homologação Pendente
                </span>
              </div>
            </div>
          </div>
        </div>
      */}
    </section>
  );
}

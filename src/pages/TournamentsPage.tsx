import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Wrench } from "lucide-react";

import { PublicShell } from "@/components/layout/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { GAME_COLOR_HEX, GAME_COLOR_LABEL_PT, COLOR_OPTIONS, TOURNAMENT_TAB_OPTIONS, TOURNAMENT_TIER_OPTIONS } from "@/lib/gundam-catalog";
import { loadDeckbuilderDraft } from "@/lib/deckbuilder-draft";
import { normalizeTournament, normalizeHostedEvent, type NormalizedEvent } from "@/lib/tournament-normalize";
import { TournamentDetailDialog } from "@/components/tournaments/TournamentDetailDialog";

const FORMAT_LABELS: Record<string, string> = { constructed: "Constructed", team_battle: "Team Battle", battle_royale: "Battle Royale" };
const tierLabel = (value: string) => TOURNAMENT_TIER_OPTIONS.find((opt) => opt.value === value)?.label || value;

/** Agrupa os participantes por arquétipo declarado — só o que dá pra calcular
 *  com dado real cadastrado, sem inventar métrica que não existe (ver reportado
 *  na Prioridade 4: a página antes usava topCutConversion/stapleCards fake). */
function archetypeBreakdown(entries: any[]) {
  const withArchetype = entries.filter((entry) => entry.archetype);
  if (!withArchetype.length) return [];
  const counts = new Map<string, { count: number; bestPlacement: number | null }>();
  for (const entry of withArchetype) {
    const current = counts.get(entry.archetype) || { count: 0, bestPlacement: null };
    current.count += 1;
    if (entry.placement != null && (current.bestPlacement == null || entry.placement < current.bestPlacement)) current.bestPlacement = entry.placement;
    counts.set(entry.archetype, current);
  }
  return Array.from(counts.entries())
    .map(([archetype, data]) => ({ archetype, share: Math.round((data.count / withArchetype.length) * 100), count: data.count, bestPlacement: data.bestPlacement }))
    .sort((a, b) => b.count - a.count);
}

/** Um evento nesta tela vem de duas fontes bem diferentes: Tournament (report
 *  retroativo cadastrado pelo admin, com arquétipo declarado por jogador) e
 *  HostedEvent (evento "ao vivo" rodado por um Hoster via /organizador, com
 *  rodadas/confrontos reais e classificação calculada — sem arquétipo). Antes
 *  desta correção só o primeiro aparecia aqui; um evento do Hoster já finalizado
 *  (bye lançado, status Realizado) ficava invisível pra qualquer visitante. As
 *  duas fontes viram um "EventCard" comum só pra ordenar e listar juntas — o
 *  corpo de cada card continua tratando o formato original de cada uma.
 */
type EventCard =
  | { kind: "report"; id: string; dateStart: string | null; tournament: any }
  | { kind: "sistema"; id: string; dateStart: string | null; event: any };

// Lê/escreve ?tab=&q=&colors= na URL real (mesmo idioma de CardsPage.tsx) -- permite
// compartilhar link direto pra uma aba/filtro específico (critério de aceitação §6.1).
function readFiltersFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return {
    tab: params.get("tab") || "tournaments",
    q: params.get("q") || "",
    colors: (params.get("colors") || "").split(",").filter(Boolean),
  };
}
function buildQuery(basePath: string, tab: string, q: string, colors: string[]) {
  const params = new URLSearchParams();
  if (tab !== "tournaments") params.set("tab", tab);
  if (q) params.set("q", q);
  if (colors.length) params.set("colors", colors.join(","));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export default function TournamentsPage() {
  const [location, navigate] = useLocation();
  const basePath = useMemo(() => location.split("?")[0], [location]);
  const initial = useMemo(() => readFiltersFromLocation(), []);

  const [tournaments, setTournaments] = useState<any[]>([]);
  const [hostedEvents, setHostedEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tab, setTab] = useState(initial.tab);
  const [query, setQuery] = useState(initial.q);
  const [selectedColors, setSelectedColors] = useState<string[]>(initial.colors);
  const [detailEvent, setDetailEvent] = useState<NormalizedEvent | null>(null);

  useEffect(() => {
    Promise.all([api.listTournaments(), api.listCompletedHostedEvents()])
      .then(([t, h]) => { setTournaments(t); setHostedEvents(h); })
      .catch((err: any) => setError(err.message || "Falha ao carregar eventos."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    navigate(buildQuery(basePath, tab, query, selectedColors), { replace: true });
  }, [basePath, tab, query, selectedColors, navigate]);

  const eventCards = useMemo<EventCard[]>(() => {
    const reportCards: EventCard[] = tournaments.map((tournament) => ({ kind: "report", id: tournament.id, dateStart: tournament.dateStart, tournament }));
    const sistemaCards: EventCard[] = hostedEvents.map((event) => ({ kind: "sistema", id: event.id, dateStart: event.dateStart, event }));
    return [...reportCards, ...sistemaCards].sort((a, b) => {
      const da = a.dateStart ? new Date(a.dateStart).getTime() : 0;
      const db = b.dateStart ? new Date(b.dateStart).getTime() : 0;
      return db - da;
    });
  }, [tournaments, hostedEvents]);

  // Formato comum (Fase 1) pra alimentar abas/busca/chips/visão detalhada -- ver
  // src/lib/tournament-normalize.ts pra por que Tournament e HostedEvent precisam
  // disso em vez de ler os dois formatos originais direto na tela.
  const normalizedEvents = useMemo<NormalizedEvent[]>(() => {
    const fromReports = tournaments.map(normalizeTournament);
    const fromHosted = hostedEvents.map(normalizeHostedEvent);
    return [...fromReports, ...fromHosted].sort((a, b) => {
      const da = a.dateStart ? new Date(a.dateStart).getTime() : 0;
      const db = b.dateStart ? new Date(b.dateStart).getTime() : 0;
      return db - da;
    });
  }, [tournaments, hostedEvents]);

  const activeTierTab = TOURNAMENT_TAB_OPTIONS.find((opt) => opt.value === tab && "tier" in opt) as (typeof TOURNAMENT_TAB_OPTIONS)[number] & { tier?: string } | undefined;
  const activeTier = activeTierTab?.tier;
  const isCardGridView = tab === "tournaments";
  const q = query.trim().toLowerCase();

  const eventMatchesColors = (event: NormalizedEvent) =>
    !selectedColors.length || event.participants.some((p) => selectedColors.every((c) => p.colors.includes(c)));
  const eventMatchesQuery = (event: NormalizedEvent) =>
    !q ||
    event.name.toLowerCase().includes(q) ||
    (event.organizerLabel || "").toLowerCase().includes(q) ||
    event.participants.some((p) => p.playerName.toLowerCase().includes(q) || (p.archetype || "").toLowerCase().includes(q));

  const visibleEventIds = useMemo(() => {
    const filtered = normalizedEvents.filter((e) => eventMatchesQuery(e) && eventMatchesColors(e));
    return new Set(filtered.map((e) => `${e.kind}-${e.id}`));
  }, [normalizedEvents, q, selectedColors]);

  const visibleEventCards = useMemo(
    () => eventCards.filter((card) => visibleEventIds.has(`${card.kind}-${card.id}`)),
    [eventCards, visibleEventIds],
  );

  // Abas de classificação tática (large_official/small_official/unofficial/ranked/team)
  // e "all" exibem uma tabela consolidada de decklists em vez da grade de cards --
  // mesmo critério do ecossistema de referência (ver §2.1 do plano).
  type FlatRow = { event: NormalizedEvent; participant: NormalizedEvent["participants"][number] };
  const flatRows = useMemo<FlatRow[]>(() => {
    if (isCardGridView) return [];
    const scoped = activeTier ? normalizedEvents.filter((e) => e.tier === activeTier) : normalizedEvents;
    const rows: FlatRow[] = [];
    for (const event of scoped) {
      for (const participant of event.participants) {
        if (q && !(event.name.toLowerCase().includes(q) || participant.playerName.toLowerCase().includes(q) || (participant.archetype || "").toLowerCase().includes(q))) continue;
        if (selectedColors.length && !selectedColors.every((c) => participant.colors.includes(c))) continue;
        rows.push({ event, participant });
      }
    }
    return rows;
  }, [isCardGridView, activeTier, normalizedEvents, q, selectedColors]);

  const toggleColor = (color: string) => setSelectedColors((prev) => (prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]));

  const openDetail = (kind: "report" | "sistema", id: string) => {
    const found = normalizedEvents.find((e) => e.kind === kind && e.id === id);
    if (found) setDetailEvent(found);
  };

  // Panorama combinado de todos os eventos ativos (report + sistema) -- meta geral e
  // composição registrado/convidado. Não calcula taxa de vitória real na visão geral
  // (deferido de propósito, ver docs/16-roadmap-ideias-mapeadas.md): só o que dá pra
  // tirar de dado cadastrado sem inventar métrica (mesmo critério do archetypeBreakdown
  // por evento, acima). Participante de HostedEvent sempre tem conta (é obrigatório),
  // por isso entra 100% em "Com conta no site"; "Com deck vinculado" usa hasDeck (deck
  // travado pelo Hoster) no lugar do TournamentEntry.deck.
  const allEntries = useMemo(() => tournaments.flatMap((tournament) => tournament.entries || []), [tournaments]);
  const overallBreakdown = useMemo(() => archetypeBreakdown(allEntries), [allEntries]);
  const allStandings = useMemo(() => hostedEvents.flatMap((event) => event.standings || []), [hostedEvents]);
  const totalParticipations = allEntries.length + allStandings.length;
  const registeredCount = allEntries.filter((entry) => entry.user).length + allStandings.length;
  const deckLinkedCount = allEntries.filter((entry) => entry.deck).length + allStandings.filter((row: any) => row.hasDeck).length;

  return (
    <PublicShell
      breadcrumbs={[{ label: "Eventos" }]}
      title="Eventos"
      description="Calendário competitivo e resultados de torneios cadastrados pela comunidade."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">Calendário e histórico</Badge>
        </div>

        {/* Barra tática: abas de classificação, busca e chips de cor -- ?tab=/?q=/?colors=
         *  ficam sincronizados na URL (ver readFiltersFromLocation/buildQuery acima). */}
        <Card className="panel-cut rounded-none surface-panel">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              {TOURNAMENT_TAB_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTab(opt.value)}
                  className={`panel-cut border px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition-colors ${tab === opt.value ? "border-primary/60 bg-primary/10 text-primary" : "border-white/15 text-slate-400 hover:border-white/30 hover:text-slate-200"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar piloto, arquétipo ou evento..."
                className="h-9 max-w-xs rounded-none border-white/15 bg-slate-950/70 text-sm"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-500">Cores</span>
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => toggleColor(color)}
                    title={GAME_COLOR_LABEL_PT[color]}
                    className={`size-6 rounded-full border-2 transition-transform ${selectedColors.includes(color) ? "scale-110 border-white" : "border-white/20 hover:border-white/50"}`}
                    style={{ backgroundColor: GAME_COLOR_HEX[color] }}
                  />
                ))}
                {selectedColors.length ? <button type="button" onClick={() => setSelectedColors([])} className="text-xs uppercase tracking-[0.14em] text-primary hover:underline">Limpar cores</button> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? <p className="text-sm text-slate-400">Carregando eventos...</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {!loading && !error && isCardGridView && !eventCards.length ? <p className="text-sm text-slate-400">Nenhum evento cadastrado ainda.</p> : null}

        {!loading && !error && eventCards.length ? (
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Panorama geral</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="panel-cut border surface-strong p-4 light:border-slate-300/80 light:bg-slate-50">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Eventos</p>
                  <p className="mt-2 font-heading text-3xl leading-none dark:text-white light:text-slate-900">{eventCards.length}</p>
                </div>
                <div className="panel-cut border surface-strong p-4 light:border-slate-300/80 light:bg-slate-50">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Participações registradas</p>
                  <p className="mt-2 font-heading text-3xl leading-none dark:text-white light:text-slate-900">{totalParticipations}</p>
                </div>
                <div className="panel-cut border surface-strong p-4 light:border-slate-300/80 light:bg-slate-50">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Com conta no site</p>
                  <p className="mt-2 font-heading text-3xl leading-none dark:text-white light:text-slate-900">{registeredCount}{totalParticipations ? <span className="ml-2 text-sm text-slate-500">({Math.round((registeredCount / totalParticipations) * 100)}%)</span> : null}</p>
                </div>
                <div className="panel-cut border surface-strong p-4 light:border-slate-300/80 light:bg-slate-50">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Com deck vinculado</p>
                  <p className="mt-2 font-heading text-3xl leading-none dark:text-white light:text-slate-900">{deckLinkedCount}{totalParticipations ? <span className="ml-2 text-sm text-slate-500">({Math.round((deckLinkedCount / totalParticipations) * 100)}%)</span> : null}</p>
                </div>
              </div>

              {overallBreakdown.length ? (
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Meta geral · arquétipos declarados nos eventos com report</p>
                  <div className="mt-3 grid gap-4 2xl:grid-cols-3">
                    {overallBreakdown.slice(0, 6).map((item) => (
                      <div key={item.archetype} className="panel-cut border surface-strong p-4 light:border-slate-300/80 light:bg-slate-50">
                        <p className="font-heading text-2xl uppercase leading-none dark:text-white light:text-slate-900">{item.archetype}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <Progress value={item.share} className="h-2 rounded-none bg-slate-800 light:bg-slate-200" />
                          <span className="text-sm text-slate-300 dark:text-slate-300 light:text-slate-700">{item.share}%</span>
                        </div>
                        <p className="mt-3 text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">{item.count} entrada(s){item.bestPlacement ? ` · melhor colocação: ${item.bestPlacement}º` : ""}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {!loading && !error && isCardGridView
          ? visibleEventCards.map((card) => card.kind === "report" ? (
              <TournamentReportCard key={`report-${card.id}`} tournament={card.tournament} onOpenDetail={() => openDetail("report", card.id)} />
            ) : (
              <HostedEventCard key={`sistema-${card.id}`} event={card.event} onOpenDetail={() => openDetail("sistema", card.id)} />
            ))
          : null}

        {!loading && !error && !isCardGridView ? (
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                {TOURNAMENT_TAB_OPTIONS.find((o) => o.value === tab)?.label} · {flatRows.length} resultado(s)
              </p>
              {flatRows.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                        <th className="py-2 pr-3">Pos.</th>
                        <th className="py-2 pr-3">Piloto</th>
                        <th className="py-2 pr-3">Arquétipo</th>
                        <th className="py-2 pr-3">Cores</th>
                        <th className="py-2 pr-3">Evento</th>
                        <th className="py-2 pr-3">Data</th>
                        <th className="py-2 pr-3">V-D-E</th>
                        <th className="py-2 pr-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flatRows.map(({ event, participant }) => (
                        <tr key={`${event.kind}-${event.id}-${participant.id}`} className="border-b border-white/5 text-slate-300">
                          <td className="py-2 pr-3 text-slate-500">{participant.placement ? `${participant.placement}º` : "—"}</td>
                          <td className="py-2 pr-3 text-white">
                            {participant.username ? <Link href={`/u/${participant.username}`} className="hover:underline">{participant.playerName}</Link> : participant.playerName}
                          </td>
                          <td className="py-2 pr-3">{participant.archetype || <span className="text-slate-600">—</span>}</td>
                          <td className="py-2 pr-3">
                            <div className="flex gap-1">
                              {participant.colors.map((c) => <span key={c} title={GAME_COLOR_LABEL_PT[c] || c} className="size-2.5 rounded-full" style={{ backgroundColor: GAME_COLOR_HEX[c] || "#94a3b8" }} />)}
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <button type="button" onClick={() => openDetail(event.kind, event.id)} className="text-left text-primary hover:underline">{event.name}</button>
                          </td>
                          <td className="py-2 pr-3 text-xs text-slate-500">{event.dateStart ? new Date(event.dateStart).toLocaleDateString("pt-BR") : "—"}</td>
                          <td className="py-2 pr-3 text-xs text-slate-500">{participant.wins ?? "-"}V {participant.losses ?? "-"}D {participant.draws ?? "-"}E</td>
                          <td className="py-2 pr-3">
                            {participant.deckSnapshot ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 rounded-none text-[11px] uppercase tracking-[0.1em]"
                                onClick={() =>
                                  loadDeckbuilderDraft(
                                    navigate,
                                    `${participant.deckSnapshot!.name} (${event.name})`,
                                    participant.deckSnapshot!.items.map((item) => ({ cardId: item.card.id, quantity: item.quantity, section: item.section })),
                                  )
                                }
                              >
                                <Wrench className="mr-1 size-3" /> Carregar
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Nenhum resultado nesse recorte ainda.</p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <TournamentDetailDialog
        open={Boolean(detailEvent)}
        onOpenChange={(open) => { if (!open) setDetailEvent(null); }}
        event={detailEvent}
        allEvents={normalizedEvents}
        onNavigate={setDetailEvent}
      />
    </PublicShell>
  );
}

function TournamentReportCard({ tournament, onOpenDetail }: { tournament: any; onOpenDetail: () => void }) {
  const entries: any[] = tournament.entries || [];
  const breakdown = archetypeBreakdown(entries);
  const winner = entries.find((entry) => entry.placement === 1);
  return (
    <Card className="panel-cut rounded-none surface-panel">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">
              <Badge className="mr-2 rounded-none border border-primary/40 bg-primary/10 text-primary text-[10px] normal-case tracking-normal">{tierLabel(tournament.tier || "SMALL_OFFICIAL")}</Badge>
              {tournament.season || "Sem temporada"} · {FORMAT_LABELS[tournament.format] || tournament.format} · {tournament.dateStart ? new Date(tournament.dateStart).toLocaleDateString("pt-BR") : "Data a confirmar"}
            </p>
            <h2 className="mt-2 font-heading text-4xl uppercase leading-none dark:text-white light:text-slate-900">{tournament.name}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
              {entries.length} participante(s) cadastrado(s){tournament.participantCount ? ` de ${tournament.participantCount} declarados` : ""}{winner ? ` · campeão: ${winner.playerName}` : ""}
            </p>
          </div>
          <div className="flex items-start gap-3">
            {tournament.organizer || tournament.city ? (
              <div className="panel-cut border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300 dark:text-slate-300 light:border-slate-300/80 light:bg-slate-50 light:text-slate-600">
                {tournament.organizer ? <p>{tournament.organizer}</p> : null}
                {tournament.city ? <p className="text-xs text-slate-500">{tournament.city}{tournament.country ? `, ${tournament.country}` : ""}</p> : null}
              </div>
            ) : null}
            <Button variant="outline" className="rounded-none whitespace-nowrap" onClick={onOpenDetail}>Ver detalhes</Button>
          </div>
        </div>

        {breakdown.length ? (
          <div className="mt-6 grid gap-4 2xl:grid-cols-3">
            {breakdown.slice(0, 6).map((item) => (
              <div key={item.archetype} className="panel-cut border surface-strong p-4 light:border-slate-300/80 light:bg-slate-50">
                <p className="font-heading text-2xl uppercase leading-none dark:text-white light:text-slate-900">{item.archetype}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">Presença no evento</p>
                <div className="mt-2 flex items-center gap-3">
                  <Progress value={item.share} className="h-2 rounded-none bg-slate-800 light:bg-slate-200" />
                  <span className="text-sm text-slate-300 dark:text-slate-300 light:text-slate-700">{item.share}%</span>
                </div>
                <p className="mt-4 text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">{item.count} jogador(es){item.bestPlacement ? ` · melhor colocação: ${item.bestPlacement}º` : ""}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-500">Sem arquétipo declarado pelos participantes ainda.</p>
        )}

        {entries.length ? (
          <div className="mt-6 space-y-2 border-t border-white/10 pt-6">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Participantes</p>
            <div className="grid gap-2 lg:grid-cols-2">
              {[...entries].sort((a, b) => (a.placement ?? Infinity) - (b.placement ?? Infinity)).map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-slate-950/40 px-3 py-2 text-sm light:border-slate-300/80 light:bg-slate-50">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">{entry.placement ? `${entry.placement}º` : "—"}</span>
                    {entry.user ? (
                      <Link href={`/u/${entry.user.username}`} className="text-slate-200 hover:underline dark:text-slate-200 light:text-slate-800">{entry.playerName}</Link>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-300 light:text-slate-700">{entry.playerName}</span>
                    )}
                    {entry.archetype ? <span className="text-xs text-slate-500">· {entry.archetype}</span> : null}
                  </div>
                  {entry.deck ? <Link href={`/deck/${entry.deck.shareId}`} className="text-xs uppercase tracking-[0.14em] text-primary hover:underline">Ver deck</Link> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Card de um HostedEvent finalizado (evento "ao vivo" rodado pelo Hoster via
 *  /organizador) -- sem arquétipo declarado (não é report manual), mas com
 *  classificação real calculada a partir dos confrontos/rodadas de verdade. */
function HostedEventCard({ event, onOpenDetail }: { event: any; onOpenDetail: () => void }) {
  const standings: any[] = event.standings || [];
  const champion = standings[0];
  return (
    <Card className="panel-cut rounded-none surface-panel">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">
              <Badge className="mr-2 rounded-none border border-primary/40 bg-primary/10 text-primary text-[10px] normal-case tracking-normal">{tierLabel(event.tier || "UNOFFICIAL")}</Badge>
              <span className="text-primary">Evento ao vivo</span> · {FORMAT_LABELS[event.format] || event.format} · {event.dateStart ? new Date(event.dateStart).toLocaleDateString("pt-BR") : "Data a confirmar"}
            </p>
            <h2 className="mt-2 font-heading text-4xl uppercase leading-none dark:text-white light:text-slate-900">{event.name}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
              {standings.length} participante(s){event.hoster ? ` · organizado por ${event.hoster.displayName}` : ""}{champion ? ` · campeão: ${champion.user.displayName}` : ""}
            </p>
          </div>
          <div className="flex items-start gap-3">
            {event.venueName || event.city ? (
              <div className="panel-cut border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300 dark:text-slate-300 light:border-slate-300/80 light:bg-slate-50 light:text-slate-600">
                {event.venueName ? <p>{event.venueName}</p> : null}
                {event.city ? <p className="text-xs text-slate-500">{event.city}{event.country ? `, ${event.country}` : ""}</p> : null}
              </div>
            ) : null}
            <Button variant="outline" className="rounded-none whitespace-nowrap" onClick={onOpenDetail}>Ver detalhes</Button>
          </div>
        </div>

        {standings.length ? (
          <div className="mt-6 space-y-2 border-t border-white/10 pt-6">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Classificação final</p>
            <div className="grid gap-2 lg:grid-cols-2">
              {standings.map((row, index) => (
                <div key={row.participantId} className="flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-slate-950/40 px-3 py-2 text-sm light:border-slate-300/80 light:bg-slate-50">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">{index + 1}º</span>
                    <Link href={`/u/${row.user.username}`} className="text-slate-200 hover:underline dark:text-slate-200 light:text-slate-800">{row.user.displayName}</Link>
                  </div>
                  <span className="text-xs text-slate-500">{row.points} pts · {row.wins}V {row.draws}E {row.losses}D{row.byes ? ` · ${row.byes} bye(s)` : ""}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-500">Sem participantes registrados.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* Estatísticas públicas — visão de metagame por coleção, cor, tipo e atividade competitiva.
 * Filtro por coleção/temporada adicionado pra evitar leitura genérica sem contexto: os
 * números "gerais" (banco inteiro, todos os decks públicos, todos os eventos) escondem
 * diferença real entre metas de coleções/temporadas diferentes, então toda a página agora
 * responde ao filtro escolhido em vez de só mostrar um agregado de tudo desde sempre. */
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, Cell, XAxis, YAxis } from "recharts";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { api } from "@/lib/api";
import { CARD_TYPE_OPTIONS, GAME_COLOR_HEX } from "@/lib/gundam-catalog";

const chartConfig = {
  value: { label: "Valor", color: "var(--primary)" },
} satisfies ChartConfig;

const FALLBACK_SLICE_COLOR = "#94a3b8";
const typeLabel = (raw: string) => CARD_TYPE_OPTIONS.find((opt) => opt.value === raw)?.label || raw;
const ALL_VALUE = "__all__";
// Season "current" é o default do endpoint de metagame (usa a Season com isCurrent=true
// no backend) -- distinto de ALL_VALUE, que pede pra misturar tudo incluindo legado.
const CURRENT_SEASON_VALUE = "current";

export default function StatsPage() {
  const [health, setHealth] = useState<{ userCount: number; cardCount: number; deckCount: number } | null>(null);
  const [sets, setSets] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [publicDecks, setPublicDecks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const [selectedSetId, setSelectedSetId] = useState<string>(ALL_VALUE);
  // Season de verdade agora -- "current" (default, usa a Season com isCurrent=true no
  // backend), ALL_VALUE (mistura tudo incluindo legado) ou o id de uma Season específica
  // (inclusive uma já legada, pra consulta isolada). Substitui o antigo filtro por texto
  // livre (Tournament.season).
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(CURRENT_SEASON_VALUE);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [metagame, setMetagame] = useState<{ season: { id: string; code: string; name: string } | null; setId: string | null; totalDecks: number; topCards: any[]; colorDistribution: any[]; colorCombos: any[] } | null>(null);
  const [metagameLoading, setMetagameLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.health(), api.listSets(), api.listCards(), api.listPublicDecks(), api.listTournaments(), api.listSeasons()])
      .then(([healthRes, setsRes, cardsRes, decksRes, eventsRes, seasonsRes]) => {
        setHealth(healthRes);
        setSets(setsRes);
        setCards(cardsRes);
        setPublicDecks(decksRes);
        setEvents(eventsRes);
        setSeasons(seasonsRes);
      })
      .catch(() => undefined);
  }, []);

  // Metagame competitivo (topCards/colorDistribution/colorCombos) vem de um endpoint à
  // parte (GET /api/stats/metagame) porque a fonte é DeckSnapshot travado em resultado
  // real de torneio/evento -- nunca Deck/DeckItem público, que o dono pode editar ou
  // apagar livremente a qualquer momento. Refaz a busca a cada troca de season/coleção.
  useEffect(() => {
    setMetagameLoading(true);
    api.getMetagameStats({ seasonId: selectedSeasonId, setId: selectedSetId === ALL_VALUE ? undefined : selectedSetId })
      .then(setMetagame)
      .catch(() => setMetagame(null))
      .finally(() => setMetagameLoading(false));
  }, [selectedSeasonId, selectedSetId]);

  /* Estatísticas de banco/comunidade (não-competitivas): leem o corpus de decks PUBLIC
   * já carregado -- só pra dar um retrato de curadoria da comunidade (o que o pessoal
   * está montando), nunca como dado de metagame competitivo (ver metagame acima, que é
   * a única fonte tratada como "resultado real"). Cartas de referência de token não
   * contam pra nenhuma leitura por carta. */
  const relevantItems = (deck: any) => (deck.items || []).filter((item: any) => item.section !== "token_reference" && item.card);

  // Recorte pelo filtro de coleção escolhido -- filtra o banco de cartas direto
  // (Card.setId). Um deck público só entra no recorte se tiver pelo menos uma carta
  // daquela coleção -- do contrário toda leitura "por coleção" ficaria vazia (a maioria
  // dos decks mistura cartas de várias expansões).
  const filteredCards = useMemo(() => (selectedSetId === ALL_VALUE ? cards : cards.filter((card) => card.setId === selectedSetId)), [cards, selectedSetId]);
  const filteredDecks = useMemo(
    () => (selectedSetId === ALL_VALUE ? publicDecks : publicDecks.filter((deck) => relevantItems(deck).some((item: any) => item.card.setId === selectedSetId))),
    [publicDecks, selectedSetId],
  );
  // Torneios "report" (Tournament) filtrados pela mesma Season selecionada -- só entram
  // no recorte por season específica os que já têm seasonId vinculado (torneios antigos
  // sem essa reclassificação só aparecem em "todas as temporadas").
  const filteredEvents = useMemo(() => {
    if (selectedSeasonId === ALL_VALUE) return events;
    if (selectedSeasonId === CURRENT_SEASON_VALUE) {
      const current = seasons.find((season) => season.isCurrent);
      return current ? events.filter((event) => event.seasonId === current.id) : events;
    }
    return events.filter((event) => event.seasonId === selectedSeasonId);
  }, [events, seasons, selectedSeasonId]);
  const activeSetLabel = useMemo(() => sets.find((set) => set.id === selectedSetId)?.code, [sets, selectedSetId]);
  const activeSeasonLabel = useMemo(() => {
    if (selectedSeasonId === ALL_VALUE) return null;
    if (selectedSeasonId === CURRENT_SEASON_VALUE) return metagame?.season ? `${metagame.season.code} (atual)` : null;
    const found = seasons.find((season) => season.id === selectedSeasonId);
    return found ? `${found.code} (legado)` : null;
  }, [selectedSeasonId, seasons, metagame]);
  const isFiltered = selectedSetId !== ALL_VALUE || selectedSeasonId !== CURRENT_SEASON_VALUE;

  const setChart = useMemo(() => sets.map((set) => ({ name: set.code, value: set._count?.cards ?? 0 })), [sets]);

  const colorChart = useMemo(() => {
    const map = new Map<string, number>();
    filteredCards.forEach((card) => map.set(card.color || "Sem cor", (map.get(card.color || "Sem cor") ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredCards]);

  const typeChart = useMemo(() => {
    const map = new Map<string, number>();
    filteredCards.forEach((card) => map.set(card.cardType || "Sem tipo", (map.get(card.cardType || "Sem tipo") ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name: typeLabel(name), value }));
  }, [filteredCards]);

  const deckColorMeta = useMemo(() => {
    const map = new Map<string, number>();
    filteredDecks.forEach((deck) => {
      const seen = new Set<string>();
      relevantItems(deck).forEach((item: any) => {
        const color = item.card?.color || "Sem cor";
        if (!seen.has(color)) {
          map.set(color, (map.get(color) ?? 0) + 1);
          seen.add(color);
        }
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [filteredDecks]);

  const tournamentChart = useMemo(
    () => filteredEvents.map((event) => ({ name: event.seasonRef?.code || event.season || event.name.slice(0, 10), value: event.participantCount || 0 })),
    [filteredEvents],
  );

  // Metagame competitivo, já formatado pro gráfico -- cardPresence/colorCombos vêm
  // prontos do endpoint (contagem "por deck", não por cópia, igual antes).
  const cardPresence = useMemo(() => (metagame?.topCards || []).map((entry) => ({ name: entry.name, value: entry.appearances, color: entry.color })), [metagame]);
  const colorCombos = useMemo(() => (metagame?.colorCombos || []).map((entry) => ({ name: entry.combo, value: entry.decks })), [metagame]);
  const metagameColorChart = useMemo(() => (metagame?.colorDistribution || []).map((entry) => ({ name: entry.color, value: entry.decks })), [metagame]);

  const intelligenceNotes = useMemo(() => {
    const topColor = [...colorChart].sort((a, b) => b.value - a.value)[0];
    const topType = [...typeChart].sort((a, b) => b.value - a.value)[0];
    const topMetaCard = cardPresence[0];
    const topSet = isFiltered ? null : [...setChart].sort((a, b) => b.value - a.value)[0];

    return [
      isFiltered
        ? { label: "Filtro ativo", value: `${activeSetLabel ? `Coleção ${activeSetLabel}` : "Todas as coleções"}${activeSeasonLabel ? ` · temporada ${activeSeasonLabel}` : ""} — ${filteredCards.length} carta(s) cadastradas, ${metagame?.totalDecks ?? 0} deck(s) de metagame (evento) nesse recorte.` }
        : { label: "Cobertura dominante", value: topSet ? `${topSet.name} com ${topSet.value} cartas cadastradas.` : "Sem coleções suficientes ainda." },
      { label: "Cor mais presente no banco", value: topColor ? `${topColor.name} aparece em ${topColor.value} cartas.` : "Sem cartas suficientes ainda." },
      { label: "Tipo mais representado", value: topType ? `${topType.name} lidera com ${topType.value} cartas.` : "Sem tipos suficientes ainda." },
      { label: "Carta mais usada no metagame", value: topMetaCard ? `${topMetaCard.name} aparece em ${topMetaCard.value} deck(s) de resultado real.` : "Ainda não há decks suficientes travados em evento." },
    ];
  }, [setChart, colorChart, typeChart, cardPresence, isFiltered, activeSetLabel, activeSeasonLabel, filteredCards.length, metagame]);

  return (
    <PublicShell breadcrumbs={[{ label: "Estatísticas" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Visão pública</p>
                <h2 className="mt-2 font-heading text-5xl uppercase">Metagame e cobertura do portal</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">A leitura pública mostra distribuição por coleção, cor, tipo e atividade competitiva por evento — filtre por coleção ou temporada pra não misturar metas de contextos diferentes. O bloco "Metagame competitivo" abaixo usa só decks travados em resultado real de torneio/evento; nunca decks públicos, que o dono pode editar ou apagar livremente.</p>
              </div>
              <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">Snapshot ao vivo</Badge>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Filtrar por</p>
              <select
                value={selectedSetId}
                onChange={(event) => setSelectedSetId(event.target.value)}
                className="field-shell h-9 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white"
              >
                <option value={ALL_VALUE}>Todas as coleções</option>
                {sets.map((set) => <option key={set.id} value={set.id}>{set.code} — {set.namePt || set.nameEn}</option>)}
              </select>
              <select
                value={selectedSeasonId}
                onChange={(event) => setSelectedSeasonId(event.target.value)}
                className="field-shell h-9 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white"
              >
                <option value={CURRENT_SEASON_VALUE}>Temporada atual</option>
                <option value={ALL_VALUE}>Todas as temporadas (inclui legado)</option>
                {seasons.map((season) => <option key={season.id} value={season.id}>{season.code} — {season.name}{season.isCurrent ? " (atual)" : " (legado)"}</option>)}
              </select>
              {isFiltered ? (
                <button type="button" onClick={() => { setSelectedSetId(ALL_VALUE); setSelectedSeasonId(CURRENT_SEASON_VALUE); }} className="text-xs uppercase tracking-[0.16em] text-primary hover:underline">Limpar filtro</button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {[
            ["Usuários", String(health?.userCount ?? 0)],
            ["Cartas", String(isFiltered ? filteredCards.length : (health?.cardCount ?? 0))],
            ["Decks públicos", String(filteredDecks.length)],
            ["Decks de metagame", String(metagame?.totalDecks ?? 0)],
            ["Campeonatos", String(filteredEvents.length)],
            ["Coleções", String(sets.length)],
          ].map(([label, value]) => (
            <Card key={label} className="panel-cut rounded-none surface-panel"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p><p className="mt-4 font-heading text-5xl leading-none text-white">{value}</p></CardContent></Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Cobertura por coleção</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Cartas cadastradas por expansão</h3>
              <div className="mt-6 h-[320px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={setChart}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={0} />
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Banco por cor{isFiltered && activeSetLabel ? ` · ${activeSetLabel}` : ""}</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Distribuição de cartas por cor</h3>
              <div className="mt-6 h-[320px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                    <Pie data={colorChart} dataKey="value" nameKey="name" innerRadius={52} outerRadius={95} strokeWidth={2}>
                      {colorChart.map((entry) => <Cell key={entry.name} fill={GAME_COLOR_HEX[entry.name] || FALLBACK_SLICE_COLOR} />)}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  </PieChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Pool por tipo{isFiltered && activeSetLabel ? ` · ${activeSetLabel}` : ""}</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Tipos mais presentes</h3>
              <div className="mt-6 h-[320px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={typeChart.slice(0, 8)} layout="vertical" margin={{ left: 16, right: 12 }}>
                    <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={0} />
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Leitura rápida</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Intel pública</h3>
              <div className="mt-6 space-y-4">
                {intelligenceNotes.map((item) => (
                  <div key={item.label} className="panel-cut border surface-strong p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                    <p className="mt-2 text-sm leading-7 text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Comunidade (não é metagame){isFiltered && activeSetLabel ? ` · ${activeSetLabel}` : ""}</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Cores que aparecem nos decks públicos</h3>
              <p className="mt-2 text-xs text-slate-500">Curadoria da comunidade (decks públicos, editáveis a qualquer momento pelo dono) — não entra na leitura de metagame competitivo abaixo.</p>
              <div className="mt-6 h-[320px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={deckColorMeta}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={0}>
                      {deckColorMeta.map((entry) => <Cell key={entry.name} fill={GAME_COLOR_HEX[entry.name] || FALLBACK_SLICE_COLOR} />)}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Atividade competitiva{activeSeasonLabel ? ` · ${activeSeasonLabel}` : ""}</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Participantes por campeonato</h3>
              <div className="mt-6 h-[320px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={tournamentChart}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={0} />
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Fonte: só resultado real</p>
                <h2 className="mt-2 font-heading text-4xl uppercase">Metagame competitivo</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Presença de carta, distribuição de cor e combinação de cores calculadas só a partir de decks travados (DeckSnapshot) no momento em que foram usados num torneio reportado ou num evento do organizador já finalizado. Decks públicos nunca entram aqui — podem ser editados ou apagados a qualquer momento pelo dono, então não são uma fonte confiável de metagame.{isFiltered ? " Recorte aplicado pelo filtro acima." : ""}</p>
              </div>
              {metagame?.season ? <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">Temporada {metagame.season.code}</Badge> : selectedSeasonId === ALL_VALUE ? <Badge className="rounded-none border border-white/15 bg-white/5 text-slate-400">Todas as temporadas</Badge> : null}
            </div>
            {!metagameLoading && !metagame?.totalDecks ? <p className="mt-4 text-xs text-slate-500">Ainda não há decks suficientes travados em resultado real pra esse recorte.</p> : null}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Presença de carta{isFiltered && activeSetLabel ? ` · ${activeSetLabel}` : ""}</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Mais usadas no metagame</h3>
              <div className="mt-6 h-[340px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={cardPresence} layout="vertical" margin={{ left: 16, right: 12 }}>
                    <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={0}>
                      {cardPresence.map((entry) => <Cell key={entry.name} fill={(entry.color && GAME_COLOR_HEX[entry.color]) || FALLBACK_SLICE_COLOR} />)}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
              {!cardPresence.length ? <p className="mt-3 text-xs text-slate-500">Ainda não há decks de metagame suficientes nesse recorte.</p> : null}
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Distribuição de cor{isFiltered && activeSetLabel ? ` · ${activeSetLabel}` : ""}</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Cores mais usadas no metagame</h3>
              <div className="mt-6 h-[320px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={metagameColorChart}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={0}>
                      {metagameColorChart.map((entry) => <Cell key={entry.name} fill={GAME_COLOR_HEX[entry.name] || FALLBACK_SLICE_COLOR} />)}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
              {!metagameColorChart.length ? <p className="mt-3 text-xs text-slate-500">Ainda não há decks de metagame suficientes nesse recorte.</p> : null}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-1">
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Popularidade de combinação</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Cores mais jogadas juntas</h3>
              <p className="mt-2 text-xs text-slate-500">Identidade de cor do deck inteiro (não só da coleção filtrada) — aproxima "arquétipo" sem depender de curadoria manual.</p>
              <div className="mt-6 h-[340px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={colorCombos}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={0} />
                  </BarChart>
                </ChartContainer>
              </div>
              {!colorCombos.length ? <p className="mt-3 text-xs text-slate-500">Ainda não há decks de metagame suficientes nesse recorte.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}

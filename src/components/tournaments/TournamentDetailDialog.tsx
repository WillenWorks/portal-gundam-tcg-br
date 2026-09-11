/* Visão detalhada de um evento (Fase 1, ver PLANO_METAGAME_TORNEIOS_TELEMETRIA.md §2.2):
 * navegação sequencial entre eventos, cobertura de VOD, distribuição do field, conversão
 * de top cut e tabela de resultados com carregamento direto no deckbuilder. Funciona tanto
 * pra Tournament (report) quanto HostedEvent (ao vivo) -- ambos já chegam normalizados. */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GAME_COLOR_HEX, GAME_COLOR_LABEL_PT, TOURNAMENT_TIER_OPTIONS } from "@/lib/gundam-catalog";
import { loadDeckbuilderDraft } from "@/lib/deckbuilder-draft";
import type { NormalizedEvent } from "@/lib/tournament-normalize";

const FALLBACK_SLICE_COLOR = "#94a3b8";
const tierLabel = (value: string) => TOURNAMENT_TIER_OPTIONS.find((opt) => opt.value === value)?.label || value;

/** Extrai o id de vídeo do YouTube de qualquer formato de link comum (watch?v=,
 *  youtu.be/, embed/) -- devolve null se não reconhecer, pra render defensivo. */
function extractYoutubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1) || null;
    if (parsed.searchParams.get("v")) return parsed.searchParams.get("v");
    const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/);
    if (embedMatch) return embedMatch[1];
    return null;
  } catch {
    return null;
  }
}

export function TournamentDetailDialog({
  open,
  onOpenChange,
  event,
  allEvents,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: NormalizedEvent | null;
  allEvents: NormalizedEvent[];
  onNavigate: (event: NormalizedEvent) => void;
}) {
  const [, navigate] = useLocation();
  const [activeVodPart, setActiveVodPart] = useState(0);

  const index = useMemo(() => (event ? allEvents.findIndex((e) => e.kind === event.kind && e.id === event.id) : -1), [event, allEvents]);
  const prevEvent = index > 0 ? allEvents[index - 1] : null;
  const nextEvent = index >= 0 && index < allEvents.length - 1 ? allEvents[index + 1] : null;

  const fieldBreakdown = useMemo(() => {
    if (!event) return [];
    const counts = new Map<string, number>();
    event.participants.forEach((p) => {
      p.colors.forEach((color) => counts.set(color, (counts.get(color) || 0) + 1));
    });
    return Array.from(counts.entries())
      .map(([color, decks]) => ({ name: GAME_COLOR_LABEL_PT[color] || color, color, value: decks }))
      .sort((a, b) => b.value - a.value);
  }, [event]);

  const topCutBreakdown = useMemo(() => {
    if (!event || !event.topCutSize) return null;
    const withArchetype = event.participants.filter((p) => p.archetype);
    if (!withArchetype.length) return null;
    const cutSet = withArchetype.filter((p) => p.placement != null && p.placement <= event.topCutSize!);
    if (!cutSet.length) return null;
    const fieldCounts = new Map<string, number>();
    withArchetype.forEach((p) => fieldCounts.set(p.archetype!, (fieldCounts.get(p.archetype!) || 0) + 1));
    const cutCounts = new Map<string, number>();
    cutSet.forEach((p) => cutCounts.set(p.archetype!, (cutCounts.get(p.archetype!) || 0) + 1));
    return Array.from(cutCounts.entries())
      .map(([archetype, cutCount]) => ({
        archetype,
        cutShare: Math.round((cutCount / cutSet.length) * 100),
        fieldShare: Math.round(((fieldCounts.get(archetype) || 0) / withArchetype.length) * 100),
      }))
      .sort((a, b) => b.cutShare - a.cutShare);
  }, [event]);

  if (!event) return null;

  const sortedParticipants = [...event.participants].sort((a, b) => (a.placement ?? Infinity) - (b.placement ?? Infinity));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto rounded-none border-white/10 bg-slate-950 p-0">
        <div className="panel-cut border-b border-white/10 bg-slate-950/95 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary text-[10px] uppercase tracking-[0.16em]">{tierLabel(event.tier)}</Badge>
                {event.kind === "sistema" ? <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent text-[10px] uppercase tracking-[0.16em]">Evento ao vivo</Badge> : null}
              </div>
              <DialogHeader className="mt-2 p-0 text-left">
                <DialogTitle className="font-heading text-3xl uppercase leading-none text-white">{event.name}</DialogTitle>
              </DialogHeader>
              <p className="mt-2 text-sm text-slate-400">
                {event.dateStart ? new Date(event.dateStart).toLocaleDateString("pt-BR") : "Data a confirmar"}
                {event.organizerLabel ? ` · ${event.organizerLabel}` : ""}
                {event.locationLabel ? ` · ${event.locationLabel}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="rounded-none" disabled={!prevEvent} onClick={() => prevEvent && onNavigate(prevEvent)}><ChevronLeft className="size-4" /></Button>
              <Button variant="outline" size="icon" className="rounded-none" disabled={!nextEvent} onClick={() => nextEvent && onNavigate(nextEvent)}><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Central de Transmissão · VOD</p>
            {event.vodUrls.length ? (
              <div className="mt-3 space-y-3">
                {event.vodUrls.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    {event.vodUrls.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveVodPart(idx)}
                        className={`panel-cut border px-3 py-1.5 text-xs uppercase tracking-[0.14em] ${activeVodPart === idx ? "border-primary/60 bg-primary/10 text-primary" : "border-white/15 text-slate-400 hover:border-white/30"}`}
                      >
                        Parte {idx + 1}
                      </button>
                    ))}
                  </div>
                ) : null}
                {(() => {
                  const videoId = extractYoutubeId(event.vodUrls[activeVodPart] || event.vodUrls[0]);
                  return videoId ? (
                    <div className="aspect-video w-full overflow-hidden panel-cut border border-white/10">
                      <iframe
                        className="h-full w-full"
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title={`VOD ${event.name}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Link de vídeo não reconhecido.</p>
                  );
                })()}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Sem cobertura de vídeo cadastrada para este evento.</p>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="panel-cut border surface-strong p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Distribuição do Field</p>
              <h4 className="mt-1 font-heading text-xl uppercase text-white">Composição por cor</h4>
              {fieldBreakdown.length ? (
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <RechartsTooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }} />
                      <Pie data={fieldBreakdown} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} strokeWidth={2}>
                        {fieldBreakdown.map((entry) => <Cell key={entry.color} fill={GAME_COLOR_HEX[entry.color] || FALLBACK_SLICE_COLOR} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Sem decklists com cor registrada nesse evento ainda.</p>
              )}
            </div>

            <div className="panel-cut border surface-strong p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Conversão de Top Cut</p>
              <h4 className="mt-1 font-heading text-xl uppercase text-white">Field geral vs. fase eliminatória</h4>
              {topCutBreakdown ? (
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCutBreakdown} layout="vertical" margin={{ left: 8, right: 12 }}>
                      <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} unit="%" />
                      <YAxis type="category" dataKey="archetype" width={110} tickLine={false} axisLine={false} fontSize={11} />
                      <RechartsTooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }} />
                      <Bar dataKey="fieldShare" name="Field geral" fill="#475569" radius={0} />
                      <Bar dataKey="cutShare" name="Top cut" fill="var(--primary)" radius={0} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Este evento não tem corte (Top X) ou arquétipos declarados suficientes pra essa leitura.</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tabela de Resultados Oficiais</p>
            {sortedParticipants.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                      <th className="py-2 pr-3">Pos.</th>
                      <th className="py-2 pr-3">Piloto</th>
                      <th className="py-2 pr-3">Arquétipo</th>
                      <th className="py-2 pr-3">Cores</th>
                      <th className="py-2 pr-3">V-D-E</th>
                      <th className="py-2 pr-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedParticipants.map((p) => (
                      <tr key={p.id} className="border-b border-white/5 text-slate-300">
                        <td className="py-2 pr-3 text-slate-500">{p.placement ? `${p.placement}º` : "—"}</td>
                        <td className="py-2 pr-3 text-white">{p.playerName}</td>
                        <td className="py-2 pr-3">{p.archetype || <span className="text-slate-600">—</span>}</td>
                        <td className="py-2 pr-3">
                          <div className="flex gap-1">
                            {p.colors.map((c) => <span key={c} title={GAME_COLOR_LABEL_PT[c] || c} className="size-2.5 rounded-full" style={{ backgroundColor: GAME_COLOR_HEX[c] || FALLBACK_SLICE_COLOR }} />)}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-xs text-slate-500">{p.wins ?? "-"}V {p.losses ?? "-"}D {p.draws ?? "-"}E</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-2">
                            {p.deckSnapshot ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 rounded-none text-[11px] uppercase tracking-[0.1em]"
                                onClick={() =>
                                  loadDeckbuilderDraft(
                                    navigate,
                                    `${p.deckSnapshot!.name} (${event.name})`,
                                    p.deckSnapshot!.items.map((item) => ({ cardId: item.card.id, quantity: item.quantity, section: item.section })),
                                  )
                                }
                              >
                                <Wrench className="mr-1 size-3" /> Carregar
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Sem participantes registrados.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

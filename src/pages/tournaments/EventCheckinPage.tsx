import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import {
  CheckCircle2,
  Lock,
  ShieldAlert,
  CalendarClock,
  MapPin,
  Swords,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

interface CheckinEventData {
  event: {
    id: string;
    name: string;
    venueName?: string | null;
    city?: string | null;
    format: string;
    status: string;
    dateStart: string;
    maxPlayers?: number | null;
    hoster?: { displayName: string; username: string };
  };
  participant?: {
    id: string;
    deckId?: string | null;
    deckLockedAt?: string | null;
    deckSnapshot?: {
      id: string;
      name: string;
      items: Array<{
        quantity: number;
        section: string;
        card: { id: string; code: string; nameEn: string; namePt: string; color: string };
      }>;
    } | null;
  } | null;
  isCheckedIn: boolean;
}

interface UserDeckItem {
  id: string;
  name: string;
  format: string;
  visibility: string;
  legality?: {
    isLegal: boolean;
    reasons: string[];
  };
  featuredCards?: Array<{ id: string; code: string; nameEn: string; imageUrl?: string | null }>;
  items?: Array<{ quantity: number; section?: string; card?: { color?: string } }>;
}

interface EventCheckinPageProps {
  eventId?: string;
}

export function EventCheckinPage({ eventId: propEventId }: EventCheckinPageProps = {}) {
  const [, params] = useRoute<{ id: string }>("/eventos/:id/checkin");
  const eventId = propEventId || params?.id;
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CheckinEventData | null>(null);
  const [userDecks, setUserDecks] = useState<UserDeckItem[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);

  const fetchStatus = async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/hosted-events/${eventId}/checkin-status`);
      if (!res.ok) throw new Error("Evento não encontrado.");
      const json = (await res.json()) as CheckinEventData;
      setData(json);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao consultar status do evento.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDecks = async () => {
    if (!user) return;
    setLoadingDecks(true);
    try {
      const res = await fetch("/api/decks/me");
      if (res.ok) {
        const json = await res.json();
        const decks: UserDeckItem[] = Array.isArray(json) ? json : json.items || [];
        setUserDecks(decks);
        if (decks.length > 0 && !selectedDeckId) {
          setSelectedDeckId(decks[0].id);
        }
      }
    } catch {
      // Ignora erro de listagem
    } finally {
      setLoadingDecks(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [eventId, user]);

  useEffect(() => {
    if (user && !data?.isCheckedIn) {
      fetchUserDecks();
    }
  }, [user, data?.isCheckedIn]);

  const handleConfirmCheckin = async () => {
    if (!eventId || !selectedDeckId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/hosted-events/${eventId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: selectedDeckId }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao realizar check-in.");
      }

      toast.success("Check-in confirmado com sucesso! Seu deck foi travado para o torneio.");
      setConfirmModal(false);
      await fetchStatus();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao travar deck.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDeck = userDecks.find((d) => d.id === selectedDeckId);

  return (
    <PortalShell
      breadcrumbs={[
        { label: "Eventos", href: "/eventos" },
        { label: data?.event?.name || "Evento", href: `/eventos` },
        { label: "Check-in de Jogador" },
      ]}
    >
      <div className="max-w-3xl mx-auto space-y-6 py-4">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="mx-auto size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-portal uppercase tracking-widest">Carregando dados do evento...</p>
          </div>
        ) : !data?.event ? (
          <Card className="panel-cut rounded-none border-red-500/30 bg-red-950/20 p-8 text-center space-y-4">
            <ShieldAlert className="mx-auto size-12 text-red-400" />
            <h2 className="font-heading text-2xl uppercase">Evento Não Encontrado</h2>
            <p className="text-sm text-slate-400">Verifique se o link ou QR code escaneado está correto.</p>
            <Button asChild className="rounded-none bg-primary text-primary-foreground">
              <Link to="/eventos">Voltar aos Eventos</Link>
            </Button>
          </Card>
        ) : (
          <>
            {/* EVENT HEADER HERO */}
            <Card className="panel-cut rounded-none border-primary/30 hero-surface">
              <CardContent className="p-6 md:p-8 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase tracking-[0.24em] text-primary font-semibold block">
                      Check-in Oficial de Torneio LGS
                    </span>
                    <h1 className="mt-1 font-heading text-3xl md:text-4xl uppercase heading-portal font-black">
                      {data.event.name}
                    </h1>
                  </div>
                  <Badge variant="outline" className="rounded-none border-primary/50 text-primary uppercase text-xs">
                    {data.event.format}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-sm text-muted-portal border-t border-primary/10">
                  <p className="flex items-center gap-2">
                    <CalendarClock className="size-4 text-primary" />
                    {new Date(data.event.dateStart).toLocaleString("pt-BR")}
                  </p>
                  {data.event.venueName && (
                    <p className="flex items-center gap-2">
                      <MapPin className="size-4 text-primary" />
                      {data.event.venueName} {data.event.city ? `· ${data.event.city}` : ""}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* STATE 1: NOT LOGGED IN */}
            {!user ? (
              <Card className="panel-cut rounded-none border-amber-500/30 bg-amber-950/10">
                <CardContent className="p-8 text-center space-y-4">
                  <AlertTriangle className="mx-auto size-12 text-amber-400" />
                  <h2 className="font-heading text-2xl uppercase tracking-wider text-white">
                    Autenticação Necessária
                  </h2>
                  <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                    Você precisa estar conectado à sua conta do Portal Gundam TCG para confirmar presença e registrar seu deck oficial.
                  </p>
                  <div className="pt-2">
                    <Button
                      asChild
                      className="rounded-none bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold uppercase tracking-wider px-6"
                    >
                      <Link to={`/login?redirect=/eventos/${eventId}/checkin`}>
                        Entrar na Minha Conta <ArrowRight className="ml-2 size-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : data.isCheckedIn ? (
              /* STATE 2: ALREADY CHECKED IN & DECK LOCKED */
              <Card className="panel-cut rounded-none border-emerald-500/40 bg-emerald-950/15">
                <CardContent className="p-8 space-y-6">
                  <div className="flex items-center gap-4 border-b border-emerald-500/20 pb-4">
                    <div className="size-12 rounded-none bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="size-8" />
                    </div>
                    <div>
                      <h2 className="font-heading text-2xl uppercase tracking-wider text-white font-black">
                        Check-in Confirmado!
                      </h2>
                      <p className="text-xs text-emerald-400 uppercase tracking-widest font-semibold">
                        Sua presença e decklist foram homologadas para este torneio
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 bg-slate-950/60 p-4 border border-emerald-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-widest text-slate-400">Deck Travado</span>
                      <Badge className="rounded-none bg-emerald-500/20 text-emerald-300 border-emerald-500/30 uppercase text-[10px]">
                        <Lock className="mr-1 size-3" /> Imutável
                      </Badge>
                    </div>

                    <p className="font-heading text-xl uppercase text-white font-bold">
                      {data.participant?.deckSnapshot?.name || "Deck de Torneio"}
                    </p>

                    {data.participant?.deckLockedAt && (
                      <p className="text-xs text-slate-400">
                        Travado em: {new Date(data.participant.deckLockedAt).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>

                  <div className="p-4 bg-slate-900/50 border border-slate-800 text-xs text-slate-400 leading-relaxed">
                    <p>
                      Sua decklist foi congelada e está sincronizada com o sistema de pareamento do organizador. Acompanhe a chamada das mesas no painel LGS TV da loja.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button asChild variant="outline" className="rounded-none">
                      <Link to={`/organizador/eventos/${eventId}/tv`} target="_blank">
                        Abrir Painel LGS TV
                      </Link>
                    </Button>
                    <Button asChild className="rounded-none bg-primary text-primary-foreground">
                      <Link to="/eventos">Voltar ao Hub</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* STATE 3: LOGGED IN, DECK SELECTION & LOCK */
              <Card className="panel-cut rounded-none border-primary/30 surface-panel">
                <CardContent className="p-6 md:p-8 space-y-6">
                  <div className="border-b border-primary/20 pb-4">
                    <h2 className="font-heading text-2xl uppercase tracking-wider text-white font-bold">
                      Selecione o Deck para o Torneio
                    </h2>
                    <p className="text-sm text-muted-portal mt-1">
                      Escolha a decklist que você utilizará nesta disputa. Uma cópia imutável será gravada para este evento.
                    </p>
                  </div>

                  {loadingDecks ? (
                    <div className="py-8 text-center text-sm text-muted-portal">
                      Carregando seus decks salvos...
                    </div>
                  ) : !userDecks.length ? (
                    <div className="py-8 text-center space-y-4 border border-dashed border-slate-800 p-6">
                      <p className="text-sm text-slate-400">
                        Você ainda não possui nenhum deck criado na sua conta.
                      </p>
                      <Button asChild className="rounded-none bg-primary text-primary-foreground">
                        <Link to="/deckbuilder">Criar Deck no Deckbuilder</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-slate-300 font-semibold block">
                          Seu Deck
                        </label>
                        <select
                          value={selectedDeckId}
                          onChange={(e) => setSelectedDeckId(e.target.value)}
                          className="field-shell w-full h-12 px-4 text-base bg-slate-950 border-slate-700 text-white rounded-none"
                        >
                          {userDecks.map((deck) => (
                            <option key={deck.id} value={deck.id}>
                              {deck.name} ({deck.format || "constructed"})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* SELECTED DECK PREVIEW & LEGALITY CHECK */}
                      {selectedDeck && (
                        <div className="bg-slate-950/80 border border-slate-800 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-white uppercase tracking-wide">
                              {selectedDeck.name}
                            </span>
                            {selectedDeck.legality?.isLegal ? (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 rounded-none uppercase text-[10px]">
                                Legal para Torneio
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="rounded-none uppercase text-[10px]">
                                Ilegal para Torneio
                              </Badge>
                            )}
                          </div>

                          {selectedDeck.legality && !selectedDeck.legality.isLegal && (
                            <div className="bg-red-950/30 border border-red-500/30 p-3 text-xs text-red-300 space-y-1">
                              <p className="font-semibold">Motivos de Ilegalidade:</p>
                              <ul className="list-disc pl-4 space-y-0.5">
                                {selectedDeck.legality.reasons.map((r, idx) => (
                                  <li key={idx}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* IMMUTABLE WARNING */}
                      <div className="p-4 bg-amber-950/20 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-300">
                        <Lock className="size-5 shrink-0 mt-0.5 text-amber-400" />
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-amber-200">
                            Atenção: Trava Definitiva
                          </p>
                          <p className="mt-1 leading-relaxed text-amber-300/90">
                            Ao confirmar o check-in, o deck escolhido será travado de forma irrevogável. Você não poderá alterar a decklist após a confirmação.
                          </p>
                        </div>
                      </div>

                      {/* CONFIRM BUTTON */}
                      <div className="pt-4 flex justify-end">
                        <Button
                          disabled={submitting || !selectedDeckId || (selectedDeck && !selectedDeck.legality?.isLegal)}
                          onClick={() => setConfirmModal(true)}
                          className="rounded-none bg-primary hover:bg-primary/90 text-primary-foreground font-heading uppercase tracking-wider text-base px-8 h-12 font-bold"
                        >
                          <Lock className="mr-2 size-5" />
                          Confirmar Check-in & Travar Deck
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* CONFIRMATION DIALOG */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="panel-cut rounded-none border border-amber-500/50 bg-[#070b12] max-w-md w-full p-6 space-y-4 text-white">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="size-6 shrink-0" />
              <h3 className="font-heading text-xl uppercase font-bold">Confirmar Trava de Deck</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Você tem certeza de que deseja homologar o deck{" "}
              <strong className="text-white">"{selectedDeck?.name}"</strong> para o evento{" "}
              <strong className="text-white">"{data?.event?.name}"</strong>?
            </p>
            <p className="text-xs text-amber-400/90 font-mono">
              Esta ação não pode ser desfeita após a confirmação.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                className="rounded-none"
                disabled={submitting}
                onClick={() => setConfirmModal(false)}
              >
                Cancelar
              </Button>
              <Button
                disabled={submitting}
                onClick={handleConfirmCheckin}
                className="rounded-none bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold uppercase"
              >
                {submitting ? "Homologando..." : "Sim, Travar Deck"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}

export default EventCheckinPage;

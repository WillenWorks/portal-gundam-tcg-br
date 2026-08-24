/* Painel do Hoster/Organizador — fase A do sistema de eventos ao vivo (diferente
 * dos torneios "report" cadastrados pelo admin em /admin/events): aqui é o próprio
 * usuário com a flag isHoster (ou um ADMIN) que cria e gerencia os eventos que ele
 * organiza. Fase A trouxe só o esqueleto do evento (local/data/formato/limite de
 * jogadores). Fase B acrescenta participantes (sempre conta cadastrada) e a trava de
 * deck -- de mão única: uma vez travado, não tem "destravar" nem no front nem na API. */
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CalendarClock, Lock, Plus, Trash2, UserPlus, Users } from "lucide-react";

import { api, type ApiDeck } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type HostedEventParticipant = {
  id: string;
  user: { id: string; username: string; displayName: string; avatarUrl?: string | null };
  deck?: { id: string; name: string; shareId: string } | null;
  deckSnapshot?: { id: string; name: string; format?: string | null } | null;
  deckLockedAt?: string | null;
};

type HostedEvent = {
  id: string;
  name: string;
  description?: string | null;
  format: string;
  venueName?: string | null;
  city?: string | null;
  country?: string | null;
  dateStart: string;
  dateEnd?: string | null;
  maxPlayers?: number | null;
  status: "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  participants?: HostedEventParticipant[];
};

const STATUS_LABEL: Record<HostedEvent["status"], string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

const emptyForm = { id: "", name: "", description: "", format: "constructed", venueName: "", city: "", country: "", dateStart: "", maxPlayers: "", status: "DRAFT" as HostedEvent["status"] };

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function toDatetimeLocalValue(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function OrganizerPage() {
  const [events, setEvents] = useState<HostedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Fase B: painel de participantes -- aberto por evento, com busca de usuário,
  // adição/remoção e trava de deck (ver comentário no topo do arquivo).
  const [participantsEvent, setParticipantsEvent] = useState<HostedEvent | null>(null);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantResults, setParticipantResults] = useState<Array<{ id: string; username: string; displayName: string; avatarUrl?: string | null }>>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [expandedDeckPickerId, setExpandedDeckPickerId] = useState<string | null>(null);
  const [deckOptions, setDeckOptions] = useState<Record<string, ApiDeck[]>>({});
  const [deckChoice, setDeckChoice] = useState<Record<string, string>>({});
  const [lockingId, setLockingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.listHostedEventsMine();
      setEvents(result);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao carregar seus eventos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load().catch(() => undefined); }, []);

  const openModal = (event?: HostedEvent) => {
    setForm(event ? {
      id: event.id,
      name: event.name,
      description: event.description || "",
      format: event.format,
      venueName: event.venueName || "",
      city: event.city || "",
      country: event.country || "",
      dateStart: toDatetimeLocalValue(event.dateStart),
      maxPlayers: event.maxPlayers != null ? String(event.maxPlayers) : "",
      status: event.status,
    } : emptyForm);
    setModalOpen(true);
  };

  const saveEvent = async () => {
    if (!form.name.trim()) { toast.error("Nome do evento é obrigatório."); return; }
    if (!form.dateStart) { toast.error("Data/hora de início é obrigatória."); return; }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      format: form.format || "constructed",
      venueName: form.venueName.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      dateStart: new Date(form.dateStart).toISOString(),
      maxPlayers: form.maxPlayers ? Number(form.maxPlayers) : null,
      status: form.status,
    };
    try {
      if (form.id) await api.updateHostedEvent(form.id, payload);
      else await api.createHostedEvent(payload);
      setModalOpen(false);
      setForm(emptyForm);
      await load();
      toast.success(form.id ? "Evento atualizado." : "Evento criado.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar o evento.");
    }
  };

  const removeEvent = async (event: HostedEvent) => {
    if (!window.confirm(`Cancelar o evento "${event.name}"? Não tem como desfazer.`)) return;
    try {
      await api.deleteHostedEvent(event.id);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      toast.success("Evento cancelado.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cancelar o evento.");
    }
  };

  const refreshParticipantsEvent = async (id: string) => {
    const fresh = await api.getHostedEvent(id);
    setParticipantsEvent(fresh);
    setEvents((current) => current.map((item) => (item.id === id ? fresh : item)));
  };

  const openParticipants = async (event: HostedEvent) => {
    setParticipantSearch("");
    setParticipantResults([]);
    setDeckOptions({});
    setDeckChoice({});
    setExpandedDeckPickerId(null);
    setParticipantsEvent(event);
    try {
      await refreshParticipantsEvent(event.id);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao carregar participantes.");
    }
  };

  useEffect(() => {
    if (!participantsEvent) return;
    const q = participantSearch.trim();
    if (q.length < 2) { setParticipantResults([]); return; }
    setSearchingUsers(true);
    const handle = setTimeout(async () => {
      try {
        const results = await api.searchUsers(q);
        setParticipantResults(results);
      } catch (err: any) {
        toast.error(err?.message || "Erro ao buscar usuários.");
      } finally {
        setSearchingUsers(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [participantSearch, participantsEvent?.id]);

  const addParticipant = async (userId: string) => {
    if (!participantsEvent) return;
    setAddingUserId(userId);
    try {
      await api.addHostedEventParticipant(participantsEvent.id, userId);
      await refreshParticipantsEvent(participantsEvent.id);
      setParticipantSearch("");
      setParticipantResults([]);
      toast.success("Participante adicionado.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao adicionar participante.");
    } finally {
      setAddingUserId(null);
    }
  };

  const removeParticipant = async (participant: HostedEventParticipant) => {
    if (!participantsEvent) return;
    if (!window.confirm(`Remover ${participant.user.displayName} do evento?`)) return;
    setRemovingId(participant.id);
    try {
      await api.removeHostedEventParticipant(participantsEvent.id, participant.id);
      await refreshParticipantsEvent(participantsEvent.id);
      toast.success("Participante removido.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover participante.");
    } finally {
      setRemovingId(null);
    }
  };

  const toggleDeckPicker = async (participant: HostedEventParticipant) => {
    if (expandedDeckPickerId === participant.id) { setExpandedDeckPickerId(null); return; }
    setExpandedDeckPickerId(participant.id);
    if (deckOptions[participant.id]) return;
    try {
      const profile = await api.getPublicProfile(participant.user.username);
      setDeckOptions((current) => ({ ...current, [participant.id]: profile.decks }));
    } catch (err: any) {
      toast.error(err?.message || "Erro ao carregar decks públicos do jogador.");
    }
  };

  const lockDeck = async (participant: HostedEventParticipant) => {
    const deckId = deckChoice[participant.id];
    if (!deckId) { toast.error("Escolha um deck antes de travar."); return; }
    if (!participantsEvent) return;
    if (!window.confirm("Depois de travado, o deck não pode mais ser trocado para este participante. Confirmar?")) return;
    setLockingId(participant.id);
    try {
      await api.lockHostedEventParticipantDeck(participantsEvent.id, participant.id, deckId);
      await refreshParticipantsEvent(participantsEvent.id);
      setExpandedDeckPickerId(null);
      toast.success("Deck travado para este participante.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao travar o deck.");
    } finally {
      setLockingId(null);
    }
  };

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Meus eventos" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Organizador</p>
              <h1 className="mt-2 font-heading text-4xl uppercase heading-portal">Meus eventos</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-soft">Crie e acompanhe eventos que você organiza — local, data, formato e limite de jogadores. Participantes, decks travados e rodadas entram nas próximas etapas.</p>
            </div>
            <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => openModal()}><Plus className="mr-2 size-4" />Novo evento</Button>
          </CardContent>
        </Card>

        {loading ? <p className="text-sm text-muted-portal">Carregando seus eventos...</p> : null}

        {!loading && !events.length ? (
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-10 text-center">
              <p className="text-lg heading-portal">Nenhum evento criado ainda</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-portal">Comece cadastrando o local, data e formato do seu próximo evento.</p>
              <Button className="mt-5 rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => openModal()}><Plus className="mr-2 size-4" />Criar meu primeiro evento</Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="panel-cut rounded-none surface-panel">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg heading-portal">{event.name}</p>
                  <Badge variant="outline" className="rounded-none border-primary/40 text-primary">{STATUS_LABEL[event.status]}</Badge>
                </div>
                <p className="flex items-center gap-2 text-sm text-muted-portal"><CalendarClock className="size-4" />{new Date(event.dateStart).toLocaleString("pt-BR")}</p>
                {event.venueName || event.city ? <p className="text-sm text-muted-portal">{[event.venueName, event.city, event.country].filter(Boolean).join(" · ")}</p> : null}
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{event.format}{event.maxPlayers ? ` · até ${event.maxPlayers} jogadores` : ""}</p>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="rounded-none" onClick={() => openModal(event)}>Editar</Button>
                  <Button variant="outline" className="rounded-none" onClick={() => openParticipants(event)}><Users className="mr-2 size-4" />Participantes{event.participants ? ` (${event.participants.length})` : ""}</Button>
                  <Button variant="outline" className="rounded-none text-red-400 hover:text-red-300" onClick={() => removeEvent(event)}><Trash2 className="mr-2 size-4" />Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="panel-cut max-h-[85vh] max-w-2xl overflow-y-auto rounded-none surface-panel">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar evento" : "Novo evento"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldBlock label="Nome do evento"><Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Torneio local de sábado" className="rounded-none" /></FieldBlock>
            <FieldBlock label="Formato"><select value={form.format} onChange={(e) => setForm((s) => ({ ...s, format: e.target.value }))} className="field-shell h-10 px-3 text-sm"><option value="constructed">Constructed</option><option value="team_battle">Team Battle</option><option value="battle_royale">Battle Royale</option></select></FieldBlock>
          </div>
          <FieldBlock label="Descrição"><Textarea value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} className="min-h-20 rounded-none" /></FieldBlock>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldBlock label="Local (loja/espaço)"><Input value={form.venueName} onChange={(e) => setForm((s) => ({ ...s, venueName: e.target.value }))} className="rounded-none" /></FieldBlock>
            <FieldBlock label="Data e hora de início"><Input type="datetime-local" value={form.dateStart} onChange={(e) => setForm((s) => ({ ...s, dateStart: e.target.value }))} className="rounded-none" /></FieldBlock>
            <FieldBlock label="Cidade"><Input value={form.city} onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))} className="rounded-none" /></FieldBlock>
            <FieldBlock label="País"><Input value={form.country} onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))} className="rounded-none" /></FieldBlock>
            <FieldBlock label="Limite de jogadores"><Input type="number" min={0} value={form.maxPlayers} onChange={(e) => setForm((s) => ({ ...s, maxPlayers: e.target.value }))} className="rounded-none" /></FieldBlock>
            <FieldBlock label="Status">
              <select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as HostedEvent["status"] }))} className="field-shell h-10 px-3 text-sm">
                {(Object.keys(STATUS_LABEL) as HostedEvent["status"][]).map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
              </select>
            </FieldBlock>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveEvent}>{form.id ? "Salvar alterações" : "Criar evento"}</Button>
            <Button variant="outline" className="rounded-none" onClick={() => setModalOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(participantsEvent)} onOpenChange={(open) => { if (!open) setParticipantsEvent(null); }}>
        <DialogContent className="panel-cut max-h-[85vh] max-w-2xl overflow-y-auto rounded-none surface-panel">
          <DialogHeader>
            <DialogTitle>Participantes{participantsEvent ? ` — ${participantsEvent.name}` : ""}</DialogTitle>
          </DialogHeader>

          <FieldBlock label="Adicionar participante (usuário cadastrado)">
            <Input value={participantSearch} onChange={(e) => setParticipantSearch(e.target.value)} placeholder="Buscar por usuário ou nome" className="rounded-none" />
          </FieldBlock>
          {searchingUsers ? <p className="text-xs text-muted-portal">Buscando...</p> : null}
          {participantResults.length ? (
            <div className="space-y-1.5">
              {participantResults.map((result) => (
                <div key={result.id} className="flex items-center justify-between gap-2 border border-primary/10 bg-black/10 px-3 py-2">
                  <div>
                    <p className="text-sm text-soft">{result.displayName}</p>
                    <p className="text-xs text-muted-portal">@{result.username}</p>
                  </div>
                  <Button variant="outline" className="rounded-none" disabled={addingUserId === result.id} onClick={() => addParticipant(result.id)}>
                    <UserPlus className="mr-2 size-4" />Adicionar
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-2 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Inscritos ({participantsEvent?.participants?.length ?? 0})</p>
            {!participantsEvent?.participants?.length ? (
              <p className="text-sm text-muted-portal">Nenhum participante inscrito ainda.</p>
            ) : (
              <div className="space-y-2">
                {participantsEvent.participants.map((participant) => {
                  const locked = Boolean(participant.deckLockedAt);
                  const decks = deckOptions[participant.id] || [];
                  return (
                    <div key={participant.id} className="panel-cut border border-primary/20 bg-black/20 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-soft">{participant.user.displayName}</p>
                          <p className="text-xs text-muted-portal">@{participant.user.username}</p>
                        </div>
                        {locked ? (
                          <Badge variant="outline" className="rounded-none border-primary/40 text-primary"><Lock className="mr-1 size-3" />Deck travado</Badge>
                        ) : (
                          <Button variant="outline" className="rounded-none text-red-400 hover:text-red-300" disabled={removingId === participant.id} onClick={() => removeParticipant(participant)}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                      {locked ? (
                        <p className="mt-2 text-xs text-muted-portal">Deck usado: <span className="text-soft">{participant.deck?.name || participant.deckSnapshot?.name || "—"}</span> — não pode mais ser trocado.</p>
                      ) : expandedDeckPickerId === participant.id ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select value={deckChoice[participant.id] || ""} onChange={(e) => setDeckChoice((s) => ({ ...s, [participant.id]: e.target.value }))} className="field-shell h-9 px-2 text-xs">
                            <option value="">Selecione um deck público</option>
                            {decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
                          </select>
                          <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={lockingId === participant.id || !decks.length} onClick={() => lockDeck(participant)}>Travar deck</Button>
                          <Button variant="outline" className="rounded-none" onClick={() => setExpandedDeckPickerId(null)}>Fechar</Button>
                          {!decks.length ? <span className="text-xs text-muted-portal">Este jogador não tem decks públicos no perfil.</span> : null}
                        </div>
                      ) : (
                        <Button variant="outline" className="mt-2 rounded-none" onClick={() => toggleDeckPicker(participant)}>Escolher deck</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="rounded-none" onClick={() => setParticipantsEvent(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PortalShell>
  );
}

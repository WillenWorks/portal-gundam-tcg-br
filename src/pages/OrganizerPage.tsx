/* Painel do Hoster/Organizador — fase A do sistema de eventos ao vivo (diferente
 * dos torneios "report" cadastrados pelo admin em /admin/events): aqui é o próprio
 * usuário com a flag isHoster (ou um ADMIN) que cria e gerencia os eventos que ele
 * organiza. Fase A trouxe só o esqueleto do evento (local/data/formato/limite de
 * jogadores). Fase B acrescenta participantes (sempre conta cadastrada) e a trava de
 * deck -- de mão única: uma vez travado, não tem "destravar" nem no front nem na API. */
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CalendarClock, Lock, Plus, Swords, Trash2, Trophy, UserPlus, Users } from "lucide-react";

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

// Fase C: participante enxuto dentro de um confronto -- os dados completos (deck,
// deckSnapshot) já vêm pela lista de participants do próprio evento.
type HostedEventMatchParticipant = { id: string; user: { id: string; username: string; displayName: string } };

type HostedEventMatchResult = "PENDING" | "PLAYER_A_WIN" | "PLAYER_B_WIN" | "DRAW" | "BYE";

type HostedEventMatch = {
  id: string;
  tableNumber?: number | null;
  participantAId: string;
  participantBId?: string | null;
  participantA: HostedEventMatchParticipant;
  participantB?: HostedEventMatchParticipant | null;
  result: HostedEventMatchResult;
};

type HostedEventRound = {
  id: string;
  roundNumber: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  matches: HostedEventMatch[];
};

type HostedEventStandingRow = {
  participantId: string;
  user: { id: string; username: string; displayName: string; avatarUrl?: string | null };
  points: number;
  wins: number;
  draws: number;
  losses: number;
  byes: number;
  played: number;
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
  rounds?: HostedEventRound[];
};

const STATUS_LABEL: Record<HostedEvent["status"], string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

const ROUND_STATUS_LABEL: Record<HostedEventRound["status"], string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
};

// Fase C: rótulo do resultado do ponto de vista de quem está lendo a lista de
// confrontos (não do participanteA/B especificamente).
const MATCH_RESULT_LABEL: Record<HostedEventMatchResult, string> = {
  PENDING: "Resultado pendente",
  PLAYER_A_WIN: "Vitória do jogador A",
  PLAYER_B_WIN: "Vitória do jogador B",
  DRAW: "Empate",
  BYE: "Bye (folga)",
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

  // Fase C: painel de rodadas/confrontos/classificação -- pareamento e resultado são
  // sempre lançados manualmente pelo Hoster (ver comentário no topo do arquivo).
  const [roundsEvent, setRoundsEvent] = useState<HostedEvent | null>(null);
  const [standings, setStandings] = useState<HostedEventStandingRow[]>([]);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [creatingRound, setCreatingRound] = useState(false);
  const [roundBusyId, setRoundBusyId] = useState<string | null>(null);
  const [matchDraft, setMatchDraft] = useState<Record<string, { participantAId: string; participantBId: string; tableNumber: string }>>({});
  const [creatingMatchRoundId, setCreatingMatchRoundId] = useState<string | null>(null);
  const [matchBusyId, setMatchBusyId] = useState<string | null>(null);

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

  const refreshRoundsEvent = async (id: string) => {
    const [fresh, standingsResult] = await Promise.all([api.getHostedEvent(id), api.getHostedEventStandings(id)]);
    setRoundsEvent(fresh);
    setStandings(standingsResult);
    setEvents((current) => current.map((item) => (item.id === id ? fresh : item)));
  };

  const openRounds = async (event: HostedEvent) => {
    setMatchDraft({});
    setRoundsEvent(event);
    setLoadingStandings(true);
    try {
      await refreshRoundsEvent(event.id);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao carregar rodadas.");
    } finally {
      setLoadingStandings(false);
    }
  };

  const addRound = async () => {
    if (!roundsEvent) return;
    setCreatingRound(true);
    try {
      await api.createHostedEventRound(roundsEvent.id);
      await refreshRoundsEvent(roundsEvent.id);
      toast.success("Rodada criada.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar rodada.");
    } finally {
      setCreatingRound(false);
    }
  };

  const updateRoundStatus = async (round: HostedEventRound, status: HostedEventRound["status"]) => {
    if (!roundsEvent) return;
    setRoundBusyId(round.id);
    try {
      await api.updateHostedEventRound(roundsEvent.id, round.id, status);
      await refreshRoundsEvent(roundsEvent.id);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar a rodada.");
    } finally {
      setRoundBusyId(null);
    }
  };

  const deleteRound = async (round: HostedEventRound) => {
    if (!roundsEvent) return;
    if (!window.confirm(`Remover a rodada ${round.roundNumber}? Só é possível se nenhum resultado tiver sido lançado.`)) return;
    setRoundBusyId(round.id);
    try {
      await api.deleteHostedEventRound(roundsEvent.id, round.id);
      await refreshRoundsEvent(roundsEvent.id);
      toast.success("Rodada removida.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover a rodada.");
    } finally {
      setRoundBusyId(null);
    }
  };

  const setDraftField = (roundId: string, field: "participantAId" | "participantBId" | "tableNumber", value: string) => {
    setMatchDraft((current) => ({
      ...current,
      [roundId]: { participantAId: "", participantBId: "", tableNumber: "", ...current[roundId], [field]: value },
    }));
  };

  const createMatch = async (round: HostedEventRound) => {
    if (!roundsEvent) return;
    const draft = matchDraft[round.id];
    if (!draft?.participantAId) { toast.error("Escolha o participante A."); return; }
    if (draft.participantBId && draft.participantAId === draft.participantBId) { toast.error("Os dois participantes precisam ser diferentes."); return; }
    setCreatingMatchRoundId(round.id);
    try {
      await api.createHostedEventMatch(roundsEvent.id, round.id, {
        participantAId: draft.participantAId,
        participantBId: draft.participantBId || null,
        tableNumber: draft.tableNumber ? Number(draft.tableNumber) : null,
      });
      setMatchDraft((current) => ({ ...current, [round.id]: { participantAId: "", participantBId: "", tableNumber: "" } }));
      await refreshRoundsEvent(roundsEvent.id);
      toast.success("Confronto adicionado.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao adicionar confronto.");
    } finally {
      setCreatingMatchRoundId(null);
    }
  };

  const reportResult = async (round: HostedEventRound, match: HostedEventMatch, result: HostedEventMatchResult) => {
    if (!roundsEvent) return;
    setMatchBusyId(match.id);
    try {
      await api.reportHostedEventMatchResult(roundsEvent.id, round.id, match.id, result);
      await refreshRoundsEvent(roundsEvent.id);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao lançar o resultado.");
    } finally {
      setMatchBusyId(null);
    }
  };

  const deleteMatch = async (round: HostedEventRound, match: HostedEventMatch) => {
    if (!roundsEvent) return;
    if (!window.confirm("Remover este confronto?")) return;
    setMatchBusyId(match.id);
    try {
      await api.deleteHostedEventMatch(roundsEvent.id, round.id, match.id);
      await refreshRoundsEvent(roundsEvent.id);
      toast.success("Confronto removido.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover confronto.");
    } finally {
      setMatchBusyId(null);
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
                  <Button variant="outline" className="rounded-none" onClick={() => openRounds(event)}><Swords className="mr-2 size-4" />Rodadas{event.rounds ? ` (${event.rounds.length})` : ""}</Button>
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

      <Dialog open={Boolean(roundsEvent)} onOpenChange={(open) => { if (!open) setRoundsEvent(null); }}>
        <DialogContent className="panel-cut max-h-[85vh] max-w-3xl overflow-y-auto rounded-none surface-panel">
          <DialogHeader>
            <DialogTitle>Rodadas & resultados{roundsEvent ? ` — ${roundsEvent.name}` : ""}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500"><Trophy className="size-3.5" />Classificação</p>
            {loadingStandings ? <p className="text-sm text-muted-portal">Carregando...</p> : null}
            {!loadingStandings && !standings.length ? <p className="text-sm text-muted-portal">Nenhum ponto lançado ainda.</p> : null}
            {standings.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-500 uppercase tracking-wide">
                      <th className="py-1 pr-2">Jogador</th>
                      <th className="px-2">Pts</th>
                      <th className="px-2">V</th>
                      <th className="px-2">E</th>
                      <th className="px-2">D</th>
                      <th className="px-2">Byes</th>
                      <th className="px-2">Jogos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, index) => (
                      <tr key={row.participantId} className="border-t border-primary/10">
                        <td className="py-1.5 pr-2 text-soft">{index + 1}. {row.user.displayName}</td>
                        <td className="px-2 font-semibold text-primary">{row.points}</td>
                        <td className="px-2">{row.wins}</td>
                        <td className="px-2">{row.draws}</td>
                        <td className="px-2">{row.losses}</td>
                        <td className="px-2">{row.byes}</td>
                        <td className="px-2">{row.played}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Rodadas ({roundsEvent?.rounds?.length ?? 0})</p>
              <Button variant="outline" className="rounded-none" disabled={creatingRound} onClick={addRound}><Plus className="mr-2 size-4" />Nova rodada</Button>
            </div>

            {!roundsEvent?.rounds?.length ? (
              <p className="text-sm text-muted-portal">Nenhuma rodada criada ainda.</p>
            ) : (
              <div className="space-y-4">
                {roundsEvent.rounds.map((round) => {
                  const pairedIds = new Set(round.matches.flatMap((m) => [m.participantAId, m.participantBId].filter(Boolean) as string[]));
                  const available = (roundsEvent.participants || []).filter((p) => !pairedIds.has(p.id));
                  const draft = matchDraft[round.id] || { participantAId: "", participantBId: "", tableNumber: "" };
                  return (
                    <div key={round.id} className="panel-cut border border-primary/20 bg-black/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-soft">Rodada {round.roundNumber}</p>
                        <div className="flex items-center gap-2">
                          <select
                            value={round.status}
                            disabled={roundBusyId === round.id}
                            onChange={(e) => updateRoundStatus(round, e.target.value as HostedEventRound["status"])}
                            className="field-shell h-8 px-2 text-xs"
                          >
                            {(Object.keys(ROUND_STATUS_LABEL) as HostedEventRound["status"][]).map((status) => <option key={status} value={status}>{ROUND_STATUS_LABEL[status]}</option>)}
                          </select>
                          <Button variant="outline" className="rounded-none text-red-400 hover:text-red-300" disabled={roundBusyId === round.id} onClick={() => deleteRound(round)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2 space-y-1.5">
                        {!round.matches.length ? <p className="text-xs text-muted-portal">Nenhum confronto montado nesta rodada.</p> : null}
                        {round.matches.map((match) => (
                          <div key={match.id} className="flex flex-wrap items-center justify-between gap-2 border border-primary/10 bg-black/10 px-3 py-2">
                            <div className="text-xs text-soft">
                              {match.tableNumber ? <span className="mr-2 text-muted-portal">Mesa {match.tableNumber}</span> : null}
                              <span>{match.participantA.user.displayName}</span>
                              {match.participantB ? <span> vs {match.participantB.user.displayName}</span> : <span className="text-muted-portal"> (bye)</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {match.participantB ? (
                                <select
                                  value={match.result}
                                  disabled={matchBusyId === match.id}
                                  onChange={(e) => reportResult(round, match, e.target.value as HostedEventMatchResult)}
                                  className="field-shell h-8 px-2 text-xs"
                                >
                                  {(["PENDING", "PLAYER_A_WIN", "PLAYER_B_WIN", "DRAW"] as HostedEventMatchResult[]).map((result) => <option key={result} value={result}>{MATCH_RESULT_LABEL[result]}</option>)}
                                </select>
                              ) : (
                                <Badge variant="outline" className="rounded-none border-primary/40 text-primary">{MATCH_RESULT_LABEL.BYE}</Badge>
                              )}
                              <Button variant="outline" className="rounded-none text-red-400 hover:text-red-300" disabled={matchBusyId === match.id} onClick={() => deleteMatch(round, match)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-primary/10 pt-3">
                        <select value={draft.participantAId} onChange={(e) => setDraftField(round.id, "participantAId", e.target.value)} className="field-shell h-9 px-2 text-xs">
                          <option value="">Participante A</option>
                          {available.map((p) => <option key={p.id} value={p.id}>{p.user.displayName}</option>)}
                        </select>
                        <select value={draft.participantBId} onChange={(e) => setDraftField(round.id, "participantBId", e.target.value)} className="field-shell h-9 px-2 text-xs">
                          <option value="">Bye (sem adversário)</option>
                          {available.filter((p) => p.id !== draft.participantAId).map((p) => <option key={p.id} value={p.id}>{p.user.displayName}</option>)}
                        </select>
                        <Input value={draft.tableNumber} onChange={(e) => setDraftField(round.id, "tableNumber", e.target.value)} type="number" min={0} placeholder="Mesa" className="h-9 w-20 rounded-none text-xs" />
                        <Button variant="outline" className="rounded-none" disabled={creatingMatchRoundId === round.id} onClick={() => createMatch(round)}>
                          <Plus className="mr-2 size-4" />Adicionar confronto
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="rounded-none" onClick={() => setRoundsEvent(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PortalShell>
  );
}

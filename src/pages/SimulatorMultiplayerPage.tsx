/* Arena Multiplayer 4P real (Fase 3 / Terminal 2) — substitui a antiga tela estática "Bloqueado"
 * por uma arquitetura Socket.io de verdade (`socketClient4p.ts` + `server/simulatorSocket4p.ts`).
 * Cada duelo da Arena ("lane") é uma partida REAL do motor 1v1 (ver `arena4pStore.ts` — o
 * motor em `engine/` nunca é tocado); quando o assento tem uma lane ativa, esta página EMBUTE
 * o `SimulatorMatchPage` já existente (mesmo componente da rota 1v1) pra jogar o duelo de
 * verdade, com o radar tático/chat/emotes da Arena sobrepostos como HUD flutuante. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Copy,
  Crown,
  Flame,
  Layers,
  MessageSquare,
  Radar,
  Send,
  Shield,
  ShieldAlert,
  Swords,
  Users,
} from "lucide-react";

import { PublicShell } from "@/components/layout/PublicShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { SIMULATOR_DECK_PRESETS } from "@/modules/simulator/content/simulatorDeckPresets";
import {
  ARENA_SEAT_IDS,
  arena4pSocket,
  type ArenaChatEntry,
  type ArenaLane,
  type ArenaLobby,
  type ArenaMode,
  type ArenaRadarEntry,
  type ArenaSeatId,
  type ArenaWinner,
} from "@/modules/simulator/network/socketClient4p";
import SimulatorMatchPage from "@/pages/SimulatorMatchPage";
import { useSiteLanguage, type Localized } from "@/i18n/siteLanguage";

const SESSION_KEY = "portal-gundam-tcg-br:arena4p-session";

const EMOTES: Array<{ id: string; label: Localized; icon: string }> = [
  { id: "attack", label: { pt: "Ataque!", en: "Attack!" }, icon: "⚔️" },
  { id: "defend", label: { pt: "Defenda!", en: "Defend!" }, icon: "🛡️" },
  { id: "nice", label: { pt: "Boa!", en: "Nice!" }, icon: "👍" },
  { id: "gg", label: { pt: "GG!", en: "GG!" }, icon: "🤝" },
];

const SEAT_LABEL: Record<ArenaSeatId, Localized> = {
  seatA: { pt: "Assento A", en: "Seat A" },
  seatB: { pt: "Assento B", en: "Seat B" },
  seatC: { pt: "Assento C", en: "Seat C" },
  seatD: { pt: "Assento D", en: "Seat D" },
};

interface SessionState {
  mode: ArenaMode;
  deckId: string;
  lobbyId?: string;
  arenaMatchId?: string;
}

function loadSession(): SessionState {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) return { mode: "2v2", deckId: SIMULATOR_DECK_PRESETS[0]?.key ?? "ST01", ...JSON.parse(raw) };
  } catch {
    // sessionStorage indisponível — segue com o default
  }
  return { mode: "2v2", deckId: SIMULATOR_DECK_PRESETS[0]?.key ?? "ST01" };
}
function saveSession(next: Partial<SessionState>): void {
  try {
    const current = loadSession();
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...next }));
  } catch {
    // ignora — pior caso, perde o retorno automático num reload
  }
}
function clearSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // no-op
  }
}

export default function SimulatorMultiplayerPage() {
  const { tr } = useSiteLanguage();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [initialSession] = useState(() => loadSession());

  const [mode, setMode] = useState<ArenaMode>(initialSession.mode);
  const [deckId, setDeckId] = useState<string>(initialSession.deckId);
  const [connStatus, setConnStatus] = useState(arena4pSocket.getStatus());

  const [lobby, setLobby] = useState<ArenaLobby | null>(null);
  const [queueStatus, setQueueStatus] = useState<{ inQueue: boolean; position: number }>({ inQueue: false, position: 0 });
  const [squadCode, setSquadCode] = useState<string | null>(null);
  const [squadCodeInput, setSquadCodeInput] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [arenaMatchId, setArenaMatchId] = useState<string | null>(initialSession.arenaMatchId ?? null);
  const [myLane, setMyLane] = useState<ArenaLane | null>(null);
  const [radar, setRadar] = useState<Record<ArenaSeatId, ArenaRadarEntry> | null>(null);
  const [chat, setChat] = useState<ArenaChatEntry[]>([]);
  const [winner, setWinner] = useState<ArenaWinner | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [lastEmote, setLastEmote] = useState<{ seat: ArenaSeatId; icon: string } | null>(null);

  const mySeat = useMemo<ArenaSeatId | undefined>(() => {
    if (!user || !lobby) return undefined;
    return ARENA_SEAT_IDS.find((s) => lobby.seats[s]?.userId === user.id);
  }, [lobby, user]);

  // --- Conexão + listeners globais do socket 4P. ---
  useEffect(() => {
    arena4pSocket.connect();
    const offs = [
      arena4pSocket.on("status", setConnStatus),
      arena4pSocket.on("arena:lobby_update", (l) => {
        setLobby(l);
        if (l.arenaMatchId) {
          setArenaMatchId(l.arenaMatchId);
          saveSession({ lobbyId: undefined, arenaMatchId: l.arenaMatchId });
          arena4pSocket.joinArenaMatch(l.arenaMatchId);
        } else {
          saveSession({ lobbyId: l.id, arenaMatchId: undefined });
        }
      }),
      arena4pSocket.on("arena:lobby_closed", () => {
        setLobby(null);
        clearSession();
      }),
      arena4pSocket.on("arena:queue_status", setQueueStatus),
      arena4pSocket.on("arena:view_update", (payload) => {
        // O socket só recebe isto na room do assento da Arena em que está — sempre relevante.
        setMyLane(payload.lane);
      }),
      arena4pSocket.on("arena:radar_update", (payload) => setRadar(payload.radar)),
      arena4pSocket.on("arena:lane_result", (payload) => {
        setMyLane((prev) => (prev?.id === payload.lane.id ? payload.lane : prev));
      }),
      arena4pSocket.on("arena:arena_over", (payload) => setWinner(payload.winner)),
      arena4pSocket.on("arena:chat", (payload) => setChat((prev) => [...prev.slice(-199), payload.entry])),
      arena4pSocket.on("arena:chat_backlog", (payload) => setChat(payload.entries)),
      arena4pSocket.on("arena:emote", (payload) => {
        setLastEmote({ seat: payload.seat, icon: EMOTES.find((e) => e.id === payload.emoteId)?.icon ?? "💬" });
        window.setTimeout(() => setLastEmote((cur) => (cur?.seat === payload.seat ? null : cur)), 2600);
      }),
      arena4pSocket.on("arena:error", (payload) => setErrorMsg(payload.message)),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  // --- Retoma sessão salva (lobby ou partida em andamento) ao montar/reconectar. ---
  useEffect(() => {
    if (connStatus !== "connected") return;
    const saved = loadSession();
    if (saved.arenaMatchId) arena4pSocket.joinArenaMatch(saved.arenaMatchId);
    else if (saved.lobbyId) arena4pSocket.joinLobbyRoom(saved.lobbyId);
  }, [connStatus]);

  // --- Heartbeat de presença enquanto há um duelo ativo. ---
  useEffect(() => {
    if (!arenaMatchId || !myLane) return;
    const id = window.setInterval(() => arena4pSocket.ping(arenaMatchId), 15_000);
    return () => window.clearInterval(id);
  }, [arenaMatchId, myLane]);

  const handleQueue = useCallback(() => {
    setErrorMsg(null);
    setBusyAction("queue");
    arena4pSocket.joinArenaQueue(mode, deckId);
    saveSession({ mode, deckId });
    setBusyAction(null);
  }, [mode, deckId]);

  const handleCreateSquad = useCallback(async () => {
    setErrorMsg(null);
    setBusyAction("squad_create");
    try {
      const { lobbyId, squadCode: code } = await arena4pSocket.createSquad(mode, deckId);
      setSquadCode(code);
      saveSession({ mode, deckId, lobbyId });
      arena4pSocket.joinLobbyRoom(lobbyId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : tr("Não deu pra criar o esquadrão.", "Couldn't create the squad."));
    } finally {
      setBusyAction(null);
    }
  }, [mode, deckId]);

  const handleJoinSquad = useCallback(async () => {
    if (!squadCodeInput.trim()) return;
    setErrorMsg(null);
    setBusyAction("squad_join");
    try {
      const { lobbyId } = await arena4pSocket.joinSquad(squadCodeInput.trim(), deckId);
      saveSession({ deckId, lobbyId });
      arena4pSocket.joinLobbyRoom(lobbyId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : tr("Não deu pra entrar no esquadrão.", "Couldn't join the squad."));
    } finally {
      setBusyAction(null);
    }
  }, [squadCodeInput, deckId]);

  const handleLeaveLobby = useCallback(() => {
    if (lobby) arena4pSocket.leaveLobby(lobby.id);
    setLobby(null);
    setSquadCode(null);
    clearSession();
  }, [lobby]);

  const handleReady = useCallback(
    (ready: boolean) => {
      if (lobby) arena4pSocket.setReady(lobby.id, ready);
    },
    [lobby],
  );

  const handleExitArena = useCallback(() => {
    clearSession();
    setLobby(null);
    setArenaMatchId(null);
    setMyLane(null);
    setRadar(null);
    setChat([]);
    setWinner(null);
    navigate("/simulador");
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // Tela 3: Arena ativa — embute o duelo real (`SimulatorMatchPage`) quando há
  // lane ativa; senão mostra o painel de visão tática (radar + chat + resultado).
  // ---------------------------------------------------------------------------
  if (arenaMatchId) {
    return (
      <>
        {myLane ? <SimulatorMatchPage matchId={myLane.matchId} /> : null}

        {/* HUD tático flutuante — sempre por cima do duelo embutido (z-index alto). */}
        <div className={`fixed z-[200] ${overviewOpen ? "inset-0" : "bottom-3 right-3"}`}>
          {overviewOpen ? (
            <div className="flex h-full w-full flex-col bg-slate-950/92 p-4 backdrop-blur-md sm:p-6">
              <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 overflow-y-auto">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Radar className="size-5 text-violet-400" />
                    <h1 className="font-heading text-2xl uppercase tracking-wide text-white">
                      {mode === "2v2" ? tr("Radar Tático · 2v2 Tag Team", "Tactical Radar · 2v2 Tag Team") : tr("Radar Tático · Battle Royale", "Tactical Radar · Battle Royale")}
                    </h1>
                  </div>
                  <div className="flex items-center gap-2">
                    {myLane ? (
                      <Button size="sm" className="rounded-arena bg-violet-600 hover:bg-violet-700" onClick={() => setOverviewOpen(false)}>
                        <Swords className="mr-1.5 size-3.5" /> {tr("Voltar ao duelo", "Back to the duel")}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" className="rounded-arena border-white/20" onClick={handleExitArena}>
                      <ArrowLeft className="mr-1.5 size-3.5" /> {tr("Sair da Arena", "Leave the Arena")}
                    </Button>
                  </div>
                </div>

                {winner ? <ArenaResultBanner winner={winner} mySeat={mySeat} /> : null}

                {radar ? <RadarGrid radar={radar} mySeat={mySeat} /> : <p className="text-sm text-slate-400">{tr("Sincronizando radar...", "Syncing radar...")}</p>}

                {!myLane && !winner ? (
                  <div className="rounded-none border border-violet-500/30 bg-violet-950/20 p-4 text-sm text-violet-200">
                    {tr("Seu duelo desta rodada terminou — aguardando o resultado da outra lane para decidir a próxima etapa.", "Your duel for this round is over — waiting for the other lane's result to decide what's next.")}
                  </div>
                ) : null}

                <ArenaChatPanel chat={chat} chatInput={chatInput} setChatInput={setChatInput} onSend={() => {
                  if (!chatInput.trim() || !arenaMatchId) return;
                  arena4pSocket.sendChat(arenaMatchId, chatInput);
                  setChatInput("");
                }} />

                <EmoteBar onEmote={(id) => arenaMatchId && arena4pSocket.sendEmote(arenaMatchId, id)} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOverviewOpen(true)}
              className="group relative flex flex-col gap-1 rounded-none border border-violet-500/50 bg-slate-950/90 p-3 text-left shadow-[0_0_30px_rgba(139,92,246,0.25)] backdrop-blur-md"
            >
              <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-violet-300">
                <Radar className="size-3.5" /> {tr("Visão tática", "Tactical view")}
              </span>
              {radar ? <MiniRadarBars radar={radar} mySeat={mySeat} /> : null}
              {lastEmote ? (
                <span className="absolute -top-8 right-0 rounded-full border border-white/20 bg-slate-900/95 px-2 py-1 text-lg shadow-lg">
                  {lastEmote.icon}
                </span>
              ) : null}
            </button>
          )}
        </div>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Tela 2: Lobby de 4 assentos (fila casou, esquadrão preenchendo, ready-check).
  // ---------------------------------------------------------------------------
  if (lobby) {
    const seatsFilled = ARENA_SEAT_IDS.filter((s) => lobby.seats[s]).length;
    return (
      <PublicShell breadcrumbs={[{ label: "Simulador", href: "/simulador" }, { label: "Arena Multiplayer" }]}>
        <div className="mx-auto w-full max-w-2xl space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-violet-400 font-semibold flex items-center gap-1.5">
                <Users className="size-3.5" /> {tr("Sala de Esquadrão", "Squad Room")} · {lobby.mode === "2v2" ? "2v2 Tag Team" : "Battle Royale"}
              </p>
              <h1 className="mt-1.5 font-heading text-3xl uppercase text-white heading-portal">{tr("Sala de Espera", "Waiting Room")}</h1>
            </div>
            <Button type="button" variant="outline" size="sm" className="rounded-arena border-white/20" onClick={handleLeaveLobby}>
              <ArrowLeft className="mr-1.5 size-3.5" /> {tr("Sair", "Leave")}
            </Button>
          </div>

          {errorMsg ? <p className="rounded-none border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-300">{errorMsg}</p> : null}

          {squadCode ? (
            <div className="flex items-center justify-between gap-3 rounded-none border border-violet-500/30 bg-violet-950/20 p-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300">{tr("Código de convite", "Invite code")}</p>
                <p className="font-mono text-xl text-white">{squadCode}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-arena border-white/20"
                onClick={() => navigator.clipboard?.writeText(squadCode).catch(() => undefined)}
              >
                <Copy className="mr-1.5 size-3.5" /> {tr("Copiar", "Copy")}
              </Button>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2.5">
            {ARENA_SEAT_IDS.map((seat) => {
              const occupant = lobby.seats[seat];
              const isMe = occupant?.userId === user?.id;
              return (
                <div
                  key={seat}
                  className={`rounded-none border p-3 ${occupant ? (occupant.ready ? "border-emerald-500/40 bg-emerald-950/20" : "border-white/15 bg-black/30") : "border-dashed border-white/10 bg-black/10"}`}
                >
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-portal">{tr(SEAT_LABEL[seat])}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">
                    {occupant ? `${occupant.displayName}${isMe ? tr(" (Você)", " (You)") : ""}` : tr("Vaga aberta...", "Open seat...")}
                  </p>
                  {occupant ? (
                    <span className={`mt-1 inline-block text-[10px] uppercase tracking-wide ${occupant.ready ? "text-emerald-400" : "text-slate-500"}`}>
                      {occupant.ready ? "Pronto" : "Aguardando"}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-400">{tr(`${seatsFilled}/4 pilotos na sala. A partida começa automaticamente quando os 4 estiverem prontos.`, `${seatsFilled}/4 players in the room. The match starts automatically when all 4 are ready.`)}</p>

          {mySeat ? (
            <Button
              type="button"
              className={`w-full rounded-arena ${lobby.seats[mySeat]?.ready ? "bg-slate-700 hover:bg-slate-600" : "bg-violet-600 hover:bg-violet-700"}`}
              onClick={() => handleReady(!lobby.seats[mySeat]?.ready)}
            >
              <Shield className="mr-2 size-4" /> {lobby.seats[mySeat]?.ready ? tr("Cancelar pronto", "Not ready") : tr("Estou pronto", "I'm ready")}
            </Button>
          ) : null}
        </div>
      </PublicShell>
    );
  }

  // ---------------------------------------------------------------------------
  // Tela 1: Configuração — modalidade, deck e como entrar (fila / esquadrão).
  // ---------------------------------------------------------------------------
  return (
    <PublicShell breadcrumbs={[{ label: "Simulador", href: "/simulador" }, { label: "Arena Multiplayer" }]}>
      <div className="relative mx-auto w-full max-w-[1720px] overflow-hidden rounded-2xl border border-violet-500/40 bg-slate-950 shadow-[0_0_60px_rgba(139,92,246,0.25)]">
        <div className="pointer-events-none absolute inset-0">
          <img loading="lazy" decoding="async"
            src="/images/multiplayer_total_war_arena.webp"
            alt={tr("Guerra Total no Espaço", "All-out war in space")}
            className="h-full w-full object-cover object-center opacity-95 brightness-105 contrast-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-transparent to-[#0b0f19]/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b0f19]/50 via-transparent to-[#0b0f19]/75" />
          <div className="absolute inset-0 bg-grid-tech opacity-10" />
        </div>

        <div className="relative z-10 flex min-h-[740px] items-center justify-center p-4 sm:p-6 lg:p-10">
          <div className="w-full max-w-xl space-y-6 rounded-xl border border-violet-500/40 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-md sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-violet-400 font-semibold flex items-center gap-1.5">
                  <Users className="size-3.5" /> {tr("Simulador · Partida para 4 jogadores", "Simulator · 4-player match")}
                </p>
                <h1 className="mt-1.5 font-heading text-3xl sm:text-4xl uppercase text-white heading-portal">Arena Multiplayer</h1>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-soft">
                  {tr("Confrontos táticos reais para 4 pilotos, via Socket.io — 2v2 Tag Team cooperativo ou Battle Royale free-for-all.", "Real-time matches for 4 players — cooperative 2v2 Tag Team or free-for-all Battle Royale.")}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-arena border-white/20 hover:bg-white/10" onClick={() => navigate("/simulador")}>
                <ArrowLeft className="mr-1.5 size-3.5" /> {tr("Voltar", "Back")}
              </Button>
            </div>

            {errorMsg ? <p className="rounded-none border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-300">{errorMsg}</p> : null}
            {connStatus !== "connected" ? (
              <p className="rounded-none border border-amber-500/30 bg-amber-950/20 p-2 text-xs text-amber-300">
                {tr("Conectando ao servidor da Arena...", "Connecting to the Arena server...")} ({connStatus})
              </p>
            ) : null}

            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{tr("Modalidade de Combate (4 Pilotos)", "Mode (4 players)")}</p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMode("2v2")}
                  className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${mode === "2v2" ? "border-violet-500 bg-violet-950/40 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.2)]" : "border-white/10 bg-black/30 text-soft"}`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm uppercase tracking-wider">
                    <Layers className="size-3.5 text-violet-400" /> {tr("2x2 Duplas", "2v2 Teams")}
                  </div>
                  <span className="text-[10px] text-muted-portal mt-0.5">{tr("Time A+C vs Time B+D — cooperação de esquadrão", "Team A+C vs Team B+D — squad play")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("ffa")}
                  className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${mode === "ffa" ? "border-violet-500 bg-violet-950/40 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.2)]" : "border-white/10 bg-black/30 text-soft"}`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm uppercase tracking-wider">
                    <Flame className="size-3.5 text-amber-400" /> Battle Royale
                  </div>
                  <span className="text-[10px] text-muted-portal mt-0.5">{tr("Todos contra todos — só um piloto sobra", "Free-for-all — only one player survives")}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{tr("Seu Deck de Combate", "Your Deck")}</p>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {SIMULATOR_DECK_PRESETS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDeckId(d.key)}
                    className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${deckId === d.key ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-white/10 bg-black/20 text-soft"}`}
                  >
                    {d.key}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <Button
                className="w-full rounded-arena bg-violet-600 text-white hover:bg-violet-700"
                disabled={busyAction !== null || connStatus !== "connected"}
                onClick={handleQueue}
              >
                <Swords className="mr-2 size-4" /> {queueStatus.inQueue ? tr(`Na fila... (${queueStatus.position}/4)`, `In queue... (${queueStatus.position}/4)`) : tr("Entrar na Fila Oficial 4P (FIFO Online)", "Join the official 4P queue (online)")}
              </Button>

              <Button
                variant="outline"
                className="w-full rounded-arena border-white/20"
                disabled={busyAction !== null || connStatus !== "connected"}
                onClick={handleCreateSquad}
              >
                <Users className="mr-2 size-4" /> {tr("Criar Esquadrão (Convite Direto 4P)", "Create Squad (4P direct invite)")}
              </Button>

              <div className="flex gap-2">
                <input
                  value={squadCodeInput}
                  onChange={(e) => setSquadCodeInput(e.target.value.toUpperCase())}
                  placeholder={tr("Código (ex: AR-4821)", "Code (e.g. AR-4821)")}
                  className="flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                />
                <Button variant="outline" className="rounded-arena border-white/20" disabled={busyAction !== null || !squadCodeInput.trim()} onClick={handleJoinSquad}>
                  {tr("Entrar", "Join")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

function RadarGrid({ radar, mySeat }: { radar: Record<ArenaSeatId, ArenaRadarEntry>; mySeat?: ArenaSeatId }) {
  const { tr } = useSiteLanguage();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ARENA_SEAT_IDS.map((seat) => {
        const entry = radar[seat];
        const pct = entry.maxShields > 0 ? Math.round((entry.shieldsRemaining / entry.maxShields) * 100) : 0;
        return (
          <div
            key={seat}
            className={`rounded-none border p-3 ${entry.eliminated ? "border-red-500/30 bg-red-950/10 opacity-60" : seat === mySeat ? "border-violet-500/50 bg-violet-950/20" : "border-white/10 bg-black/20"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-white">
                {entry.displayName} {seat === mySeat ? <span className="text-violet-400">{tr("(Você)", "(You)")}</span> : null}
              </p>
              {entry.eliminated ? (
                <Badge variant="outline" className="rounded-none border-red-500/40 text-[10px] text-red-300">{tr("Eliminado", "Eliminated")}</Badge>
              ) : (
                <Badge variant="outline" className="rounded-none border-white/15 text-[10px] text-slate-300">
                  {entry.laneStatus === "active" ? tr("Em combate", "In combat") : tr("Aguardando", "Waiting")}
                </Badge>
              )}
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/40">
              <div className={`h-full rounded-full transition-all ${pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{entry.shieldsRemaining}/{entry.maxShields} shields</p>
          </div>
        );
      })}
    </div>
  );
}

function MiniRadarBars({ radar, mySeat }: { radar: Record<ArenaSeatId, ArenaRadarEntry>; mySeat?: ArenaSeatId }) {
  return (
    <div className="flex gap-1.5">
      {ARENA_SEAT_IDS.map((seat) => {
        const entry = radar[seat];
        const pct = entry.maxShields > 0 ? Math.round((entry.shieldsRemaining / entry.maxShields) * 100) : 0;
        return (
          <div key={seat} className="flex h-10 w-3 flex-col-reverse overflow-hidden rounded-sm bg-black/50" title={`${entry.displayName}: ${entry.shieldsRemaining}/${entry.maxShields}`}>
            <div
              className={`w-full transition-all ${entry.eliminated ? "bg-red-900" : seat === mySeat ? "bg-violet-400" : pct > 40 ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ height: `${entry.eliminated ? 100 : pct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function ArenaResultBanner({ winner, mySeat }: { winner: ArenaWinner; mySeat?: ArenaSeatId }) {
  const { tr } = useSiteLanguage();
  const iWon = winner.kind === "seat" ? winner.seat === mySeat : undefined;
  return (
    <div className={`flex items-center gap-3 rounded-none border p-4 ${iWon === false ? "border-slate-500/30 bg-slate-900/40" : "border-amber-500/40 bg-amber-950/20"}`}>
      <Crown className="size-6 shrink-0 text-amber-400" />
      <div>
        <p className="font-heading text-xl uppercase text-white">
          {winner.kind === "team" ? tr(`Time ${winner.team} venceu a Arena!`, `Team ${winner.team} won the Arena!`) : tr("Battle Royale encerrada!", "Battle Royale over!")}
        </p>
        <p className="text-xs text-slate-300">
          {winner.kind === "team"
            ? winner.team === 1
              ? tr("Assentos A + C são os campeões do 2v2.", "Seats A + C are the 2v2 champions.")
              : tr("Assentos B + D são os campeões do 2v2.", "Seats B + D are the 2v2 champions.")
            : tr(`Campeão: ${tr(SEAT_LABEL[winner.seat!])}.`, `Champion: ${tr(SEAT_LABEL[winner.seat!])}.`)}
        </p>
      </div>
    </div>
  );
}

function ArenaChatPanel({
  chat,
  chatInput,
  setChatInput,
  onSend,
}: {
  chat: ArenaChatEntry[];
  chatInput: string;
  setChatInput: (v: string) => void;
  onSend: () => void;
}) {
  const { tr } = useSiteLanguage();
  return (
    <div className="flex flex-1 min-h-[220px] flex-col rounded-none border border-white/10 bg-black/30">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
        <MessageSquare className="size-3.5" /> {tr("Chat & Log de Combate", "Chat & Battle Log")}
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {chat.length === 0 ? <p className="text-xs text-slate-500">{tr("Sem mensagens ainda.", "No messages yet.")}</p> : null}
        {chat.map((entry) => (
          <p
            key={entry.id}
            className={`text-xs leading-relaxed ${entry.kind === "system" ? "text-violet-300 italic" : entry.kind === "combat" ? "text-amber-300" : "text-slate-200"}`}
          >
            {entry.kind === "chat" ? <span className="font-semibold text-white">{entry.displayName}: </span> : null}
            {entry.text}
          </p>
        ))}
      </div>
      <div className="flex gap-2 border-t border-white/10 p-2">
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder={tr("Mensagem para o esquadrão...", "Message your squad...")}
          maxLength={280}
          className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
        />
        <Button size="sm" className="rounded-arena bg-violet-600 hover:bg-violet-700" onClick={onSend}>
          <Send className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function EmoteBar({ onEmote }: { onEmote: (emoteId: string) => void }) {
  const { tr } = useSiteLanguage();
  return (
    <div className="flex flex-wrap gap-2">
      {EMOTES.map((emote) => (
        <button
          key={emote.id}
          type="button"
          onClick={() => onEmote(emote.id)}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white transition hover:bg-white/10"
        >
          <span className="text-base">{emote.icon}</span> {tr(emote.label)}
        </button>
      ))}
      <span className="flex items-center gap-1 self-center text-[10px] uppercase tracking-wide text-slate-500">
        <ShieldAlert className="size-3" /> {tr("Radial de emotes", "Emotes")}
      </span>
    </div>
  );
}

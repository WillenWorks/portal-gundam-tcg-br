import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import {
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  QrCode,
  Trophy,
  Swords,
  Play,
  Pause,
  RotateCcw,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TvMatchParticipant {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  archetype?: string | null;
  deckName?: string | null;
}

interface TvMatch {
  id: string;
  tableNumber?: number | null;
  result: "PENDING" | "PLAYER_A_WIN" | "PLAYER_B_WIN" | "DRAW" | "BYE";
  reportedAt?: string | null;
  participantA: TvMatchParticipant;
  participantB?: TvMatchParticipant | null;
}

interface TvRound {
  id: string;
  roundNumber: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  matches: TvMatch[];
}

interface TvStanding {
  participantId: string;
  rank: number;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  hasDeck: boolean;
  archetype?: string | null;
  colors: string[];
  points: number;
  wins: number;
  draws: number;
  losses: number;
  byes: number;
  played: number;
  omwPercent: number;
  ogwPercent: number;
  gameWinRate: number;
  matchWinRate: number;
}

interface TvEventData {
  event: {
    id: string;
    name: string;
    description?: string | null;
    venueName?: string | null;
    city?: string | null;
    country?: string | null;
    format: string;
    status: string;
    dateStart: string;
    dateEnd?: string | null;
    maxPlayers?: number | null;
    hoster?: { id: string; username: string; displayName: string };
  };
  currentRound: TvRound | null;
  totalRounds: number;
  standings: TvStanding[];
  participantsCount: number;
}

class TournamentAudio {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  constructor() {
    this.isMuted = localStorage.getItem("gundam_tv_audio_muted") === "true";
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem("gundam_tv_audio_muted", String(this.isMuted));
    return this.isMuted;
  }

  private ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playBeep(freq = 880, duration = 0.12) {
    if (this.isMuted) return;
    try {
      this.ensureContext();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Safe fallback
    }
  }

  playBuzzer() {
    if (this.isMuted) return;
    try {
      this.ensureContext();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sawtooth";
      osc2.type = "square";
      osc1.frequency.setValueAtTime(180, t);
      osc2.frequency.setValueAtTime(270, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.setValueAtTime(0.2, t + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 1.8);
      osc2.stop(t + 1.8);
    } catch {
      // Safe fallback
    }
  }
}

const audioPlayer = new TournamentAudio();
const DEFAULT_ROUND_SECONDS = 50 * 60; // 50 minutos oficiais

interface LgsTvDisplayPageProps {
  eventId?: string;
}

export function LgsTvDisplayPage({ eventId: propEventId }: LgsTvDisplayPageProps = {}) {
  const [, paramsA] = useRoute<{ id: string }>("/eventos/:id/tv");
  const [, paramsB] = useRoute<{ id: string }>("/organizador/eventos/:id/tv");
  const eventId = propEventId || paramsA?.id || paramsB?.id;
  const [data, setData] = useState<TvEventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [activeTab, setActiveTab] = useState<"pairings" | "standings">("pairings");
  const [autoCycle, setAutoCycle] = useState(true);
  const [cycleProgress, setCycleProgress] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(audioPlayer.isMuted);

  // Timer state
  const [secondsRemaining, setSecondsRemaining] = useState(DEFAULT_ROUND_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);
  const prevSecondsRef = useRef(secondsRemaining);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Fetch Event Data
  const fetchData = async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/hosted-events/${eventId}/tv`);
      if (!res.ok) {
        throw new Error("Não foi possível carregar os dados do evento.");
      }
      const json = (await res.json()) as TvEventData;
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Erro de conexão ao buscar dados da TV.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Polling a cada 10s
    return () => clearInterval(interval);
  }, [eventId]);

  // Timer Tick
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          audioPlayer.playBuzzer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  // Timer Sound Alerts
  useEffect(() => {
    if (!timerRunning) return;
    // Beep nos últimos 10 segundos
    if (secondsRemaining <= 10 && secondsRemaining > 0) {
      audioPlayer.playBeep(880, 0.1);
    } else if (secondsRemaining === 600 && prevSecondsRef.current > 600) {
      // 10 minutos
      audioPlayer.playBeep(660, 0.3);
    } else if (secondsRemaining === 300 && prevSecondsRef.current > 300) {
      // 5 minutos
      audioPlayer.playBeep(770, 0.3);
    } else if (secondsRemaining === 60 && prevSecondsRef.current > 60) {
      // 1 minuto
      audioPlayer.playBeep(990, 0.4);
    }
    prevSecondsRef.current = secondsRemaining;
  }, [secondsRemaining, timerRunning]);

  // Auto Cycle between Pairings and Standings (20 seconds cycle)
  useEffect(() => {
    if (!autoCycle) return;
    const CYCLE_TIME_MS = 20000;
    const STEP_MS = 200;
    const stepIncrement = (STEP_MS / CYCLE_TIME_MS) * 100;

    const interval = setInterval(() => {
      setCycleProgress((curr) => {
        if (curr >= 100) {
          setActiveTab((prev) => (prev === "pairings" ? "standings" : "pairings"));
          return 0;
        }
        return curr + stepIncrement;
      });
    }, STEP_MS);

    return () => clearInterval(interval);
  }, [autoCycle]);

  // Formatting helpers
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getTimerColor = () => {
    if (secondsRemaining === 0) return "text-red-500 animate-pulse";
    if (secondsRemaining <= 120) return "text-red-400";
    if (secondsRemaining <= 600) return "text-amber-400";
    return "text-emerald-400";
  };

  const checkinUrl = typeof window !== "undefined" && eventId ? `${window.location.origin}/eventos/${eventId}/checkin` : "";

  if (loading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center space-y-4">
          <RefreshCw className="mx-auto size-10 animate-spin text-primary" />
          <p className="font-heading uppercase tracking-widest text-lg">Carregando Painel LGS TV...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md rounded-none border border-red-500/30 bg-red-950/20 p-8 text-center space-y-4">
          <ShieldAlert className="mx-auto size-12 text-red-400" />
          <h2 className="font-heading text-2xl uppercase">Erro ao Carregar Painel</h2>
          <p className="text-sm text-slate-400">{error}</p>
          <Button onClick={fetchData} className="rounded-none bg-primary text-primary-foreground">
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  const { event, currentRound, totalRounds, standings, participantsCount } = data!;

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col select-none font-sans overflow-x-hidden">
      {/* Auto-cycle progress bar */}
      {autoCycle && (
        <div className="h-1 w-full bg-slate-900 fixed top-0 left-0 z-50">
          <div
            className="h-full bg-cyan-400 transition-all duration-200"
            style={{ width: `${cycleProgress}%` }}
          />
        </div>
      )}

      {/* TOP HEADER BAR */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="border-l-4 border-cyan-400 pl-3">
            <span className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-semibold block">
              {event.venueName || "Gundam Card Game TCG"} · {event.city || "Brasil"}
            </span>
            <h1 className="font-heading text-2xl md:text-3xl uppercase tracking-wider font-black text-white">
              {event.name}
            </h1>
          </div>
          <Badge
            variant="outline"
            className="rounded-none border-cyan-500/40 bg-cyan-950/30 text-cyan-300 uppercase px-2.5 py-1 text-xs"
          >
            {currentRound ? `Rodada ${currentRound.roundNumber} / ${totalRounds}` : "Aguardando Início"}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-none border-slate-700 bg-slate-900/60 text-slate-300 text-xs uppercase px-2 py-1"
          >
            {participantsCount} Jogadores
          </Badge>
        </div>

        {/* TIMER & CONTROLS */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-none">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 block font-semibold">
                Tempo de Rodada
              </span>
              <div className={`font-mono text-4xl md:text-5xl font-black tracking-tight ${getTimerColor()}`}>
                {formatTime(secondsRemaining)}
              </div>
            </div>

            <div className="flex flex-col gap-1 border-l border-slate-800 pl-3">
              <button
                onClick={() => setTimerRunning(!timerRunning)}
                title={timerRunning ? "Pausar Cronômetro" : "Iniciar Cronômetro"}
                className={`p-1.5 transition-colors rounded ${
                  timerRunning
                    ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                }`}
              >
                {timerRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <button
                onClick={() => {
                  setTimerRunning(false);
                  setSecondsRemaining(DEFAULT_ROUND_SECONDS);
                }}
                title="Resetar (50 min)"
                className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded"
              >
                <RotateCcw className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <button
                onClick={() => setSecondsRemaining((s) => s + 300)}
                title="+5 minutos"
                className="px-1.5 py-0.5 text-[11px] font-mono font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 rounded"
              >
                +5m
              </button>
              <button
                onClick={() => setSecondsRemaining((s) => Math.max(0, s - 300))}
                title="-5 minutos"
                className="px-1.5 py-0.5 text-[11px] font-mono font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 rounded"
              >
                -5m
              </button>
            </div>
          </div>

          {/* DISPLAY TOGGLE CONTROLS */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const muted = audioPlayer.toggleMute();
                setIsMuted(muted);
              }}
              className={`p-2.5 border rounded-none transition-colors ${
                isMuted
                  ? "border-red-500/40 text-red-400 bg-red-950/20 hover:bg-red-950/40"
                  : "border-slate-700 text-slate-300 bg-slate-900 hover:bg-slate-800"
              }`}
              title={isMuted ? "Áudio Silenciado (clique para ativar)" : "Áudio Ativo"}
            >
              {isMuted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>

            <button
              onClick={() => setQrOpen(true)}
              className="flex items-center gap-2 px-3 py-2 border border-cyan-500/40 bg-cyan-950/20 text-cyan-300 hover:bg-cyan-900/30 rounded-none text-xs uppercase font-semibold"
              title="Abrir QR Code de Check-in"
            >
              <QrCode className="size-4" />
              <span className="hidden sm:inline">Check-in</span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2.5 border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-none"
              title="Tela Cheia"
            >
              {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* SECONDARY BAR: VIEW TOGGLES & AUTO-CYCLE */}
      <div className="bg-slate-900/40 border-b border-slate-800/60 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("pairings")}
            className={`flex items-center gap-2 px-4 py-2 font-heading uppercase text-sm tracking-wider font-bold transition-all rounded-none border ${
              activeTab === "pairings"
                ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20"
                : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            <Swords className="size-4" />
            Confrontos por Mesa
          </button>

          <button
            onClick={() => setActiveTab("standings")}
            className={`flex items-center gap-2 px-4 py-2 font-heading uppercase text-sm tracking-wider font-bold transition-all rounded-none border ${
              activeTab === "standings"
                ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20"
                : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            <Trophy className="size-4" />
            Classificação Suíça
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-white">
            <input
              type="checkbox"
              checked={autoCycle}
              onChange={(e) => {
                setAutoCycle(e.target.checked);
                setCycleProgress(0);
              }}
              className="accent-cyan-500 size-4"
            />
            <span>Auto-Alternar telas (20s)</span>
          </label>

          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-300 py-1"
            title="Atualizar dados agora"
          >
            <RefreshCw className="size-3.5" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6">
        {activeTab === "pairings" ? (
          <div className="space-y-6">
            {!currentRound || !currentRound.matches.length ? (
              <div className="py-24 text-center space-y-3 bg-slate-900/20 border border-slate-800/80">
                <Swords className="mx-auto size-16 text-slate-700" />
                <p className="font-heading text-2xl uppercase tracking-wider text-slate-400">
                  Nenhum confronto gerado no momento
                </p>
                <p className="text-sm text-slate-500">
                  O organizador irá lançar os pareamentos da próxima rodada em breve.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {currentRound.matches.map((match) => {
                  const isAWin = match.result === "PLAYER_A_WIN";
                  const isBWin = match.result === "PLAYER_B_WIN";
                  const isDraw = match.result === "DRAW";
                  const isBye = match.result === "BYE";

                  return (
                    <div
                      key={match.id}
                      className="bg-slate-900/70 border border-slate-800 hover:border-cyan-500/40 transition-colors p-4 rounded-none flex flex-col justify-between"
                    >
                      {/* TABLE BADGE & STATUS */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-cyan-500/10 text-cyan-400 font-mono font-black text-sm uppercase px-2.5 py-0.5 border border-cyan-500/30">
                            Mesa {String(match.tableNumber || 1).padStart(2, "0")}
                          </span>
                        </div>
                        <div>
                          {match.result === "PENDING" ? (
                            <span className="text-xs uppercase tracking-wider font-semibold text-amber-400 bg-amber-950/30 border border-amber-500/30 px-2 py-0.5">
                              Em Disputa
                            </span>
                          ) : isBye ? (
                            <span className="text-xs uppercase tracking-wider font-bold text-cyan-400 bg-cyan-950/30 border border-cyan-500/30 px-2 py-0.5">
                              BYE (Vitória Auto)
                            </span>
                          ) : isDraw ? (
                            <span className="text-xs uppercase tracking-wider font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5">
                              Empate
                            </span>
                          ) : (
                            <span className="text-xs uppercase tracking-wider font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-2 py-0.5">
                              Concluído
                            </span>
                          )}
                        </div>
                      </div>

                      {/* PLAYERS CONFRONTATION */}
                      <div className="space-y-3">
                        {/* PLAYER A */}
                        <div
                          className={`p-3 border transition-colors flex items-center justify-between ${
                            isAWin
                              ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                              : "bg-slate-950/60 border-slate-800/80 text-white"
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="size-9 shrink-0 bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                              {match.participantA.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <p className="font-heading font-black text-base md:text-lg uppercase tracking-wide truncate">
                                {match.participantA.displayName}
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                {match.participantA.deckName || match.participantA.archetype || "Deck Registrado"}
                              </p>
                            </div>
                          </div>
                          {isAWin && (
                            <Badge className="bg-emerald-500 text-slate-950 font-bold uppercase rounded-none text-[10px]">
                              Vitória
                            </Badge>
                          )}
                        </div>

                        {/* VS DIVIDER */}
                        <div className="text-center font-mono font-black text-xs text-slate-600 uppercase tracking-widest">
                          VS
                        </div>

                        {/* PLAYER B OR BYE */}
                        {match.participantB ? (
                          <div
                            className={`p-3 border transition-colors flex items-center justify-between ${
                              isBWin
                                ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                                : "bg-slate-950/60 border-slate-800/80 text-white"
                            }`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="size-9 shrink-0 bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                                {match.participantB.displayName.charAt(0).toUpperCase()}
                              </div>
                              <div className="truncate">
                                <p className="font-heading font-black text-base md:text-lg uppercase tracking-wide truncate">
                                  {match.participantB.displayName}
                                </p>
                                <p className="text-xs text-slate-400 truncate">
                                  {match.participantB.deckName || match.participantB.archetype || "Deck Registrado"}
                                </p>
                              </div>
                            </div>
                            {isBWin && (
                              <Badge className="bg-emerald-500 text-slate-950 font-bold uppercase rounded-none text-[10px]">
                                Vitória
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 border border-dashed border-slate-800 bg-slate-950/30 text-slate-500 text-center text-sm uppercase tracking-wider font-semibold">
                            BYE (Sem Adversário)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* STANDINGS TABLE */
          <div className="bg-slate-900/60 border border-slate-800 rounded-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-xs font-mono uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-4 w-16 text-center">Rank</th>
                    <th className="py-3 px-4">Jogador</th>
                    <th className="py-3 px-4">Deck / Arquétipo</th>
                    <th className="py-3 px-4 text-center font-bold text-cyan-400">Pontos</th>
                    <th className="py-3 px-4 text-center font-mono">V - D - E</th>
                    <th className="py-3 px-4 text-right font-mono" title="Opponent Match Win %">OMW%</th>
                    <th className="py-3 px-4 text-right font-mono" title="Game Win %">GW%</th>
                    <th className="py-3 px-4 text-right font-mono" title="Opponent Game Win %">OGW%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {standings.map((row) => {
                    const isTop4 = row.rank <= 4;
                    const isTop8 = row.rank <= 8;

                    return (
                      <tr
                        key={row.participantId}
                        className={`transition-colors hover:bg-slate-800/40 ${
                          isTop4
                            ? "bg-amber-500/[0.03]"
                            : isTop8
                            ? "bg-cyan-500/[0.02]"
                            : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center font-mono font-black">
                          <span
                            className={`inline-flex items-center justify-center size-8 text-sm ${
                              row.rank === 1
                                ? "bg-amber-400 text-slate-950 font-black"
                                : row.rank === 2
                                ? "bg-slate-300 text-slate-950 font-black"
                                : row.rank === 3
                                ? "bg-amber-700 text-white font-black"
                                : row.rank <= 8
                                ? "bg-slate-800 text-cyan-400 border border-cyan-500/30"
                                : "text-slate-400"
                            }`}
                          >
                            {row.rank}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 shrink-0 bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-200">
                              {row.user.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-heading font-black text-base uppercase tracking-wide text-white">
                                {row.user.displayName}
                              </p>
                              <p className="text-xs text-slate-500">@{row.user.username}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-300 font-semibold">
                              {row.archetype || "Deck Homologado"}
                            </span>
                            {row.colors.map((c) => (
                              <span
                                key={c}
                                className="size-2.5 rounded-full inline-block border border-black/40"
                                style={{
                                  backgroundColor:
                                    c.toLowerCase() === "blue"
                                      ? "#3b82f6"
                                      : c.toLowerCase() === "green"
                                      ? "#22c55e"
                                      : c.toLowerCase() === "red"
                                      ? "#ef4444"
                                      : c.toLowerCase() === "yellow"
                                      ? "#eab308"
                                      : c.toLowerCase() === "purple"
                                      ? "#a855f7"
                                      : c.toLowerCase() === "black"
                                      ? "#1e293b"
                                      : "#94a3b8",
                                }}
                                title={c}
                              />
                            ))}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-black text-xl text-cyan-400">
                          {row.points}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono text-sm text-slate-300">
                          {row.wins} - {row.losses} - {row.draws}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-400">
                          {(row.omwPercent * 100).toFixed(1)}%
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-400">
                          {(row.gameWinRate * 100).toFixed(1)}%
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-400">
                          {(row.ogwPercent * 100).toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER TICKER */}
      <footer className="border-t border-slate-800 bg-slate-950 px-6 py-3 flex flex-wrap items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span className="font-mono text-cyan-400">● AO VIVO</span>
          <span>Portal Gundam TCG Brasil · Sistema Oficial de Torneios LGS</span>
        </div>

        <div className="flex items-center gap-3">
          <span>Check-in de Jogadores:</span>
          <code className="bg-slate-900 border border-slate-800 px-2 py-0.5 text-cyan-300 font-mono">
            {checkinUrl}
          </code>
        </div>
      </footer>

      {/* QR CODE MODAL */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="rounded-none border-cyan-500/40 bg-[#070b12] text-white max-w-md p-8 text-center space-y-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl uppercase tracking-wider text-cyan-400">
              Check-in de Jogadores
            </DialogTitle>
          </DialogHeader>

          <div className="bg-white p-6 inline-block mx-auto rounded-none shadow-2xl">
            <QRCodeSVG value={checkinUrl} size={256} level="H" includeMargin={false} />
          </div>

          <div className="space-y-2">
            <p className="font-heading uppercase text-lg text-white">Escaneie com a Câmera</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Aponte a câmera do seu smartphone para confirmar presença e travar a decklist do seu deck para este torneio.
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={() => setQrOpen(false)}
              className="w-full rounded-none bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold uppercase"
            >
              Fechar QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LgsTvDisplayPage;

/* Simulador — Modo treino solo contra o bot heurístico (docs/44 Fase 2 §4.2).
 *
 * Esta página cuida só da escolha de deck + dificuldade e do "Começar treino":
 * `POST /api/simulator/training/new` cria a partida (jogador no assento A, bot
 * no B) e redireciona pra a MESMA tela de partida das partidas PvP
 * (`/simulador/partida/:matchId`, SimulatorMatchPage). O bot joga sozinho — o
 * worker `services/sim-bot/` processa cada turno dele fora do web server.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Bot, Loader2, Swords, User, ShieldCheck } from "lucide-react";

import { api, type ApiDeck, type SimulatorTrainingLevel } from "@/lib/api";
import { validatedDeckList } from "@/modules/simulator/content/validatedDecks";
import { PublicShell } from "@/components/layout/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LEVELS: { value: SimulatorTrainingLevel; label: string; hint: string }[] = [
  { value: "facil", label: "Fácil", hint: "Joga o básico: deploy simples, ataca só o jogador, sem efeitos nem bloqueio." },
  { value: "normal", label: "Normal", hint: "Heurística cheia: forma Link, troca favorável, bloqueia, usa remoção na maior ameaça." },
  { value: "dificil", label: "Difícil (MCTS)", hint: "Busca em profundidade com MCTS: simula árvores de cenários futuros para maximizar vitórias." },
];

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function SimulatorTrainingPage() {
  const [, navigate] = useLocation();
  const starters = useMemo(() => validatedDeckList(), []);
  const [myDecks, setMyDecks] = useState<ApiDeck[]>([]);
  const [playerDeckId, setPlayerDeckId] = useState<string>(starters[0]?.id ?? "ST01");
  const [botDeckId, setBotDeckId] = useState<string>("SAME");
  const [level, setLevel] = useState<SimulatorTrainingLevel>("normal");
  const [starting, setStarting] = useState(false);

  // Carrega decks salvos do usuário para permitir treino com decks do perfil
  useEffect(() => {
    let cancelled = false;
    api
      .listMyDecks()
      .then((list) => {
        if (!cancelled && Array.isArray(list)) {
          setMyDecks(list);
        }
      })
      .catch(() => {
        /* segue só com os starters */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reconexão: se o jogador já está numa partida ativa (treino ou não), a
  // própria tela de partida resolve — aqui a gente só oferece começar uma nova.
  useEffect(() => {
    let cancelled = false;
    api
      .getSimulatorQueueStatus()
      .then((status) => {
        if (!cancelled && status.matched && status.matchId) navigate(`/simulador/partida/${status.matchId}`);
      })
      .catch(() => {
        /* sem sessão de simulador ativa — segue na tela de treino */
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const startTraining = async () => {
    setStarting(true);
    try {
      const actualBotDeckId = botDeckId === "SAME" ? playerDeckId : botDeckId;
      const { matchId } = await api.startSimulatorTraining({
        playerDeckId,
        botDeckId: actualBotDeckId,
        level,
      });
      navigate(`/simulador/partida/${matchId}`);
    } catch (err) {
      toast.error(errorMessage(err, "Não deu pra começar o treino."));
      setStarting(false);
    }
  };

  return (
    <PublicShell breadcrumbs={[{ label: "Simulador", href: "/simulador" }, { label: "Simulação de Treinamento" }]}>
      <div className="mx-auto max-w-xl">
        <Card className="rounded-xl border-primary/30 hero-surface">
          <CardContent className="space-y-6 p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-primary font-semibold">Arena Asticassia · Treinamento Tático</p>
              <h1 className="mt-2 font-heading text-4xl uppercase heading-portal">Simulação de Treinamento</h1>
              <p className="mt-3 text-sm leading-7 text-soft">
                Treine manobras e estratégias mobile suit contra a inteligência artificial com qualquer Starter Deck oficial ou projetos do seu próprio Hangar.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Deck do Jogador */}
              <div className="space-y-1.5">
                <label htmlFor="training-player-deck" className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-400 light:text-slate-600 flex items-center gap-1.5">
                  <User className="size-3 text-primary" />
                  Seu Deck
                </label>
                <Select value={playerDeckId} onValueChange={setPlayerDeckId}>
                  <SelectTrigger
                    id="training-player-deck"
                    className="w-full h-12 border border-white/15 bg-black/40 px-4 py-2.5 text-xs sm:text-sm font-semibold uppercase tracking-[0.12em] text-white dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary rounded-md"
                  >
                    <SelectValue placeholder="Selecione seu deck" />
                  </SelectTrigger>
                  <SelectContent className="border border-white/15 bg-slate-950/98 text-white dark:bg-slate-950 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 shadow-2xl z-50">
                    <SelectGroup>
                      <SelectLabel className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                        Starter Decks Oficiais
                      </SelectLabel>
                      {starters.map((deck) => (
                        <SelectItem key={deck.id} value={deck.id} className="cursor-pointer py-2 px-3 text-xs uppercase tracking-wide focus:bg-primary/20 focus:text-primary">
                          {deck.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {myDecks.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                          Meus Decks Salvos
                        </SelectLabel>
                        {myDecks.map((deck) => (
                          <SelectItem key={deck.id} value={deck.id} className="cursor-pointer py-2 px-3 text-xs uppercase tracking-wide focus:bg-primary/20 focus:text-primary">
                            {deck.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Deck do Bot */}
              <div className="space-y-1.5">
                <label htmlFor="training-bot-deck" className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-400 light:text-slate-600 flex items-center gap-1.5">
                  <Bot className="size-3 text-secondary-portal" />
                  Deck do Bot
                </label>
                <Select value={botDeckId} onValueChange={setBotDeckId}>
                  <SelectTrigger
                    id="training-bot-deck"
                    className="w-full h-12 border border-white/15 bg-black/40 px-4 py-2.5 text-xs sm:text-sm font-semibold uppercase tracking-[0.12em] text-white dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary rounded-md"
                  >
                    <SelectValue placeholder="Selecione o deck do bot" />
                  </SelectTrigger>
                  <SelectContent className="border border-white/15 bg-slate-950/98 text-white dark:bg-slate-950 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 shadow-2xl z-50">
                    <SelectItem value="SAME" className="cursor-pointer py-2 px-3 text-xs font-semibold uppercase tracking-wide focus:bg-primary/20 focus:text-primary">
                      Mesmo deck que o seu (Espelho)
                    </SelectItem>
                    <SelectGroup>
                      <SelectLabel className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                        Starter Decks Oficiais
                      </SelectLabel>
                      {starters.map((deck) => (
                        <SelectItem key={deck.id} value={deck.id} className="cursor-pointer py-2 px-3 text-xs uppercase tracking-wide focus:bg-primary/20 focus:text-primary">
                          {deck.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {myDecks.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                          Meus Decks Salvos
                        </SelectLabel>
                        {myDecks.map((deck) => (
                          <SelectItem key={deck.id} value={deck.id} className="cursor-pointer py-2 px-3 text-xs uppercase tracking-wide focus:bg-primary/20 focus:text-primary">
                            {deck.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-400 light:text-slate-600">Dificuldade da IA</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {LEVELS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLevel(option.value)}
                    aria-pressed={level === option.value}
                    className={`rounded-md border px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] transition-colors ${
                      level === option.value
                        ? "border-primary bg-primary/20 text-primary shadow-sm"
                        : "border-white/10 bg-black/20 text-soft hover:border-primary/40 light:border-slate-300 light:bg-slate-100"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-portal">{LEVELS.find((option) => option.value === level)?.hint}</p>
            </div>

            <Button
              className="w-full rounded-arena bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={starting}
              onClick={startTraining}
            >
              {starting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Swords className="mr-2 size-4" />}
              Iniciar Simulação Asticassia
            </Button>

            <div className="flex items-center justify-between text-xs text-muted-portal pt-1 border-t border-white/5">
              <span className="flex items-center gap-1.5">
                <Bot className="size-3.5 text-primary" />
                Motor server-authoritative
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-400" />
                Suporte ST01..ST04 + Decks do Perfil
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}

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
import { Bot, Loader2, Swords } from "lucide-react";

import { api, type SimulatorTrainingLevel } from "@/lib/api";
import { validatedDeckList } from "@/modules/simulator/content/validatedDecks";
import { PortalShell } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const LEVELS: { value: SimulatorTrainingLevel; label: string; hint: string }[] = [
  { value: "facil", label: "Fácil", hint: "Joga o básico: deploy simples, ataca só o jogador, sem efeitos nem bloqueio." },
  { value: "normal", label: "Normal", hint: "Heurística cheia: forma Link, troca favorável, bloqueia, usa remoção na maior ameaça." },
];

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function SimulatorTrainingPage() {
  const [, navigate] = useLocation();
  const decks = useMemo(() => validatedDeckList(), []);
  const [deckId, setDeckId] = useState<string>(decks[0]?.id ?? "ST01");
  const [level, setLevel] = useState<SimulatorTrainingLevel>("normal");
  const [starting, setStarting] = useState(false);

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
      const { matchId } = await api.startSimulatorTraining({ deckId, level });
      navigate(`/simulador/partida/${matchId}`);
    } catch (err) {
      toast.error(errorMessage(err, "Não deu pra começar o treino."));
      setStarting(false);
    }
  };

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador", href: "/simulador" }, { label: "Treino" }]}>
      <div className="mx-auto max-w-xl">
        <Card className="panel-cut rounded-arena border-primary/30 hero-surface">
          <CardContent className="space-y-6 p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Treino solo</p>
              <h1 className="mt-2 font-heading text-4xl uppercase heading-portal">Contra o bot</h1>
              <p className="mt-3 text-sm leading-7 text-soft">
                Escolha um deck validado e a dificuldade. Você joga contra a IA — sem esperar oponente, sem fila. A partida
                abre na tela normal do simulador.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="training-deck" className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Seu deck (o bot usa o mesmo)
              </label>
              <select
                id="training-deck"
                value={deckId}
                onChange={(event) => setDeckId(event.target.value)}
                className="panel-cut w-full border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-soft focus:border-primary focus:outline-none"
              >
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Dificuldade</p>
              <div className="grid grid-cols-2 gap-2">
                {LEVELS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLevel(option.value)}
                    aria-pressed={level === option.value}
                    className={`panel-cut border px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] transition-colors ${
                      level === option.value
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-white/10 bg-black/20 text-soft hover:border-primary/40"
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
              Começar treino
            </Button>

            <p className="flex items-center gap-2 text-xs text-muted-portal">
              <Bot className="size-3.5" />
              O bot pode levar alguns segundos pra jogar cada turno.
            </p>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}

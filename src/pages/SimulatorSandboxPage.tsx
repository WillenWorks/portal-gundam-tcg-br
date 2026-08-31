/* Simulador Beta (docs/18, passo 4 + expansão 2026-08-30 + rodada visual
 * 2026-08-31). Decisões do Willen que moldam este arquivo:
 * - 1 botão só ("Simulador Beta"). Sem escolher assento ou adversário --
 *   entra na fila, escolhe o deck, e a sincronização com o próximo jogador
 *   (sempre outra conta) resolve sozinha e abre a partida direto.
 * - Antes da fila, cada jogador escolhe o próprio deck (ST01/ST02, qualquer
 *   combinação, incluindo os dois lados com o mesmo deck).
 * - Aberto a qualquer usuário logado (não mais restrito a admin/hoster).
 * - Rodada visual (2026-08-31, "quando o jogo for marcado entre dois players
 *   logados, a tela tem que ser uma nova, por causa da UI e HUD"): esta
 *   página cuida só da fila/escolha de deck/tela de espera -- assim que os
 *   2 jogadores são pareados, navega pra `/simulador/partida/:matchId`
 *   (SimulatorMatchPage.tsx), a tela de partida de verdade, com arte real
 *   das cartas e HUD dedicado. Esta página NUNCA mais renderiza o tabuleiro
 *   em si; se o usuário recarregar já em partida (reconexão), o mesmo
 *   redirecionamento acontece na checagem inicial abaixo.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, Swords } from "lucide-react";

import { api } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DECK_OPTIONS = ["ST01", "ST02"];

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

type Screen = "checking" | "lobby" | "queued";

export default function SimulatorSandboxPage() {
  const [, navigate] = useLocation();
  const [screen, setScreen] = useState<Screen>("checking");
  const [deckKey, setDeckKey] = useState<string>("ST01");
  const [joining, setJoining] = useState(false);
  const [leavingQueue, setLeavingQueue] = useState(false);

  const enterMatch = useCallback((id: string) => navigate(`/simulador/partida/${id}`), [navigate]);

  // Ao abrir a página (inclusive recarregar), descobre se o usuário já está numa partida ativa
  // (reconexão) ou já esperando na fila -- pra não obrigar a passar pelo botão de novo à toa.
  useEffect(() => {
    let cancelled = false;
    api
      .getSimulatorQueueStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.matched && status.matchId) enterMatch(status.matchId);
        else setScreen(status.queued ? "queued" : "lobby");
      })
      .catch(() => !cancelled && setScreen("lobby"));
    return () => {
      cancelled = true;
    };
  }, [enterMatch]);

  // Enquanto espera na fila, faz polling do status -- assim que outro jogador entrar, o
  // pareamento já aconteceu no servidor e este polling só precisa descobrir e navegar pra partida.
  useEffect(() => {
    if (screen !== "queued") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await api.getSimulatorQueueStatus();
        if (cancelled) return;
        if (status.matched && status.matchId) enterMatch(status.matchId);
      } catch {
        // erro de rede pontual no polling não deve derrubar a tela de espera -- só tenta de novo no próximo tick
      }
    };
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [screen, enterMatch]);

  const enterQueue = async () => {
    setJoining(true);
    try {
      const status = await api.joinSimulatorQueue(deckKey);
      // Se este clique foi o 2º jogador a entrar, o pareamento já aconteceu na mesma chamada --
      // vai direto pra partida sem passar pela tela de espera.
      if (status.matched && status.matchId) enterMatch(status.matchId);
      else setScreen("queued");
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao entrar na fila."));
    } finally {
      setJoining(false);
    }
  };

  const cancelQueue = async () => {
    setLeavingQueue(true);
    try {
      await api.leaveSimulatorQueue();
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao sair da fila."));
    } finally {
      setLeavingQueue(false);
      setScreen("lobby");
    }
  };

  if (screen === "checking") {
    return (
      <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador Beta" }]}>
        <div className="flex items-center gap-2 text-sm text-muted-portal">
          <Loader2 className="size-4 animate-spin" />
          Verificando sessão do simulador...
        </div>
      </PortalShell>
    );
  }

  if (screen === "queued") {
    return (
      <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador Beta" }]}>
        <div className="mx-auto max-w-xl">
          <Card className="panel-cut rounded-none border-primary/30 hero-surface">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Simulador Beta</p>
                <h1 className="mt-2 font-heading text-3xl uppercase heading-portal">Aguardando oponente</h1>
                <p className="mt-3 text-sm leading-7 text-soft">
                  Deck escolhido: <strong>{deckKey}</strong>. Assim que outro jogador (outra conta) entrar na fila, a partida começa sozinha -- sem
                  precisar escolher assento ou adversário.
                </p>
              </div>
              <Button variant="outline" className="rounded-none" disabled={leavingQueue} onClick={cancelQueue}>
                {leavingQueue ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador Beta" }]}>
      <div className="mx-auto max-w-xl">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="space-y-6 p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Simulador</p>
              <h1 className="mt-2 font-heading text-4xl uppercase heading-portal">Simulador Beta</h1>
              <p className="mt-3 text-sm leading-7 text-soft">
                Escolha seu deck e entre na fila. Você é pareado automaticamente com o próximo jogador -- sempre outra conta -- e a partida abre direto pros
                dois, já sincronizada.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Seu deck</p>
              <div className="grid grid-cols-2 gap-2">
                {DECK_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDeckKey(option)}
                    className={`panel-cut border px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] transition-colors ${
                      deckKey === option ? "border-primary bg-primary/20 text-primary" : "border-white/10 bg-black/20 text-soft hover:border-primary/40"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-portal">Qualquer combinação é válida -- inclusive os dois lados com o mesmo deck.</p>
            </div>

            <Button className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={joining} onClick={enterQueue}>
              {joining ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Swords className="mr-2 size-4" />}
              Simulador Beta
            </Button>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}

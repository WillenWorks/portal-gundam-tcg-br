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
 *
 * Frente 5 (docs/39) — convite direto por link. ADITIVO ao fluxo de fila
 * acima: além de "Entrar na fila", a lobby agora tem "Jogar com um amigo",
 * que abre um código/link de convite via Socket.io (`socketClient.ts`). Quem
 * recebe o link cai em `/simulador?challenge=CÓDIGO`, escolhe o deck e aceita;
 * o servidor cria a `matchId` e manda `challenge:ready` pros dois. O SSE e o
 * polling da fila seguem intactos — isto é um caminho a mais, não uma troca.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Copy, Loader2, Swords, Users } from "lucide-react";

import { api } from "@/lib/api";
import { simulatorSocket } from "@/modules/simulator/network/socketClient";
import { PortalShell } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DECK_OPTIONS = ["ST01", "ST02", "ST03", "ST04"];

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Código de convite presente na URL (`/simulador?challenge=GC-7842`), se houver. */
function readChallengeParam(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("challenge");
  return value ? value.trim().toUpperCase() : null;
}

/** Link compartilhável pro amigo — mantém o padrão de hash routing do app. */
function buildInviteLink(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?challenge=${encodeURIComponent(code)}#/simulador`;
}

type Screen = "checking" | "lobby" | "queued" | "challenge-host" | "challenge-guest";

export default function SimulatorSandboxPage() {
  const [, navigate] = useLocation();
  const [screen, setScreen] = useState<Screen>("checking");
  const [deckKey, setDeckKey] = useState<string>("ST01");
  const [joining, setJoining] = useState(false);
  const [leavingQueue, setLeavingQueue] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [challengeCode, setChallengeCode] = useState<string | null>(null);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const enterMatch = useCallback((id: string) => navigate(`/simulador/partida/${id}`), [navigate]);

  // Socket.io (Frente 5): conecta e escuta `challenge:ready` — vale tanto pro
  // anfitrião quanto pro convidado, os dois são levados pra partida ao mesmo tempo.
  useEffect(() => {
    simulatorSocket.connect();
    const off = simulatorSocket.on("challenge:ready", ({ matchId }) => enterMatch(matchId));
    return off;
  }, [enterMatch]);

  // Ao abrir a página (inclusive recarregar): se veio um `?challenge=` na URL, vai
  // direto pra tela de aceitar convite. Senão, descobre se o usuário já está numa
  // partida ativa (reconexão) ou esperando na fila.
  useEffect(() => {
    const fromLink = readChallengeParam();
    if (fromLink) {
      setChallengeCode(fromLink);
      setScreen("challenge-guest");
      return;
    }
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

  const createInvite = async () => {
    setChallengeBusy(true);
    try {
      const code = await simulatorSocket.createChallenge(deckKey);
      setInviteCode(code);
      setScreen("challenge-host");
    } catch (err) {
      toast.error(errorMessage(err, "Não deu pra criar o convite."));
    } finally {
      setChallengeBusy(false);
    }
  };

  const acceptInvite = async () => {
    if (!challengeCode) return;
    setChallengeBusy(true);
    try {
      const matchId = await simulatorSocket.acceptChallenge(challengeCode, deckKey);
      enterMatch(matchId);
    } catch (err) {
      toast.error(errorMessage(err, "Não deu pra aceitar o convite."));
      setChallengeBusy(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(buildInviteLink(inviteCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não deu pra copiar — selecione o link manualmente.");
    }
  };

  const deckPicker = (
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
      <p className="text-xs text-muted-portal">Qualquer combinação é válida — inclusive os dois lados com o mesmo deck.</p>
    </div>
  );

  if (screen === "checking") {
    return (
      <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador" }]}>
        <div className="flex items-center gap-2 text-sm text-muted-portal">
          <Loader2 className="size-4 animate-spin" />
          Verificando sessão do simulador…
        </div>
      </PortalShell>
    );
  }

  if (screen === "queued") {
    return (
      <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador" }]}>
        <div className="mx-auto max-w-xl">
          <Card className="panel-cut rounded-arena border-primary/30 hero-surface">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Fila</p>
                <h1 className="mt-2 font-heading text-3xl uppercase heading-portal">Aguardando oponente</h1>
                <p className="mt-3 text-sm leading-7 text-soft">
                  Deck escolhido: <strong>{deckKey}</strong>. Assim que outro jogador entrar na fila, a partida começa.
                </p>
              </div>
              <Button variant="outline" className="rounded-arena" disabled={leavingQueue} onClick={cancelQueue}>
                {leavingQueue ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      </PortalShell>
    );
  }

  if (screen === "challenge-host") {
    return (
      <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador" }]}>
        <div className="mx-auto max-w-xl">
          <Card className="panel-cut rounded-arena border-primary/30 hero-surface">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Convite direto</p>
                <h1 className="mt-2 font-heading text-3xl uppercase heading-portal">Esperando seu amigo</h1>
                <p className="mt-3 text-sm leading-7 text-soft">
                  Código <strong className="tracking-[0.2em] text-primary">{inviteCode}</strong>. Mande o link abaixo — quando ele
                  aceitar, os dois entram na partida juntos. Seu deck: <strong>{deckKey}</strong>.
                </p>
              </div>
              <div className="w-full break-all rounded-arena border border-white/10 bg-black/30 p-3 text-xs text-soft">
                {inviteCode ? buildInviteLink(inviteCode) : null}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-arena" onClick={copyInvite}>
                  <Copy className="mr-2 size-4" />
                  {copied ? "Link copiado" : "Copiar link"}
                </Button>
                <Button variant="ghost" className="rounded-arena" onClick={() => setScreen("lobby")}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PortalShell>
    );
  }

  if (screen === "challenge-guest") {
    return (
      <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador" }]}>
        <div className="mx-auto max-w-xl">
          <Card className="panel-cut rounded-arena border-primary/30 hero-surface">
            <CardContent className="space-y-6 p-8">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Convite direto</p>
                <h1 className="mt-2 font-heading text-4xl uppercase heading-portal">Você foi desafiado</h1>
                <p className="mt-3 text-sm leading-7 text-soft">
                  Código do convite: <strong className="tracking-[0.2em] text-primary">{challengeCode}</strong>. Escolha seu deck e
                  aceite para começar a partida.
                </p>
              </div>
              {deckPicker}
              <div className="flex gap-2">
                <Button
                  className="flex-1 rounded-arena bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={challengeBusy}
                  onClick={acceptInvite}
                >
                  {challengeBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Swords className="mr-2 size-4" />}
                  Aceitar desafio
                </Button>
                <Button variant="ghost" className="rounded-arena" onClick={() => navigate("/simulador")} disabled={challengeBusy}>
                  Voltar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Simulador" }]}>
      <div className="mx-auto max-w-xl">
        <Card className="panel-cut rounded-arena border-primary/30 hero-surface">
          <CardContent className="space-y-6 p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Partida rápida</p>
              <h1 className="mt-2 font-heading text-4xl uppercase heading-portal">Simulador</h1>
              <p className="mt-3 text-sm leading-7 text-soft">
                Escolha seu deck e entre na fila. Você é pareado automaticamente com o próximo jogador e a partida abre para os dois.
              </p>
            </div>

            {deckPicker}

            <Button className="w-full rounded-arena bg-primary text-primary-foreground hover:bg-primary/90" disabled={joining} onClick={enterQueue}>
              {joining ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Swords className="mr-2 size-4" />}
              Entrar na fila
            </Button>

            <Button
              variant="outline"
              className="w-full rounded-arena"
              disabled={challengeBusy}
              onClick={createInvite}
            >
              {challengeBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Users className="mr-2 size-4" />}
              Jogar com um amigo
            </Button>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}

/* Simulador Beta (docs/18, passo 4 + expansão 2026-08-30 + rodada visual
 * 2026-08-31). Decisões do Willen que moldam este arquivo:
 * - 1 botão só ("Simulador Beta"). Sem escolher assento ou adversário --
 *   entra na fila, escolhe o deck, e a sincronização com o próximo jogador
 *   (sempre outra conta) resolve sozinha e abre a partida direto.
 * - Antes da fila, cada jogador escolhe o próprio deck.
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
 * acima: além de "Entrar na fila", a lobby agora tem "Convidar por Link",
 * que abre um código/link de convite via Socket.io (`socketClient.ts`). Quem
 * recebe o link cai em `/simulador?challenge=CÓDIGO`, escolhe o deck e aceita;
 * o servidor cria a `matchId` e manda `challenge:ready` pros dois. O SSE e o
 * polling da fila seguem intactos — isto é um caminho a mais, não uma troca.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Copy, Loader2, Swords, Users, Bot, CircleCheck, CircleX, PlusCircle } from "lucide-react";

import { api } from "@/lib/api";
import { simulatorSocket } from "@/modules/simulator/network/socketClient";
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
import { useMySimulatorDecks } from "@/modules/simulator/ui/useMySimulatorDecks";
import { SimulatorDeckCoverageNotice } from "@/modules/simulator/ui/SimulatorDeckCoverageNotice";
import { useSiteLanguage } from "@/i18n/siteLanguage";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Código de convite presente na URL (`/simulador?challenge=GC-7842`), se houver. */
function readChallengeParam(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("challenge");
  return value ? value.trim().toUpperCase() : null;
}

/** Link compartilhável pro amigo. */
function buildInviteLink(code: string): string {
  return `${window.location.origin}/simulador?challenge=${encodeURIComponent(code)}`;
}

type Screen = "checking" | "lobby" | "queued" | "challenge-host" | "challenge-guest";

function ArenaBackgroundWrapper({ children }: { children: React.ReactNode }) {
  const { tr } = useSiteLanguage();
  return (
    <div className="relative mx-auto w-full container-ultrawide overflow-hidden rounded-2xl border border-primary/30 bg-slate-950 shadow-[0_0_60px_rgba(6,182,212,0.25)]">
      {/* Imagem de Fundo Shining vs Destiny Arena em tamanho total e alta visibilidade */}
      <div className="pointer-events-none absolute inset-0">
        <img loading="lazy" decoding="async"
          src="/images/shining_vs_destiny_space_arena.webp"
          alt={tr("Shining Gundam vs Destiny Gundam Arena de Combate Espacial", "Shining Gundam vs Destiny Gundam in a space battle arena")}
          className="h-full w-full object-cover object-center opacity-95 brightness-105 contrast-105 transition-opacity duration-500"
        />
        {/* Gradientes sutis apenas no topo e base para harmonização perfeita com a página */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-transparent to-[#0b0f19]/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0f19]/50 via-transparent to-[#0b0f19]/75" />
        <div className="absolute inset-0 bg-grid-tech opacity-10" />
      </div>

      {/* Conteúdo centralizado com o card otimizado para não esconder os mechas */}
      <div className="relative z-10 flex min-h-[740px] lg:min-h-[820px] xl:min-h-[900px] 2xl:min-h-[940px] items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

export default function SimulatorSandboxPage() {
  const { tr } = useSiteLanguage();
  const [, navigate] = useLocation();
  const [screen, setScreen] = useState<Screen>("checking");
  const [deckKey, setDeckKey] = useState<string>("");
  const { decks: myDecks, loading: myDecksLoading } = useMySimulatorDecks();

  useEffect(() => {
    if (myDecksLoading) return;
    if (myDecks.length === 0) {
      setDeckKey("");
      return;
    }
    if (!deckKey || !myDecks.some((d) => d.id === deckKey)) {
      const firstPlayable = myDecks.find((d) => d.simulatorValid) ?? myDecks[0];
      if (firstPlayable) setDeckKey(firstPlayable.id);
    }
  }, [myDecks, myDecksLoading, deckKey]);

  const selectedOwnDeck = myDecks.find((d) => d.id === deckKey);
  const deckBlocked = !selectedOwnDeck || !selectedOwnDeck.simulatorValid;
  const deckLabel = selectedOwnDeck?.name ?? deckKey;
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
    if (deckBlocked) {
      if (selectedOwnDeck) {
        toast.error(tr(`"${selectedOwnDeck.name}" tem carta sem cobertura no simulador — veja o aviso abaixo e troque de deck.`, `"${selectedOwnDeck.name}" has a card the simulator doesn't support — see the notice below and pick another deck.`));
      } else {
        toast.error(tr("Cadastre e selecione um deck válido para entrar na fila.", "Create and select a valid deck to join the queue."));
      }
      return;
    }
    setJoining(true);
    try {
      const status = await api.joinSimulatorQueue(deckKey);
      // Se este clique foi o 2º jogador a entrar, o pareamento já aconteceu na mesma chamada --
      // vai direto pra partida sem passar pela tela de espera.
      if (status.matched && status.matchId) enterMatch(status.matchId);
      else setScreen("queued");
    } catch (err) {
      toast.error(errorMessage(err, tr("Erro ao entrar na fila.", "Couldn't join the queue.")));
    } finally {
      setJoining(false);
    }
  };

  const cancelQueue = async () => {
    setLeavingQueue(true);
    try {
      await api.leaveSimulatorQueue();
    } catch (err) {
      toast.error(errorMessage(err, tr("Erro ao sair da fila.", "Couldn't leave the queue.")));
    } finally {
      setLeavingQueue(false);
      setScreen("lobby");
    }
  };

  const createInvite = async () => {
    if (deckBlocked) {
      if (selectedOwnDeck) {
        toast.error(tr(`"${selectedOwnDeck.name}" tem carta sem cobertura no simulador — veja o aviso abaixo e troque de deck.`, `"${selectedOwnDeck.name}" has a card the simulator doesn't support — see the notice below and pick another deck.`));
      } else {
        toast.error(tr("Cadastre e selecione um deck válido para criar o convite.", "Create and select a valid deck to create an invite."));
      }
      return;
    }
    setChallengeBusy(true);
    try {
      const code = await simulatorSocket.createChallenge(deckKey);
      setInviteCode(code);
      setScreen("challenge-host");
    } catch (err) {
      toast.error(errorMessage(err, tr("Não deu pra criar o convite.", "Couldn't create the invite.")));
    } finally {
      setChallengeBusy(false);
    }
  };

  const acceptInvite = async () => {
    if (!challengeCode) return;
    if (deckBlocked) {
      if (selectedOwnDeck) {
        toast.error(tr(`"${selectedOwnDeck.name}" tem carta sem cobertura no simulador — veja o aviso abaixo e troque de deck.`, `"${selectedOwnDeck.name}" has a card the simulator doesn't support — see the notice below and pick another deck.`));
      } else {
        toast.error(tr("Cadastre e selecione um deck válido para aceitar o convite.", "Create and select a valid deck to accept the invite."));
      }
      return;
    }
    setChallengeBusy(true);
    try {
      const matchId = await simulatorSocket.acceptChallenge(challengeCode, deckKey);
      enterMatch(matchId);
    } catch (err) {
      toast.error(errorMessage(err, tr("Não deu pra aceitar o convite.", "Couldn't accept the invite.")));
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
      toast.error(tr("Não deu pra copiar — selecione o link manualmente.", "Couldn't copy — select the link manually."));
    }
  };

  const deckPicker = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="pvp-player-deck" className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 block">
          {tr("Seu deck", "Your deck")}
        </label>
        {myDecksLoading ? (
          <p className="text-xs text-muted-portal py-2">{tr("Carregando seus decks…", "Loading your decks…")}</p>
        ) : myDecks.length === 0 ? (
          <div className="rounded-md border border-primary/30 bg-black/40 p-4 space-y-2.5 text-xs text-slate-300">
            <p>
              {tr(
                "Você ainda não possui nenhum deck cadastrado no seu Hangar para jogar partidas PvP.",
                "You don't have any decks saved in your Hangar for PvP matches yet.",
              )}
            </p>
            <Link
              href="/deckbuilder"
              className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-primary hover:underline"
            >
              <PlusCircle className="size-3.5" />
              {tr("Montar um deck no Deckbuilder", "Build a deck in the Deckbuilder")}
            </Link>
          </div>
        ) : (
          <Select value={deckKey} onValueChange={setDeckKey}>
            <SelectTrigger
              id="pvp-player-deck"
              className="w-full h-12 border border-white/15 bg-black/40 px-4 py-2.5 text-xs sm:text-sm font-semibold uppercase tracking-[0.12em] text-white dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary rounded-md"
            >
              <SelectValue placeholder={tr("Selecione seu deck", "Select your deck")} />
            </SelectTrigger>
            <SelectContent className="border border-white/15 bg-slate-950/98 text-white dark:bg-slate-950 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 shadow-2xl z-50">
              <SelectGroup>
                <SelectLabel className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  {tr("Meus Decks Salvos", "My Saved Decks")}
                </SelectLabel>
                {myDecks.map((deck) => (
                  <SelectItem
                    key={deck.id}
                    value={deck.id}
                    disabled={!deck.simulatorValid}
                    className="cursor-pointer py-2 px-3 text-xs uppercase tracking-wide focus:bg-primary/20 focus:text-primary"
                  >
                    <span className="flex items-center gap-1.5">
                      {deck.simulatorValid ? (
                        <CircleCheck className="size-3 shrink-0 text-emerald-400" />
                      ) : (
                        <CircleX className="size-3 shrink-0 text-red-400" />
                      )}
                      <span>{deck.name}</span>
                      {!deck.simulatorValid ? (
                        <span className="text-[10px] text-red-400 font-mono">
                          {tr("(Incompleto / sem cobertura)", "(Incomplete / unsupported)")}
                        </span>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedOwnDeck && !selectedOwnDeck.simulatorValid ? <SimulatorDeckCoverageNotice deck={selectedOwnDeck} /> : null}
    </div>
  );

  if (screen === "checking") {
    return (
      <PublicShell breadcrumbs={[{ label: "Simulador" }]}>
        <div className="flex items-center gap-2 text-sm text-muted-portal">
          <Loader2 className="size-4 animate-spin" />
          Conectando à Arena Asticassia…
        </div>
      </PublicShell>
    );
  }

  if (screen === "queued") {
    return (
      <PublicShell breadcrumbs={[{ label: "Simulador", href: "/simulador" }, { label: "Fila Online" }]}>
        <ArenaBackgroundWrapper>
          <Card className="rounded-xl border-primary/40 bg-slate-950/85 backdrop-blur-md shadow-2xl">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Duelo Oficial Asticassia · Fila Online", "Asticassia Official Duel · Online Queue")}</p>
                <h1 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Aguardando oponente", "Waiting for an opponent")}</h1>
                <p className="mt-3 text-sm leading-7 text-soft">
                  {tr("Deck de combate:", "Your deck:")} <strong>{deckLabel}</strong>. {tr("Assim que outro piloto conectar à Arena, o duelo terá início.", "The duel starts as soon as another player joins.")}
                </p>
              </div>
              <Button variant="outline" className="rounded-arena" disabled={leavingQueue} onClick={cancelQueue}>
                {leavingQueue ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {tr("Cancelar busca", "Cancel search")}
              </Button>
            </CardContent>
          </Card>
        </ArenaBackgroundWrapper>
      </PublicShell>
    );
  }

  if (screen === "challenge-host") {
    return (
      <PublicShell breadcrumbs={[{ label: "Simulador", href: "/simulador" }, { label: tr("Convidar por Link", "Invite via Link") }]}>
        <ArenaBackgroundWrapper>
          <Card className="rounded-xl border-primary/40 bg-slate-950/85 backdrop-blur-md shadow-2xl">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Arena Asticassia · Convidar por Link", "Asticassia Arena · Invite via Link")}</p>
                <h1 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Aguardando desafiante", "Waiting for a challenger")}</h1>
                <p className="mt-3 text-sm leading-7 text-soft">
                  {tr("Código do duelo:", "Duel code:")} <strong className="tracking-[0.2em] text-primary">{inviteCode}</strong>. {tr("Transmita o link abaixo para outro piloto. Seu deck:", "Send the link below to another player. Your deck:")} <strong>{deckLabel}</strong>.
                </p>
              </div>
              <div className="w-full break-all rounded-arena border border-white/10 bg-black/30 p-3 text-xs text-soft">
                {inviteCode ? buildInviteLink(inviteCode) : null}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-arena" onClick={copyInvite}>
                  <Copy className="mr-2 size-4" />
                  {copied ? tr("Link copiado", "Link copied") : tr("Copiar link", "Copy link")}
                </Button>
                <Button variant="ghost" className="rounded-arena" onClick={() => setScreen("lobby")}>
                  {tr("Cancelar", "Cancel")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </ArenaBackgroundWrapper>
      </PublicShell>
    );
  }

  if (screen === "challenge-guest") {
    return (
      <PublicShell breadcrumbs={[{ label: "Simulador", href: "/simulador" }, { label: "Duelo Privado" }]}>
        <ArenaBackgroundWrapper>
          <Card className="rounded-xl border-primary/40 bg-slate-950/85 backdrop-blur-md shadow-2xl">
            <CardContent className="space-y-6 p-8">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Arena Asticassia · Duelo Privado", "Asticassia Arena · Private Duel")}</p>
                <h1 className="mt-2 font-heading text-4xl uppercase heading-portal">{tr("Você foi desafiado", "You've been challenged")}</h1>
                <p className="mt-3 text-sm leading-7 text-soft">
                  {tr("Código de duelo:", "Duel code:")} <strong className="tracking-[0.2em] text-primary">{challengeCode}</strong>. {tr("Selecione sua formação e aceite o combate na Arena.", "Pick your deck and accept the duel.")}
                </p>
              </div>
              {deckPicker}
              <div className="flex gap-2">
                <Button
                  className="flex-1 rounded-arena bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={challengeBusy || deckBlocked}
                  onClick={acceptInvite}
                >
                  {challengeBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Swords className="mr-2 size-4" />}
                  {tr("Aceitar duelo", "Accept duel")}
                </Button>
                <Button variant="ghost" className="rounded-arena" onClick={() => navigate("/simulador")} disabled={challengeBusy}>
                  {tr("Voltar", "Back")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </ArenaBackgroundWrapper>
      </PublicShell>
    );
  }

  return (
    <PublicShell breadcrumbs={[{ label: "Simulador" }]}>
      <ArenaBackgroundWrapper>
        <Card className="rounded-xl border-primary/40 bg-slate-950/85 backdrop-blur-md shadow-2xl">
          <CardContent className="space-y-6 p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-primary font-semibold">{tr("Arena Asticassia · Centro de Duelos", "Asticassia Arena · Duel Center")}</p>
              <h1 className="mt-2 font-heading text-4xl uppercase heading-portal">Arena Asticassia</h1>
              <p className="mt-3 text-sm leading-7 text-soft">
                {tr("Ambiente de jogo contra outro piloto. Dispute contra um oponente na fila de espera ou convide um amigo para entrar numa partida.", "Play against another player. Join the queue for an opponent or invite a friend to a match.")}
              </p>
            </div>

            {deckPicker}

            <Button className="w-full rounded-arena bg-primary text-primary-foreground hover:bg-primary/90" disabled={joining || deckBlocked} onClick={enterQueue}>
              {joining ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Swords className="mr-2 size-4" />}
              {tr("Duelo Oficial Asticassia (Fila Online)", "Asticassia Official Duel (Online Queue)")}
            </Button>

            <Button
              variant="outline"
              className="w-full rounded-arena"
              disabled={challengeBusy || deckBlocked}
              onClick={createInvite}
            >
              {challengeBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Users className="mr-2 size-4" />}
              {tr("Convidar por Link", "Invite via Link")}
            </Button>

            <div className="my-1 py-2">
              <div className="relative flex items-center">
                <div className="flex-grow border-t border-white/10" />
                <span className="mx-3 flex-shrink text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-portal">
                  {tr("Treinamento de Piloto", "Practice")}
                </span>
                <div className="flex-grow border-t border-white/10" />
              </div>
              <p className="mt-1 text-center text-xs text-muted-portal">
                {tr("Teste seus decks montados ou selados contra um robô autômato", "Test your decks against the bot")}
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full rounded-arena border-cyan-500/40 bg-cyan-950/20 text-cyan-400 hover:bg-cyan-900/30 hover:border-cyan-400"
              onClick={() => navigate("/simulador/treino")}
            >
              <Bot className="mr-2 size-4 text-cyan-400" />
              {tr("Treinamento no Simulador", "Simulator Training")}
            </Button>
          </CardContent>
        </Card>
      </ArenaBackgroundWrapper>
    </PublicShell>
  );
}

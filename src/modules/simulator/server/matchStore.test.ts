import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import {
  _resetAllMatchesForTests,
  applyAction,
  claimAbandonWin,
  createMatch,
  decisionOwner,
  defaultActionFor,
  deleteMatch,
  getMatch,
  joinMatch,
  joinQueue,
  leaveQueue,
  loadMatch,
  MatchError,
  matchViewFor,
  queueStatusFor,
  reportSituation,
  resignMatch,
  seatFor,
  setAutoPass,
  setMatchPersistence,
  subscribe,
  touchPresence,
  type MatchPersistence,
  type StoredMatch,
} from "./matchStore";
import { applyPlayerAction } from "../engine/actions";
import { ALL_EFFECT_SPECS, defaultPredicateResolver } from "../content";
import type { GameState } from "../engine/types";

afterEach(() => {
  _resetAllMatchesForTests();
});

function newMatch() {
  // skipMulligan: a maioria dos testes exercita a partida JÁ em jogo — o fluxo
  // de Mulligan interativo tem testes próprios (engine/mulligan.test.ts + o
  // describe abaixo).
  return createMatch({ deckA: buildSt01DeckList(), deckB: buildSt02DeckList(), seed: 1, firstPlayer: "A", skipMulligan: true });
}

describe("createMatch / getMatch", () => {
  it("cria a partida já na Main Phase do 1º jogador, sem assentos ocupados", () => {
    const match = newMatch();
    expect(match.state.phase).toBe("main");
    expect(match.state.activePlayer).toBe("A");
    expect(match.seats).toEqual({});
    expect(getMatch(match.id)?.id).toBe(match.id);
  });

  it("getMatch devolve undefined pra id inexistente", () => {
    expect(getMatch("não-existe")).toBeUndefined();
  });
});

describe("joinMatch", () => {
  it("2 usuários diferentes ocupam os 2 assentos", () => {
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    const after = joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

    expect(seatFor(after, "user-1")).toBe("A");
    expect(seatFor(after, "user-2")).toBe("B");
  });

  it("rejeita um 2º usuário tentando ocupar um assento já ocupado por outra conta", () => {
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });

    expect(() => joinMatch(match.id, "A", { userId: "user-2", displayName: "Outro" })).toThrow(MatchError);
    expect(() => joinMatch(match.id, "A", { userId: "user-2", displayName: "Outro" })).toThrow(/já está ocupado/);
  });

  it("rejeita o MESMO usuário ocupando os 2 assentos (precisa de 2 contas reais, ver docs/18)", () => {
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });

    expect(() => joinMatch(match.id, "B", { userId: "user-1", displayName: "Willen" })).toThrow(/2 contas diferentes/);
  });

  it("rejoin do mesmo usuário no MESMO assento é idempotente (reconexão de aba)", () => {
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    expect(() => joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" })).not.toThrow();
  });

  it("partida inexistente lança MatchError 404", () => {
    expect(() => joinMatch("não-existe", "A", { userId: "user-1", displayName: "x" })).toThrow(MatchError);
    try {
      joinMatch("não-existe", "A", { userId: "user-1", displayName: "x" });
    } catch (err) {
      expect((err as MatchError).status).toBe(404);
    }
  });
});

describe("applyAction", () => {
  it("rejeita ação de usuário que não entrou na partida", () => {
    const match = newMatch();
    expect(() => applyAction(match.id, "user-desconhecido", { kind: "finishTurn" })).toThrow(/não é jogador/);
  });

  it("resolve o assento certo a partir do userId e aplica a ação no motor real", () => {
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

    // finishTurn não avança direto -- entra no Action Step da End Phase (Comprehensive
    // Rules 7-6), prioridade começa pelo jogador em espera (B, ver matchStore.ts/decisionOwner).
    let updated = applyAction(match.id, "user-1", { kind: "finishTurn" });
    expect(updated.state.phase).toBe("end");
    expect(updated.state.activePlayer).toBe("A"); // ainda não trocou
    expect(updated.version).toBe(2);

    updated = applyAction(match.id, "user-2", { kind: "passEndPhaseAction" });
    updated = applyAction(match.id, "user-1", { kind: "passEndPhaseAction" });
    expect(updated.state.activePlayer).toBe("B");
    expect(updated.version).toBe(4);
  });

  it("erro do motor (ação ilegal) vira MatchError 400 com a mensagem original", () => {
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

    // B tentando encerrar o turno de A
    expect(() => applyAction(match.id, "user-2", { kind: "finishTurn" })).toThrow(/jogador ativo/);
    try {
      applyAction(match.id, "user-2", { kind: "finishTurn" });
    } catch (err) {
      expect((err as MatchError).status).toBe(400);
    }
  });
});

describe("subscribe / notify", () => {
  it("notifica os assinantes com as 2 visões redigidas a cada applyAction", () => {
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

    const received: unknown[] = [];
    const unsubscribe = subscribe(match.id, (views) => received.push(views));

    applyAction(match.id, "user-1", { kind: "finishTurn" });

    expect(received).toHaveLength(1);
    const views = received[0] as Record<"A" | "B", { seat: string; view: { activePlayer: string; viewer: string } }>;
    expect(views.A.seat).toBe("A");
    expect(views.B.seat).toBe("B");
    expect(views.A.view.viewer).toBe("A");
    expect(views.B.view.viewer).toBe("B");
    expect(views.A.view.activePlayer).toBe("A"); // ainda não trocou -- só entrou no Action Step da End Phase

    // os dois passam o Action Step da End Phase -> aí sim o turno troca de verdade
    applyAction(match.id, "user-2", { kind: "passEndPhaseAction" });
    applyAction(match.id, "user-1", { kind: "passEndPhaseAction" });
    expect(received).toHaveLength(3);
    expect((received[2] as typeof views).A.view.activePlayer).toBe("B");

    unsubscribe();
    applyAction(match.id, "user-2", { kind: "finishTurn" }); // agora é vez de B — não deve notificar mais ninguém
    expect(received).toHaveLength(3);
  });
});

describe("deleteMatch", () => {
  it("remove a partida da memória", () => {
    const match = newMatch();
    deleteMatch(match.id);
    expect(getMatch(match.id)).toBeUndefined();
  });
});

describe("fila de matchmaking (joinQueue / queueStatusFor / leaveQueue)", () => {
  it("pareia automaticamente os 2 primeiros usuários diferentes da fila (FIFO), cada um com o próprio deck", () => {
    const first = joinQueue({ userId: "user-1", displayName: "Willen", deckKey: "ST01", deckList: buildSt01DeckList() });
    expect(first.queued).toBe(true);
    expect(first.matched).toBe(false);

    const second = joinQueue({ userId: "user-2", displayName: "Convidado", deckKey: "ST02", deckList: buildSt02DeckList() });
    expect(second.matched).toBe(true);
    expect(second.matchId).toBeDefined();

    const firstStatus = queueStatusFor("user-1");
    expect(firstStatus.matched).toBe(true);
    expect(firstStatus.matchId).toBe(second.matchId);
    expect(firstStatus.seat).not.toBe(second.seat);

    const match = getMatch(second.matchId!);
    expect(match?.deckKeys).toEqual({ A: "ST01", B: "ST02" });
  });

  it("reentrar na fila com o mesmo usuário é idempotente — só atualiza o deck, nunca pareia consigo mesmo", () => {
    const s1 = joinQueue({ userId: "user-1", displayName: "Willen", deckKey: "ST01", deckList: buildSt01DeckList() });
    expect(s1).toEqual({ queued: true, matched: false });

    const s2 = joinQueue({ userId: "user-1", displayName: "Willen", deckKey: "ST02", deckList: buildSt02DeckList() });
    expect(s2).toEqual({ queued: true, matched: false });
  });

  it("leaveQueue remove o usuário da fila — o próximo a entrar não pareia com quem saiu", () => {
    joinQueue({ userId: "user-1", displayName: "Willen", deckKey: "ST01", deckList: buildSt01DeckList() });
    leaveQueue("user-1");
    expect(queueStatusFor("user-1")).toEqual({ queued: false, matched: false });

    const status = joinQueue({ userId: "user-2", displayName: "Convidado", deckKey: "ST02", deckList: buildSt02DeckList() });
    expect(status).toEqual({ queued: true, matched: false });
  });

  it("joinQueue de quem já está numa partida ativa devolve ela direto (reconexão), sem enfileirar de novo", () => {
    joinQueue({ userId: "user-1", displayName: "Willen", deckKey: "ST01", deckList: buildSt01DeckList() });
    const second = joinQueue({ userId: "user-2", displayName: "Convidado", deckKey: "ST02", deckList: buildSt02DeckList() });
    expect(second.matched).toBe(true);

    const reconnect = joinQueue({ userId: "user-1", displayName: "Willen", deckKey: "ST01", deckList: buildSt01DeckList() });
    expect(reconnect).toEqual({ queued: false, matched: true, matchId: second.matchId, seat: "A" });
  });

  it("depois que a partida acaba, queueStatusFor NÃO reconecta na partida velha — mesmo com o pendingMatches do pareamento ainda lá", () => {
    joinQueue({ userId: "user-1", displayName: "Willen", deckKey: "ST01", deckList: buildSt01DeckList() });
    const paired = joinQueue({ userId: "user-2", displayName: "Convidado", deckKey: "ST02", deckList: buildSt02DeckList() });
    expect(paired.matched).toBe(true);
    // sanity: o polling do sandbox pegaria a partida agora
    expect(queueStatusFor("user-1").matchId).toBe(paired.matchId);

    // user-1 desiste -> fim de jogo (desistência, user-2 vence)
    resignMatch(paired.matchId!, "user-1");

    // ao voltar pro /simulador, os dois devem cair no lobby, não na partida terminada
    expect(queueStatusFor("user-1")).toEqual({ queued: false, matched: false });
    expect(queueStatusFor("user-2")).toEqual({ queued: false, matched: false });
  });

  it("deleteMatch limpa o pendingMatches do pareamento — quem reentra na fila não reconecta na partida sumida", () => {
    joinQueue({ userId: "user-1", displayName: "Willen", deckKey: "ST01", deckList: buildSt01DeckList() });
    const paired = joinQueue({ userId: "user-2", displayName: "Convidado", deckKey: "ST02", deckList: buildSt02DeckList() });
    expect(paired.matched).toBe(true);

    deleteMatch(paired.matchId!);

    // sem o sweep de pendingMatches no deleteMatch, isso reconectaria numa partida que não existe mais
    expect(joinQueue({ userId: "user-1", displayName: "Willen", deckKey: "ST01", deckList: buildSt01DeckList() })).toEqual({
      queued: true,
      matched: false,
    });
  });
});

describe("timer de turno (90s por decisão, passa automático)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sem nenhuma ação em 90s, o servidor encerra o turno sozinho (finishTurn) e reagenda o próximo prazo", () => {
    vi.useFakeTimers();
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

    expect(getMatch(match.id)?.state.activePlayer).toBe("A");
    expect(getMatch(match.id)?.turnDeadlineAt).not.toBeNull();

    // 1º prazo estoura: A não decidiu nada na Main Phase -> servidor chama finishTurn
    // sozinho, que só ABRE o Action Step da End Phase (Comprehensive Rules 7-6) --
    // não troca o jogador ativo ainda, só passa a prioridade pro jogador em espera (B).
    vi.advanceTimersByTime(90_000);
    let after = getMatch(match.id)!;
    expect(after.state.activePlayer).toBe("A"); // ainda não trocou
    expect(after.state.phase).toBe("end");
    expect(after.state.endPhaseAction?.priority).toBe("B");
    expect(after.version).toBe(2);
    expect(after.turnDeadlineAt).not.toBeNull();

    // 2º prazo estoura: B não decidiu nada no Action Step -> passa sozinho -> prioridade volta pra A.
    vi.advanceTimersByTime(90_000);
    after = getMatch(match.id)!;
    expect(after.state.endPhaseAction?.priority).toBe("A");
    expect(after.version).toBe(3);

    // 3º prazo estoura: A também passa sozinho -> os dois passaram -> o turno finalmente troca pra B.
    vi.advanceTimersByTime(90_000);
    after = getMatch(match.id)!;
    expect(after.state.activePlayer).toBe("B");
    expect(after.state.endPhaseAction).toBeNull();
    expect(after.version).toBe(4);
    expect(after.turnDeadlineAt).not.toBeNull();
  });

  it("uma ação real antes do prazo reagenda o timer — o prazo antigo não dispara mais nada", () => {
    vi.useFakeTimers();
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

    vi.advanceTimersByTime(80_000); // ainda dentro do prazo original de A
    applyAction(match.id, "user-1", { kind: "finishTurn" }); // A age por conta própria -- abre o Action Step da End Phase

    const afterAction = getMatch(match.id)!;
    expect(afterAction.state.activePlayer).toBe("A"); // ainda não trocou -- só entrou no Action Step
    expect(afterAction.state.endPhaseAction?.priority).toBe("B");
    expect(afterAction.version).toBe(2);

    // passa da marca dos 90s originais (contados desde a criação), mas só 15s desde a ação real de A --
    // o timer antigo (que estouraria aos 90s da Main Phase) foi cancelado, não duplicou o finishTurn;
    // o timer novo (do Action Step, prioridade de B) só estoura aos 90s a partir da ação de A.
    vi.advanceTimersByTime(15_000);

    const stillWaitingOnB = getMatch(match.id)!;
    expect(stillWaitingOnB.state.endPhaseAction?.priority).toBe("B"); // ainda não estourou de novo
    expect(stillWaitingOnB.version).toBe(2);
  });
});

describe("defaultActionFor — ação-padrão do timer NÃO trava a partida (regressão P0)", () => {
  function stateWithWhenPaired(optional: boolean): GameState {
    const match = newMatch();
    const state = match.state;
    state.pendingDecision.A = {
      kind: "abilityResolution",
      trigger: "When Paired",
      queue: [
        {
          sourceInstanceId: "x",
          specId: "SPEC-1",
          label: "Choose 1 enemy Unit. Rest it.",
          optional,
          needsTarget: true,
          targetScope: "enemyUnit",
        },
      ],
    };
    return state;
  }

  it("com whenPaired pendente: dono da decisão = A, ação-padrão = resolveAbility (não finishTurn)", () => {
    const state = stateWithWhenPaired(false);
    expect(decisionOwner(state)).toBe("A");
    const action = defaultActionFor(state);
    expect(action.kind).toBe("resolveAbility");
    // mandatório sem alvo escolhido -> targetIds: [] -> "nada acontece" (não lança)
    const next = applyPlayerAction(state, "A", action, ALL_EFFECT_SPECS, defaultPredicateResolver);
    expect(next.pendingDecision.A).toBeNull();
  });

  it("efeito optativo AFK: ação-padrão pula (activate: false)", () => {
    const action = defaultActionFor(stateWithWhenPaired(true));
    expect(action.kind === "resolveAbility" && action.resolutions[0].activate).toBe(false);
  });
});

describe("claimAbandonWin (W.O. por abandono, 3min sem sinal de vida do oponente)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejeita declarar W.O. antes de 180s de inatividade do oponente", () => {
    vi.useFakeTimers();
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

    vi.advanceTimersByTime(179_000);

    expect(() => claimAbandonWin(match.id, "user-1")).toThrow(MatchError);
    expect(() => claimAbandonWin(match.id, "user-1")).toThrow(/W\.O\./);
  });

  it("aceita declarar W.O. depois de 180s sem nenhum sinal de vida do oponente", () => {
    vi.useFakeTimers();
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

    vi.advanceTimersByTime(180_000);

    const after = claimAbandonWin(match.id, "user-1");
    expect(after.state.gameOver).toEqual({ winner: "A", reason: "abandonment" });
  });

  it("touchPresence reseta o relógio de abandono do assento — sinal de vida recente barra o W.O.", () => {
    vi.useFakeTimers();
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

    vi.advanceTimersByTime(170_000); // quase lá
    touchPresence(match.id, "user-2"); // B dá sinal de vida de novo (ex.: ping do cliente)

    vi.advanceTimersByTime(15_000); // só 15s desde o touchPresence, não 185s

    expect(() => claimAbandonWin(match.id, "user-1")).toThrow(/W\.O\./);
  });
});

describe("auto-forfeit por AFK prolongado (P4 — o jogo não roda ininterrupto)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("5min sem sinal de vida de quem precisa decidir → GAME_OVER por abandono, timer parado", () => {
    vi.useFakeTimers();
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

    // O servidor joga a ação-padrão sozinho por alguns ciclos de 90s, mas
    // ninguém dá ping/ação — passados 5min, encerra em vez de seguir pra sempre.
    for (let i = 0; i < 4; i++) vi.advanceTimersByTime(90_000);

    const after = getMatch(match.id)!;
    expect(after.state.gameOver?.reason).toBe("abandonment");
    expect(after.turnDeadlineAt).toBeNull();
    const versionAtEnd = after.version;

    // nada mais acontece: sem timer vivo, a versão congela.
    vi.advanceTimersByTime(10 * 90_000);
    expect(getMatch(match.id)?.version).toBe(versionAtEnd);
  });

  it("ping recente do assento AFK adia o auto-forfeit (o jogador ainda está lá)", () => {
    vi.useFakeTimers();
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

    // A cada ~1min os dois lados mandam ping (aba aberta) por 12min de relógio.
    for (let i = 0; i < 12; i++) {
      vi.advanceTimersByTime(60_000);
      touchPresence(match.id, "user-1");
      touchPresence(match.id, "user-2");
    }

    // ninguém jogou de verdade, mas ambos deram sinal de vida → partida segue viva.
    expect(getMatch(match.id)?.state.gameOver).toBeNull();
  });
});

describe("resignMatch (Sair da partida = desistência imediata)", () => {
  it("concede a vitória ao oponente por desistência (reason: resignation), na hora, sem espera", () => {
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

    const after = resignMatch(match.id, "user-1"); // A sai
    expect(after.state.gameOver).toEqual({ winner: "B", reason: "resignation" });
  });

  it("a partida encerrada some de activeMatchForUser / queueStatusFor (não puxa o jogador de volta)", () => {
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

    resignMatch(match.id, "user-1");

    expect(queueStatusFor("user-1")).toEqual({ queued: false, matched: false });
    expect(queueStatusFor("user-2")).toEqual({ queued: false, matched: false });
  });

  it("403 pra quem não é jogador", () => {
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });
    expect(() => resignMatch(match.id, "estranho")).toThrow(MatchError);
    try {
      resignMatch(match.id, "estranho");
    } catch (err) {
      expect((err as MatchError).status).toBe(403);
    }
  });

  it("sem oponente: descarta a partida (não lança 409, não deixa zumbi)", () => {
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    expect(() => resignMatch(match.id, "user-1")).not.toThrow();
    expect(getMatch(match.id)).toBeUndefined();
  });

  it("no-op se a partida já acabou (sem lançar)", () => {
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });
    resignMatch(match.id, "user-1");
    const again = resignMatch(match.id, "user-2"); // já acabou -> no-op
    expect(again.state.gameOver).toEqual({ winner: "B", reason: "resignation" });
  });

  it("registra o fim de jogo no log uma única vez (vencedor / perdedor / motivo)", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const match = newMatch();
      joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
      joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });
      resignMatch(match.id, "user-1");

      const logged = info.mock.calls.map((c) => String(c[0])).filter((s) => s.includes("[GAME-OVER]"));
      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain("winner=B(Convidado)");
      expect(logged[0]).toContain("loser=A(Willen)");
      expect(logged[0]).toContain("reason=resignation");
    } finally {
      info.mockRestore();
    }
  });
});

describe("setAutoPass — auto-pass inteligente do Action Step (docs/19, Sessão 2)", () => {
  it("passa o Action Step da End Phase sozinho pra quem ligou o auto-pass e não tem Command 【Action】", () => {
    const match = newMatch();
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });
    // ninguém tem carta jogável no Action Step
    match.state.players.A.hand = [];
    match.state.players.B.hand = [];

    let m = applyAction(match.id, "user-1", { kind: "finishTurn" });
    expect(m.state.endPhaseAction?.priority).toBe("B");

    m = setAutoPass(match.id, "user-2", true); // B liga -> passa na hora, prioridade vai pra A
    expect(m.state.endPhaseAction?.priority).toBe("A");
    expect(matchViewFor(m, "B").autoPassActionStep).toBe(true);

    m = setAutoPass(match.id, "user-1", true); // A liga -> passa -> os 2 passaram -> turno avança de verdade
    expect(m.state.endPhaseAction).toBeNull();
    expect(m.state.activePlayer).toBe("B");
    expect(m.state.turnNumber).toBe(2);
  });

  it("NÃO passa sozinho se o jogador tem um Command 【Action】 jogável na mão", () => {
    const match = createMatch({ deckA: buildSt01DeckList(), deckB: buildSt01DeckList(), seed: 1, firstPlayer: "A", skipMulligan: true });
    joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });
    match.state.players.A.hand = [];
    // B tem Unforeseen Incident (Command 【Action】, nível 3 / custo 1) + 3 recursos
    const seq = match.state.nextInstanceSeq;
    match.state.players.B.hand = [
      {
        instanceId: `B-t-${seq}`,
        def: { code: "ST01-014", nameEn: "Unforeseen Incident", cardType: "COMMAND", color: "white", level: 3, cost: 1, triggerKeywords: ["Action"] },
        owner: "B", zone: "hand", rested: false, damage: 0, statModifiers: [], keywordGrants: [], usedKeywordsThisTurn: [], enteredZoneOnTurn: 1,
      },
    ];
    match.state.players.B.resourceArea = [0, 1, 2].map((i) => ({
      instanceId: `B-r-${i}`, def: { code: "R", nameEn: "R", cardType: "RESOURCE", color: "colorless" } as const,
      owner: "B" as const, zone: "resourceArea" as const, rested: false, damage: 0, statModifiers: [], keywordGrants: [], usedKeywordsThisTurn: [], enteredZoneOnTurn: 1,
    }));

    let m = applyAction(match.id, "user-1", { kind: "finishTurn" });
    m = setAutoPass(match.id, "user-2", true);
    // B tem jogada real -> auto-pass NÃO dispara, continua sendo a vez dele
    expect(m.state.endPhaseAction?.priority).toBe("B");
  });
});

describe("reportSituation — ferramenta in-game de relatório (docs/19, Sessão 4)", () => {
  it("devolve um reportId curto pra quem é jogador da partida", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const match = newMatch();
      joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
      joinMatch(match.id, "B", { userId: "user-2", displayName: "Convidado" });

      const { reportId } = reportSituation(match.id, "user-1", "o botão de atacar sumiu");
      expect(reportId).toMatch(/^[A-Z0-9]{6}$/);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(reportId));
    } finally {
      warn.mockRestore();
    }
  });

  it("recusa quem não é jogador da partida", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const match = newMatch();
      joinMatch(match.id, "A", { userId: "user-1", displayName: "Willen" });
      expect(() => reportSituation(match.id, "estranho", "oi")).toThrow(/não é jogador/);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("GC oportunista do store (docs/19, Sessão 4)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("partida terminada some 10min depois, na próxima escrita no store", () => {
    vi.useFakeTimers();
    const finished = createMatch({ deckA: buildSt01DeckList(), deckB: buildSt01DeckList(), seed: 1, firstPlayer: "A", skipMulligan: true });
    joinMatch(finished.id, "A", { userId: "u1", displayName: "A" });
    joinMatch(finished.id, "B", { userId: "u2", displayName: "B" });
    finished.state = { ...finished.state, gameOver: { winner: "A", reason: "deckOut" } };
    finished.updatedAt = Date.now();

    vi.advanceTimersByTime(11 * 60_000);

    // uma escrita qualquer no store dispara o sweep
    joinQueue({ userId: "u3", displayName: "C", deckKey: "ST01", deckList: buildSt01DeckList() });

    expect(getMatch(finished.id)).toBeUndefined();
  });
});

describe("persistência (docs/23) — write-through + re-hidratação", () => {
  /** persistência fake em memória — simula o Supabase/Prisma sem banco. */
  function fakePersistence() {
    const rows = new Map<string, StoredMatch>();
    let upserts = 0;
    const impl: MatchPersistence = {
      async upsert(m) {
        upserts += 1;
        rows.set(m.id, JSON.parse(JSON.stringify(m)) as StoredMatch);
      },
      async load(id) {
        const r = rows.get(id);
        return r ? (JSON.parse(JSON.stringify(r)) as StoredMatch) : null;
      },
      async remove(id) {
        rows.delete(id);
      },
    };
    return { impl, rows, get upserts() { return upserts; } };
  }

  it("cada ação persiste; limpar o Map + loadMatch re-hidrata o estado e re-arma o timer", async () => {
    const p = fakePersistence();
    setMatchPersistence(p.impl);

    const match = createMatch({ deckA: buildSt01DeckList(), deckB: buildSt02DeckList(), seed: 1, firstPlayer: "A", skipMulligan: true });
    joinMatch(match.id, "A", { userId: "u1", displayName: "A" });
    joinMatch(match.id, "B", { userId: "u2", displayName: "B" });
    applyAction(match.id, "u1", { kind: "finishTurn" });

    // o fire-and-forget do persist já rodou (microtask) — aguarda a fila
    await Promise.resolve();
    expect(p.upserts).toBeGreaterThan(0);
    const stored = p.rows.get(match.id)!;
    expect(stored.state.phase).toBe("end"); // finishTurn abriu o Action Step da End Phase
    expect(stored.seats.A?.userId).toBe("u1");

    // simula um restart do servidor: o Map some, o banco fica
    deleteMatch(match.id);
    p.rows.set(match.id, stored); // deleteMatch também apagou a linha; recoloca (simula "servidor caiu ANTES do delete")
    expect(getMatch(match.id)).toBeUndefined();

    const rehydrated = await loadMatch(match.id);
    expect(rehydrated).toBeDefined();
    expect(rehydrated!.state.phase).toBe("end");
    expect(rehydrated!.seats.A?.userId).toBe("u1");
    expect(getMatch(match.id)?.id).toBe(match.id); // voltou pro Map
    // timer re-armado (os 2 assentos ocupados + há decisionOwner no Action Step)
    expect(getMatch(match.id)?.turnDeadlineAt).not.toBeNull();
  });

  it("sem persistência injetada (default), loadMatch só olha o Map", async () => {
    const match = createMatch({ deckA: buildSt01DeckList(), deckB: buildSt02DeckList(), seed: 1, firstPlayer: "A", skipMulligan: true });
    expect(await loadMatch(match.id)).toBe(getMatch(match.id));
    deleteMatch(match.id);
    expect(await loadMatch(match.id)).toBeUndefined();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import {
  _resetAllMatchesForTests,
  applyAction,
  createMatch,
  deleteMatch,
  getMatch,
  joinMatch,
  MatchError,
  seatFor,
  subscribe,
} from "./matchStore";

afterEach(() => {
  _resetAllMatchesForTests();
});

function newMatch() {
  return createMatch({ deckA: buildSt01DeckList(), deckB: buildSt02DeckList(), seed: 1, firstPlayer: "A" });
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

    const updated = applyAction(match.id, "user-1", { kind: "finishTurn" });
    expect(updated.state.activePlayer).toBe("B");
    expect(updated.version).toBe(2);
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
    const views = received[0] as Record<"A" | "B", { activePlayer: string; viewer: string }>;
    expect(views.A.viewer).toBe("A");
    expect(views.B.viewer).toBe("B");
    expect(views.A.activePlayer).toBe("B");

    unsubscribe();
    applyAction(match.id, "user-2", { kind: "finishTurn" }); // agora é vez de B — não deve notificar mais ninguém
    expect(received).toHaveLength(1);
  });
});

describe("deleteMatch", () => {
  it("remove a partida da memória", () => {
    const match = newMatch();
    deleteMatch(match.id);
    expect(getMatch(match.id)).toBeUndefined();
  });
});

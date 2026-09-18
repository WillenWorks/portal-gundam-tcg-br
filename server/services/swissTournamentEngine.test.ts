import { describe, expect, it } from "vitest";
import {
  computeSwissStandings,
  generateSwissPairings,
  generateTopCutBracket,
  type SwissParticipant,
  type SwissMatch,
} from "./swissTournamentEngine";

function createParticipants(count: number): SwissParticipant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    userId: `user${i + 1}`,
    displayName: `Jogador ${i + 1}`,
    username: `jogador_${i + 1}`,
    deckName: `Deck ${i + 1}`,
  }));
}

describe("Swiss Tournament Engine — Motor Suíço Determinístico", () => {
  describe("computeSwissStandings & Tie-Breakers", () => {
    it("calcula pontuações básicas corretamente (3 pts vitória, 1 empate, 0 derrota, 3 BYE)", () => {
      const players = createParticipants(4);
      const matches: SwissMatch[] = [
        { roundNumber: 1, tableNumber: 1, participantAId: "p1", participantBId: "p2", result: "PLAYER_A_WIN" },
        { roundNumber: 1, tableNumber: 2, participantAId: "p3", participantBId: "p4", result: "DRAW" },
      ];

      const standings = computeSwissStandings(players, matches);

      expect(standings[0].participantId).toBe("p1");
      expect(standings[0].matchPoints).toBe(3);
      expect(standings[0].matchWins).toBe(1);

      // p3 e p4 empataram -> 1 ponto cada
      const p3Row = standings.find((r) => r.participantId === "p3")!;
      const p4Row = standings.find((r) => r.participantId === "p4")!;
      expect(p3Row.matchPoints).toBe(1);
      expect(p4Row.matchPoints).toBe(1);

      // p2 perdeu -> 0 pontos
      const p2Row = standings.find((r) => r.participantId === "p2")!;
      expect(p2Row.matchPoints).toBe(0);
      expect(p2Row.matchLosses).toBe(1);
    });

    it("aplica o piso mínimo de 33% (0.33) no cálculo de OMW%", () => {
      const players = createParticipants(4);
      // p1 venceu p2 (que tem 0% de vitórias) -> OMW de p1 deve ser 0.33 devido ao piso
      const matches: SwissMatch[] = [
        { roundNumber: 1, tableNumber: 1, participantAId: "p1", participantBId: "p2", result: "PLAYER_A_WIN" },
        { roundNumber: 1, tableNumber: 2, participantAId: "p3", participantBId: "p4", result: "PLAYER_A_WIN" },
      ];

      const standings = computeSwissStandings(players, matches);
      const p1Row = standings.find((r) => r.participantId === "p1")!;
      expect(p1Row.omwPercent).toBeCloseTo(0.33, 2);
    });

    it("desempata corretamente jogadores com mesmos pontos pelo OMW% mais forte", () => {
      const players = createParticipants(6);
      // Rodada 1
      // p1 vence p2
      // p3 vence p4
      // p5 vence p6
      // Rodada 2
      // p1 vence p3 (p3 tem 3 pts)
      // p5 vence p2 (p2 tem 0 pts)
      // Tanto p1 quanto p5 têm 6 pontos (2-0).
      // Oponente de p1: p2 (0 vitórias) e p3 (1 vitória). Média MWR = (0.33 + 0.50) / 2 = 0.415
      // Oponente de p5: p6 (0 vitórias) e p2 (0 vitórias). Média MWR = (0.33 + 0.33) / 2 = 0.33
      // Portanto, p1 deve ficar em 1º lugar pelo OMW%!
      const matches: SwissMatch[] = [
        { roundNumber: 1, tableNumber: 1, participantAId: "p1", participantBId: "p2", result: "PLAYER_A_WIN" },
        { roundNumber: 1, tableNumber: 2, participantAId: "p3", participantBId: "p4", result: "PLAYER_A_WIN" },
        { roundNumber: 1, tableNumber: 3, participantAId: "p5", participantBId: "p6", result: "PLAYER_A_WIN" },
        { roundNumber: 2, tableNumber: 1, participantAId: "p1", participantBId: "p3", result: "PLAYER_A_WIN" },
        { roundNumber: 2, tableNumber: 2, participantAId: "p5", participantBId: "p2", result: "PLAYER_A_WIN" },
      ];

      const standings = computeSwissStandings(players, matches);
      expect(standings[0].participantId).toBe("p1");
      expect(standings[1].participantId).toBe("p5");
      expect(standings[0].omwPercent).toBeGreaterThan(standings[1].omwPercent);
    });
  });

  describe("generateSwissPairings & Prevenção Estrita de Rematches", () => {
    it("gera pareamentos válidos para a Rodada 1 com número par de jogadores", () => {
      const players = createParticipants(6);
      const pairings = generateSwissPairings(players, [], 1);

      expect(pairings).toHaveLength(3);
      expect(pairings.every((p) => !p.isBye && p.participantBId !== null)).toBe(true);

      const assignedPlayers = new Set<string>();
      for (const p of pairings) {
        assignedPlayers.add(p.participantAId);
        assignedPlayers.add(p.participantBId!);
      }
      expect(assignedPlayers.size).toBe(6);
    });

    it("atribui exatamente um BYE para número ímpar de participantes", () => {
      const players = createParticipants(5);
      const pairings = generateSwissPairings(players, [], 1);

      expect(pairings).toHaveLength(3); // 2 mesas + 1 BYE
      const byeMatch = pairings.find((p) => p.isBye);
      expect(byeMatch).toBeDefined();
      expect(byeMatch?.participantBId).toBeNull();
    });

    it("garante ZERO rematches ao longo de 3 rodadas completas em 8 jogadores", () => {
      const players = createParticipants(8);
      const allMatches: SwissMatch[] = [];

      // Simula 3 rodadas
      for (let round = 1; round <= 3; round++) {
        const pairings = generateSwissPairings(players, allMatches, round);
        expect(pairings).toHaveLength(4);

        // Verifica que nenhum confronto desta rodada é um rematch
        for (const p of pairings) {
          const alreadyPlayed = allMatches.some(
            (m) =>
              (m.participantAId === p.participantAId && m.participantBId === p.participantBId) ||
              (m.participantAId === p.participantBId && m.participantBId === p.participantAId),
          );
          expect(alreadyPlayed).toBe(false);
        }

        // Lança resultados determinísticos para avançar para a próxima rodada
        for (const p of pairings) {
          allMatches.push({
            roundNumber: round,
            tableNumber: p.tableNumber,
            participantAId: p.participantAId,
            participantBId: p.participantBId,
            result: "PLAYER_A_WIN",
          });
        }
      }

      expect(allMatches).toHaveLength(12);
    });

    it("não concede BYE duas vezes para o mesmo jogador", () => {
      const players = createParticipants(5);
      const allMatches: SwissMatch[] = [];

      // Rodada 1
      const pairingsR1 = generateSwissPairings(players, allMatches, 1);
      const byePlayerR1 = pairingsR1.find((p) => p.isBye)!.participantAId;

      for (const p of pairingsR1) {
        allMatches.push({
          roundNumber: 1,
          tableNumber: p.tableNumber,
          participantAId: p.participantAId,
          participantBId: p.participantBId,
          result: p.isBye ? "BYE" : "PLAYER_A_WIN",
        });
      }

      // Rodada 2
      const pairingsR2 = generateSwissPairings(players, allMatches, 2);
      const byePlayerR2 = pairingsR2.find((p) => p.isBye)!.participantAId;

      // O jogador que recebeu BYE na R1 não pode receber BYE na R2!
      expect(byePlayerR2).not.toBe(byePlayerR1);
    });
  });

  describe("generateTopCutBracket", () => {
    it("gera chaveamento Top 4 correto (1v4 e 2v3)", () => {
      const players = createParticipants(8);
      // Standings mock com 8 jogadores
      const standings = players.map((p, idx) => ({
        rank: idx + 1,
        participantId: p.id,
        userId: p.userId,
        displayName: p.displayName,
        matchPoints: (8 - idx) * 3,
        matchesPlayed: 3,
        matchWins: 8 - idx,
        matchDraws: 0,
        matchLosses: idx,
        byes: 0,
        gamesWon: 6,
        gamesLost: 2,
        gamesDraw: 0,
        matchWinRate: 0.8,
        gameWinRate: 0.75,
        omwPercent: 0.5,
        ogwPercent: 0.5,
        opponentsFaced: [],
      }));

      const top4 = generateTopCutBracket(standings, players, 4);

      expect(top4.cutSize).toBe(4);
      expect(top4.matches).toHaveLength(2);
      expect(top4.matches[0].seedA).toBe(1);
      expect(top4.matches[0].seedB).toBe(4);
      expect(top4.matches[1].seedA).toBe(2);
      expect(top4.matches[1].seedB).toBe(3);
    });

    it("gera chaveamento Top 8 correto (1v8, 4v5, 2v7, 3v6)", () => {
      const players = createParticipants(10);
      const standings = players.map((p, idx) => ({
        rank: idx + 1,
        participantId: p.id,
        userId: p.userId,
        displayName: p.displayName,
        matchPoints: (10 - idx) * 3,
        matchesPlayed: 4,
        matchWins: 10 - idx,
        matchDraws: 0,
        matchLosses: idx,
        byes: 0,
        gamesWon: 8,
        gamesLost: 2,
        gamesDraw: 0,
        matchWinRate: 0.8,
        gameWinRate: 0.75,
        omwPercent: 0.5,
        ogwPercent: 0.5,
        opponentsFaced: [],
      }));

      const top8 = generateTopCutBracket(standings, players, 8);

      expect(top8.cutSize).toBe(8);
      expect(top8.matches).toHaveLength(4);
      expect(top8.matches[0].seedA).toBe(1);
      expect(top8.matches[0].seedB).toBe(8);
      expect(top8.matches[1].seedA).toBe(4);
      expect(top8.matches[1].seedB).toBe(5);
      expect(top8.matches[2].seedA).toBe(2);
      expect(top8.matches[2].seedB).toBe(7);
      expect(top8.matches[3].seedA).toBe(3);
      expect(top8.matches[3].seedB).toBe(6);
    });

    it("lança erro se o número de classificados for inferior ao corte", () => {
      const players = createParticipants(3);
      const standings = players.map((p, idx) => ({
        rank: idx + 1,
        participantId: p.id,
        userId: p.userId,
        displayName: p.displayName,
        matchPoints: 3,
        matchesPlayed: 1,
        matchWins: 1,
        matchDraws: 0,
        matchLosses: 0,
        byes: 0,
        gamesWon: 2,
        gamesLost: 0,
        gamesDraw: 0,
        matchWinRate: 1,
        gameWinRate: 1,
        omwPercent: 0.5,
        ogwPercent: 0.5,
        opponentsFaced: [],
      }));

      expect(() => generateTopCutBracket(standings, players, 4)).toThrow(/participantes suficientes/);
    });
  });
});

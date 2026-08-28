import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildVanillaDeckList, VANILLA_CARD_DEFS } from "../fixtures/vanillaDeck";
import type { CardDef, CardInstance, GameState, PlayerId } from "./types";
import { PLAYER_IDS } from "./types";
import { advanceToMainPhase, finishTurnAndAdvance } from "./phases";
import { declareAttack, passAction, proceedToBlockStep, resolveBattleEndStep, resolveDamageStep, skipBlock } from "./combat";

/**
 * Passo 2 do plano incremental (docs/18): "validar contra o deck vanilla"
 * exige uma partida de ponta a ponta simulada por teste, não só regras
 * isoladas por unidade. Este arquivo roda uma partida completa — várias
 * dezenas de ciclos de Start/Draw/Resource/Main/End, combate incluído —
 * até bater numa condição oficial de derrota (Comprehensive Rules 1-2-2-1
 * ou 1-2-2-2), checando invariantes de zona (limite de mão, contagem de
 * shields) a cada turno inteiro. Isso pega bugs de integração que os
 * testes unitários de fases/combate isolados não pegam: acúmulo de estado
 * ao longo de várias fases End Phase (descarte por limite de mão repetido),
 * `cloneState` sendo chamado centenas de vezes sem vazar referência, e a
 * troca de turno alternando corretamente por muitos ciclos.
 *
 * "Jogar carta da mão" ainda não existe no motor (ver docs/18, passo 3) —
 * então, como em combat.test.ts, uma Unit é colocada direto na Battle Area
 * antes do início da partida via mutação direta de `state` (convenção de
 * fixture de teste documentada ali; o motor em si nunca faz isso).
 */

let seq = 0;
function deployUnit(state: GameState, player: PlayerId, def: CardDef): string {
  const instanceId = `${player}-deploy-${seq++}`;
  const card: CardInstance = {
    instanceId,
    def,
    owner: player,
    zone: "battleArea",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber,
  };
  state.players[player].battleArea.push(card);
  return instanceId;
}

/** Ataca o jogador oponente direto, passa Block/Action sem decisão, resolve dano e fecha a batalha. */
function runFullCombat(state: GameState, attackerId: string): GameState {
  let next = declareAttack(state, attackerId, "player");
  next = proceedToBlockStep(next);
  next = skipBlock(next);
  next = passAction(next, next.combat!.defendingPlayer);
  next = passAction(next, next.combat!.attackingPlayer);
  next = resolveDamageStep(next);
  if (next.gameOver) return next; // GAME_OVER pode disparar dentro do Damage Step (shield damage sem shield)
  next = resolveBattleEndStep(next);
  return next;
}

describe("partida completa de ponta a ponta (deck vanilla, docs/18 passo 2)", () => {
  it.each([9, 42])("roda vários turnos sem exceção e termina numa condição oficial de derrota (seed=%i)", (seed) => {
    let state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed, firstPlayer: "A" });
    deployUnit(state, "A", VANILLA_CARD_DEFS.HEAVY_01);
    deployUnit(state, "B", VANILLA_CARD_DEFS.HEAVY_01);

    state = advanceToMainPhase(state);

    const MAX_TURNS = 200;
    let turns = 0;
    const invariantViolations: string[] = [];

    while (!state.gameOver && turns < MAX_TURNS) {
      const attackers = state.players[state.activePlayer].battleArea.filter((u) => !u.rested);
      for (const unit of attackers) {
        if (state.gameOver) break;
        state = runFullCombat(state, unit.instanceId);
      }
      if (state.gameOver) break;

      // limite de mão só é forçado na End Phase de quem está terminando o turno (Comprehensive
      // Rules) — o jogador que vai começar o próximo turno ainda vai comprar (Draw Phase, dentro
      // de finishTurnAndAdvance) antes de ter sua própria End Phase, então pode passar de 10
      // temporariamente; checar só quem acabou de passar pela End Phase evita falso positivo.
      const endingPlayer = state.activePlayer;
      state = finishTurnAndAdvance(state);
      turns++;

      const endingHand = state.players[endingPlayer].hand.length;
      if (endingHand > 10) {
        invariantViolations.push(`turno ${turns}: mão de ${endingPlayer} com ${endingHand} cartas após a End Phase (limite é 10)`);
      }
      for (const pid of PLAYER_IDS) {
        const shieldCount = state.players[pid].shields.length;
        if (shieldCount < 0 || shieldCount > 6) {
          invariantViolations.push(`turno ${turns}: ${pid} com ${shieldCount} shields (fora de [0,6])`);
        }
      }
    }

    expect(invariantViolations).toEqual([]);
    expect(turns).toBeLessThan(MAX_TURNS); // não bateu no teto de segurança — a partida terminou naturalmente
    expect(state.gameOver).not.toBeNull();
    expect(["deckOut", "noShieldsBattleDamage"]).toContain(state.gameOver!.reason);
    expect(state.eventLog.length).toBeGreaterThan(0);
    expect(state.eventLog.at(-1)?.type).toBe("GAME_OVER");
  });
});

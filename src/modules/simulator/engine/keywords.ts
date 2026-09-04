import type { GameEvent, GameState, PlayerId } from "./types";
import { hasKeyword, keywordValue } from "./types";
import { applyEvents, findCard } from "./events";

/**
 * Keywords oficiais que não fazem parte da sequência de combate (essas
 * ficam em combat.ts: Blocker, First Strike, High-Maneuver, Breach,
 * Suppression). Aqui: Support (ação de Main Phase) e Repair (gatilho de End
 * Phase). 【Once per Turn】 é tratado como uma trava genérica reaproveitada
 * pelas duas.
 *
 * Ver docs/18 "Keywords oficiais → mapeamento pra DSL".
 */

/** <Support N>: [Activate·Main], rest, +N AP em outra Unit amiga neste turno. */
export function activateSupport(state: GameState, sourceId: string, targetId: string): GameState {
  if (state.phase !== "main") throw new Error("<Support> só pode ser ativado na Main Phase");
  if (state.combat) throw new Error("<Support> não pode ser ativado durante um combate");

  const source = findCard(state, sourceId);
  const target = findCard(state, targetId);

  if (source.owner !== state.activePlayer) throw new Error("Só o jogador ativo pode ativar <Support>");
  if (source.zone !== "battleArea") throw new Error("<Support> só pode ser ativado por Unit na Battle Area");
  if (source.rested) throw new Error("Unit rested não pode ativar <Support>");
  if (!hasKeyword(source, "Support")) throw new Error("Essa Unit não tem <Support>");
  if (targetId === sourceId) throw new Error("<Support> precisa mirar em outra Unit amiga");
  if (target.owner !== state.activePlayer || target.zone !== "battleArea") {
    throw new Error("<Support> só pode mirar em outra Unit amiga na Battle Area");
  }
  if (source.def.oncePerTurn && source.usedKeywordsThisTurn.includes("Support")) {
    throw new Error("【Once per Turn】: <Support> dessa instância já foi usado neste turno");
  }

  const amount = keywordValue(source, "Support") ?? 0;
  const events: GameEvent[] = [
    { type: "REST_CARD", instanceId: sourceId },
    {
      type: "MODIFY_STAT",
      instanceId: targetId,
      modifier: { stat: "ap", amount, duration: "endOfTurn", appliedOnTurn: state.turnNumber },
    },
  ];
  if (source.def.oncePerTurn) {
    events.push({ type: "MARK_KEYWORD_USED", instanceId: sourceId, keyword: "Support" });
  }
  return applyEvents(state, events);
}

/**
 * <Repair N>: no fim do turno, cura N HP (acumula, sem limite descrito nas
 * regras além do HP máximo — `HEAL_UNIT` já não deixa dano ficar negativo).
 * Roda pra Units/Bases do jogador ativo — quem tem <Repair> some o próprio
 * dano no fim do turno em que controla a carta.
 */
export function computeRepairEvents(state: GameState, player: PlayerId): GameEvent[] {
  const events: GameEvent[] = [];
  const owner = state.players[player];
  for (const zone of ["battleArea", "baseSection"] as const) {
    for (const card of owner[zone]) {
      const repairValue = keywordValue(card, "Repair");
      if (repairValue && repairValue > 0 && card.damage > 0) {
        events.push({ type: "HEAL_UNIT", instanceId: card.instanceId, amount: repairValue });
      }
    }
  }
  return events;
}

export function runRepairStep(state: GameState, player: PlayerId): GameState {
  return applyEvents(state, computeRepairEvents(state, player));
}

import type { AttackTarget, CardInstance, GameEvent, GameState, PlayerId } from "./types";
import { effectiveAp, hasKeyword, keywordValue, otherPlayer } from "./types";
import { applyEvent, applyEvents, findCard } from "./events";

/**
 * Sequência de combate (Comprehensive Rules seção 8, ver docs/18 "Estrutura
 * de turno" → "Sequência de combate"). Cada Attack Step é conduzido passo a
 * passo, expondo uma função por decisão, pra dar pra dirigir tanto de teste
 * quanto de UI (nenhuma das duas decide "sozinha" o que acontece).
 */

function requireCombat(state: GameState) {
  if (!state.combat) throw new Error("Nenhum combate em andamento");
  return state.combat;
}

// ---------------------------------------------------------------------------
// 1. Attack Step
// ---------------------------------------------------------------------------

export function declareAttack(state: GameState, attackerId: string, target: AttackTarget): GameState {
  const attacker = findCard(state, attackerId);
  if (attacker.zone !== "battleArea") throw new Error("Só Units na Battle Area podem atacar");
  if (attacker.owner !== state.activePlayer) throw new Error("Só o jogador ativo pode declarar ataque");
  if (attacker.rested) throw new Error("Unit rested não pode atacar");
  if (state.phase !== "main") throw new Error("Ataque só pode ser declarado na Main Phase");
  if (state.combat) throw new Error("Já existe um combate em andamento");

  const defendingPlayer = otherPlayer(state.activePlayer);
  if (typeof target === "object") {
    const targetUnit = findCard(state, target.unitId);
    if (targetUnit.owner !== defendingPlayer || targetUnit.zone !== "battleArea") {
      throw new Error("Alvo precisa ser uma Unit inimiga na Battle Area");
    }
    if (!targetUnit.rested) throw new Error("Só é possível declarar ataque contra Unit inimiga rested");
  }

  const events: GameEvent[] = [
    { type: "REST_CARD", instanceId: attackerId },
    {
      type: "ATTACK_DECLARED",
      attackerId,
      attackingPlayer: state.activePlayer,
      defendingPlayer,
      target,
    },
  ];
  return applyEvents(state, events);
}

/**
 * Fecha o Attack Step e entra no Block Step. Ponto de extensão futuro pra
 * efeitos 【Attack】 bespoke (autoria carta a carta, fora de escopo da Fase 1
 * ainda) — hoje só troca a fase do combate.
 */
export function proceedToBlockStep(state: GameState): GameState {
  const combat = requireCombat(state);
  if (combat.step !== "attack") throw new Error("Não é o Attack Step");
  return applyEvent(state, { type: "COMBAT_STEP_CHANGE", step: "block" });
}

// ---------------------------------------------------------------------------
// 2. Block Step
// ---------------------------------------------------------------------------

/** <High-Maneuver>: "opponent can't activate Blocker while this Unit attacks" */
export function canActivateBlocker(state: GameState): boolean {
  const combat = requireCombat(state);
  const attacker = findCard(state, combat.attackerId);
  return !hasKeyword(attacker, "High-Maneuver");
}

export function activateBlocker(state: GameState, blockerId: string): GameState {
  const combat = requireCombat(state);
  if (combat.step !== "block") {
    throw new Error("Só é possível ativar <Blocker> durante o Block Step");
  }
  if (!canActivateBlocker(state)) {
    throw new Error("<High-Maneuver>: bloqueio não pode ser ativado contra esta Unit");
  }
  const blocker = findCard(state, blockerId);
  if (blocker.owner !== combat.defendingPlayer) throw new Error("Blocker precisa pertencer a quem está defendendo");
  if (blocker.zone !== "battleArea") throw new Error("Blocker precisa estar na Battle Area");
  if (blocker.rested) throw new Error("Blocker precisa estar active pra ser ativado");
  if (!hasKeyword(blocker, "Blocker")) throw new Error("Essa Unit não tem <Blocker>");

  const events: GameEvent[] = [
    { type: "REST_CARD", instanceId: blockerId },
    { type: "BLOCK_DECLARED", blockerId, newTarget: { unitId: blockerId } },
    { type: "COMBAT_STEP_CHANGE", step: "action" },
  ];
  return applyEvents(state, events);
}

/** Jogador em espera decide não bloquear — combate segue pro Action Step sem mudar o alvo. */
export function skipBlock(state: GameState): GameState {
  const combat = requireCombat(state);
  if (combat.step !== "block") throw new Error("Só é possível pular o Block Step durante o Block Step");
  return applyEvent(state, { type: "COMBAT_STEP_CHANGE", step: "action" });
}

// ---------------------------------------------------------------------------
// 3. Action Step — jogadores alternam, começando pelo jogador em espera, até
// os dois passarem em sequência (Comprehensive Rules — ver docs/18). A Fase
// 1 ainda não tem cartas 【Action】/【Activate·Action】 implementadas via DSL
// (isso é trabalho de conteúdo por carta, não do motor em si), então por
// enquanto a única ação disponível aqui é passar — mas o desenho já respeita
// o formato de prioridade alternada pra não precisar redesenhar na Fase 3.
// ---------------------------------------------------------------------------

export function passAction(state: GameState, player: PlayerId): GameState {
  const combat = requireCombat(state);
  if (combat.step !== "action") throw new Error("Não é o Action Step");
  if (combat.actionPriority !== player) throw new Error("Não é a prioridade desse jogador");

  let next = applyEvent(state, { type: "ACTION_PASS", player });
  const bothPassed = next.combat!.actionPasses.A && next.combat!.actionPasses.B;
  if (bothPassed) {
    next = applyEvent(next, { type: "COMBAT_STEP_CHANGE", step: "damage" });
  }
  return next;
}

// ---------------------------------------------------------------------------
// 4. Damage Step
// ---------------------------------------------------------------------------

function shieldDamageEvents(defendingPlayer: PlayerId, count: number, state: GameState): GameEvent[] {
  const shields = state.players[defendingPlayer].shields;
  if (shields.length === 0) {
    // Comprehensive Rules 1-2-2-1: recebeu dano de batalha sem shield = derrota
    return [{ type: "GAME_OVER", winner: otherPlayer(defendingPlayer), reason: "noShieldsBattleDamage" }];
  }
  return [{ type: "DAMAGE_SHIELD", player: defendingPlayer, count }];
}

function breachEvents(attacker: CardInstance, defendingPlayer: PlayerId, state: GameState): GameEvent[] {
  const breachValue = keywordValue(attacker, "Breach");
  if (breachValue === null || breachValue <= 0) return [];
  return shieldDamageEvents(defendingPlayer, breachValue, state);
}

export function resolveDamageStep(state: GameState): GameState {
  const combat = requireCombat(state);
  if (combat.step !== "damage") throw new Error("Não é o Damage Step");

  const attacker = findCard(state, combat.attackerId);
  const attackerHasFirstStrike = hasKeyword(attacker, "First Strike");
  const events: GameEvent[] = [];

  if (combat.currentTarget === "player") {
    const defendingPlayer = combat.defendingPlayer;
    const base = state.players[defendingPlayer].baseSection[0];
    if (base) {
      events.push({ type: "DAMAGE_BASE", instanceId: base.instanceId, amount: effectiveAp(attacker) });
      const projectedDamage = base.damage + effectiveAp(attacker);
      if (projectedDamage >= (base.def.hp ?? 0)) {
        events.push({ type: "DESTROY_CARD", instanceId: base.instanceId });
      }
    } else {
      const suppression = hasKeyword(attacker, "Suppression");
      events.push(...shieldDamageEvents(defendingPlayer, suppression ? 2 : 1, state));
    }
  } else {
    const defender = findCard(state, combat.currentTarget.unitId);
    const defenderHasFirstStrike = hasKeyword(defender, "First Strike");
    const onlyAttackerFirstStrike = attackerHasFirstStrike && !defenderHasFirstStrike;
    const onlyDefenderFirstStrike = defenderHasFirstStrike && !attackerHasFirstStrike;

    const attackerAp = effectiveAp(attacker);
    const defenderAp = effectiveAp(defender);
    const defenderWillDie = defender.damage + attackerAp >= (defender.def.hp ?? 0);
    const attackerWillDie = attacker.damage + defenderAp >= (attacker.def.hp ?? 0);

    if (onlyAttackerFirstStrike) {
      events.push({ type: "DAMAGE_UNIT", instanceId: defender.instanceId, amount: attackerAp });
      if (defenderWillDie) {
        events.push({ type: "DESTROY_CARD", instanceId: defender.instanceId });
        events.push(...pairedPilotFollowEvents(defender));
        events.push(...breachEvents(attacker, combat.defendingPlayer, state));
        // 13-1-5-2: destruiu com First Strike -> não recebe dano de volta
      } else {
        events.push({ type: "DAMAGE_UNIT", instanceId: attacker.instanceId, amount: defenderAp });
        if (attackerWillDie) {
          events.push({ type: "DESTROY_CARD", instanceId: attacker.instanceId });
          events.push(...pairedPilotFollowEvents(attacker));
        }
      }
    } else if (onlyDefenderFirstStrike) {
      events.push({ type: "DAMAGE_UNIT", instanceId: attacker.instanceId, amount: defenderAp });
      if (attackerWillDie) {
        events.push({ type: "DESTROY_CARD", instanceId: attacker.instanceId });
        events.push(...pairedPilotFollowEvents(attacker));
      } else {
        events.push({ type: "DAMAGE_UNIT", instanceId: defender.instanceId, amount: attackerAp });
        if (defenderWillDie) {
          events.push({ type: "DESTROY_CARD", instanceId: defender.instanceId });
          events.push(...pairedPilotFollowEvents(defender));
          events.push(...breachEvents(attacker, combat.defendingPlayer, state));
        }
      }
    } else {
      // simultâneo — ou nenhum tem First Strike, ou os dois têm (se cancelam, ver comentário abaixo)
      events.push({ type: "DAMAGE_UNIT", instanceId: defender.instanceId, amount: attackerAp });
      events.push({ type: "DAMAGE_UNIT", instanceId: attacker.instanceId, amount: defenderAp });
      if (defenderWillDie) {
        events.push({ type: "DESTROY_CARD", instanceId: defender.instanceId });
        events.push(...pairedPilotFollowEvents(defender));
        events.push(...breachEvents(attacker, combat.defendingPlayer, state));
      }
      if (attackerWillDie) {
        events.push({ type: "DESTROY_CARD", instanceId: attacker.instanceId });
        events.push(...pairedPilotFollowEvents(attacker));
      }
      // nota: quando ambos têm <First Strike>, 13-1-5-2 não cobre o caso — tratamos
      // como dano simultâneo (nenhum dos dois "primeiro" o suficiente pra anular o
      // outro). Reavaliar se algum ruling oficial específico aparecer.
    }
  }

  return applyEvents(state, events);
}

function pairedPilotFollowEvents(unit: CardInstance): GameEvent[] {
  // Comprehensive Rules 3-3-6: Pilot pareado segue a Unit pro mesmo destino
  if (!unit.pairedPilotId) return [];
  return [{ type: "DESTROY_CARD", instanceId: unit.pairedPilotId }];
}

// ---------------------------------------------------------------------------
// 5. Battle End Step
// ---------------------------------------------------------------------------

export function resolveBattleEndStep(state: GameState): GameState {
  const combat = requireCombat(state);
  if (combat.step !== "damage") throw new Error("Precisa resolver o Damage Step antes");
  const next = applyEvent(state, { type: "COMBAT_STEP_CHANGE", step: "battleEnd" });

  // limpa modificadores "thisBattle" nos dois lados
  for (const playerId of ["A", "B"] as PlayerId[]) {
    const player = next.players[playerId];
    for (const zone of ["battleArea", "baseSection"] as const) {
      for (const card of player[zone]) {
        card.statModifiers = card.statModifiers.filter((m) => m.duration !== "thisBattle");
        card.keywordGrants = card.keywordGrants.filter((g) => g.duration !== "thisBattle");
      }
    }
  }

  return applyEvent(next, { type: "COMBAT_ENDED" });
}

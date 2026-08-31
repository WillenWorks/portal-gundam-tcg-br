import type {
  CardInstance,
  GameEvent,
  GameState,
  PlayerState,
  Zone,
} from "./types";
import { effectiveHp } from "./types";

/** Acha uma carta em qualquer zona de qualquer jogador. Lança se não achar. */
export function findCard(state: GameState, instanceId: string): CardInstance {
  for (const player of Object.values(state.players)) {
    const found = findCardIn(player, instanceId);
    if (found) return found;
  }
  throw new Error(`Card instance not found: ${instanceId}`);
}

function findCardIn(player: PlayerState, instanceId: string): CardInstance | undefined {
  const zones: Zone[] = [
    "deck",
    "resourceDeck",
    "shields",
    "resourceArea",
    "battleArea",
    "baseSection",
    "trash",
    "exile",
    "hand",
  ];
  for (const zone of zones) {
    const card = player[zone].find((c) => c.instanceId === instanceId);
    if (card) return card;
  }
  return undefined;
}

function zoneArray(player: PlayerState, zone: Zone): CardInstance[] {
  return player[zone];
}

function removeFromZone(player: PlayerState, instanceId: string): CardInstance | null {
  const zones: Zone[] = [
    "deck",
    "resourceDeck",
    "shields",
    "resourceArea",
    "battleArea",
    "baseSection",
    "trash",
    "exile",
    "hand",
  ];
  for (const zone of zones) {
    const arr = zoneArray(player, zone);
    const idx = arr.findIndex((c) => c.instanceId === instanceId);
    if (idx !== -1) {
      const [card] = arr.splice(idx, 1);
      return card;
    }
  }
  return null;
}

/** Clona o estado inteiro (shallow nas cartas, deep o suficiente pra nunca mutar o state anterior). */
export function cloneState(state: GameState): GameState {
  const players: GameState["players"] = { A: cloneManualPlayer(state.players.A), B: cloneManualPlayer(state.players.B) };
  return {
    ...state,
    players,
    combat: state.combat ? { ...state.combat, actionPasses: { ...state.combat.actionPasses } } : null,
    eventLog: [...state.eventLog],
  };
}

function cloneManualPlayer(player: PlayerState): PlayerState {
  const cloneCard = (c: CardInstance): CardInstance => ({
    ...c,
    statModifiers: [...c.statModifiers],
    keywordGrants: [...c.keywordGrants],
    usedKeywordsThisTurn: [...c.usedKeywordsThisTurn],
  });
  return {
    id: player.id,
    deck: player.deck.map(cloneCard),
    resourceDeck: player.resourceDeck.map(cloneCard),
    shields: player.shields.map(cloneCard),
    resourceArea: player.resourceArea.map(cloneCard),
    battleArea: player.battleArea.map(cloneCard),
    baseSection: player.baseSection.map(cloneCard),
    trash: player.trash.map(cloneCard),
    exile: player.exile.map(cloneCard),
    hand: player.hand.map(cloneCard),
  };
}

/**
 * Aplica um único GameEvent sobre o estado, devolvendo um novo GameState
 * (nunca muta o argumento). Efeitos/regras de mais alto nível (phases.ts,
 * combat.ts, keywords.ts) computam listas de GameEvent e usam
 * `applyEvents` — eles nunca mexem em `players`/`combat` diretamente.
 */
export function applyEvent(prev: GameState, event: GameEvent): GameState {
  const state = cloneState(prev);
  state.eventLog.push(event);

  switch (event.type) {
    case "PHASE_CHANGE": {
      state.phase = event.phase;
      return state;
    }
    case "TURN_CHANGE": {
      state.turnNumber = event.turnNumber;
      state.activePlayer = event.activePlayer;
      return state;
    }
    case "DRAW_CARD": {
      const player = state.players[event.player];
      const source = player[event.from];
      const card = source.shift();
      if (card) {
        // deck -> Hand (Draw Phase); resourceDeck -> Resource Area direto, não passa pela mão (Resource Phase)
        const toZone = event.from === "deck" ? "hand" : "resourceArea";
        card.zone = toZone;
        card.enteredZoneOnTurn = state.turnNumber;
        player[toZone].push(card);
      }
      return state;
    }
    case "MOVE_CARD": {
      const owner = findCardOwner(state, event.instanceId);
      const player = state.players[owner];
      const card = removeFromZone(player, event.instanceId);
      if (!card) return state;
      card.zone = event.toZone;
      card.enteredZoneOnTurn = state.turnNumber;
      if (event.toZone !== "battleArea" && event.toZone !== "baseSection") {
        // sair de campo limpa buffs/pareamento — zonas fora de jogo não carregam estado de combate
        card.statModifiers = [];
        card.keywordGrants = [];
        card.damage = 0;
        card.pairedPilotId = undefined;
        card.pairedUnitId = undefined;
      }
      if (event.toZone === "shields" || event.toZone === "deck" || event.toZone === "resourceDeck") {
        card.rested = false;
      }
      player[event.toZone].push(card);
      return state;
    }
    case "REST_CARD": {
      findCard(state, event.instanceId).rested = true;
      return state;
    }
    case "SET_ACTIVE": {
      findCard(state, event.instanceId).rested = false;
      return state;
    }
    case "DAMAGE_UNIT": {
      const card = findCard(state, event.instanceId);
      card.damage += event.amount;
      return state;
    }
    case "HEAL_UNIT": {
      const card = findCard(state, event.instanceId);
      card.damage = Math.max(0, card.damage - event.amount);
      return state;
    }
    case "DAMAGE_BASE": {
      const card = findCard(state, event.instanceId);
      card.damage += event.amount;
      return state;
    }
    case "DESTROY_CARD": {
      const owner = findCardOwner(state, event.instanceId);
      const player = state.players[owner];
      const card = removeFromZone(player, event.instanceId);
      if (!card) return state;
      card.zone = "trash";
      card.rested = false;
      card.damage = 0;
      card.statModifiers = [];
      card.keywordGrants = [];
      card.pairedPilotId = undefined;
      card.pairedUnitId = undefined;
      // se destruir uma Unit com Pilot pareado, o Pilot também vai pro trash (ver combat.ts)
      player.trash.push(card);
      return state;
    }
    // "Removido do jogo" — diferente de DESTROY_CARD, a carta não vai pro trash, vai pra
    // zona `exile` (área de exílio, sempre pública — rodada 5, pedido do Willen de ter essa
    // zona visível no tabuleiro em vez da carta só "sumir"). Hoje usado só pelo EX Resource
    // (regra oficial: "When an EX Resource is used to pay a cost, that EX Resource is
    // removed from the game", ver deploy.ts/payCostEvents), mas o evento é genérico o
    // bastante pra qualquer token/carta que precise do mesmo destino no futuro.
    case "REMOVE_CARD_FROM_GAME": {
      const owner = findCardOwner(state, event.instanceId);
      const player = state.players[owner];
      const card = removeFromZone(player, event.instanceId);
      if (!card) return state;
      card.zone = "exile";
      card.rested = false;
      card.damage = 0;
      card.statModifiers = [];
      card.keywordGrants = [];
      card.pairedPilotId = undefined;
      card.pairedUnitId = undefined;
      player.exile.push(card);
      return state;
    }
    case "DAMAGE_SHIELD": {
      const player = state.players[event.player];
      for (let i = 0; i < event.count && player.shields.length > 0; i++) {
        const shield = player.shields.shift()!;
        shield.zone = "trash";
        shield.rested = false;
        player.trash.push(shield);
      }
      return state;
    }
    case "MODIFY_STAT": {
      findCard(state, event.instanceId).statModifiers.push(event.modifier);
      return state;
    }
    case "GRANT_KEYWORD": {
      findCard(state, event.instanceId).keywordGrants.push(event.grant);
      return state;
    }
    case "CLEAR_TURN_MODIFIERS": {
      for (const player of Object.values(state.players)) {
        for (const zone of ["battleArea", "baseSection"] as const) {
          for (const card of player[zone]) {
            card.statModifiers = card.statModifiers.filter(
              (m) => !(m.duration === "endOfTurn" && m.appliedOnTurn <= event.turnNumber),
            );
            card.keywordGrants = card.keywordGrants.filter(
              (g) => !(g.duration === "endOfTurn" && g.appliedOnTurn <= event.turnNumber),
            );
            card.usedKeywordsThisTurn = [];
          }
        }
      }
      return state;
    }
    case "MARK_KEYWORD_USED": {
      findCard(state, event.instanceId).usedKeywordsThisTurn.push(event.keyword);
      return state;
    }
    case "DISCARD_TO_HAND_LIMIT": {
      const player = state.players[event.player];
      for (const id of event.instanceIds) {
        const card = removeFromZone(player, id);
        if (card) {
          card.zone = "trash";
          player.trash.push(card);
        }
      }
      return state;
    }
    case "PAIR_CARDS": {
      // Comprehensive Rules 3-3-1/5-9: Pilot é jogado direto pareado com uma
      // Unit amiga na Battle Area — não existe Pilot despareado em campo.
      const pilot = findCard(state, event.pilotId);
      const unit = findCard(state, event.unitId);
      pilot.pairedUnitId = event.unitId;
      unit.pairedPilotId = event.pilotId;
      return state;
    }
    case "ATTACK_DECLARED": {
      state.combat = {
        step: "attack",
        attackerId: event.attackerId,
        attackingPlayer: event.attackingPlayer,
        defendingPlayer: event.defendingPlayer,
        originalTarget: event.target,
        currentTarget: event.target,
        actionPasses: { A: false, B: false },
        actionPriority: event.defendingPlayer,
      };
      return state;
    }
    case "BLOCK_DECLARED": {
      if (state.combat) {
        state.combat.currentTarget = event.newTarget;
        state.combat.blockerUsedBy = event.blockerId;
      }
      return state;
    }
    case "ACTION_PASS": {
      if (state.combat) {
        state.combat.actionPasses[event.player] = true;
        const bothPassed = state.combat.actionPasses.A && state.combat.actionPasses.B;
        if (!bothPassed) {
          state.combat.actionPriority = event.player === "A" ? "B" : "A";
        }
      }
      return state;
    }
    case "COMBAT_STEP_CHANGE": {
      if (state.combat) {
        state.combat.step = event.step;
        if (event.step === "action") {
          state.combat.actionPasses = { A: false, B: false };
          state.combat.actionPriority = state.combat.defendingPlayer;
        }
      }
      return state;
    }
    case "COMBAT_ENDED": {
      state.combat = null;
      return state;
    }
    case "BEGIN_END_PHASE_ACTION_STEP": {
      state.endPhaseAction = { passes: { A: false, B: false }, priority: event.priority };
      return state;
    }
    case "END_PHASE_ACTION_PASS": {
      if (state.endPhaseAction) {
        state.endPhaseAction.passes[event.player] = true;
        const bothPassed = state.endPhaseAction.passes.A && state.endPhaseAction.passes.B;
        if (!bothPassed) {
          state.endPhaseAction.priority = event.player === "A" ? "B" : "A";
        }
      }
      return state;
    }
    case "END_END_PHASE_ACTION_STEP": {
      state.endPhaseAction = null;
      return state;
    }
    case "GAME_OVER": {
      state.gameOver = { winner: event.winner, reason: event.reason };
      return state;
    }
    default:
      return state;
  }
}

export function applyEvents(state: GameState, events: GameEvent[]): GameState {
  return events.reduce(applyEvent, state);
}

export function findCardOwner(state: GameState, instanceId: string) {
  for (const player of Object.values(state.players)) {
    if (findCardIn(player, instanceId)) return player.id;
  }
  throw new Error(`Card instance not found: ${instanceId}`);
}

/** Uma Unit/Base é destruída quando dano marcado >= HP efetivo (Comprehensive Rules 5-5-2). */
export function isLethallyDamaged(card: CardInstance): boolean {
  return card.damage >= effectiveHp(card);
}

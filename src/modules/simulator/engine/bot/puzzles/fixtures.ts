import { createGame } from "../../setup";
import { advanceToMainPhase } from "../../phases";
import { applyPlayerAction, type PlayerAction } from "../../actions";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "../../types";
import { buildVanillaDeckList, VANILLA_CARD_DEFS } from "../../../fixtures/vanillaDeck";
import { getCardDefByCode } from "../../../content/allCardDefs";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../../../content";

/**
 * Montagem de situações do banco (spec bot-avaliacao-forca). Parte de uma partida
 * real (decks vanilla) já na Main Phase do jogador ativo, esvazia as zonas de
 * jogo e deixa cada situação colocar só o que importa. Ações de preparação
 * (ex.: o oponente declarar um ataque) passam pelo motor de verdade.
 */

let seq = 0;

/** Main Phase do `active`, zonas de jogo vazias (mão, campo, Base, recursos); escudos intactos */
export function board(active: PlayerId = "A"): GameState {
  const state = advanceToMainPhase(createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 41, firstPlayer: active }));
  for (const id of ["A", "B"] as const) {
    state.players[id].hand = [];
    state.players[id].battleArea = [];
    state.players[id].baseSection = [];
    state.players[id].resourceArea = [];
  }
  return state;
}

export function put(state: GameState, player: PlayerId, zone: Zone, def: CardDef, extra: Partial<CardInstance> = {}): string {
  const card: CardInstance = {
    instanceId: `${player}-pz-${seq++}`,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    // já estabelecida em campo (pode atacar), salvo quando a situação disser o contrário
    enteredZoneOnTurn: state.turnNumber - 1,
    ...extra,
  };
  state.players[player][zone].push(card);
  return card.instanceId;
}

export function resources(state: GameState, player: PlayerId, n: number): void {
  for (let i = 0; i < n; i++) put(state, player, "resourceArea", VANILLA_CARD_DEFS.RESOURCE_01);
}

export function unit(code: string, ap: number, hp: number, extra: Partial<CardDef> = {}): CardDef {
  return { code, nameEn: code, cardType: "UNIT", color: "blue", level: 1, cost: 1, ap, hp, ...extra };
}

export function base(code: string, hp: number): CardDef {
  return { code, nameEn: code, cardType: "BASE", color: "blue", level: 1, cost: 1, hp };
}

export function real(code: string): CardDef {
  const def = getCardDefByCode(code);
  if (!def) throw new Error(`situação usa ${code}, fora do catálogo do simulador`);
  return def;
}

export function setShields(state: GameState, player: PlayerId, n: number): void {
  state.players[player].shields = state.players[player].shields.slice(0, n);
}

/** aplica uma ação de preparação pelo motor real (specs reais) */
export function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}

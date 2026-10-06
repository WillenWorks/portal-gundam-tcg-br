/**
 * Tradução e formatação multilíngue do feed de eventos de batalha (GameEvent).
 * Suporta tanto pt-BR (padrão do portal) quanto EN (para contas com preferência em inglês).
 */

import type { GameEvent, PlayerId } from "@/modules/simulator/engine/types";
import type { ViewGameState, ViewCardInstance } from "@/modules/simulator/engine/viewState";
import type { CardLanguage } from "./types";
import { getPhaseStepLabel } from "./keywords";

export type BattleLogKind = "turn" | "phase" | "play" | "combat" | "damage" | "effect" | "system";

export interface BattleLogEntry {
  seq: number;
  kind: BattleLogKind;
  text: string;
}

function playerLabel(id: PlayerId, lang: CardLanguage): string {
  return lang === "EN" ? `Player ${id}` : `Jogador ${id}`;
}

/** Resolve instanceId -> nome da carta varrendo as zonas públicas da visão (+ mão). */
export function makeNameResolver(view: ViewGameState): (instanceId: string) => string {
  const byId = new Map<string, string>();
  for (const pid of ["A", "B"] as PlayerId[]) {
    const p = view.players[pid];
    const zones: ViewCardInstance[][] = [
      p.battleArea,
      p.baseSection,
      p.resourceArea,
      p.trash,
      p.exile,
      p.hand,
      p.shields,
      p.deck,
      p.resourceDeck,
    ];
    for (const zone of zones) {
      for (const card of zone) {
        if (!("hidden" in card)) byId.set(card.instanceId, card.def.nameEn);
      }
    }
  }
  return (instanceId: string) => byId.get(instanceId) ?? "uma carta";
}

export function describeEventI18n(
  event: GameEvent,
  seq: number,
  nameOf: (id: string) => string,
  lang: CardLanguage = "PT_BR",
): BattleLogEntry | null {
  const entry = (kind: BattleLogKind, text: string): BattleLogEntry => ({ seq, kind, text });
  const isPt = lang === "PT_BR";
  const p = (id: PlayerId) => playerLabel(id, lang);

  switch (event.type) {
    case "TURN_CHANGE":
      return entry(
        "turn",
        isPt
          ? `— Turno ${event.turnNumber} · ${p(event.activePlayer)} —`
          : `— Turn ${event.turnNumber} · ${p(event.activePlayer)} —`,
      );

    case "PHASE_CHANGE": {
      if (event.phase === "start") return null;
      const phaseName = getPhaseStepLabel(`${event.phase}_phase`, lang);
      return entry("phase", phaseName);
    }

    case "DRAW_CARD":
      if (event.from === "deck") {
        return entry(
          "play",
          isPt ? `${p(event.player)} comprou 1 carta` : `${p(event.player)} drew 1 card`,
        );
      }
      return entry(
        "play",
        isPt ? `${p(event.player)} pegou 1 recurso` : `${p(event.player)} gained 1 resource`,
      );

    case "MOVE_CARD": {
      const name = nameOf(event.instanceId);
      const destPt: Record<string, string> = {
        hand: "voltou pra mão",
        trash: "foi pro trash",
        battleArea: "entrou na Battle Area",
        baseSection: "foi posicionada na Base",
        shields: "virou shield",
        exile: "saiu do jogo",
        deck: "voltou pro deck",
        resourceArea: "entrou na Resource Area",
        resourceDeck: "voltou pro resource deck",
      };
      const destEn: Record<string, string> = {
        hand: "returned to hand",
        trash: "was sent to trash",
        battleArea: "entered the Battle Area",
        baseSection: "was deployed to Base",
        shields: "became a shield",
        exile: "was exiled",
        deck: "returned to deck",
        resourceArea: "entered the Resource Area",
        resourceDeck: "returned to resource deck",
      };
      const destMap = isPt ? destPt : destEn;
      const fallbackDest = isPt ? `foi pra ${event.toZone}` : `moved to ${event.toZone}`;
      return entry("play", `${name} ${destMap[event.toZone] ?? fallbackDest}`);
    }

    case "PAIR_CARDS":
      return entry(
        "play",
        isPt
          ? `${nameOf(event.pilotId)} foi pareado com ${nameOf(event.unitId)}`
          : `${nameOf(event.pilotId)} was paired with ${nameOf(event.unitId)}`,
      );

    case "SPAWN_TOKEN":
      return entry(
        "play",
        isPt
          ? `${p(event.player)} colocou um token ${event.def.nameEn} em jogo`
          : `${p(event.player)} spawned token ${event.def.nameEn}`,
      );

    case "ATTACK_DECLARED": {
      const target = event.target === "player" ? p(event.defendingPlayer) : nameOf(event.target.unitId);
      return entry(
        "combat",
        isPt ? `${nameOf(event.attackerId)} atacou ${target}` : `${nameOf(event.attackerId)} attacked ${target}`,
      );
    }

    case "BLOCK_DECLARED":
      return entry(
        "combat",
        isPt ? `${nameOf(event.blockerId)} ativou <Blocker>` : `${nameOf(event.blockerId)} activated <Blocker>`,
      );

    case "DAMAGE_UNIT":
      return entry(
        "damage",
        isPt
          ? `${nameOf(event.instanceId)} recebeu ${event.amount} de dano`
          : `${nameOf(event.instanceId)} took ${event.amount} damage`,
      );

    case "DAMAGE_BASE":
      return entry(
        "damage",
        isPt ? `A Base recebeu ${event.amount} de dano` : `The Base took ${event.amount} damage`,
      );

    case "DAMAGE_SHIELD":
      return entry(
        "damage",
        isPt
          ? `${p(event.player)} perdeu ${event.count} shield${event.count > 1 ? "s" : ""}`
          : `${p(event.player)} lost ${event.count} shield${event.count > 1 ? "s" : ""}`,
      );

    case "HEAL_UNIT":
      if (event.amount <= 0) return null;
      return entry(
        "effect",
        isPt
          ? `${nameOf(event.instanceId)} recuperou ${event.amount} HP`
          : `${nameOf(event.instanceId)} recovered ${event.amount} HP`,
      );

    case "DESTROY_CARD":
      return entry(
        "damage",
        isPt ? `${nameOf(event.instanceId)} foi destruída` : `${nameOf(event.instanceId)} was destroyed`,
      );

    case "REMOVE_CARD_FROM_GAME":
      return entry(
        "effect",
        isPt
          ? `${nameOf(event.instanceId)} foi removida do jogo`
          : `${nameOf(event.instanceId)} was removed from game`,
      );

    case "REST_CARD":
      return entry(
        "effect",
        isPt ? `${nameOf(event.instanceId)} virou rested` : `${nameOf(event.instanceId)} became rested`,
      );

    case "SET_ACTIVE":
      return null;

    case "MODIFY_STAT": {
      const sign = event.modifier.amount >= 0 ? "+" : "";
      return entry(
        "effect",
        isPt
          ? `${nameOf(event.instanceId)} recebeu ${event.modifier.stat.toUpperCase()} ${sign}${event.modifier.amount}`
          : `${nameOf(event.instanceId)} got ${event.modifier.stat.toUpperCase()} ${sign}${event.modifier.amount}`,
      );
    }

    case "GRANT_KEYWORD":
      return entry(
        "effect",
        isPt
          ? `${nameOf(event.instanceId)} ganhou <${event.grant.keyword}>`
          : `${nameOf(event.instanceId)} gained <${event.grant.keyword}>`,
      );

    case "SET_SHIELD_PROTECTION":
      return entry(
        "effect",
        isPt
          ? `Shields protegidos contra Units Lv.${event.maxAttackerLevel} ou menos nesta batalha`
          : `Shields protected against Units Lv.${event.maxAttackerLevel} or less in this battle`,
      );

    case "SET_UNIT_DAMAGE_PROTECTION":
      return entry(
        "effect",
        isPt
          ? `${nameOf(event.instanceId)} não recebe dano de batalha de Units com AP ${event.maxAttackerAp} ou menos nesta batalha`
          : `${nameOf(event.instanceId)} immune to battle damage from Units with AP ${event.maxAttackerAp} or less in this battle`,
      );

    case "GRANT_ATTACK_TARGET_RELAX":
      return entry(
        "effect",
        isPt
          ? `${nameOf(event.instanceId)} pode mirar Unit inimiga ativa Lv.${event.maxLevel} ou menos neste turno`
          : `${nameOf(event.instanceId)} can target active enemy Units Lv.${event.maxLevel} or less this turn`,
      );

    case "SET_CANNOT_ATTACK":
      return entry(
        "effect",
        isPt
          ? `${nameOf(event.instanceId)} não pode atacar neste turno`
          : `${nameOf(event.instanceId)} cannot attack this turn`,
      );

    case "DISCARD_TO_HAND_LIMIT":
      return entry(
        "play",
        isPt
          ? `${p(event.player)} descartou ${event.instanceIds.length} por limite de mão`
          : `${p(event.player)} discarded ${event.instanceIds.length} due to hand limit`,
      );

    case "SET_PENDING_DECISION":
      return event.decision.kind === "burst"
        ? entry(
            "combat",
            isPt
              ? `${p(event.player)} decide sobre o 【Burst】 de ${event.decision.cardDef.nameEn}`
              : `${p(event.player)} deciding on 【Burst】 of ${event.decision.cardDef.nameEn}`,
          )
        : null;

    case "BEGIN_END_PHASE_ACTION_STEP":
      return entry(
        "phase",
        isPt ? "Action Step do fim de turno" : "End Phase Action Step",
      );

    case "GAME_OVER": {
      const reasonPt: Record<string, string> = {
        deckOut: "deck vazio",
        noShieldsBattleDamage: "dano sem shields",
        abandonment: "abandono",
        resignation: "desistência",
        trigger_loop_guard: "loop de gatilhos",
      };
      const reasonEn: Record<string, string> = {
        deckOut: "deck out",
        noShieldsBattleDamage: "no shields battle damage",
        abandonment: "abandonment",
        resignation: "resignation",
        trigger_loop_guard: "trigger loop guard",
      };
      const reasonLabel = (isPt ? reasonPt[event.reason] : reasonEn[event.reason]) ?? event.reason;
      if (event.winner === null) {
        return entry(
          "system",
          isPt ? `FIM DE JOGO — empate (${reasonLabel})` : `GAME OVER — draw (${reasonLabel})`,
        );
      }
      return entry(
        "system",
        isPt
          ? `FIM DE JOGO — vitória de ${p(event.winner)} (${reasonLabel})`
          : `GAME OVER — ${p(event.winner)} won (${reasonLabel})`,
      );
    }

    default:
      return null;
  }
}

/** Converte o `eventLog` inteiro da visão numa lista de linhas legíveis no idioma especificado. */
export function buildBattleLogI18n(view: ViewGameState, lang: CardLanguage = "PT_BR"): BattleLogEntry[] {
  const nameOf = makeNameResolver(view);
  const out: BattleLogEntry[] = [];
  view.eventLog.forEach((event, i) => {
    const entry = describeEventI18n(event, i, nameOf, lang);
    if (entry) out.push(entry);
  });
  return out;
}

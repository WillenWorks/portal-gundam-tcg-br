/* docs/19, Sessão 4 — tradução de `GameEvent` (motor) → linha de log legível
 * em português. Puro e sem React: o `BattleLogDrawer` só renderiza o que sai
 * daqui. Eventos "de bastidor" (troca de step de combate, marcação de
 * keyword usada, limpeza de modificadores, decisão pendente) viram `null` e
 * não aparecem no feed. */
import type { GameEvent, PlayerId } from "@/modules/simulator/engine/types";
import type { ViewGameState, ViewCardInstance } from "@/modules/simulator/engine/viewState";

export type BattleLogKind = "turn" | "phase" | "play" | "combat" | "damage" | "effect" | "system";

export interface BattleLogEntry {
  /**
   * Posição do evento DENTRO da janela recebida (`view.eventLog`, já cortada
   * nos últimos N pelo servidor) — não é o índice absoluto no `eventLog`
   * completo. O `BattleLogDrawer` usa a posição da lista renderizada como
   * `key`, não isto; mantido só como referência de ordem.
   */
  seq: number;
  kind: BattleLogKind;
  text: string;
}

function player(id: PlayerId): string {
  return `Jogador ${id}`;
}

const PHASE_PT: Record<string, string> = {
  start: "Fase de Manutenção",
  draw: "Fase de Compra",
  resource: "Fase de Recurso",
  main: "Fase Principal",
  end: "Fase Final",
};

/** Resolve `instanceId` → nome da carta varrendo as zonas públicas da visão (+ mão do próprio viewer). */
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

export function describeEvent(event: GameEvent, seq: number, nameOf: (id: string) => string): BattleLogEntry | null {
  const entry = (kind: BattleLogKind, text: string): BattleLogEntry => ({ seq, kind, text });

  switch (event.type) {
    case "TURN_CHANGE":
      return entry("turn", `— Turno ${event.turnNumber} · ${player(event.activePlayer)} —`);
    case "PHASE_CHANGE":
      return event.phase === "start" ? null : entry("phase", PHASE_PT[event.phase] ?? `Fase de ${event.phase}`);
    case "DRAW_CARD":
      return event.from === "deck"
        ? entry("play", `${player(event.player)} comprou 1 carta`)
        : entry("play", `${player(event.player)} pegou 1 recurso`);
    case "MOVE_CARD": {
      const name = nameOf(event.instanceId);
      const dest: Record<string, string> = {
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
      return entry("play", `${name} ${dest[event.toZone] ?? `foi pra ${event.toZone}`}`);
    }
    case "PAIR_CARDS":
      return entry("play", `${nameOf(event.pilotId)} foi pareado com ${nameOf(event.unitId)}`);
    case "SPAWN_TOKEN":
      return entry("play", `${player(event.player)} colocou um token ${event.def.nameEn} em jogo`);
    case "ATTACK_DECLARED": {
      const target = event.target === "player" ? player(event.defendingPlayer) : nameOf(event.target.unitId);
      return entry("combat", `${nameOf(event.attackerId)} atacou ${target}`);
    }
    case "BLOCK_DECLARED":
      return entry("combat", `${nameOf(event.blockerId)} ativou <Blocker>`);
    case "DAMAGE_UNIT":
      return entry("damage", `${nameOf(event.instanceId)} recebeu ${event.amount} de dano`);
    case "DAMAGE_BASE":
      return entry("damage", `A Base recebeu ${event.amount} de dano`);
    case "DAMAGE_SHIELD":
      return entry("damage", `${player(event.player)} perdeu ${event.count} shield${event.count > 1 ? "s" : ""}`);
    case "HEAL_UNIT":
      return event.amount > 0 ? entry("effect", `${nameOf(event.instanceId)} recuperou ${event.amount} HP`) : null;
    case "DESTROY_CARD":
      return entry("damage", `${nameOf(event.instanceId)} foi destruída`);
    case "REMOVE_CARD_FROM_GAME":
      return entry("effect", `${nameOf(event.instanceId)} foi removida do jogo`);
    case "REST_CARD":
      return entry("effect", `${nameOf(event.instanceId)} virou rested`);
    case "SET_ACTIVE":
      return null; // ruído (acontece em lote no Start Phase)
    case "MODIFY_STAT": {
      const sign = event.modifier.amount >= 0 ? "+" : "";
      return entry("effect", `${nameOf(event.instanceId)} recebeu ${event.modifier.stat.toUpperCase()} ${sign}${event.modifier.amount}`);
    }
    case "GRANT_KEYWORD":
      return entry("effect", `${nameOf(event.instanceId)} ganhou <${event.grant.keyword}>`);
    case "SET_SHIELD_PROTECTION":
      return entry("effect", `Shields protegidos contra Units Lv.${event.maxAttackerLevel} ou menos nesta batalha`);
    case "SET_UNIT_DAMAGE_PROTECTION":
      return entry("effect", `${nameOf(event.instanceId)} não recebe dano de batalha de Units com AP ${event.maxAttackerAp} ou menos nesta batalha`);
    case "GRANT_ATTACK_TARGET_RELAX":
      return entry("effect", `${nameOf(event.instanceId)} pode mirar Unit inimiga ativa Lv.${event.maxLevel} ou menos neste turno`);
    case "SET_CANNOT_ATTACK":
      return entry("effect", `${nameOf(event.instanceId)} não pode atacar neste turno`);
    case "DISCARD_TO_HAND_LIMIT":
      return entry("play", `${player(event.player)} descartou ${event.instanceIds.length} por limite de mão`);
    case "SET_PENDING_DECISION":
      return event.decision.kind === "burst"
        ? entry("combat", `${player(event.player)} decide sobre o 【Burst】 de ${event.decision.cardDef.nameEn}`)
        : null;
    case "BEGIN_END_PHASE_ACTION_STEP":
      return entry("phase", "Action Step do fim de turno");
    case "GAME_OVER": {
      const reason: Record<string, string> = {
        deckOut: "deck vazio",
        noShieldsBattleDamage: "dano sem shields",
        abandonment: "abandono",
        resignation: "desistência",
      };
      return entry("system", `FIM DE JOGO — vitória de ${player(event.winner)} (${reason[event.reason] ?? event.reason})`);
    }
    // ruído puro de motor — nunca no feed
    case "COMBAT_STEP_CHANGE":
    case "COMBAT_ENDED":
    case "ACTION_PASS":
    case "END_PHASE_ACTION_PASS":
    case "END_END_PHASE_ACTION_STEP":
    case "MARK_KEYWORD_USED":
    case "CLEAR_TURN_MODIFIERS":
    case "CLEAR_PENDING_DECISION":
    case "MOVE_WITHIN_DECK":
      return null;
    default:
      return null;
  }
}

/** Converte o `eventLog` inteiro da visão numa lista de linhas legíveis (já sem os `null`). */
export function buildBattleLog(view: ViewGameState): BattleLogEntry[] {
  const nameOf = makeNameResolver(view);
  const out: BattleLogEntry[] = [];
  view.eventLog.forEach((event, i) => {
    const entry = describeEvent(event, i, nameOf);
    if (entry) out.push(entry);
  });
  return out;
}

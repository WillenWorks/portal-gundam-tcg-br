/* Qual som cada momento da mesa toca (puro/testável). Quem toca é quem conhece o tempo da ação: o executor da
 * coreografia (`SimulatorMatchPage`) e os componentes de animação (`useSceneSound`). O nível que separa o som
 * "pesado" é o mesmo do pouso pesado (`landsHeavy`, Lv 5+). */
import type { SfxId } from "../audio/sfxManifest";
import type { AttackTarget, GameEvent } from "../engine/types";

export const HEAVY_LEVEL = 5;

export function isHeavy(level: number | null | undefined): boolean {
  return (level ?? 0) >= HEAVY_LEVEL;
}

/** golpe do combate, sorteado entre as variantes do peso do atacante */
export function strikeSound(attackerLevel: number | null | undefined): SfxId {
  return isHeavy(attackerLevel) ? "attack.high" : "attack.low";
}

/** declaração de ataque: começo do combate (ou o <High-Maneuver>, que tira o bloqueio da jogada) */
export function declareSound(attackerHasHighManeuver: boolean): SfxId {
  return attackerHasHighManeuver ? "highManeuver" : "combat.start";
}

/** Unit pousando no campo */
export function deploySound(level: number | null | undefined): SfxId {
  return isHeavy(level) ? "deploy.high" : "deploy.low";
}

export function commandSound(trigger: "Main" | "Action" | undefined): SfxId {
  return trigger === "Action" ? "command.action" : "command.main";
}

/** selo da habilidade resolvendo (`ActivationAnnouncement`) */
export function announceSound(trigger: string): SfxId {
  if (trigger.startsWith("Activate")) return "unit.activate";
  if (trigger === "Burst") return "ability.burst";
  return "ability.announce";
}

/** carta indo para a lixeira; `null` = só desliza (descarte, exílio) */
export function departureSound(kind: "destroyed" | "discarded" | "exiled", cardType?: string): SfxId | null {
  if (kind !== "destroyed") return null;
  return cardType?.toUpperCase() === "BASE" ? "base.destroyed" : "unit.destroyed";
}

/**
 * shield quebrada: com o ataque mirando uma Unit, o dano na área de escudo só pode ser do <Breach> (o dano de
 * batalha numa Unit não passa para os escudos)
 */
export function shieldSound(combatTarget: AttackTarget | undefined): SfxId {
  return combatTarget && combatTarget !== "player" ? "breach" : "shield.destroyed";
}

export interface EffectSoundContext {
  /** o lote é dano de batalha do combate com este alvo (ou efeito, se ausente) */
  combatTarget?: AttackTarget;
  /** o Piloto pareado satisfaz o link da Unit */
  linked: (pilotId: string, unitId: string) => boolean;
}

/** no máximo isto por tempo de efeitos — mais vira barulho */
export const MAX_EFFECT_SOUNDS = 2;

const EFFECT_PRIORITY: Partial<Record<SfxId, number>> = {
  breach: 6,
  "base.damaged": 5,
  link: 4,
  "blocker.damaged": 4,
  "effect.damage": 4,
  pair: 3,
  "unit.repair": 3,
  "effect.debuff": 2,
  "effect.buff": 2,
  "deploy.low": 2,
  unrest: 1,
};

/** os sons do que um efeito (ou o dano do combate) fez, do mais importante ao menos, sem repetir */
export function effectSounds(events: readonly GameEvent[], ctx: EffectSoundContext): SfxId[] {
  const found = new Set<SfxId>();
  const battle = ctx.combatTarget !== undefined;
  for (const event of events) {
    switch (event.type) {
      case "DAMAGE_UNIT":
        if (event.amount > 0) found.add(battle ? "blocker.damaged" : "effect.damage");
        break;
      case "DAMAGE_BASE":
        if (event.amount > 0) found.add(battle && ctx.combatTarget !== "player" ? "breach" : "base.damaged");
        break;
      case "HEAL_UNIT":
        if (event.amount > 0) found.add("unit.repair");
        break;
      case "PAIR_CARDS":
        found.add(ctx.linked(event.pilotId, event.unitId) ? "link" : "pair");
        break;
      case "SET_ACTIVE":
        found.add("unrest");
        break;
      case "MODIFY_STAT":
        found.add(event.modifier.amount >= 0 ? "effect.buff" : "effect.debuff");
        break;
      case "GRANT_KEYWORD":
      case "GRANT_DAMAGE_MODIFIER":
      case "GRANT_BATTLE_DAMAGE_IMMUNITY_UNTIL_TURN":
      case "SET_UNIT_DAMAGE_PROTECTION":
      case "PREVENT_BEING_ATTACK_TARGET":
      case "GRANT_ATTACK_TARGET_RELAX":
        found.add("effect.buff");
        break;
      case "SET_CANNOT_ATTACK":
      case "SET_CANNOT_ACTIVATE":
        found.add("effect.debuff");
        break;
      case "SPAWN_TOKEN":
        found.add("deploy.low");
        break;
      default:
        break;
    }
  }
  return [...found].sort((a, b) => (EFFECT_PRIORITY[b] ?? 0) - (EFFECT_PRIORITY[a] ?? 0)).slice(0, MAX_EFFECT_SOUNDS);
}

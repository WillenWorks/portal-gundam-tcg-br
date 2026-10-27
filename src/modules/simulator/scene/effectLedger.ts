/* Spec simulador-efeitos-na-mesa (E) — o "livro de efeitos" do turno: quem aplicou o quê, em quem, e até quando. O
 * motor guarda o modificador na carta sem a carta de origem (`StatModifier.appliedBy` é só o jogador); a fonte sai
 * da ordem do log — o que vem depois de uma Command jogada / habilidade anunciada é dela, como em `planChoreography`.
 * Puro: a página monta a partir do `eventLog` da visão mostrada. */
import type { DamageModifier, GameEvent, PlayerId } from "../engine/types";

export type LedgerEffect =
  | { kind: "stat"; stat: "ap" | "hp"; amount: number }
  | { kind: "keyword"; keyword: string }
  | {
      kind: "attackTargetRelax";
      maxLevel?: number;
      maxAp?: number;
      apAtMostSelf?: boolean;
      levelAtMostSelf?: boolean;
      unpairedOnly?: boolean;
      damagedOnly?: boolean;
      keyword?: string;
    }
  | { kind: "cannotAttack" }
  | { kind: "staysRested" }
  | { kind: "untargetable" }
  | { kind: "damageProtection"; maxAttackerAp?: number; maxAttackerLevel?: number; unconditional?: boolean }
  | { kind: "damageModifier"; modifier: DamageModifier }
  | { kind: "battleDamageImmunity"; maxAttackerHp: number };

export interface LedgerSource {
  instanceId: string;
  player: PlayerId;
  /** gatilho anunciado ("Deploy", "Activate·Main"…) ou "Command" para a Command jogada */
  trigger: string;
}

export interface LedgerEntry {
  id: string;
  /** `null` = o log não traz quem causou (efeito sem anúncio) */
  source: LedgerSource | null;
  targetId: string;
  effect: LedgerEffect;
  scope: "turn" | "battle" | "permanent";
}

/** o efeito duradouro que o evento deixa numa carta, ou `null` (dano, compra, saída…) */
function lastingEffect(event: GameEvent): { targetId: string; effect: LedgerEffect; scope: LedgerEntry["scope"] } | null {
  switch (event.type) {
    case "MODIFY_STAT":
      return {
        targetId: event.instanceId,
        effect: { kind: "stat", stat: event.modifier.stat, amount: event.modifier.amount },
        scope: durationScope(event.modifier.duration),
      };
    case "GRANT_KEYWORD":
      return { targetId: event.instanceId, effect: { kind: "keyword", keyword: event.grant.keyword }, scope: durationScope(event.grant.duration) };
    case "GRANT_ATTACK_TARGET_RELAX": {
      const { type: _type, instanceId, turn: _turn, ...conditions } = event;
      return { targetId: instanceId, effect: { kind: "attackTargetRelax", ...conditions }, scope: "turn" };
    }
    case "SET_CANNOT_ATTACK":
      return { targetId: event.instanceId, effect: { kind: "cannotAttack" }, scope: "turn" };
    case "SET_CANNOT_ACTIVATE":
      return { targetId: event.instanceId, effect: { kind: "staysRested" }, scope: "turn" };
    case "PREVENT_BEING_ATTACK_TARGET":
      return { targetId: event.instanceId, effect: { kind: "untargetable" }, scope: "turn" };
    case "SET_UNIT_DAMAGE_PROTECTION":
      return {
        targetId: event.instanceId,
        effect: { kind: "damageProtection", maxAttackerAp: event.maxAttackerAp, maxAttackerLevel: event.maxAttackerLevel, unconditional: event.unconditional },
        scope: "battle",
      };
    case "GRANT_DAMAGE_MODIFIER":
      return { targetId: event.instanceId, effect: { kind: "damageModifier", modifier: event.modifier }, scope: event.modifier.scope === "battle" ? "battle" : "turn" };
    case "GRANT_BATTLE_DAMAGE_IMMUNITY_UNTIL_TURN":
      return { targetId: event.instanceId, effect: { kind: "battleDamageImmunity", maxAttackerHp: event.maxAttackerHp }, scope: "turn" };
    default:
      return null;
  }
}

function durationScope(duration: "endOfTurn" | "thisBattle" | "permanent"): LedgerEntry["scope"] {
  return duration === "thisBattle" ? "battle" : duration === "permanent" ? "permanent" : "turn";
}

/** tipos de evento que deixam um efeito duradouro (a cena os mostra como tempo de efeito, com a linha da fonte) */
export const LASTING_EFFECT_EVENTS = new Set<GameEvent["type"]>([
  "MODIFY_STAT",
  "GRANT_KEYWORD",
  "GRANT_ATTACK_TARGET_RELAX",
  "SET_CANNOT_ATTACK",
  "SET_CANNOT_ACTIVATE",
  "PREVENT_BEING_ATTACK_TARGET",
  "SET_UNIT_DAMAGE_PROTECTION",
  "GRANT_DAMAGE_MODIFIER",
  "GRANT_BATTLE_DAMAGE_IMMUNITY_UNTIL_TURN",
]);

/** a carta que o evento afeta no campo (para a linha da fonte até ela durante o efeito) */
export function effectTargetOf(event: GameEvent): string | null {
  const lasting = lastingEffect(event);
  if (lasting) return lasting.targetId;
  switch (event.type) {
    case "DAMAGE_UNIT":
    case "HEAL_UNIT":
    case "DESTROY_CARD":
    case "REMOVE_CARD_FROM_GAME":
    case "REST_CARD":
    case "SET_ACTIVE":
      return event.instanceId;
    case "DAMAGE_BASE":
      return event.instanceId || null;
    default:
      return null;
  }
}

/**
 * Efeitos em vigor no fim de `eventLog`, desde a última virada de turno do log. `onField` (opcional) descarta os de
 * cartas que já saíram do campo.
 */
export function buildEffectLedger(eventLog: readonly GameEvent[], onField?: ReadonlySet<string>): LedgerEntry[] {
  let start = 0;
  for (let i = eventLog.length - 1; i >= 0; i--) {
    if (eventLog[i].type === "TURN_CHANGE") {
      start = i + 1;
      break;
    }
  }
  let entries: LedgerEntry[] = [];
  let source: LedgerSource | null = null;
  for (let i = start; i < eventLog.length; i++) {
    const event = eventLog[i];
    switch (event.type) {
      case "CARD_PLAYED":
        source = event.as === "command" ? { instanceId: event.instanceId, player: event.player, trigger: "Command" } : null;
        continue;
      case "ABILITY_ACTIVATED":
        source = { instanceId: event.instanceId, player: event.player, trigger: event.trigger };
        continue;
      case "PHASE_CHANGE":
      case "COMBAT_STEP_CHANGE":
      case "ATTACK_DECLARED":
      case "BEGIN_DAMAGE_ONLY_BATTLE":
        source = null;
        continue;
      case "COMBAT_ENDED":
        source = null;
        entries = entries.filter((e) => e.scope !== "battle");
        continue;
      case "CLEAR_TURN_MODIFIERS":
        entries = entries.filter((e) => e.scope === "permanent");
        continue;
      default:
        break;
    }
    const lasting = lastingEffect(event);
    if (lasting) entries.push({ id: `fx-${i}`, source, ...lasting });
  }
  return onField ? entries.filter((e) => onField.has(e.targetId)) : entries;
}

type Tr = (pt: string, en: string) => string;

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** o que o efeito faz, numa frase curta (balão do hover) */
export function describeLedgerEffect(effect: LedgerEffect, tr: Tr): string {
  switch (effect.kind) {
    case "stat":
      return `${signed(effect.amount)} ${effect.stat.toUpperCase()}`;
    case "keyword":
      return tr(`ganhou <${effect.keyword}>`, `gained <${effect.keyword}>`);
    case "attackTargetRelax":
      return tr(`pode atacar ${relaxTargetPt(effect)}`, `may attack ${relaxTargetEn(effect)}`);
    case "cannotAttack":
      return tr("não pode atacar", "can't attack");
    case "staysRested":
      return tr("não fica ativa no próximo início de turno", "won't be set active in the next start phase");
    case "untargetable":
      return tr("não pode ser escolhida como alvo de ataque", "can't be chosen as an attack target");
    case "damageProtection":
      if (effect.unconditional) return tr("não recebe dano de batalha", "takes no battle damage");
      return tr(
        `não recebe dano de batalha de inimigas${protectionLimitPt(effect)}`,
        `takes no battle damage from enemies${protectionLimitEn(effect)}`,
      );
    case "damageModifier":
      return damageModifierText(effect.modifier, tr);
    case "battleDamageImmunity":
      return tr(
        `não recebe dano de batalha de inimigas com HP ${effect.maxAttackerHp} ou menos`,
        `takes no battle damage from enemies with ${effect.maxAttackerHp} or less HP`,
      );
  }
}

/** a condição do alvo de ataque liberado (também o texto do selo "ALVO ATIVO") */
export function relaxTargetPt(c: Omit<Extract<LedgerEffect, { kind: "attackTargetRelax" }>, "kind">): string {
  const parts: string[] = [];
  if (c.damagedOnly) parts.push("danificada");
  if (c.unpairedOnly) parts.push("sem Piloto");
  if (c.keyword) parts.push(`com <${c.keyword}>`);
  if (c.maxAp !== undefined) parts.push(`com AP ${c.maxAp} ou menos`);
  if (c.apAtMostSelf) parts.push("com AP igual ou menor que o dela");
  if (c.maxLevel !== undefined) parts.push(`de Lv.${c.maxLevel} ou menos`);
  if (c.levelAtMostSelf) parts.push("de Lv. igual ou menor que o dela");
  return ["Unit inimiga ativa", ...parts].join(" ");
}

export function relaxTargetEn(c: Omit<Extract<LedgerEffect, { kind: "attackTargetRelax" }>, "kind">): string {
  const pre: string[] = [];
  const post: string[] = [];
  if (c.damagedOnly) pre.push("damaged");
  if (c.unpairedOnly) post.push("with no Pilot");
  if (c.keyword) post.push(`with <${c.keyword}>`);
  if (c.maxAp !== undefined) post.push(`with ${c.maxAp} or less AP`);
  if (c.apAtMostSelf) post.push("with AP equal to or less than this Unit");
  if (c.maxLevel !== undefined) post.push(`of Lv.${c.maxLevel} or lower`);
  if (c.levelAtMostSelf) post.push("of Lv. equal to or lower than this Unit");
  return ["an active", ...pre, "enemy Unit", ...post].join(" ");
}

function protectionLimitPt(e: Extract<LedgerEffect, { kind: "damageProtection" }>): string {
  const parts: string[] = [];
  if (e.maxAttackerAp !== undefined) parts.push(`AP ${e.maxAttackerAp} ou menos`);
  if (e.maxAttackerLevel !== undefined) parts.push(`Lv.${e.maxAttackerLevel} ou menos`);
  return parts.length ? ` com ${parts.join(" e ")}` : "";
}

function protectionLimitEn(e: Extract<LedgerEffect, { kind: "damageProtection" }>): string {
  const parts: string[] = [];
  if (e.maxAttackerAp !== undefined) parts.push(`${e.maxAttackerAp} or less AP`);
  if (e.maxAttackerLevel !== undefined) parts.push(`Lv.${e.maxAttackerLevel} or lower`);
  return parts.length ? ` with ${parts.join(" and ")}` : "";
}

function damageModifierText(m: DamageModifier, tr: Tr): string {
  const kindPt = m.kind === "battle" ? " de batalha" : m.kind === "effect" ? " de efeito" : "";
  const kindEn = m.kind === "battle" ? " battle" : m.kind === "effect" ? " effect" : "";
  const fromPt = m.sourceUnitOnly ? " de Units inimigas" : m.enemyOnly ? " de inimigos" : "";
  const fromEn = m.sourceUnitOnly ? " from enemy Units" : m.enemyOnly ? " from enemies" : "";
  const lvPt = m.sourceMaxLevel !== undefined ? ` de Lv.${m.sourceMaxLevel} ou menos` : "";
  const lvEn = m.sourceMaxLevel !== undefined ? ` of Lv.${m.sourceMaxLevel} or lower` : "";
  const nextPt = m.scope === "next" ? "o próximo dano" : "dano";
  const nextEn = m.scope === "next" ? "the next" : "";
  if (m.immune) return tr(`não recebe ${nextPt}${kindPt}${fromPt}${lvPt}`, `takes no${nextEn ? ` ${nextEn}` : ""}${kindEn} damage${fromEn}${lvEn}`);
  const amount = m.amount ?? 0;
  return amount < 0
    ? tr(`recebe ${-amount} a menos de ${nextPt}${kindPt}${fromPt}${lvPt}`, `takes ${-amount} less${nextEn ? ` from ${nextEn}` : ""}${kindEn} damage${fromEn}${lvEn}`)
    : tr(`recebe ${amount} a mais de ${nextPt}${kindPt}${fromPt}${lvPt}`, `takes ${amount} more${nextEn ? ` from ${nextEn}` : ""}${kindEn} damage${fromEn}${lvEn}`);
}

/** até quando vale */
export function ledgerScopeLabel(scope: LedgerEntry["scope"], tr: Tr): string {
  if (scope === "battle") return tr("nesta batalha", "this battle");
  if (scope === "permanent") return tr("enquanto estiver em jogo", "while in play");
  return tr("neste turno", "this turn");
}

/** "Kayra's Jegan 【Deploy】" / "Command X" / "Efeito" — quem causou */
export function ledgerSourceLabel(source: LedgerSource | null, nameOf: (id: string) => string | undefined, tr: Tr): string {
  if (!source) return tr("Efeito", "Effect");
  const name = nameOf(source.instanceId) ?? tr("Carta", "Card");
  if (source.trigger === "Command") return name;
  const bracket: Record<string, string> = {
    Deploy: "Deploy",
    Attack: "Attack",
    Destroyed: "Destroyed",
    Burst: "Burst",
    "When Paired": "When Paired",
    "When Linked": "When Linked",
    "Activate·Main": "Activate･Main",
    "Activate·Action": "Activate･Action",
  };
  const tag = bracket[source.trigger];
  return tag ? `${name} 【${tag}】` : name;
}

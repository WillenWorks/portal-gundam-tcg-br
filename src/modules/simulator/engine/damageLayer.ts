import { findCard } from "./events";
import {
  effectivePilotDef,
  isBoardConditionMet,
  satisfiesLinkCondition,
  type CardInstance,
  type DamageConsumption,
  type DamageReduction,
  type GameState,
  type PlayerId,
} from "./types";

/**
 * W5 (C2) — camada única de dano recebido. O Damage Step (`combat.ts`) e os efeitos (`damageUnit`)
 * calculam o valor FINAL aqui antes de emitir `DAMAGE_UNIT`/`DAMAGE_BASE`; o evento carrega o que o
 * dano consumiu (1×/turno, "next damage"), então `applyEvent` nunca recalcula — a letalidade
 * pré-calculada e o dano aplicado são sempre o mesmo número.
 */
export interface DamageSource {
  kind: "battle" | "effect";
  /** quem controla o dano (dono do atacante / controlador do efeito) */
  controller: PlayerId;
  /** atacante/bloqueador, ou a carta do efeito */
  sourceId?: string;
}

export interface IncomingDamage {
  amount: number;
  consume?: DamageConsumption;
}

function sourceCard(state: GameState, src: DamageSource): CardInstance | undefined {
  if (!src.sourceId) return undefined;
  try {
    return findCard(state, src.sourceId);
  } catch {
    return undefined; // fonte já saiu do jogo (ex. token removido) — só as restrições de fonte deixam de casar
  }
}

/** a Unit por trás da fonte: a própria Unit, ou a Unit pareada de um Piloto (o texto do Piloto é da Unit) */
function sourceUnit(state: GameState, src: DamageSource): CardInstance | undefined {
  const source = sourceCard(state, src);
  if (!source) return undefined;
  if (source.def.cardType === "UNIT") return source;
  if (source.def.cardType === "PILOT" && source.pairedUnitId) return findCard(state, source.pairedUnitId);
  return undefined;
}

/** a Unit `target` é Link Unit agora (com o Piloto pareado) */
function isLinked(state: GameState, target: CardInstance): boolean {
  if (!target.pairedPilotId) return false;
  return satisfiesLinkCondition(effectivePilotDef(findCard(state, target.pairedPilotId)), target.def);
}

function reductionApplies(state: GameState, target: CardInstance, holder: CardInstance, r: DamageReduction, src: DamageSource, marker: string): boolean {
  if (r.kind && r.kind !== src.kind) return false;
  if (r.oncePerTurn && holder.usedKeywordsThisTurn.includes(marker)) return false;
  if (r.duringLink && !isLinked(state, target)) return false;
  if (r.boardCondition && !isBoardConditionMet(state, target.owner, r.boardCondition, target.instanceId)) return false;
  const unit = sourceUnit(state, src);
  if (r.sourceUnitOnly && !unit) return false;
  if (r.sourceNotToken && (!unit || unit.def.isToken)) return false;
  if (r.sourceMaxLevel !== undefined && (!unit || (unit.def.level ?? 0) > r.sourceMaxLevel)) return false;
  if (r.whenBlockedByMaxLevel !== undefined) {
    const combat = state.combat;
    if (src.kind !== "battle" || !combat?.blockerUsedBy || combat.attackerId !== target.instanceId) return false;
    if ((findCard(state, combat.blockerUsedBy).def.level ?? 0) > r.whenBlockedByMaxLevel) return false;
  }
  return true;
}

export function incomingDamage(state: GameState, target: CardInstance, amount: number, src: DamageSource): IncomingDamage {
  if (amount <= 0) return { amount: 0 };
  const fromEnemy = src.controller !== target.owner;

  let remaining = amount;
  const markers: Array<{ instanceId: string; marker: string }> = [];
  // os textos estáticos de redução falam todos de dano "from an enemy"
  const holders: CardInstance[] = fromEnemy ? [target] : [];
  if (fromEnemy && target.pairedPilotId) holders.push(findCard(state, target.pairedPilotId));

  for (const holder of holders) {
    const reductions = holder === target ? holder.def.damageReductions : effectivePilotDef(holder).damageReductions;
    (reductions ?? []).forEach((r, i) => {
      if (remaining <= 0) return;
      const marker = `damageReduction:${i}`;
      if (!reductionApplies(state, target, holder, r, src, marker)) return;
      remaining = r.immune ? 0 : Math.max(0, remaining - (r.amount ?? 0));
      if (r.oncePerTurn) markers.push({ instanceId: holder.instanceId, marker });
    });
  }

  let dropNext = false;
  for (const m of target.damageModifiers ?? []) {
    if (remaining <= 0) break;
    if (m.turn !== state.turnNumber) continue;
    if (m.kind && m.kind !== src.kind) continue;
    if (m.enemyOnly && !fromEnemy) continue;
    if (m.sourceUnitOnly && !sourceUnit(state, src)) continue;
    if (m.sourceMaxLevel !== undefined) {
      const unit = sourceUnit(state, src);
      if (!unit || (unit.def.level ?? 0) > m.sourceMaxLevel) continue;
    }
    if (m.scope === "battle" && !state.combat) continue;
    remaining = m.immune ? 0 : Math.max(0, remaining - (m.amount ?? 0));
    if (m.scope === "next") dropNext = true;
  }

  const consume: DamageConsumption | undefined = markers.length || dropNext ? { markers: markers.length ? markers : undefined, dropNext: dropNext || undefined } : undefined;
  return { amount: remaining, consume };
}

/** GD04-087/095 — para onde vai o dano de batalha que `unit` receberia (a própria, se não há redirecionamento válido) */
export function battleDamageVictim(state: GameState, unit: CardInstance): CardInstance {
  const r = unit.battleDamageRedirect;
  if (!r || r.turn !== state.turnNumber || (r.scope === "battle" && !state.combat)) return unit;
  const to = state.players[unit.owner].battleArea.find((c) => c.instanceId === r.toId);
  return to ?? unit;
}

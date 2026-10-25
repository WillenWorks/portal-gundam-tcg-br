import type { AttackTarget, GameState, PlayerId } from "./types";
import type { EffectSpec } from "./effectSpec";
import { computeLegalTargets, trashExileChoice } from "./effectSpec";
import { findTriggerSpecs } from "./dispatcher";
import { specResourceCost } from "./costs";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { actionOwner, enumerateLegalActions, neededTargetIds, type EnumerateOptions, type LegalAction } from "./legalActions";

/**
 * Menu de jogadas do jogador, agrupado por carta de origem — o que a tela precisa para desenhar botões e destacar
 * alvos sem recalcular regra nenhuma (spec `.planning/specs/simulador-tela-pelo-motor.md`). A fonte da verdade
 * continua sendo `enumerateLegalActions`: o menu só agrupa as jogadas legais e, onde a enumeração corta
 * combinações (alvo múltiplo, 2º alvo), devolve o conjunto inteiro de alvos que o motor calcula.
 *
 * Decisão pendente (`pendingDecision`) não entra: a própria decisão já carrega opções e alvos legais.
 */

export interface LegalMenuSlot {
  /** nome do alvo no `targets` da ação ("target", nome do 2º alvo, "trashExile") */
  name: string;
  legalTargets: string[];
  min: number;
  max: number;
}

export type LegalMenuEntry =
  | { kind: "deployCard"; cardInstanceId: string; standalone: boolean; pairWithUnitIds: string[] }
  | { kind: "playCommand"; cardInstanceId: string; trigger: "Main" | "Action"; slots: LegalMenuSlot[]; altCostDiscardId?: string }
  | {
      kind: "activateAbility";
      sourceInstanceId: string;
      trigger: "Activate·Main" | "Activate·Action";
      slots: LegalMenuSlot[];
      resourceCost: number;
    }
  | { kind: "declareAttack"; attackerId: string; targets: AttackTarget[] }
  | { kind: "activateBlocker"; blockerId: string };

export type LegalMenuPass = "finishTurn" | "passAction" | "skipBlock" | "passEndPhaseAction";

export interface LegalMenu {
  /** é a vez deste jogador agir (fora de decisão pendente) */
  active: boolean;
  entries: LegalMenuEntry[];
  passes: LegalMenuPass[];
}

const EMPTY: LegalMenu = { active: false, entries: [], passes: [] };

function abilityTrigger(state: GameState): "Activate·Main" | "Activate·Action" {
  return state.combat || state.endPhaseAction ? "Activate·Action" : "Activate·Main";
}

function uniq<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/** slot "target": alvo único → só os ids validados pela enumeração; alvo múltiplo → o conjunto inteiro do motor */
function targetSlot(
  state: GameState,
  seat: PlayerId,
  code: string,
  trigger: string,
  sourceId: string,
  actions: LegalAction[],
  specs: EffectSpec[],
  opts: EnumerateOptions,
): LegalMenuSlot | null {
  const chosen = actions.flatMap((a) => ("targets" in a && a.targets?.target) || []);
  if (chosen.length === 0) return null;
  const pool = neededTargetIds(state, seat, code, trigger, specs, opts.targetFilterResolver, sourceId);
  const multi = pool.targetCount.max > 1;
  return {
    name: "target",
    legalTargets: multi ? uniq([...pool.ids, ...chosen]) : uniq(chosen),
    min: multi ? pool.targetCount.min : 1,
    max: multi ? pool.targetCount.max : 1,
  };
}

function commandSlots(
  state: GameState,
  seat: PlayerId,
  cardId: string,
  trigger: "Main" | "Action",
  actions: LegalAction[],
  specs: EffectSpec[],
  opts: EnumerateOptions,
): LegalMenuSlot[] {
  const code = state.players[seat].hand.find((c) => c.instanceId === cardId)?.def.code;
  if (!code) return [];
  const withSecondary = findTriggerSpecs(specs, code, trigger).find((s) => s.secondaryTarget);
  if (withSecondary?.secondaryTarget) {
    const sec = withSecondary.secondaryTarget;
    const primary = computeLegalTargets(state, withSecondary, seat, opts.targetFilterResolver, cardId);
    const secondary = computeLegalTargets(state, { targetScope: sec.targetScope, targetFilter: sec.targetFilter }, seat, opts.targetFilterResolver, cardId);
    const count = withSecondary.targetCount ?? { min: 1, max: 1 };
    const slots: LegalMenuSlot[] = [];
    if (primary.length > 0) slots.push({ name: "target", legalTargets: primary, min: Math.min(count.min, primary.length), max: count.max });
    if (secondary.length > 0) slots.push({ name: sec.name, legalTargets: secondary, min: 1, max: 1 });
    return slots;
  }
  const slot = targetSlot(state, seat, code, trigger, cardId, actions, specs, opts);
  return slot ? [slot] : [];
}

function abilitySlots(
  state: GameState,
  seat: PlayerId,
  sourceId: string,
  trigger: "Activate·Main" | "Activate·Action",
  actions: LegalAction[],
  specs: EffectSpec[],
  opts: EnumerateOptions,
): { slots: LegalMenuSlot[]; resourceCost: number } {
  const source = [...state.players[seat].battleArea, ...state.players[seat].baseSection].find((c) => c.instanceId === sourceId);
  if (!source) return { slots: [], resourceCost: 0 };
  const abilitySpecs = findTriggerSpecs(specs, source.def.code, trigger);
  const slots: LegalMenuSlot[] = [];
  const target = abilitySpecs.length
    ? targetSlot(state, seat, source.def.code, trigger, sourceId, actions, specs, opts)
    : // <Support N>: os alvos já vêm validados um a um pela enumeração
      { name: "target", legalTargets: uniq(actions.flatMap((a) => ("targets" in a && a.targets?.target) || [])), min: 1, max: 1 };
  if (target && target.legalTargets.length > 0) slots.push(target);
  const exile = abilitySpecs.map((s) => trashExileChoice(state, s, seat)).find(Boolean);
  if (exile && actions.some((a) => "targets" in a && a.targets?.trashExile)) {
    slots.push({ name: "trashExile", legalTargets: exile.legalTrashIds, min: exile.count, max: exile.count });
  }
  const resourceCost = abilitySpecs.length ? Math.min(...abilitySpecs.map(specResourceCost)) : 0;
  return { slots, resourceCost };
}

export function legalMenuFor(state: GameState, seat: PlayerId, specs: EffectSpec[] = [], opts: EnumerateOptions = {}): LegalMenu {
  if (actionOwner(state) !== seat || state.pendingDecision[seat]) return EMPTY;
  const legal = enumerateLegalActions(state, seat, specs, opts);

  const passes: LegalMenuPass[] = [];
  const deploys = new Map<string, LegalAction[]>();
  const commands = new Map<string, LegalAction[]>();
  const abilities = new Map<string, LegalAction[]>();
  const attacks = new Map<string, AttackTarget[]>();
  const blockers: string[] = [];
  const push = <V>(map: Map<string, V[]>, key: string, value: V) => map.set(key, [...(map.get(key) ?? []), value]);

  for (const a of legal) {
    switch (a.kind) {
      case "finishTurn":
      case "passAction":
      case "skipBlock":
      case "passEndPhaseAction":
        passes.push(a.kind);
        break;
      case "deployCard":
        push(deploys, a.cardInstanceId, a);
        break;
      case "playCommand":
        push(commands, `${a.cardInstanceId}\u0000${a.trigger ?? "Main"}\u0000${a.altCostDiscardId ?? ""}`, a);
        break;
      case "activateAbility":
        push(abilities, a.sourceInstanceId, a);
        break;
      case "declareAttack":
        push(attacks, a.attackerId, a.target);
        break;
      case "activateBlocker":
        blockers.push(a.blockerId);
        break;
    }
  }

  const entries: LegalMenuEntry[] = [];
  for (const [cardInstanceId, actions] of deploys) {
    entries.push({
      kind: "deployCard",
      cardInstanceId,
      standalone: actions.some((a) => a.kind === "deployCard" && !a.pairWithUnitId),
      pairWithUnitIds: uniq(actions.flatMap((a) => (a.kind === "deployCard" && a.pairWithUnitId ? [a.pairWithUnitId] : []))),
    });
  }
  for (const [key, actions] of commands) {
    const [cardInstanceId, trigger, altCostDiscardId] = key.split("\u0000") as [string, "Main" | "Action", string];
    entries.push({
      kind: "playCommand",
      cardInstanceId,
      trigger,
      slots: commandSlots(state, seat, cardInstanceId, trigger, actions, specs, opts),
      ...(altCostDiscardId ? { altCostDiscardId } : {}),
    });
  }
  const trigger = abilityTrigger(state);
  for (const [sourceInstanceId, actions] of abilities) {
    entries.push({ kind: "activateAbility", sourceInstanceId, trigger, ...abilitySlots(state, seat, sourceInstanceId, trigger, actions, specs, opts) });
  }
  for (const [attackerId, targets] of attacks) entries.push({ kind: "declareAttack", attackerId, targets });
  for (const blockerId of blockers) entries.push({ kind: "activateBlocker", blockerId });

  return { active: true, entries, passes };
}

/** escolha de um slot começando por `id`, no tamanho mínimo aceito (≥ 1) */
function pick(slot: LegalMenuSlot, id: string): string[] {
  return [id, ...slot.legalTargets.filter((x) => x !== id)].slice(0, Math.max(slot.min, 1));
}

/** todas as jogadas que a tela pode montar a partir de uma entrada: cada alvo oferecido, com os outros slots no 1º */
export function expandMenuEntry(entry: LegalMenuEntry): PlayerAction[] {
  const withSlots = (base: PlayerAction, slots: LegalMenuSlot[]): PlayerAction[] => {
    if (slots.length === 0) return [base];
    const out: PlayerAction[] = [];
    for (const slot of slots) {
      for (const id of slot.legalTargets) {
        const targets = Object.fromEntries(slots.map((s) => [s.name, s === slot ? pick(s, id) : pick(s, s.legalTargets[0])]));
        out.push({ ...base, targets } as PlayerAction);
      }
    }
    return out;
  };
  switch (entry.kind) {
    case "deployCard":
      return [
        ...(entry.standalone ? [{ kind: "deployCard", cardInstanceId: entry.cardInstanceId } as PlayerAction] : []),
        ...entry.pairWithUnitIds.map((pairWithUnitId): PlayerAction => ({ kind: "deployCard", cardInstanceId: entry.cardInstanceId, pairWithUnitId })),
      ];
    case "playCommand":
      return withSlots(
        { kind: "playCommand", cardInstanceId: entry.cardInstanceId, trigger: entry.trigger, ...(entry.altCostDiscardId ? { altCostDiscardId: entry.altCostDiscardId } : {}) },
        entry.slots,
      );
    case "activateAbility":
      return withSlots({ kind: "activateAbility", sourceInstanceId: entry.sourceInstanceId }, entry.slots);
    case "declareAttack":
      return entry.targets.map((target): PlayerAction => ({ kind: "declareAttack", attackerId: entry.attackerId, target }));
    case "activateBlocker":
      return [{ kind: "activateBlocker", blockerId: entry.blockerId }];
  }
}

function slotsCover(slots: LegalMenuSlot[], targets: Record<string, string[]> | undefined): boolean {
  return Object.entries(targets ?? {}).every(([name, ids]) => {
    const slot = slots.find((s) => s.name === name);
    return !!slot && ids.length <= slot.max && ids.every((id) => slot.legalTargets.includes(id));
  });
}

/** a jogada legal tem botão/alvo correspondente no menu */
export function menuCoversAction(menu: LegalMenu, a: PlayerAction): boolean {
  switch (a.kind) {
    case "finishTurn":
    case "passAction":
    case "skipBlock":
    case "passEndPhaseAction":
      return menu.passes.includes(a.kind);
    case "deployCard":
      return menu.entries.some(
        (e) => e.kind === "deployCard" && e.cardInstanceId === a.cardInstanceId && (a.pairWithUnitId ? e.pairWithUnitIds.includes(a.pairWithUnitId) : e.standalone),
      );
    case "playCommand":
      return menu.entries.some(
        (e) =>
          e.kind === "playCommand" &&
          e.cardInstanceId === a.cardInstanceId &&
          e.trigger === (a.trigger ?? "Main") &&
          e.altCostDiscardId === a.altCostDiscardId &&
          slotsCover(e.slots, a.targets),
      );
    case "activateAbility":
      return menu.entries.some((e) => e.kind === "activateAbility" && e.sourceInstanceId === a.sourceInstanceId && slotsCover(e.slots, a.targets));
    case "declareAttack":
      return menu.entries.some(
        (e) => e.kind === "declareAttack" && e.attackerId === a.attackerId && e.targets.some((t) => JSON.stringify(t) === JSON.stringify(a.target)),
      );
    case "activateBlocker":
      return menu.entries.some((e) => e.kind === "activateBlocker" && e.blockerId === a.blockerId);
    default:
      return false;
  }
}

/**
 * Diferencial menu × motor (camada 3): toda jogada legal tem entrada no menu, e toda jogada montável pelo menu o
 * motor aceita. Devolve a 1ª divergência, ou `null`. Usado no teste e no fuzz (`--menu`).
 */
export function checkLegalMenu(state: GameState, seat: PlayerId, specs: EffectSpec[] = [], opts: EnumerateOptions = {}): string | null {
  if (state.pendingDecision[seat]) return null;
  const menu = legalMenuFor(state, seat, specs, opts);
  for (const a of enumerateLegalActions(state, seat, specs, opts)) {
    if (!menuCoversAction(menu, a)) return `jogada legal fora do menu: ${JSON.stringify(a)}`;
  }
  for (const entry of menu.entries) {
    for (const a of expandMenuEntry(entry)) {
      try {
        applyPlayerAction(state, seat, a, specs, opts.predicateResolver, opts.targetFilterResolver);
      } catch (err) {
        return `menu oferece jogada que o motor recusa: ${JSON.stringify(a)} → ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }
  return null;
}

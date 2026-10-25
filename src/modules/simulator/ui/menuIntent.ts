/* Leitura do menu de jogadas que o servidor manda (`MatchView.legalMenu`, calculado por `legalMenuFor` no motor).
 * A tela pergunta aqui "esta carta tem jogada? com que alvos?" em vez de recalcular regra. Puro/testável. */
import type { LegalMenu, LegalMenuEntry, LegalMenuSlot } from "../engine/legalMenu";
import type { FieldAbility } from "./abilityIntent";

type AbilityEntry = Extract<LegalMenuEntry, { kind: "activateAbility" }>;

export function abilityEntryFor(menu: LegalMenu | undefined, instanceId: string): AbilityEntry | undefined {
  return menu?.entries.find((e): e is AbilityEntry => e.kind === "activateAbility" && e.sourceInstanceId === instanceId);
}

/** a habilidade de campo desta carta, se o motor a oferece agora — mesmo formato que `fieldAbilityFor` devolvia */
export function fieldAbilityFromMenu(menu: LegalMenu, instanceId: string): FieldAbility | null {
  const entry = abilityEntryFor(menu, instanceId);
  if (!entry) return null;
  return {
    kind: entry.support ? "support" : entry.trigger === "Activate·Action" ? "activateAction" : "activateMain",
    cost: entry.resourceCost,
    needsTarget: entry.slots.some((s) => s.name === "target"),
  };
}

export interface MenuTargets {
  legalTargetInstanceIds: Set<string>;
  requiredTargetCount: number;
  maxTargetCount: number;
}

function fromSlot(slot: LegalMenuSlot | undefined): MenuTargets | null {
  if (!slot) return null;
  return { legalTargetInstanceIds: new Set(slot.legalTargets), requiredTargetCount: slot.min, maxTargetCount: slot.max };
}

/** alvos do slot "target" da habilidade (ou `null` se ela não pede alvo) */
export function abilityTargetsFromMenu(menu: LegalMenu, instanceId: string): MenuTargets | null {
  return fromSlot(abilityEntryFor(menu, instanceId)?.slots.find((s) => s.name === "target"));
}

type DeployEntry = Extract<LegalMenuEntry, { kind: "deployCard" }>;
type CommandEntry = Extract<LegalMenuEntry, { kind: "playCommand" }>;

function commandEntry(menu: LegalMenu, cardId: string, trigger: "Main" | "Action", altDiscardId?: string): CommandEntry | undefined {
  return menu.entries.find(
    (e): e is CommandEntry => e.kind === "playCommand" && e.cardInstanceId === cardId && e.trigger === trigger && e.altCostDiscardId === altDiscardId,
  );
}

/** modos de jogo da carta da mão que o motor oferece agora (mesmos rótulos de `playableModes`) */
export function handModesFromMenu(menu: LegalMenu, cardId: string): Array<"deploy" | "commandMain" | "commandAction"> {
  const modes: Array<"deploy" | "commandMain" | "commandAction"> = [];
  if (menu.entries.some((e) => e.kind === "deployCard" && e.cardInstanceId === cardId && (e.standalone || e.pairWithUnitIds.length > 0))) {
    modes.push("deploy");
  }
  const commands = menu.entries.filter((e): e is CommandEntry => e.kind === "playCommand" && e.cardInstanceId === cardId);
  if (commands.some((e) => e.trigger === "Main")) modes.push("commandMain");
  if (commands.some((e) => e.trigger === "Action")) modes.push("commandAction");
  return modes;
}

/** a Command pode ser jogada pelo custo normal (sem o descarte alternativo do ST10-014) */
export function normalCommandFromMenu(menu: LegalMenu, cardId: string, trigger: "Main" | "Action"): boolean {
  return Boolean(commandEntry(menu, cardId, trigger));
}

/** cartas da mão que pagam o custo alternativo por descarte, segundo o motor */
export function altDiscardIdsFromMenu(menu: LegalMenu, cardId: string): string[] {
  return menu.entries.flatMap((e) => (e.kind === "playCommand" && e.cardInstanceId === cardId && e.altCostDiscardId ? [e.altCostDiscardId] : []));
}

/** Units com que o Piloto (ou Command no modo Piloto) pode parear agora */
export function pairTargetsFromMenu(menu: LegalMenu, cardId: string): MenuTargets | null {
  const entry = menu.entries.find((e): e is DeployEntry => e.kind === "deployCard" && e.cardInstanceId === cardId);
  if (!entry || entry.pairWithUnitIds.length === 0) return null;
  return { legalTargetInstanceIds: new Set(entry.pairWithUnitIds), requiredTargetCount: 1, maxTargetCount: 1 };
}

/** alvo principal da Command (slot "target") */
export function commandTargetsFromMenu(menu: LegalMenu, cardId: string, trigger: "Main" | "Action", altDiscardId?: string): MenuTargets | null {
  return fromSlot(commandEntry(menu, cardId, trigger, altDiscardId)?.slots.find((s) => s.name === "target"));
}

/** 2º alvo da Command (`secondaryTarget`), no formato de `secondaryTargetingFor` */
export function commandSecondaryFromMenu(
  menu: LegalMenu,
  cardId: string,
  trigger: "Main" | "Action",
  altDiscardId?: string,
): { name: string; ids: Set<string> } | null {
  const slot = commandEntry(menu, cardId, trigger, altDiscardId)?.slots.find((s) => s.name !== "target");
  return slot ? { name: slot.name, ids: new Set(slot.legalTargets) } : null;
}

/** alvos de ataque que o motor aceita para esta Unit (`null` = ela não pode atacar agora) */
export function attackTargetsFromMenu(menu: LegalMenu, attackerId: string): { player: boolean; unitIds: Set<string> } | null {
  const entry = menu.entries.find((e) => e.kind === "declareAttack" && e.attackerId === attackerId);
  if (!entry || entry.kind !== "declareAttack") return null;
  return {
    player: entry.targets.includes("player"),
    unitIds: new Set(entry.targets.flatMap((t) => (t === "player" ? [] : [t.unitId]))),
  };
}

/** Units que podem ativar <Blocker> agora */
export function blockerIdsFromMenu(menu: LegalMenu): Set<string> {
  return new Set(menu.entries.flatMap((e) => (e.kind === "activateBlocker" ? [e.blockerId] : [])));
}

/** GD01-002 — Units que o motor aceita destruir para jogar esta carta por 0 */
export function sacrificeIdsFromMenu(menu: LegalMenu, cardId: string): string[] {
  return menu.entries.flatMap((e) => (e.kind === "deployCard" && e.cardInstanceId === cardId ? e.sacrificeIds : []));
}

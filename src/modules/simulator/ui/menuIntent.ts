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

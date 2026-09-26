import type { EffectSpec, TargetFilterResolver } from "../engine/effectSpec";
import { computeLegalTargets } from "../engine/effectSpec";
import { findTriggerSpecs } from "../engine/dispatcher";
import type { GameState, PlayerId } from "../engine/types";

/**
 * W0 — 2º pool de alvo de Command (`EffectSpec.secondaryTarget`, ex. GD03-116 "Choose 1
 * friendly (Vagan) Unit and 1 enemy Unit"; GD01-103/112). A tela escolhe em 2 etapas:
 * primeiro o(s) alvo(s) do pool principal, depois o 2º. Antes disto a UI só mandava
 * `targets.target` e o motor recusava a jogada (alvo nomeado ausente).
 */
export interface SecondaryTargeting {
  /** chave em `targets` (`secondaryTarget.name`, ex. "enemyTarget") */
  name: string;
  ids: Set<string>;
}

/** pool do 2º alvo do spec de `trigger` da Command, ou `null` se não há 2º alvo (ou o pool está vazio). */
export function secondaryTargetingFor(
  state: GameState,
  seat: PlayerId,
  cardCode: string,
  trigger: "Main" | "Action",
  specs: EffectSpec[],
  targetFilterResolver: TargetFilterResolver,
): SecondaryTargeting | null {
  const spec = findTriggerSpecs(specs, cardCode, trigger).find((s) => s.secondaryTarget);
  if (!spec?.secondaryTarget) return null;
  const ids = new Set<string>();
  try {
    for (const id of computeLegalTargets(
      state,
      { targetScope: spec.secondaryTarget.targetScope, targetFilter: spec.secondaryTarget.targetFilter },
      seat,
      targetFilterResolver,
    )) {
      ids.add(id);
    }
  } catch {
    // filtro sem resolver — sem pool (a jogada segue só com o alvo principal)
  }
  return ids.size > 0 ? { name: spec.secondaryTarget.name, ids } : null;
}

/** a etapa do 1º alvo acabou: sem pool principal, ou já com o mínimo exigido. */
export function primaryTargetsDone(primaryPoolSize: number, requiredTargetCount: number, selected: string[]): boolean {
  return primaryPoolSize === 0 || selected.length >= Math.max(1, requiredTargetCount);
}

/** falta escolher o 2º alvo? (só quando o pool principal existe — sem ele o spec nem resolve) */
export function missingSecondaryTarget(
  secondary: SecondaryTargeting | null,
  primaryPoolSize: number,
  secondarySelected: string[],
): boolean {
  return Boolean(secondary) && primaryPoolSize > 0 && secondarySelected.length === 0;
}

/** `targets` da `playCommand`: `target` + a chave do 2º alvo, só com o que foi escolhido. */
export function commandTargets(
  primary: string[],
  secondary: SecondaryTargeting | null,
  secondarySelected: string[],
): Record<string, string[]> | undefined {
  const targets: Record<string, string[]> = {};
  if (primary.length > 0) targets.target = primary;
  if (secondary && secondarySelected.length > 0) targets[secondary.name] = secondarySelected;
  return Object.keys(targets).length > 0 ? targets : undefined;
}

/* Resolve o pareamento de um deploy de Piloto a partir dos cliques (`selected`).
 *
 * Sprint 6 · Etapa 4 — o 【When Paired】 direcionado deixou de precisar do 2º
 * clique ANTES de confirmar: o motor pausa (`PendingDecision: whenPaired`) e o
 * alvo é escolhido num momento SEPARADO, no `WhenPairedModal`. Aqui só decide
 * `pairWithUnitId` e informa (`needsWhenPairedTarget`) pra dica de UI.
 * Puro/testável — sem React, sem rede. */
import { ALL_EFFECT_SPECS } from "../content";
import { specNeedsNamedTarget } from "../engine/effectSpec";
import type { CardInstance } from "../engine/types";

export { specNeedsNamedTarget };

/** true se parear (Piloto `pilotCode` + Unit `unitCode`) dispara um 【When Paired】 direcionado. */
export function pairingNeedsExtraTarget(pilotCode?: string, unitCode?: string): boolean {
  return [pilotCode, unitCode].some(
    (code) =>
      !!code &&
      ALL_EFFECT_SPECS.some(
        (spec) => spec.cardCode === code && spec.trigger === "When Paired" && specNeedsNamedTarget(spec),
      ),
  );
}

export interface OwnBattleUnit {
  instanceId: string;
  code: string;
  /** já tem Piloto pareado (não pode receber outro). */
  paired: boolean;
}

export interface DeploySelection {
  pairWithUnitId?: string;
  /** este pareamento vai acionar um 【When Paired】 direcionado (resolvido no modal). */
  needsWhenPairedTarget: boolean;
  /** motivo pra bloquear a confirmação (mostrar em toast). undefined = pode mandar. */
  error?: string;
}

/** Resolve `pairWithUnitId` de um deploy de Piloto a partir dos cliques. */
export function resolveDeploySelection(opts: {
  card: CardInstance | undefined;
  selected: string[];
  ownBattleUnits: OwnBattleUnit[];
}): DeploySelection {
  const { card, selected, ownBattleUnits } = opts;
  const isPilot = card?.def.cardType === "PILOT" || !!card?.def.pilotMode;
  if (!isPilot) return { needsWhenPairedTarget: false };

  const pairWithUnitId = selected.find((id) => ownBattleUnits.some((u) => u.instanceId === id && !u.paired));
  if (!pairWithUnitId) {
    return {
      needsWhenPairedTarget: false,
      error: "Selecione (clicando na Battle Area) a Unit própria pra parear com este Pilot.",
    };
  }

  const pairedUnitCode = ownBattleUnits.find((u) => u.instanceId === pairWithUnitId)?.code;
  return {
    pairWithUnitId,
    needsWhenPairedTarget: pairingNeedsExtraTarget(card?.def.code, pairedUnitCode),
  };
}

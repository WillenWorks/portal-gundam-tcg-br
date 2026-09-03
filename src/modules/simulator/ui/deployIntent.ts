/* Sprint 6 · PROMPT 1 — resolve o pareamento + alvos de um deploy a partir dos
 * cliques do jogador (`selected`), e detecta quando o deploy aciona um
 * 【When Paired】 DIRECIONADO (ex.: ST01-010 Amuro Ray "Choose 1 enemy Unit...",
 * ST01-006 Gundam Aerial no lado da Unit) que exige um 2º clique num alvo
 * inimigo além da Unit pra parear.
 *
 * O motor (`deploy.ts` + `dispatchTrigger`) já trata `pairWithUnitId` e
 * `targets.target` como campos independentes de `PlayerAction["deployCard"]` —
 * o que faltava era a TELA pedir e validar o 2º clique antes de mandar a ação
 * (sem isso o efeito estourava cru no motor: "Alvo nomeado 'target' não foi
 * resolvido"). Puro e testável — sem React, sem rede. */
import { ALL_EFFECT_SPECS } from "../content";
import type { EffectSpec, PrimitiveCall } from "../engine/effectSpec";
import type { CardInstance } from "../engine/types";

function usesNamedTarget(calls: PrimitiveCall[] | undefined): boolean {
  return (calls ?? []).some((call) => {
    const target = (call as { target?: { kind?: string; name?: string } }).target;
    return target?.kind === "named" && target.name === "target";
  });
}

/** true se o EffectSpec consome `ctx.targets.target` (alvo nomeado "target"). */
export function specNeedsNamedTarget(spec: EffectSpec): boolean {
  return (
    usesNamedTarget(spec.actions) ||
    usesNamedTarget(spec.condition?.then) ||
    usesNamedTarget(spec.condition?.else)
  );
}

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
  targetIds: string[];
  /** este deploy aciona um 【When Paired】 que precisa de alvo inimigo. */
  needsWhenPairedTarget: boolean;
  /** motivo pra bloquear a confirmação (mostrar em toast). undefined = pode mandar. */
  error?: string;
}

/** Resolve `pairWithUnitId` + `targetIds` de um deploy a partir dos cliques. */
export function resolveDeploySelection(opts: {
  card: CardInstance | undefined;
  selected: string[];
  ownBattleUnits: OwnBattleUnit[];
}): DeploySelection {
  const { card, selected, ownBattleUnits } = opts;
  const isPilot = card?.def.cardType === "PILOT" || !!card?.def.pilotMode;

  let pairWithUnitId: string | undefined;
  if (isPilot) {
    pairWithUnitId = selected.find((id) => ownBattleUnits.some((u) => u.instanceId === id && !u.paired));
    if (!pairWithUnitId) {
      return {
        targetIds: [],
        needsWhenPairedTarget: false,
        error: "Selecione (clicando na Battle Area) a Unit própria pra parear com este Pilot.",
      };
    }
  }

  const targetIds = selected.filter((id) => id !== pairWithUnitId);
  const pairedUnitCode = pairWithUnitId
    ? ownBattleUnits.find((u) => u.instanceId === pairWithUnitId)?.code
    : undefined;
  const needsWhenPairedTarget =
    Boolean(pairWithUnitId) && pairingNeedsExtraTarget(card?.def.code, pairedUnitCode);

  if (needsWhenPairedTarget && targetIds.length === 0) {
    return {
      pairWithUnitId,
      targetIds,
      needsWhenPairedTarget,
      error:
        "Este pareamento aciona um 【When Paired】 direcionado — clique também em 1 Unit inimiga como alvo antes de confirmar.",
    };
  }

  return { pairWithUnitId, targetIds, needsWhenPairedTarget };
}

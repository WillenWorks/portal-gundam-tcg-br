/* "Dispara agora, ou PAUSA pra o jogador resolver" — vocabulário compartilhado
 * entre 【When Paired】 (ao parear Piloto, `deploy.ts`) e 【Attack】 (ao declarar
 * ataque, `actions.ts`), e reaproveitável por qualquer gatilho futuro que possa
 * ser optativo ou precisar de alvo escolhido num momento separado da ação.
 *
 * Regra: se algum EffectSpec do `trigger` é `optional` OU consome
 * `ctx.targets.target` E o alvo não veio pronto (`opts.targets`), grava
 * `PendingDecision.abilityResolution` pro `player` — o jogador ordena os efeitos
 * simultâneos, escolhe o alvo de cada um e ativa/pula os optativos. Os demais
 * (self / mandatório sem alvo) resolvem na hora, antes da pausa. */
import { dispatchTrigger, findTriggerSpecs } from "./dispatcher";
import { specNeedsNamedTarget } from "./effectSpec";
import type { EffectSpec, PredicateResolver } from "./effectSpec";
import { applyEvents } from "./events";
import type { GameState, PlayerId } from "./types";

export interface AbilitySource {
  code: string;
  instanceId: string;
}

export function deferOrDispatchAbilities(
  state: GameState,
  player: PlayerId,
  trigger: string,
  sources: AbilitySource[],
  specs: EffectSpec[],
  opts: { targets?: Record<string, string[]>; predicateResolver?: PredicateResolver } = {},
): GameState {
  const entries = sources.flatMap((s) =>
    findTriggerSpecs(specs, s.code, trigger).map((spec) => ({ spec, sourceInstanceId: s.instanceId })),
  );
  if (entries.length === 0) return state;

  const dispatchOpts = { targets: opts.targets, predicateResolver: opts.predicateResolver };
  const interactive = entries.filter(({ spec }) => (spec.optional ?? false) || specNeedsNamedTarget(spec));

  // alvo já veio pronto (compat com testes/IA) ou nada precisa de interação: resolve tudo na hora.
  if (interactive.length === 0 || opts.targets) {
    let next = state;
    for (const { spec, sourceInstanceId } of entries) {
      next = dispatchTrigger(next, sourceInstanceId, trigger, [spec], dispatchOpts);
    }
    return next;
  }

  // automáticos primeiro; interativos vão pra fila da decisão.
  let next = state;
  for (const { spec, sourceInstanceId } of entries.filter((e) => !interactive.includes(e))) {
    next = dispatchTrigger(next, sourceInstanceId, trigger, [spec], dispatchOpts);
  }
  return applyEvents(next, [
    {
      type: "SET_PENDING_DECISION",
      player,
      decision: {
        kind: "abilityResolution",
        trigger,
        queue: interactive.map(({ spec, sourceInstanceId }) => ({
          sourceInstanceId,
          specId: spec.id,
          label: spec.sourceText,
          optional: spec.optional ?? false,
          needsTarget: specNeedsNamedTarget(spec),
          targetScope: spec.targetScope ?? "enemyUnit",
        })),
      },
    },
  ]);
}

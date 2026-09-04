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
import { computeLegalTargets, specNeedsNamedTarget } from "./effectSpec";
import type { EffectSpec, PredicateResolver, TargetFilterResolver } from "./effectSpec";
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
  opts: { targets?: Record<string, string[]>; predicateResolver?: PredicateResolver; targetFilterResolver?: TargetFilterResolver } = {},
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
          // V0 (docs/25): calculado UMA VEZ aqui, no servidor — a UI só lista,
          // `resolveAbility` valida contra isto (nunca confia no que o
          // cliente manda de volta).
          legalTargets: specNeedsNamedTarget(spec) ? computeLegalTargets(state, spec, player, opts.targetFilterResolver) : [],
        })),
      },
    },
  ]);
}

/**
 * Pro fluxo DIRETO/síncrono — sem pausa (Command 【Main】/【Action】, 【Burst】,
 * 【Activate·Main】/【Activate·Action】): filtra `specs` ANTES de despachar, pra
 * `dispatchTrigger` nunca tentar resolver um alvo nomeado que não é legal
 * agora (ou que nem foi escolhido). Mesma régua do V0 (docs/25) pro caminho
 * que NÃO passa por `deferOrDispatchAbilities`.
 *
 * - alvo legal existe mas nada foi escolhido, ou o escolhido não é legal ->
 *   lança (o cliente devia ter mostrado só os legais — se chegou aqui errado,
 *   é bug de UI ou tentativa de burlar; não aplica em silêncio).
 * - nenhum alvo legal existe agora -> spec sai do lote a despachar (efeito
 *   não ativa, regra oficial), SEM lançar erro — a carta/ação em si segue.
 * - spec não precisa de alvo nomeado -> passa direto, sem checagem nenhuma.
 */
export function filterDispatchableSpecs(
  state: GameState,
  cardCode: string,
  trigger: string,
  specs: EffectSpec[],
  controller: PlayerId,
  suppliedTargetIds: string[] | undefined,
  targetFilterResolver?: TargetFilterResolver,
): EffectSpec[] {
  return findTriggerSpecs(specs, cardCode, trigger).filter((spec) => {
    if (!specNeedsNamedTarget(spec)) return true;
    const legal = computeLegalTargets(state, spec, controller, targetFilterResolver);
    if (legal.length === 0) return false;
    const chosen = suppliedTargetIds?.[0];
    if (!chosen || !legal.includes(chosen)) {
      throw new Error(`Alvo inválido pra ${spec.id} — escolha um dos alvos legais mostrados no tabuleiro.`);
    }
    return true;
  });
}

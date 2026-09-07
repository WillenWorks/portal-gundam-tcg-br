import type { AttackTarget, CardInstance, GameState, PlayerId } from "./types";
import { hasKeyword } from "./types";
import type { EffectSpec, PredicateResolver, TargetFilterResolver } from "./effectSpec";
import { computeLegalTargets, specNeedsNamedTarget } from "./effectSpec";
import { findTriggerSpecs } from "./dispatcher";
import { canActivateBlocker } from "./combat";
import { canPayLevel } from "./deploy";
import { applyPlayerAction, type PlayerAction } from "./actions";

/**
 * Enumerador de ações legais (docs/44, Fase 1 — §3.3). Dado `state` + `seat`,
 * devolve TODA `PlayerAction` que `applyPlayerAction` aceitaria agora daquele
 * assento. É a fundação do bot heurístico (Fase 2), do fuzzing de regressão
 * (`scripts/gundam-fuzz.mjs`) e do MCTS (Fase 5) — o desenho é "dado o estado
 * e a lista de ações legais, escolher uma".
 *
 * `LegalAction` É `PlayerAction` (mesmo tipo, 1:1) — o consumidor aplica a
 * escolha direto por `applyPlayerAction`, sem tradução.
 *
 * Estratégia: gera candidatos amplos a partir dos helpers do próprio motor
 * (`canPayLevel`, `canActivateBlocker`, `findTriggerSpecs`, `computeLegalTargets`)
 * e então FILTRA cada um por uma aplicação de teste (`applyPlayerAction` é puro,
 * nunca muta o argumento). Um candidato só entra na lista se a aplicação de
 * teste não lançar. Erros "de legalidade" (o motor lança `Error` com mensagem
 * legível pra jogada ilegal) descartam o candidato em silêncio; qualquer outro
 * throwable (TypeError, RangeError, stack overflow, …) é RE-LANÇADO — é um bug
 * de motor de verdade e quem chama (self-play / fuzzer) precisa vê-lo.
 *
 * Fase de recurso: o motor atual desenha o recurso automaticamente
 * (`advanceToMainPhase` roda start→draw→resource→main sem parar) — não existe
 * um ponto de decisão "comprar recurso / passar". Por isso `enumerateLegalActions`
 * só trata Main Phase, Block Step, Action Step (combate e fim de turno) e
 * `pendingDecision`.
 */

export type LegalAction = PlayerAction;

export interface EnumerateOptions {
  predicateResolver?: PredicateResolver;
  targetFilterResolver?: TargetFilterResolver;
  /** default `true` — valida cada candidato por aplicação de teste. `false` devolve os candidatos crus (útil pra teste em estado sintético mínimo). */
  validate?: boolean;
}

/** Quem precisa agir agora, se algum — mesma prioridade de `matchStore.decisionOwner` (replicada aqui pra não importar o servidor no motor). */
export function actionOwner(state: GameState): PlayerId | null {
  if (state.gameOver) return null;
  for (const p of ["A", "B"] as PlayerId[]) {
    if (state.pendingDecision[p]) return p;
  }
  if (state.combat) {
    if (state.combat.step === "block") return state.combat.defendingPlayer;
    if (state.combat.step === "action") return state.combat.actionPriority;
    return null; // attack/damage/battleEnd avançam sozinhos
  }
  if (state.endPhaseAction) return state.endPhaseAction.priority;
  if (state.phase === "main") return state.activePlayer;
  return null;
}

function isPlainLegalityError(err: unknown): boolean {
  return err instanceof Error && err.name === "Error";
}

function activeResourceCount(state: GameState, seat: PlayerId): number {
  return state.players[seat].resourceArea.filter((r) => !r.rested).length;
}

function canAfford(state: GameState, seat: PlayerId, cost: number): boolean {
  return activeResourceCount(state, seat) >= cost;
}

function friendlyUnits(state: GameState, seat: PlayerId): CardInstance[] {
  return state.players[seat].battleArea.filter((c) => c.def.cardType === "UNIT");
}

function enemyUnits(state: GameState, seat: PlayerId): CardInstance[] {
  const other: PlayerId = seat === "A" ? "B" : "A";
  return state.players[other].battleArea.filter((c) => c.def.cardType === "UNIT");
}

/** ids de alvo "target" exigidos por algum spec do gatilho, já filtrados. `[]` se nada exige alvo. */
function neededTargetIds(
  state: GameState,
  seat: PlayerId,
  cardCode: string,
  trigger: string,
  specs: EffectSpec[],
  targetFilterResolver?: TargetFilterResolver,
): { ids: string[]; someSpecNeeds: boolean } {
  const triggerSpecs = findTriggerSpecs(specs, cardCode, trigger);
  const needing = triggerSpecs.filter((s) => specNeedsNamedTarget(s));
  if (needing.length === 0) return { ids: [], someSpecNeeds: false };
  const ids = new Set<string>();
  for (const spec of needing) {
    try {
      for (const id of computeLegalTargets(state, spec, seat, targetFilterResolver)) ids.add(id);
    } catch {
      // spec com targetFilter sem resolver — ignora, o trial-apply filtra
    }
  }
  return { ids: [...ids], someSpecNeeds: true };
}

function commandActionCandidates(state: GameState, seat: PlayerId, specs: EffectSpec[], opts: EnumerateOptions): LegalAction[] {
  const out: LegalAction[] = [];
  for (const card of state.players[seat].hand) {
    if (card.def.cardType !== "COMMAND") continue;
    if (!card.def.triggerKeywords?.includes("Action")) continue;
    if (state.players[seat].resourceArea.length < (card.def.level ?? 0)) continue;
    if (!canAfford(state, seat, card.def.cost ?? 0)) continue;
    const { ids, someSpecNeeds } = neededTargetIds(state, seat, card.def.code, "Action", specs, opts.targetFilterResolver);
    if (someSpecNeeds && ids.length > 0) {
      for (const id of ids) out.push({ kind: "playCommand", cardInstanceId: card.instanceId, trigger: "Action", targets: { target: [id] } });
    } else {
      out.push({ kind: "playCommand", cardInstanceId: card.instanceId, trigger: "Action" });
    }
  }
  return out;
}

function activateAbilityCandidates(
  state: GameState,
  seat: PlayerId,
  specs: EffectSpec[],
  trigger: "Activate·Main" | "Activate·Action",
  opts: EnumerateOptions,
): LegalAction[] {
  const out: LegalAction[] = [];
  for (const zone of ["battleArea", "baseSection"] as const) {
    for (const card of state.players[seat][zone]) {
      const abilitySpecs = findTriggerSpecs(specs, card.def.code, trigger);
      const hasSupport = trigger === "Activate·Main" && hasKeyword(card, "Support") && card.def.cardType === "UNIT" && !card.rested;
      if (abilitySpecs.length === 0 && !hasSupport) continue;
      if (abilitySpecs.length > 0) {
        const { ids, someSpecNeeds } = neededTargetIds(state, seat, card.def.code, trigger, specs, opts.targetFilterResolver);
        if (someSpecNeeds && ids.length > 0) {
          for (const id of ids) out.push({ kind: "activateAbility", sourceInstanceId: card.instanceId, targets: { target: [id] } });
        } else {
          out.push({ kind: "activateAbility", sourceInstanceId: card.instanceId });
        }
      } else {
        // <Support N> — alvo é outra Unit amiga
        for (const other of friendlyUnits(state, seat)) {
          if (other.instanceId === card.instanceId) continue;
          out.push({ kind: "activateAbility", sourceInstanceId: card.instanceId, targets: { target: [other.instanceId] } });
        }
      }
    }
  }
  return out;
}

function mainPhaseCandidates(state: GameState, seat: PlayerId, specs: EffectSpec[], opts: EnumerateOptions): LegalAction[] {
  const out: LegalAction[] = [{ kind: "finishTurn" }];

  // Deploy / jogar carta da mão
  for (const card of state.players[seat].hand) {
    const def = card.def;
    if (def.cardType === "RESOURCE") continue;
    const affordable = canPayLevel(state, seat, def) && canAfford(state, seat, def.cost ?? 0);
    if (!affordable) continue;

    if (def.cardType === "UNIT" || def.cardType === "BASE") {
      out.push({ kind: "deployCard", cardInstanceId: card.instanceId });
      continue;
    }
    const canBePilot = def.cardType === "PILOT" || (def.cardType === "COMMAND" && !!def.pilotMode);
    if (canBePilot) {
      for (const unit of friendlyUnits(state, seat)) {
        if (unit.pairedPilotId) continue;
        out.push({ kind: "deployCard", cardInstanceId: card.instanceId, pairWithUnitId: unit.instanceId });
      }
    }
    if (def.cardType === "COMMAND" && def.triggerKeywords?.includes("Main")) {
      const { ids, someSpecNeeds } = neededTargetIds(state, seat, def.code, "Main", specs, opts.targetFilterResolver);
      if (someSpecNeeds && ids.length > 0) {
        for (const id of ids) out.push({ kind: "playCommand", cardInstanceId: card.instanceId, trigger: "Main", targets: { target: [id] } });
      } else {
        out.push({ kind: "playCommand", cardInstanceId: card.instanceId, trigger: "Main" });
      }
    }
  }

  // Ataque
  for (const attacker of friendlyUnits(state, seat)) {
    if (attacker.rested) continue;
    const targets: AttackTarget[] = ["player", ...enemyUnits(state, seat).map((u): AttackTarget => ({ unitId: u.instanceId }))];
    for (const target of targets) out.push({ kind: "declareAttack", attackerId: attacker.instanceId, target });
  }

  // 【Activate·Main】 / <Support>
  out.push(...activateAbilityCandidates(state, seat, specs, "Activate·Main", opts));

  return out;
}

function pendingDecisionCandidates(state: GameState, seat: PlayerId, specs: EffectSpec[], opts: EnumerateOptions): LegalAction[] {
  const decision = state.pendingDecision[seat];
  if (!decision) return [];

  switch (decision.kind) {
    case "mulligan":
      return [
        { kind: "resolveMulligan", keep: true },
        { kind: "resolveMulligan", keep: false },
      ];

    case "zoneOverflow":
      return decision.legalTargets.map((id): LegalAction => ({ kind: "resolveZoneOverflow", instanceId: id }));

    case "triggerOrder":
      return [{ kind: "resolveTriggerOrder", orderedSpecIds: decision.triggers.map((t) => t.specId) }];

    case "burst": {
      const out: LegalAction[] = [{ kind: "resolveBurstDecision", activate: false }];
      const { ids, someSpecNeeds } = neededTargetIds(state, seat, decision.cardDef.code, "Burst", specs, opts.targetFilterResolver);
      if (someSpecNeeds && ids.length > 0) {
        for (const id of ids) out.push({ kind: "resolveBurstDecision", activate: true, targets: { target: [id] } });
      } else {
        out.push({ kind: "resolveBurstDecision", activate: true });
      }
      return out;
    }

    case "abilityResolution": {
      // Opções por entrada da fila; produto cartesiano limitado (a fila é
      // ~1 item em ST01-04 — nenhum card dispara 2 gatilhos simultâneos).
      const perEntry = decision.queue.map((q) => {
        const opts2: Array<{ specId: string; activate: boolean; targetIds: string[] }> = [];
        const idChoices: string[][] = [];
        if (q.deckTopReveal) {
          idChoices.push([]); // não revelar
          for (const id of q.deckTopReveal.revealableIds) idChoices.push([id]);
        } else if (q.handChoice) {
          idChoices.push([]);
          for (const id of q.handChoice.legalHandIds) idChoices.push([id]);
        } else if (q.needsTarget) {
          for (const id of q.legalTargets) idChoices.push([id]);
          if (q.legalTargets.length === 0 || q.optional) idChoices.push([]);
        } else {
          idChoices.push([]);
        }
        for (const targetIds of idChoices) {
          if (q.optional && targetIds.length === 0 && !q.deckTopReveal) {
            opts2.push({ specId: q.specId, activate: false, targetIds: [] });
          }
          opts2.push({ specId: q.specId, activate: true, targetIds });
        }
        return opts2.length > 0 ? opts2 : [{ specId: q.specId, activate: !q.optional, targetIds: [] }];
      });

      let combos: Array<Array<{ specId: string; activate: boolean; targetIds: string[] }>> = [[]];
      for (const entryOpts of perEntry) {
        const next: typeof combos = [];
        for (const combo of combos) {
          for (const opt of entryOpts) {
            next.push([...combo, opt]);
            if (next.length >= 48) break;
          }
          if (next.length >= 48) break;
        }
        combos = next;
      }
      return combos.map((resolutions): LegalAction => ({ kind: "resolveAbility", resolutions }));
    }
  }
}

function combatCandidates(state: GameState, seat: PlayerId, specs: EffectSpec[], opts: EnumerateOptions): LegalAction[] {
  const combat = state.combat;
  if (!combat) return [];

  if (combat.step === "block") {
    const out: LegalAction[] = [{ kind: "skipBlock" }];
    if (canActivateBlocker(state)) {
      for (const unit of friendlyUnits(state, seat)) {
        if (unit.rested) continue;
        if (!hasKeyword(unit, "Blocker")) continue;
        out.push({ kind: "activateBlocker", blockerId: unit.instanceId });
      }
    }
    return out;
  }

  if (combat.step === "action") {
    return [
      { kind: "passAction" },
      ...commandActionCandidates(state, seat, specs, opts),
      ...activateAbilityCandidates(state, seat, specs, "Activate·Action", opts),
    ];
  }

  return [];
}

function rawCandidates(state: GameState, seat: PlayerId, specs: EffectSpec[], opts: EnumerateOptions): LegalAction[] {
  if (state.pendingDecision[seat]) return pendingDecisionCandidates(state, seat, specs, opts);
  if (state.combat) return combatCandidates(state, seat, specs, opts);
  if (state.endPhaseAction) {
    return [
      { kind: "passEndPhaseAction" },
      ...commandActionCandidates(state, seat, specs, opts),
      ...activateAbilityCandidates(state, seat, specs, "Activate·Action", opts),
    ];
  }
  if (state.phase === "main") return mainPhaseCandidates(state, seat, specs, opts);
  return [];
}

export function enumerateLegalActions(
  state: GameState,
  seat: PlayerId,
  specs: EffectSpec[] = [],
  opts: EnumerateOptions = {},
): LegalAction[] {
  if (actionOwner(state) !== seat) return [];

  const candidates = rawCandidates(state, seat, specs, opts);
  if (opts.validate === false) return candidates;

  // `applyPlayerAction` nunca muta o `state` recebido — todo caminho passa por
  // `applyEvent`, que faz `cloneState` no topo (`players`, `combat.actionPasses`
  // e `endPhaseAction.passes` clonados a fundo — docs/46 §Achados 1, corrigido).
  // Então dá pra reusar o mesmo `state` como base de cada aplicação de teste.
  const legal: LegalAction[] = [];
  for (const action of candidates) {
    try {
      applyPlayerAction(state, seat, action, specs, opts.predicateResolver, opts.targetFilterResolver);
      legal.push(action);
    } catch (err) {
      if (isPlainLegalityError(err)) continue; // jogada ilegal — descarta em silêncio
      throw err; // bug de motor de verdade — propaga
    }
  }
  return legal;
}

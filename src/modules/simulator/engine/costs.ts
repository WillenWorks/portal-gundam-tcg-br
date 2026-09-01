import type { GameEvent, GameState, PlayerId } from "./types";
import { findCard } from "./events";
import { TOKEN_EX_RESOURCE_CODE } from "./setup";

/**
 * "Pagar N recursos active" — vocabulário compartilhado entre `deployCard`/
 * `playCommand` (custo de jogar carta, `deploy.ts`) e a primitiva de DSL
 * `payResourceCost` (custo de habilidade ativada, ex. ST02-006 Tallgeese
 * "④", ST01-015 White Base "②" — docs/18, lacuna #4). Extraído pra módulo
 * próprio (sem depender de `effectSpec.ts`/`dispatcher.ts`) só pra evitar um
 * import circular: `effectSpec.ts` (que usa isto) não pode importar de
 * `deploy.ts`, porque `deploy.ts` -> `dispatcher.ts` -> `effectSpec.ts` já
 * formaria um ciclo se `effectSpec.ts` importasse de volta de `deploy.ts`.
 *
 * Mesma regra oficial em ambos os usos: resta N Recursos active da Resource
 * Area (cor não importa, só quantidade); EX Resource sai do jogo de vez ao
 * pagar (nunca fica só rested, regra oficial já documentada em `deploy.ts`).
 */
export function payResourceCostEvents(
  state: GameState,
  player: PlayerId,
  n: number,
  resourceInstanceIds?: string[],
): GameEvent[] {
  if (n <= 0) return [];
  const resourceArea = state.players[player].resourceArea;
  const activeResources = resourceArea.filter((r) => !r.rested);
  const payWith = resourceInstanceIds ?? activeResources.slice(0, n).map((r) => r.instanceId);

  if (payWith.length < n) {
    throw new Error(`Recursos active insuficientes pra pagar custo ${n}: só ${activeResources.length} active`);
  }
  for (const id of payWith) {
    const resource = findCard(state, id);
    if (resource.owner !== player || resource.zone !== "resourceArea") {
      throw new Error(`Recurso ${id} inválido pra pagar custo (precisa ser Recurso do próprio jogador na Resource Area)`);
    }
    if (resource.rested) {
      throw new Error(`Recurso ${id} já está rested, não pode pagar custo de novo`);
    }
  }
  return payWith.map((id): GameEvent => {
    const resource = findCard(state, id);
    return resource.def.code === TOKEN_EX_RESOURCE_CODE
      ? { type: "REMOVE_CARD_FROM_GAME", instanceId: id }
      : { type: "REST_CARD", instanceId: id };
  });
}

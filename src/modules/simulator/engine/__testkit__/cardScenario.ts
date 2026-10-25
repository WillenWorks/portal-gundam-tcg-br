/* Peças dos testes gerados por categoria (camada 1 da fase de assertividade): tabuleiro com material para as
 * condições comuns, resolver decisões pela jogada legal e um "fingerprint" do que dá para ver de fora. */
import { applyPlayerAction } from "../actions";
import { enumerateLegalActions } from "../legalActions";
import { matchesCardDefFilter, type EffectSpec } from "../effectSpec";
import type { CardDef, GameState, PlayerId } from "../types";
import { otherPlayer } from "../types";
import { placeCard } from "./cardHarness";
import { ST01_CARD_DEFS } from "../../fixtures/st01Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../../content";
import { ALL_CARD_DEFS } from "../../content/allCardDefs";

export const scenarioOpts = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

/** 1 carta que casa o filtro de cada "Choose 1 … card from your trash" dos specs */
export function trashMaterialFor(specs: readonly EffectSpec[]): CardDef[] {
  return specs.flatMap((s) =>
    [...(s.actions ?? []), ...(s.condition?.then ?? [])].flatMap((a) => {
      if (a.op !== "searchTrashToHand") return [];
      const def = Object.values(ALL_CARD_DEFS).find((d) => !d.isToken && matchesCardDefFilter(d, a.filter));
      return def ? [def] : [];
    }),
  );
}

// sem efeito próprio, para não somar habilidades ao tabuleiro
const CB_UNIT = Object.values(ALL_CARD_DEFS).find((d) => d.cardType === "UNIT" && !d.isToken && d.traits?.includes("CB") && !ALL_EFFECT_SPECS.some((sp) => sp.cardCode === d.code));

/**
 * Material para as condições comuns de efeito de quem usa (`user`): Units ativas e descansadas dos dois lados
 * (HP baixo, uma com <Blocker>), inimigo com 3 shields e uma Unit (CB), lixeira de `user` com o que as buscas pedem.
 */
export function richBoard(state: GameState, user: PlayerId, trashMaterial: readonly CardDef[]): void {
  const enemy = otherPlayer(user);
  placeCard(state, user, ST01_CARD_DEFS.GM, "battleArea");
  placeCard(state, user, ST01_CARD_DEFS.ZOWORT, "battleArea", { rested: true });
  placeCard(state, enemy, ST01_CARD_DEFS.GM, "battleArea");
  placeCard(state, enemy, ST01_CARD_DEFS.GM, "battleArea", { rested: true });
  if (CB_UNIT) placeCard(state, enemy, CB_UNIT, "battleArea");
  for (const material of trashMaterial) placeCard(state, user, material, "trash");
  const shields = state.players[enemy].shields;
  state.players[enemy].deck.push(...shields.splice(3).map((c) => ({ ...c, zone: "deck" as const })));
}

/** resolve as decisões pendentes pela 1ª jogada legal que ativa, preferindo escolher algo quando dá */
export function settleDecisions(state: GameState, specs: EffectSpec[]): GameState {
  let next = state;
  for (let guard = 0; guard < 12; guard++) {
    const seat = (["A", "B"] as PlayerId[]).find((p) => next.pendingDecision[p]);
    if (!seat) break;
    const legal = enumerateLegalActions(next, seat, specs, scenarioOpts);
    const activating = legal.filter((a) => a.kind === "resolveAbility" && a.resolutions.every((r) => r.activate));
    const pick = activating.find((a) => a.kind === "resolveAbility" && a.resolutions.some((r) => r.targetIds.length > 0)) ?? activating[0] ?? legal[0];
    if (!pick) break;
    next = applyPlayerAction(next, seat, pick, specs, defaultPredicateResolver, defaultTargetFilterResolver);
  }
  return next;
}

/** tudo o que o efeito pode ter mudado: zonas (com ordem), marcas nas cartas e nos jogadores, combate — sem o log */
export function fingerprint(state: GameState): string {
  return JSON.stringify({ players: state.players, combat: state.combat });
}

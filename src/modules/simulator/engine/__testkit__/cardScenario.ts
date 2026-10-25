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

/**
 * O par da carta, montado a partir do que o próprio spec pede: Piloto com o trait/cor/nível do qualificador
 * (【When Paired･(Newtype) Pilot】, "Purple Pilot", "Lv.4 or Higher Pilot") e Unit com o trait/cor que a habilidade do
 * Piloto exige ("If this is a (CB) Unit", "friendly (Marine) Unit"). Sem habilidade própria.
 */
export function partnerFor(specs: readonly EffectSpec[], card?: CardDef): { pilot: CardDef; unit: CardDef } {
  const pilotTraits = new Set<string>();
  const unitTraits = new Set<string>();
  let pilotColor: CardDef["color"] = "colorless";
  let unitColor: CardDef["color"] = ST01_CARD_DEFS.GM.color;
  let pilotLevel = 1;
  for (const spec of specs) {
    const parts = [...(spec.condition?.predicate.split(";") ?? []), ...(spec.targetFilter?.split(";") ?? [])];
    for (const part of parts) {
      const [key, value = ""] = part.split(":");
      if (key === "pairedPilotHasTrait" || key === "pairedPilotHasAnyTrait") value.split(",").forEach((t) => pilotTraits.add(t));
      if (key === "selfHasTrait" || key === "controllerUnitWithTraitInPlay" || key === "trait") unitTraits.add(value);
      if (key === "pairedPilotColorIs") pilotColor = value as CardDef["color"];
      if (key === "selfColorIs") unitColor = value as CardDef["color"];
      if (key === "pairedPilotLevelAtLeast") pilotLevel = Number(value);
    }
  }
  // 【During Link】: o Piloto de teste cumpre o Link da Unit da carta; a Unit de teste tem Link com o Piloto da carta
  let pilotName = "Test Pilot";
  const link = card?.cardType === "UNIT" ? card.link : undefined;
  if (link?.kind === "pilotName") pilotName = link.values[0];
  else if (link) pilotTraits.add(link.values[0]);
  const unitLink: CardDef["link"] = card && card.cardType !== "UNIT" ? { kind: "pilotName", values: [card.nameEn] } : undefined;
  return {
    pilot: { code: "CA-PILOT", nameEn: pilotName, cardType: "PILOT", color: pilotColor, level: pilotLevel, cost: 1, ap: 1, hp: 1, traits: [...pilotTraits] },
    unit: { ...ST01_CARD_DEFS.GM, code: "CA-UNIT", nameEn: "Test Unit", color: unitColor, traits: [...unitTraits], ...(unitLink ? { link: unitLink } : {}) },
  };
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

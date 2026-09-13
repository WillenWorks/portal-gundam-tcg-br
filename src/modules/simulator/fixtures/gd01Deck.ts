import type { CardDef } from "../engine/types";
import type { DeckList } from "../engine/setup";
import { GD01_CARD_DEFS } from "../content/gd01";

/**
 * Deck de teste GD01 "Newtype Rising" (Fase 3B — validação/golden master),
 * mono-color (white / Triple Ship Alliance-Academy-Earth Alliance), montado
 * SÓ com cartas `implementada`/`implementada*`/`vanilla` (docs/44 §6.3) —
 * nenhuma carta `deferida` entra aqui, mesmo critério de `VALIDATED_DECKS`
 * (`content/validatedDecks.ts`). Não é um deck competitivo, é o fixture
 * mínimo legal (`checkDeckListLegality`) pra rodar golden master e fuzzing
 * contra GD01 sem esbarrar em texto ainda não coberto pelo motor.
 */
function copies(def: CardDef, n: number): CardDef[] {
  return Array.from({ length: n }, () => def);
}

const RESOURCE: CardDef = {
  code: "GD01-RESOURCE",
  nameEn: "Resource",
  cardType: "RESOURCE",
  color: "colorless",
};

/** 50 cartas — só brancas, só `implementada`/`implementada*`/`vanilla`. */
export function buildGd01MainDeck(): CardDef[] {
  return [
    // Bases (4)
    ...copies(GD01_CARD_DEFS["GD01-129"], 2), // Kusanagi
    ...copies(GD01_CARD_DEFS["GD01-130"], 2), // 13th Tactical Testing Sector
    // Pilots (6)
    ...copies(GD01_CARD_DEFS["GD01-097"], 3), // Guel Jeturk
    ...copies(GD01_CARD_DEFS["GD01-098"], 3), // Elan Ceres
    // Commands (10)
    ...copies(GD01_CARD_DEFS["GD01-117"], 2), // The Witch and the Bride
    ...copies(GD01_CARD_DEFS["GD01-118"], 2), // Overflowing Affection
    ...copies(GD01_CARD_DEFS["GD01-119"], 2), // Iron-Fisted Discipline
    ...copies(GD01_CARD_DEFS["GD01-120"], 2), // Naval Bombardment
    ...copies(GD01_CARD_DEFS["GD01-121"], 2), // Midair Modifications
    // Units (30)
    ...copies(GD01_CARD_DEFS["GD01-078"], 4), // Mistral
    ...copies(GD01_CARD_DEFS["GD01-085"], 4), // Demi Garrison
    ...copies(GD01_CARD_DEFS["GD01-069"], 3), // Strike Rouge
    ...copies(GD01_CARD_DEFS["GD01-074"], 3), // Chuchu's Demi Trainer
    ...copies(GD01_CARD_DEFS["GD01-075"], 3), // Darilbalde
    ...copies(GD01_CARD_DEFS["GD01-080"], 3), // Cagalli's Skygrasper
    ...copies(GD01_CARD_DEFS["GD01-079"], 2), // Skygrasper
    ...copies(GD01_CARD_DEFS["GD01-086"], 2), // Gundam Lfrith
    ...copies(GD01_CARD_DEFS["GD01-068"], 2), // Perfect Strike Gundam
    ...copies(GD01_CARD_DEFS["GD01-071"], 2), // Gundam Pharact
    ...copies(GD01_CARD_DEFS["GD01-073"], 1), // Sword Strike Gundam
    ...copies(GD01_CARD_DEFS["GD01-082"], 1), // Gundam Aerial (Mirasoul Flight Unit)
  ];
}

export function buildGd01ResourceDeck(): CardDef[] {
  return copies(RESOURCE, 10);
}

export function buildGd01DeckList(): DeckList {
  return { main: buildGd01MainDeck(), resources: buildGd01ResourceDeck() };
}

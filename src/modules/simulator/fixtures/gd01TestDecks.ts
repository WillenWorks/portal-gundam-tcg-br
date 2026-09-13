import type { CardDef } from "../engine/types";
import type { DeckList } from "../engine/setup";
import { GD01_CARD_DEFS } from "../content/gd01";

/**
 * 4 decks de teste da wave GD01 (Fase 1 do rollout, docs/debates 2026-09-13
 * "Levantamento completo + roadmap") — cada um montado SÓ com cartas
 * `implementada`/`implementada*`/`vanilla` (o mesmo critério já usado por
 * `gd01Deck.ts` pro golden master/fuzzing): nenhuma carta com cláusula em
 * `content/deferred.ts` (status `deferida`) entra aqui. É o subconjunto de 90
 * cartas (62 prontas + 28 vanilla) que `scripts/gundam-coverage.mjs --sets=GD01`
 * classifica como seguro — conferido carta a carta antes de escrever este
 * arquivo (nenhum dos códigos abaixo aparece em `DEFERRED_CLAUSES`).
 *
 * Diferente de `gd01Deck.ts` (mono-white, feito só pra fuzzing headless),
 * estes 4 cobrem os 4 pares de cor adjacentes do ciclo White→Blue→Green→Red→
 * White, pensados pra jogo real (Sandbox/Treino Solo) — não são otimizados
 * competitivamente, são o piso jogável mínimo por par de cor dentro do
 * subconjunto seguro.
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

function buildResourceDeck(): CardDef[] {
  return copies(RESOURCE, 10);
}

/** GD01-FED — Branco/Azul, "Federation Vanguard". 3 Pilots (Banagher Links, Guel Jeturk). */
export function buildGd01FederationMainDeck(): CardDef[] {
  return [
    // Units brancas (23)
    ...copies(GD01_CARD_DEFS["GD01-078"], 4), // Mistral
    ...copies(GD01_CARD_DEFS["GD01-085"], 4), // Demi Garrison
    ...copies(GD01_CARD_DEFS["GD01-086"], 4), // Gundam Lfrith
    ...copies(GD01_CARD_DEFS["GD01-069"], 3), // Strike Rouge
    ...copies(GD01_CARD_DEFS["GD01-080"], 3), // Cagalli's Skygrasper
    ...copies(GD01_CARD_DEFS["GD01-074"], 3), // Chuchu's Demi Trainer
    ...copies(GD01_CARD_DEFS["GD01-068"], 2), // Perfect Strike Gundam
    // Units azuis (13)
    ...copies(GD01_CARD_DEFS["GD01-008"], 4), // Guntank
    ...copies(GD01_CARD_DEFS["GD01-015"], 3), // Ball
    ...copies(GD01_CARD_DEFS["GD01-004"], 3), // Guncannon
    ...copies(GD01_CARD_DEFS["GD01-001"], 2), // Gundam (implementada*)
    // Finalizador (1)
    ...copies(GD01_CARD_DEFS["GD01-066"], 1), // Justice Gundam (implementada*)
    // Pilots (4)
    ...copies(GD01_CARD_DEFS["GD01-088"], 2), // Banagher Links
    ...copies(GD01_CARD_DEFS["GD01-097"], 2), // Guel Jeturk
    // Commands (7)
    ...copies(GD01_CARD_DEFS["GD01-118"], 3), // Overflowing Affection
    ...copies(GD01_CARD_DEFS["GD01-119"], 2), // Iron-Fisted Discipline
    ...copies(GD01_CARD_DEFS["GD01-101"], 2), // Deep Devotion
    // Bases (3)
    ...copies(GD01_CARD_DEFS["GD01-129"], 2), // Kusanagi
    ...copies(GD01_CARD_DEFS["GD01-123"], 1), // Nahel Argama
  ];
}

export function buildGd01FederationDeckList(): DeckList {
  return { main: buildGd01FederationMainDeck(), resources: buildResourceDeck() };
}

/** GD01-ZEON — Verde/Vermelho, "Zeon Legion". Sem Pilot seguro nesse par de cor (todos os Pilots Zeon estão deferidos). */
export function buildGd01ZeonMainDeck(): CardDef[] {
  return [
    // Units verdes (22)
    ...copies(GD01_CARD_DEFS["GD01-035"], 4), // Zaku Ⅱ
    ...copies(GD01_CARD_DEFS["GD01-036"], 4), // Gouf
    ...copies(GD01_CARD_DEFS["GD01-030"], 4), // Rick Dom
    ...copies(GD01_CARD_DEFS["GD01-026"], 3), // Char's Zaku Ⅱ
    ...copies(GD01_CARD_DEFS["GD01-032"], 3), // Gyan
    ...copies(GD01_CARD_DEFS["GD01-028"], 2), // Gundam Sandrock
    ...copies(GD01_CARD_DEFS["GD01-029"], 2), // Shenlong Gundam
    // Units vermelhas (14)
    ...copies(GD01_CARD_DEFS["GD01-061"], 4), // ZuOOT
    ...copies(GD01_CARD_DEFS["GD01-064"], 4), // DINN
    ...copies(GD01_CARD_DEFS["GD01-050"], 3), // LaGOWE
    ...copies(GD01_CARD_DEFS["GD01-056"], 2), // Geara Doga (Sleeves)
    // Finalizador vermelho (1)
    ...copies(GD01_CARD_DEFS["GD01-047"], 1), // Shamblo
    // Commands (10)
    ...copies(GD01_CARD_DEFS["GD01-105"], 3), // Citizens, Take a Stand!
    ...copies(GD01_CARD_DEFS["GD01-106"], 2), // Fortress Defense
    ...copies(GD01_CARD_DEFS["GD01-111"], 3), // Battle of Aces
    ...copies(GD01_CARD_DEFS["GD01-116"], 2), // Stealth Stratagem
    // Bases (4)
    ...copies(GD01_CARD_DEFS["GD01-126"], 2), // Underground Desert Base
    ...copies(GD01_CARD_DEFS["GD01-127"], 2), // Gamow
  ];
}

export function buildGd01ZeonDeckList(): DeckList {
  return { main: buildGd01ZeonMainDeck(), resources: buildResourceDeck() };
}

/** GD01-NEWTYPE — Azul/Verde, "Newtype Corps". */
export function buildGd01NewtypeMainDeck(): CardDef[] {
  return [
    // Units azuis (19)
    ...copies(GD01_CARD_DEFS["GD01-009"], 4), // G-Fighter
    ...copies(GD01_CARD_DEFS["GD01-012"], 4), // Zechs' Leo
    ...copies(GD01_CARD_DEFS["GD01-007"], 3), // Noin's Aries
    ...copies(GD01_CARD_DEFS["GD01-020"], 3), // Anksha
    ...copies(GD01_CARD_DEFS["GD01-006"], 3), // Delta Plus
    ...copies(GD01_CARD_DEFS["GD01-010"], 2), // Unicorn Gundam 02 Banshee (Unicorn Mode)
    // Units verdes (15)
    ...copies(GD01_CARD_DEFS["GD01-042"], 4), // Duo's Leo
    ...copies(GD01_CARD_DEFS["GD01-037"], 4), // Gogg
    ...copies(GD01_CARD_DEFS["GD01-031"], 3), // Gelgoog
    ...copies(GD01_CARD_DEFS["GD01-038"], 2), // Adzam
    ...copies(GD01_CARD_DEFS["GD01-025"], 2), // Gundam Deathscythe
    // Pilot (3)
    ...copies(GD01_CARD_DEFS["GD01-088"], 3), // Banagher Links
    // Commands (8)
    ...copies(GD01_CARD_DEFS["GD01-099"], 3), // Intercept Orders
    ...copies(GD01_CARD_DEFS["GD01-102"], 2), // Securing the Supply Line
    ...copies(GD01_CARD_DEFS["GD01-107"], 3), // First Contact
    // Bases (5)
    ...copies(GD01_CARD_DEFS["GD01-124"], 2), // Side 7
    ...copies(GD01_CARD_DEFS["GD01-125"], 3), // Zanzibar
  ];
}

export function buildGd01NewtypeDeckList(): DeckList {
  return { main: buildGd01NewtypeMainDeck(), resources: buildResourceDeck() };
}

/** GD01-SLEEVES — Vermelho/Branco, "Sleeves Uprising". */
export function buildGd01SleevesMainDeck(): CardDef[] {
  return [
    // Units vermelhas (18)
    ...copies(GD01_CARD_DEFS["GD01-057"], 4), // Dreissen (Sleeves)
    ...copies(GD01_CARD_DEFS["GD01-060"], 4), // Zaku Mariner
    ...copies(GD01_CARD_DEFS["GD01-062"], 4), // GOOhN
    ...copies(GD01_CARD_DEFS["GD01-052"], 3), // Geara Zulu (Guards Type)
    ...copies(GD01_CARD_DEFS["GD01-053"], 3), // Geara Doga (Heavy Armed Type)
    ...copies(GD01_CARD_DEFS["GD01-059"], 3), // Zee Zulu
    // Units brancas (12)
    ...copies(GD01_CARD_DEFS["GD01-072"], 3), // Launcher Strike Gundam
    ...copies(GD01_CARD_DEFS["GD01-075"], 3), // Darilbalde
    ...copies(GD01_CARD_DEFS["GD01-071"], 3), // Gundam Pharact
    ...copies(GD01_CARD_DEFS["GD01-073"], 3), // Sword Strike Gundam
    // Pilot (2)
    ...copies(GD01_CARD_DEFS["GD01-098"], 2), // Elan Ceres
    // Commands (11)
    ...copies(GD01_CARD_DEFS["GD01-113"], 3), // The Desert Tiger
    ...copies(GD01_CARD_DEFS["GD01-115"], 2), // Zeon Remnant Forces
    ...copies(GD01_CARD_DEFS["GD01-120"], 3), // Naval Bombardment
    ...copies(GD01_CARD_DEFS["GD01-121"], 3), // Midair Modifications
    // Bases (4)
    ...copies(GD01_CARD_DEFS["GD01-128"], 2), // Mining Asteroid Palau
    ...copies(GD01_CARD_DEFS["GD01-130"], 2), // 13th Tactical Testing Sector
  ];
}

export function buildGd01SleevesDeckList(): DeckList {
  return { main: buildGd01SleevesMainDeck(), resources: buildResourceDeck() };
}

export interface Gd01TestDeck {
  id: string;
  label: string;
  build: () => DeckList;
}

/** Registro central dos 4 decks — consumido por `SimulatorSandboxPage.tsx` (Select de decks) e pelo servidor. */
export const GD01_TEST_DECKS: Record<string, Gd01TestDeck> = {
  "GD01-FED": { id: "GD01-FED", label: "Federation Vanguard (GD01)", build: buildGd01FederationDeckList },
  "GD01-ZEON": { id: "GD01-ZEON", label: "Zeon Legion (GD01)", build: buildGd01ZeonDeckList },
  "GD01-NEWTYPE": { id: "GD01-NEWTYPE", label: "Newtype Corps (GD01)", build: buildGd01NewtypeDeckList },
  "GD01-SLEEVES": { id: "GD01-SLEEVES", label: "Sleeves Uprising (GD01)", build: buildGd01SleevesDeckList },
};

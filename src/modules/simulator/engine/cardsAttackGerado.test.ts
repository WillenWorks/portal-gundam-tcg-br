/* Camada 1 da fase de assertividade, categoria 【Attack】: para CADA carta com o gatilho, gerado a partir de
 * ALL_EFFECT_SPECS e jogado pelo caminho do jogador — a Unit da carta (ou a Unit pareada com o Piloto da carta)
 * declara ataque pela jogada legal, as decisões vão pela jogada legal. Controle: o mesmo ataque sem o 【Attack】
 * da carta. Quando o gatilho pede Piloto (During Pair/Link, "(X) Pilot"), o par sai de `partnerFor`. */
import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { enumerateLegalActions } from "./legalActions";
import { placeCard } from "./__testkit__/cardHarness";
import { fingerprint, partnerFor, richBoard, scenarioOpts, settleDecisions, trashMaterialFor } from "./__testkit__/cardScenario";
import type { EffectSpec } from "./effectSpec";
import type { CardDef, GameState } from "./types";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { ALL_CARD_DEFS } from "../content/allCardDefs";

const ATTACK_SPECS = ALL_EFFECT_SPECS.filter((s) => s.trigger === "Attack");
const ATTACK_CARDS = [...new Set(ATTACK_SPECS.map((s) => s.cardCode))].sort().filter((code) => ALL_CARD_DEFS[code]);
const TRASH_MATERIAL = trashMaterialFor(ATTACK_SPECS);
const RESOURCE: CardDef = { code: "CA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };

const needsPilot = (specs: EffectSpec[]) =>
  specs.some((s) => s.duringPair || s.duringLink || /pairedPilot|Link/.test(s.condition?.predicate ?? ""));

function apply(state: GameState, action: PlayerAction, specs: EffectSpec[]): GameState {
  return settleDecisions(applyPlayerAction(state, "A", action, specs, defaultPredicateResolver, defaultTargetFilterResolver), specs);
}

/** a Unit atacante pronta (com o par, quando a carta é Piloto ou o gatilho pede Piloto), já pelos specs dados */
function readyToAttack(code: string, specs: EffectSpec[]): { state: GameState; attackerId: string; enemyUnitId?: string } | null {
  const def = ALL_CARD_DEFS[code];
  const own = ATTACK_SPECS.filter((s) => s.cardCode === code);
  const partner = partnerFor(own, def);
  let state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
  for (let i = 0; i < 10; i++) placeCard(state, "A", RESOURCE, "resourceArea");
  richBoard(state, "A", TRASH_MATERIAL);
  // "damaged" dos dois lados: alvo de "recovers HP" e de "attacking a damaged enemy Unit"
  placeCard(state, "A", ST01_CARD_DEFS.GM, "battleArea", { damage: 1 });
  const damagedEnemyId = placeCard(state, "B", ST01_CARD_DEFS.GM, "battleArea", { rested: true, damage: 1 });
  const isUnit = def.cardType === "UNIT";
  const attackerId = placeCard(state, "A", isUnit ? def : partner.unit, "battleArea");
  if (!isUnit || needsPilot(own)) {
    const pilotId = placeCard(state, "A", isUnit ? partner.pilot : def, "hand");
    const pair = enumerateLegalActions(state, "A", specs, scenarioOpts).find(
      (a) => a.kind === "deployCard" && a.cardInstanceId === pilotId && "pairWithUnitId" in a && a.pairWithUnitId === attackerId,
    );
    if (!pair) return null;
    state = apply(state, pair, specs);
  }
  return { state, attackerId, enemyUnitId: wantsEnemyUnit(own) ? damagedEnemyId : undefined };
}

/** "If you are attacking an enemy Unit / a damaged enemy Unit" — o ataque vai na Unit inimiga danificada */
const wantsEnemyUnit = (specs: EffectSpec[]) => specs.some((s) => /attacking(Damaged)?EnemyUnit/.test(s.condition?.predicate ?? ""));

function attackAction(state: GameState, attackerId: string, specs: EffectSpec[], enemyUnitId?: string): PlayerAction | undefined {
  const attacks = enumerateLegalActions(state, "A", specs, scenarioOpts).filter((a) => a.kind === "declareAttack" && a.attackerId === attackerId);
  const wanted = enemyUnitId
    ? attacks.find((a) => a.kind === "declareAttack" && typeof a.target === "object" && a.target.unitId === enemyUnitId)
    : attacks.find((a) => a.kind === "declareAttack" && a.target === "player");
  return wanted ?? attacks[0];
}

/* 【Attack】 sem rastro neste tabuleiro, por motivo. A lista é cobrada. */
const SEM_RASTRO_NO_TABULEIRO: string[] = [
  // "If this Unit has 5 or more AP / is damaged" — a Unit da carta não está assim
  "GD01-050", "GD02-045", "GD02-054", "GD02-095", "ST04-006",
  // "If an enemy has 6+ cards in hand / 2+ other rested friendly / 2-3+ (X) Units / another (X) Unit / Special Move ativado"
  "EB01-013", "GD01-047", "GD03-004", "GD04-003", "GD05-071", "GD05-089",
  // "Choose … (enemy <Blocker>, Pilot inimigo, token, Linked (X), Resource descansado)" sem alvo que case
  "EB01-024", "GD01-029", "GD03-018", "GD04-099", "GD01-066", "GD05-039", "GD05-066",
  // "Choose N (X) cards from your trash" / "deploy … from your trash" — lixeira sem as cartas
  "GD03-059", "GD04-049", "GD05-033",
  // "Activate 【Main】 on the card paired with this Unit" — o Piloto de teste não tem 【Main】
  "GD05-035", "GD05-044", "GD05-069", "GD05-076",
  // escolha que não muda nada: "recovers 1 HP" na 1ª Unit (sem dano); "look at the top" devolvido ao topo
  "EB01-018", "GD01-015", "ST06-010",
  // "Choose 1 enemy player. That player …" — sem a condição do 2º passo
  "ST13-009",
];

describe(`【Attack】 gerado — ${ATTACK_CARDS.length} cartas, caminho do jogador`, () => {
  it("a Unit da carta (ou com o Piloto da carta) pode atacar", () => {
    const naoOferecidas = ATTACK_CARDS.filter((code) => {
      const ready = readyToAttack(code, ALL_EFFECT_SPECS);
      return !ready || !attackAction(ready.state, ready.attackerId, ALL_EFFECT_SPECS);
    });
    expect(naoOferecidas).toEqual([]);
  }, 120_000);

  it("a favor: o 【Attack】 muda o tabuleiro em relação ao mesmo ataque sem ele", () => {
    const falhas: string[] = [];
    const semRastro: string[] = [];
    for (const code of ATTACK_CARDS) {
      const without = ALL_EFFECT_SPECS.filter((s) => !(s.cardCode === code && s.trigger === "Attack"));
      // um tabuleiro só (os ids do testkit são globais): o pareamento é igual nos dois, só o ataque ramifica
      const real = readyToAttack(code, ALL_EFFECT_SPECS);
      if (!real) continue;
      const control = real;
      const action = attackAction(real.state, real.attackerId, ALL_EFFECT_SPECS, real.enemyUnitId);
      const controlAction = attackAction(control.state, control.attackerId, without, real.enemyUnitId);
      if (!action || !controlAction) continue;
      try {
        const after = apply(real.state, action, ALL_EFFECT_SPECS);
        const afterControl = apply(control.state, controlAction, without);
        if (after.pendingDecision.A || after.pendingDecision.B) falhas.push(`${code}: decisão ficou pendente`);
        else if (fingerprint(after) === fingerprint(afterControl)) semRastro.push(code);
      } catch (err) {
        falhas.push(`${code}: exceção ${(err as Error).message}`);
      }
    }
    expect(falhas).toEqual([]);
    expect([...semRastro].sort()).toEqual([...SEM_RASTRO_NO_TABULEIRO].sort());
  }, 180_000);
});

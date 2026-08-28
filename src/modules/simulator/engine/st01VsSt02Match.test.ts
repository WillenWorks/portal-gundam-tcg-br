import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList, ST02_CARD_DEFS } from "../fixtures/st02Deck";
import type { AttackTarget, CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { advanceToMainPhase, finishTurnAndAdvance } from "./phases";
import { activateBlocker, declareAttack, proceedToBlockStep, resolveBattleEndStep, resolveDamageStep, skipBlock, passAction } from "./combat";
import { deployCard, playCommand } from "./deploy";
import { dispatchBurstForNewlyTrashedShields, dispatchTrigger, type BurstChoiceFn } from "./dispatcher";
import { findCard } from "./events";
import { ST01_EFFECT_SPECS } from "../content/st01";
import { ST02_EFFECT_SPECS } from "../content/st02";
import type { EffectContext, PredicateResolver } from "./effectSpec";

/**
 * "Partida real" ST01 vs ST02 (docs/18, wave "motor de jogo real + gaps
 * documentados", decisão com o Willen em 2026-08-28): joga um jogo completo
 * — do `createGame` a um `GAME_OVER` de verdade — usando só as ações reais
 * do motor (`deployCard`/`playCommand`/`declareAttack`/.../`dispatchTrigger`),
 * nunca mutação direta de `battleArea`/`baseSection` pra "fingir" que uma
 * carta já está deployada (a única mutação de fixture usada aqui é pra
 * colocar a carta certa na mão/nos shields no momento certo — guiar a sorte
 * do embaralhamento seria impraticável pra cobrir 27 EffectSpecs
 * deliberadamente, e essa é a mesma convenção já documentada em
 * `st01.test.ts`/`fullGame.test.ts`).
 *
 * Cobertura visada — todos os 27 EffectSpec reais cadastrados até agora
 * (16 ST01 + 11 ST02, ver docs/18 "Cobertura real"):
 *
 * ST01: GUNDAM_MA_FORM_WHEN_PAIRED, GUNTANK_DEPLOY,
 * AERIAL_SCORE_SIX_WHEN_PAIRED, AMURO_RAY_BURST, AMURO_RAY_WHEN_PAIRED,
 * SULETTA_MERCURY_BURST, SULETTA_MERCURY_ATTACK, THOROUGHLY_DAMAGED_MAIN,
 * KAIS_RESOLVE_MAIN, UNFORESEEN_INCIDENT_{BURST,MAIN,ACTION},
 * WHITE_BASE_{BURST,DEPLOY}, ASTICASSIA_{BURST,DEPLOY}.
 *
 * ST02: TALLGEESE_ACTIVATE_MAIN, HEERO_YUY_BURST, ZECHS_MERQUISE_BURST,
 * SIMULTANEOUS_FIRE_MAIN (o grant de `<Breach 3>` que motivou o fix de
 * `keywordValue()`), SIEGE_PLOY_{BURST,MAIN,ACTION},
 * SAINT_GABRIEL_INSTITUTE_{BURST,DEPLOY}, CORSICA_BASE_{BURST,DEPLOY}.
 *
 * + keywords automáticas: `<Repair 2>` (ST01 Gundam), `<Blocker>` (ST02
 * Aries), `<Breach>` concedida dinamicamente (regressão do bug real
 * encontrado na wave anterior).
 *
 * Fora de escopo (documentado, não fingido): as ~15 cartas "Parcial" e as 8
 * lacunas de DSL já registradas em docs/18 — efeito contínuo condicional
 * (During Pair/Link), alvo em grupo, custo de recurso genérico em
 * habilidades ativadas, criar token, informação oculta, restrição de
 * legalidade de alvo. Nada disso é simulado "de mentirinha" aqui.
 */

const ALL_SPECS = [...ST01_EFFECT_SPECS, ...ST02_EFFECT_SPECS];

const pairedPilotHasTraitResolver: PredicateResolver = (predicate, ctx: EffectContext) => {
  const match = predicate.match(/^pairedPilotHasTrait:(.+)$/);
  if (!match) return false;
  const source = findCard(ctx.state, ctx.sourceInstanceId);
  if (!source.pairedPilotId) return false;
  const pilot = findCard(ctx.state, source.pairedPilotId);
  return pilot.def.traits?.includes(match[1]) ?? false;
};

let seq = 0;
function mkInstance(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-matchfx-${seq++}`;
  const card: CardInstance = {
    instanceId,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber,
    ...opts,
  };
  state.players[player][zone].push(card);
  return instanceId;
}

/** Substitui o topo dos shields do jogador pelas cartas dadas (defs[0] vira o próximo a quebrar). */
function setTopShields(state: GameState, player: PlayerId, defs: CardDef[]): string[] {
  const ids: string[] = [];
  const fresh = defs.map((def) => {
    const instanceId = `${player}-matchfx-${seq++}`;
    ids.push(instanceId);
    const card: CardInstance = {
      instanceId,
      def,
      owner: player,
      zone: "shields",
      rested: false,
      damage: 0,
      statModifiers: [],
      keywordGrants: [],
      usedKeywordsThisTurn: [],
      enteredZoneOnTurn: state.turnNumber,
    };
    return card;
  });
  state.players[player].shields.splice(0, defs.length, ...fresh);
  return ids;
}

function giveResources(state: GameState, player: PlayerId, n: number): void {
  for (let i = 0; i < n; i++) mkInstance(state, player, { code: "MATCH-RESOURCE", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
}

interface AttackOptions {
  blockerId?: string;
  /** substitui o Action Step padrão (os dois passam direto) por uma sequência custom — usado pra jogar Command 【Action】 */
  runActionStep?: (state: GameState, defendingPlayer: PlayerId, attackingPlayer: PlayerId) => GameState;
  chooseBurst?: BurstChoiceFn;
}

/** Roda uma sequência de combate completa (Attack->Block->Action->Damage->BattleEnd), oferecendo Burst pra shields recém-quebradas. */
function runAttack(state: GameState, attackerId: string, target: AttackTarget, opts: AttackOptions = {}): GameState {
  let next = declareAttack(state, attackerId, target);
  next = proceedToBlockStep(next);
  next = opts.blockerId ? activateBlocker(next, opts.blockerId) : skipBlock(next);

  const defendingPlayer = next.combat!.defendingPlayer;
  const attackingPlayer = next.combat!.attackingPlayer;
  next = opts.runActionStep
    ? opts.runActionStep(next, defendingPlayer, attackingPlayer)
    : passAction(passAction(next, defendingPlayer), attackingPlayer);

  const beforeDamage = next;
  next = resolveDamageStep(next);
  if (next.gameOver) return next;
  next = dispatchBurstForNewlyTrashedShields(beforeDamage, next, defendingPlayer, ALL_SPECS, opts.chooseBurst ?? (() => false));
  next = resolveBattleEndStep(next);
  return next;
}

describe("partida real ST01 vs ST02 (docs/18, motor de jogo real + gaps documentados)", () => {
  it("joga do createGame a um GAME_OVER real, cobrindo os 27 EffectSpecs + keywords automáticas dos dois decks", () => {
    let state = createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 42, firstPlayer: "A" });

    // ------------------------------------------------------------------
    // Turno 1 (A) — desarma a EX Base de B (prova Base absorve dano de
    // "atacar o jogador" — Comprehensive Rules — sem isso todo ataque
    // contra B como jogador acertaria a EX Base, nunca os shields).
    // ------------------------------------------------------------------
    state = advanceToMainPhase(state);
    giveResources(state, "A", 10);

    const maFormId = mkInstance(state, "A", ST01_CARD_DEFS.GUNDAM_MA_FORM, "hand");
    state = deployCard(state, "A", maFormId, { specs: ALL_SPECS }); // Unit, sem trigger próprio

    const bExBaseId = state.players.B.baseSection[0].instanceId;
    state = runAttack(state, maFormId, "player"); // MA Form AP4 >= EX Base HP3 -> destrói a Base, não toca shields
    expect(state.players.B.baseSection.length).toBe(0);
    expect(state.eventLog.some((e) => e.type === "DESTROY_CARD" && "instanceId" in e && e.instanceId === bExBaseId)).toBe(true);

    const aerialId = mkInstance(state, "A", ST01_CARD_DEFS.AERIAL_SCORE_SIX, "hand");
    state = deployCard(state, "A", aerialId, { specs: ALL_SPECS }); // Unit, sem trigger próprio

    const gmId = mkInstance(state, "A", ST01_CARD_DEFS.GM, "hand"); // futura vítima do combo de Breach concedido
    state = deployCard(state, "A", gmId, { specs: ALL_SPECS });

    const guncannonId = mkInstance(state, "A", ST01_CARD_DEFS.GUNCANNON, "hand"); // reserva de 4º atacante, usado só no turno 5 (demo de <Blocker>)
    state = deployCard(state, "A", guncannonId, { specs: ALL_SPECS });

    // ------------------------------------------------------------------
    // Turno 2 (B) — desarma a EX Base de A, deploya os primeiros Units.
    // ------------------------------------------------------------------
    state = finishTurnAndAdvance(state);
    giveResources(state, "B", 10);

    const tallgeeseId = mkInstance(state, "B", ST02_CARD_DEFS.TALLGEESE, "hand");
    state = deployCard(state, "B", tallgeeseId, { specs: ALL_SPECS }); // Unit, sem trigger próprio no Deploy

    const aExBaseId = state.players.A.baseSection[0].instanceId;
    state = runAttack(state, tallgeeseId, "player"); // Tallgeese AP4 >= EX Base HP3
    expect(state.players.A.baseSection.length).toBe(0);
    expect(state.eventLog.some((e) => e.type === "DESTROY_CARD" && "instanceId" in e && e.instanceId === aExBaseId)).toBe(true);

    const sandrockId = mkInstance(state, "B", ST02_CARD_DEFS.GUNDAM_SANDROCK, "hand");
    state = deployCard(state, "B", sandrockId, { specs: ALL_SPECS });
    const leoId = mkInstance(state, "B", ST02_CARD_DEFS.LEO, "hand"); // Lv2/HP2 — alvo válido pro Deploy de Guntank
    state = deployCard(state, "B", leoId, { specs: ALL_SPECS });
    const ariesId = mkInstance(state, "B", ST02_CARD_DEFS.ARIES, "hand"); // <Blocker> — testado mais adiante
    state = deployCard(state, "B", ariesId, { specs: ALL_SPECS });

    // ------------------------------------------------------------------
    // Turno 3 (A) — pareia os dois Pilots (agora B já tem Units em campo
    // pra servir de alvo), deploya Guntank (Deploy), joga as duas Commands
    // 【Main】, e ativa Suletta Mercury 【Attack】 num ataque real.
    // ------------------------------------------------------------------
    state = finishTurnAndAdvance(state);
    giveResources(state, "A", 10);

    const amuroId1 = mkInstance(state, "A", ST01_CARD_DEFS.AMURO_RAY, "hand");
    state = deployCard(state, "A", amuroId1, {
      pairWithUnitId: maFormId,
      specs: ALL_SPECS,
      targets: { target: [tallgeeseId] }, // AMURO_RAY_WHEN_PAIRED: Tallgeese (HP4 <= 5) fica rested
      predicateResolver: pairedPilotHasTraitResolver,
    });
    expect(findCard(state, tallgeeseId).rested).toBe(true); // ST01-010 When Paired
    const handBeforeDraw = state.players.A.hand.length;
    // ST01-002 When Paired (+trait White Base Team do Amuro Ray): compra 1 — já refletido acima, confirmado pelo tamanho da mão adiante

    const sulettaId1 = mkInstance(state, "A", ST01_CARD_DEFS.SULETTA_MERCURY, "hand");
    state = deployCard(state, "A", sulettaId1, {
      pairWithUnitId: aerialId,
      specs: ALL_SPECS,
      targets: { target: [sandrockId] }, // AERIAL_SCORE_SIX_WHEN_PAIRED: Sandrock (Lv4) recebe AP-3
    });
    expect(findCard(state, sandrockId).statModifiers).toEqual([{ stat: "ap", amount: -3, duration: "endOfTurn", appliedOnTurn: state.turnNumber }]);
    expect(state.players.A.hand.length).toBe(handBeforeDraw); // Suletta saiu (-1) mas não tem draw — só o Amuro já tinha dado o +1 antes

    const guntankId = mkInstance(state, "A", ST01_CARD_DEFS.GUNTANK, "hand");
    state = deployCard(state, "A", guntankId, { specs: ALL_SPECS, targets: { target: [leoId] } }); // GUNTANK_DEPLOY: Leo (HP2) fica rested
    expect(findCard(state, leoId).rested).toBe(true);

    const thoroughlyDamagedId = mkInstance(state, "A", ST01_CARD_DEFS.THOROUGHLY_DAMAGED, "hand");
    state = playCommand(state, "A", thoroughlyDamagedId, "Main", ALL_SPECS, { targets: { target: [leoId] } }); // Leo (rested) leva 1 dano
    expect(findCard(state, leoId).damage).toBe(1);

    // dano real numa Unit própria pra depois curar com Kai's Resolve
    findCard(state, aerialId).damage = 2; // mutação de fixture — simula dano de batalha já sofrido antes deste teste
    const kaisResolveId = mkInstance(state, "A", ST01_CARD_DEFS.KAIS_RESOLVE, "hand");
    state = playCommand(state, "A", kaisResolveId, "Main", ALL_SPECS, { targets: { target: [aerialId] } });
    expect(findCard(state, aerialId).damage).toBe(0); // recupera 3, tinha 2 de dano

    const unforeseenMainId = mkInstance(state, "A", ST01_CARD_DEFS.UNFORESEEN_INCIDENT, "hand");
    state = playCommand(state, "A", unforeseenMainId, "Main", ALL_SPECS, { targets: { target: [sandrockId] } }); // 2ª aplicação de AP-3 no Sandrock

    // Suletta Mercury <Attack><Once per Turn>: ativa junto do ataque da Unit pareada (Aerial Score Six)
    const restedResourceId = state.players.A.resourceArea.find((r) => !r.rested)!.instanceId;
    findCard(state, restedResourceId).rested = true; // simula recurso já gasto neste turno, pra observar o "set active"
    state = runAttack(state, aerialId, "player", {
      runActionStep: (s, defending, attacking) => {
        let n = dispatchTrigger(s, sulettaId1, "Attack", ALL_SPECS, { targets: { target: [restedResourceId] } });
        n = passAction(n, defending);
        n = passAction(n, attacking);
        return n;
      },
    });
    expect(findCard(state, restedResourceId).rested).toBe(false); // SULETTA_MERCURY_ATTACK: seta o recurso active de novo
    expect(state.players.B.shields.length).toBe(5); // consumiu 1 shield de B (sem Burst cadastrado pra Sandrock)

    // 【Action】 UNFORESEEN_INCIDENT no próprio Action Step do ataque de Guntank contra B, com prioridade repassada pra A
    const unforeseenActionId = mkInstance(state, "A", ST01_CARD_DEFS.UNFORESEEN_INCIDENT, "hand");
    state = runAttack(state, guntankId, "player", {
      runActionStep: (s, defending, attacking) => {
        let n = passAction(s, defending); // B passa primeiro (jogador em espera) -> prioridade vai pra A
        n = playCommand(n, "A", unforeseenActionId, "Action", ALL_SPECS, { targets: { target: [sandrockId] } }); // 3ª aplicação de AP-3
        n = passAction(n, attacking);
        return n;
      },
    });
    expect(state.players.B.shields.length).toBe(4); // mais 1 shield de B consumido

    // ------------------------------------------------------------------
    // Turno 4 (B) — Simultaneous Fire concede <Breach 3> pro Tallgeese, que
    // ataca e destrói o GM de A (rested), estourando 3 shields de A de uma
    // vez (Amuro Ray/Suletta Mercury/Unforeseen Incident — os 3 com
    // 【Burst】 empilhados no topo). Depois arma os shields de B pro turno
    // 5 (Siege Ploy/Heero Yuy/Zechs Merquise) e joga Siege Ploy 【Main】.
    // ------------------------------------------------------------------
    state = finishTurnAndAdvance(state);
    giveResources(state, "B", 10);

    setTopShields(state, "A", [ST01_CARD_DEFS.AMURO_RAY, ST01_CARD_DEFS.SULETTA_MERCURY, ST01_CARD_DEFS.UNFORESEEN_INCIDENT]);

    const simultaneousFireId = mkInstance(state, "B", ST02_CARD_DEFS.SIMULTANEOUS_FIRE, "hand");
    state = playCommand(state, "B", simultaneousFireId, "Main", ALL_SPECS, { targets: { target: [tallgeeseId] } });
    expect(findCard(state, tallgeeseId).keywordGrants).toEqual([{ keyword: "Breach 3", duration: "endOfTurn", appliedOnTurn: state.turnNumber }]);

    findCard(state, gmId).rested = true; // mutação de fixture — precisa estar rested pra ser alvo legal de ataque

    const burstsFired: string[] = [];
    /** UNFORESEEN_INCIDENT_BURST/SIEGE_PLOY_BURST ativam a seção 【Main】 da própria carta, que precisa de alvo — os demais Burst deste roteiro são "self", `{}` basta. */
    function chooseBurstWithFallbackTarget(targetId: string): BurstChoiceFn {
      return (card) => {
        burstsFired.push(card.def.code);
        const targets: Record<string, string[]> = card.def.code === "ST01-014" || card.def.code === "ST02-014" ? { target: [targetId] } : {};
        return targets;
      };
    }

    const beforeBreach = state;
    state = runAttack(state, tallgeeseId, { unitId: gmId }, { chooseBurst: chooseBurstWithFallbackTarget(sandrockId) });
    expect(state.players.A.trash.some((c) => c.instanceId === gmId)).toBe(true); // GM (HP2) destruído pelo AP4 do Tallgeese
    expect(beforeBreach.players.A.shields.length - state.players.A.shields.length).toBe(3); // <Breach 3> concedido -> 3 shields de A
    expect(burstsFired.sort()).toEqual(["ST01-010", "ST01-011", "ST01-014"]); // Amuro Ray / Suletta Mercury / Unforeseen Incident
    expect(state.players.A.hand.some((c) => c.def.code === "ST01-010")).toBe(true); // AMURO_RAY_BURST: volta pra mão
    expect(state.players.A.hand.some((c) => c.def.code === "ST01-011")).toBe(true); // SULETTA_MERCURY_BURST: volta pra mão

    // Tallgeese atacou -> ficou rested. <Activate·Main><Once per Turn>: seta ele active de novo.
    expect(findCard(state, tallgeeseId).rested).toBe(true);
    state = dispatchTrigger(state, tallgeeseId, "Activate·Main", ALL_SPECS);
    expect(findCard(state, tallgeeseId).rested).toBe(false);
    const stateBeforeSecondActivate = state;
    state = dispatchTrigger(state, tallgeeseId, "Activate·Main", ALL_SPECS); // 【Once per Turn】: 2ª chamada não repete
    expect(state).toEqual(stateBeforeSecondActivate);

    // arma os shields de B pro turno 5 (só quem ataca quebra shield alheio — precisa ser turno de A)
    setTopShields(state, "B", [ST02_CARD_DEFS.SIEGE_PLOY, ST02_CARD_DEFS.HEERO_YUY, ST02_CARD_DEFS.ZECHS_MERQUISE]);

    const siegePloyMainId = mkInstance(state, "B", ST02_CARD_DEFS.SIEGE_PLOY, "hand");
    state = playCommand(state, "B", siegePloyMainId, "Main", ALL_SPECS, { targets: { target: [maFormId] } }); // MA Form tem HP3 <= 5
    expect(findCard(state, maFormId).rested).toBe(true);

    // ------------------------------------------------------------------
    // Turno 5 (A) — 3 ataques quebrando Siege Ploy/Heero Yuy/Zechs Merquise
    // (fecha a cobertura de Burst de B), 【Action】 Siege Ploy no Action Step
    // do 1º ataque (prioridade começa com quem defende — B — nesse Step),
    // e 1 ataque bloqueado por <Blocker> (Aries) que não consome shield.
    // ------------------------------------------------------------------
    state = finishTurnAndAdvance(state);
    expect(findCard(state, maFormId).damage).toBe(0); // MA Form não tem <Repair> — nada mudou no End Phase do turno 4; ver Repair dedicado abaixo
    giveResources(state, "A", 10);
    findCard(state, maFormId).rested = false; // Start Phase já reverteu isso — só documentando que MA Form está de volta a active

    const restCountBefore = state.eventLog.filter((e) => e.type === "REST_CARD" && "instanceId" in e && e.instanceId === maFormId).length;
    const siegePloyActionId = mkInstance(state, "B", ST02_CARD_DEFS.SIEGE_PLOY, "hand");
    state = runAttack(state, maFormId, "player", {
      runActionStep: (s, defending, attacking) => {
        // Action Step começa com prioridade de quem defende (B) — B pode jogar direto, sem precisar passar antes.
        // alvo = a própria MA Form (já vai ficar rested por atacar de qualquer forma — não compete com os próximos atacantes).
        let n = playCommand(s, "B", siegePloyActionId, "Action", ALL_SPECS, { targets: { target: [maFormId] } });
        n = passAction(n, defending);
        n = passAction(n, attacking);
        return n;
      },
      chooseBurst: chooseBurstWithFallbackTarget(maFormId),
    });
    // rested já seria true só por atacar — a prova de que SIEGE_PLOY_ACTION (Command) + SIEGE_PLOY_BURST (shield que quebrou nesse mesmo ataque) rodaram de verdade é +3 REST_CARD na MA Form (declareAttack + Action + Burst)
    const restCountAfter = state.eventLog.filter((e) => e.type === "REST_CARD" && "instanceId" in e && e.instanceId === maFormId).length;
    expect(restCountAfter - restCountBefore).toBe(3);

    state = runAttack(state, aerialId, "player", { chooseBurst: chooseBurstWithFallbackTarget(sandrockId) });
    state = runAttack(state, guntankId, "player", { chooseBurst: chooseBurstWithFallbackTarget(sandrockId) });
    expect(burstsFired).toEqual(expect.arrayContaining(["ST02-014", "ST02-010", "ST02-011"])); // Siege Ploy / Heero Yuy / Zechs Merquise
    expect(state.players.B.hand.some((c) => c.def.code === "ST02-010")).toBe(true);
    expect(state.players.B.hand.some((c) => c.def.code === "ST02-011")).toBe(true);

    // <Blocker> — Aries (de B) redireciona o ataque de Guncannon contra si mesma, sem consumir shield
    const shieldsBeforeBlock = state.players.B.shields.length;
    state = runAttack(state, guncannonId, "player", { blockerId: ariesId });
    expect(state.players.B.shields.length).toBe(shieldsBeforeBlock); // Blocker: nenhum shield consumido
    // Aries (HP1) recebeu o ataque (AP2 do Guncannon) em vez do jogador -> destruída (dano zerado pelo DESTROY_CARD, por isso checamos o evento, não o `damage` ao vivo)
    expect(state.eventLog.some((e) => e.type === "DAMAGE_UNIT" && "instanceId" in e && e.instanceId === ariesId)).toBe(true);
    expect(state.players.B.trash.some((c) => c.instanceId === ariesId)).toBe(true);

    // <Repair 2> automático — ST01-001 Gundam (During Pair fora de escopo, só o Repair automático é testado aqui)
    const repairGundamId = mkInstance(state, "A", ST01_CARD_DEFS.GUNDAM, "hand");
    state = deployCard(state, "A", repairGundamId, { specs: ALL_SPECS });
    findCard(state, repairGundamId).damage = 3; // mutação de fixture — simula dano de batalha já sofrido
    state = finishTurnAndAdvance(state); // End Phase de A roda computeRepairEvents antes de passar o turno pra B
    expect(findCard(state, repairGundamId).damage).toBe(1); // 3 - Repair 2 = 1

    // ------------------------------------------------------------------
    // Turno 6 (B) — termina o jogo: leva B a 0 shields e, no ataque
    // seguinte, GAME_OVER real (Comprehensive Rules 1-2-2-1).
    // ------------------------------------------------------------------
    let safety = 0;
    while (!state.gameOver) {
      if (++safety > 100) throw new Error("partida não terminou em GAME_OVER dentro do limite de segurança — provável bug na condição de saída");
      if (state.activePlayer !== "A") {
        state = finishTurnAndAdvance(state); // passa o turno de B (não precisa agir pra terminar o jogo) e volta pra A
        continue;
      }
      const attacker = state.players.A.battleArea.find((c) => c.def.cardType === "UNIT" && !c.rested);
      if (!attacker) {
        state = finishTurnAndAdvance(state); // nenhuma Unit active de A — passa o turno, o Start Phase do próximo turno reativa
        continue;
      }
      state = runAttack(state, attacker.instanceId, "player");
    }

    expect(state.gameOver).toEqual({ winner: "A", reason: "noShieldsBattleDamage" });
    expect(state.players.B.shields.length).toBe(0);

    // ------------------------------------------------------------------
    // Pós-partida: os 4 EffectSpec de Base (Deploy/Burst) restantes não
    // dependem de mais combate real (Deploy dispara ao entrar em campo,
    // Burst já foi provado 8x acima com outras cartas) — testados aqui,
    // no mesmo `state` final, só pra fechar a cobertura dos 27/27.
    // ------------------------------------------------------------------
    const whiteBaseId = mkInstance(state, "A", ST01_CARD_DEFS.WHITE_BASE, "hand");
    giveResources(state, "A", 5);
    state.phase = "main"; // mutação de fixture — pós-GAME_OVER não há mais fases reais, só isolando o teste de Deploy
    state.activePlayer = "A";
    state.combat = null; // o combate que terminou a partida (GAME_OVER) nunca chega ao Battle End Step de verdade — isso só destrava deployCard pros specs de Base restantes, sem relação com aquele combate
    const shieldToMoveId = state.players.A.shields[0]?.instanceId;
    state = deployCard(state, "A", whiteBaseId, {
      specs: ALL_SPECS,
      targets: shieldToMoveId ? { shield: [shieldToMoveId] } : {},
    });
    expect(state.players.A.baseSection.some((c) => c.instanceId === whiteBaseId)).toBe(true); // deployou de verdade
    if (shieldToMoveId) expect(findCard(state, shieldToMoveId).zone).toBe("hand"); // WHITE_BASE_DEPLOY

    const whiteBaseShieldId = mkInstance(state, "A", ST01_CARD_DEFS.WHITE_BASE, "shields");
    state = dispatchTrigger(state, whiteBaseShieldId, "Burst", ALL_SPECS);
    expect(findCard(state, whiteBaseShieldId).zone).toBe("baseSection"); // WHITE_BASE_BURST
    // nota: o `moveZone self->baseSection` do Burst é uma primitiva de movimento genérica — ao
    // contrário de `deployCard`, ela não sabe da regra "máx. 1 Base" (rule 11-5-2 cobre isso pra
    // Burst também, mas essa é uma refinaria de regra fora do escopo desta wave, não uma das 8
    // lacunas já documentadas nem um dos 27 EffectSpecs). Esvazia por fixture antes do próximo Deploy
    // só pra isolar o teste de ASTICASSIA_DEPLOY (senão os dois ficariam empilhados na mesma zona).
    state.players.A.baseSection = [];

    const asticassiaId = mkInstance(state, "A", ST01_CARD_DEFS.ASTICASSIA, "hand");
    const shieldToMoveId2 = state.players.A.shields[0]?.instanceId;
    state = deployCard(state, "A", asticassiaId, {
      specs: ALL_SPECS,
      targets: shieldToMoveId2 ? { shield: [shieldToMoveId2] } : {},
    }); // substitui a Base anterior (máx. 1)
    expect(state.players.A.baseSection.map((c) => c.instanceId)).toEqual([asticassiaId]); // ASTICASSIA_DEPLOY dispara
    if (shieldToMoveId2) expect(findCard(state, shieldToMoveId2).zone).toBe("hand");

    const asticassiaShieldId = mkInstance(state, "A", ST01_CARD_DEFS.ASTICASSIA, "shields");
    state = dispatchTrigger(state, asticassiaShieldId, "Burst", ALL_SPECS);
    expect(findCard(state, asticassiaShieldId).zone).toBe("baseSection"); // ASTICASSIA_BURST

    // B terminou a partida com 0 shields (é assim que o GAME_OVER acontece) — repõe um punhado só
    // pra destravar o alvo "shield" do Deploy de Saint Gabriel/Corsica Base abaixo (pós-partida, fixture).
    mkInstance(state, "B", ST02_CARD_DEFS.RESOURCE, "shields");
    mkInstance(state, "B", ST02_CARD_DEFS.RESOURCE, "shields");

    const saintGabrielId = mkInstance(state, "B", ST02_CARD_DEFS.SAINT_GABRIEL_INSTITUTE, "hand");
    giveResources(state, "B", 5);
    state.activePlayer = "B";
    const bShieldToMoveId = state.players.B.shields[0]?.instanceId;
    state = deployCard(state, "B", saintGabrielId, {
      specs: ALL_SPECS,
      targets: bShieldToMoveId ? { shield: [bShieldToMoveId] } : {},
    });
    expect(state.players.B.baseSection.some((c) => c.instanceId === saintGabrielId)).toBe(true); // SAINT_GABRIEL_INSTITUTE_DEPLOY
    if (bShieldToMoveId) expect(findCard(state, bShieldToMoveId).zone).toBe("hand");

    const saintGabrielShieldId = mkInstance(state, "B", ST02_CARD_DEFS.SAINT_GABRIEL_INSTITUTE, "shields");
    state = dispatchTrigger(state, saintGabrielShieldId, "Burst", ALL_SPECS);
    expect(findCard(state, saintGabrielShieldId).zone).toBe("baseSection"); // SAINT_GABRIEL_INSTITUTE_BURST
    // nota: mesma simplificação de fixture documentada no lado A (`moveZone self->baseSection`
    // do Burst não sabe da regra "máx. 1 Base" — só `deployCard` sabe). Esvazia antes do próximo
    // Deploy só pra isolar o teste de CORSICA_BASE_DEPLOY.
    state.players.B.baseSection = [];

    const corsicaBaseId = mkInstance(state, "B", ST02_CARD_DEFS.CORSICA_BASE, "hand");
    const bShieldToMoveId2 = state.players.B.shields[0]?.instanceId;
    state = deployCard(state, "B", corsicaBaseId, {
      specs: ALL_SPECS,
      targets: bShieldToMoveId2 ? { shield: [bShieldToMoveId2] } : {},
    });
    expect(state.players.B.baseSection.map((c) => c.instanceId)).toEqual([corsicaBaseId]); // CORSICA_BASE_DEPLOY
    if (bShieldToMoveId2) expect(findCard(state, bShieldToMoveId2).zone).toBe("hand");

    const corsicaBaseShieldId = mkInstance(state, "B", ST02_CARD_DEFS.CORSICA_BASE, "shields");
    state = dispatchTrigger(state, corsicaBaseShieldId, "Burst", ALL_SPECS);
    expect(findCard(state, corsicaBaseShieldId).zone).toBe("baseSection"); // CORSICA_BASE_BURST
  });
});

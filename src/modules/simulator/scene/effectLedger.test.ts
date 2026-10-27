import { describe, expect, it } from "vitest";
import type { GameEvent } from "../engine/types";
import { buildEffectLedger, describeLedgerEffect, effectTargetOf, ledgerScopeLabel, ledgerSourceLabel, relaxTargetPt } from "./effectLedger";

const pt = (p: string) => p;
const en = (_p: string, e: string) => e;

describe("buildEffectLedger — quem aplicou o quê, em quem (BUG-GERVVQ)", () => {
  it("o 【Deploy】 do Kayra's Jegan fica ligado à Unit escolhida, com a condição do alvo", () => {
    const log: GameEvent[] = [
      { type: "TURN_CHANGE", turnNumber: 8, activePlayer: "B" },
      { type: "CARD_PLAYED", player: "B", instanceId: "B-kayra", as: "unit" },
      { type: "ABILITY_ACTIVATED", player: "B", instanceId: "B-kayra", trigger: "Deploy" },
      { type: "GRANT_ATTACK_TARGET_RELAX", instanceId: "B-murasame", maxAp: 4, turn: 8 },
    ];
    const [entry, ...rest] = buildEffectLedger(log);
    expect(rest).toEqual([]);
    expect(entry.source).toEqual({ instanceId: "B-kayra", player: "B", trigger: "Deploy" });
    expect(entry.targetId).toBe("B-murasame");
    expect(entry.scope).toBe("turn");
    expect(describeLedgerEffect(entry.effect, pt)).toBe("pode atacar Unit inimiga ativa com AP 4 ou menos");
    expect(describeLedgerEffect(entry.effect, en)).toBe("may attack an active enemy Unit with 4 or less AP");
  });

  it("Command jogada é a fonte do que vem depois; a Unit que entra em seguida fecha a fonte", () => {
    const log: GameEvent[] = [
      { type: "CARD_PLAYED", player: "A", instanceId: "A-cmd", as: "command", trigger: "Main" },
      { type: "MODIFY_STAT", instanceId: "A-u1", modifier: { stat: "ap", amount: 2, duration: "endOfTurn", appliedOnTurn: 3, appliedBy: "A" } },
      { type: "CARD_PLAYED", player: "A", instanceId: "A-u2", as: "unit" },
      { type: "GRANT_KEYWORD", instanceId: "A-u2", grant: { keyword: "Blocker", duration: "endOfTurn", appliedOnTurn: 3 } },
    ];
    const ledger = buildEffectLedger(log);
    expect(ledger.map((e) => [e.source?.instanceId ?? null, e.targetId])).toEqual([
      ["A-cmd", "A-u1"],
      [null, "A-u2"],
    ]);
    expect(describeLedgerEffect(ledger[0].effect, pt)).toBe("+2 AP");
    expect(describeLedgerEffect(ledger[1].effect, pt)).toBe("ganhou <Blocker>");
  });

  it("só conta desde a última virada de turno; efeito de batalha sai no fim do combate", () => {
    const log: GameEvent[] = [
      { type: "ABILITY_ACTIVATED", player: "A", instanceId: "A-old", trigger: "Deploy" },
      { type: "MODIFY_STAT", instanceId: "A-u1", modifier: { stat: "ap", amount: 1, duration: "endOfTurn", appliedOnTurn: 2 } },
      { type: "TURN_CHANGE", turnNumber: 3, activePlayer: "A" },
      { type: "ATTACK_DECLARED", attackerId: "A-u1", attackingPlayer: "A", defendingPlayer: "B", target: "player" },
      { type: "ABILITY_ACTIVATED", player: "A", instanceId: "A-u1", trigger: "Attack" },
      { type: "MODIFY_STAT", instanceId: "A-u1", modifier: { stat: "ap", amount: 3, duration: "thisBattle", appliedOnTurn: 3 } },
      { type: "MODIFY_STAT", instanceId: "B-e1", modifier: { stat: "hp", amount: -1, duration: "endOfTurn", appliedOnTurn: 3 } },
      { type: "COMBAT_ENDED" },
    ];
    const ledger = buildEffectLedger(log);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ targetId: "B-e1", scope: "turn", source: { instanceId: "A-u1", trigger: "Attack" } });
    expect(describeLedgerEffect(ledger[0].effect, pt)).toBe("-1 HP");
  });

  it("carta que saiu do campo não fica no livro", () => {
    const log: GameEvent[] = [
      { type: "ABILITY_ACTIVATED", player: "A", instanceId: "A-src", trigger: "Activate·Main" },
      { type: "SET_CANNOT_ATTACK", instanceId: "B-e1", turn: 4 },
      { type: "SET_CANNOT_ATTACK", instanceId: "B-e2", turn: 4 },
    ];
    expect(buildEffectLedger(log, new Set(["B-e2"])).map((e) => e.targetId)).toEqual(["B-e2"]);
  });

  it("a fonte fecha na troca de fase/passo e no ataque", () => {
    const log: GameEvent[] = [
      { type: "ABILITY_ACTIVATED", player: "A", instanceId: "A-src", trigger: "Deploy" },
      { type: "COMBAT_STEP_CHANGE", step: "action" },
      { type: "PREVENT_BEING_ATTACK_TARGET", instanceId: "A-u1", turn: 4 },
    ];
    expect(buildEffectLedger(log)[0].source).toBeNull();
  });
});

describe("textos do livro", () => {
  it("rótulo da fonte com o gatilho como na carta", () => {
    const nameOf = (id: string) => ({ "A-k": "Kayra's Jegan", "A-c": "Operation Meteor" })[id];
    expect(ledgerSourceLabel({ instanceId: "A-k", player: "A", trigger: "Deploy" }, nameOf, pt)).toBe("Kayra's Jegan 【Deploy】");
    expect(ledgerSourceLabel({ instanceId: "A-c", player: "A", trigger: "Command" }, nameOf, pt)).toBe("Operation Meteor");
    expect(ledgerSourceLabel({ instanceId: "A-k", player: "A", trigger: "Activate·Main" }, nameOf, pt)).toBe("Kayra's Jegan 【Activate･Main】");
    expect(ledgerSourceLabel(null, nameOf, pt)).toBe("Efeito");
  });

  it("condições combinadas do alvo de ataque e duração", () => {
    expect(relaxTargetPt({ damagedOnly: true, maxLevel: 4 })).toBe("Unit inimiga ativa danificada de Lv.4 ou menos");
    expect(ledgerScopeLabel("battle", pt)).toBe("nesta batalha");
    expect(describeLedgerEffect({ kind: "damageModifier", modifier: { immune: true, kind: "battle", scope: "next", turn: 1 } }, pt)).toBe(
      "não recebe o próximo dano de batalha",
    );
    expect(describeLedgerEffect({ kind: "damageModifier", modifier: { amount: -1, enemyOnly: true, scope: "turn", turn: 1 } }, pt)).toBe(
      "recebe 1 a menos de dano de inimigos",
    );
  });

  it("alvo do evento para a linha da fonte durante o efeito", () => {
    expect(effectTargetOf({ type: "DAMAGE_UNIT", instanceId: "B-e1", amount: 2 } as GameEvent)).toBe("B-e1");
    expect(effectTargetOf({ type: "GRANT_ATTACK_TARGET_RELAX", instanceId: "A-u1", turn: 2 })).toBe("A-u1");
    expect(effectTargetOf({ type: "DRAW_CARD", player: "A", from: "deck", instanceId: "A-x" } as GameEvent)).toBeNull();
  });
});

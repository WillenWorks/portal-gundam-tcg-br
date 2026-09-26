import { describe, expect, it } from "vitest";
import type { CardDef } from "../../engine/types";
import type { EffectSpec } from "../../engine/effectSpec";
import { auditCard, isPlayable, normalizeClause, splitClauses } from "./clauseAudit";

const def = (over: Partial<CardDef> = {}): CardDef => ({ code: "X-001", nameEn: "X", cardType: "UNIT", ...over }) as CardDef;
const spec = (trigger: string, sourceText: string, over: Partial<EffectSpec> = {}): EffectSpec =>
  ({ id: `X-001-${trigger}`, cardCode: "X-001", trigger, actions: [], sourceText, ...over }) as EffectSpec;

describe("splitClauses", () => {
  it("separa por linha, lê a cadeia de marcadores e descarta lembrete e linha vazia", () => {
    const clauses = splitClauses(
      "【During Pair】This Unit gains <High-Maneuver>.\n\n(This Unit can't be blocked.)\nDuring your turn, when this Unit destroys an enemy shield area card with battle damage, choose 1 enemy Unit. Deal 2 damage to it.",
    );
    expect(clauses.map((c) => c.kind)).toEqual(["bespoke", "bespoke"]);
    expect(clauses[0].qualifiers).toContain("During Pair");
    expect(clauses[0].triggers).toEqual([]);
    expect(clauses[1].triggers).toEqual([]);
  });

  it("【Main】/【Action】 vira um conjunto de 2 gatilhos", () => {
    const [c] = splitClauses("【Main】/【Action】Choose 1 friendly (Titans) Unit. It gets AP+2 during this turn.");
    expect(c.triggers).toEqual(["Main", "Action"]);
    expect(c.body).toBe("Choose 1 friendly (Titans) Unit. It gets AP+2 during this turn.");
  });

  it("keyword pura (com lembrete inline) e 【Pilot】[X] não são texto bespoke", () => {
    const clauses = splitClauses("【Activate･Main】<Support 3> (Rest this Unit. 1 other friendly Unit gets AP+(specified amount) during this turn.)\n<Blocker>\n【Pilot】[Mouar Pharaoh]");
    expect(clauses.map((c) => c.kind)).toEqual(["keyword", "keyword", "pilotMode"]);
    expect(clauses[0].keywords).toEqual(["Support"]);
    expect(clauses[2].pilotName).toBe("Mouar Pharaoh");
  });

  it("qualificador de Piloto com trait e Development ficam nos qualifiers, o gatilho fica limpo", () => {
    const [c] = splitClauses("【When Paired･(Newtype) Pilot】Draw 1.");
    expect(c.triggers).toEqual(["When Paired"]);
    expect(c.qualifiers).toContain("(Newtype) Pilot");
    const [d] = splitClauses("【Deploy･Development 2】Draw 1.");
    expect(d.triggers).toEqual(["Deploy"]);
    expect(d.qualifiers).toContain("Development 2");
  });

  it("linha ■ gruda na cláusula anterior", () => {
    const clauses = splitClauses("【Main】Choose one:\n■Draw 1.\n■Deal 1 damage to 1 enemy Unit.");
    expect(clauses).toHaveLength(1);
    expect(clauses[0].body).toContain("■Draw 1.");
  });

  it("linha ■ gruda no cabeçalho mesmo com linha em branco entre eles (GD05-102)", () => {
    const effect =
      "【Action】When playing this card, choose 1 of the following effects and activate it:\n\n" +
      "■Choose 1 enemy Unit with 5 or less HP. Return it to its owner's hand.\n\n" +
      "■Choose 1 Unit. It recovers 3 HP.";
    const clauses = splitClauses(effect);
    expect(clauses).toHaveLength(1);
    expect(clauses[0].triggers).toEqual(["Action"]);
    expect(clauses[0].body).toContain("■Choose 1 Unit. It recovers 3 HP.");
  });

  it("normalizeClause unifica separadores e espaços", () => {
    expect(normalizeClause("【Activate・Main】  Rest  it.")).toBe(normalizeClause("【Activate･Main】 Rest it."));
    expect(normalizeClause("won' t")).toBe("won't");
  });
});

describe("auditCard", () => {
  it("GD01-099: Burst coberto mas 【Main】/【Action】 sem spec → missing", () => {
    const effect = "【Burst】Choose 1 enemy Unit with 5 or less HP. Rest it.\n【Main】/【Action】Choose 1 to 2 enemy Units with 3 or less HP. Rest them.";
    const audit = auditCard({ code: "X-001", effect, def: def({ cardType: "COMMAND" }), specs: [spec("Burst", "【Burst】Choose 1 enemy Unit with 5 or less HP. Rest it.")] });
    expect(audit.status).toBe("missing");
    expect(audit.clauses[1].by).toBe("missing");
    expect(isPlayable(audit)).toBe(false);
  });

  it("【Main】/【Action】 só com spec de Action → triggerMismatch (Main continua descoberto)", () => {
    const effect = "【Main】/【Action】Choose 1 friendly (Titans) Unit. It gets AP+2 during this turn.";
    const audit = auditCard({ code: "X-001", effect, def: def(), specs: [spec("Action", effect)] });
    expect(audit.status).toBe("missing");
    expect(audit.clauses[0].missingTriggers).toEqual(["Main"]);
  });

  it("com specs pros 2 gatilhos → full", () => {
    const effect = "【Main】/【Action】Choose 1 friendly (Titans) Unit. It gets AP+2 during this turn.";
    const audit = auditCard({ code: "X-001", effect, def: def(), specs: [spec("Main", effect), spec("Action", effect)] });
    expect(audit.status).toBe("full");
  });

  it("GD01-087: estático coberto por campo estruturado, mas o 【Burst】 sem spec → missing", () => {
    const effect = "【Burst】Add this card to your hand.\nWhile this Unit is blue, it gains <Repair 1>.\n\n(At the end of your turn, this Unit recovers the specified number of HP.)";
    const audit = auditCard({ code: "X-001", effect, def: def({ cardType: "PILOT", staticAbilities: [{} as never] }), specs: [] });
    expect(audit.clauses.map((c) => c.by)).toEqual(["missing", "structured"]);
    expect(audit.status).toBe("missing");
  });

  it("cláusula dividida em 2 specs (sem o marcador) conta como coberta", () => {
    const effect = "【Deploy】Draw 1. Then, discard 1.";
    const audit = auditCard({ code: "X-001", effect, def: def(), specs: [spec("Deploy", "Draw 1."), spec("Deploy", "Then, discard 1.")] });
    expect(audit.status).toBe("full");
  });

  it("spec cujo texto não está na carta → orphanSpec", () => {
    const effect = "【Deploy】Choose 1 of your Units. During this turn, it may choose an active enemy Unit as its attack target.";
    const audit = auditCard({ code: "X-001", effect, def: def(), specs: [spec("Deploy", "【Deploy】Draw 2.")] });
    expect(audit.errors.some((e) => e.startsWith("orphanSpec"))).toBe(true);
  });

  it("keyword declarada no texto mas ausente do CardDef → keywordMismatch", () => {
    const audit = auditCard({ code: "X-001", effect: "<Blocker>", def: def({ effectKeywords: [] }), specs: [] });
    expect(audit.errors.some((e) => e.startsWith("keywordMismatch"))).toBe(true);
    const ok = auditCard({ code: "X-001", effect: "<Blocker>", def: def({ effectKeywords: ["Blocker"] }), specs: [] });
    expect(ok.status).toBe("vanilla");
  });

  it("cláusula deferida → partial e ainda jogável", () => {
    const effect = "【Attack】Choose 1 enemy Unit. It can't block during this turn.";
    const audit = auditCard({
      code: "X-001",
      effect,
      def: def(),
      specs: [],
      deferrals: [{ cardCode: "X-001", clause: "It can't block during this turn.", reason: "r", blockedBy: "engine:x" }],
    });
    expect(audit.status).toBe("partial");
    expect(isPlayable(audit)).toBe(true);
  });

  it("carta sem CardDef → unknownCode", () => {
    const audit = auditCard({ code: "X-001", effect: "【Deploy】Draw 1.", def: undefined, specs: [] });
    expect(audit.errors).toContain("unknownCode");
    expect(isPlayable(audit)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { ALL_EFFECT_SPECS } from "../content";
import { specNeedsNamedTarget, type EffectSpec } from "./effectSpec";

/**
 * Invariantes estruturais de TODOS os EffectSpecs — transformam as classes de bug achadas na auditoria
 * da W4/W5 em checagem automática (cada set novo passa por aqui sem precisar de auditoria manual).
 *
 * - alvo que o motor não reconhece como escolha → no jogo real ele não pede o alvo e o efeito some
 *   (GD04-035/087/095/115 na W5d; GD04-099/GD03-110 na auditoria)
 * - nome de alvo que nada preenche (typo/convenção paralela)
 * - gatilho de reação/atrasado desencontrado do `reaction.event`
 */

/** alvos que o MOTOR preenche (não são escolha do jogador) */
const IMPLICIT_TARGETS = new Set(["battleVictim", "reactionSubject", "formerPairedPilot", "reactionAmount"]);

/**
 * Pendências conhecidas (auditoria W4/W5, item A3) — em investigação. Remover daqui ao resolver;
 * o teste falha se a lista ficar desatualizada (spec consertado ou removido).
 */
const KNOWN_PENDING_TARGETS = new Set(["ST06-005-Attack", "ST06-011-Main", "ST06-011-Action", "ST06-013-Action", "ST07-013-Action"]);

function refsIn(v: unknown, out: Array<{ kind: string; name: string }> = []): Array<{ kind: string; name: string }> {
  if (!v || typeof v !== "object") return out;
  if (Array.isArray(v)) {
    v.forEach((x) => refsIn(x, out));
    return out;
  }
  const o = v as Record<string, unknown>;
  if ((o.kind === "named" || o.kind === "namedGroup" || o.kind === "pairedPilotOf") && typeof o.name === "string") {
    out.push({ kind: o.kind, name: o.name });
  }
  Object.values(o).forEach((x) => refsIn(x, out));
  return out;
}

/** nomes de escolha que o próprio spec declara: 2º alvo e slots de `moveWithinDeck` (reordenar o topo) */
function declaredChoiceNames(spec: EffectSpec): Set<string> {
  const names = new Set<string>(["target"]);
  if (spec.secondaryTarget) names.add(spec.secondaryTarget.name);
  const calls = [spec.actions, spec.cost, spec.condition?.then, spec.condition?.else, spec.condition2?.then, spec.condition2?.else].flat();
  for (const c of calls) {
    if (c?.op === "moveWithinDeck" && c.target.kind === "named") names.add(c.target.name);
  }
  return names;
}

describe("invariantes de EffectSpec (todos os sets)", () => {
  it("ids únicos", () => {
    const seen = new Map<string, number>();
    for (const s of ALL_EFFECT_SPECS) seen.set(s.id, (seen.get(s.id) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
  });

  it("todo alvo nomeado é preenchido por alguém (escolha declarada ou alvo implícito do motor)", () => {
    const bad: string[] = [];
    for (const s of ALL_EFFECT_SPECS) {
      if (KNOWN_PENDING_TARGETS.has(s.id)) continue;
      const allowed = declaredChoiceNames(s);
      const refs = refsIn([s.actions, s.cost, s.condition, s.condition2]);
      for (const r of refs) if (!allowed.has(r.name) && !IMPLICIT_TARGETS.has(r.name)) bad.push(`${s.id}: ${r.kind}("${r.name}")`);
    }
    expect(bad).toEqual([]);
  });

  it("spec com escopo de alvo é reconhecido como escolha (senão o jogo real não pede o alvo)", () => {
    const bad = ALL_EFFECT_SPECS.filter(
      (s) => (s.targetScope || s.targetFilter) && !specNeedsNamedTarget(s) && !s.secondaryTarget && !KNOWN_PENDING_TARGETS.has(s.id),
    ).map((s) => s.id);
    expect(bad).toEqual([]);
  });

  it("a lista de pendências conhecidas não está desatualizada", () => {
    const ids = new Set(ALL_EFFECT_SPECS.map((s) => s.id));
    for (const id of KNOWN_PENDING_TARGETS) expect(ids.has(id), `${id} não existe mais — tire de KNOWN_PENDING_TARGETS`).toBe(true);
  });

  it("gatilho `Reaction:`/`Delayed:` bate com `reaction.event`", () => {
    const bad = ALL_EFFECT_SPECS.filter((s) => /^(Reaction|Delayed):/.test(s.trigger))
      .filter((s) => s.trigger.split(":")[1] !== s.reaction?.event)
      .map((s) => `${s.id} (${s.trigger} × ${s.reaction?.event ?? "sem reaction"})`);
    expect(bad).toEqual([]);
  });

  it("gatilho atrasado: todo `grantDelayedReaction` aponta para um spec `Delayed:` existente, e todo `Delayed:` é armado por alguém", () => {
    const byId = new Map(ALL_EFFECT_SPECS.map((s) => [s.id, s]));
    const granted = new Set<string>();
    const bad: string[] = [];
    for (const s of ALL_EFFECT_SPECS) {
      const calls = [s.actions, s.cost, s.condition?.then, s.condition?.else, s.condition2?.then, s.condition2?.else].flat();
      for (const c of calls) {
        if (c?.op !== "grantDelayedReaction") continue;
        granted.add(c.specId);
        const target = byId.get(c.specId);
        if (!target || !target.trigger.startsWith("Delayed:")) bad.push(`${s.id} → ${c.specId}`);
      }
    }
    for (const s of ALL_EFFECT_SPECS) if (s.trigger.startsWith("Delayed:") && !granted.has(s.id)) bad.push(`${s.id} nunca é armado`);
    expect(bad).toEqual([]);
  });
});
